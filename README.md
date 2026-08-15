# HaalChaal — Vernacular AI Wellness Check-In Agent

An AI agent that phones an elderly parent daily like a real person would, speaks their language (Hindi/Hinglish/regional), listens for wellness signals (mood, medication, confusion, new complaints), and sends the family a WhatsApp digest — escalating immediately if something sounds wrong. No app for the parent to install.

## Why

Adult children — especially NRIs or those living in another city — worry about aging parents living alone but can't call every day themselves. Existing "AI elder check-in" products are English-first, built for the US/EU market, and deliver summaries through their own app or email — not WhatsApp, and not fluent in Indian vernacular or code-switched speech. HaalChaal closes that gap for Indian families.

## Differentiators

1. **Vernacular-first conversation** — Hindi/Hinglish with natural code-switching via Sarvam AI, not a translation layer bolted onto an English bot.
2. **WhatsApp-native delivery** — daily digest and urgent escalation land directly in the family's WhatsApp group. Zero new app for anyone to adopt.
3. **Longitudinal trend detection** — each call is compared against a rolling baseline (mood, coherence, medication adherence) instead of being judged in isolation, to catch early signs of decline rather than just "sounded sad today."

## Architecture

| Layer | Tool |
|---|---|
| Telephony | Twilio (Gather/Say turn-based speech loop — ConversationRelay's real-time streaming requires a paid Twilio account, so this uses the classic always-available voice verbs instead) |
| Conversation & extraction LLM | Groq (Llama 3.3 70B) |
| Hindi/Hinglish STT + TTS | Sarvam AI (Saaras + Bulbul) |
| Database | Supabase |
| Family delivery | WhatsApp Cloud API |
| Dashboard | Next.js + Recharts on Vercel |
| Voice backend | FastAPI (this repo's `voice-backend/`) |

See [`PRD.md`](PRD.md) for the full product spec.

## Repo layout

```
voice-backend/   FastAPI service: Twilio call handling, STT->LLM->TTS conversation loop,
                 post-call structured extraction, escalation logic, WhatsApp delivery.
supabase/        SQL schema + seed data for parents / calls / family_contacts.
dashboard/       Next.js + Recharts trend dashboard (call history, transcripts, mood/coherence chart).
```

## Setup — voice backend

```bash
cd voice-backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in real keys
uvicorn app.main:app --reload --port 8000
```

Expose it publicly during development (e.g. `ngrok http 8000`) and set `PUBLIC_BASE_URL` in `.env` to that URL — Twilio needs a public webhook and websocket endpoint.

In the Twilio console, set your phone number's "A call comes in" webhook to `POST {PUBLIC_BASE_URL}/voice`, or trigger an outbound demo call directly:

```bash
curl -X POST "$PUBLIC_BASE_URL/demo/call" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+91XXXXXXXXXX"}'
```

## Setup — dashboard

```bash
cd dashboard
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Visit `http://localhost:3000` — it lists parents, and each parent's page shows the mood/coherence trend chart plus a call history list with expandable transcripts and audio playback (when a recording is available).

## Database

1. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor for a fresh project to create the `parents`, `calls`, and `family_contacts` tables.
2. New Supabase projects enable automatic Row Level Security on new tables by default, which blocks the backend's `anon`-key access. Since this is a server-only service (the key never reaches a browser), run [`supabase/disable_rls.sql`](supabase/disable_rls.sql) to disable RLS and grant the anon role access instead of writing policies.
3. Optionally run [`supabase/seed.sql`](supabase/seed.sql) to backfill ~2 weeks of prior check-in history for a parent so the dashboard's trend chart has a baseline before the first live call.

## Status

Must-have feature list from the PRD is working end-to-end: outbound call -> conversational check-in -> structured extraction -> Supabase storage -> WhatsApp digest, with rolling-baseline urgent escalation. Dashboard with trend chart, call history, and transcripts is live. Sarvam AI swap for higher-fidelity Hindi/Hinglish TTS is the remaining should-have item. See [`PRD.md`](PRD.md) section 6 for the full feature checklist.

## Demo video

TBD — link goes here once recorded.

## License

MIT — see [`LICENSE`](LICENSE).
