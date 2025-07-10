const express = require('express');
const { authenticateService, requirePermissions } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');

module.exports = function(keyController) {
  const router = express.Router();

  /**
   * @swagger
   * tags:
   *   name: Keys
   *   description: Gestion des clés de signature JWT (JWKS)
   */

  /**
   * @swagger
   * /api/v1/keys/jwks:
   *   get:
   *     summary: Récupérer le JWKS (JSON Web Key Set)
   *     tags: [Keys]
   *     description: Cet endpoint public fournit les clés publiques pour la vérification des JWT.
   *     responses:
   *       200:
   *         description: JWKS récupéré avec succès.
   *       500:
   *         description: Erreur lors de la génération du JWKS.
   */
  router.get('/jwks', asyncHandler(keyController.getActivePublicKeys));

  /**
   * @swagger
   * /api/v1/keys/rotate:
   *   post:
   *     summary: Forcer la rotation des clés de signature
   *     tags: [Keys]
   *     security:
   *       - ServiceAuth: []
   *     description: Invalide la clé active actuelle et en génère une nouvelle.
   *     responses:
   *       201:
   *         description: Rotation des clés effectuée avec succès.
   *       400:
   *         description: Clés publique ou privée manquantes.
   *       403:
   *         description: Permissions insuffisantes.
   */
  router.post(
    '/rotate',
    authenticateService,
    requirePermissions(['keys:rotate', 'admin']),
    asyncHandler(keyController.rotateKeys)
  );

  /**
   * @swagger
   * /api/v1/keys:
   *   post:
   *     summary: Créer une nouvelle paire de clés
   *     tags: [Keys]
   *     security:
   *       - ServiceAuth: []
   *     description: Crée une nouvelle paire de clés et la définit comme active. L'ancienne clé active est marquée comme "deprecated". Ceci est typiquement appelé par le service d'authentification.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - publicKey
   *               - privateKey
   *             properties:
   *               publicKey:
   *                 type: string
   *                 description: La clé publique au format PEM.
   *               privateKey:
   *                 type: string
   *                 description: La clé privée au format PEM.
   *               algorithm:
   *                 type: string
   *                 default: "RS256"
   *     responses:
   *       201:
   *         description: Paire de clés créée avec succès.
   */
  router.post(
    '/',
    authenticateService,
    requirePermissions(['keys:create', 'admin']),
    keyController.createKeyPair
  );

  /**
   * @swagger
   * /api/v1/keys/active:
   *   get:
   *     summary: Récupérer la paire de clés active
   *     tags: [Keys]
   *     security:
   *       - ServiceAuth: []
   *     description: Récupère la paire de clés actuellement active (publique et privée). Uniquement accessible par les services internes de confiance comme le service d'authentification.
   *     responses:
   *       200:
   *         description: Paire de clés active récupérée.
   *       404:
   *         description: Aucune clé active n'a été trouvée.
   */
  router.get(
    '/active',
    authenticateService,
    requirePermissions(['keys:read', 'admin']),
    keyController.getActiveKeyPair
  );

  return router;
}; 