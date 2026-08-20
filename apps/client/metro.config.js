// Metro configuré pour le monorepo pnpm.
//
// Sans ces deux réglages, Metro ne suit pas les liens symboliques de pnpm et
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

// On laisse volontairement `disableHierarchicalLookup` à sa valeur par défaut
// (false). Ce réglage vient de la recette Expo pour les monorepos npm/Yarn, où
// les `node_modules` imbriqués peuvent cacher un second React. pnpm range les
// dépendances de façon isolée : `@expo/metro-runtime` est lié dans
// `.pnpm/expo-router@…/node_modules/`, à côté d'`expo-router` et nulle part
// ailleurs. L'activer empêche Metro de l'y trouver et casse le bundle avec
// `Unable to resolve module @expo/metro-runtime`. Le doublon de React, lui,
// est déjà exclu par le lockfile : une seule version de react et de
// react-native y est résolue.

module.exports = config;
