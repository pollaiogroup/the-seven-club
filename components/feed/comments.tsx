'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { EyeOff, Flag, Send, Trash2 } from 'lucide-react';
import type { Comment } from '@/lib/types';
import { addComment, deleteComment, loadComments, moderateComment } from '@/actions/posts';
import { Avatar } from '@/components/ui/avatar';
import { RichText } from '@/components/rich-text';
import { toast } from '@/components/ui/toaster';
import { timeAgo } from '@/lib/format';
import { ReportSheet } from './report-sheet';

export function Comments({ postId, initial, canComment }: { postId: string; initial: Comment[]; canComment: boolean }) {
  const [items, setItems] = useState(initial);
  const [text, setText] = useState('');
  const [reporting, setReporting] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const refresh = async () => setItems(await loadComments(postId));

  return (
    <section id="comentarios" className="px-4 pt-2">
      <h2 className="py-3 text-[18px] text-burgundy">Comentários</h2>
      {items.length === 0 && <p className="pb-4 text-[14px] text-muted">Seja a primeira a comentar.</p>}
      <ul className="space-y-4">
        {items.map((c) => (
          <li key={c.id} className={c.hidden ? 'opacity-50' : ''}>
            <div className="flex gap-3">
              <Link href={c.author ? `/integrantes/${c.author.handle}` : '#'}><Avatar name={c.author?.full_name || '?'} path={c.author?.avatar_path} size={34} /></Link>
              <div className="min-w-0 flex-1">
                <div className="rounded-2xl bg-paper px-4 py-2.5 ring-1 ring-line">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[14px] font-semibold">{c.author?.full_name}</span>
                    <span className="text-[12px] text-muted">{timeAgo(c.created_at)}</span>
                  </div>
                  <RichText text={c.body} className="text-[14px] leading-relaxed" />
                </div>
                <div className="mt-1 flex gap-3 pl-2 text-[12px] text-muted">
                  {c.mine && <button onClick={() => start(async () => { const r = await deleteComment(c.id); if (r?.error) toast(r.error, 'error'); else refresh(); })} className="inline-flex items-center gap-1 py-1"><Trash2 className="h-3.5 w-3.5" />Excluir</button>}
                  {!c.mine && <button onClick={() => setReporting(c.id)} className="inline-flex items-center gap-1 py-1"><Flag className="h-3.5 w-3.5" />Denunciar</button>}
                  {c.can_moderate && <button onClick={() => start(async () => { const r = await moderateComment(c.id, !c.hidden); if (r?.error) toast(r.error, 'error'); else refresh(); })} className="inline-flex items-center gap-1 py-1"><EyeOff className="h-3.5 w-3.5" />{c.hidden ? 'Reexibir' : 'Ocultar'}</button>}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {canComment && (
        <form className="sticky bottom-nav-offset mt-4 flex items-end gap-2 bg-ivory py-3" onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          start(async () => {
            const r = await addComment(postId, text);
            if (r?.error) return toast(r.error, 'error');
            setText('');
            await refresh();
          });
        }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={1000} placeholder="Escreva um comentário…" aria-label="Comentário"
            className="max-h-32 min-h-12 flex-1 resize-none rounded-3xl bg-paper px-4 py-3 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-burgundy" />
          <button type="submit" disabled={pending || !text.trim()} aria-label="Enviar comentário" className="flex h-12 w-12 items-center justify-center rounded-full bg-burgundy text-ivory disabled:opacity-40">
            <Send className="h-5 w-5" />
          </button>
        </form>
      )}
      {reporting && <ReportSheet open onClose={() => setReporting(null)} targetType="comment" targetId={reporting} />}
    </section>
  );
}
