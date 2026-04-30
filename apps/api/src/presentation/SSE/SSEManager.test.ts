import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SSEManager } from './SSEManager.js';

describe('SSEManager', () => {
  let manager: SSEManager;

  beforeEach(() => {
    manager = new SSEManager();
  });

  function mockRes(id = 'client-1'): any {
    return {
      write: vi.fn(() => true),
      end: vi.fn(),
      locals: {},
    };
  }

  describe('subscribe / unsubscribe', () => {
    it('creates a room on first subscribe', () => {
      const res = mockRes();
      manager.subscribe('room-1', res);
      expect(manager['rooms'].has('room-1')).toBe(true);
    });

    it('adds client to existing room', () => {
      const res1 = mockRes('a');
      const res2 = mockRes('b');
      manager.subscribe('room-1', res1);
      manager.subscribe('room-1', res2);
      const room = manager['rooms'].get('room-1')!;
      expect(room.size).toBe(2);
    });

    it('uses clientId when provided', () => {
      const res = mockRes();
      manager.subscribe('room-1', res, 'my-client-id');
      const room = manager['rooms'].get('room-1')!;
      const client = [...room][0];
      expect(client.id).toBe('my-client-id');
    });

    it('uses anonymous when no clientId', () => {
      const res = mockRes();
      manager.subscribe('room-1', res);
      const room = manager['rooms'].get('room-1')!;
      const client = [...room][0];
      expect(client.id).toBe('anonymous');
    });

    it('unsubscribes a specific client', () => {
      const res1 = mockRes('a');
      const res2 = mockRes('b');
      manager.subscribe('room-1', res1, 'a');
      manager.subscribe('room-1', res2, 'b');
      manager.unsubscribe('room-1', res1);
      const room = manager['rooms'].get('room-1')!;
      expect(room.size).toBe(1);
    });

    it('removes empty room', () => {
      const res = mockRes();
      manager.subscribe('room-1', res);
      manager.unsubscribe('room-1', res);
      expect(manager['rooms'].has('room-1')).toBe(false);
    });

    it('unsubscribe on non-existent room is a no-op', () => {
      expect(() => manager.unsubscribe('ghost-room', mockRes())).not.toThrow();
    });
  });

  describe('broadcast', () => {
    it('sends event data to all clients', () => {
      const res1 = mockRes('a');
      const res2 = mockRes('b');
      manager.subscribe('room-1', res1, 'a');
      manager.subscribe('room-1', res2, 'b');

      manager.broadcast('room-1', { type: 'step', step: 'FETCH_IMAGES', progress: 50, timestamp: new Date().toISOString() });

      expect(res1.write).toHaveBeenCalledTimes(1);
      expect(res2.write).toHaveBeenCalledTimes(1);
      const sent = res1.write.mock.calls[0][0] as string;
      expect(sent).toContain('"type":"step"');
      expect(sent).toContain('"step":"FETCH_IMAGES"');
    });

    it('uses SSE format: data: JSON\\n\\n', () => {
      const res = mockRes();
      manager.subscribe('room-1', res);
      manager.broadcast('room-1', { type: 'complete', timestamp: new Date().toISOString() });
      const sent = res.write.mock.calls[0][0] as string;
      expect(sent).toMatch(/^data: .+\n\n$/);
    });

    it('does nothing when room has no clients', () => {
      expect(() => manager.broadcast('empty-room', { type: 'step', timestamp: new Date().toISOString() })).not.toThrow();
    });

    it('removes dead clients that fail to write', () => {
      const res1 = mockRes('a');
      const res2 = mockRes('b');
      res2.write.mockImplementationOnce(() => { throw new Error('connection closed'); });
      manager.subscribe('room-1', res1, 'a');
      manager.subscribe('room-1', res2, 'b');

      manager.broadcast('room-1', { type: 'heartbeat', timestamp: new Date().toISOString() });

      const room = manager['rooms'].get('room-1')!;
      expect(room.size).toBe(1);
      expect(res1.write).toHaveBeenCalled();
    });

    it('same res subscribed twice only appears once', () => {
      const res = mockRes();
      manager.subscribe('room-1', res);
      manager.subscribe('room-1', res);
      manager.broadcast('room-1', { type: 'heartbeat', timestamp: new Date().toISOString() });
      expect(res.write).toHaveBeenCalledTimes(1);
    });
  });

  describe('closeRoom', () => {
    it('removes all clients and deletes the room', () => {
      const res = mockRes();
      manager.subscribe('room-1', res);
      manager.closeRoom('room-1');
      expect(manager['rooms'].has('room-1')).toBe(false);
    });

    it('closeRoom on non-existent room is a no-op', () => {
      expect(() => manager.closeRoom('ghost')).not.toThrow();
    });
  });
});
