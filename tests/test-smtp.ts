import { createServer, type Socket, type AddressInfo } from "node:net";

/** Local-only SMTP sink for tests. It never forwards or delivers any message. */
export async function startTestSmtp() {
  const messages: string[] = []; const sockets = new Set<Socket>(); const state = { reject: false };
  const server = createServer(socket => {
    sockets.add(socket); socket.on("close", () => sockets.delete(socket)); socket.setEncoding("utf8");
    socket.write("220 local-test SMTP\r\n");
    let buffer = "", data = ""; let readingData = false;
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      let index: number;
      while ((index = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 2);
        if (readingData) {
          if (line === ".") { messages.push(data); readingData = false; data = ""; socket.write("250 queued for TEST ONLY\r\n"); }
          else data += (line.startsWith("..") ? line.slice(1) : line) + "\r\n";
        } else if (/^(EHLO|HELO)/.test(line)) socket.write("250-local-test\r\n250-AUTH PLAIN\r\n250 SIZE 30000000\r\n");
        else if (line.startsWith("AUTH")) socket.write("235 authenticated for TEST ONLY\r\n");
        else if (line.startsWith("RCPT")) socket.write(state.reject ? "550 recipient refused\r\n" : "250 ok\r\n");
        else if (line === "DATA") { readingData = true; socket.write("354 send message\r\n"); }
        else if (line === "QUIT") socket.end("221 goodbye\r\n");
        else socket.write("250 ok\r\n");
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { messages, state, port, close: async () => { sockets.forEach(socket => socket.destroy()); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
}
