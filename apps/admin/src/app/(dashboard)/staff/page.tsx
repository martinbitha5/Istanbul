'use client';

import { useState } from 'react';
import { Info, UserPlus } from '@phosphor-icons/react';
import {
  formatPhone,
  formatRelative,
  toUserMessage,
  useAddRestaurantMember,
  useRemoveRestaurantMember,
  useRestaurantMembers,
  useSetMemberRole,
} from '@istanbul/core';
import {
  RestaurantRole,
  restaurantRoleDescription,
  restaurantRoleLabel,
  restaurantRoleTone,
  type RestaurantMember,
} from '@istanbul/types';
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
  inputClass,
} from '@/components/ui';
import { Alert } from '@/components/Alert';
import { Avatar } from '@/components/Avatar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toaster';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { useRestaurantContext } from '@/providers/RestaurantProvider';

const ROLES: RestaurantRole[] = [RestaurantRole.OWNER, RestaurantRole.MANAGER, RestaurantRole.STAFF];

/**
 * Équipe de l'établissement.
 *
 * C'est la page qui rend le multi-restaurants réel côté humain : chaque
 * partenaire recrute, promeut et retire ses propres gens, sans passer par la
 * plateforme et sans jamais voir les équipes des autres (RLS, migration 21).
 *
 * On ne crée pas le compte depuis ici. Le faire supposerait la clé
 * `service_role` dans le navigateur — c'est-à-dire un dashboard capable de
 * créer des comptes administrateur à partir d'une console JavaScript. La
 * personne s'inscrit depuis l'app, le propriétaire la rattache par e-mail.
 */
export default function StaffPage() {
  const restaurantId = useRestaurantId();
  const { restaurant, access } = useRestaurantContext();
  const members = useRestaurantMembers(restaurantId);
  const [inviteOpen, setInviteOpen] = useState(false);

  const owners = (members.data ?? []).filter((member) => member.role === 'OWNER').length;

  if (!access.admin) {
    return (
      <EmptyState
        title="Réservé au propriétaire"
        description="Seul le propriétaire de l’établissement gère l’équipe. Demandez-lui un accès si vous devez ajouter quelqu’un."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        as="h1"
        title="Équipe"
        description={`Qui peut administrer ${restaurant?.name ?? 'cet établissement'}, et jusqu’où.`}
        action={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus size={18} aria-hidden />
            Ajouter un membre
          </Button>
        }
      />

      <RoleLegend />

      <Card padded={false} className="px-5 pb-2 pt-4">
        {members.isLoading ? (
          <TableSkeleton rows={4} />
        ) : members.isError ? (
          <ErrorState
            message={toUserMessage(members.error)}
            onRetry={() => void members.refetch()}
          />
        ) : (members.data ?? []).length === 0 ? (
          <EmptyState
            title="Aucun membre"
            description="Ajoutez la personne qui tient la caisse : elle verra les commandes arriver en temps réel."
            action={<Button onClick={() => setInviteOpen(true)}>Ajouter un membre</Button>}
          />
        ) : (
          <Table responsive ariaLabel="Membres de l’équipe">
            <thead>
              <tr>
                <Th>Membre</Th>
                <Th>Contact</Th>
                <Th>Rôle</Th>
                <Th>Depuis</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {(members.data ?? []).map((member) => (
                <MemberRow
                  key={member.profile_id}
                  member={member}
                  restaurantId={restaurantId}
                  isLastOwner={member.role === 'OWNER' && owners <= 1}
                />
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        restaurantId={restaurantId}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Légende des rôles.
 *
 * Trois mots — Propriétaire, Gérant, Équipe — ne disent pas d'eux-mêmes qui
 * peut toucher aux prix. La légende évite le réflexe « dans le doute, je le
 * mets propriétaire », qui est exactement la mauvaise réponse.
 */
function RoleLegend() {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <Info size={20} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
        <dl className="grid flex-1 gap-3 sm:grid-cols-3">
          {ROLES.map((role) => (
            <div key={role}>
              <dt className="mb-1">
                <Badge tone={restaurantRoleTone[role]}>{restaurantRoleLabel[role]}</Badge>
              </dt>
              <dd className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                {restaurantRoleDescription[role]}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function MemberRow({
  member,
  restaurantId,
  isLastOwner,
}: {
  member: RestaurantMember;
  restaurantId: string;
  isLastOwner: boolean;
}) {
  const setRole = useSetMemberRole();
  const remove = useRemoveRestaurantMember();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const name = member.profile?.full_name?.trim() || member.profile?.email || 'Membre';

  const handleRole = (role: RestaurantRole) => {
    setRole.mutate(
      { restaurantId, profileId: member.profile_id, role },
      {
        onSuccess: () => toast.success(`${name} est maintenant ${restaurantRoleLabel[role]}.`),
        onError: (error) => toast.error(toUserMessage(error)),
      },
    );
  };

  return (
    <tr>
      <Td label="Membre">
        <div className="flex items-center gap-3">
          <Avatar name={name} />
          <div className="min-w-0">
            <p className="truncate font-medium">{name}</p>
            {member.job_title ? (
              <p className="truncate text-xs text-[var(--color-text-muted)]">{member.job_title}</p>
            ) : null}
          </div>
        </div>
      </Td>

      <Td label="Contact">
        <p className="truncate text-sm">{member.profile?.email ?? '—'}</p>
        {member.profile?.phone ? (
          <p className="tabular text-xs text-[var(--color-text-muted)]">
            {formatPhone(member.profile.phone)}
          </p>
        ) : null}
      </Td>

      <Td label="Rôle">
        {isLastOwner ? (
          // Le dernier propriétaire ne peut pas se rétrograder : personne ne
          // pourrait plus rattacher qui que ce soit. Le serveur refuse aussi,
          // mais un select désactivé explique *pourquoi* avant l'échec.
          <div className="flex items-center gap-2">
            <Badge tone={restaurantRoleTone.OWNER}>{restaurantRoleLabel.OWNER}</Badge>
            <span className="text-xs text-[var(--color-text-muted)]">dernier propriétaire</span>
          </div>
        ) : (
          <select
            className={`${inputClass} w-44`}
            value={member.role}
            onChange={(event) => handleRole(event.target.value as RestaurantRole)}
            disabled={setRole.isPending}
            aria-label={`Rôle de ${name}`}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {restaurantRoleLabel[role]}
              </option>
            ))}
          </select>
        )}
      </Td>

      <Td label="Depuis">
        <span className="text-sm text-[var(--color-text-secondary)]">
          {formatRelative(member.created_at)}
        </span>
      </Td>

      <Td label="Actions" align="right">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={isLastOwner}
          title={isLastOwner ? 'Un établissement doit garder un propriétaire.' : undefined}
          className="!text-[var(--color-danger)]"
        >
          Retirer
        </Button>

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={`Retirer ${name} de l’équipe ?`}
          message="Cette personne perd immédiatement l’accès au dashboard de cet établissement. Son compte client, ses commandes et son historique sont conservés."
          confirmLabel="Retirer"
          loading={remove.isPending}
          onConfirm={() =>
            remove.mutate(
              { restaurantId, profileId: member.profile_id },
              {
                onSuccess: () => {
                  toast.success(`${name} a été retiré de l’équipe.`);
                  setConfirmOpen(false);
                },
                onError: (error) => toast.error(toUserMessage(error)),
              },
            )
          }
        />
      </Td>
    </tr>
  );
}

// ---------------------------------------------------------------------------

function InviteModal({
  open,
  onClose,
  restaurantId,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
}) {
  const add = useAddRestaurantMember();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<RestaurantRole>(RestaurantRole.STAFF);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setEmail('');
    setJobTitle('');
    setRole(RestaurantRole.STAFF);
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Indiquez l’adresse e-mail du compte à rattacher.');
      return;
    }
    setError(null);

    add.mutate(
      { restaurantId, email: trimmed, role, jobTitle: jobTitle.trim() || null },
      {
        onSuccess: () => {
          toast.success('Membre ajouté.');
          close();
        },
        onError: (mutationError) => setError(toUserMessage(mutationError)),
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Ajouter un membre"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={add.isPending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} loading={add.isPending}>
            Ajouter
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert tone="warning">
          La personne doit déjà avoir un compte Istanbul, créé depuis l’app avec cette même
          adresse. Rien n’est envoyé par e-mail : le rattachement est immédiat.
        </Alert>

        {error ? <Alert>{error}</Alert> : null}

        <Field label="Adresse e-mail du compte" required>
          <input
            className={inputClass}
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="prenom@exemple.cd"
          />
        </Field>

        <Field label="Fonction" hint="Facultatif — « Caisse », « Chef de rang »…">
          <input
            className={inputClass}
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
          />
        </Field>

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
            Rôle
          </legend>
          <div className="space-y-2">
            {ROLES.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors duration-150 hover:bg-[var(--color-surface-sunken)]"
                style={{
                  borderColor:
                    role === option ? 'var(--color-primary)' : 'var(--color-border)',
                  background: role === option ? 'var(--color-primary-soft)' : undefined,
                }}
              >
                <input
                  type="radio"
                  name="member-role"
                  className="mt-0.5"
                  checked={role === option}
                  onChange={() => setRole(option)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{restaurantRoleLabel[option]}</span>
                  <span className="block text-xs leading-relaxed text-[var(--color-text-secondary)]">
                    {restaurantRoleDescription[option]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
