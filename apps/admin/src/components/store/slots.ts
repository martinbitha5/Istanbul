/**
 * Créneaux de livraison proposés.
 *
 * Uber calcule des tranches horaires réelles à partir des horaires du
 * restaurant (« Aujourd'hui, lun. 24 août » / « 2:30 – 3:00 »). Ici les
 * créneaux sont relatifs — « dans 30 minutes », « ce soir » — parce qu'aucune
 * commande planifiée n'est encore acceptée côté serveur : `fn_place_order` ne
 * prend pas d'heure souhaitée. Promettre un horaire précis que la cuisine ne
 * verrait jamais serait pire qu'une fourchette honnête.
 *
 * Le libellé choisi est stocké tel quel dans les préférences et affiché dans
 * l'entête ; il partira en note de commande le jour où la planification
 * arrivera vraiment.
 */
export const SLOT_OPTIONS = [
  { id: '30', label: 'Dans 30 minutes' },
  { id: '60', label: 'Dans 1 heure' },
  { id: '120', label: 'Dans 2 heures' },
  { id: 'evening', label: 'Ce soir' },
] as const;

export type SlotId = (typeof SLOT_OPTIONS)[number]['id'];
