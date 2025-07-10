// bdd-services-Tadayoshi123/src/middlewares/auth.js
// Middleware d'authentification pour le db-service

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

/**
 * Middleware d'authentification JWT pour les services
 * Vérifie que la requête provient d'un service autorisé
 */
const authenticateService = async (req, res, next) => {
  try {
    // Récupérer le token JWT depuis le header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token d\'authentification manquant', 401, 'MISSING_TOKEN');
    }
    
    const token = authHeader.substring(7); // Enlever "Bearer "
    
    // Vérifier le token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Vérifier que le service est autorisé
    const allowedServices = process.env.ALLOWED_SERVICES?.split(',') || [];
    const serviceId = decoded.serviceId || decoded.iss; // issuer du token
    
    if (!allowedServices.includes(serviceId)) {
      throw new AppError('Service non autorisé', 403, 'UNAUTHORIZED_SERVICE');
    }
    
    // Ajouter les informations du service à la requête
    req.service = {
      id: serviceId,
      name: decoded.serviceName || serviceId,
      permissions: decoded.permissions || [],
      userId: decoded.userId // ID de l'utilisateur si disponible
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Token JWT invalide', 401, 'INVALID_TOKEN'));
    }
    
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token JWT expiré', 401, 'EXPIRED_TOKEN'));
    }
    
    next(error);
  }
};

/**
 * Middleware optionnel - authentification sans échec
 * Utile pour les endpoints publics qui peuvent bénéficier des infos du service
 */
const authenticateOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Pas de token, on continue sans authentification
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Ajouter les informations si disponibles
    req.service = {
      id: decoded.serviceId || decoded.iss,
      name: decoded.serviceName || decoded.serviceId,
      permissions: decoded.permissions || [],
      userId: decoded.userId
    };
  } catch (error) {
    // Ignorer les erreurs d'authentification en mode optionnel
    console.warn('Authentification optionnelle échouée:', error.message);
  }
  
  next();
};

/**
 * Middleware de vérification des permissions
 * @param {string|Array} requiredPermissions - Permission(s) requise(s)
 */
const requirePermissions = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.service) {
      return next(new AppError('Authentification requise', 401, 'AUTHENTICATION_REQUIRED'));
    }
    
    const permissions = Array.isArray(requiredPermissions) 
      ? requiredPermissions 
      : [requiredPermissions];
    
    const hasPermission = permissions.some(permission => 
      req.service.permissions.includes(permission) || 
      req.service.permissions.includes('*') // Permission wildcard
    );
    
    if (!hasPermission) {
      return next(new AppError(
        `Permissions insuffisantes. Requis: ${permissions.join(', ')}`, 
        403, 
        'INSUFFICIENT_PERMISSIONS'
      ));
    }
    
    next();
  };
};

/**
 * Middleware de vérification d'appartenance des ressources
 * Vérifie que l'utilisateur peut accéder à ses propres ressources
 */
const requireOwnership = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.service || !req.service.userId) {
      return next(new AppError('ID utilisateur requis', 401, 'USER_ID_REQUIRED'));
    }
    
    // Vérifier dans les paramètres de route
    const requestedUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (requestedUserId && requestedUserId !== req.service.userId) {
      // Sauf si le service a des permissions d'admin
      if (!req.service.permissions.includes('admin') && !req.service.permissions.includes('*')) {
        return next(new AppError('Accès refusé à cette ressource', 403, 'ACCESS_DENIED'));
      }
    }
    
    next();
  };
};

/**
 * Génère un token JWT pour un service (utile pour les tests)
 * @param {Object} serviceInfo - Informations du service
 */
const generateServiceToken = (serviceInfo) => {
  const payload = {
    serviceId: serviceInfo.id,
    serviceName: serviceInfo.name,
    permissions: serviceInfo.permissions || [],
    userId: serviceInfo.userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24h
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET);
};

module.exports = {
  authenticateService,
  authenticateOptional,
  requirePermissions,
  requireOwnership,
  generateServiceToken
}; 