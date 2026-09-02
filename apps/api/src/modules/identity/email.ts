import { createConnection } from 'node:net';

import type { EmailTemplate } from './templates.js';

export interface TransactionalEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailPort {
  send(message: TransactionalEmail): Promise<void>;
}

export class NullEmailAdapter implements EmailPort {
  async send(): Promise<void> {}
}

function smtpData(message: TransactionalEmail, from: string): string {
  const encode = (value: string) => Buffer.from(value).toString('base64');
  const text = message.text.replaceAll('\n.', '\n..');
  const html = message.html.replaceAll('\n.', '\n..');
  return [
    `From: SKILL MAPS <${from}>`,
    `To: ${message.to}`,
    `Subject: =?UTF-8?B?${encode(message.subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="skill-maps-boundary"',
    '',
    '--skill-maps-boundary',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    text,
    '--skill-maps-boundary',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    '--skill-maps-boundary--',
  ].join('\r\n');
}

export class MailpitEmailAdapter implements EmailPort {
  constructor(
    private readonly host = '127.0.0.1',
    private readonly port = 1025,
    private readonly from = 'nao-responda@skill-maps.test',
  ) {}

  async send(message: TransactionalEmail): Promise<void> {
    const socket = createConnection({ host: this.host, port: this.port });
    socket.setEncoding('utf8');
    let buffered = '';

    const readResponse = () =>
      new Promise<string>((resolve, reject) => {
        const onData = (chunk: string) => {
          buffered += chunk;
          const lines = buffered.split('\r\n');
          const finalLine = lines.findLast((line) => /^\d{3} /.test(line));
          if (!finalLine) return;
          socket.off('data', onData);
          buffered = '';
          if (/^[23]/.test(finalLine)) resolve(finalLine);
          else reject(new Error(`SMTP rejected message with ${finalLine.slice(0, 3)}`));
        };
        socket.on('data', onData);
        socket.once('error', reject);
      });
    const command = async (value: string) => {
      socket.write(`${value}\r\n`);
      await readResponse();
    };

    try {
      await readResponse();
      await command('EHLO skill-maps.test');
      await command(`MAIL FROM:<${this.from}>`);
      await command(`RCPT TO:<${message.to}>`);
      await command('DATA');
      await command(`${smtpData(message, this.from)}\r\n.`);
      await command('QUIT');
    } finally {
      socket.destroy();
    }
  }
}

export function emailFromTemplate(to: string, template: EmailTemplate): TransactionalEmail {
  return { to, ...template };
}
