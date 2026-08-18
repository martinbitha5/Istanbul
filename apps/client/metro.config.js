// Metro configuré pour le monorepo pnpm.
//
// Sans ces trois réglages, Metro ne suit pas les liens symboliques de pnpm et
// échoue sur `Unable to resolve module @istanbul/ui`.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Surveiller tout le workspace pour le rechargement à chaud des packages.
config.watchFolders = [workspaceRoot];

// 2. Résoudre les dépendances depuis l'app puis depuis la racine.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Ne pas remonter au-delà : évite qu'une version en double de React se
//    glisse dans le bundle (erreur « Invalid hook call »).
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
