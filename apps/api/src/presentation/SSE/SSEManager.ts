import type { Response } from 'express';

type Client = { res: Response; id: string };

export class SSEManager {
  private rooms = new Map<string, Set<Client>>();

  subscribe(roomId: string, res: Response, clientId?: string): void {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    // Deduplicate by res object reference
    const room = this.rooms.get(roomId)!;
    for (const client of room) {
      if (client.res === res) return;
    }
    room.add({ res, id: clientId ?? res.locals.clientId ?? 'anonymous' });
  }

  unsubscribe(roomId: string, res: Response): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const client of room) {
      if (client.res === res) {
        room.delete(client);
        break;
      }
    }
    if (room.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  broadcast(roomId: string, event: SSEEvent): void {
    const room = this.rooms.get(roomId);
    if (!room || room.size === 0) return;

    const data = `data: ${JSON.stringify(event)}\n\n`;

    for (const client of room) {
      try {
        client.res.write(data);
      } catch {
        room.delete(client);
      }
    }
  }

  closeRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }
}

export interface SSEEvent {
  type: 'step' | 'progress' | 'error' | 'complete' | 'heartbeat';
  step?: string;
  progress?: number;
  message?: string;
  data?: unknown;
  timestamp: string;
}

export const sseManager = new SSEManager();