import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { IntentEngine } from '../services/intentEngine.js';
import { ResponseAgent } from '../services/responseAgent.js';
import { WhatsAppSender } from '../services/whatsappSender.js';
import { SocketGateway } from '../socket/gateway.js';

export function createWebhookRouter(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * GET /webhooks/whatsapp
   * Meta Webhook verification handshake.
   */
  router.get('/whatsapp', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'niva-glow-verify-token';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[Webhook] WhatsApp webhook verified successfully.');
      res.status(200).send(challenge);
      return;
    }

    res.status(403).json({ error: 'Verification token mismatch' });
  });

  /**
   * POST /webhooks/whatsapp
   * Inbound WhatsApp message intake from Meta Cloud API or test simulator.
   */
  router.post('/whatsapp', async (req: Request, res: Response) => {
    try {
      const body = req.body;

      // Extract message details (handles both standard Meta payload and direct simulator format)
      let phone = '';
      let customerName = '';
      let messageText = '';
      let incomingMsgId = `wamid.${Date.now()}`;

      // Check standard Meta format
      const entry = body?.entry?.[0]?.changes?.[0]?.value;
      if (entry?.messages?.[0]) {
        const msg = entry.messages[0];
        const contact = entry.contacts?.[0];
        phone = String(msg.from || '');
        customerName = contact?.profile?.name || '';
        incomingMsgId = msg.id || incomingMsgId;

        messageText =
          msg.text?.body ||
          msg.button?.text ||
          msg.interactive?.button_reply?.title ||
          msg.interactive?.list_reply?.title ||
          '';
      } 
      // Direct testing format
      else if (body?.phone && (body?.message || body?.customer_message)) {
        phone = String(body.phone).trim();
        customerName = body.name || body.customer_name || '';
        messageText = String(body.message || body.customer_message).trim();
      }

      // Ignore status updates or empty messages
      if (!phone || !messageText) {
        res.status(200).json({ status: 'ignored', reason: 'No customer message present' });
        return;
      }

      // Format standard phone
      if (!phone.startsWith('+')) {
        phone = '+' + phone;
      }

      // Get primary Organization
      const org = await prisma.organization.findFirst();
      if (!org) {
        res.status(500).json({ error: 'No organization configured' });
        return;
      }

      // 1. Find or create Customer
      let customer = await prisma.customer.findFirst({
        where: {
          organizationId: org.id,
          phone: { contains: phone.replace(/[^0-9]/g, '').slice(-10) }
        }
      });

      if (!customer) {
        const initials = (customerName || 'Customer')
          .split(' ')
          .map((w: string) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        customer = await prisma.customer.create({
          data: {
            organizationId: org.id,
            phone,
            name: customerName || 'Valued Customer',
            initials: initials || 'VC',
            avatarColor: '#4F46E5',
            lifetimeValue: 0
          }
        });
      } else if (customerName && !customer.name) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { name: customerName }
        });
      }

      // 2. Find or create active Conversation
      let conversation = await prisma.conversation.findFirst({
        where: {
          organizationId: org.id,
          customerId: customer.id,
          status: { in: ['AI_ACTIVE', 'HUMAN_REQUESTED', 'HUMAN_ACTIVE', 'IN_PROGRESS'] }
        },
        orderBy: { updatedAt: 'desc' }
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            organizationId: org.id,
            customerId: customer.id,
            status: 'AI_ACTIVE',
            aiActive: true,
            intent: 'general_support',
            lastMessage: messageText,
            lastMessageAt: new Date()
          }
        });
      }

      // 3. Save incoming customer message
      const customerMsg = await prisma.message.create({
        data: {
          organizationId: org.id,
          conversationId: conversation.id,
          sender: 'CUSTOMER',
          content: messageText,
          messageId: incomingMsgId
        }
      });

      // Notify CRM via WebSocket immediately
      SocketGateway.broadcast('NEW_MESSAGE', {
        conversationId: conversation.id,
        customerId: customer.id,
        message: {
          id: customerMsg.id,
          sender: 'CUSTOMER',
          content: customerMsg.content,
          createdAt: customerMsg.createdAt
        }
      });

      // 4. If Human has Taken Over (aiActive is false), do not generate AI response
      if (!conversation.aiActive) {
        console.log(`[Webhook] Conversation ${conversation.id} is in HUMAN_ACTIVE mode. AI response bypassed.`);
        
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessage: messageText,
            lastMessageAt: new Date()
          }
        });

        SocketGateway.broadcast('CONVERSATION_UPDATED', {
          conversationId: conversation.id,
          status: 'HUMAN_ACTIVE',
          aiActive: false,
          lastMessage: messageText
        });

        res.status(200).json({
          status: 'received',
          mode: 'human_takeover',
          conversationId: conversation.id
        });
        return;
      }

      // 5. Run AI Intent Engine
      const intentResult = await IntentEngine.classify(messageText, customer.name || undefined);

      // Handle Voice Escalation if customer asks for a call
      if (intentResult.needs_call) {
        await prisma.voiceCall.create({
          data: {
            organizationId: org.id,
            customerId: customer.id,
            customerName: customer.name || 'Customer',
            phone: customer.phone,
            reason: `Voice callback requested during ${intentResult.intent}`,
            duration: '0:00 (Pending)',
            durationSec: 0,
            outcome: 'Voice callback queued via Sarvam adapter',
            status: 'Pending'
          }
        });

        SocketGateway.broadcast('CALL_LOGGED', {
          customerName: customer.name,
          phone: customer.phone,
          reason: `Voice callback: ${messageText.slice(0, 40)}`
        });
      }

      // 6. Generate grounded AI response
      const aiResponse = await ResponseAgent.generateResponse({
        prisma,
        organizationId: org.id,
        customerName: customer.name,
        phone: customer.phone,
        message: messageText,
        intentResult
      });

      // If a ticket was generated, persist in database
      if (aiResponse.ticketNumber) {
        await prisma.ticket.create({
          data: {
            ticketNumber: aiResponse.ticketNumber,
            organizationId: org.id,
            conversationId: conversation.id,
            customerId: customer.id,
            issue: `${intentResult.intent.toUpperCase()}: ${messageText.slice(0, 60)}`,
            priority: aiResponse.needsHuman ? 'HIGH' : 'NORMAL',
            status: 'OPEN',
            channel: aiResponse.needsCall ? 'WhatsApp + Voice' : 'WhatsApp',
            assigneeName: 'AI Support Agent'
          }
        });

        SocketGateway.broadcast('TICKET_CREATED', {
          ticketNumber: aiResponse.ticketNumber,
          customerName: customer.name,
          issue: messageText.slice(0, 60),
          priority: aiResponse.needsHuman ? 'HIGH' : 'NORMAL'
        });
      }

      // 7. Store AI message
      const aiMsg = await prisma.message.create({
        data: {
          organizationId: org.id,
          conversationId: conversation.id,
          sender: 'AI',
          content: aiResponse.replyText,
          intent: intentResult.intent,
          needsHuman: aiResponse.needsHuman,
          needsCall: aiResponse.needsCall,
          orderId: aiResponse.orderId,
          ticketId: aiResponse.ticketNumber
        }
      });

      // 8. Update conversation state
      const nextStatus = aiResponse.needsHuman ? 'HUMAN_REQUESTED' : conversation.status;
      const updatedConv = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          intent: intentResult.intent,
          status: nextStatus,
          priority: aiResponse.needsHuman ? 'high' : 'normal',
          lastMessage: aiResponse.replyText,
          lastMessageAt: new Date()
        }
      });

      // 9. Dispatch WhatsApp message to customer
      await WhatsAppSender.sendMessage({
        to: customer.phone,
        body: aiResponse.replyText
      });

      // 10. Broadcast AI response to CRM
      SocketGateway.broadcast('NEW_MESSAGE', {
        conversationId: conversation.id,
        customerId: customer.id,
        message: {
          id: aiMsg.id,
          sender: 'AI',
          content: aiMsg.content,
          intent: aiMsg.intent,
          createdAt: aiMsg.createdAt
        }
      });

      SocketGateway.broadcast('CONVERSATION_UPDATED', {
        conversationId: conversation.id,
        status: updatedConv.status,
        intent: updatedConv.intent,
        priority: updatedConv.priority,
        lastMessage: updatedConv.lastMessage
      });

      res.status(200).json({
        status: 'success',
        conversationId: conversation.id,
        intent: intentResult.intent,
        reply: aiResponse.replyText,
        orderId: aiResponse.orderId,
        ticketNumber: aiResponse.ticketNumber
      });
    } catch (err: any) {
      console.error('[Webhook Error]:', err);
      res.status(500).json({ error: 'Internal webhook error', details: err.message });
    }
  });

  return router;
}
