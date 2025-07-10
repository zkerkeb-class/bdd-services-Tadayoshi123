// bdd-services-Tadayoshi123/scripts/generate-swagger.js
// Script pour générer le fichier swagger.json

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

// Options de configuration pour swagger-jsdoc
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SupervIA DB Service API',
      version: process.env.npm_package_version || '1.0.0',
      description: "API REST centralisée pour la gestion de la base de données PostgreSQL de l'écosystème SupervIA.",
      contact: {
        name: 'SupervIA Team',
        email: 'contact@supervia.com'
      }
    },
    servers: [
      {
        url: process.env.API_URL || `http://localhost:${process.env.PORT || 3002}`,
        description: 'Serveur de développement'
      }
    ],
    components: {
      securitySchemes: {
        ServiceAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: "Authentification JWT inter-services. Le token est généré par un autre service (ex: auth-service) et contient les permissions nécessaires."
        }
      }
    },
    security: [
      {
        ServiceAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js'], // Chemin vers les fichiers contenant les annotations
};

const specs = swaggerJsdoc(swaggerOptions);
const outputPath = path.join(__dirname, '../src/swagger.json');

fs.writeFileSync(outputPath, JSON.stringify(specs, null, 2));

console.log(`✅ Documentation Swagger générée avec succès : ${outputPath}`); 