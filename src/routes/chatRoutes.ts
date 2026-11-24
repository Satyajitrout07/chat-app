import { Router } from 'express';
import { ChatController } from '../controllers/chatController';

export function createChatRoutes(controller: ChatController = new ChatController()): Router {
  const router = Router();

  // 1. Create or Get Chat: POST /chat/create
  router.post('/create', controller.createOrGetChat);

  // 2. Send Message: POST /chat/:chatId/message/send
  router.post('/:chatId/message/send', controller.sendMessage);

  // 3. Get Messages: GET /chat/:chatId/messages?limit=50
  router.get('/:chatId/messages', controller.getMessages);

  // 4. Mark Message Read: POST /chat/:chatId/message/:messageId/read
  router.post('/:chatId/message/:messageId/read', controller.markMessageRead);

  // 5. Update Last Seen Message: POST /chat/:chatId/lastseen
  router.post('/:chatId/lastseen', controller.updateLastSeen);

  // Bonus: Group Chat & Message Edit/Delete
  router.post('/group/create', controller.createGroupChat);
  router.put('/:chatId/message/:messageId', controller.editMessage);
  router.delete('/:chatId/message/:messageId', controller.deleteMessage);

  return router;
}
