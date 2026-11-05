import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** Chama uma função do banco (RLS aplicada com a sessão atual). */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** Converte erros do Postgres em mensagens para a integrante. */
export function friendlyError(error: { message?: string; code?: string } | null | undefined, fallback = 'Não foi possível concluir. Tente de novo.') {
  if (!error) return fallback;
  if (error.code === '23505') {
    if (/slug/.test(error.message || '')) return 'Já existe um cadastro com esse endereço. Escolha outro.';
    return error.message?.includes('handle') ? 'Esse @ já está em uso.' : 'Esse registro já existe.';
  }
  if (error.code === '42501' && error.message && !/row-level security/.test(error.message)) return error.message;
  if (error.code === '42501') return 'Você não tem permissão para isso.';
  if (error.code === '23514' || error.code === '22023' || error.code === 'P0001') return error.message || fallback;
  if (error.code === '23503') return 'Um dos itens relacionados não existe mais.';
  return fallback;
}
