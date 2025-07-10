const { PrismaClient } = require('@prisma/client');

// Créer une instance unique du client Prisma pour toute l'application
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

module.exports = prisma; 