/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * localdb.ts — Lapisan database dokumen.
 *
 * Dua backend otomatis:
 *  1. Cloudflare D1 (saat jalan di Workers/Pages via @opennextjs/cloudflare)
 *  2. File JSON lokal di <project>/data/*.json (saat dev / VM)
 *
 * API mirip Mongoose: find/findOne/findById/create/update/delete/count
 * + chainable sort/select/skip/limit/populate/lean.
 */

export type Doc = Record<string, any>;

/* ---------------- backend abstraction ---------------- */

interface Backend {
    readAll(collection: string): Promise<Doc[]>;
    writeAll(collection: string, docs: Doc[]): Promise<void>;
}

/** Backend file JSON — untuk dev lokal & VM. */
class JsonBackend implements Backend {
    private fs: any;
    private path: any;
    private dir!: string;

    private async mods() {
        if (!this.fs) {
            this.fs = await import('fs');
            this.path = await import('path');
            this.dir = process.env.GTSHOP_DATA_DIR || this.path.join(process.cwd(), 'data');
        }
        return this;
    }

    async readAll(name: string): Promise<Doc[]> {
        const { fs, path, dir } = await this.mods();
        const f = path.join(dir, `${name}.json`);
        if (!fs.existsSync(f)) return [];
        try {
            const raw = fs.readFileSync(f, 'utf8').trim();
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    async writeAll(name: string, docs: Doc[]): Promise<void> {
        const { fs, path, dir } = await this.mods();
        fs.mkdirSync(dir, { recursive: true });
        const f = path.join(dir, `${name}.json`);
        const tmp = `${f}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(docs, null, 2), 'utf8');
        fs.renameSync(tmp, f);
    }
}

/** Tipe struktural minimal untuk binding D1. */
interface D1PreparedStatementLike {
    bind(...values: unknown[]): D1PreparedStatementLike;
    all(): Promise<{ results: Array<Record<string, unknown>> }>;
    run(): Promise<unknown>;
}
interface D1DatabaseLike {
    prepare(query: string): D1PreparedStatementLike;
    batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
    exec(query: string): Promise<unknown>;
}

/** Backend Cloudflare D1 — satu tabel untuk semua koleksi. */
class D1Backend implements Backend {
    private ready: Promise<unknown> | null = null;

    constructor(private db: D1DatabaseLike) {}

    private ensureTable(): Promise<unknown> {
        if (!this.ready) {
            this.ready = this.db.exec(
                'CREATE TABLE IF NOT EXISTS gtshop_docs (collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (collection, id))'
            );
        }
        return this.ready;
    }

    async readAll(collection: string): Promise<Doc[]> {
        await this.ensureTable();
        const res = await this.db
            .prepare('SELECT data FROM gtshop_docs WHERE collection = ?')
            .bind(collection)
            .all();
        const out: Doc[] = [];
        for (const row of res.results) {
            try {
                out.push(JSON.parse(String(row.data)));
            } catch { /* skip baris korup */ }
        }
        return out;
    }

    async writeAll(collection: string, docs: Doc[]): Promise<void> {
        await this.ensureTable();
        const stmts: D1PreparedStatementLike[] = [
            this.db.prepare('DELETE FROM gtshop_docs WHERE collection = ?').bind(collection),
        ];
        for (const d of docs) {
            stmts.push(
                this.db
                    .prepare('INSERT INTO gtshop_docs (collection, id, data) VALUES (?, ?, ?)')
                    .bind(collection, String(d._id), JSON.stringify(d))
            );
        }
        await this.db.batch(stmts);
    }
}

let backendPromise: Promise<Backend> | null = null;

/** Pilih backend: D1 bila ada binding Cloudflare, selain itu JSON lokal. */
function getBackend(): Promise<Backend> {
    if (!backendPromise) {
        backendPromise = (async (): Promise<Backend> => {
            try {
                const mod = await import('@opennextjs/cloudflare');
                const ctx = await mod.getCloudflareContext();
                const db = (ctx.env as Record<string, unknown>).DB as D1DatabaseLike | undefined;
                if (db && typeof db.prepare === 'function') {
                    return new D1Backend(db);
                }
            } catch {
                // bukan di runtime Cloudflare -> pakai JSON lokal
            }
            return new JsonBackend();
        })();
    }
    return backendPromise;
}

export function generateId(): string {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 10) +
        Math.random().toString(36).slice(2, 6)
    );
}

const nowIso = () => new Date().toISOString();

/* ---------------- pencocokan query ---------------- */

function getPath(doc: Doc, p: string): any {
    return p.split('.').reduce((o, k) => (o == null ? o : o[k]), doc);
}

function matchOperator(val: any, op: string, expected: any): boolean {
    switch (op) {
        case '$eq': return eq(val, expected);
        case '$ne': return !eq(val, expected);
        case '$in': return Array.isArray(expected) && expected.some((e) => eq(val, e));
        case '$nin': return Array.isArray(expected) && !expected.some((e) => eq(val, e));
        case '$gt': return cmp(val, expected) > 0;
        case '$gte': return cmp(val, expected) >= 0;
        case '$lt': return cmp(val, expected) < 0;
        case '$lte': return cmp(val, expected) <= 0;
        case '$exists': return expected ? val !== undefined : val === undefined;
        case '$regex': {
            const re = expected instanceof RegExp ? expected : new RegExp(String(expected), 'i');
            return re.test(String(val ?? ''));
        }
        default: return false;
    }
}

function eq(a: any, b: any): boolean {
    if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
    return a === b;
}

function cmp(a: any, b: any): number {
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    if (!Number.isNaN(da) && !Number.isNaN(db) && (typeof a === 'string' || a instanceof Date)) {
        return da - db;
    }
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

export function matchQuery(doc: Doc, query: Doc): boolean {
    if (!query || Object.keys(query).length === 0) return true;
    for (const [key, cond] of Object.entries(query)) {
        if (key === '$or') {
            if (!Array.isArray(cond) || !cond.some((q) => matchQuery(doc, q))) return false;
            continue;
        }
        if (key === '$and') {
            if (!Array.isArray(cond) || !cond.every((q) => matchQuery(doc, q))) return false;
            continue;
        }
        if (key === '$nor') {
            if (!Array.isArray(cond) || cond.some((q) => matchQuery(doc, q))) return false;
            continue;
        }
        const val = getPath(doc, key);
        if (cond !== null && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond) &&
            Object.keys(cond).some((k) => k.startsWith('$'))) {
            for (const [op, expected] of Object.entries(cond)) {
                if (!matchOperator(val, op, expected)) return false;
            }
        } else {
            if (!eq(val, cond)) return false;
        }
    }
    return true;
}

/* ---------------- update ---------------- */

function applyUpdate(doc: Doc, update: Doc): Doc {
    const out: Doc = { ...doc };
    const ops = Object.keys(update).filter((k) => k.startsWith('$'));
    if (ops.length === 0) {
        for (const [k, v] of Object.entries(update)) {
            if (k !== '_id') out[k] = v;
        }
    } else {
        for (const op of ops) {
            const fields = update[op] as Doc;
            if (op === '$set') {
                for (const [k, v] of Object.entries(fields)) out[k] = v;
            } else if (op === '$inc') {
                for (const [k, v] of Object.entries(fields)) out[k] = (Number(out[k]) || 0) + Number(v);
            } else if (op === '$push') {
                for (const [k, v] of Object.entries(fields)) {
                    if (!Array.isArray(out[k])) out[k] = [];
                    out[k] = [...out[k], v];
                }
            } else if (op === '$pull') {
                for (const [k, v] of Object.entries(fields)) {
                    if (Array.isArray(out[k])) out[k] = out[k].filter((x: any) => !eq(x, v));
                }
            } else if (op === '$unset') {
                for (const k of Object.keys(fields)) delete out[k];
            }
        }
    }
    out.updatedAt = nowIso();
    return out;
}

/* ---------------- populate ---------------- */

export type RefMap = Record<string, string>;

async function populateDocs(docs: Doc[], refs: RefMap, path: string, fields?: string): Promise<Doc[]> {
    const target = refs[path];
    if (!target) return docs;
    const backend = await getBackend();
    const wanted = fields ? fields.split(' ').filter(Boolean) : null;
    const all = await backend.readAll(target);
    return docs.map((d) => {
        const refId = getPath(d, path);
        if (!refId) return d;
        const found = all.find((t) => String(t._id) === String(refId));
        if (!found) return d;
        const picked: Doc = { _id: found._id };
        if (wanted) {
            for (const f of wanted) if (found[f] !== undefined) picked[f] = found[f];
        } else {
            Object.assign(picked, found);
        }
        return { ...d, [path]: picked };
    });
}

/* ---------------- Query chainable ---------------- */

export class Query {
    private _sort?: [string, 1 | -1][];
    private _skip = 0;
    private _limit?: number;
    private _excludes: string[] = [];
    private _includes?: string[];
    private _populates: { path: string; fields?: string }[] = [];

    constructor(private name: string, private query: Doc, private refs: RefMap) {}

    sort(spec: Record<string, 1 | -1 | 'asc' | 'desc'>): this {
        this._sort = Object.entries(spec).map(([k, v]) => [k, v === -1 || v === 'desc' ? -1 : 1] as [string, 1 | -1]);
        return this;
    }
    select(sel: Record<string, 0 | 1> | string): this {
        if (typeof sel === 'string') {
            // Mongoose-style: 'a b c' = inklusi, '-a -b' = eksklusi.
            const parts = sel.split(/\s+/).filter(Boolean);
            const includes = parts.filter((p) => !p.startsWith('-'));
            const excludes = parts.filter((p) => p.startsWith('-')).map((p) => p.slice(1));
            if (includes.length > 0) this._includes = includes;
            for (const e of excludes) {
                if (!this._excludes.includes(e)) this._excludes.push(e);
            }
            return this;
        }
        this._excludes = Object.entries(sel).filter(([, v]) => v === 0).map(([k]) => k);
        return this;
    }
    skip(n: number): this { this._skip = n; return this; }
    limit(n: number): this { this._limit = n; return this; }
    populate(path: string, fields?: string): this {
        this._populates.push({ path, fields });
        return this;
    }
    async exec(): Promise<Doc[]> {
        const backend = await getBackend();
        let docs = (await backend.readAll(this.name)).filter((d) => matchQuery(d, this.query));
        if (this._sort) {
            const specs = this._sort;
            docs = [...docs].sort((a, b) => {
                for (const [k, dir] of specs) {
                    const c = cmp(getPath(a, k), getPath(b, k));
                    if (c !== 0) return c * dir;
                }
                return 0;
            });
        }
        if (this._skip) docs = docs.slice(this._skip);
        if (this._limit !== undefined) docs = docs.slice(0, this._limit);
        for (const p of this._populates) docs = await populateDocs(docs, this.refs, p.path, p.fields);
        if (this._includes && this._includes.length > 0) {
            const inc = this._includes;
            docs = docs.map((d) => {
                const c: Doc = {};
                for (const k of inc) if (k in d) c[k] = (d as Doc)[k];
                // _id selalu ikut kecuali diminta eksplisit
                if (!inc.includes('_id') && !this._excludes.includes('_id') && '_id' in d) {
                    c['_id'] = (d as Doc)['_id'];
                }
                for (const k of this._excludes) delete c[k];
                return stripSave(c);
            });
        } else if (this._excludes.length > 0) {
            docs = docs.map((d) => {
                const c = { ...d };
                for (const k of this._excludes) delete c[k];
                return stripSave(c);
            });
        } else {
            docs = docs.map((d) => stripSave(d));
        }
        return docs;
    }
    then(onF: (v: Doc[]) => any, onR?: (e: any) => any): Promise<any> {
        return this.exec().then(onF, onR);
    }
    lean(): Promise<Doc[]> { return this.exec(); }
}

export class SingleQuery {
    private _populates: { path: string; fields?: string }[] = [];
    private _excludes: string[] = [];
    private _includes?: string[];
    constructor(private name: string, private query: Doc, private refs: RefMap) {}
    populate(path: string, fields?: string): this {
        this._populates.push({ path, fields });
        return this;
    }
    select(sel: Record<string, 0 | 1> | string): this {
        if (typeof sel === 'string') {
            const parts = sel.split(/\s+/).filter(Boolean);
            const includes = parts.filter((p) => !p.startsWith('-'));
            const excludes = parts.filter((p) => p.startsWith('-')).map((p) => p.slice(1));
            if (includes.length > 0) this._includes = includes;
            for (const e of excludes) {
                if (!this._excludes.includes(e)) this._excludes.push(e);
            }
            return this;
        }
        this._excludes = Object.entries(sel).filter(([, v]) => v === 0).map(([k]) => k);
        return this;
    }
    async exec(): Promise<Doc | null> {
        const backend = await getBackend();
        let docs = (await backend.readAll(this.name)).filter((d) => matchQuery(d, this.query));
        for (const p of this._populates) docs = await populateDocs(docs, this.refs, p.path, p.fields);
        const found = docs[0] ?? null;
        if (!found) return null;
        let c: Doc;
        if (this._includes && this._includes.length > 0) {
            c = {};
            for (const k of this._includes) if (k in found) c[k] = found[k];
            if (!this._includes.includes('_id') && !this._excludes.includes('_id') && '_id' in found) {
                c['_id'] = found['_id'];
            }
        } else {
            c = { ...found };
        }
        for (const k of this._excludes) delete c[k];
        return withSave(this.name, c);
    }
    then(onF: (v: Doc | null) => any, onR?: (e: any) => any): Promise<any> {
        return this.exec().then(onF, onR);
    }
    async lean(): Promise<Doc | null> {
        const d = await this.exec();
        return d ? stripSave(d) : null;
    }
}

function withSave(name: string, doc: Doc): Doc {
    if (!doc || typeof doc.save === 'function') return doc;
    Object.defineProperty(doc, 'save', {
        value: async function () {
            const backend = await getBackend();
            const all = await backend.readAll(name);
            const i = all.findIndex((d) => String(d._id) === String(doc._id));
            const clean = stripSave({ ...doc, updatedAt: nowIso() });
            if (i >= 0) all[i] = clean; else all.push(clean);
            await backend.writeAll(name, all);
            return doc;
        },
        enumerable: false,
        writable: true,
        configurable: true,
    });
    return doc;
}

function stripSave(doc: Doc): Doc {
    if (doc && typeof doc.save === 'function') {
        const c = { ...doc };
        delete (c as any).save;
        return c;
    }
    return doc;
}

/* ---------------- koleksi ---------------- */

export interface Collection {
    find(query?: Doc): Query;
    findOne(query?: Doc): SingleQuery;
    findById(id: string): SingleQuery;
    create(data: Doc): Promise<Doc>;
    findByIdAndUpdate(id: string, update: Doc, opts?: { new?: boolean }): Promise<Doc | null>;
    findByIdAndDelete(id: string): Promise<Doc | null>;
    updateOne(filter: Doc, update: Doc): Promise<{ modifiedCount: number }>;
    updateMany(filter: Doc, update: Doc): Promise<{ modifiedCount: number }>;
    deleteOne(filter: Doc): Promise<{ deletedCount: number }>;
    deleteMany(filter?: Doc): Promise<{ deletedCount: number }>;
    countDocuments(query?: Doc): Promise<number>;
}

export function collection(name: string, refs: RefMap = {}): Collection {
    return {
        find: (query: Doc = {}) => new Query(name, query, refs),
        findOne: (query: Doc = {}) => new SingleQuery(name, query, refs),
        findById: (id: string) => new SingleQuery(name, { _id: String(id) }, refs),
        create: async (data: Doc) => {
            const backend = await getBackend();
            const all = await backend.readAll(name);
            const doc: Doc = {
                _id: data._id ? String(data._id) : generateId(),
                ...data,
                createdAt: data.createdAt || nowIso(),
                updatedAt: nowIso(),
            };
            all.push(stripSave(doc));
            await backend.writeAll(name, all);
            return withSave(name, { ...doc });
        },
        findByIdAndUpdate: async (id: string, update: Doc, opts: { new?: boolean } = {}) => {
            const backend = await getBackend();
            const all = await backend.readAll(name);
            const i = all.findIndex((d) => String(d._id) === String(id));
            if (i < 0) return null;
            const before = { ...all[i] };
            all[i] = applyUpdate(all[i], update);
            await backend.writeAll(name, all);
            const result = opts.new ? all[i] : before;
            return withSave(name, { ...result });
        },
        findByIdAndDelete: async (id: string) => {
            const backend = await getBackend();
            const all = await backend.readAll(name);
            const i = all.findIndex((d) => String(d._id) === String(id));
            if (i < 0) return null;
            const [removed] = all.splice(i, 1);
            await backend.writeAll(name, all);
            return stripSave(removed);
        },
        updateOne: async (filter: Doc, update: Doc) => {
            const backend = await getBackend();
            const all = await backend.readAll(name);
            const i = all.findIndex((d) => matchQuery(d, filter));
            if (i < 0) return { modifiedCount: 0 };
            all[i] = applyUpdate(all[i], update);
            await backend.writeAll(name, all);
            return { modifiedCount: 1 };
        },
        updateMany: async (filter: Doc, update: Doc) => {
            const backend = await getBackend();
            const all = await backend.readAll(name);
            let n = 0;
            for (let i = 0; i < all.length; i++) {
                if (matchQuery(all[i], filter)) { all[i] = applyUpdate(all[i], update); n++; }
            }
            if (n > 0) await backend.writeAll(name, all);
            return { modifiedCount: n };
        },
        deleteOne: async (filter: Doc) => {
            const backend = await getBackend();
            const all = await backend.readAll(name);
            const i = all.findIndex((d) => matchQuery(d, filter));
            if (i < 0) return { deletedCount: 0 };
            all.splice(i, 1);
            await backend.writeAll(name, all);
            return { deletedCount: 1 };
        },
        deleteMany: async (filter: Doc = {}) => {
            const backend = await getBackend();
            const all = await backend.readAll(name);
            const kept = all.filter((d) => !matchQuery(d, filter));
            const n = all.length - kept.length;
            if (n > 0) await backend.writeAll(name, kept);
            return { deletedCount: n };
        },
        countDocuments: async (query: Doc = {}) => {
            const backend = await getBackend();
            return (await backend.readAll(name)).filter((d) => matchQuery(d, query)).length;
        },
    };
}

/** Koneksi database — memastikan backend siap. */
export async function connectDB(): Promise<void> {
    await getBackend();
}

export default connectDB;
