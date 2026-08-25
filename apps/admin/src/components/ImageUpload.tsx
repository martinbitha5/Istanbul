'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Image as ImageIcon, Trash, UploadSimple } from '@phosphor-icons/react';
import { toUserMessage } from '@istanbul/core';
import { getBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';

/**
 * Upload d'image produit vers Supabase Storage.
 *
 * L'image est recompressée dans le navigateur avant l'envoi :
 * redimensionnée à 1200 px max et convertie en WebP (~80 %). Une photo de
 * téléphone de 4 Mo devient ~120 Ko — c'est ce que téléchargeront des
 * centaines de clients sur un réseau mobile facturé au Mo.
 */

const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 0.82;

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY),
  );
  if (!blob) throw new Error('Compression impossible dans ce navigateur.');
  return blob;
}

/**
 * Cadre de l'aperçu.
 *
 * Il vaut la peine de le régler : le gérant juge la photo qu'il vient de
 * choisir sur cette vignette, et une image ronde jugée dans un carré se
 * révèle mal cadrée seulement une fois publiée. Chaque forme reprend celle du
 * rendu final — pastille ronde pour une catégorie, bandeau pour une
 * couverture.
 */
const SHAPES = {
  square: { width: 72, height: 72, radius: 12 },
  round: { width: 72, height: 72, radius: 999 },
  wide: { width: 160, height: 90, radius: 12 },
} as const;

export function ImageUpload({
  value,
  onChange,
  bucket = 'product-images',
  folder = 'products',
  shape = 'square',
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  shape?: keyof typeof SHAPES;
}) {
  const frame = SHAPES[shape];
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const blob = await compressImage(file);
      const path = `${folder}/${crypto.randomUUID()}.webp`;

      const supabase = getBrowserClient();
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, blob, {
        contentType: 'image/webp',
        cacheControl: '31536000', // un an : le nom de fichier est unique
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-4">
      {value ? (
        <Image
          src={value}
          alt=""
          width={frame.width}
          height={frame.height}
          className="shrink-0 object-cover"
          style={{ height: frame.height, width: frame.width, borderRadius: frame.radius }}
        />
      ) : (
        <div
          className="flex shrink-0 items-center justify-center"
          style={{
            height: frame.height,
            width: frame.width,
            borderRadius: frame.radius,
            background: 'var(--color-surface-sunken)',
          }}
        >
          <ImageIcon size={24} color="var(--color-text-muted)" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <UploadSimple size={16} weight="bold" />
            {value ? "Remplacer l'image" : 'Choisir une image'}
          </Button>

          {value && !uploading ? (
            <Button size="sm" variant="ghost" title="Retirer l’image" onClick={() => onChange(null)}>
              <Trash size={16} color="var(--color-danger)" />
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-[var(--color-text-muted)]">
          JPG, PNG ou WebP — recompressée automatiquement avant l’envoi.
        </p>

        {error ? (
          <p role="alert" className="text-xs" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
