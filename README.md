# HaalChaal — Vernacular AI Wellness Check-In Agent

An AI agent that phones an elderly parent daily like a real person would, speaks their language (Hindi/Hinglish/regional), listens for wellness signals (mood, medication, confusion, new complaints), and sends the family a WhatsApp digest — escalating immediately if something sounds wrong. No app for the parent to install.

**Live:**
- Dashboard: https://dashboard-three-alpha-52.vercel.app
- Backend API: https://haalchaal-backend-zfzs.onrender.com (free tier — sleeps after inactivity, first request after idle can take ~50s to wake up)

## Why

Adult children — especially NRIs or those living in another city — worry about aging parents living alone but can't call every day themselves. Existing "AI elder check-in" products are English-first, built for the US/EU market, and deliver summaries through their own app or email — not WhatsApp, and not fluent in Indian vernacular or code-switched speech. HaalChaal closes that gap for Indian families.

## Differentiators

1. **Vernacular-first conversation** — Hindi/Hinglish with natural code-switching via Sarvam AI, not a translation layer bolted onto an English bot.
2. **WhatsApp-native delivery** — daily digest and urgent escalation land directly in the family's WhatsApp group. Zero new app for anyone to adopt.
3. **Longitudinal trend detection** — each call is compared against a rolling baseline (mood, coherence, medication adherence) instead of being judged in isolation, to catch early signs of decline rather than just "sounded sad today."

## Architecture

| Layer | Tool |
|---|---|
| Telephony | Twilio (turn-based `<Record>`/`<Play>` loop — ConversationRelay's real-time streaming requires a paid Twilio account, so this uses classic voice verbs instead) |
| Conversation & extraction LLM | Groq (openai/gpt-oss-120b) |
| Hindi/Hinglish STT + TTS | Sarvam AI (Saarika + Bulbul), with automatic fallback to Twilio's native speech engine if Sarvam is unavailable |
| Database | Supabase (with per-user auth + RLS) |
| Family delivery | WhatsApp Cloud API, with SMS fallback via Twilio |
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

In the Twilio console, set your phone number's "A call comes in" webhook to `POST {PUBLIC_BASE_URL}/voice`, or trigger an outbound demo call directly (requires the `INTERNAL_API_KEY` header, since this endpoint places a real call):

```bash
curl -X POST "$PUBLIC_BASE_URL/demo/call" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Api-Key: $INTERNAL_API_KEY" \
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

Run these in order in the Supabase SQL editor for a fresh project:

1. [`supabase/schema.sql`](supabase/schema.sql) — creates the `parents`, `calls`, and `family_contacts` tables.
2. [`supabase/migrations/0002_multi_user_auth.sql`](supabase/migrations/0002_multi_user_auth.sql) — per-user ownership + RLS policies.
3. [`supabase/migrations/0003_call_recording.sql`](supabase/migrations/0003_call_recording.sql) — adds `call_sid` to `calls` for matching recordings back to a call.
4. [`supabase/migrations/0004_custom_questions.sql`](supabase/migrations/0004_custom_questions.sql) — adds `custom_questions` to `parents`.
5. After any of the above, run `NOTIFY pgrst, 'reload schema';` (PostgREST's schema cache can go stale after an `ALTER TABLE`) and make sure the `authenticated` and `service_role` Postgres roles both have `GRANT`s on all three tables — RLS policies alone aren't enough, the base grant is a separate requirement.
6. Optionally run [`supabase/seed.sql`](supabase/seed.sql) to backfill ~2 weeks of prior check-in history for a parent so the dashboard's trend chart has a baseline before the first live call.

(`supabase/disable_rls.sql` documents the older single-tenant, no-auth approach; superseded now.)

## Status

Full PRD feature checklist (section 6) is done: all must-haves, all should-haves (including the Sarvam AI voice pipeline), and all nice-to-haves (multiple parent profiles, configurable per-family questions, SMS fallback). Both the dashboard (Vercel) and voice backend (Render) are deployed and auto-deploy from `main`. The dashboard is multi-tenant: users sign up, register their own parent + family WhatsApp number, and see only their own data (Supabase Auth + RLS). See [`HANDOFF.md`](HANDOFF.md) for the detailed breakdown, known gaps (mainly Twilio trial-account restrictions on call recording and ConversationRelay), and what's left that genuinely needs a human (demo video, Devpost submission).

### Deployment notes
- **Dashboard (Vercel)**: root directory is `dashboard/`, env vars `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-safe) plus `BACKEND_URL` / `BACKEND_INTERNAL_API_KEY` (server-only, no `NEXT_PUBLIC_` prefix -- used by the "Call now" button's route handler) set in the Vercel project. Auto-deploys on push to `main`.
- **Backend (Render)**: root directory is `voice-backend/`, build command `pip install -r requirements.txt`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check path `/health`. Python version is pinned via `voice-backend/.python-version` (Render defaults to the newest Python otherwise, which doesn't have prebuilt wheels for some dependencies yet). `PUBLIC_BASE_URL` env var must match the Render-assigned URL exactly, since it's used to build the TwiML callback URL Twilio hits on each conversation turn. Uses `SUPABASE_SERVICE_ROLE_KEY` (not anon) since it writes from Twilio webhooks, not a logged-in user. `INTERNAL_API_KEY` must match the dashboard's `BACKEND_INTERNAL_API_KEY` -- it gates the endpoints that place real (paid) calls, since the backend URL is public.
- **WhatsApp token**: use a permanent System User token (Meta Business Settings -> Users -> System Users -> Generate Token with `whatsapp_business_messaging` + `whatsapp_business_management`), not the 24-hour temporary token from the API Setup quickstart — the temporary one will silently break the WhatsApp digest every day.
- **WhatsApp test-mode limit**: the WhatsApp number is still in Meta's test mode, so every recipient (including WhatsApp numbers entered when registering a new parent) must be manually added and OTP-verified in Meta's console before they'll actually receive anything -- there's no API for this. See `HANDOFF.md` for details.

## Demo video

TBD — link goes here once recorded.

## License

MIT — see [`LICENSE`](LICENSE).
