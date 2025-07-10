const { AppError, DbErrorCodes } = require('../middlewares/errorHandler');
const { importSPKI, exportJWK } = require('jose');

class KeyService {
  constructor(prisma, logger) {
    this.prisma = prisma;
    this.logger = logger || console;
  }

  /**
   * Crée une nouvelle paire de clés et la stocke.
   * Désactive les autres clés en même temps.
   * @param {Object} keyData - { publicKey, privateKey, algorithm }
   * @returns {Promise<Object>} La nouvelle clé créée.
   */
  async createKeyPair(keyData) {
    this.logger.info('Creating a new key pair and deactivating old ones.');
    try {
      // Transaction pour assurer l'atomicité
      const newKey = await this.prisma.$transaction(async (tx) => {
        // 1. Mettre à jour toutes les clés existantes au statut 'deprecated'
        await tx.key.updateMany({
          where: { status: 'active' },
          data: { status: 'deprecated' },
        });

        // 2. Créer la nouvelle clé
        const key = await tx.key.create({
          data: {
            publicKey: keyData.publicKey,
            privateKey: keyData.privateKey,
            algorithm: keyData.algorithm || 'RS256',
            status: 'active',
          },
        });
        return key;
      });
      this.logger.info(`New key pair created with kid: ${newKey.kid}`);
      return newKey;
    } catch (error) {
      this.logger.error('Error creating key pair:', error);
      throw new AppError('Could not create key pair', 500, DbErrorCodes.KEY_CREATION_FAILED);
    }
  }

  /**
   * Récupère la paire de clés active.
   * @returns {Promise<Object|null>} La clé active ou null.
   */
  async getActiveKeyPair() {
    this.logger.info('Fetching active key pair.');
    const key = await this.prisma.key.findFirst({
      where: { status: 'active' },
    });
    if (!key) {
      this.logger.warn('No active key pair found in the database.');
    }
    return key;
  }

  /**
   * Récupère toutes les clés publiques actives et les convertit au format JWKS.
   * @returns {Promise<Object>} Un objet JWKS complet.
   */
  async getActivePublicKeys() {
    this.logger.info('Fetching and converting active public keys to JWKS.');
    try {
      const activeKeys = await this.prisma.key.findMany({
        where: { status: 'active' },
        select: {
          kid: true,
          publicKey: true, // Clé au format PEM
          algorithm: true,
        },
      });

      if (activeKeys.length === 0) {
        this.logger.warn('No active keys found to generate JWKS.');
        return { keys: [] };
      }

      const jwkPromises = activeKeys.map(async (key) => {
        const publicKey = await importSPKI(key.publicKey, key.algorithm);
        const jwk = await exportJWK(publicKey);
        return {
          ...jwk,
          kid: key.kid,
          alg: key.algorithm,
          use: 'sig',
        };
      });

      const jwks = await Promise.all(jwkPromises);
      this.logger.info(`Successfully generated JWKS with ${jwks.length} key(s).`);
      return { keys: jwks };

    } catch (error) {
      this.logger.error('Error during JWKS generation:', error);
      throw new AppError('Could not generate JWKS', 500, DbErrorCodes.KEY_FETCH_FAILED);
    }
  }

    /**
   * Récupère une clé par son Key ID (kid).
   * @param {string} kid - Le Key ID.
   * @returns {Promise<Object|null>} La clé correspondante.
   */
    async getKeyByKid(kid) {
        this.logger.info(`Fetching key by kid: ${kid}`);
        try {
          const key = await this.prisma.key.findUnique({
            where: { kid },
          });
          return key;
        } catch (error) {
          this.logger.error(`Error fetching key with kid ${kid}:`, error);
          throw new AppError('Could not fetch key', 500, DbErrorCodes.KEY_FETCH_FAILED);
        }
      }
}

module.exports = KeyService; 