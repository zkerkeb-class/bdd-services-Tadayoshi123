// bdd-services-Tadayoshi123/src/routes/clientRoutes.js
// Routes REST pour la gestion des clients OAuth

const express = require('express');
const { authenticateService, requirePermissions } = require('../middlewares/auth');
const { clientValidations } = require('../middlewares/validation');
const { asyncHandler } = require('../middlewares/errorHandler');
const prisma = require('../db-client'); // Utiliser le client Prisma partagé

const router = express.Router();
// const prisma = new PrismaClient(); // Supprimer l'instanciation locale

/**
 * @swagger
 * components:
 *   schemas:
 *     Client:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         clientId:
 *           type: string
 *         redirectUris:
 *           type: array
 *           items:
 *             type: string
 *         allowedScopes:
 *           type: array
 *           items:
 *             type: string
 *         ownerId:
 *           type: string
 *           format: uuid
 *         active:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/clients:
 *   post:
 *     summary: Créer un nouveau client OAuth
 *     tags: [Clients]
 *     security:
 *       - ServiceAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - redirectUris
 *               - allowedScopes
 *               - ownerId
 *             properties:
 *               name:
 *                 type: string
 *               redirectUris:
 *                 type: array
 *                 items:
 *                   type: string
 *               allowedScopes:
 *                 type: array
 *                 items:
 *                   type: string
 *               ownerId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Client créé avec succès
 */
router.post('/', 
  authenticateService,
  requirePermissions(['clients:create', 'admin']),
  clientValidations.create,
  asyncHandler(async (req, res) => {
    const { name, redirectUris, allowedScopes, ownerId } = req.body;
    
    // Générer un clientId unique
    const clientId = `supervia_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Générer un client secret
    const clientSecret = require('crypto').randomBytes(32).toString('hex');
    
    const client = await prisma.client.create({
      data: {
        name,
        clientId,
        clientSecret,
        redirectUris,
        allowedScopes,
        ownerId,
        active: true
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Client OAuth créé avec succès',
      data: client
    });
  })
);

/**
 * @swagger
 * /api/v1/clients/{id}:
 *   get:
 *     summary: Récupérer un client par ID
 *     tags: [Clients]
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
 *         description: Client trouvé
 */
router.get('/:id',
  authenticateService,
  requirePermissions(['clients:read', 'admin']),
  clientValidations.getById,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        refreshTokens: {
          select: {
            id: true,
            issuedAt: true,
            expiresAt: true,
            revokedAt: true
          }
        }
      }
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Client non trouvé',
          code: 'CLIENT_NOT_FOUND'
        }
      });
    }
    
    res.json({
      success: true,
      data: client
    });
  })
);

/**
 * @swagger
 * /api/v1/clients/by-client-id/{clientId}:
 *   get:
 *     summary: Récupérer un client par clientId
 *     tags: [Clients]
 *     security:
 *       - ServiceAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client trouvé
 */
router.get('/by-client-id/:clientId',
  authenticateService,
  requirePermissions(['clients:read', 'admin']),
  asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    
    const client = await prisma.client.findUnique({
      where: { clientId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Client non trouvé',
          code: 'CLIENT_NOT_FOUND'
        }
      });
    }
    
    res.json({
      success: true,
      data: client
    });
  })
);

/**
 * @swagger
 * /api/v1/clients/{id}:
 *   put:
 *     summary: Mettre à jour un client
 *     tags: [Clients]
 *     security:
 *       - ServiceAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               redirectUris:
 *                 type: array
 *                 items:
 *                   type: string
 *               allowedScopes:
 *                 type: array
 *                 items:
 *                   type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Client mis à jour
 */
router.put('/:id',
  authenticateService,
  requirePermissions(['clients:update', 'admin']),
  clientValidations.update,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, redirectUris, allowedScopes, active } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (redirectUris !== undefined) updateData.redirectUris = redirectUris;
    if (allowedScopes !== undefined) updateData.allowedScopes = allowedScopes;
    if (active !== undefined) updateData.active = active;
    
    const client = await prisma.client.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    res.json({
      success: true,
      message: 'Client mis à jour avec succès',
      data: client
    });
  })
);

/**
 * @swagger
 * /api/v1/clients/{id}:
 *   delete:
 *     summary: Supprimer un client
 *     tags: [Clients]
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
 *         description: Client supprimé
 */
router.delete('/:id',
  authenticateService,
  requirePermissions(['clients:delete', 'admin']),
  clientValidations.getById,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    await prisma.client.delete({
      where: { id }
    });
    
    res.json({
      success: true,
      message: 'Client supprimé avec succès'
    });
  })
);

module.exports = router; 