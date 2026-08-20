import type {
  Address,
  FulfillmentType,
  Order,
  OrderDetail,
  OrderStatus,
  PaymentProvider,
  PlaceOrderItem,
  PromotionEvaluation,
  UUID,
} from '@istanbul/types';
import { getSupabase } from '../supabase/client';

/**
 * Sélection complète d'une commande — suivi client, historique, dashboard.
 *
 * Les colonnes de `deliveries` sont énumérées : `confirmation_code` n'est pas
 * lisible par le rôle `authenticated` (migration 09) et ferait échouer un
 * `select *`. Le client récupère son code via `fetchConfirmationCode`.
 */
const ORDER_DETAIL_SELECT = `
  *,
  items:order_items (
    *,
    options:order_item_options ( * )
  ),
  history:order_status_history ( * ),
  delivery:deliveries (
    id, order_id, driver_id, status,
    payout_amount, cash_to_collect, distance_km, eta_minutes,
    offered_at, accepted_at, picked_up_at, arrived_at, delivered_at,
    proof_photo_url, driver_note,
    driver:drivers (
      id, profile_id, vehicle, plate_number, availability,
      last_latitude, last_longitude, last_location_at,
      total_deliveries, rating_sum, rating_count,
      profile:profiles ( full_name, phone, avatar_url )
    )
  ),
  payment:payments ( * ),
  customer:profiles!orders_customer_id_fkey ( id, full_name, phone, avatar_url )
`;

function normalizeOrder(row: unknown): OrderDetail {
  const order = row as OrderDetail & {
    delivery: OrderDetail['delivery'] | OrderDetail['delivery'][];
    payment: OrderDetail['payment'] | OrderDetail['payment'][];
  };

  // Une relation 1:1 remonte parfois en tableau selon la façon dont PostgREST
  // infère la cardinalité. On normalise plutôt que de le subir au rendu.
  const delivery = Array.isArray(order.delivery) ? (order.delivery[0] ?? null) : order.delivery;
  const payment = Array.isArray(order.payment) ? (order.payment[0] ?? null) : order.payment;

  return {
    ...order,
    delivery: delivery ?? null,
    payment: payment ?? null,
    items: [...(order.items ?? [])],
    history: [...(order.history ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    ),
  };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface PlaceOrderInput {
  restaurantId: UUID;
  fulfillment: FulfillmentType;
  items: PlaceOrderItem[];
  contactName: string;
  contactPhone: string;
  addressId?: UUID | null;
  deliveryNotes?: string | null;
  customerNote?: string | null;
  promoCode?: string | null;
  paymentProvider?: PaymentProvider;
  /** Points fidélité à convertir en réduction (plafonnés côté serveur). */
  redeemPoints?: number;
}

/**
 * Passage de commande.
 *
 * Une seule transaction serveur : lignes, options, frais, promo et paiement.
 * Impossible de se retrouver avec une commande à moitié créée si le réseau
 * lâche au milieu.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  const { data, error } = await getSupabase().rpc('fn_place_order', {
    p_restaurant_id: input.restaurantId,
    p_fulfillment: input.fulfillment,
    p_items: input.items,
    p_contact_name: input.contactName,
    p_contact_phone: input.contactPhone,
    p_address_id: input.addressId ?? null,
    p_delivery_notes: input.deliveryNotes ?? null,
    p_customer_note: input.customerNote ?? null,
    p_promo_code: input.promoCode ?? null,
    p_payment_provider: input.paymentProvider ?? 'CASH',
    p_redeem_points: input.redeemPoints ?? 0,
  });

  if (error) throw error;
  return data as Order;
}

export async function fetchMyOrders(limit = 30): Promise<OrderDetail[]> {
  const { data, error } = await getSupabase()
    .from('orders')
    .select(ORDER_DETAIL_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(normalizeOrder);
}

export async function fetchOrder(orderId: UUID): Promise<OrderDetail> {
  const { data, error } = await getSupabase()
    .from('orders')
    .select(ORDER_DETAIL_SELECT)
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return normalizeOrder(data);
}

/** Commande en cours du client, s'il y en a une. Alimente le bandeau d'accueil. */
export async function fetchActiveOrder(): Promise<OrderDetail | null> {
  const { data, error } = await getSupabase()
    .from('orders')
    .select(ORDER_DETAIL_SELECT)
    .not('status', 'in', '(DELIVERED,CANCELLED)')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  const row = (data ?? [])[0];
  return row ? normalizeOrder(row) : null;
}

/**
 * Code de confirmation à 4 chiffres.
 *
 * Passe par une fonction SECURITY DEFINER plutôt que par une lecture directe :
 * le livreur a accès à la ligne `deliveries` de sa course, il ne doit pas
 * pouvoir en extraire le code. Renvoie null s'il n'y a pas de livraison ou si
 * l'appelant n'y a pas droit.
 */
export async function fetchConfirmationCode(orderId: UUID): Promise<string | null> {
  const { data, error } = await getSupabase().rpc('fn_order_confirmation_code', {
    p_order_id: orderId,
  });

  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function cancelOrder(orderId: UUID, reason: string): Promise<void> {
  const { error } = await getSupabase().rpc('fn_advance_order_status', {
    p_order_id: orderId,
    p_to: 'CANCELLED' satisfies OrderStatus,
    p_note: reason,
  });
  if (error) throw error;
}

export async function evaluatePromotion(
  restaurantId: UUID,
  code: string,
  subtotal: number,
  deliveryFee: number,
): Promise<PromotionEvaluation> {
  const { data, error } = await getSupabase()
    .rpc('fn_evaluate_promotion', {
      p_restaurant_id: restaurantId,
      p_code: code,
      p_subtotal: subtotal,
      p_delivery_fee: deliveryFee,
    })
    .single();

  if (error) throw error;
  return data as PromotionEvaluation;
}

// ---------------------------------------------------------------------------
// Adresses
// ---------------------------------------------------------------------------

export async function fetchAddresses(): Promise<Address[]> {
  const { data, error } = await getSupabase()
    .from('addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Address[];
}

export type AddressInput = Omit<Address, 'id' | 'profile_id'> & { id?: UUID };

export async function saveAddress(input: AddressInput): Promise<Address> {
  const supabase = getSupabase();
  const { data: session } = await supabase.auth.getUser();
  const profileId = session.user?.id;
  if (!profileId) throw new Error('Connectez-vous pour enregistrer une adresse.');

  // L'index unique partiel `uq_addresses_one_default` rejetterait deux adresses
  // par défaut : on retire l'ancienne avant d'écrire la nouvelle.
  if (input.is_default) {
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('profile_id', profileId)
      .eq('is_default', true);
  }

  const payload = { ...input, profile_id: profileId };
  const { data, error } = input.id
    ? await supabase.from('addresses').update(payload).eq('id', input.id).select().single()
    : await supabase.from('addresses').insert(payload).select().single();

  if (error) throw error;
  return data as Address;
}

export async function deleteAddress(addressId: UUID): Promise<void> {
  const { error } = await getSupabase().from('addresses').delete().eq('id', addressId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Restaurant / admin
// ---------------------------------------------------------------------------

export interface OrderQueueFilters {
  restaurantId: UUID;
  statuses?: OrderStatus[];
  search?: string;
  limit?: number;
}

export async function fetchOrderQueue(filters: OrderQueueFilters): Promise<OrderDetail[]> {
  let query = getSupabase()
    .from('orders')
    .select(ORDER_DETAIL_SELECT)
    .eq('restaurant_id', filters.restaurantId);

  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses);
  }
  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim().replace(/[%,()]/g, '');
    query = query.or(`order_number.ilike.%${term}%,contact_name.ilike.%${term}%,contact_phone.ilike.%${term}%`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 60);

  if (error) throw error;
  return (data ?? []).map(normalizeOrder);
}

export async function advanceOrderStatus(
  orderId: UUID,
  to: OrderStatus,
  note?: string,
): Promise<Order> {
  const { data, error } = await getSupabase().rpc('fn_advance_order_status', {
    p_order_id: orderId,
    p_to: to,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data as Order;
}

export async function assignDriver(
  orderId: UUID,
  driverId: UUID,
  payoutAmount?: number,
): Promise<void> {
  const { error } = await getSupabase().rpc('fn_assign_driver', {
    p_order_id: orderId,
    p_driver_id: driverId,
    p_payout: payoutAmount ?? null,
  });
  if (error) throw error;
}
