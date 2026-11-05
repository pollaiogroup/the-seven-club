'use client';
import { browserClient } from '@/lib/supabase/client';

export type Uploaded = { path: string; width: number; height: number };

/** Redimensiona no aparelho, converte para WebP (JPEG se o navegador não suportar) e remove metadados EXIF, inclusive localização. */
export async function prepareImage(file: File, maxSide = 1600, quality = 0.82): Promise<{ blob: Blob; width: number; height: number; ext: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions).catch(async () => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    return img as unknown as ImageBitmap;
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  let blob = await toBlob('image/webp');
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob('image/jpeg');
    ext = 'jpg';
  }
  if (!blob) throw new Error('Não foi possível processar a imagem.');
  return { blob, width, height, ext };
}

export async function uploadImage(file: File, userId: string, bucket: 'media' | 'private' = 'media', maxSide = 1600): Promise<Uploaded> {
  if (!file.type.startsWith('image/')) throw new Error('Envie apenas imagens.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Imagem muito grande.');
  const { blob, width, height, ext } = await prepareImage(file, maxSide);
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await browserClient().storage.from(bucket).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (error) throw new Error('Falha no envio da imagem. Verifique a conexão.');
  return { path, width, height };
}
