import { createServer, type Socket } from 'node:net';

export async function startLocalSmtp() {
  const sockets = new Set<Socket>();
  const messages: string[] = [];
  const recipients: string[] = [];
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let buffer = '';
    let message: string[] | undefined;
    socket.setEncoding('utf8');
    socket.write('220 localhost SMTP test\r\n');
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\r\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (message !== undefined) {
          if (line === '.') {
            messages.push(message.join('\r\n'));
            message = undefined;
            socket.write('250 Queued\r\n');
          } else {
            message.push(line);
          }
        } else if (/^(EHLO|HELO) /i.test(line)) {
          socket.write('250 localhost\r\n');
        } else if (/^MAIL FROM:/i.test(line)) {
          socket.write('250 Sender accepted\r\n');
        } else if (/^RCPT TO:/i.test(line)) {
          recipients.push(line);
          socket.write('250 Recipient accepted\r\n');
        } else if (line === 'DATA') {
          message = [];
          socket.write('354 End with a period\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 Goodbye\r\n');
        } else {
          socket.write('502 Command not supported\r\n');
        }
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Missing local SMTP port.');
  return {
    port: address.port,
    messages,
    recipients,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
