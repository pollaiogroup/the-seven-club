-- THE SEVEN CLUB · dados de referência (não são dados de integrantes)

insert into public.pillars (id, slug, name, description, prompt, position) values
  (1, 'body', 'BODY', 'Saúde, movimento, beleza, nutrição e autocuidado.', 'Treino ou movimento', 1),
  (2, 'mind', 'MIND', 'Conhecimento, criatividade e repertório.', 'Aprendi algo novo', 2),
  (3, 'leadership', 'LEADERSHIP', 'Liderança, comunicação, confiança e influência.', 'Tomei uma atitude', 3),
  (4, 'business', 'BUSINESS', 'Negócios, carreira, projetos e realização.', 'Avancei em um projeto', 4),
  (5, 'wealth', 'WEALTH', 'Finanças, investimentos e prosperidade.', 'Cuidei das minhas finanças', 5),
  (6, 'connection', 'CONNECTION', 'Relacionamentos, amizades e networking.', 'Conectei-me com alguém', 6),
  (7, 'lifestyle', 'LIFESTYLE', 'Cultura, viagens, experiências e qualidade de vida.', 'Fiz algo por mim', 7)
on conflict (id) do nothing;

insert into public.daily_activities (pillar_id, title) values
  (1, 'Treino'), (1, 'Caminhada ou corrida'), (1, 'Alimentação consciente'), (1, 'Ritual de autocuidado'),
  (2, 'Leitura'), (2, 'Curso ou aula'), (2, 'Podcast ou palestra'), (2, 'Escrita'),
  (3, 'Conversa difícil'), (3, 'Decisão importante'), (3, 'Falei em público'), (3, 'Orientei alguém'),
  (4, 'Avancei em um projeto'), (4, 'Reunião estratégica'), (4, 'Prospecção'), (4, 'Planejamento da semana'),
  (5, 'Revisei meu orçamento'), (5, 'Investi'), (5, 'Estudei finanças'), (5, 'Organizei contas'),
  (6, 'Encontro com amigas'), (6, 'Networking'), (6, 'Tempo com a família'), (6, 'Mensagem para alguém especial'),
  (7, 'Experiência cultural'), (7, 'Descanso de verdade'), (7, 'Viagem ou passeio'), (7, 'Algo novo pela primeira vez');

insert into public.business_categories (slug, name, icon, sort) values
  ('beleza', 'Beleza', 'sparkles', 1),
  ('saude-bem-estar', 'Saúde e bem-estar', 'heart-pulse', 2),
  ('moda', 'Moda', 'shopping-bag', 3),
  ('negocios', 'Negócios', 'chart-column', 4),
  ('alimentacao', 'Alimentação', 'utensils', 5),
  ('lifestyle', 'Lifestyle', 'sun', 6),
  ('tecnologia', 'Tecnologia', 'cpu', 7),
  ('educacao', 'Educação', 'graduation-cap', 8),
  ('servicos', 'Serviços', 'briefcase', 9),
  ('outros', 'Outros', 'shapes', 10)
on conflict (slug) do nothing;

insert into public.app_settings (key, value, public_read) values
  ('grioh_url', 'null'::jsonb, false),
  ('community_rules', to_jsonb($t$As regras da comunidade ainda serão publicadas pela administração do clube.

Enquanto isso, vale o essencial: respeito em todas as interações, nada de spam ou venda insistente, nenhuma exposição de outras integrantes sem consentimento e conteúdo coerente com o propósito do clube. Conteúdos que violem esses princípios podem ser ocultados pela moderação.$t$::text), true),
  ('privacy_policy', to_jsonb($t$RASCUNHO — este texto precisa ser revisado e aprovado pelo jurídico antes da abertura do clube.

O THE SEVEN CLUB trata os dados das integrantes de acordo com a LGPD. Coletamos nome, e-mail, dados de perfil e o conteúdo que você publica para operar a comunidade. Check-ins do SEVEN são privados: apenas você tem acesso ao conteúdo deles, e a administração vê somente números agregados. Você pode exportar seus dados e excluir sua conta a qualquer momento em Ajustes.$t$::text), true),
  ('terms', to_jsonb($t$RASCUNHO — termos de uso a serem redigidos e aprovados pelo jurídico antes da abertura do clube.$t$::text), true)
on conflict (key) do nothing;

-- Afirmação garantida às 00:05 (Brasília) quando pg_cron estiver habilitado no projeto Supabase
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('seven-affirmation-of-the-day', '5 3 * * *', 'select public.ensure_affirmation(public.club_today())');
  end if;
end $$;
