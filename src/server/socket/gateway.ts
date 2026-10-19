import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

export class SocketGateway {
  private static wss: WebSocketServer | null = null;
  private static clients: Set<WebSocket> = new Set();

  public static init(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send initial welcome
      ws.send(JSON.stringify({ type: 'CONNECTED', data: { timestamp: new Date().toISOString() } }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('[WebSocket] client error:', err.message);
        this.clients.delete(ws);
      });
    });

    console.log('[WebSocket] Gateway initialized on /ws');
  }

  public static broadcast(type: string, data: any) {
    if (!this.wss) return;
    const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}
