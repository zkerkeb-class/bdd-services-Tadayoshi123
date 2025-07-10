// bdd-services-Tadayoshi123/src/middlewares/validation.js
// Middlewares de validation pour le db-service

const { body, param, query, validationResult } = require('express-validator');
const { AppError, DbErrorCodes } = require('./errorHandler');

/**
 * Middleware pour traiter les erreurs de validation
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    const error = new AppError(
      'Erreurs de validation',
      400,
      DbErrorCodes.VALIDATION_ERROR,
      validationErrors
    );
    
    return next(error);
  }
  
  next();
};

/**
 * Validations communes
 */
const commonValidations = {
  uuid: (field = 'id') => param(field).isUUID().withMessage(`${field} doit être un UUID valide`),
  
  email: (field = 'email') => body(field)
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  
  password: (field = 'password') => body(field)
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'),
  
  optionalString: (field, maxLength = 255) => body(field)
    .optional()
    .isString()
    .isLength({ max: maxLength })
    .withMessage(`${field} doit être une chaîne de caractères (max ${maxLength} caractères)`),
  
  requiredString: (field, maxLength = 255) => body(field)
    .notEmpty()
    .isString()
    .isLength({ max: maxLength })
    .withMessage(`${field} est requis et doit être une chaîne (max ${maxLength} caractères)`),
  
  boolean: (field) => body(field)
    .optional()
    .isBoolean()
    .withMessage(`${field} doit être un booléen`),
  
  json: (field) => body(field)
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        try {
          JSON.parse(value);
        } catch (e) {
          throw new Error('JSON invalide');
        }
      }
      return true;
    }),
  
  array: (field) => body(field)
    .optional()
    .isArray()
    .withMessage(`${field} doit être un tableau`),
  
  enumValue: (field, values) => body(field)
    .optional()
    .isIn(values)
    .withMessage(`${field} doit être l'une de ces valeurs: ${values.join(', ')}`)
};

/**
 * Validations pour les utilisateurs
 */
const userValidations = {
  create: [
    commonValidations.email(),
    commonValidations.password(),
    commonValidations.optionalString('firstName', 100),
    commonValidations.optionalString('lastName', 100),
    commonValidations.optionalString('picture', 500),
    body('roles')
      .optional()
      .isArray()
      .withMessage('roles doit être un tableau')
      .custom((roles) => {
        const validRoles = ['USER', 'ADMIN', 'MODERATOR'];
        const invalidRoles = roles.filter(role => !validRoles.includes(role));
        if (invalidRoles.length > 0) {
          throw new Error(`Rôles invalides: ${invalidRoles.join(', ')}`);
        }
        return true;
      }),
    handleValidationErrors
  ],
  
  update: [
    commonValidations.uuid('id'),
    commonValidations.optionalString('firstName', 100),
    commonValidations.optionalString('lastName', 100),
    commonValidations.optionalString('picture', 500),
    commonValidations.boolean('active'),
    commonValidations.boolean('emailVerified'),
    body('roles')
      .optional()
      .isArray()
      .withMessage('roles doit être un tableau'),
    handleValidationErrors
  ],
  
  getById: [
    commonValidations.uuid('id'),
    handleValidationErrors
  ],
  
  search: [
    query('search')
      .optional()
      .isString()
      .isLength({ min: 2, max: 100 })
      .withMessage('search doit contenir entre 2 et 100 caractères'),
    query('role')
      .optional()
      .isIn(['USER', 'ADMIN', 'MODERATOR'])
      .withMessage('role invalide'),
    query('active')
      .optional()
      .isBoolean()
      .withMessage('active doit être un booléen'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('limit doit être entre 1 et 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('offset doit être >= 0'),
    handleValidationErrors
  ]
};

/**
 * Validations pour les clients OAuth
 */
const clientValidations = {
  create: [
    commonValidations.requiredString('name', 200),
    body('redirectUris')
      .isArray({ min: 1 })
      .withMessage('redirectUris doit être un tableau non vide')
      .custom((urls) => {
        for (const url of urls) {
          try {
            new URL(url);
          } catch (e) {
            throw new Error(`URL invalide: ${url}`);
          }
        }
        return true;
      }),
    body('allowedScopes')
      .isArray({ min: 1 })
      .withMessage('allowedScopes doit être un tableau non vide'),
    handleValidationErrors
  ],
  
  update: [
    commonValidations.uuid('id'),
    commonValidations.optionalString('name', 200),
    commonValidations.boolean('active'),
    body('redirectUris')
      .optional()
      .isArray()
      .withMessage('redirectUris doit être un tableau'),
    body('allowedScopes')
      .optional()
      .isArray()
      .withMessage('allowedScopes doit être un tableau'),
    handleValidationErrors
  ],
  
  getById: [
    commonValidations.uuid('id'),
    handleValidationErrors
  ]
};

/**
 * Validations pour les refresh tokens
 */
const refreshTokenValidations = {
  create: [
    body('userId').isUUID().withMessage('User ID must be a valid UUID'),
    body('clientId').optional({ nullable: true }).isUUID().withMessage('Client ID must be a valid UUID if provided'),
    body('expiresAt').isISO8601().withMessage('Expiration date must be a valid ISO 8601 date'),
    handleValidationErrors
  ],
  
  revoke: [
    commonValidations.requiredString('token', 500),
    handleValidationErrors
  ],
  
  getByToken: [
    param('token').notEmpty().withMessage('Le token est requis'),
    handleValidationErrors
  ]
};

/**
 * Validations pour les consentements RGPD
 */
const consentValidations = {
  create: [
    commonValidations.uuid('userId'),
    commonValidations.requiredString('purpose', 100),
    commonValidations.boolean('granted'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('expiresAt doit être une date ISO8601 valide'),
    commonValidations.optionalString('version', 20),
    commonValidations.json('metadata'),
    handleValidationErrors
  ],
  
  update: [
    commonValidations.uuid('id'),
    commonValidations.boolean('granted'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('expiresAt doit être une date ISO8601 valide'),
    commonValidations.json('metadata'),
    handleValidationErrors
  ],
  
  getByUserId: [
    commonValidations.uuid('userId'),
    handleValidationErrors
  ]
};

/**
 * Validations pour les logs d'audit
 */
const auditLogValidations = {
  create: [
    commonValidations.optionalString('userId'),
    commonValidations.requiredString('action', 50),
    commonValidations.requiredString('resource', 100),
    commonValidations.optionalString('resourceId'),
    commonValidations.json('details'),
    commonValidations.optionalString('ipAddress', 45),
    commonValidations.optionalString('userAgent', 500),
    handleValidationErrors
  ],
  
  search: [
    query('userId')
      .optional()
      .isUUID()
      .withMessage('userId doit être un UUID valide'),
    query('action')
      .optional()
      .isString()
      .withMessage('action doit être une chaîne'),
    query('resource')
      .optional()
      .isString()
      .withMessage('resource doit être une chaîne'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('startDate doit être une date ISO8601 valide'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('endDate doit être une date ISO8601 valide'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('limit doit être entre 1 et 1000'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('offset doit être >= 0'),
    handleValidationErrors
  ]
};

module.exports = {
  commonValidations,
  userValidations,
  clientValidations,
  refreshTokenValidations,
  consentValidations,
  auditLogValidations,
  handleValidationErrors
}; 