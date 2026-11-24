import { Pool, PoolConfig } from 'pg';
import { config } from '../config/env';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount?: number | null;
}

export interface IDbClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  close(): Promise<void>;
  testConnection(): Promise<boolean>;
}

export class PostgresClient implements IDbClient {
  private pool: Pool;

  constructor(poolConfig?: PoolConfig) {
    if (config.database.url) {
      this.pool = new Pool({
        connectionString: config.database.url,
        ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
      });
    } else {
      this.pool = new Pool(
        poolConfig || {
          host: config.database.host,
          port: config.database.port,
          user: config.database.user,
          password: config.database.password,
          database: config.database.database,
          ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
        }
      );
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const res = await this.pool.query(sql, params);
    return {
      rows: res.rows,
      rowCount: res.rowCount,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * In-memory relational database client mock for testing or running without active Postgres server
 */
export class MemoryRelationalClient implements IDbClient {
  private users: Map<string, { id: string; name: string; email?: string; created_at: Date }> = new Map();
  private chats: Map<string, { id: string; type: string; name?: string; created_at: Date; updated_at: Date }> = new Map();
  private chatMembers: Array<{ chat_id: string; user_id: string; role: string; joined_at: Date }> = [];

  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    const normalized = sql.trim().toLowerCase();

    // SELECT 1
    if (normalized === 'select 1') {
      return { rows: [{ '?column?': 1 }] as unknown as T[], rowCount: 1 };
    }

    // Insert user
    if (normalized.startsWith('insert into users')) {
      const [id, name, email] = params;
      const user = { id, name: name || id, email, created_at: new Date() };
      this.users.set(id, user);
      return { rows: [user as unknown as T], rowCount: 1 };
    }

    // Select user
    if (normalized.startsWith('select') && normalized.includes('from users where id = $1')) {
      const user = this.users.get(params[0]);
      return { rows: user ? [user as unknown as T] : [], rowCount: user ? 1 : 0 };
    }

    // Find direct chat between two users
    if (normalized.includes('chats') && normalized.includes('chat_members') && normalized.includes("type = 'direct'")) {
      const [userA, userB] = params;
      const chatIdsA = new Set(this.chatMembers.filter(m => m.user_id === userA).map(m => m.chat_id));
      const sharedChatId = this.chatMembers.find(m => m.user_id === userB && chatIdsA.has(m.chat_id));
      if (sharedChatId) {
        const chat = this.chats.get(sharedChatId.chat_id);
        if (chat && chat.type === 'direct') {
          return { rows: [chat as unknown as T], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // Insert into chats
    if (normalized.startsWith('insert into chats')) {
      const [id, type, name] = params;
      const now = new Date();
      const chat = { id, type: type || 'direct', name, created_at: now, updated_at: now };
      this.chats.set(id, chat);
      return { rows: [chat as unknown as T], rowCount: 1 };
    }

    // Insert into chat_members
    if (normalized.startsWith('insert into chat_members')) {
      const [chatId, userId, role] = params;
      const member = { chat_id: chatId, user_id: userId, role: role || 'member', joined_at: new Date() };
      const existing = this.chatMembers.findIndex(m => m.chat_id === chatId && m.user_id === userId);
      if (existing >= 0) {
        this.chatMembers[existing] = member;
      } else {
        this.chatMembers.push(member);
      }
      return { rows: [member as unknown as T], rowCount: 1 };
    }

    // List user chats with member IDs
    if (normalized.includes('from chat_members cm1') && normalized.includes('array_agg')) {
      const userId = params[0];
      const userChatIds = this.chatMembers.filter(m => m.user_id === userId).map(m => m.chat_id);
      const result: any[] = [];

      for (const chatId of userChatIds) {
        const chat = this.chats.get(chatId);
        if (!chat) continue;
        const members = this.chatMembers.filter(m => m.chat_id === chatId).map(m => m.user_id);
        result.push({
          chatId: chat.id,
          type: chat.type,
          name: chat.name || null,
          createdAt: chat.created_at,
          memberIds: members,
        });
      }
      return { rows: result as T[], rowCount: result.length };
    }

    // Check member in chat
    if (normalized.includes('from chat_members where chat_id = $1 and user_id = $2')) {
      const [chatId, userId] = params;
      const found = this.chatMembers.some(m => m.chat_id === chatId && m.user_id === userId);
      return { rows: found ? [{ exists: 1 } as unknown as T] : [], rowCount: found ? 1 : 0 };
    }

    // Get chat by ID
    if (normalized.startsWith('select') && normalized.includes('from chats where id = $1')) {
      const chat = this.chats.get(params[0]);
      return { rows: chat ? [chat as unknown as T] : [], rowCount: chat ? 1 : 0 };
    }

    // Get chat members
    if (normalized.startsWith('select') && normalized.includes('from chat_members where chat_id = $1')) {
      const members = this.chatMembers.filter(m => m.chat_id === params[0]).map(m => ({ user_id: m.user_id }));
      return { rows: members as unknown as T[], rowCount: members.length };
    }

    return { rows: [], rowCount: 0 };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {}
}

let dbInstance: IDbClient | null = null;

export function getDbClient(): IDbClient {
  if (!dbInstance) {
    if (config.useMockServices) {
      dbInstance = new MemoryRelationalClient();
    } else {
      dbInstance = new PostgresClient();
    }
  }
  return dbInstance;
}

export function setDbClient(client: IDbClient): void {
  dbInstance = client;
}
