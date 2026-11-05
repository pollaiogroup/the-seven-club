import { SUPABASE_URL } from '@/lib/env';

/** URL pública de um arquivo do bucket "media". */
export function mediaUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** O caminho pertence à pasta da integrante? (usado para validar envios) */
export function ownsPath(userId: string, path: string) {
  return path.startsWith(`${userId}/`) && !path.includes('..') && /^[0-9a-f-]+\/[A-Za-z0-9._-]+$/.test(path);
}
