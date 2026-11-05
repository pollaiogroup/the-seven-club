import { requireStaff } from '@/lib/auth';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { BroadcastForm } from '@/components/admin/forms';

export const metadata = { title: 'Avisos' };

export default async function AdminBroadcast() {
  await requireStaff('admin');
  return (
    <>
      <AdminTitle title="Avisos para o clube" subtitle="Vai para o sino de todas as integrantes ativas e, para quem ativou, como notificação no celular. Use com moderação." />
      <Panel className="max-w-xl"><BroadcastForm /></Panel>
    </>
  );
}
