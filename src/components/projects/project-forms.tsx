'use client';
import { Form } from '@/components/ui/form';
import { useActionState, useTransition } from 'react';
import { addProjectMember, deleteProject, removeProjectMember, saveProject } from '@/actions/projects';
import type { ProjectPage } from '@/lib/types';
import { PROJECT_CATEGORIES } from '@/lib/labels';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Button } from '@/components/ui/button';
import { ImagePicker } from '@/components/image-picker';
import { Avatar } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toaster';

export function ProjectForm({ userId, project }: { userId: string; project?: ProjectPage }) {
  const [state, action] = useActionState(saveProject.bind(null, project?.id ?? null), null);
  return (
    <Form action={action} className="space-y-5">
      <input type="hidden" name="current_cover" value={project?.cover_path || ''} />
      <div><span className="mb-1.5 block text-[13px] font-semibold">Imagem de capa</span>
        <ImagePicker userId={userId} name="cover" max={1} label="Capa" initial={project?.cover_path ? [{ path: project.cover_path, width: 1, height: 1 }] : []} /></div>
      <Field label="Nome do projeto"><Input name="name" required maxLength={80} defaultValue={project?.name} /></Field>
      <Field label="Categoria">
        <Select name="category" required defaultValue={project?.category || ''}>
          <option value="" disabled>Escolha</option>
          {Object.entries(PROJECT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Descrição"><Textarea name="description" maxLength={2000} defaultValue={project?.description || ''} placeholder="O que é, em que fase está e que tipo de colaboração procura." /></Field>
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold">Quem pode ver</legend>
        <div className="space-y-2">
          {[
            { v: 'club', t: 'Todo o clube', d: 'Qualquer integrante vê o projeto e suas publicações.' },
            { v: 'private', t: 'Só colaboradoras', d: 'Apenas quem você adicionar vê o projeto.' },
          ].map((o) => (
            <label key={o.v} className="flex items-start gap-3 rounded-2xl bg-paper p-4 ring-1 ring-line has-[:checked]:ring-2 has-[:checked]:ring-burgundy">
              <input type="radio" name="visibility" value={o.v} defaultChecked={(project?.visibility || 'club') === o.v} className="mt-1 accent-[#450B18]" />
              <span><span className="block text-[15px] font-medium">{o.t}</span><span className="block text-[13px] text-muted">{o.d}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton full size="lg">{project ? 'Salvar projeto' : 'Criar projeto'}</SubmitButton>
    </Form>
  );
}

export function MembersManager({ project }: { project: ProjectPage }) {
  const [state, action] = useActionState(addProjectMember.bind(null, project.id), null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {project.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3">
            <Avatar name={m.full_name} path={m.avatar_path} size={36} />
            <span className="flex-1 text-[14px]">{m.full_name} <span className="text-muted">· {m.role === 'owner' ? 'Responsável' : 'Colaboradora'}</span></span>
            {m.role !== 'owner' && project.is_owner && (
              <button disabled={pending} onClick={() => start(async () => { const r = await removeProjectMember(project.id, m.id); if (r?.error) toast(r.error, 'error'); })} className="text-[13px] text-danger">Remover</button>
            )}
          </li>
        ))}
      </ul>
      {project.is_owner && (
        <Form action={action} className="flex gap-2">
          <Input name="handle" placeholder="@ da integrante" autoCapitalize="none" required />
          <SubmitButton variant="secondary">Convidar</SubmitButton>
        </Form>
      )}
      <FormMessage state={state} />
    </div>
  );
}

export function LeaveOrDelete({ project, userId }: { project: ProjectPage; userId: string }) {
  const [pending, start] = useTransition();
  if (project.is_owner)
    return (
      <Button variant="secondary" full className="text-danger" disabled={pending} onClick={() => {
        if (confirm('Excluir o projeto e todas as publicações dele?')) start(async () => { const r = await deleteProject(project.id); if (r?.error) toast(r.error, 'error'); });
      }}>Excluir projeto</Button>
    );
  if (!project.is_member) return null;
  return (
    <Button variant="secondary" full disabled={pending} onClick={() => {
      if (confirm('Sair do projeto?')) start(async () => { const r = await removeProjectMember(project.id, userId); if (r?.error) toast(r.error, 'error'); else location.assign('/perfil?aba=projetos'); });
    }}>Sair do projeto</Button>
  );
}
