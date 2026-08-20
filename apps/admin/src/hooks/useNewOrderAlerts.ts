'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Alertes de nouvelles commandes : notification système + son + badge d'onglet.
 *
 * L'ancien code vérifiait `Notification.permission === 'granted'` sans jamais
 * demander la permission — aucune notification ne partait jamais. Ce hook
 * expose `permission` et `requestPermission` pour qu'un bouton « Activer les
 * alertes » fasse la demande (elle doit venir d'un geste utilisateur), et
 * `notify()` à appeler à chaque commande détectée :
 *   - notification système si la permission est accordée ;
 *   - double bip WebAudio (aucun fichier externe à charger) ;
 *   - badge dans le titre de l'onglet « (3) Commandes — Istanbul », remis à
 *     zéro quand l'onglet redevient visible.
 */

type PermissionState = NotificationPermission | 'unsupported';

const BADGE_TITLE = 'Commandes — Istanbul';

export function useNewOrderAlerts() {
  // 'unsupported' au premier rendu : Notification n'existe ni côté SSR ni sur
  // certains WebViews ; la vraie valeur est relevée après montage.
  const [permission, setPermission] = useState<PermissionState>('unsupported');
  const unseen = useRef(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Le hook possède le titre de l'onglet tant que la page est montée :
  // « Commandes — Istanbul », préfixé de « (n) » quand des commandes arrivent
  // onglet caché, remis à zéro dès que l'onglet redevient visible.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previousTitle = document.title;
    document.title = BADGE_TITLE;

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && unseen.current > 0) {
        unseen.current = 0;
        document.title = BADGE_TITLE;
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.title = previousTitle;
    };
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } catch {
      // Certains navigateurs anciens utilisent l'API callback : on relit l'état.
      setPermission(Notification.permission);
    }
  }, []);

  const notify = useCallback((body = 'Une commande vient d’arriver.') => {
    if (typeof window === 'undefined') return;

    playDoubleBeep();

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Nouvelle commande', { body });
      } catch {
        // Notification constructor indisponible (Android WebView) : le son suffit.
      }
    }

    // Badge d'onglet uniquement quand l'onglet n'est pas visible : le gérant
    // qui regarde déjà la file n'a pas besoin d'un compteur.
    if (document.visibilityState !== 'visible') {
      unseen.current += 1;
      document.title = `(${unseen.current}) ${BADGE_TITLE}`;
    }
  }, []);

  return { permission, requestPermission, notify };
}

/**
 * Double bip 880 Hz (~150 ms chacun) en WebAudio pur : aucun fichier audio à
 * héberger ni à charger sur un réseau mobile lent.
 */
function playDoubleBeep(): void {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const context = new AudioCtx();

    const beep = (at: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      // Rampe exponentielle : évite le « clic » d'une coupure brutale.
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.16);
    };

    const now = context.currentTime;
    beep(now);
    beep(now + 0.25);

    // Libère le contexte audio une fois les bips joués.
    window.setTimeout(() => void context.close().catch(() => undefined), 900);
  } catch {
    // AudioContext bloqué avant interaction utilisateur : silencieux, tant pis.
  }
}
