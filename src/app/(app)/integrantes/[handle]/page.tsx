import { notFound, redirect } from 'next/navigation';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { LibraryEntry, Post, ProfilePage } from '@/lib/types';
import { PageHeader, Sheet } from '@/components/ui/page-header';
import { ProfileView } from '@/components/profile/profile-view';

export default async function MemberProfile({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { handle } = await params;
  const { aba = 'feed' } = await searchParams;
  const me = await requireMember();
  if (handle === me.handle) redirect(`/perfil${aba !== 'feed' ? `?aba=${aba}` : ''}`);
  const p = await rpc<ProfilePage | null>('profile_page', { p_handle: handle });
  if (!p) notFound();
  const posts = aba === 'feed' && !p.blocked_by_me ? await rpc<Post[]>('feed_page', { p_author: p.id }) : [];
  const library = aba === 'biblioteca' ? await rpc<LibraryEntry[]>('library_of', { p_member: p.id }) : [];
  return (
    <>
      <PageHeader title={p.full_name.split(' ')[0]!} subtitle={`@${p.handle}`} back="/feed" />
      <Sheet className="pt-5"><ProfileView p={p} tab={aba} posts={posts} base={`/integrantes/${handle}`} library={library} /></Sheet>
    </>
  );
}
