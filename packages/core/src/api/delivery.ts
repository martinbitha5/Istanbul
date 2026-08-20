import type {
  Delivery,
  DeliveryStatus,
  Driver,
  DriverAvailability,
  DriverLocation,
  OrderDetail,
  UUID,
} from '@istanbul/types';
import { getSupabase } from '../supabase/client';

/**
 * Colonnes de `deliveries` énumérées explicitement.
 *
 * `confirmation_code` et `confirmation_attempts` sont volontairement absents :
 * le privilège de lecture est révoqué pour le rôle `authenticated`
 * (migration 09), un `select *` échouerait donc. Le client obtient son code
 * via `fetchConfirmationCode`.
 */
const DELIVERY_COLUMNS = `
  id, order_id, driver_id, status,
  payout_amount, cash_to_collect, distance_km, eta_minutes,
  offered_at, accepted_at, rejected_at, heading_to_restaurant_at,
  picked_up_at, heading_to_customer_at, arrived_at, delivered_at, cancelled_at,
  proof_photo_url, driver_note, created_at, updated_at
`;

const DELIVERY_SELECT = `
  ${DELIVERY_COLUMNS},
  order:orders (
    *,
    items:order_items (
      *,
      options:order_item_options ( * )
    ),
    payment:payments ( * ),
    customer:profiles!orders_customer_id_fkey ( id, full_name, phone, avatar_url )
  )
`;

export interface DeliveryWithOrder extends Delivery {
  order: OrderDetail;
}

function normalize(row: unknown): DeliveryWithOrder {
  const delivery = row as DeliveryWithOrder & { order: OrderDetail & { payment: unknown } };
  const payment = Array.isArray(delivery.order?.payment)
    ? (delivery.order.payment[0] ?? null)
    : (delivery.order?.payment ?? null);

  return {
    ...delivery,
    order: { ...delivery.order, payment: payment as OrderDetail['payment'] },
  };
}

// ---------------------------------------------------------------------------
// Livreur
// ---------------------------------------------------------------------------

export async function fetchMyDriverProfile(): Promise<Driver | null> {
  const supabase = getSupabase();
  const { data: session } = await supabase.auth.getUser();
  const profileId = session.user?.id;
  if (!profileId) return null;

  const { data, error } = await supabase
    .from('drivers')
    .select('*, profile:profiles ( full_name, phone, avatar_url )')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) throw error;
  return (data as Driver | null) ?? null;
}

/** Courses proposées et non encore prises par un livreur. */
export async function fetchAvailableDeliveries(): Promise<DeliveryWithOrder[]> {
  const { data, error } = await getSupabase()
    .from('deliveries')
    .select(DELIVERY_SELECT)
    .eq('status', 'OFFERED')
    .order('offered_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(normalize);
}

const ACTIVE_STATUSES: DeliveryStatus[] = [
  'ACCEPTED',
  'HEADING_TO_RESTAURANT',
  'PICKED_UP',
  'HEADING_TO_CUSTOMER',
  'ARRIVED',
];

export async function fetchActiveDeliveries(driverId: UUID): Promise<DeliveryWithOrder[]> {
  const { data, error } = await getSupabase()
    .from('deliveries')
    .select(DELIVERY_SELECT)
    .eq('driver_id', driverId)
    .in('status', ACTIVE_STATUSES)
    .order('accepted_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function fetchCompletedDeliveries(
  driverId: UUID,
  limit = 50,
): Promise<DeliveryWithOrder[]> {
  const { data, error } = await getSupabase()
    .from('deliveries')
    .select(DELIVERY_SELECT)
    .eq('driver_id', driverId)
    .eq('status', 'DELIVERED')
    .order('delivered_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(normalize);
}

export { DELIVERY_COLUMNS };

export async function fetchDelivery(deliveryId: UUID): Promise<DeliveryWithOrder> {
  const { data, error } = await getSupabase()
    .from('deliveries')
    .select(DELIVERY_SELECT)
    .eq('id', deliveryId)
    .single();

  if (error) throw error;
  return normalize(data);
}

export async function advanceDeliveryStatus(
  deliveryId: UUID,
  to: DeliveryStatus,
): Promise<Delivery> {
  const { data, error } = await getSupabase().rpc('fn_advance_delivery_status', {
    p_delivery_id: deliveryId,
    p_to: to,
  });
  if (error) throw error;
  return data as Delivery;
}

/**
 * Clôture d'une course. Le code est vérifié côté serveur : une comparaison
 * locale serait contournable en modifiant le bundle.
 */
export async function confirmDelivery(deliveryId: UUID, code: string): Promise<Delivery> {
  const { data, error } = await getSupabase().rpc('fn_confirm_delivery', {
    p_delivery_id: deliveryId,
    p_code: code,
  });
  if (error) throw error;
  return data as Delivery;
}

/** Le livreur prend une course laissée libre. */
export async function claimDelivery(deliveryId: UUID, driverId: UUID): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('deliveries')
    .update({ driver_id: driverId })
    .eq('id', deliveryId)
    .is('driver_id', null)
    .eq('status', 'OFFERED')
    .select('id');

  if (error) throw error;

  // 0 ligne touchée = un collègue a été plus rapide. Sans ce contrôle,
  // l'UPDATE est un no-op silencieux et l'avancement de statut qui suit
  // échoue avec un message incompréhensible.
  if (!data || data.length === 0) {
    throw new Error('Cette course vient d’être prise par un autre livreur.');
  }

  await advanceDeliveryStatus(deliveryId, 'ACCEPTED');
}

export async function setDriverAvailability(
  driverId: UUID,
  availability: DriverAvailability,
): Promise<void> {
  const { error } = await getSupabase()
    .from('drivers')
    .update({ availability })
    .eq('id', driverId);
  if (error) throw error;
}

export async function pushDriverLocation(params: {
  latitude: number;
  longitude: number;
  deliveryId?: UUID | null;
  heading?: number | null;
  speedKmh?: number | null;
  accuracyM?: number | null;
}): Promise<void> {
  const { error } = await getSupabase().rpc('fn_push_driver_location', {
    p_latitude: params.latitude,
    p_longitude: params.longitude,
    p_delivery_id: params.deliveryId ?? null,
    p_heading: params.heading ?? null,
    p_speed_kmh: params.speedKmh ?? null,
    p_accuracy_m: params.accuracyM ?? null,
  });
  if (error) throw error;
}

/**
 * Trace GPS complète d'une course — l'itinéraire réellement parcouru,
 * dessiné sur la carte plein écran. Bornée : à 15 s/point, 500 points
 * couvrent déjà plus de deux heures de course.
 */
export async function fetchDriverTrail(
  deliveryId: UUID,
): Promise<Pick<DriverLocation, 'latitude' | 'longitude' | 'recorded_at'>[]> {
  const { data, error } = await getSupabase()
    .from('driver_locations')
    .select('latitude, longitude, recorded_at')
    .eq('delivery_id', deliveryId)
    .order('recorded_at', { ascending: true })
    .limit(500);

  if (error) throw error;
  return (data ?? []) as Pick<DriverLocation, 'latitude' | 'longitude' | 'recorded_at'>[];
}

/** Dernière position connue du livreur, pour la carte de suivi client. */
export async function fetchLatestDriverLocation(
  deliveryId: UUID,
): Promise<DriverLocation | null> {
  const { data, error } = await getSupabase()
    .from('driver_locations')
    .select('*')
    .eq('delivery_id', deliveryId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as DriverLocation | null) ?? null;
}

// ---------------------------------------------------------------------------
// Revenus du livreur
// ---------------------------------------------------------------------------

export interface DriverEarnings {
  today: number;
  week: number;
  month: number;
  total: number;
  deliveriesToday: number;
  deliveriesTotal: number;
}

export async function fetchDriverEarnings(driverId: UUID): Promise<DriverEarnings> {
  const supabase = getSupabase();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(startOfDay);
  // Semaine à la française : lundi = début.
  startOfWeek.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7));

  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

  const [{ data: rows, error }, { data: driver }] = await Promise.all([
    supabase
      .from('deliveries')
      .select('payout_amount, delivered_at')
      .eq('driver_id', driverId)
      .eq('status', 'DELIVERED')
      .gte('delivered_at', startOfMonth.toISOString()),
    supabase
      .from('drivers')
      .select('total_earnings, total_deliveries')
      .eq('id', driverId)
      .single(),
  ]);

  if (error) throw error;

  const list = (rows ?? []) as { payout_amount: number; delivered_at: string }[];
  const sum = (from: Date) =>
    list
      .filter((row) => new Date(row.delivered_at) >= from)
      .reduce((total, row) => total + row.payout_amount, 0);

  return {
    today: sum(startOfDay),
    week: sum(startOfWeek),
    month: sum(startOfMonth),
    total: (driver as { total_earnings: number } | null)?.total_earnings ?? 0,
    deliveriesToday: list.filter((row) => new Date(row.delivered_at) >= startOfDay).length,
    deliveriesTotal: (driver as { total_deliveries: number } | null)?.total_deliveries ?? 0,
  };
}
