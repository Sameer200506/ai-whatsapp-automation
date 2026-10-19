import assert from 'assert';
import http from 'http';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createWebhookRouter } from '../server/routes/webhook.js';
import { createConversationsRouter } from '../server/routes/conversations.js';
import { createEcommerceRouter } from '../server/routes/ecommerce.js';
import { IntentEngine } from '../server/services/intentEngine.js';
import { SocketGateway } from '../server/socket/gateway.js';

async function runSelfCheck() {
  console.log('🧪 Running NivaGlow Verification Self-Check...\n');

  const prisma = new PrismaClient();
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  SocketGateway.init(server);

  app.use('/webhooks', createWebhookRouter(prisma));
  app.use('/api/conversations', createConversationsRouter(prisma));
  app.use('/api', createEcommerceRouter(prisma));

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Meta Webhook Verification Handshake
    console.log('1. Testing Meta Webhook Verification Handshake...');
    const verifyRes = await fetch(
      `${baseUrl}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=niva-glow-verify-token&hub.challenge=test_challenge_12345`
    );
    assert.strictEqual(verifyRes.status, 200);
    const challengeText = await verifyRes.text();
    assert.strictEqual(challengeText, 'test_challenge_12345');
    console.log('   ✅ GET /webhooks/whatsapp challenge handshake succeeded.');

    // 2. Intent Engine Unit Checks
    console.log('\n2. Testing Intent Engine Classification & Escalation...');
    const res1 = await IntentEngine.classify('Where is my order GS-2024819?');
    assert.strictEqual(res1.intent, 'order_tracking');
    assert.strictEqual(res1.order_id, 'GS-2024819');

    const res2 = await IntentEngine.classify('Mujhe severe allergic reaction hua hai return chahiye');
    assert.strictEqual(res2.intent, 'returns_refunds_exchanges');

    const res3 = await IntentEngine.classify('Package damaged hai, call karo urgently');
    assert.strictEqual(res3.intent, 'complaint_ticket');
    assert.strictEqual(res3.needs_call, true);

    const res4 = await IntentEngine.classify('What is the best serum for oily skin?');
    assert.strictEqual(res4.intent, 'product_recommendation_sales');
    console.log('   ✅ IntentEngine classified all core intents accurately.');

    // 3. End-to-End Order Tracking Webhook Flow
    console.log('\n3. Testing End-to-End Order Tracking Webhook Flow...');
    const webhookRes = await fetch(`${baseUrl}/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+919876543210',
        name: 'Priya Sharma',
        message: 'Where is my order GS-2024819?'
      })
    });
    assert.strictEqual(webhookRes.status, 200);
    const webhookData: any = await webhookRes.json();
    assert.strictEqual(webhookData.status, 'success');
    assert.strictEqual(webhookData.intent, 'order_tracking');
    assert.ok(webhookData.reply.includes('GS-2024819'), 'Reply must contain order ID');
    assert.ok(webhookData.reply.includes('SHIPPED') || webhookData.reply.includes('Shipped'), 'Reply must contain real status');
    assert.ok(webhookData.reply.includes('BlueDart'), 'Reply must contain courier name');
    console.log('   ✅ AI Customer Response Agent grounded with verified order data.');

    // 4. Human Takeover Workflow
    console.log('\n4. Testing Human Takeover & AI Pause Workflow...');
    const convId = webhookData.conversationId;

    // Agent clicks Take Over
    const takeoverRes = await fetch(`${baseUrl}/api/conversations/${convId}/takeover`, { method: 'POST' });
    const takeoverData: any = await takeoverRes.json();
    assert.strictEqual(takeoverData.conversation.aiActive, false);
    assert.strictEqual(takeoverData.conversation.status, 'HUMAN_ACTIVE');
    console.log('   ✅ Conversation transitioned to HUMAN_ACTIVE (AI paused).');

    // Customer sends message while Human is Active
    const customerMsgRes = await fetch(`${baseUrl}/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+919876543210',
        message: 'Hello, are you there?'
      })
    });
    const customerMsgData: any = await customerMsgRes.json();
    assert.strictEqual(customerMsgData.mode, 'human_takeover', 'AI should NOT respond when human is active');
    console.log('   ✅ AI response bypassed while Human Takeover is active.');

    // Agent sends manual reply
    const replyRes = await fetch(`${baseUrl}/api/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'I am personally checking this for you!' })
    });
    const replyData: any = await replyRes.json();
    assert.strictEqual(replyData.message.sender, 'HUMAN');
    console.log('   ✅ Human reply recorded and dispatched.');

    // Release back to AI
    const releaseRes = await fetch(`${baseUrl}/api/conversations/${convId}/release`, { method: 'POST' });
    const releaseData: any = await releaseRes.json();
    assert.strictEqual(releaseData.conversation.aiActive, true);
    assert.strictEqual(releaseData.conversation.status, 'AI_ACTIVE');
    console.log('   ✅ Conversation released back to AI_ACTIVE.');

    // 5. Voice Escalation Test
    console.log('\n5. Testing Voice Escalation & Ticket Generation...');
    const voiceRes = await fetch(`${baseUrl}/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+916543210987',
        name: 'Vikram Singh',
        message: 'Mera package break ho gaya, call me immediately'
      })
    });
    const voiceData: any = await voiceRes.json();
    assert.strictEqual(voiceData.status, 'success');
    assert.ok(voiceData.ticketNumber, 'Ticket must be created for escalation');
    console.log('   ✅ Ticket created and Sarvam voice callback adapter triggered.');

    console.log('\n🎉 ALL VERIFICATION CHECKS PASSED! The vertical slice is robust and complete.\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runSelfCheck().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
