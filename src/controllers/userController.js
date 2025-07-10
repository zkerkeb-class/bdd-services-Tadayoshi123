// bdd-services-Tadayoshi123/src/controllers/userController.js
// Contrôleur REST pour la gestion des utilisateurs

const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * Contrôleur pour la gestion des utilisateurs
 */
class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  /**
   * Créer un nouvel utilisateur
   * POST /api/v1/users
   */
  createUser = asyncHandler(async (req, res) => {
    const context = {
      serviceId: req.service?.id,
      userId: req.service?.userId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    const user = await this.userService.createUser(req.body, context);

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: user
    });
  });

  /**
   * Récupérer un utilisateur par ID
   * GET /api/v1/users/:id
   */
  getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { includePassword, includeRefreshTokens, includeDashboards } = req.query;

    const options = {
      includePassword: includePassword === 'true',
      includeRefreshTokens: includeRefreshTokens === 'true',
      includeDashboards: includeDashboards === 'true'
    };

    const user = await this.userService.getUserById(id, options);

    res.json({
      success: true,
      data: user
    });
  });

  /**
   * Récupérer un utilisateur par email
   * GET /api/v1/users/email/:email
   */
  getUserByEmail = asyncHandler(async (req, res) => {
    const { email } = req.params;
    const { includePassword } = req.query;

    const options = {
      includePassword: includePassword === 'true'
    };

    const user = await this.userService.getUserByEmail(email, options);

    res.json({
      success: true,
      data: user
    });
  });

  /**
   * Mettre à jour un utilisateur
   * PUT /api/v1/users/:id
   */
  updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const context = {
      serviceId: req.service?.id,
      userId: req.service?.userId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    const user = await this.userService.updateUser(id, req.body, context);

    res.json({
      success: true,
      message: 'Utilisateur mis à jour avec succès',
      data: user
    });
  });

  /**
   * Supprimer un utilisateur
   * DELETE /api/v1/users/:id
   */
  deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const context = {
      serviceId: req.service?.id,
      userId: req.service?.userId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    await this.userService.deleteUser(id, context);

    res.status(204).send();
  });

  /**
   * Rechercher des utilisateurs
   * GET /api/v1/users
   */
  searchUsers = asyncHandler(async (req, res) => {
    const { search, role, active, limit, offset } = req.query;

    const filters = {
      search,
      role,
      active: active !== undefined ? active === 'true' : undefined
    };

    const pagination = {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0
    };

    const result = await this.userService.searchUsers(filters, pagination);

    res.json({
      success: true,
      data: result.users,
      pagination: result.pagination
    });
  });

  /**
   * Vérifier un mot de passe
   * POST /api/v1/users/:id/verify-password
   */
  verifyPassword = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { password: plainPassword } = req.body;

    // Récupérer l'utilisateur avec son mot de passe
    const user = await this.userService.getUserById(id, { includePassword: true });

    // Vérifier le mot de passe
    const isValid = await this.userService.verifyPassword(plainPassword, user.password);

    res.json({
      success: true,
      data: {
        isValid
      }
    });
  });
}

module.exports = UserController; 