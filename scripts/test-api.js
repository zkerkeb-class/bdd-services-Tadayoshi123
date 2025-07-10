#!/usr/bin/env node
// bdd-services-Tadayoshi123/scripts/test-api.js
// Script de test automatisé pour l'API du db-service

require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

class DbServiceTester {
  constructor() {
    this.baseURL = process.env.API_URL || 'http://localhost:3002';
    this.jwtSecret = process.env.JWT_SECRET;
    
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET not found in environment variables');
    }
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Variables pour stocker les IDs créés pendant les tests
    this.testData = {
      userId: null,
      clientId: null,
      refreshTokenId: null
    };
  }
  
  /**
   * Générer un token JWT de test
   */
  generateTestToken() {
    const payload = {
      serviceId: 'auth-service',
      serviceName: 'auth-service', 
      permissions: ['users:*', 'clients:*', 'tokens:*', 'admin'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 heure
    };
    
    return jwt.sign(payload, this.jwtSecret);
  }
  
  /**
   * Configurer l'authentification
   */
  setupAuth() {
    const token = this.generateTestToken();
    this.client.defaults.headers.Authorization = `Bearer ${token}`;
    console.log('🔑 JWT Token configuré');
  }
  
  /**
   * Logger les résultats des tests
   */
  logResult(test, success, data = null, error = null) {
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${test}`);
    
    if (success && data) {
      console.log('   📄 Données:', JSON.stringify(data, null, 2).slice(0, 200) + '...');
    }
    
    if (!success && error) {
      console.log('   🚨 Erreur:', error.message);
      if (error.response?.data) {
        console.log('   📋 Détails:', JSON.stringify(error.response.data, null, 2));
      }
    }
    console.log('');
  }
  
  /**
   * Test de santé du service
   */
  async testHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/health`);
      this.logResult('Health Check', true, response.data);
      return true;
    } catch (error) {
      this.logResult('Health Check', false, null, error);
      return false;
    }
  }
  
  /**
   * Test CRUD Utilisateurs
   */
  async testUsers() {
    try {
      // 1. Créer un utilisateur
      const userData = {
        email: `test-${Date.now()}@supervia.com`,
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
        roles: ['USER']
      };
      
      const createResponse = await this.client.post('/api/v1/users', userData);
      this.testData.userId = createResponse.data.data.id;
      this.logResult('Créer Utilisateur', true, createResponse.data.data);
      
      // 2. Récupérer par ID
      const getByIdResponse = await this.client.get(`/api/v1/users/${this.testData.userId}`);
      this.logResult('Récupérer Utilisateur par ID', true, getByIdResponse.data.data);
      
      // 3. Récupérer par email
      const getByEmailResponse = await this.client.get(`/api/v1/users/email/${encodeURIComponent(userData.email)}`);
      this.logResult('Récupérer Utilisateur par Email', true, getByEmailResponse.data.data);
      
      // 4. Vérifier mot de passe
      const verifyPasswordResponse = await this.client.post(
        `/api/v1/users/${this.testData.userId}/verify-password`,
        { password: userData.password }
      );
      this.logResult('Vérifier Mot de Passe', true, verifyPasswordResponse.data.data);
      
      // 5. Mettre à jour utilisateur
      const updateResponse = await this.client.put(`/api/v1/users/${this.testData.userId}`, {
        firstName: 'Updated',
        lastName: 'User'
      });
      this.logResult('Mettre à Jour Utilisateur', true, updateResponse.data.data);
      
      // 6. Rechercher utilisateurs
      const searchResponse = await this.client.get('/api/v1/users?search=test&limit=5');
      this.logResult('Rechercher Utilisateurs', true, {
        count: searchResponse.data.data.length,
        pagination: searchResponse.data.pagination
      });
      
      return true;
    } catch (error) {
      this.logResult('Test Utilisateurs', false, null, error);
      return false;
    }
  }
  
  /**
   * Test CRUD Clients OAuth
   */
  async testClients() {
    if (!this.testData.userId) {
      console.log('❌ Test Clients ignoré - Aucun utilisateur créé');
      return false;
    }
    
    try {
      // 1. Créer un client
      const clientData = {
        name: `Test Client ${Date.now()}`,
        redirectUris: ['http://localhost:3001/callback', 'http://localhost:3001/auth'],
        allowedScopes: ['read', 'write', 'admin'],
        ownerId: this.testData.userId
      };
      
      const createResponse = await this.client.post('/api/v1/clients', clientData);
      this.testData.clientId = createResponse.data.data.id;
      this.logResult('Créer Client OAuth', true, createResponse.data.data);
      
      // 2. Récupérer par ID
      const getByIdResponse = await this.client.get(`/api/v1/clients/${this.testData.clientId}`);
      this.logResult('Récupérer Client par ID', true, getByIdResponse.data.data);
      
      // 3. Récupérer par clientId
      const clientIdValue = createResponse.data.data.clientId;
      const getByClientIdResponse = await this.client.get(`/api/v1/clients/by-client-id/${clientIdValue}`);
      this.logResult('Récupérer Client par clientId', true, getByClientIdResponse.data.data);
      
      // 4. Mettre à jour client
      const updateResponse = await this.client.put(`/api/v1/clients/${this.testData.clientId}`, {
        name: 'Updated Test Client',
        allowedScopes: ['read', 'write']
      });
      this.logResult('Mettre à Jour Client', true, updateResponse.data.data);
      
      return true;
    } catch (error) {
      this.logResult('Test Clients OAuth', false, null, error);
      return false;
    }
  }
  
  /**
   * Test CRUD Refresh Tokens
   */
  async testRefreshTokens() {
    if (!this.testData.userId) {
      console.log('❌ Test Refresh Tokens ignoré - Aucun utilisateur créé');
      return false;
    }
    
    try {
      // 1. Créer un refresh token
      const tokenData = {
        userId: this.testData.userId,
        clientId: this.testData.clientId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 jours
      };
      
      const createResponse = await this.client.post('/api/v1/refresh-tokens', tokenData);
      this.testData.refreshTokenId = createResponse.data.data.id;
      const tokenValue = createResponse.data.data.token;
      this.logResult('Créer Refresh Token', true, {
        id: createResponse.data.data.id,
        tokenLength: tokenValue.length,
        expiresAt: createResponse.data.data.expiresAt
      });
      
      // 2. Récupérer par token
      const getByTokenResponse = await this.client.get(`/api/v1/refresh-tokens/by-token/${tokenValue}`);
      this.logResult('Récupérer Token par Valeur', true, {
        id: getByTokenResponse.data.data.id,
        userId: getByTokenResponse.data.data.userId
      });
      
      // 3. Récupérer tokens utilisateur
      const getUserTokensResponse = await this.client.get(`/api/v1/refresh-tokens/user/${this.testData.userId}`);
      this.logResult('Récupérer Tokens Utilisateur', true, {
        count: getUserTokensResponse.data.data.length
      });
      
      // 4. Révoquer le token
      const revokeResponse = await this.client.post('/api/v1/refresh-tokens/revoke-by-token', {
        token: tokenValue
      });
      this.logResult('Révoquer Token', true, revokeResponse.data);
      
      return true;
    } catch (error) {
      this.logResult('Test Refresh Tokens', false, null, error);
      return false;
    }
  }
  
  /**
   * Test des erreurs et validation
   */
  async testErrorHandling() {
    try {
      // 1. Test utilisateur inexistant
      try {
        await this.client.get('/api/v1/users/00000000-0000-0000-0000-000000000000');
        this.logResult('Test Utilisateur Inexistant', false, null, new Error('Devrait avoir échoué'));
      } catch (error) {
        if (error.response?.status === 404) {
          this.logResult('Test Utilisateur Inexistant', true, { expectedError: 'USER_NOT_FOUND' });
        } else {
          throw error;
        }
      }
      
      // 2. Test validation email invalide
      try {
        await this.client.post('/api/v1/users', {
          email: 'invalid-email',
          password: 'short'
        });
        this.logResult('Test Validation Email', false, null, new Error('Devrait avoir échoué'));
      } catch (error) {
        if (error.response?.status === 400) {
          this.logResult('Test Validation Email', true, { expectedError: 'VALIDATION_ERROR' });
        } else {
          throw error;
        }
      }
      
      // 3. Test token JWT invalide
      const originalAuth = this.client.defaults.headers.Authorization;
      this.client.defaults.headers.Authorization = 'Bearer invalid-token';
      
      try {
        await this.client.get('/api/v1/users/stats');
        this.logResult('Test JWT Invalide', false, null, new Error('Devrait avoir échoué'));
      } catch (error) {
        if (error.response?.status === 401) {
          this.logResult('Test JWT Invalide', true, { expectedError: 'INVALID_TOKEN' });
        } else {
          throw error;
        }
      }
      
      // Restaurer l'auth
      this.client.defaults.headers.Authorization = originalAuth;
      
      return true;
    } catch (error) {
      this.logResult('Test Gestion Erreurs', false, null, error);
      return false;
    }
  }
  
  /**
   * Nettoyer les données de test
   */
  async cleanup() {
    try {
      const results = [];
      
      // Supprimer le client (cascade supprime les refresh tokens)
      if (this.testData.clientId) {
        try {
          await this.client.delete(`/api/v1/clients/${this.testData.clientId}`);
          results.push('Client supprimé');
        } catch (error) {
          results.push(`Erreur suppression client: ${error.message}`);
        }
      }
      
      // Supprimer l'utilisateur
      if (this.testData.userId) {
        try {
          await this.client.delete(`/api/v1/users/${this.testData.userId}`);
          results.push('Utilisateur supprimé');
        } catch (error) {
          results.push(`Erreur suppression utilisateur: ${error.message}`);
        }
      }
      
      this.logResult('Nettoyage', true, { actions: results });
      return true;
    } catch (error) {
      this.logResult('Nettoyage', false, null, error);
      return false;
    }
  }
  
  /**
   * Exécuter tous les tests
   */
  async runAllTests() {
    console.log('🚀 Démarrage des tests du DB Service\n');
    console.log(`🌐 URL: ${this.baseURL}`);
    console.log(`🔑 JWT Secret: ${this.jwtSecret.slice(0, 10)}...`);
    console.log(''.padEnd(50, '='));
    
    const results = {
      health: false,
      users: false,
      clients: false,
      refreshTokens: false,
      errorHandling: false,
      cleanup: false
    };
    
    // 1. Test de santé
    console.log('🏥 Test de Santé');
    results.health = await this.testHealth();
    
    if (!results.health) {
      console.log('❌ Service non disponible - Arrêt des tests');
      return results;
    }
    
    // 2. Configuration auth
    this.setupAuth();
    
    // 3. Test utilisateurs
    console.log('👥 Test Utilisateurs');
    results.users = await this.testUsers();
    
    // 4. Test clients OAuth
    console.log('🔑 Test Clients OAuth');
    results.clients = await this.testClients();
    
    // 5. Test refresh tokens
    console.log('🔄 Test Refresh Tokens');
    results.refreshTokens = await this.testRefreshTokens();
    
    // 6. Test gestion erreurs
    console.log('🚨 Test Gestion Erreurs');
    results.errorHandling = await this.testErrorHandling();
    
    // 7. Nettoyage
    console.log('🧹 Nettoyage');
    results.cleanup = await this.cleanup();
    
    // Résumé
    console.log(''.padEnd(50, '='));
    console.log('📊 RÉSUMÉ DES TESTS');
    console.log(''.padEnd(50, '-'));
    
    const total = Object.keys(results).length;
    const passed = Object.values(results).filter(Boolean).length;
    const failed = total - passed;
    
    Object.entries(results).forEach(([test, success]) => {
      const icon = success ? '✅' : '❌';
      console.log(`${icon} ${test.padEnd(15)} ${success ? 'PASS' : 'FAIL'}`);
    });
    
    console.log(''.padEnd(50, '-'));
    console.log(`📈 Résultat: ${passed}/${total} tests réussis`);
    
    if (failed === 0) {
      console.log('🎉 Tous les tests sont passés !');
    } else {
      console.log(`⚠️  ${failed} test(s) échoué(s)`);
    }
    
    return results;
  }
}

// Exécution si appelé directement
if (require.main === module) {
  const tester = new DbServiceTester();
  
  tester.runAllTests()
    .then((results) => {
      const failed = Object.values(results).filter(result => !result).length;
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error.message);
      process.exit(1);
    });
}

module.exports = DbServiceTester; 