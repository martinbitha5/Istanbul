'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Plus, Trash } from '@phosphor-icons/react';
import {
  formatMoney,
  toUserMessage,
  useAdminCategories,
  useAdminProducts,
  useDeleteProduct,
  useSaveProduct,
  useToggleProductActive,
  useToggleProductAvailability,
} from '@istanbul/core';
import type { Product } from '@istanbul/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  SectionTitle,
  Table,
  TableSkeleton,
  Td,
  Th,
  Toggle,
  inputClass,
} from '@/components/ui';
import { Alert } from '@/components/Alert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FilterChips } from '@/components/FilterChips';
import { MoneyInput } from '@/components/MoneyInput';
import { ImageUpload } from '@/components/ImageUpload';
import { useToast } from '@/components/Toaster';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { OptionGroupsEditor } from './OptionGroupsEditor';

/**
 * Gestion du menu.
 *
 * Deux interrupteurs volontairement distincts :
 *   « Disponible » → rupture du jour, un tap, réversible en dix secondes.
 *   « Actif »      → le produit n'est plus au menu du tout.
 * Les confondre ferait disparaître un plat du menu pour une simple rupture.
 */
export default function MenuPage() {
  const restaurantId = useRestaurantId();
  const products = useAdminProducts(restaurantId);
  const categories = useAdminCategories(restaurantId);

  const toggleAvailability = useToggleProductAvailability();
  const toggleActive = useToggleProductActive();
  const deleteProduct = useDeleteProduct();

  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [optionsFor, setOptionsFor] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const categoryName = useMemo(() => {
    const map = new Map<string, string>();
    (categories.data ?? []).forEach((category) => map.set(category.id, category.name));
    return map;
  }, [categories.data]);

  const filterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'Toutes' },
      ...(categories.data ?? []).map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    [categories.data],
  );

  const filtered = useMemo(() => {
    const all = products.data ?? [];
    return categoryFilter === 'ALL'
      ? all
      : all.filter((product) => product.category_id === categoryFilter);
  }, [products.data, categoryFilter]);

  return (
    <div className="space-y-6">
      <SectionTitle
        as="h1"
        title="Menu"
        description={`${products.data?.length ?? 0} produits`}
        action={
          <Button onClick={() => setEditing({ restaurant_id: restaurantId })}>
            <Plus size={16} weight="bold" />
            Nouveau produit
          </Button>
        }
      />

      <FilterChips
        options={filterOptions}
        value={categoryFilter}
        onChange={setCategoryFilter}
        label="Filtrer par catégorie"
      />

      <Card padded={false} className="px-5 pb-2 pt-4">
        {products.isLoading ? (
          <TableSkeleton rows={6} />
        ) : products.isError ? (
          <ErrorState onRetry={() => void products.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Aucun produit"
            description="Ajoutez votre premier plat pour qu’il apparaisse dans l’application."
            action={
              <Button onClick={() => setEditing({ restaurant_id: restaurantId })}>
                Créer un produit
              </Button>
            }
          />
        ) : (
          <Table ariaLabel="Liste des produits du menu">
            <thead>
              <tr>
                <Th>Produit</Th>
                <Th>Catégorie</Th>
                <Th align="right">Prix</Th>
                <Th>Disponible</Th>
                <Th>Au menu</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt=""
                          width={44}
                          height={44}
                          className="h-11 w-11 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-lg bg-[var(--color-surface-sunken)]" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{product.name}</p>
                        <div className="mt-0.5 flex gap-1">
                          {product.is_popular ? <Badge tone="warning">Populaire</Badge> : null}
                          {product.is_recommended ? <Badge tone="info">Recommandé</Badge> : null}
                        </div>
                      </div>
                    </div>
                  </Td>

                  <Td>
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {product.category_id ? categoryName.get(product.category_id) : '—'}
                    </span>
                  </Td>

                  <Td align="right">
                    <span className="tabular font-semibold">{formatMoney(product.base_price)}</span>
                  </Td>

                  <Td>
                    <Toggle
                      checked={product.is_available}
                      onChange={(value) =>
                        toggleAvailability.mutate({ productId: product.id, isAvailable: value })
                      }
                      label={`Disponibilité de ${product.name}`}
                    />
                  </Td>

                  <Td>
                    <Toggle
                      checked={product.is_active}
                      onChange={(value) =>
                        toggleActive.mutate({ productId: product.id, isActive: value })
                      }
                      label={`Présence au menu de ${product.name}`}
                    />
                  </Td>

                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setOptionsFor(product)}>
                        Options
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(product)}>
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        title="Supprimer"
                        onClick={() => setDeleting(product)}
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* key : remonte le formulaire quand la cible change — remplace
          l'ancien hack lastId (setState pendant le rendu). */}
      <ProductModal
        key={editing?.id ?? 'new'}
        product={editing}
        categories={categories.data ?? []}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Supprimer le produit"
        message={`Supprimer « ${deleting?.name ?? ''} » ? Les commandes passées conservent leur historique.`}
        confirmLabel="Supprimer"
        loading={deleteProduct.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteProduct.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />

      {optionsFor ? (
        <Modal
          open
          onClose={() => setOptionsFor(null)}
          title={`Options — ${optionsFor.name}`}
          wide
        >
          <OptionGroupsEditor productId={optionsFor.id} />
        </Modal>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ProductModal({
  product,
  categories,
  onClose,
}: {
  product: Partial<Product> | null;
  categories: { id: string; name: string }[];
  onClose: () => void;
}) {
  const restaurantId = useRestaurantId();
  const saveProduct = useSaveProduct();
  const toast = useToast();
  const [form, setForm] = useState<Partial<Product>>(product ?? {});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; base_price?: string }>({});
  const alertRef = useRef<HTMLDivElement>(null);

  // Soumission échouée côté serveur : le focus rejoint l'alerte pour que
  // l'erreur soit lue immédiatement (l'alerte est en bas de la modale).
  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  if (!product) return null;

  const set = <K extends keyof Product>(key: K, value: Product[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const errors: { name?: string; base_price?: string } = {};
    if (!form.name?.trim()) errors.name = 'Le nom du produit est obligatoire.';
    if (form.base_price == null || form.base_price < 0) errors.base_price = 'Indiquez un prix valide.';
    setFieldErrors(errors);
    if (errors.name || errors.base_price) return;

    setError(null);
    try {
      await saveProduct.mutateAsync({
        ...form,
        id: form.id,
        restaurant_id: restaurantId,
        name: form.name!.trim(),
        base_price: form.base_price!,
      });
      toast.success('Produit enregistré');
      onClose();
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={form.id ? 'Modifier le produit' : 'Nouveau produit'}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saveProduct.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" required error={fieldErrors.name}>
          <input
            className={inputClass}
            value={form.name ?? ''}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Shawarma Poulet"
          />
        </Field>

        <Field label="Catégorie">
          <select
            className={inputClass}
            value={form.category_id ?? ''}
            onChange={(event) => set('category_id', event.target.value || null)}
          >
            <option value="">Sans catégorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2">
          <Field label="Description" hint="Deux lignes maximum s’affichent dans l’application.">
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              value={form.description ?? ''}
              onChange={(event) => set('description', event.target.value)}
              placeholder="Poulet mariné 24 h, grillé à la broche…"
            />
          </Field>
        </div>

        <Field label="Prix (en $)" required error={fieldErrors.base_price}>
          <MoneyInput
            value={form.base_price}
            // Champ vidé → undefined : la validation de submit le signalera.
            onChange={(cents) =>
              setForm((current) => ({ ...current, base_price: cents ?? undefined }))
            }
          />
        </Field>

        <Field label="Prix barré (en $)" hint="Laisser vide s’il n’y a pas de promotion.">
          <MoneyInput
            value={form.compare_at_price}
            onChange={(cents) => set('compare_at_price', cents)}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="Photo du produit"
            hint="Compressée et envoyée vers Supabase Storage automatiquement."
          >
            <ImageUpload
              value={form.image_url ?? null}
              onChange={(url) => set('image_url', url)}
            />
          </Field>
        </div>

        <Field label="Temps de préparation (min)">
          <input
            className={inputClass}
            type="number"
            min="0"
            value={form.prep_minutes ?? 10}
            onChange={(event) => set('prep_minutes', Number(event.target.value))}
          />
        </Field>

        <Field label="Niveau de piment" hint="0 = doux, 3 = très épicé.">
          <input
            className={inputClass}
            type="number"
            min="0"
            max="3"
            value={form.spicy_level ?? 0}
            onChange={(event) => set('spicy_level', Number(event.target.value) as 0 | 1 | 2 | 3)}
          />
        </Field>

        <div className="flex flex-wrap gap-6 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <Toggle
              checked={form.is_popular ?? false}
              onChange={(value) => set('is_popular', value)}
              label="Populaire"
            />
            Mettre en avant comme « Populaire »
          </label>

          <label className="flex items-center gap-2 text-sm">
            <Toggle
              checked={form.is_recommended ?? false}
              onChange={(value) => set('is_recommended', value)}
              label="Recommandé"
            />
            Afficher dans « Nos recommandations »
          </label>
        </div>
      </div>

      {error ? (
        <Alert ref={alertRef} className="mt-4">
          {error}
        </Alert>
      ) : null}
    </Modal>
  );
}
