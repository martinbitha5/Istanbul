import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Href } from 'expo-router';

/**
 * Retour arrière sûr.
 *
 * `router.back()` lève « The action 'GO_BACK' was not handled by any
 * navigator » dès que la pile ne contient qu'une route. C'est exactement le cas
 * du suivi de commande : le checkout fait `dismissAll()` puis `replace()` pour
 * ne pas retomber sur le panier vidé, si bien que le suivi devient la seule
 * route de la pile — la flèche de l'en-tête n'avait alors plus rien à dépiler
 * et l'écran restait bloqué sur une erreur.
 *
 * On retombe donc sur le parent hiérarchique de l'écran plutôt que de planter.
 */
export function goBack(fallback: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}

/**
 * Bouton retour matériel Android sur un écran sans historique.
 *
 * Même cause, autre symptôme : sans pile à dépiler, le back système ferme
 * l'application depuis le suivi de commande. On l'envoie vers le même parent
 * que la flèche de l'en-tête, et seulement dans ce cas — sinon la navigation
 * par défaut reste maîtresse.
 */
export function useAndroidBack(fallback: Href) {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (router.canGoBack()) return false;
        router.replace(fallback);
        return true;
      });
      return () => subscription.remove();
    }, [fallback]),
  );
}
