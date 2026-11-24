import { Router } from 'express';
import { ChatController } from '../controllers/chatController';

export function createUserRoutes(controller: ChatController = new ChatController()): Router {
  const router = Router();

  // 6. List User Chats: GET /user/:userId/chats
  router.get('/:userId/chats', controller.listUserChats);

  return router;
}
