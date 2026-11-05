export const THEMES: Record<string, string> = {
  autoconfianca: 'Autoconfiança',
  'amor-proprio': 'Amor-próprio',
  prosperidade: 'Prosperidade',
  lideranca: 'Liderança',
  disciplina: 'Disciplina',
  realizacao: 'Realização',
  gratidao: 'Gratidão',
  coragem: 'Coragem',
  abundancia: 'Abundância',
  criatividade: 'Criatividade',
  proposito: 'Propósito',
  independencia: 'Independência',
};

export const PROJECT_CATEGORIES: Record<string, string> = {
  ideia: 'Ideia',
  empreendimento: 'Empreendimento',
  social: 'Iniciativa social',
  criativo: 'Projeto criativo',
  colaboracao: 'Colaboração',
  'em-desenvolvimento': 'Em desenvolvimento',
};

export const EVENT_KINDS: Record<string, string> = {
  presencial: 'Presencial',
  online: 'Online',
  workshop: 'Workshop',
  palestra: 'Palestra',
  experiencia: 'Experiência exclusiva',
  atividade: 'Atividade do clube',
};

export const ROLES: Record<string, string> = {
  member: 'Integrante',
  moderator: 'Moderadora',
  admin: 'Administradora',
  super_admin: 'Super admin',
};

export const MEMBERSHIP_STATUS: Record<string, string> = {
  trial: 'Experiência',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
  cancelled: 'Cancelada',
};

export const FEED_SCOPES = [
  { key: 'all', label: 'Tudo' },
  { key: 'members', label: 'Integrantes' },
  { key: 'businesses', label: 'Empresas' },
  { key: 'projects', label: 'Projetos' },
  { key: 'seven', label: 'Seven' },
  { key: 'saved', label: 'Salvos' },
] as const;
