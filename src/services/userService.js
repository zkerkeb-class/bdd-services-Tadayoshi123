// bdd-services-Tadayoshi123/src/services/userService.js
// Service de gestion des utilisateurs pour le db-service

const bcrypt = require('bcrypt');
const { AppError, DbErrorCodes, handlePrismaError } = require('../middlewares/errorHandler');

const SALT_ROUNDS = 10;

/**
 * Service de gestion des utilisateurs
 */
class UserService {
  constructor(prisma, logger) {
    this.prisma = prisma;
    this.logger = logger || console; // Fallback sur console si aucun logger n'est fourni
  }

  /**
   * Créer un nouvel utilisateur
   * @param {Object} userData - Données de l'utilisateur
   * @param {Object} context - Contexte de la requête (service, IP, etc.)
   * @returns {Promise<Object>} Utilisateur créé (sans mot de passe)
   */
  async createUser(userData, context = {}) {
    try {
      // Vérifier si l'email est déjà utilisé
      const existingUser = await this.prisma.user.findUnique({
        where: { email: userData.email }
      });
      
      if (existingUser) {
        throw new AppError('Cet email est déjà utilisé', 409, DbErrorCodes.EMAIL_ALREADY_EXISTS);
      }
      
      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);
      
      // Créer l'utilisateur
      const user = await this.prisma.user.create({
        data: {
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName || null,
          lastName: userData.lastName || null,
          picture: userData.picture || null,
          roles: userData.roles || ['USER'],
          active: userData.active ?? true,
          emailVerified: userData.emailVerified ?? false
        }
      });
      
      // Retourner l'utilisateur sans le mot de passe
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
      
    } catch (error) {
      if (error.code) {
        throw handlePrismaError(error);
      }
      throw error;
    }
  }
  
  /**
   * Récupérer un utilisateur par ID
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} options - Options de récupération
   * @returns {Promise<Object|null>} Utilisateur trouvé
   */
  async getUserById(userId, options = {}) {
    this.logger.info(`Fetching user by ID: ${userId}`);
    
    // Déstructurer les options avec des valeurs par défaut
    const { 
      includePassword = false, 
      includeRefreshTokens = false, 
      includeClients = false,
      includeDashboards = false
    } = options;
    
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          // Inclure les relations uniquement si explicitement demandé
          refreshTokens: includeRefreshTokens,
          clients: includeClients,
          dashboards: includeDashboards
        }
      });
      
      if (!user) {
        throw new AppError('Utilisateur non trouvé', 404, DbErrorCodes.USER_NOT_FOUND);
      }
      
      // Retourner avec ou sans mot de passe
      if (!includePassword) {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
      
      return user;
      
    } catch (error) {
      if (error.code) {
        throw handlePrismaError(error);
      }
      throw error;
    }
  }
  
  /**
   * Récupérer un utilisateur par email
   * @param {string} email - Email de l'utilisateur
   * @param {Object} options - Options de récupération
   * @returns {Promise<Object|null>} Utilisateur trouvé
   */
  async getUserByEmail(email, options = {}) {
    try {
      const { includePassword = false } = options;
      
      const user = await this.prisma.user.findUnique({
        where: { email }
      });
      
      if (!user) {
        throw new AppError('Utilisateur non trouvé', 404, DbErrorCodes.USER_NOT_FOUND);
      }
      
      // Retourner avec ou sans mot de passe
      if (!includePassword) {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
      
      return user;
      
    } catch (error) {
      if (error.code) {
        throw handlePrismaError(error);
      }
      throw error;
    }
  }
  
  /**
   * Mettre à jour un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} updateData - Données à mettre à jour
   * @param {Object} context - Contexte de la requête
   * @returns {Promise<Object>} Utilisateur mis à jour
   */
  async updateUser(userId, updateData, context = {}) {
    try {
      // Vérifier que l'utilisateur existe
      await this.getUserById(userId);
      
      // Préparer les données à mettre à jour
      const dataToUpdate = {};
      
      if (updateData.firstName !== undefined) dataToUpdate.firstName = updateData.firstName;
      if (updateData.lastName !== undefined) dataToUpdate.lastName = updateData.lastName;
      if (updateData.picture !== undefined) dataToUpdate.picture = updateData.picture;
      if (updateData.active !== undefined) dataToUpdate.active = updateData.active;
      if (updateData.emailVerified !== undefined) dataToUpdate.emailVerified = updateData.emailVerified;
      if (updateData.roles !== undefined) dataToUpdate.roles = updateData.roles;
      
      // Hasher le nouveau mot de passe si fourni
      if (updateData.password) {
        dataToUpdate.password = await bcrypt.hash(updateData.password, SALT_ROUNDS);
      }
      
      // Mettre à jour l'utilisateur
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: dataToUpdate
      });
      
      // Retourner sans le mot de passe
      const { password, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
      
    } catch (error) {
      if (error.code) {
        throw handlePrismaError(error);
      }
      throw error;
    }
  }
  
  /**
   * Supprimer un utilisateur (soft delete)
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} context - Contexte de la requête
   * @returns {Promise<boolean>} Succès de l'opération
   */
  async deleteUser(userId, context = {}) {
    try {
      // Vérifier que l'utilisateur existe
      await this.getUserById(userId);
      
      // Hard delete pour le MVP
      await this.prisma.user.delete({
        where: { id: userId }
      });
      
      return true;
      
    } catch (error) {
      if (error.code) {
        throw handlePrismaError(error);
      }
      throw error;
    }
  }
  
  /**
   * Rechercher des utilisateurs
   * @param {Object} filters - Filtres de recherche
   * @param {Object} pagination - Options de pagination
   * @returns {Promise<Object>} Résultats de recherche
   */
  async searchUsers(filters = {}, pagination = {}) {
    try {
      const { limit = 20, offset = 0 } = pagination;
      const { search, role, active } = filters;
      
      // Construire les conditions de recherche
      const where = {};
      
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } }
        ];
      }
      
      if (role) {
        where.roles = { has: role };
      }
      
      if (active !== undefined) {
        where.active = active;
      }
      
      // Exécuter la recherche avec pagination
      const [users, totalCount] = await Promise.all([
        this.prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            picture: true,
            active: true,
            emailVerified: true,
            roles: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        this.prisma.user.count({ where })
      ]);
      
      return {
        users,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasNext: offset + limit < totalCount,
          hasPrevious: offset > 0
        }
      };
      
    } catch (error) {
      if (error.code) {
        throw handlePrismaError(error);
      }
      throw error;
    }
  }
  
  /**
   * Vérifier un mot de passe
   * @param {string} plainPassword - Mot de passe en clair
   * @param {string} hashedPassword - Mot de passe hashé
   * @returns {Promise<boolean>} Mot de passe valide
   */
  async verifyPassword(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) {
      return false;
    }
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = UserService; 