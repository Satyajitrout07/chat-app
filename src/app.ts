import express, { Express } from 'express';
import cors from 'cors';
import { createChatRoutes } from './routes/chatRoutes';
import { createUserRoutes } from './routes/userRoutes';
import { errorHandler } from './middlewares/errorHandler';
import { ChatController } from './controllers/chatController';

export function createApp(chatController?: ChatController): Express {
  const app = express();

  // Global middlewares
  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount API routes
  const controller = chatController || new ChatController();
  app.use('/chat', createChatRoutes(controller));
  app.use('/user', createUserRoutes(controller));

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
