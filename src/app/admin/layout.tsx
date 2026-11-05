import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { hasRole, requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SevenStar } from '@/components/ui/icons';
import { AdminNav } from '@/components/admin/admin-nav';
import { ROLES } from '@/lib/labels';

export const metadata = { title: { default: 'Administração', template: '%s · Administração' }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff('moderator');
  const admin = hasRole(me, 'admin');
  const supabase = await createClient();
  const { data: open } = await supabase.from('reports').select('id').eq('status', 'open').limit(100);
  const items = [
    { href: '/admin', label: 'Indicadores' },
    { href: '/admin/moderacao', label: 'Moderação', badge: open?.length || 0 },
    { href: '/admin/publicacoes', label: 'Publicações' },
    ...(admin ? [
      { href: '/admin/integrantes', label: 'Integrantes e assinaturas' },
      { href: '/admin/convites', label: 'Convites' },
      { href: '/admin/afirmacoes', label: 'Afirmações' },
      { href: '/admin/clube-do-livro', label: 'Clube do Livro' },
      { href: '/admin/eventos', label: 'Eventos' },
      { href: '/admin/empresas', label: 'Empresas' },
      { href: '/admin/projetos', label: 'Projetos' },
      { href: '/admin/categorias', label: 'Categorias' },
      { href: '/admin/notificacoes', label: 'Avisos' },
      { href: '/admin/conteudo', label: 'Conteúdo e Grioh' },
    ] : []),
  ];
  return (
    <div className="min-h-dvh bg-ivory md:flex">
      <aside className="pt-safe bg-burgundy-deep text-ivory md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:overflow-y-auto">
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <SevenStar className="h-6 w-6 text-dusty" />
          <div className="flex-1 leading-tight"><p className="font-display text-[17px]">Administração</p><p className="text-[12px] text-dusty">{ROLES[me.role]} · {me.full_name.split(' ')[0]}</p></div>
          <Link href="/feed" aria-label="Voltar ao app" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></Link>
        </div>
        <div className="pb-3"><AdminNav items={items} /></div>
      </aside>
      <main className="pb-safe min-w-0 flex-1 px-4 pt-6 pb-16 md:px-8">{children}</main>
    </div>
  );
}
