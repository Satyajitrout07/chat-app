import { MemoryRelationalClient } from '../db';
import { MockFirestore, MockFieldValue } from '../firestore/mockClient';
import { setDbClient } from '../db';
import { setFirestoreDb } from '../firestore/client';
import { ChatRepository } from '../repositories/chatRepository';
import { MessageRepository } from '../repositories/messageRepository';
import { ChatService } from '../services/chatService';

describe('ChatService Unit & Integration (Direct Execution)', () => {
  let chatService: ChatService;
  let mockDb: MemoryRelationalClient;
  let mockFirestore: MockFirestore;

  beforeEach(() => {
    mockDb = new MemoryRelationalClient();
    mockFirestore = new MockFirestore();

    setDbClient(mockDb);
    setFirestoreDb(mockFirestore, MockFieldValue);

    const chatRepo = new ChatRepository(mockDb);
    const messageRepo = new MessageRepository();
    chatService = new ChatService(chatRepo, messageRepo);
  });

  it('creates 1:1 chat and preserves idempotency', async () => {
    const chat1 = await chatService.createOrGetDirectChat('u1', 'u2');
    expect(chat1.chatId).toBeDefined();

    const chat2 = await chatService.createOrGetDirectChat('u1', 'u2');
    expect(chat2.chatId).toBe(chat1.chatId);

    const chat3 = await chatService.createOrGetDirectChat('u2', 'u1');
    expect(chat3.chatId).toBe(chat1.chatId);
  });

  it('sends messages and retrieves them ordered by timestamp', async () => {
    const { chatId } = await chatService.createOrGetDirectChat('u1', 'u2');

    const m1 = await chatService.sendMessage(chatId, 'u1', 'First');
    const m2 = await chatService.sendMessage(chatId, 'u2', 'Second');

    expect(m1.text).toBe('First');
    expect(m2.text).toBe('Second');

    const messages = await chatService.getMessages(chatId, 10);
    expect(messages).toHaveLength(2);
    expect(messages[0].text).toBe('First');
    expect(messages[1].text).toBe('Second');
  });

  it('marks message as read and updates readBy list', async () => {
    const { chatId } = await chatService.createOrGetDirectChat('u1', 'u2');
    const msg = await chatService.sendMessage(chatId, 'u1', 'Hello');

    const readResult = await chatService.markMessageRead(chatId, msg.id, 'u2');
    expect(readResult.success).toBe(true);
    expect(readResult.userId).toBe('u2');

    const messages = await chatService.getMessages(chatId, 10);
    expect(messages[0].readBy).toContain('u2');
    expect(messages[0].readReceipts).toHaveProperty('u2');
  });

  it('updates last seen message per user', async () => {
    const { chatId } = await chatService.createOrGetDirectChat('u1', 'u2');
    const msg = await chatService.sendMessage(chatId, 'u1', 'Check this');

    const result = await chatService.updateLastSeen(chatId, 'u2', msg.id);
    expect(result.success).toBe(true);
    expect(result.messageId).toBe(msg.id);
    expect(result.userId).toBe('u2');
  });

  it('lists user chats with member IDs from relational DB', async () => {
    const c1 = await chatService.createOrGetDirectChat('u1', 'u2');
    const c2 = await chatService.createOrGetDirectChat('u1', 'u3');

    const u1Chats = await chatService.listUserChats('u1');
    expect(u1Chats).toHaveLength(2);
    expect(u1Chats.map(c => c.chatId)).toContain(c1.chatId);
    expect(u1Chats.map(c => c.chatId)).toContain(c2.chatId);
  });

  it('creates group chat and lists for all members', async () => {
    const group = await chatService.createGroupChat('Team Chat', ['u1', 'u2', 'u3'], 'u1');
    expect(group.chatId.startsWith('group_')).toBe(true);

    const u1Chats = await chatService.listUserChats('u1');
    const found = u1Chats.find(c => c.chatId === group.chatId);
    expect(found).toBeDefined();
    expect(found?.type).toBe('group');
    expect(found?.name).toBe('Team Chat');
    expect(found?.memberIds).toEqual(expect.arrayContaining(['u1', 'u2', 'u3']));
  });

  it('edits and deletes message', async () => {
    const { chatId } = await chatService.createOrGetDirectChat('u1', 'u2');
    const msg = await chatService.sendMessage(chatId, 'u1', 'Initial text');

    const edited = await chatService.editMessage(chatId, msg.id, 'u1', 'Updated text');
    expect(edited.text).toBe('Updated text');

    const deleted = await chatService.deleteMessage(chatId, msg.id, 'u1');
    expect(deleted.success).toBe(true);

    const messages = await chatService.getMessages(chatId, 10);
    expect(messages[0].isDeleted).toBe(true);
  });
});
