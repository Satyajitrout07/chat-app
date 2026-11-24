import request from 'supertest';
import { createApp } from '../app';
import { MemoryRelationalClient, setDbClient } from '../db';
import { MockFirestore, MockFieldValue } from '../firestore/mockClient';
import { setFirestoreDb } from '../firestore/client';
import { ChatRepository } from '../repositories/chatRepository';
import { MessageRepository } from '../repositories/messageRepository';
import { ChatService } from '../services/chatService';
import { ChatController } from '../controllers/chatController';

describe('Chat Backend End-to-End API Suite', () => {
  let app: any;
  let mockDb: MemoryRelationalClient;
  let mockFirestore: MockFirestore;

  beforeEach(() => {
    // Fresh instances for each test
    mockDb = new MemoryRelationalClient();
    mockFirestore = new MockFirestore();

    setDbClient(mockDb);
    setFirestoreDb(mockFirestore, MockFieldValue);

    const chatRepo = new ChatRepository(mockDb);
    const messageRepo = new MessageRepository();
    const chatService = new ChatService(chatRepo, messageRepo);
    const chatController = new ChatController(chatService);

    app = createApp(chatController);
  });

  describe('1. Create or Get Chat (POST /chat/create)', () => {
    it('should create a new 1:1 chat and return chatId', async () => {
      const res = await request(app)
        .post('/chat/create')
        .send({ userAId: 'user_alice', userBId: 'user_bob' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('chatId');
      expect(typeof res.body.chatId).toBe('string');
      expect(res.body.chatId.startsWith('chat_')).toBe(true);
    });

    it('should return existing chatId when chat between two users already exists (idempotency)', async () => {
      // First creation
      const res1 = await request(app)
        .post('/chat/create')
        .send({ userAId: 'user_alice', userBId: 'user_bob' });

      expect(res1.status).toBe(200);
      const firstChatId = res1.body.chatId;

      // Second call with same users
      const res2 = await request(app)
        .post('/chat/create')
        .send({ userAId: 'user_alice', userBId: 'user_bob' });

      expect(res2.status).toBe(200);
      expect(res2.body.chatId).toBe(firstChatId);

      // Third call with swapped users
      const res3 = await request(app)
        .post('/chat/create')
        .send({ userAId: 'user_bob', userBId: 'user_alice' });

      expect(res3.status).toBe(200);
      expect(res3.body.chatId).toBe(firstChatId);
    });

    it('should reject invalid input (missing user or identical user)', async () => {
      const res1 = await request(app)
        .post('/chat/create')
        .send({ userAId: 'user_alice' });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/chat/create')
        .send({ userAId: 'user_alice', userBId: 'user_alice' });
      expect(res2.status).toBe(400);
    });
  });

  describe('2. Send Message (POST /chat/:chatId/message/send)', () => {
    let chatId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/chat/create')
        .send({ userAId: 'alice', userBId: 'bob' });
      chatId = res.body.chatId;
    });

    it('should send a message and store it in Firestore with timestamp', async () => {
      const res = await request(app)
        .post(`/chat/${chatId}/message/send`)
        .send({ senderId: 'alice', text: 'Hello Bob!' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.id.startsWith('msg_')).toBe(true);
      expect(res.body.chatId).toBe(chatId);
      expect(res.body.senderId).toBe('alice');
      expect(res.body.text).toBe('Hello Bob!');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body.readBy).toContain('alice');
    });

    it('should forbid non-member from sending message', async () => {
      const res = await request(app)
        .post(`/chat/${chatId}/message/send`)
        .send({ senderId: 'stranger_eve', text: 'Intrusion!' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('should return 400 when text is empty', async () => {
      const res = await request(app)
        .post(`/chat/${chatId}/message/send`)
        .send({ senderId: 'alice', text: '   ' });

      expect(res.status).toBe(400);
    });
  });

  describe('3. Get Messages (GET /chat/:chatId/messages?limit=50)', () => {
    let chatId: string;

    beforeEach(async () => {
      const chatRes = await request(app)
        .post('/chat/create')
        .send({ userAId: 'alice', userBId: 'bob' });
      chatId = chatRes.body.chatId;

      // Send 3 messages
      await request(app)
        .post(`/chat/${chatId}/message/send`)
        .send({ senderId: 'alice', text: 'Msg 1' });
      await request(app)
        .post(`/chat/${chatId}/message/send`)
        .send({ senderId: 'bob', text: 'Msg 2' });
      await request(app)
        .post(`/chat/${chatId}/message/send`)
        .send({ senderId: 'alice', text: 'Msg 3' });
    });

    it('should list messages ordered by timestamp', async () => {
      const res = await request(app).get(`/chat/${chatId}/messages?limit=50`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('messages');
      expect(res.body.messages).toHaveLength(3);
      expect(res.body.messages[0].text).toBe('Msg 1');
      expect(res.body.messages[1].text).toBe('Msg 2');
      expect(res.body.messages[2].text).toBe('Msg 3');
    });

    it('should respect limit parameter', async () => {
      const res = await request(app).get(`/chat/${chatId}/messages?limit=2`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.messages[0].text).toBe('Msg 1');
      expect(res.body.messages[1].text).toBe('Msg 2');
    });
  });

  describe('4. Mark Message Read (POST /chat/:chatId/message/:messageId/read)', () => {
    let chatId: string;
    let messageId: string;

    beforeEach(async () => {
      const chatRes = await request(app)
        .post('/chat/create')
        .send({ userAId: 'alice', userBId: 'bob' });
      chatId = chatRes.body.chatId;

      const msgRes = await request(app)
        .post(`/chat/${chatId}/message/send`)
        .send({ senderId: 'alice', text: 'Check this out' });
      messageId = msgRes.body.id;
    });

    it('should mark message as read by user and record timestamp', async () => {
      const res = await request(app)
        .post(`/chat/${chatId}/message/${messageId}/read`)
        .send({ userId: 'bob' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messageId).toBe(messageId);
      expect(res.body.userId).toBe('bob');
      expect(res.body).toHaveProperty('readAt');

      // Verify message in Firestore contains bob in readBy
      const messagesRes = await request(app).get(`/chat/${chatId}/messages`);
      const updatedMsg = messagesRes.body.messages.find((m: any) => m.id === messageId);
      expect(updatedMsg.readBy).toContain('bob');
      expect(updatedMsg.readReceipts).toHaveProperty('bob');
    });

    it('should forbid non-member from marking message read', async () => {
      const res = await request(app)
        .post(`/chat/${chatId}/message/${messageId}/read`)
        .send({ userId: 'stranger_eve' });

      expect(res.status).toBe(403);
    });
  });

  describe('5. Update Last Seen Message (POST /chat/:chatId/lastseen)', () => {
    let chatId: string;
    let messageId: string;

    beforeEach(async () => {
      const chatRes = await request(app)
        .post('/chat/create')
        .send({ userAId: 'alice', userBId: 'bob' });
      chatId = chatRes.body.chatId;

      const msgRes = await request(app)
        .post(`/chat/${chatId}/message/send`)
        .send({ senderId: 'alice', text: 'Important update' });
      messageId = msgRes.body.id;
    });

    it('should update last seen message for user in Firestore', async () => {
      const res = await request(app)
        .post(`/chat/${chatId}/lastseen`)
        .send({ userId: 'bob', messageId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.chatId).toBe(chatId);
      expect(res.body.userId).toBe('bob');
      expect(res.body.messageId).toBe(messageId);
      expect(res.body).toHaveProperty('updatedAt');
    });

    it('should forbid non-member from updating last seen', async () => {
      const res = await request(app)
        .post(`/chat/${chatId}/lastseen`)
        .send({ userId: 'stranger_eve', messageId });

      expect(res.status).toBe(403);
    });
  });

  describe('6. List User Chats (GET /user/:userId/chats)', () => {
    it('should list all chats for a given user with member IDs from relational DB', async () => {
      // Create chat between alice and bob
      const res1 = await request(app)
        .post('/chat/create')
        .send({ userAId: 'alice', userBId: 'bob' });

      // Create chat between alice and charlie
      const res2 = await request(app)
        .post('/chat/create')
        .send({ userAId: 'alice', userBId: 'charlie' });

      const listRes = await request(app).get('/user/alice/chats');

      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveProperty('chats');
      expect(listRes.body.chats).toHaveLength(2);

      const chatIds = listRes.body.chats.map((c: any) => c.chatId);
      expect(chatIds).toContain(res1.body.chatId);
      expect(chatIds).toContain(res2.body.chatId);

      const firstChat = listRes.body.chats.find((c: any) => c.chatId === res1.body.chatId);
      expect(firstChat.memberIds).toContain('alice');
      expect(firstChat.memberIds).toContain('bob');
    });
  });

  describe('Bonus APIs: Group Chat & Message Edit/Delete', () => {
    it('should create group chat with multiple members', async () => {
      const res = await request(app)
        .post('/chat/group/create')
        .send({
          name: 'Engineering Team',
          memberIds: ['alice', 'bob', 'charlie'],
          adminId: 'alice',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('chatId');
      expect(res.body.chatId.startsWith('group_')).toBe(true);

      // Verify listed under alice's chats
      const aliceChats = await request(app).get('/user/alice/chats');
      const group = aliceChats.body.chats.find((c: any) => c.chatId === res.body.chatId);
      expect(group).toBeDefined();
      expect(group.type).toBe('group');
      expect(group.name).toBe('Engineering Team');
    });

    it('should edit message by sender', async () => {
      const chat = await request(app)
        .post('/chat/create')
        .send({ userAId: 'alice', userBId: 'bob' });
      const chatId = chat.body.chatId;

      const msg = await request(app)
        .post(`/chat/${chatId}/message/send`)
        .send({ senderId: 'alice', text: 'Original message' });
      const messageId = msg.body.id;

      const editRes = await request(app)
        .put(`/chat/${chatId}/message/${messageId}`)
        .send({ senderId: 'alice', text: 'Edited message' });

      expect(editRes.status).toBe(200);
      expect(editRes.body.text).toBe('Edited message');
      expect(editRes.body.editedAt).toBeDefined();
    });

    it('should delete message by sender', async () => {
      const chat = await request(app)
        .post('/chat/create')
        .send({ userAId: 'alice', userBId: 'bob' });
      const chatId = chat.body.chatId;

      const msg = await request(app)
        .post(`/chat/${chatId}/message/send`)
        .send({ senderId: 'alice', text: 'To be deleted' });
      const messageId = msg.body.id;

      const delRes = await request(app)
        .delete(`/chat/${chatId}/message/${messageId}`)
        .send({ senderId: 'alice' });

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const msgs = await request(app).get(`/chat/${chatId}/messages`);
      const deleted = msgs.body.messages.find((m: any) => m.id === messageId);
      expect(deleted.isDeleted).toBe(true);
      expect(deleted.text).toBe('This message was deleted');
    });
  });
});
