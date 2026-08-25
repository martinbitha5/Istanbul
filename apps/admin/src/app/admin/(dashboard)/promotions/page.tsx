'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import {
  formatDate,
  formatMoney,
  formatPercent,
  toUserMessage,
  useAdminPromotions,
  useDeletePromotion,
  useSavePromotion,
} from '@istanbul/core';
import type { Promotion, PromotionType } from '@istanbul/types';
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
import { ImageUpload } from '@/components/ImageUpload';
import { MoneyInput } from '@/components/MoneyInput';
import { useToast } from '@/components/Toaster';
import { useRestaurantId } from '@/hooks/useRestaurantId';

const TYPE_LABEL: Record<PromotionType, string> = {
  PERCENTAGE: 'Pourcentage',
  FIXED_AMOUNT: 'Montant fixe',
  FREE_DELIVERY: 'Livraison offerte',
};

/**
 * Promotions.
 *
 * Une promotion sans code est une bannière affichée sur l'accueil.
 * Une promotion avec code doit être saisie au checkout. Le pourcentage est
 * stocké en points de base (1500 = 15 %) pour éviter les flottants.
 */
export default function PromotionsPage() {
  const restaurantId = useRestaurantId();
  const promotions = useAdminPromotions(restaurantId);
  const savePromotion = useSavePromotion();
  const deletePromotion = useDeletePromotion();

  const [editing, setEditing] = useState<Partial<Promotion> | null>(null);
  const [deleting, setDeleting] = useState<Promotion | null>(null);

  const list = promotions.data ?? [];

  const describeValue = (promotion: Promotion) => {
    switch (promotion.type) {
      case 'PERCENTAGE':
        return formatPercent(promotion.value);
      case 'FIXED_AMOUNT':
        return formatMoney(promotion.value);
      case 'FREE_DELIVERY':
        return 'Livraison offerte';
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        as="h1"
        title="Promotions"
        description="Codes promo et bannières affichées dans l’application."
        action={
          <Button
            onClick={() =>
              setEditing({
                restaurant_id: restaurantId,
                type: 'PERCENTAGE',
                value: 1000,
                usage_limit_per_user: 1,
                is_active: true,
              })
            }
          >
            <Plus size={16} weight="bold" />
            Nouvelle promotion
          </Button>
        }
      />

      <Card padded={false} className="px-5 pb-2 pt-4">
        {promotions.isLoading ? (
          <TableSkeleton rows={4} />
        ) : promotions.isError ? (
          <ErrorState onRetry={() => void promotions.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            title="Aucune promotion"
            description="Créez un code de bienvenue pour convertir vos premiers visiteurs."
          />
        ) : (
          <Table ariaLabel="Liste des promotions">
            <thead>
              <tr>
                <Th>Promotion</Th>
                <Th>Code</Th>
                <Th>Type</Th>
                <Th align="right">Valeur</Th>
                <Th align="right">Utilisations</Th>
                <Th>Validité</Th>
                <Th>Active</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((promotion) => (
                <tr key={promotion.id}>
                  <Td>
                    <p className="font-medium">{promotion.title}</p>
                    {promotion.description ? (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {promotion.description}
                      </p>
                    ) : null}
                  </Td>

                  <Td>
                    {promotion.code ? (
                      <code
                        className="rounded-md px-2 py-1 text-xs font-semibold"
                        style={{
                          background: 'var(--color-primary-soft)',
                          color: 'var(--color-on-primary-soft)',
                        }}
                      >
                        {promotion.code}
                      </code>
                    ) : (
                      <Badge tone="info">Bannière</Badge>
                    )}
                  </Td>

                  <Td>
                    <span className="text-sm">{TYPE_LABEL[promotion.type]}</span>
                  </Td>

                  <Td align="right">
                    <span className="tabular font-semibold">{describeValue(promotion)}</span>
                  </Td>

                  <Td align="right">
                    <span className="tabular">
                      {promotion.usage_count}
                      {promotion.usage_limit ? ` / ${promotion.usage_limit}` : ''}
                    </span>
                  </Td>

                  <Td>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {promotion.ends_at
                        ? `Jusqu’au ${formatDate(promotion.ends_at)}`
                        : 'Sans limite'}
                    </span>
                  </Td>

                  <Td>
                    <Toggle
                      checked={promotion.is_active}
                      onChange={(value) =>
                        savePromotion.mutate({
                          id: promotion.id,
                          restaurant_id: restaurantId,
                          title: promotion.title,
                          type: promotion.type,
                          is_active: value,
                        })
                      }
                      label={`Activation de ${promotion.title}`}
                    />
                  </Td>

                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(promotion)}>
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        title="Supprimer"
                        onClick={() => setDeleting(promotion)}
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
      <PromotionModal
        key={editing?.id ?? 'new'}
        promotion={editing}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Supprimer la promotion"
        message={`Supprimer « ${deleting?.title ?? ''} » ? Les clients ne pourront plus utiliser ce code.`}
        confirmLabel="Supprimer"
        loading={deletePromotion.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deletePromotion.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}

function PromotionModal({
  promotion,
  onClose,
}: {
  promotion: Partial<Promotion> | null;
  onClose: () => void;
}) {
  const restaurantId = useRestaurantId();
  const savePromotion = useSavePromotion();
  const toast = useToast();
  const [form, setForm] = useState<Partial<Promotion>>(promotion ?? {});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; value?: string }>({});
  const alertRef = useRef<HTMLDivElement>(null);

  // Soumission échouée : focus sur l'alerte pour lecture immédiate.
  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  if (!promotion) return null;

  const isPercentage = form.type === 'PERCENTAGE';
  const isFreeDelivery = form.type === 'FREE_DELIVERY';

  const submit = async () => {
    const errors: { title?: string; value?: string } = {};
    if (!form.title?.trim()) errors.title = 'Le titre est obligatoire.';
    if (isPercentage && (form.value == null || form.value <= 0 || form.value > 10000)) {
      errors.value = 'Le pourcentage doit être compris entre 1 et 100.';
    }
    setFieldErrors(errors);
    if (errors.title || errors.value) return;

    setError(null);
    try {
      await savePromotion.mutateAsync({
        ...form,
        id: form.id,
        restaurant_id: restaurantId,
        title: form.title!.trim(),
        type: form.type ?? 'PERCENTAGE',
        value: isFreeDelivery ? 0 : (form.value ?? 0),
      });
      toast.success('Promotion enregistrée');
      onClose();
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={form.id ? 'Modifier la promotion' : 'Nouvelle promotion'}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={savePromotion.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titre" required error={fieldErrors.title}>
          <input
            className={inputClass}
            value={form.title ?? ''}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Bienvenue chez Istanbul"
          />
        </Field>

        <Field label="Code promo" hint="Laisser vide pour une bannière sans code.">
          <input
            className={inputClass}
            value={form.code ?? ''}
            onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
            placeholder="BIENVENUE"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Description">
            <input
              className={inputClass}
              value={form.description ?? ''}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="-20 % sur votre première commande"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            label="Visuel de la bannière"
            hint="Occupe le tiers droit de la carte promotionnelle sur la vitrine. Sans photo, la carte reste sur son aplat de couleur."
          >
            <ImageUpload
              value={form.image_url ?? null}
              onChange={(url) => setForm({ ...form, image_url: url })}
              folder="promotions"
              shape="wide"
            />
          </Field>
        </div>

        <Field label="Type">
          <select
            className={inputClass}
            value={form.type ?? 'PERCENTAGE'}
            onChange={(event) => setForm({ ...form, type: event.target.value as PromotionType })}
          >
            <option value="PERCENTAGE">Pourcentage</option>
            <option value="FIXED_AMOUNT">Montant fixe</option>
            <option value="FREE_DELIVERY">Livraison offerte</option>
          </select>
        </Field>

        {!isFreeDelivery ? (
          isPercentage ? (
            <Field
              label="Réduction (%)"
              required
              error={fieldErrors.value}
              hint="Stocké en points de base : 15 % → 1500."
            >
              {/* Le pourcentage n'est pas un montant : saisie entière 1-100,
                  convertie en points de base. */}
              <input
                className={inputClass}
                type="number"
                step="1"
                min="0"
                max="100"
                value={form.value != null ? form.value / 100 : ''}
                onChange={(event) =>
                  setForm({ ...form, value: Math.round(Number(event.target.value || 0) * 100) })
                }
              />
            </Field>
          ) : (
            <Field label="Réduction ($)" required error={fieldErrors.value}>
              <MoneyInput
                value={form.value}
                onChange={(cents) => setForm({ ...form, value: cents ?? 0 })}
              />
            </Field>
          )
        ) : null}

        <Field label="Commande minimum ($)">
          <MoneyInput
            value={form.min_order_amount}
            onChange={(cents) => setForm({ ...form, min_order_amount: cents ?? 0 })}
          />
        </Field>

        {isPercentage ? (
          <Field label="Plafond de réduction ($)" hint="Évite qu’un gros panier vide la caisse.">
            <MoneyInput
              value={form.max_discount_amount}
              onChange={(cents) => setForm({ ...form, max_discount_amount: cents })}
            />
          </Field>
        ) : null}

        <Field label="Date de fin">
          <input
            className={inputClass}
            type="date"
            value={form.ends_at ? form.ends_at.slice(0, 10) : ''}
            onChange={(event) =>
              setForm({
                ...form,
                ends_at: event.target.value ? new Date(event.target.value).toISOString() : null,
              })
            }
          />
        </Field>

        <Field label="Utilisations par client">
          <input
            className={inputClass}
            type="number"
            min="1"
            value={form.usage_limit_per_user ?? 1}
            onChange={(event) =>
              setForm({ ...form, usage_limit_per_user: Number(event.target.value) })
            }
          />
        </Field>

        <Field label="Limite globale" hint="Laisser vide pour illimité.">
          <input
            className={inputClass}
            type="number"
            min="1"
            value={form.usage_limit ?? ''}
            onChange={(event) =>
              setForm({
                ...form,
                usage_limit: event.target.value ? Number(event.target.value) : null,
              })
            }
          />
        </Field>

        <div className="flex items-center gap-2 sm:col-span-2">
          <Toggle
            checked={form.first_order_only ?? false}
            onChange={(value) => setForm({ ...form, first_order_only: value })}
            label="Réservé à la première commande"
          />
          <span className="text-sm">Réservé à la première commande</span>
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
