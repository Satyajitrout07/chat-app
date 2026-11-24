import crypto from 'crypto';
import { getDbClient, IDbClient } from '../db';

export interface ChatRecord {
  id: string;
  type: 'direct' | 'group';
  name?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserChatSummary {
  chatId: string;
  type: string;
  name?: string | null;
  createdAt: string | Date;
  memberIds: string[];
}

export class ChatRepository {
  private db: IDbClient;

  constructor(dbClient?: IDbClient) {
    this.db = dbClient || getDbClient();
  }

  async ensureUserExists(userId: string, name?: string, email?: string): Promise<void> {
    const existing = await this.db.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (existing.rows.length === 0) {
      await this.db.query(
        'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
        [userId, name || `User_${userId}`, email || `${userId}@example.com`]
      );
    }
  }

  async findDirectChat(userAId: string, userBId: string): Promise<string | null> {
    const res = await this.db.query<{ id: string }>(
      `SELECT c.id
       FROM chats c
       JOIN chat_members m1 ON c.id = m1.chat_id AND m1.user_id = $1
       JOIN chat_members m2 ON c.id = m2.chat_id AND m2.user_id = $2
       WHERE c.type = 'direct'
       LIMIT 1`,
      [userAId, userBId]
    );

    if (res.rows.length > 0) {
      return res.rows[0].id;
    }
    return null;
  }

  async createDirectChat(userAId: string, userBId: string): Promise<string> {
    // Check again to avoid duplicate creation
    const existing = await this.findDirectChat(userAId, userBId);
    if (existing) {
      return existing;
    }

    await this.ensureUserExists(userAId);
    await this.ensureUserExists(userBId);

    const chatId = `chat_${crypto.randomUUID()}`;

    // Insert chat
    await this.db.query(
      'INSERT INTO chats (id, type, name) VALUES ($1, $2, $3)',
      [chatId, 'direct', null]
    );

    // Insert members
    await this.db.query(
      'INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)',
      [chatId, userAId, 'member']
    );

    await this.db.query(
      'INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)',
      [chatId, userBId, 'member']
    );

    return chatId;
  }

  async getChatById(chatId: string): Promise<ChatRecord | null> {
    const res = await this.db.query<ChatRecord>('SELECT * FROM chats WHERE id = $1', [chatId]);
    return res.rows[0] || null;
  }

  async isMember(chatId: string, userId: string): Promise<boolean> {
    const res = await this.db.query('SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2', [
      chatId,
      userId,
    ]);
    return res.rows.length > 0;
  }

  async getChatMembers(chatId: string): Promise<string[]> {
    const res = await this.db.query<{ user_id: string }>(
      'SELECT user_id FROM chat_members WHERE chat_id = $1',
      [chatId]
    );
    return res.rows.map((r) => r.user_id);
  }

  async listUserChats(userId: string): Promise<UserChatSummary[]> {
    await this.ensureUserExists(userId);

    const res = await this.db.query<{
      chatId: string;
      type: string;
      name: string | null;
      createdAt: Date;
      memberIds: string[];
    }>(
      `SELECT 
        c.id AS "chatId",
        c.type,
        c.name,
        c.created_at AS "createdAt",
        ARRAY_AGG(cm2.user_id) AS "memberIds"
      FROM chat_members cm1
      JOIN chats c ON cm1.chat_id = c.id
      JOIN chat_members cm2 ON c.id = cm2.chat_id
      WHERE cm1.user_id = $1
      GROUP BY c.id, c.type, c.name, c.created_at
      ORDER BY c.created_at DESC`,
      [userId]
    );

    return res.rows.map((row) => ({
      chatId: row.chatId,
      type: row.type,
      name: row.name,
      createdAt: row.createdAt,
      memberIds: Array.isArray(row.memberIds) ? row.memberIds : [],
    }));
  }

  async createGroupChat(name: string, memberIds: string[], adminId?: string): Promise<string> {
    const chatId = `group_${crypto.randomUUID()}`;

    if (adminId) {
      await this.ensureUserExists(adminId);
    }
    for (const uid of memberIds) {
      await this.ensureUserExists(uid);
    }

    await this.db.query(
      'INSERT INTO chats (id, type, name) VALUES ($1, $2, $3)',
      [chatId, 'group', name]
    );

    const allMembers = Array.from(new Set([...(adminId ? [adminId] : []), ...memberIds]));
    for (const uid of allMembers) {
      const role = uid === adminId ? 'admin' : 'member';
      await this.db.query(
        'INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)',
        [chatId, uid, role]
      );
    }

    return chatId;
  }
}
