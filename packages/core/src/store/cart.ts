import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  CartLine,
  CartOptionSelection,
  Cents,
  FulfillmentType,
  ProductWithOptions,
  UUID,
} from '@istanbul/types';
import { cartItemCount, cartLineKey, cartSubtotal, lineTotal } from '../pricing';

/**
 * Panier — état local persistant.
 *
 * Il n'existe aucune table `carts` côté serveur : un panier abandonné ne vaut
 * pas une ligne en base, et le mode hors-ligne devient trivial. Le panier ne
 * touche le serveur qu'au moment du checkout, en une seule transaction.
 */

interface CartState {
  lines: CartLine[];
  fulfillment: FulfillmentType;
  addressId: UUID | null;
  promoCode: string | null;
  customerNote: string | null;
  deliveryNotes: string | null;

  addLine: (
    product: ProductWithOptions,
    optionIds: string[],
    quantity: number,
    note?: string | null,
  ) => void;
  setQuantity: (key: string, quantity: number) => void;
  incrementLine: (key: string) => void;
  decrementLine: (key: string) => void;
  removeLine: (key: string) => void;
  clear: () => void;

  setFulfillment: (fulfillment: FulfillmentType) => void;
  setAddressId: (addressId: UUID | null) => void;
  setPromoCode: (code: string | null) => void;
  setCustomerNote: (note: string | null) => void;
  setDeliveryNotes: (note: string | null) => void;
}

const initialState = {
  lines: [] as CartLine[],
  fulfillment: 'DELIVERY' as FulfillmentType,
  addressId: null as UUID | null,
  promoCode: null as string | null,
  customerNote: null as string | null,
  deliveryNotes: null as string | null,
};

/**
 * Stockage injectable. Par défaut : mémoire (tests, SSR) ;
 * `configureCartStorage` est appelé au boot de l'app mobile avec AsyncStorage.
 *
 * DOIT être déclaré AVANT le store : zustand évalue `createJSONStorage` dès la
 * création du store, et une référence en zone morte temporelle y laisserait un
 * storage `undefined` (crash au premier ajout au panier). Le store ne capture
 * d'ailleurs qu'un délégué : le swap vers AsyncStorage reste effectif même
 * après cette capture.
 */
interface KeyValueStorage {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
}

const memoryStore = new Map<string, string>();

let cartStorage: KeyValueStorage = {
  getItem: (key) => memoryStore.get(key) ?? null,
  setItem: (key, value) => void memoryStore.set(key, value),
  removeItem: (key) => void memoryStore.delete(key),
};

/** Délégué stable : chaque appel relit `cartStorage` au moment de l'opération. */
const delegatingStorage: KeyValueStorage = {
  getItem: (key) => cartStorage.getItem(key),
  setItem: (key, value) => cartStorage.setItem(key, value),
  removeItem: (key) => cartStorage.removeItem(key),
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      ...initialState,

      addLine: (product, optionIds, quantity, note) =>
        set((state) => {
          const selected = new Set(optionIds);
          const options: CartOptionSelection[] = product.option_groups.flatMap((group) =>
            group.options
              .filter((option) => selected.has(option.id))
              .map((option) => ({
                option_id: option.id,
                group_id: group.id,
                group_name: group.name,
                option_name: option.name,
                price_delta: option.price_delta,
              })),
          );

          const key = cartLineKey(product.id, optionIds, note);
          const existing = state.lines.find((line) => line.key === key);

          // Même produit, mêmes options : on incrémente au lieu d'empiler deux
          // lignes identiques dans le panier.
          if (existing) {
            return {
              lines: state.lines.map((line) =>
                line.key === key
                  ? { ...line, quantity: Math.min(99, line.quantity + quantity) }
                  : line,
              ),
            };
          }

          return {
            lines: [
              ...state.lines,
              {
                key,
                product_id: product.id,
                product_name: product.name,
                product_image: product.image_url,
                unit_price: product.base_price,
                quantity: Math.min(99, Math.max(1, quantity)),
                options,
                note: note ?? null,
              },
            ],
          };
        }),

      setQuantity: (key, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((line) => line.key !== key)
              : state.lines.map((line) =>
                  line.key === key ? { ...line, quantity: Math.min(99, quantity) } : line,
                ),
        })),

      incrementLine: (key) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            line.key === key ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line,
          ),
        })),

      decrementLine: (key) =>
        set((state) => ({
          lines: state.lines
            .map((line) => (line.key === key ? { ...line, quantity: line.quantity - 1 } : line))
            .filter((line) => line.quantity > 0),
        })),

      removeLine: (key) =>
        set((state) => ({ lines: state.lines.filter((line) => line.key !== key) })),

      clear: () => set({ ...initialState }),

      setFulfillment: (fulfillment) => set({ fulfillment }),
      setAddressId: (addressId) => set({ addressId }),
      setPromoCode: (promoCode) => set({ promoCode }),
      setCustomerNote: (customerNote) => set({ customerNote }),
      setDeliveryNotes: (deliveryNotes) => set({ deliveryNotes }),
    }),
    {
      name: 'istanbul.cart',
      version: 1,
      // Le stockage est injecté au démarrage par l'app (AsyncStorage en RN).
      storage: createJSONStorage(() => delegatingStorage),
      partialize: (state) => ({
        lines: state.lines,
        fulfillment: state.fulfillment,
        addressId: state.addressId,
        promoCode: state.promoCode,
      }),
    },
  ),
);

export function configureCartStorage(storage: KeyValueStorage): void {
  cartStorage = storage;
  void useCartStore.persist.rehydrate();
}

// ---------------------------------------------------------------------------
// Sélecteurs — à utiliser plutôt que de dériver dans les composants
// ---------------------------------------------------------------------------

export const selectSubtotal = (state: CartState): Cents => cartSubtotal(state.lines);
export const selectItemCount = (state: CartState): number => cartItemCount(state.lines);
export const selectIsEmpty = (state: CartState): boolean => state.lines.length === 0;
export const selectLineTotal = (key: string) => (state: CartState): Cents => {
  const line = state.lines.find((candidate) => candidate.key === key);
  return line ? lineTotal(line) : 0;
};

/** Quantité déjà au panier pour un produit, tous variants confondus. */
export const selectProductQuantity = (productId: UUID) => (state: CartState): number =>
  state.lines
    .filter((line) => line.product_id === productId)
    .reduce((sum, line) => sum + line.quantity, 0);

/** Conversion vers le format attendu par `fn_place_order`. */
export function toPlaceOrderItems(lines: CartLine[]) {
  return lines.map((line) => ({
    product_id: line.product_id,
    quantity: line.quantity,
    option_ids: line.options.map((option) => option.option_id),
    note: line.note,
  }));
}
