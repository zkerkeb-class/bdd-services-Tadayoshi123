# 🗃️ SupervIA DB Service - Microservice de Base de Données

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/zkerkeb-class/bdd-services-Tadayoshi123)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

> **API REST sécurisée et centralisée pour la gestion des données PostgreSQL de l'écosystème SupervIA.**

Ce microservice sert de couche d'abstraction unique à la base de données. Il empêche les autres services d'accéder directement à la base, garantissant ainsi la cohérence, la sécurité et la centralisation de la logique de données.

---

## 📋 Table des matières

1.  [**Fonctionnalités Clés**](#-fonctionnalités-clés)
2.  [**Architecture & Flux**](#-architecture--flux)
3.  [**Modèles de Données (Prisma)**](#-modèles-de-données-prisma)
4.  [**Installation et Lancement**](#-installation-et-lancement)
    -   [Prérequis](#prérequis)
    -   [Configuration (.env)](#configuration-env)
    -   [Déploiement avec Docker](#déploiement-avec-docker-recommandé)
    -   [Développement local](#développement-local)
5.  [**Documentation de l'API**](#-documentation-de-lapi)
    -   [Accès à Swagger](#accès-à-swagger)
    -   [Endpoints Principaux](#endpoints-principaux)
6.  [**Sécurité**](#-sécurité)
    -   [Authentification Inter-Services](#authentification-inter-services)
    -   [Gestion des Permissions](#gestion-des-permissions)
7.  [**Tests et Qualité**](#-tests-et-qualité)
8.  [**Scripts Utiles**](#-scripts-utiles)
9.  [**Variables d'Environnement**](#-variables-denvironnement)

---

## ✨ Fonctionnalités Clés

-   **API REST Complète** : Endpoints CRUD pour toutes les ressources majeures de l'application.
-   **Gestion des Utilisateurs** : Création, recherche, mise à jour, et suppression des utilisateurs, avec hachage sécurisé des mots de passe (bcrypt).
-   **Gestion des Clients OAuth** : CRUD pour les clients applicatifs (utilisés par `auth-service`).
-   **Gestion des Refresh Tokens** : Création, validation et révocation des tokens de rafraîchissement.
-   **Gestion des Clés de Signature (JWKS)** : Stockage et exposition des clés publiques au format [JWKS](https://tools.ietf.org/html/rfc7517) pour la validation des JWT (RS256).
-   **Gestion des Dashboards** : CRUD pour les configurations de dashboards des utilisateurs.
-   **Sécurité Intégrée** : Authentification inter-services via JWT, gestion des permissions, validation des données d'entrée.
-   **Migration Automatisée** : Le `entrypoint.sh` du Dockerfile applique automatiquement les migrations Prisma au démarrage.
-   **Documentation API** : Génération automatique d'une documentation interactive avec Swagger.
-   **Observabilité** : Exposition de métriques pour Prometheus.

## 🏗️ Architecture & Flux

Ce service est le seul point de contact avec la base de données PostgreSQL. Tout autre service (`auth-service`, `metrics-service`, etc.) doit passer par l'API du `db-service` pour lire ou écrire des données.

```mermaid
graph TB
    subgraph "Services Applicatifs"
        A[Auth Service]
        B[Metrics Service]
        C[AI Service]
        D[...]
    end

    subgraph "Couche de Données"
        G[DB Service API]
    end
    
    subgraph "Base de Données"
        H[(PostgreSQL)]
    end

    A -- "Requêtes CRUD (ex: findUser, createToken)" --> G
    B -- "Requêtes CRUD (ex: saveDashboard)" --> G
    C -- "Requêtes CRUD" --> G
    D -- "Requêtes CRUD" --> G

    G -- "Transactions Prisma" --> H
    
    style G fill:#2d4,stroke:#333,stroke-width:2px
    style H fill:#9cf,stroke:#333,stroke-width:2px
```

**Flux typique :**
1.  Un service (ex: `auth-service`) a besoin de récupérer un utilisateur.
2.  Il génère un JWT de service et appelle `GET /api/v1/users/email/:email` du `db-service`.
3.  Le `db-service` reçoit la requête et son middleware d'authentification valide le JWT.
4.  Le `UserController` appelle le `UserService`.
5.  Le `UserService` utilise Prisma pour exécuter la requête sur la base de données PostgreSQL.
6.  La réponse est retournée au `auth-service`.

## 🧬 Modèles de Données (Prisma)

Le fichier `prisma/schema.prisma` définit la structure de la base de données. Voici les principaux modèles :

-   `User` : Représente un utilisateur (identifiants, profil, rôles, infos Stripe).
-   `Dashboard` : Stocke la configuration (layout JSON) d'un tableau de bord.
-   `RefreshToken` : Stocke les tokens de rafraîchissement pour les sessions persistantes.
-   `Client` : Représente une application cliente OAuth2.
-   `Key` : Stocke les paires de clés (publique/privée) pour la signature des JWT (RS256).

## 🚀 Installation et Lancement

### Prérequis
- **Node.js** : `v18.0.0` ou supérieure
- **npm** : `v8.0.0` ou supérieure
- **Docker & Docker Compose** (recommandé)
- **PostgreSQL** : `v13` ou supérieure (si non utilisé via Docker)

### Configuration (.env)
1.  **Copiez le modèle** : `cp .env.example .env`
2.  **Modifiez `.env`** : Remplissez les variables, notamment :
    -   `DATABASE_URL`: L'URL de connexion à votre base de données PostgreSQL.
    -   `JWT_SECRET`: Un secret long et complexe, **qui doit être identique** à celui utilisé par les autres services pour la communication inter-service.
    -   `ALLOWED_SERVICES`: La liste des services autorisés à appeler cette API (ex: `auth-service,metrics-service`).

### Déploiement avec Docker (Recommandé)

Le projet est configuré pour être lancé via Docker Compose dans le cadre de l'infrastructure globale SupervIA.

```bash
# Depuis la racine du projet SupervIA (avec le docker-compose.yml principal)
docker-compose up -d --build supervia-db-service

# Pour voir les logs
docker-compose logs -f supervia-db-service

# Pour arrêter
docker-compose down
```

### Développement Local

Cette méthode est utile si vous souhaitez travailler sur le service en local tout en utilisant Docker pour la base de données.

```bash
# 1. Lancer uniquement PostgreSQL depuis l'infra globale
docker-compose up -d postgres

# 2. Installer les dépendances du db-service
npm install

# 3. S'assurer que .env pointe vers la BDD locale (localhost:5432)
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/supervia?schema=public"

# 4. Appliquer les migrations de base de données
npm run prisma:migrate

# 5. Démarrer le service en mode développement (avec hot-reload)
npm run dev
```
Le serveur sera disponible sur `http://localhost:3002`.

## 📖 Documentation de l'API

### Accès à Swagger
Une fois le service démarré, une documentation interactive Swagger est disponible à l'adresse suivante :
[**http://localhost:3002/api-docs**](http://localhost:3002/api-docs)

### Endpoints Principaux

Toutes les routes sont préfixées par `/api/v1`.

| Ressource        | Méthode | Endpoint                               | Description                                        |
| ---------------- | ------- | -------------------------------------- | -------------------------------------------------- |
| **Health**       | `GET`   | `/health`                              | Vérifie l'état de santé du service.                |
| **Users**        | `POST`  | `/users`                               | Crée un utilisateur.                               |
|                  | `GET`   | `/users`                               | Recherche des utilisateurs.                        |
|                  | `GET`   | `/users/:id`                           | Récupère un utilisateur par ID.                    |
|                  | `GET`   | `/users/email/:email`                  | Récupère un utilisateur par email.                 |
|                  | `PUT`   | `/users/:id`                           | Met à jour un utilisateur.                         |
|                  | `DELETE`| `/users/:id`                           | Supprime un utilisateur.                           |
|                  | `POST`  | `/users/:id/verify-password`           | Vérifie le mot de passe d'un utilisateur.          |
| **Clients OAuth**| `POST`  | `/clients`                             | Crée un client OAuth.                              |
|                  | `GET`   | `/clients/:id`                         | Récupère un client par ID.                         |
|                  | `GET`   | `/clients/by-client-id/:clientId`      | Récupère un client par son `clientId`.             |
|                  | `PUT`   | `/clients/:id`                         | Met à jour un client.                              |
|                  | `DELETE`| `/clients/:id`                         | Supprime un client.                                |
| **Refresh Tokens**| `POST`  | `/refresh-tokens`                      | Crée un refresh token.                             |
|                  | `GET`   | `/refresh-tokens/by-token/:token`      | Récupère un token par sa valeur.                   |
|                  | `POST`  | `/refresh-tokens/revoke-by-token`      | Révoque un token par sa valeur.                    |
|                  | `POST`  | `/refresh-tokens/user/:userId/revoke-all` | Révoque tous les tokens d'un utilisateur.      |
| **Keys (JWKS)**  | `GET`   | `/keys/jwks`                           | **(Public)** Récupère les clés publiques (JWKS).   |
|                  | `POST`  | `/keys/rotate`                         | Force la rotation des clés de signature.           |
|                  | `GET`   | `/keys/active`                         | Récupère la paire de clés active (privé).          |


## 🔐 Sécurité

### Authentification Inter-Services
L'accès à l'API est protégé par un middleware (`authenticateService`) qui valide un **token JWT** à chaque requête. Ce token doit être émis par un service autorisé listé dans la variable d'environnement `ALLOWED_SERVICES`. Le secret de signature `JWT_SECRET` doit être partagé de manière sécurisée entre tous les services.

### Gestion des Permissions
Certaines routes exigent des permissions spécifiques dans le payload du JWT (ex: `users:create`, `admin`). Ce mécanisme permet un contrôle d'accès granulaire entre les services.

## 🧪 Tests et Qualité

-   **Tests Unitaires et d'Intégration** : Le projet utilise `Jest`.
-   **Tests d'API** : Un script de test complet valide tous les endpoints.

```bash
# Lancer tous les tests avec couverture de code
npm run test

# Lancer le script de test d'API (nécessite que le service soit démarré)
npm run test:api
```

## 🛠️ Scripts Utiles

-   `npm run dev`: Démarre le serveur en mode développement avec `nodemon`.
-   `npm run prisma:migrate`: Crée et applique une migration de base de données.
-   `npm run prisma:studio`: Ouvre Prisma Studio, une interface graphique pour gérer la base de données.
-   `npm run swagger:gen`: Régénère le fichier `src/swagger.json` à partir des annotations dans le code.
-   `npm run lint`: Analyse le code source avec ESLint pour détecter les erreurs et les problèmes de style.

## ⚙️ Variables d'Environnement

Consultez le fichier `.env.example` pour la liste complète. Les variables les plus importantes sont :

| Variable                  | Description                                                                                             | Exemple                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `NODE_ENV`                | L'environnement d'exécution.                                                                            | `development` / `production`                                             |
| `PORT`                    | Le port sur lequel le service écoute.                                                                   | `3002`                                                                   |
| `DATABASE_URL`            | L'URL de connexion à la base de données PostgreSQL.                                                     | `postgresql://user:pass@host:port/db?schema=public`                      |
| `JWT_SECRET`              | Le secret partagé pour la validation des JWT inter-services.                                            | `un_secret_tres_long_et_complexe`                                        |
| `ALLOWED_SERVICES`        | Liste des noms de services (du payload JWT) autorisés, séparés par des virgules.                        | `auth-service,metrics-service`                                           |
| `CORS_ORIGINS`            | Liste des origines autorisées pour les requêtes CORS.                                                   | `http://localhost:3000,https://app.supervia.com`                         |
| `API_URL`                 | L'URL de base du service, utilisée pour la documentation Swagger.                                       | `http://localhost:3002`                                                  |
| `ENABLE_SWAGGER`          | Active (`true`) ou désactive (`false`) l'endpoint de documentation Swagger.                             | `true`                                                                   |
| `ENABLE_REQUEST_LOGGING`  | Active (`true`) le logging des requêtes HTTP avec `morgan`.                                             | `true`                                                                   |
| `RATE_LIMIT_MAX_REQUESTS` | **(Prod)** Nombre max de requêtes par `RATE_LIMIT_WINDOW_MS`.                                           | `1000`                                                                   |

---
**SupervIA** - Projet de certification RNCP - Expert en Développement Full Stack. 