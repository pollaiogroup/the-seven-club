import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const PAGES: Record<string, { key: string; title: string }> = {
  regras: { key: 'community_rules', title: 'Regras da comunidade' },
  privacidade: { key: 'privacy_policy', title: 'Política de privacidade' },
  termos: { key: 'terms', title: 'Termos de uso' },
};

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('value').eq('key', page.key).maybeSingle();
  const text = typeof data?.value === 'string' ? data.value : 'Conteúdo ainda não publicado.';
  return (
    <article>
      <h1 className="text-[28px]">{page.title}</h1>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed whitespace-pre-line text-ivory/90">{text}</div>
      <Link href="/feed" className="mt-10 inline-block text-dusty underline underline-offset-4">Voltar</Link>
    </article>
  );
}
