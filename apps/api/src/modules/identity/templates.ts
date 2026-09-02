function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export function verificationTemplate(webOrigin: string, token: string): EmailTemplate {
  const url = `${webOrigin}/verificar-email?token=${encodeURIComponent(token)}`;
  return {
    subject: 'Confirme seu e-mail no SKILL MAPS',
    text: `Confirme seu e-mail acessando: ${url}\n\nEste link expira em 30 minutos e pode ser usado uma vez.`,
    html: `<p>Confirme seu e-mail no SKILL MAPS.</p><p><a href="${escapeHtml(url)}">Confirmar e-mail</a></p><p>Este link expira em 30 minutos e pode ser usado uma vez.</p>`,
  };
}

export function passwordResetTemplate(webOrigin: string, token: string): EmailTemplate {
  const url = `${webOrigin}/recuperar-acesso?token=${encodeURIComponent(token)}`;
  return {
    subject: 'Recupere seu acesso ao SKILL MAPS',
    text: `Defina uma nova senha acessando: ${url}\n\nEste link expira em 30 minutos e pode ser usado uma vez.`,
    html: `<p>Recebemos uma solicitacao de recuperacao de acesso.</p><p><a href="${escapeHtml(url)}">Definir nova senha</a></p><p>Este link expira em 30 minutos e pode ser usado uma vez.</p>`,
  };
}
