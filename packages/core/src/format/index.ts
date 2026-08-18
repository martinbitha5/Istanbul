import type { Cents } from '@istanbul/types';

/**
 * Formatage.
 *
 * Tout ce qui s'affiche à l'écran passe par ici. Un `${amount / 100} $` écrit
 * à la main dans un composant produira tôt ou tard « 4.5 $ » au lieu de
 * « 4,50 $ ».
 */

const LOCALE = 'fr-CD';

/** Montant en centimes → « 4,50 $ ». */
export function formatMoney(cents: Cents, currency = 'USD'): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Certains moteurs Hermes anciens ne connaissent pas fr-CD.
    return `${amount.toFixed(2).replace('.', ',')} $`;
  }
}

/** Version compacte pour les cartes produit : « 4,50 $ » sans espace insécable. */
export function formatPrice(cents: Cents, currency = 'USD'): string {
  return formatMoney(cents, currency).replace(/ /g, ' ');
}

/** Réduction affichée avec son signe : « −2,00 $ ». */
export function formatDiscount(cents: Cents, currency = 'USD'): string {
  return cents > 0 ? `−${formatMoney(cents, currency)}` : formatMoney(0, currency);
}

export function formatPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1).replace('.', ',')} %`;
}

export function formatDistance(km: number | null): string {
  if (km == null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** Fenêtre d'estimation, plus honnête qu'une valeur unique : « 25–35 min ». */
export function formatEtaRange(minutes: number | null, spread = 10): string {
  if (minutes == null) return '—';
  return `${minutes}–${minutes + spread} min`;
}

const dateTimeFormat = (options: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat(LOCALE, options);
  } catch {
    return new Intl.DateTimeFormat('fr-FR', options);
  }
};

export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return dateTimeFormat({ hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return dateTimeFormat({ day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return dateTimeFormat({
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** « il y a 3 min », « hier », « le 12 mars ». */
export function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;

  return `le ${formatDate(iso)}`;
}

/** Salutation contextuelle de l'écran d'accueil. */
export function greeting(hour = new Date().getHours()): string {
  if (hour < 5) return 'Bonne nuit';
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export function firstName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export function initials(fullName: string | null | undefined): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Numéros RDC : « +243 999 000 105 ».
 * Accepte 0XXXXXXXXX, 243XXXXXXXXX ou +243XXXXXXXXX.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');

  let national = digits;
  if (digits.startsWith('243')) national = digits.slice(3);
  else if (digits.startsWith('0')) national = digits.slice(1);

  if (national.length !== 9) return raw;

  return `+243 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

/** Forme E.164 attendue par Supabase Auth pour l'OTP SMS. */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let national = digits;
  if (digits.startsWith('243')) national = digits.slice(3);
  else if (digits.startsWith('0')) national = digits.slice(1);

  return national.length === 9 ? `+243${national}` : null;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return toE164(value) !== null;
}

/** Récapitulatif d'options sur une ligne de panier : « Grande · Sauce à l'ail ». */
export function summarizeOptions(options: { option_name: string }[]): string {
  return options.map((option) => option.option_name).join(' · ');
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count > 1 ? (plural ?? `${singular}s`) : singular;
}

export function formatItemCount(count: number): string {
  return `${count} ${pluralize(count, 'article')}`;
}
