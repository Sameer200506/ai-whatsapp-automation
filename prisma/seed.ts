import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding NivaGlow database...');

  // Clean existing
  await prisma.message.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.template.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.voiceCall.deleteMany();
  await prisma.aiConfiguration.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // 1. Organization
  const org = await prisma.organization.create({
    data: {
      name: 'NivaGlow Wellness',
      slug: 'nivaglow',
      businessName: 'NivaGlow',
      plan: 'pro',
    },
  });

  // Admin User
  const admin = await prisma.user.create({
    data: {
      email: 'dev@nivaglow.in',
      password: 'password123',
      name: 'Dev Dabi',
      role: 'ADMIN',
    },
  });

  await prisma.organizationMember.create({
    data: {
      organizationId: org.id,
      userId: admin.id,
      role: 'ADMIN',
    },
  });

  // Channel
  await prisma.channel.create({
    data: {
      organizationId: org.id,
      type: 'whatsapp',
      phoneNumber: '+91 98765 00000',
      phoneNumberId: '100652345678901',
      webhookVerified: true,
      isActive: true,
    },
  });

  // AI Configuration
  await prisma.aiConfiguration.create({
    data: {
      organizationId: org.id,
      businessName: 'NivaGlow',
      tone: 'Friendly, warm and respectful',
      language: 'English & Hinglish',
      autoOrderTracking: true,
      autoProductQuestions: true,
      autoReturns: true,
      autoFaqs: true,
      escalateDisputes: true,
      escalateLegal: true,
      escalateAngry: true,
      responseLength: 'Normal',
    },
  });

  // 2. Products Catalog
  const prodVitC = await prisma.product.create({
    data: {
      organizationId: org.id,
      externalId: 'PROD-VITC',
      name: 'Vitamin C Radiance Serum (30ml)',
      description: '15% Ethyl Ascorbic Acid + Ferulic Acid. Treats dullness and hyperpigmentation.',
      price: 899,
      sku: 'NG-VITC-30',
      category: 'Serum',
      checkoutUrl: 'https://nivaglow.in/products/vitc',
      imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400',
      benefits: 'Brightens skin, evens complexion, balances oily sebum, non-greasy formula.',
      inStock: true,
      stockQuantity: 120,
    },
  });

  const prodNiac = await prisma.product.create({
    data: {
      organizationId: org.id,
      externalId: 'PROD-NIAC',
      name: 'Niacinamide Pore-Refining Toner (100ml)',
      description: '5% Niacinamide + Zinc PCA. Cleanses enlarged pores and controls excessive oil.',
      price: 599,
      sku: 'NG-NIAC-100',
      category: 'Toner',
      checkoutUrl: 'https://nivaglow.in/products/niacinamide',
      imageUrl: 'https://images.unsplash.com/photo-1608248597359-52d3a39e80a5?w=400',
      benefits: 'Tightens enlarged pores, controls oil shine, non-comedogenic, barrier repair.',
      inStock: true,
      stockQuantity: 85,
    },
  });

  const prodHyal = await prisma.product.create({
    data: {
      organizationId: org.id,
      externalId: 'PROD-HYAL',
      name: 'Hyaluronic Acid Barrier Moisturizer (50ml)',
      description: 'Multi-molecular HA + Ceramides. Delivers 72-hour moisture lock.',
      price: 749,
      sku: 'NG-HYAL-50',
      category: 'Moisturizer',
      checkoutUrl: 'https://nivaglow.in/products/hyaluronic',
      benefits: 'Lightweight soothing gel, repairs skin barrier, dermatologist approved.',
      inStock: true,
      stockQuantity: 40,
    },
  });

  const prodSpf = await prisma.product.create({
    data: {
      organizationId: org.id,
      externalId: 'PROD-SPF',
      name: 'Invisible UV Shield SPF 50+ (50g)',
      description: 'PA++++ hybrid sunscreen with zero white cast and sweat resistance.',
      price: 649,
      sku: 'NG-SPF-50',
      category: 'Sunscreen',
      checkoutUrl: 'https://nivaglow.in/products/sunscreen',
      benefits: 'Broad spectrum UVA/UVB, matte finish, cruelty-free, reef safe.',
      inStock: true,
      stockQuantity: 200,
    },
  });

  // 3. Customers & Orders & Conversations

  // Customer 1: Priya Sharma
  const custPriya = await prisma.customer.create({
    data: {
      organizationId: org.id,
      phone: '+919876543210',
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      lifetimeValue: 2698,
      avatarColor: '#F97316',
      initials: 'PS',
    },
  });

  const orderPriya = await prisma.order.create({
    data: {
      organizationId: org.id,
      customerId: custPriya.id,
      externalId: 'GS-2024819',
      status: 'shipped',
      trackingNumber: 'BD9834521',
      carrier: 'BlueDart Express',
      eta: 'Tomorrow by 7:00 PM',
      total: 899,
    },
  });

  await prisma.orderItem.create({
    data: {
      organizationId: org.id,
      orderId: orderPriya.id,
      productId: prodVitC.id,
      name: 'Vitamin C Radiance Serum (30ml)',
      sku: 'NG-VITC-30',
      quantity: 1,
      price: 899,
    },
  });

  const convPriya = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      customerId: custPriya.id,
      status: 'RESOLVED',
      aiActive: true,
      intent: 'order_tracking',
      priority: 'normal',
      lastMessage: 'Thank you! Kal aa jayega mera order 😊',
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 25),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        organizationId: org.id,
        conversationId: convPriya.id,
        sender: 'CUSTOMER',
        content: 'Hello, mera order kab aayega? Order ID: GS-2024819',
        intent: 'order_tracking',
        orderId: 'GS-2024819',
        createdAt: new Date(Date.now() - 1000 * 60 * 30),
      },
      {
        organizationId: org.id,
        conversationId: convPriya.id,
        sender: 'AI',
        content: 'Hi Priya! 👋 Aapka order check kar liya:\n\n📦 Order #GS-2024819\n🛍️ Vitamin C Radiance Serum (30ml)\n🚚 Status: Shipped ✅\n📅 Expected: Kal (Tomorrow) by 7 PM\n🔍 Tracking: BlueDart — BD9834521\n\nKoi aur help chahiye?',
        intent: 'order_tracking',
        orderId: 'GS-2024819',
        createdAt: new Date(Date.now() - 1000 * 60 * 29),
      },
      {
        organizationId: org.id,
        conversationId: convPriya.id,
        sender: 'CUSTOMER',
        content: 'Thanks! COD hai, cancel ho sakta hai kya?',
        intent: 'order_tracking',
        createdAt: new Date(Date.now() - 1000 * 60 * 27),
      },
      {
        organizationId: org.id,
        conversationId: convPriya.id,
        sender: 'AI',
        content: 'Hi Priya! COD order cancel tabhi possible hai agar "Processing" status mein ho. Aapka order already shipped hai (in-transit), toh ab cancel nahi hoga 😊\n\nDelivery pe koi issue ho toh please batayein — hum refund ya replacement immediately process karenge!',
        intent: 'order_tracking',
        createdAt: new Date(Date.now() - 1000 * 60 * 27),
      },
      {
        organizationId: org.id,
        conversationId: convPriya.id,
        sender: 'CUSTOMER',
        content: 'Thank you! Kal aa jayega mera order 😊',
        intent: 'order_tracking',
        createdAt: new Date(Date.now() - 1000 * 60 * 25),
      },
    ],
  });

  // Customer 2: Vikram Singh (Complaint & Voice Escalation)
  const custVikram = await prisma.customer.create({
    data: {
      organizationId: org.id,
      phone: '+916543210987',
      name: 'Vikram Singh',
      email: 'vikram.singh@example.com',
      lifetimeValue: 1798,
      avatarColor: '#EF4444',
      initials: 'VS',
    },
  });

  const orderVikram = await prisma.order.create({
    data: {
      organizationId: org.id,
      customerId: custVikram.id,
      externalId: 'GS-2024825',
      status: 'delivered',
      trackingNumber: 'DEL776211',
      carrier: 'Delhivery',
      total: 899,
    },
  });

  const convVikram = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      customerId: custVikram.id,
      status: 'HUMAN_REQUESTED',
      aiActive: true,
      intent: 'complaint_ticket',
      priority: 'high',
      lastMessage: 'Thik hai, call ka wait karunga',
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 45),
    },
  });

  const ticketVikram = await prisma.ticket.create({
    data: {
      ticketNumber: 'TKT-2891',
      organizationId: org.id,
      conversationId: convVikram.id,
      customerId: custVikram.id,
      issue: 'Damaged package — Vitamin C Serum arrived crushed',
      priority: 'HIGH',
      status: 'OPEN',
      channel: 'WhatsApp + Voice',
      assigneeName: 'Senior Support Specialist',
    },
  });

  await prisma.message.createMany({
    data: [
      {
        organizationId: org.id,
        conversationId: convVikram.id,
        sender: 'CUSTOMER',
        content: 'Mera package damaged condition mein aaya. Box bilkul crush hua tha.',
        intent: 'complaint_ticket',
        createdAt: new Date(Date.now() - 1000 * 60 * 50),
      },
      {
        organizationId: org.id,
        conversationId: convVikram.id,
        sender: 'AI',
        content: 'Hi Vikram ji! Bahut sorry for this experience 🙏\n\nAapki complaint note kar li hai:\n🎫 Ticket: #TKT-2891 (High Priority)\n\nKya aap packaging ki photo share kar sakte hain? Hum refund/replacement immediately process karenge.',
        intent: 'complaint_ticket',
        needsHuman: true,
        ticketId: 'TKT-2891',
        createdAt: new Date(Date.now() - 1000 * 60 * 49),
      },
      {
        organizationId: org.id,
        conversationId: convVikram.id,
        sender: 'CUSTOMER',
        content: 'Photo bhej raha hoon. Aur mujhe call karke baat karni hai, urgently call karo.',
        intent: 'complaint_ticket',
        createdAt: new Date(Date.now() - 1000 * 60 * 47),
      },
      {
        organizationId: org.id,
        conversationId: convVikram.id,
        sender: 'AI',
        content: 'Thank you Vikram ji! Photo mil gayi aur call request schedule ho gayi hai ✅\n\nAapka case high priority mark kiya hai. Sarvam AI Voice specialist call karega for instant replacement.\n\n⏰ Estimated resolution: 24-48 hours',
        intent: 'complaint_ticket',
        needsHuman: true,
        needsCall: true,
        ticketId: 'TKT-2891',
        createdAt: new Date(Date.now() - 1000 * 60 * 46),
      },
      {
        organizationId: org.id,
        conversationId: convVikram.id,
        sender: 'CUSTOMER',
        content: 'Thik hai, call ka wait karunga',
        intent: 'complaint_ticket',
        createdAt: new Date(Date.now() - 1000 * 60 * 45),
      },
    ],
  });

  // Customer 3: Anita Joshi (Sales & Recommendation)
  const custAnita = await prisma.customer.create({
    data: {
      organizationId: org.id,
      phone: '+917654321098',
      name: 'Anita Joshi',
      email: 'anita.joshi@example.com',
      lifetimeValue: 1498,
      avatarColor: '#8B5CF6',
      initials: 'AJ',
    },
  });

  const convAnita = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      customerId: custAnita.id,
      status: 'RESOLVED',
      aiActive: true,
      intent: 'product_recommendation_sales',
      priority: 'normal',
      lastMessage: 'Add to cart kar diya! Thanks 😍',
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 90),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        organizationId: org.id,
        conversationId: convAnita.id,
        sender: 'CUSTOMER',
        content: 'Oily skin ke liye koi accha serum ya toner recommend karo',
        intent: 'product_recommendation_sales',
        createdAt: new Date(Date.now() - 1000 * 60 * 95),
      },
      {
        organizationId: org.id,
        conversationId: convAnita.id,
        sender: 'AI',
        content: 'Hi Anita! Oily skin ke liye best options:\n\n⭐ Niacinamide Pore-Refining Toner — ₹599\n• Pores tighten karta hai\n• Oil control ke liye perfect\n• Non-comedogenic formula\n🔗 Shop: nivaglow.in/products/niacinamide\n\n⭐ Vitamin C Radiance Serum — ₹899\n• Brightness boost + oil balance\n🔗 Shop: nivaglow.in/products/vitc\n\nKaunsa prefer karoge?',
        intent: 'product_recommendation_sales',
        createdAt: new Date(Date.now() - 1000 * 60 * 94),
      },
      {
        organizationId: org.id,
        conversationId: convAnita.id,
        sender: 'CUSTOMER',
        content: 'Niacinamide wala try karna chahti hoon. COD available hai?',
        intent: 'product_recommendation_sales',
        createdAt: new Date(Date.now() - 1000 * 60 * 92),
      },
      {
        organizationId: org.id,
        conversationId: convAnita.id,
        sender: 'AI',
        content: 'Haan Anita! COD available hai ✅ Niacinamide Pore-Refining Toner (₹599) ke liye COD full India mein available hai. Free shipping above ₹499! 🎉\n\nYahan se order karein: nivaglow.in/products/niacinamide',
        intent: 'product_recommendation_sales',
        createdAt: new Date(Date.now() - 1000 * 60 * 91),
      },
      {
        organizationId: org.id,
        conversationId: convAnita.id,
        sender: 'CUSTOMER',
        content: 'Add to cart kar diya! Thanks 😍',
        intent: 'product_recommendation_sales',
        createdAt: new Date(Date.now() - 1000 * 60 * 90),
      },
    ],
  });

  // Customer 4: Rahul Mehta (Returns & Refund)
  const custRahul = await prisma.customer.create({
    data: {
      organizationId: org.id,
      phone: '+918765432109',
      name: 'Rahul Mehta',
      email: 'rahul.mehta@example.com',
      lifetimeValue: 749,
      avatarColor: '#3B82F6',
      initials: 'RM',
    },
  });

  const convRahul = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      customerId: custRahul.id,
      status: 'IN_PROGRESS',
      aiActive: true,
      intent: 'returns_refunds_exchanges',
      priority: 'high',
      lastMessage: 'Thik hai refund ka wait karunga',
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 120),
    },
  });

  await prisma.ticket.create({
    data: {
      ticketNumber: 'TKT-2890',
      organizationId: org.id,
      conversationId: convRahul.id,
      customerId: custRahul.id,
      issue: 'Allergic reaction return — Hyaluronic Barrier Moisturizer',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      channel: 'WhatsApp + Voice',
      assigneeName: 'Customer Happiness Lead',
    },
  });

  // 4. Voice Calls
  await prisma.voiceCall.createMany({
    data: [
      {
        organizationId: org.id,
        customerId: custVikram.id,
        customerName: 'Vikram Singh',
        phone: '+916543210987',
        reason: 'Damaged Package Complaint',
        ticketNumber: 'TKT-2891',
        duration: '2:34',
        durationSec: 154,
        outcome: 'Replacement approved. Pickup scheduled.',
        summary: 'Customer received crushed packaging. Agent verified photo, issued free replacement dispatch.',
        transcript: 'Customer: Hello? Mera parcel pura tut gaya tha. Agent: Namaste Vikram ji, humne replacement confirm kar di hai.',
        status: 'Resolved',
      },
      {
        organizationId: org.id,
        customerId: custRahul.id,
        customerName: 'Rahul Mehta',
        phone: '+918765432109',
        reason: 'Return Process — Allergic Reaction',
        ticketNumber: 'TKT-2890',
        duration: '1:47',
        durationSec: 107,
        outcome: 'Full refund approved. Return pickup in 2 days.',
        summary: 'Customer experienced mild redness. Batch #NG-2024-B47 documented. 100% refund initiated.',
        status: 'Resolved',
      },
      {
        organizationId: org.id,
        customerName: 'Pooja Verma',
        phone: '+919123456789',
        reason: 'Delivery Delay Inquiry',
        ticketNumber: 'TKT-2888',
        duration: '3:12',
        durationSec: 192,
        outcome: 'Delivery rescheduled. ₹100 goodwill voucher issued.',
        summary: 'Courier delay due to heavy rains. Customer notified and appeased.',
        status: 'Resolved',
      },
    ],
  });

  // 5. Templates
  await prisma.template.createMany({
    data: [
      {
        organizationId: org.id,
        name: 'Order Confirmed',
        category: 'utility',
        status: 'Approved',
        preview: 'Hi {{1}}! 🎉 Your order #{{2}} has been confirmed.\n\nProduct: {{3}}\nTotal: ₹{{4}}\nDelivery: {{5}} days\n\nTrack: nivaglow.in/track',
        sentCount: 1247,
        deliveredRate: '98%',
        readRate: '76%',
      },
      {
        organizationId: org.id,
        name: 'Shipping Update',
        category: 'utility',
        status: 'Approved',
        preview: 'Hi {{1}}! Your order #{{2}} has been shipped! 🚚\n\nCourier: {{3}}\nTracking: {{4}}\nExpected: {{5}}\n\nTrack live: nivaglow.in/track',
        sentCount: 1189,
        deliveredRate: '97%',
        readRate: '82%',
      },
      {
        organizationId: org.id,
        name: 'COD Confirmation',
        category: 'utility',
        status: 'Approved',
        preview: 'Hi {{1}}! Please confirm your COD order #{{2}} for ₹{{3}}.\n\nReply YES to confirm\nReply NO to cancel',
        sentCount: 342,
        deliveredRate: '99%',
        readRate: '91%',
      },
      {
        organizationId: org.id,
        name: 'Abandoned Cart',
        category: 'marketing',
        status: 'Approved',
        preview: 'Hi {{1}}! 👀 You left something behind!\n\n🛒 {{2}} is in your cart — {{3}} left in stock.\n\nCode SAVE10 for 10% off! 🔗 nivaglow.in/cart',
        sentCount: 987,
        deliveredRate: '96%',
        readRate: '54%',
      },
      {
        organizationId: org.id,
        name: 'Review Request',
        category: 'marketing',
        status: 'Approved',
        preview: 'Hi {{1}}! 🌟 How are you liking your {{2}}?\n\nTap below to leave a review: nivaglow.in/review/{{3}}',
        sentCount: 654,
        deliveredRate: '97%',
        readRate: '43%',
      },
      {
        organizationId: org.id,
        name: 'Reorder Reminder',
        category: 'marketing',
        status: 'Approved',
        preview: 'Hi {{1}}! ⏰ Running low on {{2}}?\n\nOrder now and get FREE shipping today 🚀\n🔗 nivaglow.in/reorder/{{3}}',
        sentCount: 421,
        deliveredRate: '95%',
        readRate: '38%',
      },
    ],
  });

  // 6. Campaigns
  await prisma.campaign.createMany({
    data: [
      {
        organizationId: org.id,
        name: 'Vitamin C Abandoned Cart',
        type: 'abandoned_cart',
        templateName: 'Abandoned Cart',
        status: 'ACTIVE',
        customerName: 'Arjun Patel',
        customerPhone: '+91 43210 98765',
        messagePreview: 'You left Vitamin C Serum in your cart — limited stock!',
        delivered: true,
        read: true,
        replied: true,
        converted: true,
        revenue: 899,
      },
      {
        organizationId: org.id,
        name: 'Sunscreen Abandoned Cart',
        type: 'abandoned_cart',
        templateName: 'Abandoned Cart',
        status: 'ACTIVE',
        customerName: 'Meera Nair',
        customerPhone: '+91 77890 12345',
        messagePreview: 'Your SPF 50 UV Shield is waiting in cart!',
        delivered: true,
        read: true,
        replied: false,
        converted: false,
        revenue: 0,
      },
      {
        organizationId: org.id,
        name: 'COD Order Confirmation Batch',
        type: 'cod_confirmation',
        templateName: 'COD Confirmation',
        status: 'ACTIVE',
        customerName: 'Sanjay Kumar',
        customerPhone: '+91 99123 45678',
        messagePreview: 'Please confirm your COD order #GS-2024831 for ₹1,299',
        delivered: true,
        read: true,
        replied: true,
        converted: true,
        revenue: 1299,
      },
      {
        organizationId: org.id,
        name: 'Moisturizer Review Request',
        type: 'review_request',
        templateName: 'Review Request',
        status: 'ACTIVE',
        customerName: 'Sunita Agrawal',
        customerPhone: '+91 55678 90123',
        messagePreview: 'How are you liking your Hyaluronic Acid Moisturizer?',
        delivered: true,
        read: true,
        replied: true,
        converted: false,
        revenue: 0,
      },
    ],
  });

  console.log('✅ Seed completed successfully with Indian D2C dummy data!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
