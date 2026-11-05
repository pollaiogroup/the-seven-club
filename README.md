# THE SEVEN CLUB

App mobile-first da sociedade THE SEVEN CLUB: Feed, Business, SEVEN, Ensino (Grioh) e Profile, mais Clube do Livro, Agenda, Afirmação do dia, busca, notificações e painel administrativo.

Next.js 16 (App Router) + TypeScript + Tailwind 4, com Supabase (Postgres, Auth, Storage e RLS), hospedado na Vercel. As integrantes instalam o app no celular direto pelo navegador (PWA), sem passar pela App Store nem pelo Google Play. Se um dia fizer sentido ir para as lojas, o projeto já está preparado com Capacitor.

## Estrutura

```
src/app/(auth)/        entrar, convite/[token], recuperar, redefinir-senha, sobre/[slug]
src/app/(app)/         área das integrantes, com a navegação inferior fixa
  feed  business  seven  ensino  perfil  integrantes  projetos  agenda
  afirmacoes  clube-do-livro  biblioteca  busca  notificacoes  publicar  post  ajustes
src/app/admin/         painel administrativo (layout e permissões próprios)
src/app/api/           cron/dispatch (rotinas e push), export (LGPD), admin/relatorio (CSV)
src/actions/           Server Actions, com validação no servidor
src/components/        componentes por área e components/ui (base do design)
src/lib/               clientes Supabase, auth, formatação, imagens
supabase/migrations/   esquema, RLS, funções, storage, dados de referência, 372 afirmações, Clube do Livro
supabase/templates/    e-mail de recuperação de senha
public/                manifest, service worker, ícones, splash, marca
dev/                   ambiente local, testes de segurança e de ponta a ponta, geração de ícones
```

## Regras que o banco garante

As regras abaixo valem no Postgres (RLS e gatilhos), não só na tela:

- **Clube fechado.** O cadastro público fica desligado. Toda conta nasce de um convite de uso único, ligado a um e-mail e com validade de 14 dias.
- **Check-in do SEVEN é privado.** Só a própria integrante lê os check-ins, incluindo notas e fotos. Nem a administração tem acesso, e o painel mostra só números agregados.
- **Publicar exige conclusão.** Uma publicação do SEVEN precisa de um check-in concluído da própria autora. A nota e a foto privadas nunca são copiadas para o post.
- **Projetos privados** só aparecem para as participantes.
- **Papéis:** integrante, moderadora, admin e super admin. Ninguém muda o próprio papel, e só a super admin cria admins.
- **Moderação:** ocultar um conteúdo tira ele da vista das integrantes, mas a autora e a moderação continuam vendo. Toda ação fica registrada na auditoria.
- **Arquivos:** cada integrante grava só na própria pasta. As fotos de check-in ficam no bucket `private`, lidas por URL assinada e só pela dona. As demais imagens ficam no bucket `media`, com caminhos aleatórios e sem listagem pública.
- **Afirmação do dia:** é a mesma para todas no dia e não repete até esgotar a biblioteca. A administração pode fixar uma frase para qualquer data.
- **Clube do Livro:** a votação só aceita voto dentro das datas e cada uma vê apenas o próprio voto; o placar só abre quando a votação fecha. A lista de quem vai ler é privada, e o clube vê só o total. Cupons aparecem a partir da data de início.
- **Biblioteca:** qualquer integrante vê a estante das outras; só a dona registra, edita ou remove os próprios livros, com estrelas de 1 a 7.

## Implantação

### 1. Supabase

1. Crie o projeto na região **South America (São Paulo)**.
2. Aplique as migrações:
   ```bash
   npx supabase link --project-ref SEU_REF
   npx supabase db push
   ```
3. Em **Authentication**, configure:
   - **Sign In / Providers:** desligue *Allow new users to sign up* (as contas vêm do convite) e *Confirm email*.
   - **URL Configuration:** *Site URL* = `https://SEU-DOMINIO` e, em *Redirect URLs*, `https://SEU-DOMINIO/auth/confirm`.
   - **Emails > Reset password:** cole o conteúdo de `supabase/templates/recovery.html`.
   - **SMTP:** use um provedor próprio (Resend, SES, Postmark…). O SMTP padrão do Supabase tem limite baixo de envios.
4. Os buckets `media` e `private` e suas políticas são criados pelas migrações.

### 2. Vercel

Importe o repositório e preencha as variáveis de `.env.example`:

| Variável | Onde obter |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Mesmo lugar. Fica só no servidor. |
| `NEXT_PUBLIC_SITE_URL` | Opcional na Vercel: sem ela, o app usa o domínio de produção do projeto. Preencha ao ligar um domínio próprio. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npx web-push generate-vapid-keys` |
| `CRON_SECRET` | Um texto aleatório longo |

### 3. Rotinas a cada 10 minutos

A rota `/api/cron/dispatch` faz quatro coisas:

- agenda a afirmação do dia;
- envia os avisos do Clube do Livro (livro do mês no dia 1 a partir das 9h, votação, resultado, cupons e lembretes do encontro);
- cria os lembretes do SEVEN, das afirmações e dos eventos no horário que cada integrante escolheu;
- marca as assinaturas vencidas;
- envia as notificações push pendentes.

O `vercel.json` chama essa rota uma vez por dia (8h de Brasília; os avisos que esperam as 9h saem na chamada seguinte), o limite do plano gratuito da Vercel. Um agendamento mais frequente nesse plano faz o deploy falhar. Para rodar a cada 10 minutos, há dois caminhos: no plano Pro, troque o `schedule` para `*/10 * * * *`; ou agende pelo próprio Supabase, com as extensões `pg_cron` e `pg_net` ligadas:

```sql
select cron.schedule('seven-dispatch', '*/10 * * * *', $$
  select net.http_get('https://SEU-DOMINIO/api/cron/dispatch',
    headers := jsonb_build_object('Authorization', 'Bearer SEU_CRON_SECRET'))
$$);
```

### 4. Primeiro acesso (fundadora)

No SQL Editor do Supabase:

```sql
insert into public.invitations (email, role, plan)
values ('email-da-fundadora@dominio.com', 'super_admin', 'fundadora')
returning token;
```

Abra `https://SEU-DOMINIO/convite/<token>` e crie a conta. A partir daí, os convites saem do painel em **Administração > Convites**.

### 5. Ajustes no painel

- **Conteúdo e Grioh:** link da comunidade Grioh (a área ENSINO só mostra o botão depois que o link é preenchido), política de privacidade, termos de uso e regras da comunidade. Os textos jurídicos que vêm de fábrica são rascunhos e precisam de revisão jurídica.
- **Afirmações:** 372 frases publicadas, em 12 temas, como ponto de partida para a curadoria. Dá para editar, arquivar, importar e fixar uma frase por data.
- **Categorias:** as 10 categorias iniciais do diretório Business.
- **Clube do Livro:** cadastre os livros no catálogo, defina o livro de cada mês (de preferência até o dia 25 do mês anterior) e ligue o encontro criado em Eventos. Crie a votação com 3 opções; as datas da penúltima semana já vêm sugeridas. O mais votado vira o livro do mês seguinte; em empate, o painel pede a escolha. Os cupons da última semana entram no mesmo lugar.

### 6. Instalação no celular (sem lojas)

O app é um PWA: ganha ícone na tela de início, abre em tela cheia e recebe notificações, sem custo de loja.

- **Página `/instalar`:** pública, com o passo a passo para iPhone (Safari > Compartilhar > Adicionar à Tela de Início) e Android (Chrome > Instalar app). Ela reconhece o aparelho e, aberta pelo ícone, leva direto ao clube.
- **Convite:** em **Administração > Convites**, “Copiar mensagem” e “WhatsApp” montam o texto com o link pessoal do convite e o link de instalação.
- **No feed:** depois de criar a conta, a integrante vê o cartão “Leve o clube para a tela de início”. Com o app instalado, o cartão passa a oferecer as notificações. “Agora não” esconde o cartão por 7 dias.
- **iPhone:** as notificações só chegam com o app instalado na tela de início (iOS 16.4 ou mais novo). No Android, funcionam também no navegador.
- **Navegadores dentro de outros apps** (Instagram, Facebook) não instalam: a página pede para abrir no Safari ou no Chrome.

## Marca

- **Grioh:** os arquivos oficiais estão em `public/brand/grioh/`. O ícone da navegação usa o G na cor do texto e o ponto laranja original.
- **Estrela de 7 pontas:** `public/brand/seven-star.svg` é **provisória**, porque o arquivo oficial ainda não foi entregue. Para trocar:
  1. Substitua esse arquivo pelo oficial, mantendo o nome e usando `fill="currentColor"`.
  2. Rode `npm run brand`, que gera de novo os ícones do app, o favicon e as telas de abertura do iPhone.

## Publicação nas lojas (opcional, Capacitor)

Não é necessária para o lançamento: o app é instalado pelo navegador (veja o passo 6). Se um dia o clube quiser estar nas lojas, as contas custam US$ 99 por ano (Apple) e US$ 25 uma vez (Google Play). O `capacitor.config.ts` abre o app publicado dentro de uma casca nativa. Uma atualização do site chega às integrantes sem nova versão na loja.

```bash
CAP_SERVER_URL=https://SEU-DOMINIO npm run mobile:android   # requer Android Studio
CAP_SERVER_URL=https://SEU-DOMINIO npm run mobile:ios       # requer macOS e Xcode
```

Antes de enviar às lojas:

- **Push nativo.** Instale `@capacitor/push-notifications` e grave o token do aparelho em `push_subscriptions`, ao lado das inscrições Web Push. O envio passa a usar FCM e APNs. A Apple recusa apps que são só um site embrulhado, então os recursos nativos contam a favor.
- **Assinatura.** Venda o acesso pelo site, não dentro do app, para evitar as regras de compra das lojas. O app só faz login.
- **Exclusão de conta e denúncia.** As lojas exigem as duas, e ambas já existem (Ajustes e o menu de cada publicação).

## Desenvolvimento local

Com Docker, use `npx supabase start` e `npx supabase db reset`. Sem Docker, o projeto traz um ambiente próprio que sobe um Postgres real e emula as APIs do Supabase com as mesmas regras de RLS:

```bash
npm install
dev/local-supabase/start.sh --reset   # imprime as chaves para o .env.local
npm run dev
```

## Testes

```bash
npm run typecheck
npm run test:db    # 18 cenários de segurança (RLS, gatilhos e funções) no Postgres
npm run test:e2e   # 28 fluxos no celular (iPhone simulado) contra o app real; screenshots em dev/.local/screens
```

Os dois testes aceitam `TEST_DATABASE_URL` e `E2E_DATABASE_URL` para rodar contra outra base. Dois fluxos (cadastro público fechado e recuperação de senha por e-mail) só rodam contra o Supabase Auth real, quando `MAIL_DIR` aponta para a pasta onde um SMTP local grava os e-mails.

## Demonstração

`node dev/scripts/demo-seed.mjs` preenche um ambiente **local** com integrantes, empresas, projetos, eventos, Clube do Livro e biblioteca fictícios (entre como `marina-duarte@demo.theseven.club`, senha `demo-seven-2026`). Ele apaga os dados da base local antes e recusa rodar contra um Supabase que não seja local. `node dev/scripts/tour-shots.mjs <pasta>` fotografa todas as telas.
