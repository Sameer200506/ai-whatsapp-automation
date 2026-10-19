import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { SocketGateway } from './socket/gateway.js';
import { createWebhookRouter } from './routes/webhook.js';
import { createConversationsRouter } from './routes/conversations.js';
import { createEcommerceRouter } from './routes/ecommerce.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
const clientPath = path.resolve(process.cwd(), 'src', 'client');
app.use(express.static(clientPath));

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'NivaGlow AI WhatsApp OS', timestamp: new Date() });
});

// Mount Routers
app.use('/webhooks', createWebhookRouter(prisma));
app.use('/api/conversations', createConversationsRouter(prisma));
app.use('/api', createEcommerceRouter(prisma));

// Fallback to client index.html for SPA routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhooks') || req.path.startsWith('/ws')) {
    return next();
  }
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Initialize WebSocket Gateway
SocketGateway.init(server);

const PORT = parseInt(process.env.PORT || '3000', 10);

server.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 NivaGlow AI WhatsApp Sales & Support OS is live!`);
  console.log(`🌐 CRM Dashboard:     http://localhost:${PORT}`);
  console.log(`⚡ WebSocket URL:     ws://localhost:${PORT}/ws`);
  console.log(`📡 Meta Webhook URL:  http://localhost:${PORT}/webhooks/whatsapp`);
  console.log(`📦 E-Commerce API:    http://localhost:${PORT}/api/orders`);
  console.log(`=============================================================\n`);
});
