// bdd-services-Tadayoshi123/src/middlewares/errorHandler.js
// Gestion centralisée des erreurs pour le db-service

/**
 * Classe d'erreur personnalisée pour l'application
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Codes d'erreur standardisés pour le db-service
 */
const DbErrorCodes = {
  // Erreurs génériques
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  
  // Erreurs d'authentification
  MISSING_TOKEN: 'MISSING_TOKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  UNAUTHORIZED_SERVICE: 'UNAUTHORIZED_SERVICE',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Erreurs de base de données
  DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR',
  DB_QUERY_ERROR: 'DB_QUERY_ERROR',
  DB_CONSTRAINT_ERROR: 'DB_CONSTRAINT_ERROR',
  
  // Erreurs de ressources
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  REFRESH_TOKEN_NOT_FOUND: 'REFRESH_TOKEN_NOT_FOUND',
  
  // Erreurs de validation
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_UUID: 'INVALID_UUID',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Erreurs métier
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  
  // Erreurs de gestion des clés
  KEY_CREATION_FAILED: 'KEY_CREATION_FAILED',
  KEY_FETCH_FAILED: 'KEY_FETCH_FAILED',
};

/**
 * Middleware de gestion des erreurs
 */
const errorHandler = (err, req, res, next) => {
  console.log("ErrorHandler a reçu:", err); // Log brut de l'erreur
  let error = err; // Travailler directement avec l'objet d'erreur

  // Log de l'erreur
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    service: req.service?.id || 'unknown',
    timestamp: new Date().toISOString()
  });

  // Erreurs Prisma
  if (err.code === 'P2002') {
    // Contrainte unique violée
    const field = err.meta?.target?.[0] || 'champ';
    error = new AppError(
      `Cette valeur de ${field} existe déjà`,
      409,
      DbErrorCodes.DUPLICATE_ENTRY,
      { field, constraint: err.meta?.target }
    );
  }
  
  if (err.code === 'P2025') {
    // Enregistrement non trouvé
    error = new AppError(
      'Ressource non trouvée',
      404,
      DbErrorCodes.NOT_FOUND,
      { operation: err.meta?.cause }
    );
  }
  
  if (err.code === 'P2003') {
    // Contrainte de clé étrangère violée
    error = new AppError(
      'Référence invalide vers une ressource liée',
      400,
      DbErrorCodes.DB_CONSTRAINT_ERROR,
      { field: err.meta?.field_name }
    );
  }
  
  if (err.code === 'P1001') {
    // Impossible de se connecter à la base de données
    error = new AppError(
      'Erreur de connexion à la base de données',
      503,
      DbErrorCodes.DB_CONNECTION_ERROR
    );
  }

  if (err.code === 'P2021') {
    // Table inexistante
    error = new AppError(
      `La table requise n'existe pas dans la base de données.`,
      500,
      DbErrorCodes.DB_QUERY_ERROR,
      { table: err.meta?.table }
    );
  }

  // Erreurs de validation Express Validator
  if (err.type === 'validation') {
    error = new AppError(
      'Erreurs de validation',
      400,
      DbErrorCodes.VALIDATION_ERROR,
      err.errors
    );
  }

  // Erreurs JWT
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Token JWT invalide', 401, DbErrorCodes.INVALID_TOKEN);
  }
  
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token JWT expiré', 401, DbErrorCodes.EXPIRED_TOKEN);
  }

  // Erreurs de syntaxe JSON
  if (err.type === 'entity.parse.failed') {
    error = new AppError(
      'JSON invalide dans le corps de la requête',
      400,
      DbErrorCodes.VALIDATION_ERROR
    );
  }

  // Si ce n'est pas une erreur opérationnelle, la convertir
  if (!error.isOperational) {
    error = new AppError(
      process.env.NODE_ENV === 'production' 
        ? 'Une erreur interne s\'est produite' 
        : error.message,
      500,
      DbErrorCodes.INTERNAL_ERROR
    );
  }

  // Préparer la réponse d'erreur
  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.errorCode || DbErrorCodes.INTERNAL_ERROR,
      statusCode: error.statusCode || 500
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Ajouter les détails en mode développement
  if (process.env.NODE_ENV === 'development') {
    response.error.details = error.details;
    response.error.stack = error.stack;
  }

  // Ajouter l'ID de la requête si disponible
  if (req.requestId) {
    response.requestId = req.requestId;
  }

  res.status(error.statusCode || 500).json(response);
};

/**
 * Middleware pour gérer les routes non trouvées
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route non trouvée: ${req.method} ${req.path}`,
    404,
    DbErrorCodes.NOT_FOUND
  );
  
  next(error);
};

/**
 * Gestionnaire d'erreur asynchrone
 * Wrapper pour éviter les try/catch dans les controllers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation des erreurs Prisma pour des réponses plus claires
 */
const handlePrismaError = (error) => {
  switch (error.code) {
    case 'P2002':
      return new AppError(
        `Contrainte unique violée: ${error.meta?.target?.join(', ')}`,
        409,
        DbErrorCodes.DUPLICATE_ENTRY
      );
    
    case 'P2025':
      return new AppError(
        'Ressource non trouvée',
        404,
        DbErrorCodes.NOT_FOUND
      );
    
    case 'P2003':
      return new AppError(
        'Contrainte de clé étrangère violée',
        400,
        DbErrorCodes.DB_CONSTRAINT_ERROR
      );
    
    case 'P1001':
      return new AppError(
        'Impossible de se connecter à la base de données',
        503,
        DbErrorCodes.DB_CONNECTION_ERROR
      );
    
    default:
      return new AppError(
        'Erreur de base de données',
        500,
        DbErrorCodes.DB_QUERY_ERROR
      );
  }
};

module.exports = {
  AppError,
  DbErrorCodes,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handlePrismaError
}; 