import { describe, it, expect } from 'vitest';
import { FileSystemProjectStore } from './FileSystemProjectStore.js';
import type { VideoProject } from '@vidtoolkits/shared';
import { withProjectsDir } from '../../__tests__/helpers/tempDir.js';
import { makeVideoProject } from '../../__tests__/helpers/factories.js';

describe('FileSystemProjectStore', () => {
  describe('save', () => {
    it('writes project to disk as JSON', async () => {
      await withProjectsDir(async (dir) => {
        const store = new FileSystemProjectStore(dir);
        const project = makeVideoProject({ id: 'proj-save-1', title: 'Save Test' });
        await store.save(project);

        const read = await import('node:fs/promises');
        const content = await read.readFile(`${dir}/proj-save-1.json`, 'utf-8');
        const parsed = JSON.parse(content) as VideoProject;
        expect(parsed.id).toBe('proj-save-1');
        expect(parsed.title).toBe('Save Test');
      });
    });

    it('overwrites existing project with same ID', async () => {
      await withProjectsDir(async (dir) => {
        const store = new FileSystemProjectStore(dir);
        const p1 = makeVideoProject({ id: 'overwrite-1', title: 'Original' });
        const p2 = makeVideoProject({ id: 'overwrite-1', title: 'Updated' });
        await store.save(p1);
        await store.save(p2);

        const retrieved = await store.get('overwrite-1');
        expect(retrieved!.title).toBe('Updated');
      });
    });
  });

  describe('get', () => {
    it('returns project when found', async () => {
      await withProjectsDir(async (dir) => {
        const store = new FileSystemProjectStore(dir);
        const project = makeVideoProject({ id: 'proj-get-1', title: 'Get Test' });
        await store.save(project);

        const retrieved = await store.get('proj-get-1');
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe('proj-get-1');
        expect(retrieved!.title).toBe('Get Test');
      });
    });

    it('returns null on ENOENT', async () => {
      await withProjectsDir(async (dir) => {
        const store = new FileSystemProjectStore(dir);
        const result = await store.get('nonexistent-id');
        expect(result).toBeNull();
      });
    });

    it('throws on malformed JSON', async () => {
      await withProjectsDir(async (dir) => {
        const store = new FileSystemProjectStore(dir);
        const read = await import('node:fs/promises');
        await read.writeFile(`${dir}/bad.json`, 'not valid json{', 'utf-8');
        await expect(store.get('bad')).rejects.toThrow();
      });
    });
  });

  describe('list', () => {
    it('returns all projects sorted by createdAt descending', async () => {
      await withProjectsDir(async (dir) => {
        const store = new FileSystemProjectStore(dir);
        const p1 = makeVideoProject({ id: 'list-a', title: 'First', createdAt: '2024-01-01T00:00:00.000Z' });
        const p2 = makeVideoProject({ id: 'list-b', title: 'Second', createdAt: '2024-02-01T00:00:00.000Z' });
        const p3 = makeVideoProject({ id: 'list-c', title: 'Third', createdAt: '2024-01-15T00:00:00.000Z' });

        await store.save(p3);
        await store.save(p1);
        await store.save(p2);

        const list = await store.list();
        expect(list.map((p) => p.id)).toEqual(['list-b', 'list-c', 'list-a']);
      });
    });

    it('skips non-.json files', async () => {
      await withProjectsDir(async (dir) => {
        const store = new FileSystemProjectStore(dir);
        const read = await import('node:fs/promises');
        await read.writeFile(`${dir}/readme.txt`, 'hello', 'utf-8');
        await read.writeFile(`${dir}/proj-only.json`, JSON.stringify(makeVideoProject({ id: 'only-json' })), 'utf-8');

        const list = await store.list();
        expect(list.map((p) => p.id)).toEqual(['only-json']);
      });
    });

    it('skips malformed JSON files', async () => {
      await withProjectsDir(async (dir) => {
        const store = new FileSystemProjectStore(dir);
        const read = await import('node:fs/promises');
        await read.writeFile(`${dir}/bad.json`, 'broken', 'utf-8');
        await read.writeFile(`${dir}/good.json`, JSON.stringify(makeVideoProject({ id: 'good-id' })), 'utf-8');

        const list = await store.list();
        expect(list.map((p) => p.id)).toEqual(['good-id']);
      });
    });

    it('returns empty array when directory is empty', async () => {
      await withProjectsDir(async (dir) => {
        const store = new FileSystemProjectStore(dir);
        const list = await store.list();
        expect(list).toEqual([]);
      });
    });
  });

  describe('delete', () => {
    it('deletes a project file', async () => {
      await withProjectsDir(async (dir) => {
        const store = new FileSystemProjectStore(dir);
        const project = makeVideoProject({ id: 'to-delete' });
        await store.save(project);
        await store.delete('to-delete');

        const result = await store.get('to-delete');
        expect(result).toBeNull();
      });
    });

    it('deleting nonexistent file does not throw', async () => {
      await withProjectsDir(async (dir) => {
        const store = new FileSystemProjectStore(dir);
        await expect(store.delete('ghost')).resolves.not.toThrow();
      });
    });
  });
});
