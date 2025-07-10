const { asyncHandler } = require('../middlewares/errorHandler');
const { AppError } = require('../middlewares/errorHandler');

class KeyController {
  constructor(keyService) {
    this.keyService = keyService;
  }

  createKeyPair = asyncHandler(async (req, res) => {
    const { publicKey, privateKey, algorithm } = req.body;
    if (!publicKey || !privateKey) {
      throw new AppError('Clés publique et privée requises', 400);
    }
    const key = await this.keyService.createKeyPair({ publicKey, privateKey, algorithm });
    // Ne jamais retourner la clé privée dans la réponse
    res.status(201).json({
      success: true,
      data: {
        id: key.id,
        kid: key.kid,
        publicKey: key.publicKey,
        algorithm: key.algorithm,
        status: key.status,
      }
    });
  });

  getActiveKeyPair = asyncHandler(async (req, res) => {
    const key = await this.keyService.getActiveKeyPair();
    if (!key) {
      console.log("Aucune clé active trouvée, lancement de l'erreur 404...");
      throw new AppError('Aucune clé active trouvée', 404);
    }
    // Ne jamais retourner la clé privée dans la réponse
    res.status(200).json({
      success: true,
      data: {
        id: key.id,
        kid: key.kid,
        publicKey: key.publicKey,
        privateKey: key.privateKey, // Le service interne (auth) en a besoin
        algorithm: key.algorithm,
        status: key.status,
      }
    });
  });

  getActivePublicKeys = asyncHandler(async (req, res) => {
    // Le service retourne maintenant l'objet JWKS entièrement formaté.
    const jwks = await this.keyService.getActivePublicKeys();
    res.status(200).json(jwks);
  });

  rotateKeys = asyncHandler(async (req, res) => {
    const { publicKey, privateKey, algorithm } = req.body;
    if (!publicKey || !privateKey) {
      throw new AppError('Clés publique et privée requises pour la rotation', 400);
    }
    const key = await this.keyService.createKeyPair({ publicKey, privateKey, algorithm });
    res.status(201).json({
      success: true,
      message: 'Rotation des clés effectuée avec succès.',
      data: {
        id: key.id,
        kid: key.kid,
        status: key.status,
      },
    });
  });

  getKeyByKid = asyncHandler(async (req, res) => {
    const { kid } = req.params;
    const key = await this.keyService.getKeyByKid(kid);
    if (!key) {
      throw new AppError('Clé non trouvée', 404);
    }
    res.status(200).json({
      success: true,
      data: {
        id: key.id,
        kid: key.kid,
        publicKey: key.publicKey,
        algorithm: key.algorithm,
        status: key.status,
      }
    });
  });
}

module.exports = KeyController; 