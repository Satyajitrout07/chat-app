export class MockDocRef {
  constructor(private store: MockFirestore, public path: string) {}

  async set(data: any, options?: { merge?: boolean }): Promise<void> {
    this.store.setDoc(this.path, data, options?.merge);
  }

  async update(data: any): Promise<void> {
    const existing = this.store.getDoc(this.path);
    if (!existing) {
      throw new Error(`NOT_FOUND: Document at ${this.path} does not exist.`);
    }
    this.store.updateDoc(this.path, data);
  }

  async get(): Promise<MockDocSnapshot> {
    const data = this.store.getDoc(this.path);
    return new MockDocSnapshot(this.path, data);
  }

  collection(subCollectionName: string): MockCollectionRef {
    return new MockCollectionRef(this.store, `${this.path}/${subCollectionName}`);
  }
}

export class MockDocSnapshot {
  constructor(public id: string, private _data: any) {}

  get exists(): boolean {
    return this._data !== undefined && this._data !== null;
  }

  data(): any {
    return this._data ? JSON.parse(JSON.stringify(this._data)) : undefined;
  }
}

export class MockQuery {
  protected orderField?: string;
  protected orderDirection: 'asc' | 'desc' = 'asc';
  protected limitCount?: number;

  constructor(protected store: MockFirestore, protected collectionPath: string) {}

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): MockQuery {
    const q = new MockQuery(this.store, this.collectionPath);
    q.orderField = field;
    q.orderDirection = direction;
    q.limitCount = this.limitCount;
    return q;
  }

  limit(n: number): MockQuery {
    const q = new MockQuery(this.store, this.collectionPath);
    q.orderField = this.orderField;
    q.orderDirection = this.orderDirection;
    q.limitCount = n;
    return q;
  }

  async get(): Promise<{ docs: MockDocSnapshot[] }> {
    let docs = this.store.getDocsInCollection(this.collectionPath);

    if (this.orderField) {
      const field = this.orderField;
      const dir = this.orderDirection;
      docs.sort((a, b) => {
        const valA = a.data()?.[field] ?? 0;
        const valB = b.data()?.[field] ?? 0;
        const timeA = typeof valA === 'string' ? new Date(valA).getTime() : Number(valA);
        const timeB = typeof valB === 'string' ? new Date(valB).getTime() : Number(valB);
        return dir === 'asc' ? timeA - timeB : timeB - timeA;
      });
    }

    if (this.limitCount !== undefined) {
      docs = docs.slice(0, this.limitCount);
    }

    return { docs };
  }
}

export class MockCollectionRef extends MockQuery {
  constructor(store: MockFirestore, collectionPath: string) {
    super(store, collectionPath);
  }

  doc(id: string): MockDocRef {
    return new MockDocRef(this.store, `${this.collectionPath}/${id}`);
  }
}

export class MockFirestore {
  private data: Map<string, any> = new Map();

  collection(collectionName: string): MockCollectionRef {
    return new MockCollectionRef(this, collectionName);
  }

  getDoc(path: string): any {
    return this.data.get(path);
  }

  setDoc(path: string, data: any, merge = false): void {
    if (merge) {
      const existing = this.data.get(path) || {};
      this.data.set(path, { ...existing, ...this.resolveFieldValues(data, existing) });
    } else {
      this.data.set(path, this.resolveFieldValues(data));
    }
  }

  updateDoc(path: string, updates: any): void {
    const existing = JSON.parse(JSON.stringify(this.data.get(path) || {}));
    const resolved = this.resolveFieldValues(updates, existing);

    for (const key of Object.keys(resolved)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let current = existing;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = resolved[key];
      } else {
        existing[key] = resolved[key];
      }
    }

    this.data.set(path, existing);
  }

  getDocsInCollection(collectionPath: string): MockDocSnapshot[] {
    const results: MockDocSnapshot[] = [];
    for (const [key, val] of this.data.entries()) {
      const lastSlash = key.lastIndexOf('/');
      const parentPath = lastSlash !== -1 ? key.substring(0, lastSlash) : '';
      const docId = lastSlash !== -1 ? key.substring(lastSlash + 1) : key;

      if (parentPath === collectionPath) {
        results.push(new MockDocSnapshot(docId, val));
      }
    }
    return results;
  }

  private resolveFieldValues(data: any, existing: any = {}): any {
    const resolved: any = { ...data };
    for (const key of Object.keys(resolved)) {
      const val = resolved[key];
      if (val && typeof val === 'object' && val.__mockFieldValue) {
        if (val.type === 'serverTimestamp') {
          resolved[key] = new Date().toISOString();
        } else if (val.type === 'arrayUnion') {
          const currentArr = Array.isArray(existing[key]) ? existing[key] : [];
          resolved[key] = Array.from(new Set([...currentArr, ...val.elements]));
        }
      }
    }
    return resolved;
  }

  clear(): void {
    this.data.clear();
  }
}

export const MockFieldValue = {
  serverTimestamp: () => ({ __mockFieldValue: true, type: 'serverTimestamp' }),
  arrayUnion: (...elements: any[]) => ({ __mockFieldValue: true, type: 'arrayUnion', elements }),
};
