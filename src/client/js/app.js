// NivaGlow AI WhatsApp Sales & Support OS Client Logic

let activeConversationId = null;
let currentConversations = [];
let ws = null;
let currentConvData = null;

// Waveform patterns for voice player
const wfPatterns = [
  [.2,.4,.6,.5,.8,.9,.7,.6,.8,.9,.7,.5,.8,.6,.9,.7,.8,.6,.5,.7,.9,.8,.6,.7,.9,.8,.7,.6,.8,.5,.6,.7,.8,.9,.7,.8,.6,.5,.7,.8,.9,.6,.7,.5,.6,.4,.5,.3,.2,.1],
  [.1,.3,.5,.7,.8,.6,.7,.9,.5,.6,.8,.7,.9,.6,.5,.7,.8,.6,.9,.7,.5,.6,.8,.7,.6,.5,.8,.7,.6,.9,.5,.4,.6,.8,.7,.5,.6,.7,.5,.4,.6,.5,.4,.3,.5,.4,.3,.2,.1,.1],
  [.3,.5,.7,.9,.8,.7,.9,.8,.7,.6,.9,.8,.7,.8,.9,.7,.6,.8,.9,.8,.7,.6,.7,.8,.9,.7,.8,.6,.7,.9,.8,.6,.7,.5,.6,.8,.7,.5,.6,.7,.8,.6,.5,.4,.5,.6,.4,.3,.2,.1]
];
const players = {};
const playerTimers = {};

// 1. INITIALIZATION & WEBSOCKET
window.addEventListener('DOMContentLoaded', () => {
  setupWebSocket();
  loadConversations();
  loadCalls();
  loadTemplates();
  loadCampaigns();
  loadTickets();
  loadAiConfig();
  loadKpis();

  // Polling fallback if WebSocket drops
  setInterval(loadKpis, 30000);
});

function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('⚡ Connected to NivaGlow Live WebSocket Gateway');
      const feedStatus = document.getElementById('liveFeedStatus');
      if (feedStatus) feedStatus.innerHTML = '<span style="color:var(--g)">● Connected Live</span>';
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleSocketEvent(payload);
      } catch (err) {
        console.error('Socket message parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected. Retrying in 3s...');
      const feedStatus = document.getElementById('liveFeedStatus');
      if (feedStatus) feedStatus.innerHTML = '<span style="color:var(--re)">○ Reconnecting...</span>';
      setTimeout(setupWebSocket, 3000);
    };
  } catch (err) {
    console.error('Failed to init WebSocket:', err);
  }
}

function handleSocketEvent(event) {
  const { type, data } = event;

  switch (type) {
    case 'NEW_MESSAGE': {
      // If message belongs to active conversation, append to chat view
      if (activeConversationId && data.conversationId === activeConversationId) {
        appendChatMessage(data.message);
      }
      // Update preview in conversation list
      loadConversations(false);
      // Append to dashboard activity feed
      appendActivityFeed(data);
      break;
    }

    case 'CONVERSATION_UPDATED': {
      loadConversations(false);
      if (activeConversationId && data.conversationId === activeConversationId) {
        if (data.status) updateTakeoverUI(data.aiActive !== false, data.status);
      }
      break;
    }

    case 'TAKEOVER_STATE': {
      if (activeConversationId && data.conversationId === activeConversationId) {
        updateTakeoverUI(data.aiActive, data.status);
      }
      loadConversations(false);
      break;
    }

    case 'TICKET_CREATED': {
      loadTickets();
      loadKpis();
      break;
    }

    case 'CALL_LOGGED': {
      loadCalls();
      loadKpis();
      break;
    }
  }
}

// 2. NAVIGATION
function nav(el) {
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('act'));
  el.classList.add('act');
  const pg = el.dataset.page;
  switchPage(pg);
}

function navByPage(pg) {
  const targetNav = document.querySelector(`.ni[data-page="${pg}"]`);
  if (targetNav) nav(targetNav);
}

function switchPage(pg) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('act'));
  const target = document.getElementById('pg-' + pg);
  if (target) {
    target.classList.add('act');
    if (pg === 'convs') {
      target.style.display = 'grid';
      loadConversations(true);
    }
  }
}

// 3. CONVERSATIONS
async function loadConversations(selectFirst = false) {
  try {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    currentConversations = data;

    renderConvList(data);

    // Update badge in sidebar
    const navCount = document.getElementById('navConvCount');
    if (navCount) navCount.textContent = data.length;

    if (selectFirst && data.length > 0 && !activeConversationId) {
      selectConversation(data[0].id);
    } else if (activeConversationId) {
      // Re-highlight active
      const el = document.querySelector(`.ci[data-id="${activeConversationId}"]`);
      if (el) el.classList.add('sel');
    }
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

function renderConvList(convs) {
  const container = document.getElementById('convList');
  if (!container) return;

  if (convs.length === 0) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--t3);font-size:13px">No conversations found</div>`;
    return;
  }

  container.innerHTML = convs.map(c => {
    const isSel = c.id === activeConversationId ? ' sel' : '';
    let badgeClass = 'bdg-b';
    let badgeText = c.intent || 'support';

    if (c.intent === 'order_tracking') { badgeClass = 'bdg-b'; badgeText = 'Order Tracking'; }
    else if (c.intent === 'returns_refunds_exchanges') { badgeClass = 'bdg-o'; badgeText = 'Returns / Refund'; }
    else if (c.intent === 'complaint_ticket') { badgeClass = 'bdg-r'; badgeText = 'Complaint'; }
    else if (c.intent === 'product_recommendation_sales') { badgeClass = 'bdg-p'; badgeText = 'Sales / Products'; }
    else { badgeClass = 'bdg-gray'; badgeText = 'General Support'; }

    let statusBadge = `<span class="bdg bdg-g" style="font-size:10px;padding:2px 6px">AI Active</span>`;
    if (!c.aiActive || c.status === 'HUMAN_ACTIVE') {
      statusBadge = `<span class="bdg bdg-o" style="font-size:10px;padding:2px 6px">Human Active</span>`;
    } else if (c.status === 'HUMAN_REQUESTED') {
      statusBadge = `<span class="bdg bdg-r" style="font-size:10px;padding:2px 6px">Escalated</span>`;
    } else if (c.status === 'RESOLVED') {
      statusBadge = `<span class="bdg bdg-g" style="font-size:10px;padding:2px 6px">Resolved</span>`;
    }

    return `
      <div class="ci${isSel}" data-id="${c.id}" onclick="selectConversation('${c.id}', this)">
        <div class="cav" style="background:${c.color}">${c.ini}</div>
        <div class="ci-meta">
          <div class="ci-nm">${c.name}</div>
          <div class="ci-pv">${c.preview}</div>
          <div style="margin-top:4px"><span class="bdg ${badgeClass}" style="font-size:10px;padding:1px 6px">${badgeText}</span></div>
        </div>
        <div class="ci-rt">
          <span class="ci-tm">${c.time}</span>
          ${statusBadge}
        </div>
      </div>
    `;
  }).join('');
}

function filterConvList(query) {
  const q = query.toLowerCase();
  const filtered = currentConversations.filter(c =>
    c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.preview && c.preview.toLowerCase().includes(q))
  );
  renderConvList(filtered);
}

async function selectConversation(id, element) {
  activeConversationId = id;
  document.querySelectorAll('.ci').forEach(c => c.classList.remove('sel'));
  if (element) {
    element.classList.add('sel');
  } else {
    const target = document.querySelector(`.ci[data-id="${id}"]`);
    if (target) target.classList.add('sel');
  }

  try {
    const res = await fetch(`/api/conversations/${id}`);
    const conv = await res.json();
    currentConvData = conv;

    // 1. Header
    const avtr = document.getElementById('chatAvtr');
    avtr.style.background = conv.customer.avatarColor || '#4F46E5';
    avtr.textContent = conv.customer.initials || 'CU';

    document.getElementById('chatNm').textContent = `${conv.customer.name} · ${conv.customer.phone}`;
    document.getElementById('chatSt').innerHTML = `
      <span style="width:7px;height:7px;border-radius:50%;background:var(--gwa);display:inline-block"></span>
      Active on WhatsApp · Intent: <strong>${conv.intent || 'general_support'}</strong>
    `;

    // 2. Takeover Bar
    updateTakeoverUI(conv.aiActive, conv.status);

    // 3. Render Messages
    const msgsContainer = document.getElementById('chatMsgs');
    msgsContainer.innerHTML = conv.messages.map(m => createMessageHtml(m, conv.customer.name)).join('');
    msgsContainer.scrollTop = msgsContainer.scrollHeight;

    // 4. Show Composer
    document.getElementById('chatComposer').style.display = 'flex';

    // 5. Customer Context Drawer
    const totalOrders = conv.customer.orders ? conv.customer.orders.length : 0;
    const ltv = conv.customer.lifetimeValue ? `₹${conv.customer.lifetimeValue.toLocaleString()}` : '₹0';
    document.getElementById('chatInfo').innerHTML = `
      <div class="cii"><div class="cii-lb">Intent</div><div class="cii-vl"><span class="bdg bdg-p">${conv.intent}</span></div></div>
      <div class="cii"><div class="cii-lb">Phone</div><div class="cii-vl">${conv.customer.phone}</div></div>
      <div class="cii"><div class="cii-lb">Orders</div><div class="cii-vl">${totalOrders} orders (${ltv} LTV)</div></div>
      <div class="cii"><div class="cii-lb">Channel</div><div class="cii-vl">Meta WhatsApp API</div></div>
      <div class="cii"><div class="cii-lb">Mode</div><div class="cii-vl" id="chatInfoStatus">${conv.aiActive ? '🤖 AI Auto' : '🧑 Human Agent'}</div></div>
    `;
  } catch (err) {
    console.error('Failed to load conversation details:', err);
  }
}

function updateTakeoverUI(aiActive, status) {
  const bar = document.getElementById('takeoverBar');
  const dot = document.getElementById('tobDot');
  const text = document.getElementById('tobText');
  const btn = document.getElementById('tobBtn');
  const chatInfoStatus = document.getElementById('chatInfoStatus');

  if (aiActive) {
    bar.classList.remove('human-mode');
    dot.className = 'tob-dot';
    text.innerHTML = `🤖 <strong>AI Support Active</strong> — Auto-responding with real D2C order grounding`;
    btn.className = 'btn btn-sm btn-p';
    btn.textContent = 'Take Over Conversation';
    if (chatInfoStatus) chatInfoStatus.textContent = '🤖 AI Auto';
  } else {
    bar.classList.add('human-mode');
    dot.className = 'tob-dot human';
    text.innerHTML = `🧑 <strong>Human Takeover Active</strong> — AI is paused. Customer will receive your direct replies.`;
    btn.className = 'btn btn-sm btn-o';
    btn.textContent = 'Return to AI';
    if (chatInfoStatus) chatInfoStatus.textContent = '🧑 Human Active';
  }
}

async function toggleTakeover() {
  if (!activeConversationId) return;

  const endpoint = currentConvData && currentConvData.aiActive === false ? 'release' : 'takeover';

  try {
    const res = await fetch(`/api/conversations/${activeConversationId}/${endpoint}`, {
      method: 'POST'
    });
    const result = await res.json();
    if (result.success) {
      currentConvData.aiActive = result.conversation.aiActive;
      currentConvData.status = result.conversation.status;
      updateTakeoverUI(result.conversation.aiActive, result.conversation.status);
    }
  } catch (err) {
    console.error('Takeover toggle error:', err);
  }
}

function createMessageHtml(m, customerName) {
  const isCustomer = m.sender === 'CUSTOMER';
  const isAI = m.sender === 'AI';
  const isHuman = m.sender === 'HUMAN';
  const isSystem = m.sender === 'SYSTEM';

  if (isSystem) {
    return `<div class="mg mg-s"><div class="mb mb-s">⚙️ ${m.content}</div></div>`;
  }

  let roleClass = 'mg-c';
  let bubbleClass = 'mb-c';
  let senderLabel = `👤 ${customerName ? customerName.split(' ')[0] : 'Customer'}`;

  if (isAI) {
    roleClass = 'mg-a';
    bubbleClass = 'mb-a';
    senderLabel = '🤖 AI Support Agent';
  } else if (isHuman) {
    roleClass = 'mg-h';
    bubbleClass = 'mb-h';
    senderLabel = '🧑 Human Specialist (Dev)';
  }

  return `
    <div class="mg ${roleClass}">
      <div class="mg-sndr">${senderLabel}</div>
      <div class="mb ${bubbleClass}">${escapeHtml(m.content)}</div>
      <div class="mb-tm ${isAI ? 'a' : ''}">${m.time || ''}</div>
    </div>
  `;
}

function appendChatMessage(msg) {
  const container = document.getElementById('chatMsgs');
  if (!container) return;

  const customerName = currentConvData?.customer?.name || 'Customer';
  const html = createMessageHtml({
    ...msg,
    time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, customerName);

  container.insertAdjacentHTML('beforeend', html);
  container.scrollTop = container.scrollHeight;
}

async function sendHumanReply() {
  const input = document.getElementById('composerInput');
  const text = input.value.trim();
  if (!text || !activeConversationId) return;

  input.value = '';

  try {
    const res = await fetch(`/api/conversations/${activeConversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const result = await res.json();
    if (result.success) {
      appendChatMessage(result.message);
    }
  } catch (err) {
    console.error('Failed to send human reply:', err);
  }
}

// 4. VOICE CALLS
async function loadCalls() {
  try {
    const res = await fetch('/api/voice-calls');
    const calls = await res.json();

    const el = document.getElementById('callList');
    if (!el) return;

    const navCallCount = document.getElementById('navCallCount');
    if (navCallCount) navCallCount.textContent = calls.length;

    el.innerHTML = calls.map((c, idx) => {
      const colors = ['#EF4444', '#3B82F6', '#EC4899', '#8B5CF6'];
      const color = colors[idx % colors.length];
      const initials = (c.customerName || 'Customer').split(' ').map(w => w[0]).join('').slice(0, 2);

      return `
        <div class="call-card">
          <div class="call-av" style="background:${color}">${initials}</div>
          <div class="call-inf">
            <div class="call-nm">${c.customerName}</div>
            <div class="call-mt">
              <span>${c.phone}</span>
              <span style="font-weight:600;color:var(--t1)">⏱ ${c.duration}</span>
            </div>
            <div class="call-mt" style="margin-top:4px"><span class="bdg bdg-p" style="font-size:10px">${c.reason}</span></div>
            ${c.ticketNumber ? `<div class="call-mt" style="margin-top:3px">Ticket: <strong>#${c.ticketNumber}</strong></div>` : ''}
            <div class="call-mt" style="margin-top:3px;color:var(--g);font-size:11.5px">✅ ${c.outcome}</div>
          </div>
          <div class="aplayer" id="ap-${c.id}">
            <button class="pbtn" onclick="togglePlay('${c.id}', ${c.durationSec || 120}, ${idx})" id="pb-${c.id}" title="Play Recording">
              <svg viewBox="0 0 24 24" id="pbi-${c.id}"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <div class="wf-wrap">
              <div class="wf" id="wf-${c.id}">${genWFHtml(c.id, idx)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:10.5px;color:var(--t3)">Sarvam AI Telephony · Recording Verified</span>
              </div>
            </div>
            <div class="at" id="at-${c.id}">0:00 / ${c.duration}</div>
          </div>
          <div class="call-st"><span class="bdg bdg-g">${c.status}</span></div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load voice calls:', err);
  }
}

function genWFHtml(id, idx) {
  const patt = wfPatterns[idx % wfPatterns.length];
  return patt.map((h, i) => `<div class="wfb" id="wfb-${id}-${i}" style="height:${Math.round(h * 32)}px"></div>`).join('');
}

function togglePlay(id, durSec, idx) {
  if (!players[id]) players[id] = { playing: false, current: 0 };
  const p = players[id];
  const pbi = document.getElementById('pbi-' + id);
  const at = document.getElementById('at-' + id);
  const patt = wfPatterns[idx % wfPatterns.length];
  const total = patt.length;

  if (p.playing) {
    p.playing = false;
    clearInterval(playerTimers[id]);
    pbi.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
  } else {
    p.playing = true;
    pbi.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    const tickMs = (durSec / total) * 1000 / 6;

    playerTimers[id] = setInterval(() => {
      p.current++;
      for (let i = 0; i < total; i++) {
        const bar = document.getElementById(`wfb-${id}-${i}`);
        if (bar) bar.classList.toggle('pl', i < p.current);
      }
      const elapsed = Math.floor((p.current / total) * durSec);
      const em = Math.floor(elapsed / 60), es = elapsed % 60;
      const tm = Math.floor(durSec / 60), ts = durSec % 60;
      at.textContent = `${em}:${es.toString().padStart(2, '0')} / ${tm}:${ts.toString().padStart(2, '0')}`;

      if (p.current >= total) {
        p.playing = false;
        p.current = 0;
        clearInterval(playerTimers[id]);
        pbi.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
        at.textContent = `0:00 / ${tm}:${ts.toString().padStart(2, '0')}`;
        for (let i = 0; i < total; i++) {
          const b = document.getElementById(`wfb-${id}-${i}`);
          if (b) b.classList.remove('pl');
        }
      }
    }, tickMs);
  }
}

// 5. TEMPLATES
async function loadTemplates(filter = 'all') {
  try {
    const res = await fetch('/api/templates');
    const templates = await res.json();
    const el = document.getElementById('tplGrid');
    if (!el) return;

    const filtered = filter === 'all' ? templates : templates.filter(t => t.category === filter);

    el.innerHTML = filtered.map(t => `
      <div class="tpl-card">
        <div class="tpl-hdr">
          <div>
            <div class="tpl-nm">${t.name}</div>
            <div class="tpl-cat">${t.category.toUpperCase()} · WhatsApp Business Cloud</div>
          </div>
          <span class="bdg bdg-g">${t.status}</span>
        </div>
        <div class="tpl-prev">${t.preview}</div>
        <div class="tpl-foot">
          <div class="ts"><div class="ts-v">${t.sentCount.toLocaleString()}</div><div class="ts-l">Sent</div></div>
          <div class="ts"><div class="ts-v" style="color:var(--g)">${t.deliveredRate}</div><div class="ts-l">Delivered</div></div>
          <div class="ts"><div class="ts-v" style="color:var(--pr)">${t.readRate}</div><div class="ts-l">Read Rate</div></div>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('#tplFilters .fc').forEach(btn => {
      btn.classList.toggle('act', btn.dataset.f === filter);
      btn.onclick = () => loadTemplates(btn.dataset.f);
    });
  } catch (err) {
    console.error('Failed to load templates:', err);
  }
}

// 6. CAMPAIGNS
async function loadCampaigns() {
  try {
    const res = await fetch('/api/campaigns');
    const campaigns = await res.json();
    const el = document.getElementById('campTable');
    if (!el) return;

    el.innerHTML = campaigns.map(c => `
      <tr>
        <td><strong>${c.customerName || 'Customer'}</strong></td>
        <td style="color:var(--t3);font-size:12px">${c.customerPhone || 'N/A'}</td>
        <td><span class="bdg bdg-p">${c.type.replace('_', ' ').toUpperCase()}</span></td>
        <td style="color:var(--t2);max-width:240px;font-size:12.5px">${c.messagePreview || 'Campaign notification'}</td>
        <td><span class="bdg bdg-g">${c.status}</span></td>
        <td style="font-weight:600;color:var(--t1)">₹${c.revenue || 0}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load campaigns:', err);
  }
}

// 7. TICKETS
async function loadTickets() {
  try {
    const res = await fetch('/api/tickets');
    const tickets = await res.json();
    const el = document.getElementById('tickTable');
    if (!el) return;

    const navCount = document.getElementById('navTicketCount');
    if (navCount) navCount.textContent = tickets.filter(t => t.status === 'OPEN').length;
    const dashOpen = document.getElementById('dashOpenTickets');
    if (dashOpen) dashOpen.textContent = tickets.filter(t => t.status === 'OPEN').length;

    el.innerHTML = tickets.map(t => {
      let pcls = 'bdg-b';
      if (t.priority === 'HIGH') pcls = 'bdg-r';
      if (t.priority === 'URGENT') pcls = 'bdg-r';
      if (t.priority === 'LOW') pcls = 'bdg-gray';

      const scls = t.status === 'RESOLVED' ? 'bdg-g' : (t.status === 'OPEN' ? 'bdg-o' : 'bdg-b');

      return `
        <tr>
          <td><strong style="font-family:monospace;font-size:13px">${t.ticketNumber}</strong></td>
          <td>${t.customer?.name || 'Customer'}</td>
          <td style="max-width:260px;font-size:12.5px;color:var(--t2)">${t.issue}</td>
          <td><span class="bdg ${pcls}">${t.priority}</span></td>
          <td style="font-size:12px;color:var(--t3)">${t.channel}</td>
          <td><span class="bdg ${scls}">${t.status}</span></td>
          <td style="font-size:12px;color:var(--t3);white-space:nowrap">${new Date(t.createdAt).toLocaleDateString()}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load tickets:', err);
  }
}

// 8. AI CONFIG SETTINGS
async function loadAiConfig() {
  try {
    const res = await fetch('/api/ai-config');
    const cfg = await res.json();
    if (!cfg) return;

    if (document.getElementById('cfgBusinessName')) document.getElementById('cfgBusinessName').value = cfg.businessName || 'NivaGlow';
    if (document.getElementById('cfgTone')) document.getElementById('cfgTone').value = cfg.tone || 'Friendly & Professional';
    if (document.getElementById('cfgLang')) document.getElementById('cfgLang').value = cfg.language || 'English & Hinglish';
    if (document.getElementById('cfgOrder')) document.getElementById('cfgOrder').checked = cfg.autoOrderTracking !== false;
    if (document.getElementById('cfgProd')) document.getElementById('cfgProd').checked = cfg.autoProductQuestions !== false;
    if (document.getElementById('cfgReturns')) document.getElementById('cfgReturns').checked = cfg.autoReturns !== false;
    if (document.getElementById('cfgFaq')) document.getElementById('cfgFaq').checked = cfg.autoFaqs !== false;
    if (document.getElementById('cfgDisputes')) document.getElementById('cfgDisputes').checked = cfg.escalateDisputes !== false;
    if (document.getElementById('cfgLegal')) document.getElementById('cfgLegal').checked = cfg.escalateLegal !== false;
    if (document.getElementById('cfgAngry')) document.getElementById('cfgAngry').checked = cfg.escalateAngry !== false;
  } catch (err) {
    console.error('Failed to load AI config:', err);
  }
}

async function saveAiConfig() {
  const data = {
    businessName: document.getElementById('cfgBusinessName')?.value || 'NivaGlow',
    tone: document.getElementById('cfgTone')?.value || 'Friendly & Professional',
    language: document.getElementById('cfgLang')?.value || 'English & Hinglish',
    autoOrderTracking: document.getElementById('cfgOrder')?.checked,
    autoProductQuestions: document.getElementById('cfgProd')?.checked,
    autoReturns: document.getElementById('cfgReturns')?.checked,
    autoFaqs: document.getElementById('cfgFaq')?.checked,
    escalateDisputes: document.getElementById('cfgDisputes')?.checked,
    escalateLegal: document.getElementById('cfgLegal')?.checked,
    escalateAngry: document.getElementById('cfgAngry')?.checked
  };

  try {
    const res = await fetch('/api/ai-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
      alert('AI Configuration saved successfully!');
    }
  } catch (err) {
    console.error('Failed to save AI config:', err);
  }
}

// 9. KPIS & RECENT FEED
async function loadKpis() {
  try {
    const res = await fetch('/api/dashboard/kpis');
    const data = await res.json();
    if (document.getElementById('kpiTotalConvs')) document.getElementById('kpiTotalConvs').textContent = data.totalConversations;
    if (document.getElementById('kpiAiRate')) document.getElementById('kpiAiRate').textContent = data.aiResolutionRate;
    if (document.getElementById('kpiVoiceCalls')) document.getElementById('kpiVoiceCalls').textContent = data.voiceEscalations;
  } catch (err) {
    console.error('Failed to fetch KPIs:', err);
  }
}

function appendActivityFeed(data) {
  const feed = document.getElementById('liveFeedList');
  if (!feed) return;

  const item = document.createElement('div');
  item.className = 'ai';
  item.innerHTML = `
    <div class="ai-dot" style="background:var(--gwa)"></div>
    <div>
      <div class="ai-body"><strong>Inbound WhatsApp</strong> — "${escapeHtml(data.message.content.slice(0, 75))}..."</div>
      <div class="ai-time">Just now · Live Webhook</div>
    </div>
  `;
  feed.prepend(item);
}

// 10. SIMULATOR WIDGET
function toggleSim(forceOpen) {
  const modal = document.getElementById('simModal');
  if (!modal) return;
  if (forceOpen !== undefined) {
    modal.classList.toggle('open', forceOpen);
  } else {
    modal.classList.toggle('open');
  }
}

function usePreset(phone, name, msg) {
  document.getElementById('simPhone').value = phone;
  document.getElementById('simName').value = name;
  document.getElementById('simMsg').value = msg;
}

async function sendSimulatedWebhook() {
  const phone = document.getElementById('simPhone').value.trim();
  const name = document.getElementById('simName').value.trim();
  const message = document.getElementById('simMsg').value.trim();

  if (!phone || !message) {
    alert('Please enter a phone number and message.');
    return;
  }

  try {
    const res = await fetch('/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name, message })
    });

    const result = await res.json();
    console.log('Webhook result:', result);

    // Switch to Conversations tab so user immediately sees the conversation!
    navByPage('convs');
    toggleSim(false);

    if (result.conversationId) {
      setTimeout(() => {
        selectConversation(result.conversationId);
      }, 300);
    }
  } catch (err) {
    console.error('Failed to send simulated webhook:', err);
    alert('Failed to send webhook message.');
  }
}

// Helper
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
