import type {
  DeliveryStatus,
  DriverAvailability,
  FulfillmentType,
  NotificationTopic,
  OptionSelectionType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PromotionType,
  UserRole,
  VehicleType,
} from './enums';

/**
 * Types du domaine.
 *
 * `Cents` est un alias volontairement explicite : chaque fois qu'un montant
 * traverse une frontière, on veut lire dans la signature qu'il est en centimes.
 * Un `number` nu qui représente 4.5 dollars est le bug classique de ce métier.
 */
export type Cents = number;
export type UUID = string;
export type ISODateString = string;

export interface Restaurant {
  id: UUID;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  phone: string;
  email: string | null;
  address_line: string;
  city: string;
  latitude: number;
  longitude: number;
  currency: string;
  is_open: boolean;
  is_accepting_orders: boolean;
  min_order_amount: Cents;
  avg_prep_minutes: number;
  service_fee_bps: number;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
}

export interface Profile {
  id: UUID;
  role: UserRole;
  restaurant_id: UUID | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  locale: string;
  push_tokens: string[];
  notif_orders: boolean;
  notif_promos: boolean;
  is_active: boolean;
  created_at: ISODateString;
}

export interface Address {
  id: UUID;
  profile_id: UUID;
  label: string;
  recipient_name: string | null;
  phone: string | null;
  commune: string | null;
  street: string;
  details: string | null;
  delivery_notes: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
}

export interface Category {
  id: UUID;
  restaurant_id: UUID;
  parent_id: UUID | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Product {
  id: UUID;
  restaurant_id: UUID;
  category_id: UUID | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  image_blurhash: string | null;
  base_price: Cents;
  compare_at_price: Cents | null;
  is_active: boolean;
  is_available: boolean;
  is_popular: boolean;
  is_recommended: boolean;
  prep_minutes: number;
  calories: number | null;
  spicy_level: 0 | 1 | 2 | 3;
  tags: string[];
  sort_order: number;
  sold_count: number;
  rating_sum: number;
  rating_count: number;
}

export interface ProductOption {
  id: UUID;
  group_id: UUID;
  name: string;
  price_delta: Cents;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
}

export interface ProductOptionGroup {
  id: UUID;
  product_id: UUID;
  name: string;
  description: string | null;
  selection_type: OptionSelectionType;
  is_required: boolean;
  min_select: number;
  max_select: number;
  sort_order: number;
  options: ProductOption[];
}

/** Produit accompagné de ses groupes d'options — la forme utilisée par l'écran détail. */
export interface ProductWithOptions extends Product {
  option_groups: ProductOptionGroup[];
  category?: Pick<Category, 'id' | 'name' | 'slug'> | null;
}

export interface DeliveryZone {
  id: UUID;
  restaurant_id: UUID;
  name: string;
  min_distance_km: number;
  max_distance_km: number;
  fee_amount: Cents;
  eta_minutes: number;
  free_above: Cents | null;
  is_active: boolean;
  sort_order: number;
}

export interface Promotion {
  id: UUID;
  restaurant_id: UUID;
  code: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  type: PromotionType;
  value: number;
  max_discount_amount: Cents | null;
  min_order_amount: Cents;
  applies_to_all: boolean;
  first_order_only: boolean;
  starts_at: ISODateString;
  ends_at: ISODateString | null;
  usage_limit: number | null;
  usage_limit_per_user: number;
  usage_count: number;
  is_active: boolean;
}

export interface Driver {
  id: UUID;
  profile_id: UUID;
  restaurant_id: UUID;
  vehicle: VehicleType;
  plate_number: string | null;
  availability: DriverAvailability;
  is_approved: boolean;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_at: ISODateString | null;
  total_deliveries: number;
  total_earnings: Cents;
  rating_sum: number;
  rating_count: number;
  profile?: Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>;
}

export interface OrderItemOption {
  id: UUID;
  order_item_id: UUID;
  option_id: UUID | null;
  group_name: string;
  option_name: string;
  price_delta: Cents;
}

export interface OrderItem {
  id: UUID;
  order_id: UUID;
  product_id: UUID | null;
  product_name: string;
  product_image: string | null;
  unit_price: Cents;
  options_price: Cents;
  quantity: number;
  line_total: Cents;
  note: string | null;
  options: OrderItemOption[];
}

export interface OrderStatusEvent {
  id: UUID;
  order_id: UUID;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: UUID | null;
  actor_role: UserRole | null;
  note: string | null;
  created_at: ISODateString;
}

export interface Payment {
  id: UUID;
  order_id: UUID;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: Cents;
  currency: string;
  external_id: string | null;
  phone_number: string | null;
  paid_at: ISODateString | null;
  failed_reason: string | null;
}

export interface Delivery {
  id: UUID;
  order_id: UUID;
  driver_id: UUID | null;
  status: DeliveryStatus;
  /**
   * Jamais renvoyé par un `select` : la colonne est révoquée pour le rôle
   * `authenticated` (migration 09). Passer par `fetchConfirmationCode`, qui
   * ne répond qu'au client de la commande et au staff.
   */
  confirmation_code?: never;
  payout_amount: Cents;
  cash_to_collect: Cents;
  distance_km: number | null;
  eta_minutes: number | null;
  offered_at: ISODateString;
  accepted_at: ISODateString | null;
  picked_up_at: ISODateString | null;
  arrived_at: ISODateString | null;
  delivered_at: ISODateString | null;
  proof_photo_url: string | null;
  driver_note: string | null;
  driver?: Driver | null;
}

export interface Order {
  id: UUID;
  order_number: string;
  restaurant_id: UUID;
  customer_id: UUID;
  status: OrderStatus;
  fulfillment: FulfillmentType;
  address_id: UUID | null;
  delivery_address: string | null;
  delivery_commune: string | null;
  delivery_details: string | null;
  delivery_notes: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  contact_phone: string;
  contact_name: string;
  currency: string;
  subtotal: Cents;
  delivery_fee: Cents;
  service_fee: Cents;
  discount_amount: Cents;
  total: Cents;
  promotion_id: UUID | null;
  promotion_code: string | null;
  distance_km: number | null;
  eta_minutes: number | null;
  scheduled_for: ISODateString | null;
  accepted_at: ISODateString | null;
  ready_at: ISODateString | null;
  picked_up_at: ISODateString | null;
  delivered_at: ISODateString | null;
  cancelled_at: ISODateString | null;
  cancellation_reason: string | null;
  customer_note: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

/** Commande hydratée — la forme renvoyée par `useOrder`. */
export interface OrderDetail extends Order {
  items: OrderItem[];
  history: OrderStatusEvent[];
  delivery: Delivery | null;
  payment: Payment | null;
  customer?: Pick<Profile, 'id' | 'full_name' | 'phone' | 'avatar_url'>;
}

export interface DriverLocation {
  id: number;
  driver_id: UUID;
  delivery_id: UUID | null;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed_kmh: number | null;
  recorded_at: ISODateString;
}

export interface AppNotification {
  id: UUID;
  profile_id: UUID;
  topic: NotificationTopic;
  title: string;
  body: string;
  data: Record<string, unknown>;
  order_id: UUID | null;
  read_at: ISODateString | null;
  created_at: ISODateString;
}

// ---------------------------------------------------------------------------
// Panier — état local, jamais persisté côté serveur avant le checkout
// ---------------------------------------------------------------------------

export interface CartOptionSelection {
  option_id: UUID;
  group_id: UUID;
  group_name: string;
  option_name: string;
  price_delta: Cents;
}

export interface CartLine {
  /** Identifiant local : produit + signature des options. Deux lignes du même
   *  produit avec des options différentes doivent rester séparées. */
  key: string;
  product_id: UUID;
  product_name: string;
  product_image: string | null;
  unit_price: Cents;
  quantity: number;
  options: CartOptionSelection[];
  note: string | null;
}

// ---------------------------------------------------------------------------
// Retours des fonctions SQL
// ---------------------------------------------------------------------------

export interface DeliveryQuote {
  zone_id: UUID | null;
  zone_name: string;
  distance_km: number | null;
  fee_amount: Cents;
  eta_minutes: number;
  in_range: boolean;
}

export interface PromotionEvaluation {
  promotion_id: UUID | null;
  title: string | null;
  discount_amount: Cents;
  applies_to_delivery: boolean;
  is_valid: boolean;
  reason: string | null;
}

export interface DashboardStats {
  revenue: Cents;
  orders_total: number;
  orders_new: number;
  orders_preparing: number;
  orders_ready: number;
  orders_in_transit: number;
  orders_delivered: number;
  orders_cancelled: number;
  avg_basket: Cents;
  customers: number;
  drivers_active: number;
}

export interface SalesPoint {
  bucket: ISODateString;
  revenue: Cents;
  orders: number;
}

export interface TopProduct {
  product_id: UUID;
  product_name: string;
  image_url: string | null;
  quantity: number;
  revenue: Cents;
}

/** Payload attendu par `fn_place_order`. */
export interface PlaceOrderItem {
  product_id: UUID;
  quantity: number;
  option_ids: UUID[];
  note?: string | null;
}
