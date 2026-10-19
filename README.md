# AI WhatsApp automation (WhatsApp sales & support bot)

A Node.js/TypeScript service that receives WhatsApp Cloud API webhooks, detects
customer intent, generates replies with an LLM, and streams conversations to a
small web inbox over WebSockets. Built as the backend for the NivaGlow
WhatsApp sales/support OS.

## Features

- **WhatsApp Cloud API webhook** — verification handshake plus inbound message
  handling (`src/server/routes/webhook.ts`).
- **Intent engine** — classifies order status, returns, product questions,
  pricing, human handoff and more (`src/server/services/intentEngine.ts`).
- **Response agent** — builds grounded replies and fallbacks
  (`src/server/services/responseAgent.ts`).
- **WhatsApp sender** — outbound text messages via the Graph API
  (`src/server/services/whatsappSender.ts`).
- **Live inbox** — Express + `ws` gateway and a vanilla-JS dashboard
  (`src/client/`).
- **Commerce hooks** — order, return and product lookups
  (`src/server/routes/ecommerce.ts`).
- **SQLite by default** via Prisma, with Postgres as a drop-in swap.

## Stack

Node.js 22, TypeScript, Express 4, Prisma 5, WebSocket (`ws`), Zod-free plain
TS, OpenAI-compatible chat completions.

## Run locally

```bash
npm install
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
npx prisma generate
npm run prisma:push
npm run prisma:seed
npm run dev
```

The server listens on `PORT` (default `3000`); the inbox is served from the same
process.

```bash
npm run build && npm start
npm test        # src/test/verify.ts smoke checks
```

## Environment

See `.env.example`. You need `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` and `OPENAI_API_KEY` to talk
to the real services. `DATABASE_URL` defaults to a local SQLite file.

## Notes

- Expose the webhook with a tunnel (ngrok/Cloudflare) and point the Meta app at
  `POST /webhook`.
- Never commit `.env`; it is git-ignored.
