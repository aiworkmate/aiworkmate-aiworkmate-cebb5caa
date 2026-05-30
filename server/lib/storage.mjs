import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.mjs';

const emptyDb = {
  users: [],
  sessions: [],
  conversations: [],
  messages: [],
  memories: [],
  uploads: [],
  auditLogs: [],
  analytics: []
};

export class JsonStore {
  constructor(file = path.join(config.dataDir, 'workmate.db.json')) {
    this.file = file;
    this.data = null;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      this.data = { ...structuredClone(emptyDb), ...parsed };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.data = structuredClone(emptyDb);
      await this.flush();
    }
    return this;
  }

  snapshot() {
    return structuredClone(this.data ?? emptyDb);
  }

  async update(mutator) {
    this.writeQueue = this.writeQueue.then(async () => {
      const result = await mutator(this.data);
      await this.flush();
      return result;
    });
    return this.writeQueue;
  }

  async flush() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    await fs.rename(tmp, this.file);
  }
}

export async function createStore() {
  return new JsonStore().init();
}
