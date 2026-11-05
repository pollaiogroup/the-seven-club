import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { ProfilePage } from '@/lib/types';
import { PageHeader, Sheet } from '@/components/ui/page-header';
import { ProfileForm } from '@/components/profile/profile-form';

export const metadata = { title: 'Editar perfil' };

export default async function EditProfile() {
  const me = await requireMember();
  const p = await rpc<ProfilePage>('profile_page', { p_handle: me.handle });
  return (
    <>
      <PageHeader title="Editar perfil" back="/perfil" />
      <Sheet className="px-5 pt-6"><ProfileForm p={p} userId={me.id} /></Sheet>
    </>
  );
}
