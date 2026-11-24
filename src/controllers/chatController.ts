import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ChatService } from '../services/chatService';

export class ChatController {
  constructor(private chatService: ChatService = new ChatService()) {}

  // 1. POST /chat/create
  createOrGetChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schema = z.object({
        userAId: z.string().min(1, 'userAId is required'),
        userBId: z.string().min(1, 'userBId is required'),
      });

      const parsed = schema.parse(req.body);
      const result = await this.chatService.createOrGetDirectChat(parsed.userAId, parsed.userBId);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  // 2. POST /chat/:chatId/message/send
  sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramSchema = z.object({
        chatId: z.string().min(1, 'chatId is required in URL path'),
      });
      const bodySchema = z.object({
        senderId: z.string().min(1, 'senderId is required'),
        text: z.string().min(1, 'text cannot be empty'),
      });

      const { chatId } = paramSchema.parse(req.params);
      const { senderId, text } = bodySchema.parse(req.body);

      const message = await this.chatService.sendMessage(chatId, senderId, text);
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  };

  // 3. GET /chat/:chatId/messages?limit=50
  getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramSchema = z.object({
        chatId: z.string().min(1, 'chatId is required in URL path'),
      });

      const { chatId } = paramSchema.parse(req.params);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const messages = await this.chatService.getMessages(chatId, limit);
      res.status(200).json({ messages });
    } catch (err) {
      next(err);
    }
  };

  // 4. POST /chat/:chatId/message/:messageId/read
  markMessageRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramSchema = z.object({
        chatId: z.string().min(1, 'chatId is required in URL path'),
        messageId: z.string().min(1, 'messageId is required in URL path'),
      });
      const bodySchema = z.object({
        userId: z.string().min(1, 'userId is required'),
      });

      const { chatId, messageId } = paramSchema.parse(req.params);
      const { userId } = bodySchema.parse(req.body);

      const result = await this.chatService.markMessageRead(chatId, messageId, userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  // 5. POST /chat/:chatId/lastseen
  updateLastSeen = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramSchema = z.object({
        chatId: z.string().min(1, 'chatId is required in URL path'),
      });
      const bodySchema = z.object({
        userId: z.string().min(1, 'userId is required'),
        messageId: z.string().min(1, 'messageId is required'),
      });

      const { chatId } = paramSchema.parse(req.params);
      const { userId, messageId } = bodySchema.parse(req.body);

      const result = await this.chatService.updateLastSeen(chatId, userId, messageId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  // 6. GET /user/:userId/chats
  listUserChats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramSchema = z.object({
        userId: z.string().min(1, 'userId is required in URL path'),
      });

      const { userId } = paramSchema.parse(req.params);
      const chats = await this.chatService.listUserChats(userId);

      res.status(200).json({ chats });
    } catch (err) {
      next(err);
    }
  };

  // Bonus: POST /chat/group/create
  createGroupChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodySchema = z.object({
        name: z.string().min(1, 'Group name is required'),
        memberIds: z.array(z.string()).min(1, 'At least one memberId is required'),
        adminId: z.string().optional(),
      });

      const { name, memberIds, adminId } = bodySchema.parse(req.body);
      const result = await this.chatService.createGroupChat(name, memberIds, adminId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  // Bonus: PUT /chat/:chatId/message/:messageId
  editMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramSchema = z.object({
        chatId: z.string().min(1),
        messageId: z.string().min(1),
      });
      const bodySchema = z.object({
        senderId: z.string().min(1),
        text: z.string().min(1),
      });

      const { chatId, messageId } = paramSchema.parse(req.params);
      const { senderId, text } = bodySchema.parse(req.body);

      const updated = await this.chatService.editMessage(chatId, messageId, senderId, text);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  };

  // Bonus: DELETE /chat/:chatId/message/:messageId
  deleteMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramSchema = z.object({
        chatId: z.string().min(1),
        messageId: z.string().min(1),
      });
      const bodySchema = z.object({
        senderId: z.string().min(1),
      });

      const { chatId, messageId } = paramSchema.parse(req.params);
      const { senderId } = bodySchema.parse(req.body);

      const result = await this.chatService.deleteMessage(chatId, messageId, senderId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
