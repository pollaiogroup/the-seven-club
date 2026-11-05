'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Bookmark, EyeOff, Flag, Heart, Lock, MessageCircle, MoreHorizontal, Pencil, Share2, Trash2, UserX } from 'lucide-react';
import type { Post } from '@/lib/types';
import { Avatar } from '@/components/ui/avatar';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { toast } from '@/components/ui/toaster';
import { RichText } from '@/components/rich-text';
import { ReportSheet } from './report-sheet';
import { mediaUrl } from '@/lib/media';
import { postStamp } from '@/lib/format';
import { deletePost, moderatePost, setBlock, toggleLike, toggleSave, updatePost } from '@/actions/posts';
import { THEMES } from '@/lib/labels';

function Origin({ post }: { post: Post }) {
  if (post.source === 'seven' && post.pillar) return <span className="font-bold tracking-wide text-burgundy">{post.pillar.name}</span>;
  if (post.source === 'affirmation') return <span className="font-semibold text-burgundy">Afirmação do dia</span>;
  if (post.business) return <Link href={`/business/${post.business.slug}`} className="font-bold tracking-wide text-burgundy">BUSINESS</Link>;
  if (post.project)
    return (
      <Link href={`/projetos/${post.project.slug}`} className="inline-flex items-center gap-1 font-semibold text-olive-ink">
        {post.project.visibility === 'private' && <Lock className="h-3 w-3" />}Projeto
      </Link>
    );
  return null;
}

export function PostCard({ post, linkToDetail = true, onRemoved }: { post: Post; linkToDetail?: boolean; onRemoved?: (id: string) => void }) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(Number(post.like_count));
  const [saved, setSaved] = useState(post.saved);
  const [body, setBody] = useState(post.body);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [reporting, setReporting] = useState(false);
  const [pending, start] = useTransition();

  const isBusiness = post.context === 'business' && post.business;
  const name = isBusiness ? post.business!.name : post.author?.full_name || 'Integrante';
  const href = isBusiness ? `/business/${post.business!.slug}` : post.author ? `/integrantes/${post.author.handle}` : '#';

  const like = () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    start(async () => {
      const r = await toggleLike(post.id, next);
      if (r?.error) { setLiked(!next); setLikes((n) => n + (next ? -1 : 1)); toast(r.error, 'error'); }
    });
  };
  const save = () => {
    const next = !saved;
    setSaved(next);
    start(async () => {
      const r = await toggleSave(post.id, next);
      if (r?.error) { setSaved(!next); toast(r.error, 'error'); } else toast(next ? 'Salvo nos seus favoritos' : 'Removido dos salvos');
    });
  };
  const share = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: 'THE SEVEN CLUB', text: 'Uma publicação no clube', url });
      else { await navigator.clipboard.writeText(url); toast('Link copiado. Só integrantes conseguem abrir.'); }
    } catch {}
  };
  const act = (fn: () => Promise<{ error?: string; ok?: boolean } | null>, done: string, remove = false) => {
    setMenu(false);
    start(async () => {
      const r = await fn();
      if (r?.error) return toast(r.error, 'error');
      toast(done);
      if (remove) { onRemoved?.(post.id); router.refresh(); }
    });
  };

  return (
    <article className={clsx('animate-rise border-b border-line bg-paper py-4 last:border-0 sm:mx-4 sm:my-3 sm:rounded-[var(--radius-card)] sm:border-0 sm:shadow-[var(--shadow-card)]', post.hidden && 'opacity-60')}>
      <header className="flex items-center gap-3 px-4">
        <Link href={href} className="shrink-0">
          {isBusiness ? <Avatar name={name} path={post.business!.logo_path} size={42} className="rounded-xl" /> : <Avatar name={name} path={post.author?.avatar_path} size={42} />}
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={href} className="block truncate text-[15px] font-semibold">{name}</Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
            <Origin post={post} />
            {(post.source !== 'manual' || post.business || post.project) && <span aria-hidden>·</span>}
            {post.project && <Link href={`/projetos/${post.project.slug}`} className="truncate">{post.project.name}</Link>}
            {post.project && <span aria-hidden>·</span>}
            <time dateTime={post.created_at}>{postStamp(post.created_at)}</time>
            {post.edited_at && <span>· editado</span>}
            {post.hidden && <span className="font-semibold text-danger">· oculto pela moderação</span>}
          </div>
        </div>
        <button onClick={() => setMenu(true)} aria-label="Mais opções" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-burgundy/5">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </header>

      {post.source === 'affirmation' && post.affirmation && (
        <blockquote className="mx-4 mt-3 rounded-2xl bg-burgundy px-5 py-5 text-ivory">
          <p className="font-display text-[19px] leading-snug italic">“{post.affirmation.text}”</p>
          <p className="mt-2 text-[11px] tracking-brand text-dusty uppercase">{THEMES[post.affirmation.theme] || post.affirmation.theme}</p>
        </blockquote>
      )}

      {editing ? (
        <div className="mt-3 px-4">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={3000} autoFocus />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setDraft(body); }}>Cancelar</Button>
            <Button size="sm" disabled={pending} onClick={() => start(async () => {
              const r = await updatePost(post.id, draft);
              if (r?.error) return toast(r.error, 'error');
              setBody(draft.trim()); setEditing(false); toast('Publicação atualizada');
            })}>Salvar</Button>
          </div>
        </div>
      ) : body ? (
        linkToDetail ? (
          // o texto pode ter menções e links: um <a> dentro de outro quebra a página, então o toque no texto navega por script
          <div role="link" tabIndex={0} className="block cursor-pointer"
            onClick={(e) => { if (!(e.target as HTMLElement).closest('a')) router.push(`/post/${post.id}`); }}
            onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/post/${post.id}`); }}>
            <RichText text={body} className="mt-3 px-4 text-[15px] leading-relaxed" />
          </div>
        ) : (
          <RichText text={body} className="mt-3 px-4 text-[15px] leading-relaxed" />
        )
      ) : null}

      {post.media.length > 0 && (
        <div className={clsx('mt-3 grid gap-1 overflow-hidden sm:mx-4 sm:rounded-2xl', post.media.length > 1 && 'grid-cols-2')}>
          {post.media.map((m, i) => (
            <img key={m.path} src={mediaUrl(m.path)!} alt="" loading="lazy" decoding="async"
              width={m.width || undefined} height={m.height || undefined}
              className={clsx('w-full bg-dusty-soft object-cover', post.media.length === 1 ? 'max-h-[520px]' : 'aspect-square', post.media.length === 3 && i === 0 && 'col-span-2 aspect-[2/1]')} />
          ))}
        </div>
      )}

      <footer className="mt-2 flex items-center px-2 text-muted">
        <button onClick={like} aria-pressed={liked} aria-label={liked ? 'Descurtir' : 'Curtir'} className="flex h-11 min-w-11 items-center gap-1.5 rounded-full px-2 hover:bg-burgundy/5">
          <Heart className={clsx('h-[22px] w-[22px] transition', liked && 'scale-110 fill-burgundy text-burgundy')} />
          {likes > 0 && <span className="text-[14px] tabular-nums">{likes}</span>}
        </button>
        <Link href={`/post/${post.id}#comentarios`} aria-label="Comentários" className="flex h-11 min-w-11 items-center gap-1.5 rounded-full px-2 hover:bg-burgundy/5">
          <MessageCircle className="h-[22px] w-[22px]" />
          {Number(post.comment_count) > 0 && <span className="text-[14px] tabular-nums">{post.comment_count}</span>}
        </Link>
        <button onClick={share} aria-label="Compartilhar" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-burgundy/5">
          <Share2 className="h-[20px] w-[20px]" />
        </button>
        <span className="flex-1" />
        <button onClick={save} aria-pressed={saved} aria-label={saved ? 'Remover dos salvos' : 'Salvar'} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-burgundy/5">
          <Bookmark className={clsx('h-[22px] w-[22px]', saved && 'fill-burgundy text-burgundy')} />
        </button>
      </footer>

      <BottomSheet open={menu} onClose={() => setMenu(false)} title="Publicação">
        <ul className="divide-y divide-line">
          {post.mine && post.source !== 'affirmation' && (
            <li><button className="flex w-full items-center gap-3 py-4 text-left" onClick={() => { setMenu(false); setEditing(true); }}><Pencil className="h-5 w-5" /> Editar texto</button></li>
          )}
          {post.mine && (
            <li><button className="flex w-full items-center gap-3 py-4 text-left text-danger" onClick={() => { if (confirm('Excluir esta publicação?')) act(() => deletePost(post.id), 'Publicação excluída', true); }}><Trash2 className="h-5 w-5" /> Excluir</button></li>
          )}
          {post.can_moderate && (
            <li><button className="flex w-full items-center gap-3 py-4 text-left" onClick={() => act(() => moderatePost(post.id, !post.hidden), post.hidden ? 'Publicação reexibida' : 'Publicação ocultada', true)}><EyeOff className="h-5 w-5" /> {post.hidden ? 'Reexibir (moderação)' : 'Ocultar (moderação)'}</button></li>
          )}
          {!post.mine && (
            <li><button className="flex w-full items-center gap-3 py-4 text-left" onClick={() => { setMenu(false); setReporting(true); }}><Flag className="h-5 w-5" /> Denunciar</button></li>
          )}
          {!post.mine && post.author && (
            <li><button className="flex w-full items-center gap-3 py-4 text-left" onClick={() => { if (confirm(`Bloquear ${post.author!.full_name}? Você deixa de ver as publicações dela.`)) act(() => setBlock(post.author!.id, true), 'Integrante bloqueada', true); }}><UserX className="h-5 w-5" /> Bloquear {post.author.full_name.split(' ')[0]}</button></li>
          )}
        </ul>
      </BottomSheet>
      <ReportSheet open={reporting} onClose={() => setReporting(false)} targetType="post" targetId={post.id} />
    </article>
  );
}
