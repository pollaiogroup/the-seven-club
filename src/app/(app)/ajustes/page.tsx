import Link from 'next/link';
import { ChevronRight, Download, LogOut, ShieldCheck } from 'lucide-react';
import { requireMember, hasRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/actions/auth';
import { PageHeader, SectionTitle, Sheet } from '@/components/ui/page-header';
import { SubmitButton } from '@/components/ui/submit-button';
import { PreferencesForm, DeleteAccountForm, type Prefs } from '@/components/settings/settings-forms';
import { PushToggle } from '@/components/settings/push-toggle';
import { InstallApp } from '@/components/settings/install-app';

export const metadata = { title: 'Ajustes' };
const card = 'mx-4 rounded-[var(--radius-card)] bg-paper px-4 ring-1 ring-line';

export default async function Settings() {
  const me = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.from('user_preferences').select('*').eq('member_id', me.id).maybeSingle();
  const prefs: Prefs = data || { notify_likes: true, notify_comments: true, notify_mentions: true, notify_projects: true, notify_events: true, notify_affirmation: true, affirmation_time: '08:00', notify_seven_reminder: false, seven_reminder_time: '20:00', notify_book_club: true };
  return (
    <>
      <PageHeader title="Ajustes" back="/perfil" />
      <Sheet className="pt-2">
        {hasRole(me, 'moderator') && (
          <Link href="/admin" className="mx-4 mt-4 flex items-center gap-3 rounded-[var(--radius-card)] bg-burgundy px-4 py-4 text-ivory">
            <ShieldCheck className="h-5 w-5" /><span className="flex-1 font-semibold">Painel administrativo</span><ChevronRight className="h-5 w-5" />
          </Link>
        )}
        <SectionTitle>Instalar o app</SectionTitle>
        <div className={card}><InstallApp /></div>
        <div id="notificacoes" />
        <SectionTitle>Notificações no celular</SectionTitle>
        <div className={card}><PushToggle /></div>
        <SectionTitle>O que avisar</SectionTitle>
        <div className={`${card} py-2`}><PreferencesForm prefs={prefs} /></div>
        <SectionTitle>Privacidade e dados</SectionTitle>
        <ul className={`${card} divide-y divide-line`}>
          <li><a href="/api/export" className="flex items-center gap-3 py-4 text-[15px]"><Download className="h-5 w-5 text-burgundy" /><span className="flex-1">Exportar meus dados</span><ChevronRight className="h-4 w-4 text-taupe" /></a></li>
          {[['regras', 'Regras da comunidade'], ['privacidade', 'Política de privacidade'], ['termos', 'Termos de uso']].map(([s, l]) => (
            <li key={s}><Link href={`/sobre/${s}`} className="flex items-center gap-3 py-4 text-[15px]"><span className="flex-1">{l}</span><ChevronRight className="h-4 w-4 text-taupe" /></Link></li>
          ))}
        </ul>
        <SectionTitle>Conta</SectionTitle>
        <div className={`${card} space-y-4 py-4`}>
          <form action={signOut}><SubmitButton variant="secondary" full pendingText="Saindo…"><LogOut className="h-4 w-4" />Sair</SubmitButton></form>
          <details className="group">
            <summary className="cursor-pointer list-none py-2 text-center text-[13px] text-danger">Excluir minha conta</summary>
            <div className="pt-3"><DeleteAccountForm /></div>
          </details>
        </div>
      </Sheet>
    </>
  );
}
