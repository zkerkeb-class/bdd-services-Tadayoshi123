// bdd-services-Tadayoshi123/src/routes/refreshTokenRoutes.js
// Routes REST pour la gestion des refresh tokens

const express = require('express');
const { authenticateService, requirePermissions } = require('../middlewares/auth');
const { refreshTokenValidations } = require('../middlewares/validation');
const { asyncHandler } = require('../middlewares/errorHandler');
const prisma = require('../db-client'); // Utiliser le client Prisma partagé
const crypto = require('crypto');

const router = express.Router();
// const prisma = new PrismaClient(); // Supprimer l'instanciation locale

/**
 * @swagger
 * components:
 *   schemas:
 *     RefreshToken:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         token:
 *           type: string
 *         userId:
 *           type: string
 *           format: uuid
 *         clientId:
 *           type: string
 *           format: uuid
 *         issuedAt:
 *           type: string
 *           format: date-time
 *         expiresAt:
 *           type: string
 *           format: date-time
 *         revokedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 */

/**
 * @swagger
 * /api/v1/refresh-tokens:
 *   post:
 *     summary: Créer un nouveau refresh token
 *     tags: [RefreshTokens]
 *     security:
 *       - ServiceAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - expiresAt
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               clientId:
 *                 type: string
 *                 format: uuid
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Refresh token créé avec succès
 */
router.post('/', 
  authenticateService,
  requirePermissions(['tokens:create', 'admin']),
  refreshTokenValidations.create,
  asyncHandler(async (req, res) => {
    const { userId, clientId, expiresAt } = req.body;
    
    // Générer un token unique sécurisé
    const token = crypto.randomBytes(64).toString('hex');
    
    const refreshToken = await prisma.refreshToken.create({
      data: {
        token,
        userId,
        clientId: clientId || null,
        issuedAt: new Date(),
        expiresAt: new Date(expiresAt)
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        client: {
          select: {
            id: true,
            name: true,
            clientId: true
          }
        }
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Refresh token créé avec succès',
      data: refreshToken
    });
  })
);

/**
 * @swagger
 * /api/v1/refresh-tokens/by-token/{token}:
 *   get:
 *     summary: Récupérer un refresh token par sa valeur
 *     tags: [RefreshTokens]
 *     security:
 *       - ServiceAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Refresh token trouvé
 *       404:
 *         description: Token non trouvé ou expiré
 */
router.get('/by-token/:token',
  authenticateService,
  requirePermissions(['tokens:read', 'admin']),
  refreshTokenValidations.getByToken,
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            active: true
          }
        },
        client: {
          select: {
            id: true,
            name: true,
            clientId: true,
            active: true
          }
        }
      }
    });
    
    if (!refreshToken) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Refresh token non trouvé',
          code: 'REFRESH_TOKEN_NOT_FOUND'
        }
      });
    }
    
    // Vérifier si le token est expiré
    if (refreshToken.expiresAt < new Date()) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Refresh token expiré',
          code: 'REFRESH_TOKEN_EXPIRED'
        }
      });
    }
    
    // Vérifier si le token est révoqué
    if (refreshToken.revokedAt) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Refresh token révoqué',
          code: 'REFRESH_TOKEN_REVOKED'
        }
      });
    }
    
    res.json({
      success: true,
      data: refreshToken
    });
  })
);

/**
 * @swagger
 * /api/v1/refresh-tokens/user/{userId}:
 *   get:
 *     summary: Récupérer tous les refresh tokens d'un utilisateur
 *     tags: [RefreshTokens]
 *     security:
 *       - ServiceAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: includeRevoked
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Liste des refresh tokens
 */
router.get('/user/:userId',
  authenticateService,
  requirePermissions(['tokens:read', 'admin']),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { includeRevoked } = req.query;
    
    const where = { userId };
    
    // Exclure les tokens révoqués si demandé
    if (includeRevoked !== 'true') {
      where.revokedAt = null;
    }
    
    const refreshTokens = await prisma.refreshToken.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            clientId: true
          }
        }
      },
      orderBy: { issuedAt: 'desc' }
    });
    
    res.json({
      success: true,
      data: refreshTokens
    });
  })
);

/**
 * @swagger
 * /api/v1/refresh-tokens/{id}/revoke:
 *   post:
 *     summary: Révoquer un refresh token
 *     tags: [RefreshTokens]
 *     security:
 *       - ServiceAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Token révoqué avec succès
 */
router.post('/:id/revoke',
  authenticateService,
  requirePermissions(['tokens:update', 'admin']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const refreshToken = await prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });
    
    res.json({
      success: true,
      message: 'Refresh token révoqué avec succès',
      data: refreshToken
    });
  })
);

/**
 * @swagger
 * /api/v1/refresh-tokens/revoke-by-token:
 *   post:
 *     summary: Révoquer un refresh token par sa valeur
 *     tags: [RefreshTokens]
 *     security:
 *       - ServiceAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token révoqué avec succès
 */
router.post('/revoke-by-token',
  authenticateService,
  requirePermissions(['tokens:update', 'admin']),
  refreshTokenValidations.revoke,
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    
    const refreshToken = await prisma.refreshToken.updateMany({
      where: { 
        token,
        revokedAt: null // Seulement les tokens non révoqués
      },
      data: { revokedAt: new Date() }
    });
    
    if (refreshToken.count === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Refresh token non trouvé ou déjà révoqué',
          code: 'REFRESH_TOKEN_NOT_FOUND'
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Refresh token révoqué avec succès'
    });
  })
);

/**
 * @swagger
 * /api/v1/refresh-tokens/user/{userId}/revoke-all:
 *   post:
 *     summary: Révoquer tous les refresh tokens d'un utilisateur
 *     tags: [RefreshTokens]
 *     security:
 *       - ServiceAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Tous les tokens révoqués
 */
router.post('/user/:userId/revoke-all',
  authenticateService,
  requirePermissions(['tokens:update', 'admin']),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    const result = await prisma.refreshToken.updateMany({
      where: { 
        userId,
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
    
    res.json({
      success: true,
      message: `${result.count} refresh token(s) révoqué(s) avec succès`,
      data: {
        revokedCount: result.count
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/refresh-tokens/cleanup-expired:
 *   delete:
 *     summary: Nettoyer les refresh tokens expirés
 *     tags: [RefreshTokens]
 *     security:
 *       - ServiceAuth: []
 *     responses:
 *       200:
 *         description: Tokens expirés supprimés
 */
router.delete('/cleanup-expired',
  authenticateService,
  requirePermissions(['admin']),
  asyncHandler(async (req, res) => {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    
    res.json({
      success: true,
      message: `${result.count} refresh token(s) expiré(s) supprimé(s)`,
      data: {
        deletedCount: result.count
      }
    });
  })
);

module.exports = router; 