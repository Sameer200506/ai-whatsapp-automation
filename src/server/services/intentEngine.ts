export interface IntentResult {
  intent: 'order_tracking' | 'returns_refunds_exchanges' | 'product_recommendation_sales' | 'complaint_ticket' | 'general_support';
  needs_human: boolean;
  needs_call: boolean;
  order_id: string;
  reason?: string;
}

export class IntentEngine {
  /**
   * Classifies inbound customer message into one of 5 supported intents.
   * Identifies human escalation triggers and voice callback requests.
   * Extracts order ID when present.
   */
  public static async classify(message: string, customerName?: string): Promise<IntentResult> {
    const text = message.trim();
    const lower = text.toLowerCase();

    // 1. Order ID Extraction (Matches e.g. GS-2024819, #GS-2024819, #12345, 12345, ORD-99)
    let orderId = '';
    const orderMatch = text.match(/(?:order\s*(?:id|#|number|no\.?)?\s*[:\-]?\s*|#)([a-z0-9\-_]{3,20})/i) ||
                       text.match(/\b(GS-[0-9]{4,10})\b/i) ||
                       text.match(/\b([0-9]{5,8})\b/);
    if (orderMatch && orderMatch[1]) {
      orderId = orderMatch[1].replace(/^#/, '').toUpperCase();
    }

    // 2. Escalation checks (Legal, Disputes, Abusive, Explicit Human Request)
    const humanKeywords = [
      'human', 'agent', 'executive', 'representative', 'real person', 'talk to person',
      'consumer court', 'police', 'fraud', 'lawyer', 'legal action', 'sue you',
      'scam', 'cheating', 'loot', 'stolen', 'bakwas', 'fraud brand'
    ];
    const needsHuman = humanKeywords.some(kw => lower.includes(kw));

    // 3. Voice callback request (Explicit Call Me or Voice triggers)
    const callKeywords = [
      'call me', 'call karo', 'call urgently', 'give me a call', 'phone karo', 
      'urgent call', 'speak on phone', 'voice call', 'callback', 'call kar do'
    ];
    const needsCall = callKeywords.some(kw => lower.includes(kw));

    // 4. Intent Classification
    let intent: IntentResult['intent'] = 'general_support';

    // Order Tracking signals
    if (
      lower.includes('order') && (
        lower.includes('where') || lower.includes('status') || lower.includes('track') || 
        lower.includes('kab') || lower.includes('kahan') || lower.includes('deliver') || 
        lower.includes('ship') || lower.includes('eta') || lower.includes('delayed') ||
        lower.includes('cancel')
      ) || orderId !== '' && !lower.includes('damaged') && !lower.includes('return')
    ) {
      intent = 'order_tracking';
    } 
    // Returns & Refunds signals
    else if (
      lower.includes('return') || lower.includes('refund') || lower.includes('exchange') ||
      lower.includes('allergic') || lower.includes('reaction') || lower.includes('wapas') ||
      lower.includes('paisa wapas') || lower.includes('replace')
    ) {
      intent = 'returns_refunds_exchanges';
    }
    // Complaint signals
    else if (
      lower.includes('damage') || lower.includes('broken') || lower.includes('break') || lower.includes('crush') ||
      lower.includes('leak') || lower.includes('bad quality') || lower.includes('wrong item') ||
      lower.includes('faulty') || lower.includes('complaint') || lower.includes('kharab') || lower.includes('tut') ||
      needsCall
    ) {
      intent = 'complaint_ticket';
    }
    // Product recommendation / Sales signals
    else if (
      lower.includes('recommend') || lower.includes('serum') || lower.includes('toner') ||
      lower.includes('moisturizer') || lower.includes('sunscreen') || lower.includes('price') ||
      lower.includes('oily skin') || lower.includes('dry skin') || lower.includes('buy') ||
      lower.includes('cost') || lower.includes('discount') || lower.includes('offer') ||
      lower.includes('cart') || lower.includes('khareed') || lower.includes('best product')
    ) {
      intent = 'product_recommendation_sales';
    }

    return {
      intent,
      needs_human: needsHuman,
      needs_call: needsCall,
      order_id: orderId,
      reason: `Classified via keyword-semantic matching (Intent: ${intent})`
    };
  }
}
