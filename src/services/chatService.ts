import { ChatRepository, UserChatSummary } from '../repositories/chatRepository';
import { MessageRepository } from '../repositories/messageRepository';
import { FirestoreMessage } from '../firestore/types';

export class ChatService {
  constructor(
    private chatRepo: ChatRepository = new ChatRepository(),
    private messageRepo: MessageRepository = new MessageRepository()
  ) {}

  async createOrGetDirectChat(userAId: string, userBId: string): Promise<{ chatId: string }> {
    if (!userAId || !userBId) {
      throw new Error('userAId and userBId are required');
    }

    if (userAId === userBId) {
      throw new Error('userAId and userBId must be different users');
    }

    // 1. Check if 1:1 chat already exists
    const existingChatId = await this.chatRepo.findDirectChat(userAId, userBId);
    if (existingChatId) {
      return { chatId: existingChatId };
    }

    // 2. Create new direct chat
    const newChatId = await this.chatRepo.createDirectChat(userAId, userBId);
    return { chatId: newChatId };
  }

  async sendMessage(chatId: string, senderId: string, text: string): Promise<FirestoreMessage> {
    if (!chatId) throw new Error('chatId is required');
    if (!senderId) throw new Error('senderId is required');
    if (text === undefined || text === null || text.trim() === '') {
      throw new Error('Message text cannot be empty');
    }

    const chat = await this.chatRepo.getChatById(chatId);
    if (!chat) {
      throw new Error(`Chat not found: ${chatId}`);
    }

    const isMember = await this.chatRepo.isMember(chatId, senderId);
    if (!isMember) {
      throw new Error(`Forbidden: User ${senderId} is not a member of chat ${chatId}`);
    }

    return this.messageRepo.sendMessage(chatId, senderId, text.trim());
  }

  async getMessages(chatId: string, limit = 50): Promise<FirestoreMessage[]> {
    if (!chatId) throw new Error('chatId is required');

    const chat = await this.chatRepo.getChatById(chatId);
    if (!chat) {
      throw new Error(`Chat not found: ${chatId}`);
    }

    return this.messageRepo.getMessages(chatId, limit);
  }

  async markMessageRead(
    chatId: string,
    messageId: string,
    userId: string
  ): Promise<{ success: boolean; messageId: string; userId: string; readAt: string }> {
    if (!chatId) throw new Error('chatId is required');
    if (!messageId) throw new Error('messageId is required');
    if (!userId) throw new Error('userId is required');

    const chat = await this.chatRepo.getChatById(chatId);
    if (!chat) {
      throw new Error(`Chat not found: ${chatId}`);
    }

    const isMember = await this.chatRepo.isMember(chatId, userId);
    if (!isMember) {
      throw new Error(`Forbidden: User ${userId} is not a member of chat ${chatId}`);
    }

    return this.messageRepo.markMessageRead(chatId, messageId, userId);
  }

  async updateLastSeen(
    chatId: string,
    userId: string,
    messageId: string
  ): Promise<{ success: boolean; chatId: string; userId: string; messageId: string; updatedAt: string }> {
    if (!chatId) throw new Error('chatId is required');
    if (!userId) throw new Error('userId is required');
    if (!messageId) throw new Error('messageId is required');

    const chat = await this.chatRepo.getChatById(chatId);
    if (!chat) {
      throw new Error(`Chat not found: ${chatId}`);
    }

    const isMember = await this.chatRepo.isMember(chatId, userId);
    if (!isMember) {
      throw new Error(`Forbidden: User ${userId} is not a member of chat ${chatId}`);
    }

    return this.messageRepo.updateLastSeen(chatId, userId, messageId);
  }

  async listUserChats(userId: string): Promise<UserChatSummary[]> {
    if (!userId) throw new Error('userId is required');

    return this.chatRepo.listUserChats(userId);
  }

  // Bonus: Group chat creation
  async createGroupChat(name: string, memberIds: string[], adminId?: string): Promise<{ chatId: string }> {
    if (!name || name.trim() === '') {
      throw new Error('Group name is required');
    }
    if (!memberIds || memberIds.length === 0) {
      throw new Error('At least one member is required for group chat');
    }

    const chatId = await this.chatRepo.createGroupChat(name.trim(), memberIds, adminId);
    return { chatId };
  }

  // Bonus: Message edit
  async editMessage(chatId: string, messageId: string, senderId: string, newText: string): Promise<FirestoreMessage> {
    if (!newText || newText.trim() === '') {
      throw new Error('Message text cannot be empty');
    }
    return this.messageRepo.editMessage(chatId, messageId, senderId, newText.trim());
  }

  // Bonus: Message delete
  async deleteMessage(chatId: string, messageId: string, senderId: string): Promise<{ success: boolean }> {
    return this.messageRepo.deleteMessage(chatId, messageId, senderId);
  }
}
