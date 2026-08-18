'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import {
  reorderCategories,
  toUserMessage,
  useAdminCategories,
  useDeleteCategory,
  useSaveCategory,
} from '@istanbul/core';
import type { Category } from '@istanbul/types';
import {
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
import { useRestaurantId } from '@/hooks/useRestaurantId';

/**
 * Catégories.
 *
 * L'ordre d'affichage compte : c'est lui qui décide de ce que le client voit
 * en premier dans l'app. Réorganisation par flèches — plus fiable qu'un
 * glisser-déposer sur un écran tactile de caisse.
 */
export default function CategoriesPage() {
  const restaurantId = useRestaurantId();
  const categories = useAdminCategories(restaurantId);
  const saveCategory = useSaveCategory();
  const deleteCategory = useDeleteCategory();

  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = categories.data ?? [];

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;

    const reordered = [...list];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved!);

    setError(null);
    try {
      await reorderCategories(
        reordered.map((category, position) => ({ id: category.id, sort_order: position + 1 })),
      );
      void categories.refetch();
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Catégories"
        description="L’ordre ci-dessous est celui affiché dans l’application client."
        action={
          <Button onClick={() => setEditing({ restaurant_id: restaurantId })}>
            <Plus size={16} weight="bold" />
            Nouvelle catégorie
          </Button>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}
        >
          {error}
        </div>
      ) : null}

      <Card padded={false} className="px-5 pb-2 pt-4">
        {categories.isLoading ? (
          <TableSkeleton rows={5} />
        ) : categories.isError ? (
          <ErrorState onRetry={() => void categories.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            title="Aucune catégorie"
            description="Créez « Shawarma », « Burgers », « Boissons »… pour organiser votre menu."
            action={
              <Button onClick={() => setEditing({ restaurant_id: restaurantId })}>
                Créer une catégorie
              </Button>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Ordre</Th>
                <Th>Nom</Th>
                <Th>Identifiant</Th>
                <Th>Visible</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((category, index) => (
                <tr key={category.id}>
                  <Td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => void move(index, -1)}
                        disabled={index === 0}
                        aria-label={`Monter ${category.name}`}
                        className="rounded-lg p-1.5 disabled:opacity-30"
                        style={{ background: 'var(--color-surface-sunken)' }}
                      >
                        <ArrowUp size={14} weight="bold" />
                      </button>
                      <button
                        onClick={() => void move(index, 1)}
                        disabled={index === list.length - 1}
                        aria-label={`Descendre ${category.name}`}
                        className="rounded-lg p-1.5 disabled:opacity-30"
                        style={{ background: 'var(--color-surface-sunken)' }}
                      >
                        <ArrowDown size={14} weight="bold" />
                      </button>
                    </div>
                  </Td>

                  <Td>
                    <span className="font-medium">{category.name}</span>
                    {category.description ? (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {category.description}
                      </p>
                    ) : null}
                  </Td>

                  <Td>
                    <code className="text-xs text-[var(--color-text-muted)]">{category.slug}</code>
                  </Td>

                  <Td>
                    <Toggle
                      checked={category.is_active}
                      onChange={(value) =>
                        saveCategory.mutate({
                          id: category.id,
                          restaurant_id: restaurantId,
                          name: category.name,
                          is_active: value,
                        })
                      }
                      label={`Visibilité de ${category.name}`}
                    />
                  </Td>

                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(category)}>
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Supprimer"
                        onClick={() => {
                          if (
                            confirm(
                              `Supprimer « ${category.name} » ? Les produits associés perdront leur catégorie.`,
                            )
                          ) {
                            deleteCategory.mutate(category.id);
                          }
                        }}
                      >
                        <Trash size={16} color="var(--color-danger)" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <CategoryModal category={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function CategoryModal({
  category,
  onClose,
}: {
  category: Partial<Category> | null;
  onClose: () => void;
}) {
  const restaurantId = useRestaurantId();
  const saveCategory = useSaveCategory();
  const [form, setForm] = useState<Partial<Category>>(category ?? {});
  const [error, setError] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | undefined>(category?.id);

  if (category && category.id !== lastId) {
    setLastId(category.id);
    setForm(category);
  }

  if (!category) return null;

  const submit = async () => {
    if (!form.name?.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }

    setError(null);
    try {
      await saveCategory.mutateAsync({
        ...form,
        id: form.id,
        restaurant_id: restaurantId,
        name: form.name.trim(),
      });
      onClose();
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={form.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saveCategory.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nom" required>
          <input
            className={inputClass}
            value={form.name ?? ''}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Shawarma"
          />
        </Field>

        <Field label="Description">
          <input
            className={inputClass}
            value={form.description ?? ''}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>

        <Field label="URL de l’image">
          <input
            className={inputClass}
            value={form.image_url ?? ''}
            onChange={(event) => setForm({ ...form, image_url: event.target.value })}
          />
        </Field>

        <Field label="Icône Phosphor" hint="Ex. Wrap, Hamburger, Pizza, Martini.">
          <input
            className={inputClass}
            value={form.icon ?? ''}
            onChange={(event) => setForm({ ...form, icon: event.target.value })}
          />
        </Field>

        {error ? (
          <div
            role="alert"
            className="rounded-xl px-3.5 py-2.5 text-sm"
            style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}
          >
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
