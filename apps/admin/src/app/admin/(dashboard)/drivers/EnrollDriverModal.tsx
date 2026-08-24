'use client';

import { useState } from 'react';
import {
  findProfileByContact,
  isValidEmail,
  toUserMessage,
  useCreateDriver,
  vehicleLabel,
} from '@istanbul/core';
import type { VehicleType } from '@istanbul/types';
import { Alert } from '@/components/Alert';
import { Button, Field, inputClass, Modal } from '@/components/ui';
import { useToast } from '@/components/Toaster';

/**
 * Enrôlement d'un livreur.
 *
 * Le livreur ne s'inscrit pas lui-même : l'app livreur n'a volontairement pas
 * d'écran d'inscription (« enrôlé par le restaurant, pas en libre-service »).
 * C'est donc ici que tout se passe, et l'écran couvre les deux situations sans
 * que le gérant ait à savoir laquelle s'applique :
 *
 *   — la personne a déjà un compte Istanbul, parce qu'elle a commandé comme
 *     cliente : on rattache ce compte, elle garde ses identifiants ;
 *   — elle n'en a pas : la route serveur lui en crée un et renvoie un mot de
 *     passe temporaire à lui transmettre.
 *
 * Un seul formulaire dans les deux cas. Chercher avant de créer n'est pas une
 * optimisation : `signUp` sur une adresse déjà prise échoue, et le gérant n'a
 * aucun moyen de deviner si son livreur a commandé chez lui un jour.
 */
export function EnrollDriverModal({
  open,
  onClose,
  restaurantId,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
}) {
  const create = useCreateDriver();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vehicle, setVehicle] = useState<VehicleType>('MOTORCYCLE');
  const [plate, setPlate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Identifiants à dicter au livreur : affichés une fois, stockés nulle part.
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const close = () => {
    setFullName('');
    setPhone('');
    setEmail('');
    setVehicle('MOTORCYCLE');
    setPlate('');
    setError(null);
    setCredentials(null);
    onClose();
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();

    if (!trimmedName) {
      setError('Indiquez le nom du livreur.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError('Indiquez une adresse e-mail valide : c’est son identifiant de connexion.');
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const existing = await findProfileByContact(trimmedEmail);
      let profileId = existing?.id ?? null;
      let issued: { email: string; password: string } | null = null;

      if (!profileId) {
        const response = await fetch('/api/drivers/account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: trimmedEmail,
            fullName: trimmedName,
            phone: phone.trim(),
          }),
        });
        const payload = await response.json();

        if (!response.ok) {
          setError(payload.error ?? 'Le compte n’a pas pu être créé.');
          return;
        }

        profileId = payload.profileId as string;
        issued = { email: payload.email as string, password: payload.password as string };
      }

      await create.mutateAsync({ profileId, restaurantId, vehicle, plateNumber: plate });

      if (issued) {
        // Le mot de passe ne se retrouve pas : la fenêtre reste ouverte tant
        // que le gérant ne l'a pas transmis.
        setCredentials(issued);
        toast.success('Livreur enrôlé. Transmettez-lui ses identifiants.');
      } else {
        toast.success(
          `${existing?.full_name || trimmedName} a été ajouté à l’équipe de livraison.`,
        );
        close();
      }
    } catch (submitError) {
      setError(toUserMessage(submitError));
    } finally {
      setBusy(false);
    }
  };

  if (credentials) {
    return (
      <Modal
        open={open}
        onClose={close}
        title="Livreur enrôlé"
        footer={<Button onClick={close}>J’ai transmis les identifiants</Button>}
      >
        <div className="space-y-4">
          <Alert tone="warning">
            Ce mot de passe ne sera plus affiché. Notez-le ou dictez-le au livreur maintenant.
          </Alert>

          <div className="rounded-xl border p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Identifiant
            </p>
            <p className="mt-1 text-sm font-medium">{credentials.email}</p>

            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Mot de passe temporaire
            </p>
            {/* `select-all` : un tap suffit à tout sélectionner pour le coller
                dans WhatsApp, ce que le gérant fera neuf fois sur dix. */}
            <p className="tabular mt-1 select-all text-lg font-bold tracking-wider">
              {credentials.password}
            </p>
          </div>

          <p className="text-sm text-[var(--color-text-secondary)]">
            Il se connecte avec ces identifiants sur l’application livreur, puis change son mot de
            passe depuis son profil.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Ajouter un livreur"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={() => void handleSubmit()} loading={busy}>
            Enrôler
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}

        <Field label="Nom complet" required>
          <input
            className={inputClass}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Jean Mobutu"
          />
        </Field>

        <Field
          label="Adresse e-mail"
          required
          hint="C’est son identifiant de connexion à l’application livreur."
        >
          <input
            className={inputClass}
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="jean@exemple.cd"
          />
        </Field>

        <Field label="Téléphone" hint="Pour l’appeler depuis la fiche livreur et la commande.">
          <input
            className={inputClass}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+243 89 000 00 01"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Véhicule">
            <select
              className={inputClass}
              value={vehicle}
              onChange={(event) => setVehicle(event.target.value as VehicleType)}
            >
              {(['MOTORCYCLE', 'BICYCLE', 'CAR', 'ON_FOOT'] as VehicleType[]).map((value) => (
                <option key={value} value={value}>
                  {vehicleLabel[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Plaque" hint="Facultatif.">
            <input
              className={inputClass}
              value={plate}
              onChange={(event) => setPlate(event.target.value)}
              placeholder="KN 4821 AB"
            />
          </Field>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)]">
          Le livreur est approuvé d’office : il verra les courses dès sa première connexion. Vous
          pouvez le suspendre à tout moment depuis le tableau.
        </p>
      </div>
    </Modal>
  );
}
