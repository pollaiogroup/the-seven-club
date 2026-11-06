import { NotebookPen, Settings, ShieldCheck } from 'lucide-react';
import { hasRole, requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { LibraryEntry, Post, ProfilePage } from '@/lib/types';
import { IconLink, PageHeader, Sheet } from '@/components/ui/page-header';
import { ProfileView } from '@/components/profile/profile-view';

export const metadata = { title: 'Perfil' };

export default async function MyProfile({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba = 'feed' } = await searchParams;
  const me = await requireMember();
  const p = await rpc<ProfilePage>('profile_page', { p_handle: me.handle });
  const posts = aba === 'feed' ? await rpc<Post[]>('feed_page', { p_author: me.id }) : [];
  const library = aba === 'biblioteca' ? await rpc<LibraryEntry[]>('library_of', { p_member: me.id }) : [];
  return (
    <>
      <PageHeader title="Perfil" actions={
        <div className="flex items-center gap-1">
          {/* atalho para a administração, só para quem tem papel na moderação */}
          {hasRole(me, 'moderator') && <IconLink href="/admin" label="Painel administrativo"><ShieldCheck className="h-[22px] w-[22px]" /></IconLink>}
          <IconLink href="/planner" label="The Seven Club Planner"><NotebookPen className="h-[22px] w-[22px]" /></IconLink>
          <IconLink href="/ajustes" label="Ajustes"><Settings className="h-[22px] w-[22px]" /></IconLink>
        </div>} />
      <Sheet className="pt-5"><ProfileView p={p} tab={aba} posts={posts} base="/perfil" library={library} /></Sheet>
    </>
  );
}
