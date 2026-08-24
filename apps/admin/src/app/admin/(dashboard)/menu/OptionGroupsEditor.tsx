'use client';

import { useState } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import {
  formatMoney,
  toUserMessage,
  useDeleteOption,
  useDeleteOptionGroup,
  useProductOptionGroups,
  useSaveOption,
  useSaveOptionGroup,
} from '@istanbul/core';
import type { ProductOptionGroup } from '@istanbul/types';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  TableSkeleton,
  Toggle,
  inputClass,
} from '@/components/ui';
import { Alert } from '@/components/Alert';
import { ConfirmDialog } from '@/components/ConfirmDialog';

/**
 * Éditeur de groupes d'options.
 *
 * Un groupe SINGLE ne peut pas avoir max_select > 1 : la contrainte existe
 * aussi en base (`option_group_single_max`), on l'applique ici pour que le
 * formulaire ne propose jamais une combinaison qui sera rejetée.
 */
export function OptionGroupsEditor({ productId }: { productId: string }) {
  const groups = useProductOptionGroups(productId);
  const saveGroup = useSaveOptionGroup();
  const deleteGroup = useDeleteOptionGroup();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ProductOptionGroup | null>(null);

  const addGroup = async () => {
    setError(null);
    try {
      await saveGroup.mutateAsync({
        product_id: productId,
        name: 'Nouveau groupe',
        selection_type: 'SINGLE',
        is_required: false,
        min_select: 0,
        max_select: 1,
        sort_order: (groups.data?.length ?? 0) + 1,
      });
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  if (groups.isLoading) return <TableSkeleton rows={3} />;

  return (
    <div className="space-y-5">
      {error ? <Alert>{error}</Alert> : null}

      {(groups.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="Aucun groupe d’options"
          description="Ajoutez « Taille », « Sauce » ou « Suppléments » pour permettre la personnalisation."
          action={<Button onClick={addGroup}>Créer un groupe</Button>}
        />
      ) : (
        <>
          {groups.data!.map((group) => (
            <GroupCard key={group.id} group={group} onDelete={() => setDeleting(group)} />
          ))}

          <Button variant="secondary" onClick={addGroup} loading={saveGroup.isPending}>
            <Plus size={16} weight="bold" />
            Ajouter un groupe
          </Button>
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Supprimer le groupe d’options"
        message={`Supprimer le groupe « ${deleting?.name ?? '' } » et toutes ses options ?`}
        confirmLabel="Supprimer"
        loading={deleteGroup.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteGroup.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}

function GroupCard({ group, onDelete }: { group: ProductOptionGroup; onDelete: () => void }) {
  const saveGroup = useSaveOptionGroup();
  const saveOption = useSaveOption();
  const deleteOption = useDeleteOption();

  const [draft, setDraft] = useState(group);

  const persist = (patch: Partial<ProductOptionGroup>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    saveGroup.mutate({
      id: group.id,
      product_id: group.product_id,
      name: next.name,
      selection_type: next.selection_type,
      is_required: next.is_required,
      min_select: next.min_select,
      // Un groupe SINGLE est forcé à 1 : la base le rejetterait sinon.
      max_select: next.selection_type === 'SINGLE' ? 1 : next.max_select,
      sort_order: next.sort_order,
    });
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Field label="Nom du groupe">
            <input
              className={inputClass}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              onBlur={() => persist({ name: draft.name })}
            />
          </Field>
        </div>

        <Field label="Type de choix">
          <select
            className={inputClass}
            value={draft.selection_type}
            onChange={(event) =>
              persist({ selection_type: event.target.value as 'SINGLE' | 'MULTIPLE' })
            }
          >
            <option value="SINGLE">Un seul choix</option>
            <option value="MULTIPLE">Plusieurs choix</option>
          </select>
        </Field>

        {draft.selection_type === 'MULTIPLE' ? (
          <Field label="Maximum">
            <input
              className={inputClass}
              type="number"
              min={1}
              value={draft.max_select}
              onChange={(event) => setDraft({ ...draft, max_select: Number(event.target.value) })}
              onBlur={() => persist({ max_select: draft.max_select })}
            />
          </Field>
        ) : (
          <div className="flex items-end pb-2.5">
            <label className="flex items-center gap-2 text-sm">
              <Toggle
                checked={draft.is_required}
                onChange={(value) => persist({ is_required: value, min_select: value ? 1 : 0 })}
                label="Obligatoire"
              />
              Obligatoire
            </label>
          </div>
        )}
      </div>

      {/* --- Options ---------------------------------------------------- */}
      <div className="mt-4 space-y-2">
        {group.options.map((option) => (
          <div
            key={option.id}
            className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--color-surface-sunken)] p-2.5"
          >
            <input
              className={`${inputClass} flex-1 min-w-40`}
              defaultValue={option.name}
              onBlur={(event) =>
                saveOption.mutate({
                  id: option.id,
                  group_id: group.id,
                  name: event.target.value,
                })
              }
              aria-label="Nom de l’option"
            />

            <input
              className={`${inputClass} w-32`}
              type="number"
              step="0.01"
              defaultValue={option.price_delta / 100}
              onBlur={(event) =>
                saveOption.mutate({
                  id: option.id,
                  group_id: group.id,
                  name: option.name,
                  price_delta: Math.round(Number(event.target.value || 0) * 100),
                })
              }
              aria-label="Supplément en dollars"
            />

            {option.is_default ? <Badge tone="info">Par défaut</Badge> : null}

            <Button
              size="sm"
              variant="danger"
              title="Supprimer l’option"
              onClick={() => deleteOption.mutate(option.id)}
            >
              <Trash size={15} />
            </Button>
          </div>
        ))}

        <div className="flex items-center justify-between pt-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              saveOption.mutate({
                group_id: group.id,
                name: 'Nouvelle option',
                price_delta: 0,
                sort_order: group.options.length + 1,
              })
            }
          >
            <Plus size={14} weight="bold" />
            Ajouter une option
          </Button>

          <Button size="sm" variant="ghost" onClick={onDelete}>
            Supprimer le groupe
          </Button>
        </div>
      </div>

      {group.options.length > 0 ? (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Suppléments : {group.options.map((option) => formatMoney(option.price_delta)).join(' · ')}
        </p>
      ) : null}
    </div>
  );
}
