// bdd-services-Tadayoshi123/src/routes/userRoutes.js
// Routes REST pour la gestion des utilisateurs

const express = require('express');
const { authenticateService, requirePermissions } = require('../middlewares/auth');
const { userValidations } = require('../middlewares/validation');

module.exports = function(userController) {
  const router = express.Router();

  /**
   * @swagger
   * components:
   *   schemas:
   *     User:
   *       type: object
   *       properties:
   *         id:
   *           type: string
   *           format: uuid
   *           description: ID unique de l'utilisateur
   *         email:
   *           type: string
   *           format: email
   *           description: Adresse email de l'utilisateur
   *         firstName:
   *           type: string
   *           description: Prénom de l'utilisateur
   *         lastName:
   *           type: string
   *           description: Nom de famille de l'utilisateur
   *         picture:
   *           type: string
   *           format: uri
   *           description: URL de la photo de profil
   *         active:
   *           type: boolean
   *           description: Statut actif/inactif de l'utilisateur
   *         emailVerified:
   *           type: boolean
   *           description: Email vérifié ou non
   *         roles:
   *           type: array
   *           items:
   *             type: string
   *             enum: [USER, ADMIN, MODERATOR]
   *           description: Rôles de l'utilisateur
   *         createdAt:
   *           type: string
   *           format: date-time
   *           description: Date de création
   *         updatedAt:
   *           type: string
   *           format: date-time
   *           description: Date de dernière mise à jour
   *     CreateUserRequest:
   *       type: object
   *       required:
   *         - email
   *         - password
   *       properties:
   *         email:
   *           type: string
   *           format: email
   *         password:
   *           type: string
   *           minLength: 8
   *         firstName:
   *           type: string
   *         lastName:
   *           type: string
   *         picture:
   *           type: string
   *         roles:
   *           type: array
   *           items:
   *             type: string
   *             enum: [USER, ADMIN, MODERATOR]
   *     UpdateUserRequest:
   *       type: object
   *       properties:
   *         firstName:
   *           type: string
   *         lastName:
   *           type: string
   *         picture:
   *           type: string
   *         active:
   *           type: boolean
   *         emailVerified:
   *           type: boolean
   *         roles:
   *           type: array
   *           items:
   *             type: string
   *             enum: [USER, ADMIN, MODERATOR]
   */

  /**
   * @swagger
   * tags:
   *   name: Users
   *   description: Gestion des utilisateurs
   */

  /**
   * @swagger
   * /api/v1/users:
   *   post:
   *     summary: Créer un nouvel utilisateur
   *     tags: [Users]
   *     security:
   *       - ServiceAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateUserRequest'
   *     responses:
   *       201:
   *         description: Utilisateur créé avec succès
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       400:
   *         description: Erreur de validation
   *       409:
   *         description: Email déjà utilisé
   */
  router.post('/', 
    authenticateService,
    requirePermissions(['users:create', 'admin']),
    userValidations.create,
    userController.createUser
  );

  /**
   * @swagger
   * /api/v1/users:
   *   get:
   *     summary: Rechercher des utilisateurs
   *     tags: [Users]
   *     security:
   *       - ServiceAuth: []
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Recherche par email, prénom ou nom
   *       - in: query
   *         name: role
   *         schema:
   *           type: string
   *           enum: [USER, ADMIN, MODERATOR]
   *         description: Filtrer par rôle
   *       - in: query
   *         name: active
   *         schema:
   *           type: boolean
   *         description: Filtrer par statut actif
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Nombre maximum de résultats
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Décalage pour la pagination
   *     responses:
   *       200:
   *         description: Liste des utilisateurs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/User'
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     offset:
   *                       type: integer
   *                     hasNext:
   *                       type: boolean
   *                     hasPrevious:
   *                       type: boolean
   */
  router.get('/',
    authenticateService,
    requirePermissions(['users:read', 'admin']),
    userValidations.search,
    userController.searchUsers
  );

  /**
   * @swagger
   * /api/v1/users/email/{email}:
   *   get:
   *     summary: Récupérer un utilisateur par email
   *     tags: [Users]
   *     security:
   *       - ServiceAuth: []
   *     parameters:
   *       - in: path
   *         name: email
   *         required: true
   *         schema:
   *           type: string
   *           format: email
   *         description: Email de l'utilisateur
   *       - in: query
   *         name: includePassword
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Inclure le mot de passe haché
   *     responses:
   *       200:
   *         description: Utilisateur trouvé
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       404:
   *         description: Utilisateur non trouvé
   */
  router.get('/email/:email',
    authenticateService,
    requirePermissions(['users:read', 'admin']),
    userController.getUserByEmail
  );

  /**
   * @swagger
   * /api/v1/users/{id}:
   *   get:
   *     summary: Récupérer un utilisateur par ID
   *     tags: [Users]
   *     security:
   *       - ServiceAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID de l'utilisateur
   *       - in: query
   *         name: includePassword
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Inclure le mot de passe haché
   *       - in: query
   *         name: includeRefreshTokens
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Inclure les refresh tokens
   *     responses:
   *       200:
   *         description: Utilisateur trouvé
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       404:
   *         description: Utilisateur non trouvé
   */
  router.get('/:id',
    authenticateService,
    requirePermissions(['users:read', 'admin']),
    userValidations.getById,
    userController.getUserById
  );

  /**
   * @swagger
   * /api/v1/users/{id}:
   *   put:
   *     summary: Mettre à jour un utilisateur
   *     tags: [Users]
   *     security:
   *       - ServiceAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID de l'utilisateur
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateUserRequest'
   *     responses:
   *       200:
   *         description: Utilisateur mis à jour avec succès
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       404:
   *         description: Utilisateur non trouvé
   */
  router.put('/:id',
    authenticateService,
    requirePermissions(['users:update', 'admin']),
    userValidations.update,
    userController.updateUser
  );

  /**
   * @swagger
   * /api/v1/users/{id}:
   *   delete:
   *     summary: Supprimer un utilisateur
   *     tags: [Users]
   *     security:
   *       - ServiceAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID de l'utilisateur
   *     responses:
   *       204:
   *         description: Utilisateur supprimé avec succès
   *       404:
   *         description: Utilisateur non trouvé
   */
  router.delete('/:id',
    authenticateService,
    requirePermissions(['users:delete', 'admin']),
    userValidations.getById,
    userController.deleteUser
  );

  /**
   * @swagger
   * /api/v1/users/{id}/verify-password:
   *   post:
   *     summary: Vérifier un mot de passe
   *     tags: [Users]
   *     security:
   *       - ServiceAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID de l'utilisateur
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - password
   *             properties:
   *               password:
   *                 type: string
   *                 description: Mot de passe à vérifier
   *     responses:
   *       200:
   *         description: Résultat de la vérification
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     isValid:
   *                       type: boolean
   */
  router.post('/:id/verify-password',
    authenticateService,
    requirePermissions(['users:verify-password', 'admin']),
    userController.verifyPassword
  );

  return router;
}; 