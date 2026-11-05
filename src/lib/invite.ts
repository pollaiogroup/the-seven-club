/** Mensagem pronta para mandar o convite, com o passo a passo de instalação do app (sem lojas). */
export const inviteMessage = (link: string, installLink: string, until: string) =>
  `Olá! Você foi convidada para o THE SEVEN CLUB.\n\n1. Crie sua conta pelo seu link pessoal (vale até ${until}):\n${link}\n\n2. Depois, instale o app no celular, direto pelo navegador, sem loja:\n${installLink}`;
