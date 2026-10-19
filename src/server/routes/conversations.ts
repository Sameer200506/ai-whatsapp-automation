import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WhatsAppSender } from '../services/whatsappSender.js';
import { SocketGateway } from '../socket/gateway.js';

export function createConversationsRouter(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * GET /api/conversations
   * Fetch conversation list with customer info and status.
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { status, intent, search } = req.query;

      const whereClause: any = {};
      if (status && status !== 'all') {
        whereClause.status = status;
      }
      if (intent && intent !== 'all') {
        whereClause.intent = intent;
      }

      const convs = await prisma.conversation.findMany({
        where: whereClause,
        include: {
          customer: true,
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { lastMessageAt: 'desc' }
      });

      // Format response
      const results = convs.map((c) => {
        const lastMsg = c.messages[0]?.content || c.lastMessage || 'No messages yet';
        return {
          id: c.id,
          customerId: c.customer.id,
          name: c.customer.name || 'Valued Customer',
          phone: c.customer.phone,
          ini: c.customer.initials || 'CU',
          color: c.customer.avatarColor || '#4F46E5',
          status: c.status,
          aiActive: c.aiActive,
          intent: c.intent || 'general_support',
          priority: c.priority,
          preview: lastMsg.length > 50 ? lastMsg.slice(0, 48) + '...' : lastMsg,
          time: new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          updatedAt: c.updatedAt
        };
      });

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch conversations', details: err.message });
    }
  });

  /**
   * GET /api/conversations/:id
   * Fetch full message history, customer details, and linked orders/tickets.
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          customer: {
            include: {
              orders: {
                take: 3,
                orderBy: { createdAt: 'desc' },
                include: { items: true }
              },
              tickets: {
                take: 3,
                orderBy: { createdAt: 'desc' }
              }
            }
          },
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      res.json({
        id: conversation.id,
        status: conversation.status,
        aiActive: conversation.aiActive,
        intent: conversation.intent,
        priority: conversation.priority,
        customer: conversation.customer,
        messages: conversation.messages.map((m) => ({
          id: m.id,
          sender: m.sender,
          content: m.content,
          intent: m.intent,
          needsHuman: m.needsHuman,
          needsCall: m.needsCall,
          orderId: m.orderId,
          ticketId: m.ticketId,
          time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: m.createdAt
        }))
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch conversation detail', details: err.message });
    }
  });

  /**
   * POST /api/conversations/:id/takeover
   * Human Takeover: Disables AI, sets status to HUMAN_ACTIVE.
   */
  router.post('/:id/takeover', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const updated = await prisma.conversation.update({
        where: { id },
        data: {
          aiActive: false,
          status: 'HUMAN_ACTIVE'
        },
        include: { customer: true }
      });

      // System notification message in conversation
      await prisma.message.create({
        data: {
          organizationId: updated.organizationId,
          conversationId: updated.id,
          sender: 'SYSTEM',
          content: 'Support Specialist took over the conversation. AI automation paused.'
        }
      });

      SocketGateway.broadcast('TAKEOVER_STATE', {
        conversationId: updated.id,
        aiActive: false,
        status: 'HUMAN_ACTIVE'
      });

      SocketGateway.broadcast('CONVERSATION_UPDATED', {
        conversationId: updated.id,
        aiActive: false,
        status: 'HUMAN_ACTIVE'
      });

      res.json({ success: true, conversation: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to take over conversation', details: err.message });
    }
  });

  /**
   * POST /api/conversations/:id/release
   * Return to AI: Re-enables AI automation, sets status to AI_ACTIVE.
   */
  router.post('/:id/release', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const updated = await prisma.conversation.update({
        where: { id },
        data: {
          aiActive: true,
          status: 'AI_ACTIVE'
        },
        include: { customer: true }
      });

      await prisma.message.create({
        data: {
          organizationId: updated.organizationId,
          conversationId: updated.id,
          sender: 'SYSTEM',
          content: 'Conversation returned to AI Support Agent.'
        }
      });

      SocketGateway.broadcast('TAKEOVER_STATE', {
        conversationId: updated.id,
        aiActive: true,
        status: 'AI_ACTIVE'
      });

      SocketGateway.broadcast('CONVERSATION_UPDATED', {
        conversationId: updated.id,
        aiActive: true,
        status: 'AI_ACTIVE'
      });

      res.json({ success: true, conversation: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to release conversation to AI', details: err.message });
    }
  });

  /**
   * POST /api/conversations/:id/messages
   * Human Agent sends a manual reply.
   */
  router.post('/:id/messages', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { text } = req.body;

      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Message text required' });
        return;
      }

      const conv = await prisma.conversation.findUnique({
        where: { id },
        include: { customer: true }
      });

      if (!conv) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      // Save human message
      const msg = await prisma.message.create({
        data: {
          organizationId: conv.organizationId,
          conversationId: conv.id,
          sender: 'HUMAN',
          content: text.trim()
        }
      });

      // Update conversation
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessage: text.trim(),
          lastMessageAt: new Date()
        }
      });

      // Send to customer on WhatsApp
      await WhatsAppSender.sendMessage({
        to: conv.customer.phone,
        body: text.trim()
      });

      // Broadcast to CRM
      SocketGateway.broadcast('NEW_MESSAGE', {
        conversationId: conv.id,
        customerId: conv.customerId,
        message: {
          id: msg.id,
          sender: 'HUMAN',
          content: msg.content,
          time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: msg.createdAt
        }
      });

      SocketGateway.broadcast('CONVERSATION_UPDATED', {
        conversationId: conv.id,
        lastMessage: text.trim()
      });

      res.json({ success: true, message: msg });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to send message', details: err.message });
    }
  });

  return router;
}
