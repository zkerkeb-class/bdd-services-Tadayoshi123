const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Tentative de suppression de toutes les clés de signature...');
  try {
    const { count } = await prisma.key.deleteMany({});
    console.log(`✅ ${count} clé(s) de signature ont été supprimée(s).`);
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des clés :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 