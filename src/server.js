// bdd-services-Tadayoshi123/src/server.js
// Serveur principal du microservice db-service SupervIA

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const promBundle = require('express-prom-bundle');

const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { authenticateService } = require('./middlewares/auth');

// Import des classes et des factory de routes
const UserController = require('./controllers/userController');
const UserService = require('./services/userService');
const userRoutesFactory = require('./routes/userRoutes');
const KeyController = require('./controllers/keyController');
const KeyService = require('./services/keyService');
const keyRoutesFactory = require('./routes/keyRoutes');
const prisma = require('./db-client'); // Importer le client Prisma partagé

// Routes (celles qui n'ont pas de dépendances)
const clientRoutes = require('./routes/clientRoutes');
const refreshTokenRoutes = require('./routes/refreshTokenRoutes');

const app = express();
const PORT = process.env.PORT || 3002;

// ==============================================
// 📦 INJECTION DE DÉPENDANCES
// ==============================================

// Créer une instance simple de logger
const logger = console; // Pourrait être remplacé par un logger plus avancé (pino, winston)

// Instancier les services et contrôleurs
const userService = new UserService(prisma, logger);
const userController = new UserController(userService);
const keyService = new KeyService(prisma, logger);
const keyController = new KeyController(keyService);

// ==============================================
// 🛡️ MIDDLEWARES DE SÉCURITÉ
// ==============================================

// Helmet pour la sécurité des headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Rate limiting
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    message: {
      success: false,
      error: {
        message: 'Trop de requêtes, veuillez réessayer plus tard',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
}

// Middlewares Express
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Prometheus metrics middleware
app.use(promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  promClient: {
    collectDefaultMetrics: {}
  },
}));

// ==============================================
// 📖 SWAGGER DOCUMENTATION
// ==============================================

if (process.env.ENABLE_SWAGGER === 'true') {
  try {
    const swaggerDocument = require('./swagger.json');
    swaggerDocument.info.version = process.env.npm_package_version || '1.0.0';
    swaggerDocument.servers[0].url = process.env.API_URL || `http://localhost:${PORT}`;

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'SupervIA DB Service API'
    }));
  } catch (err) {
    console.error("Erreur lors du chargement de swagger.json. Avez-vous exécuté 'npm run swagger:gen' ?", err);
  }
}

// ==============================================
// 🎯 ROUTES API
// ==============================================

// Health check (sans authentification)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SupervIA DB Service is healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Info sur l'API (sans authentification)
app.get('/', (req, res) => {
  res.json({
    name: 'SupervIA DB Service',
    description: 'Microservice de gestion centralisée de la base de données PostgreSQL',
    version: process.env.npm_package_version || '1.0.0',
    endpoints: {
      health: '/health',
      docs: '/api-docs',
      api: '/api/v1'
    },
    features: [
      'API REST sécurisée',
      'Authentification JWT inter-services',
      'Logs d\'audit automatiques',
      'Validation robuste des données',
      'Documentation Swagger complète'
    ]
  });
});

// Routes API protégées - Utilisation du factory pour les routes utilisateur
app.use('/api/v1/users', userRoutesFactory(userController));
app.use('/api/v1/keys', keyRoutesFactory(keyController));
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/refresh-tokens', refreshTokenRoutes);

// TODO: Ajouter les autres routes quand elles seront créées
// app.use('/api/v1/audit-logs', auditLogRoutes);
// app.use('/api/v1/dashboards', dashboardRoutes);
// app.use('/api/v1/consents', consentRoutes);

// ==============================================
// 🚨 GESTION DES ERREURS
// ==============================================

// Handler pour les routes non trouvées (404)
app.use(notFoundHandler);

// Handler d'erreurs global (doit être le dernier middleware)
app.use(errorHandler);

// ==============================================
// 🚀 DÉMARRAGE DU SERVEUR
// ==============================================

const server = app.listen(PORT, () => {
  console.log(`
🗄️  SupervIA DB Service started successfully!
🌐 Server running on: http://localhost:${PORT}
📖 API Documentation: http://localhost:${PORT}/api-docs
🏥 Health Check: http://localhost:${PORT}/health
📊 Metrics: ${process.env.METRICS_ENABLED === 'true' ? `http://localhost:${PORT}/metrics` : 'disabled'}
🔒 Environment: ${process.env.NODE_ENV || 'development'}
  `);
});

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

module.exports = app; 