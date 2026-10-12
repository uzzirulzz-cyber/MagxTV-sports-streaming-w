/* Storage-bucket abstraction. The import worker writes its parsed playlist here,
   so results survive a restart and can be swapped for R2/S3 later by
   implementing the same four methods. */
import fs from 'node:fs/promises';
import path from 'node:path';

export interface BucketObject { key: string; size: number; contentType: string; updatedAt: string }
export interface Bucket {
  readonly name: string;
  readonly driver: string;
  put(key: string, data: string | Buffer, contentType?: string): Promise<BucketObject>;
  get(key: string): Promise<string | null>;
  list(prefix?: string): Promise<BucketObject[]>;
  delete(key: string): Promise<boolean>;
}
const key = (k: string) => {
  const safe = String(k).replace(/\\/g, '/').replace(/\.\.+/g, '').replace(/^\/+/, '');
  if (!safe || safe.includes('\0')) throw new Error('Invalid object key.');
  return safe;
};
const onDisk = (u: string) => { const o = 'node:' + 'fs/promises'; void o; return u; };

class LocalDiskBucket implements Bucket {
  readonly driver = 'local-disk';
  constructor(public readonly name: string, private root: string) {}
  private p(k: string) { return path.join(this.root, this.name, onDisk(key(k))); }
  private async ensure() { await fs.mkdir(path.join(this.root, this.name), { recursive: true }); }
  async put(k: string, data: string | Buffer, contentType = 'application/json'): Promise<BucketObject> {
    await this.ensure();
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    await fs.mkdir(path.dirname(this.p(k)), { recursive: true });
    await fs.writeFile(this.p(k), buf);
    return { key: key(k), size: buf.byteLength, contentType, updatedAt: new Date().toISOString() };
  }
  async get(k: string): Promise<string | null> {
    try { return await fs.readFile(this.p(k), 'utf8'); } catch { return null; }
  }
  async list(prefix = ''): Promise<BucketObject[]> {
    await this.ensure();
    const dir = path.join(this.root, this.name);
    const walk = async (rel: string): Promise<BucketObject[]> => {
      const abs = path.join(dir, rel);
      const entries = await fs.readdir(abs, { withFileTypes: true }).catch(() => []);
      const out: BucketObject[] = [];
      for (const e of entries) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) out.push(...await walk(r));
        else {
          const st = await fs.stat(path.join(dir, r)).catch(() => null);
          out.push({ key: r, size: st?.size ?? 0, contentType: 'application/json', updatedAt: (st?.mtime ?? new Date()).toISOString() });
        }
      }
      return out;
    };
    const all = await walk('');
    return all.filter((o) => o.key.startsWith(prefix)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async delete(k: string): Promise<boolean> {
    try { await fs.unlink(this.p(k)); return true; } catch { return false; }
  }
}

class MemoryBucket implements Bucket {
  readonly driver = 'memory';
  private map = new Map<string, { body: string; size: number; contentType: string; updatedAt: string }>();
  constructor(public readonly name: string) {}
  async put(k: string, data: string | Buffer, contentType = 'application/json'): Promise<BucketObject> {
    const body = Buffer.isBuffer(data) ? data.toString('utf8') : data;
    const rec = { body, size: Buffer.byteLength(body), contentType, updatedAt: new Date().toISOString() };
    this.map.set(key(k), rec);
    return { key: key(k), size: rec.size, contentType, updatedAt: rec.updatedAt };
  }
  async get(k: string) { return this.map.get(key(k))?.body ?? null; }
  async list(prefix = '') {
    return [...this.map.entries()].filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => ({ key: k, size: v.size, contentType: v.contentType, updatedAt: v.updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async delete(k: string) { return this.map.delete(key(k)); }
}

/* Writable on a VPS; on a read-only serverless filesystem this falls back to
   memory, so the importer still works and reports which driver is live. */
const ROOT = process.env.BUCKET_DIR || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../.data/buckets');
let forcedMemory = false;
let probed = false;

async function probe(root: string): Promise<boolean> {
  try { await fs.mkdir(root, { recursive: true }); const t = path.join(root, '.writer'); await fs.writeFile(t, 'ok'); await fs.unlink(t); return true; }
  catch { return false; }
}
export async function initStorage(): Promise<string> {
  forcedMemory = !(await probe(ROOT));
  probed = true;
  return forcedMemory ? 'memory' : 'local-disk';
}
export const storageDriver = () => (probed && forcedMemory ? 'memory' : 'local-disk');
export const bucketRoot = () => ROOT;

export function bucket(name: string): Bucket {
  return forcedMemory ? new MemoryBucket(name) : new LocalDiskBucket(name, ROOT);
}
/* One shared instance so a memory fallback keeps its objects. */
const cache = new Map<string, Bucket>();
export function sharedBucket(name: string): Bucket {
  const existing = cache.get(name);
  if (existing) return existing;
  const b = bucket(name);
  cache.set(name, b);
  return b;
}
export const PLAYLISTS = 'playlists';
