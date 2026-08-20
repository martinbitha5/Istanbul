/**
 * Surface d'import unique des applications.
 *
 * `@istanbul/core` réexporte `@istanbul/types` : un écran écrit
 * `import { formatMoney, orderStatusLabel } from '@istanbul/core'` sans avoir
 * à savoir lequel des deux packages porte quoi. Les types restent importables
 * directement depuis `@istanbul/types` pour les packages qui ne veulent pas
 * dépendre de Supabase (c'est le cas de `@istanbul/ui`).
 */
export * from '@istanbul/types';

// Supabase
export * from './supabase/client';

// Accès aux données
export * from './api/auth';
export * from './api/catalog';
export * from './api/orders';
export * from './api/delivery';
export * from './api/admin';
export * from './api/restaurants';
export * from './api/notifications';
export * from './api/reviews';
export * from './api/loyalty';

// Logique métier
export * from './pricing';
export * from './format';
export * from './geo';
export * from './log';

// État local
export * from './store/cart';

// React Query
export * from './query/keys';
export * from './query/client';

// Hooks
export * from './hooks/useSession';
export * from './hooks/useCatalog';
export * from './hooks/useOrders';
export * from './hooks/useDelivery';
export * from './hooks/useAdmin';
export * from './hooks/useRestaurantAdmin';
export * from './hooks/useRealtime';
export * from './hooks/useReviews';
