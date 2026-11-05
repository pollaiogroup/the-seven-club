'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import type { Post } from '@/lib/types';
import { loadFeed, type FeedQuery } from '@/actions/posts';
import { PostCard } from './post-card';

/** Lista com rolagem infinita controlada: carrega 15 por vez, só quando a integrante chega ao fim. */
export function FeedList({ initial, query, empty }: { initial: Post[]; query: FeedQuery; empty: ReactNode }) {
  const [posts, setPosts] = useState(initial);
  const [done, setDone] = useState(initial.length < 15);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => { setPosts(initial); setDone(initial.length < 15); }, [initial]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    const io = new IntersectionObserver(async ([e]) => {
      if (!e?.isIntersecting || loading) return;
      const last = posts[posts.length - 1];
      if (!last) return;
      setLoading(true);
      setFailed(false);
      try {
        const more = await loadFeed(query, { ts: last.created_at, id: last.id });
        setPosts((p) => [...p, ...more.filter((m) => !p.some((x) => x.id === m.id))]);
        if (more.length < 15) setDone(true);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [posts, done, loading, query]);

  if (posts.length === 0) return <>{empty}</>;
  return (
    <div>
      {posts.map((p) => <PostCard key={p.id} post={p} onRemoved={(id) => setPosts((x) => x.filter((y) => y.id !== id))} />)}
      <div ref={sentinel} className="flex h-20 items-center justify-center text-[13px] text-muted">
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        {failed && <span>Sem conexão. Role de novo para tentar.</span>}
        {done && posts.length > 5 && <span>Você viu tudo por aqui.</span>}
      </div>
    </div>
  );
}
