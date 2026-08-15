# PRD — Sukoon (working name): Vernacular AI Wellness Check-In Agent for Elderly Parents

## 1. One-line pitch
An AI agent that phones an elderly parent daily like a real person would, speaks their language (Hindi/Hinglish/regional), listens for wellness signals (mood, medication, confusion, new complaints), and sends the family a WhatsApp digest — escalating immediately if something sounds wrong. No app for the parent to install.

## 2. Problem & why now
- Adult children (especially NRIs / those in other cities) worry about aging parents living alone but can't call daily themselves.
- Existing "AI elder check-in" products (Callie Care, Meela, InTouch, AloneAssist, CareCall, ElderVoice, CareYaya QuikTok) are **English-first, built for the US/EU market, and deliver summaries via their own app/email/dashboard** — not WhatsApp, and not fluent in Indian vernacular/code-switched speech.
- India-specific gap: no product does natural Hindi/Hinglish phone conversation + delivers the digest where Indian families actually live: WhatsApp.
- Most competitors summarize a single call in isolation. None advertise a longitudinal trend model (tracking mood/coherence/response patterns across days/weeks) to catch early decline signals — this is our technical differentiator.

## 3. Differentiators (what to emphasize in the demo & submission text)
1. **Vernacular-first conversation** (Hindi/Hinglish, natural code-switching) via Sarvam AI — not a translation layer bolted onto an English bot.
2. **WhatsApp-native delivery** — daily digest + urgent escalation land directly in the family's WhatsApp group. Zero new app for anyone to adopt.
3. **Longitudinal trend detection** — compares each call against a rolling baseline (mood score, coherence, response latency, keyword changes) instead of judging one call in isolation, to flag early signs of decline, not just "sounded sad today."

## 4. Target user
- Primary: adult children (25–45) living away from an elderly parent (60+) in India, who want reassurance without nagging calls or forcing a parent to learn an app.
- Secondary: the elderly parent themselves — must work with zero setup, just answering a normal phone call.

## 5. Core user flow (MVP)
1. System places a scheduled (or demo-triggered) outbound call to the parent's phone number.
2. AI greets them by name, asks 3–5 natural check-in questions (how are you feeling, did you take your medicine, anything new/worrying, sleep/appetite) in Hindi/Hinglish or English as needed.
3. Call is transcribed and the LLM extracts structured signals: mood_score (1–5), medication_taken (yes/no/unclear), coherence_score (1–5), new_complaint (text or null), flagged_urgent (bool).
4. Structured result is saved to the database with a timestamp, compared against the rolling baseline for that parent.
5. A WhatsApp message is sent to the family group:
   - Normal day → short daily digest.
   - Anomaly detected (mood/coherence drop, missed medication twice, urgent keyword like "chest pain," "fell down") → immediate urgent WhatsApp alert, separate from the daily digest.
6. A web dashboard shows call history, transcripts, audio playback, and a trend chart (mood/coherence over time).

## 6. Feature list (priority order)

### Must-have (Day 1–3 target)
- [ ] Outbound call via Twilio to a verified number, bridged to a real-time voice loop.
- [ ] STT → LLM conversation loop → TTS, working end-to-end in English first.
- [ ] Post-call structured extraction (JSON: mood_score, medication_taken, coherence_score, new_complaint, flagged_urgent).
- [ ] Store each call's raw transcript + structured result in Supabase.
- [ ] WhatsApp message sent after each call (daily digest format) via WhatsApp Cloud API.
- [ ] Basic escalation rule: if flagged_urgent or mood_score drops ≥2 points vs. rolling average → send urgent WhatsApp message immediately instead of/in addition to digest.

### Should-have (Day 3–4 target — the actual differentiators, don't skip these)
- [ ] Swap English STT/TTS for Sarvam AI (Hindi/Hinglish) for at least the demo call.
- [ ] Trend dashboard (Next.js + Recharts): line chart of mood_score/coherence_score over a seeded 2-week history, with the live demo call added as the latest point.
- [ ] Transcript viewer + audio playback per call on the dashboard.

### Nice-to-have (only if time remains)
- [ ] Multiple parent profiles.
- [ ] Configurable check-in questions per family.
- [ ] SMS fallback if WhatsApp fails.

### Explicitly out of scope for this hackathon
- Real medical diagnosis or claims of clinical accuracy — frame everything as "signals to discuss with a doctor," never a diagnosis.
- Handling actual unverified/random phone numbers (Twilio trial only allows verified numbers — fine for demo).
- Payment/subscription flows.

## 7. Architecture & stack (all free-tier, budget = $0)

| Layer | Tool | Why / free-tier notes |
|---|---|---|
| Telephony | Twilio (free trial, $15.15 credit) + ConversationRelay | Verified numbers only on trial — fine for demo. |
| LLM (conversation + extraction) | Groq (free tier: Llama 3.3 70B / Qwen3 / GPT-OSS) | Fast, free, good enough for structured JSON extraction. |
| English/generic STT | Groq Whisper (free: 2,000 req/day) | Use for initial build/testing. |
| Hindi/Hinglish STT+TTS | Sarvam AI (₹1,000 free credits, no card required) — Saaras (STT, 22 languages) + Bulbul (TTS, 11 languages, native code-mixing) | This is the actual differentiator — use for the demo call. |
| Database | Supabase (free tier) | Call logs, structured signals, trend history. |
| Family delivery | WhatsApp Cloud API (Meta, direct) | Free for user-initiated + service replies through Oct 1 2026 — fine for hackathon window. |
| Dashboard frontend | Next.js + Recharts, hosted on Vercel (free) | Trend chart, transcript viewer. |
| Voice backend | Node/Python (FastAPI) on Render or Fly.io free tier | Needs to hold a WebSocket for the Twilio↔LLM audio bridge; free tier sleeps when idle — wake it before demo/judging. |

Reference architecture (not a copy): `Marker-Inc-Korea/senior-care-agent` (LiveKit + Twilio wellness-call pattern) can be used as a conceptual reference for the call-flow/escalation structure. Do not fork/copy it wholesale — the vernacular layer, WhatsApp delivery, and trend model must be original work built during the hackathon, per the rules ("existing tools are fine, but submission must include substantial new work completed during the hackathon").

## 8. Data model (minimum)

```
parents: id, name, phone_number, preferred_language, created_at
calls: id, parent_id, timestamp, transcript, audio_url, mood_score, coherence_score, medication_taken, new_complaint, flagged_urgent
family_contacts: id, parent_id, whatsapp_number, name
```

## 9. Judging-criteria alignment (keep this front of mind while building)
- **Originality** — lead with the vernacular + WhatsApp-native + trend-model angle explicitly in the submission text; name-check that incumbents (Callie Care, Meela, InTouch) don't do this, so judges know you did the homework.
- **Design** — the demo should feel like a real phone call, not a robotic script; the WhatsApp digest should read like a message a human would actually send, not a JSON dump.
- **Potential impact** — frame around the real population (NRI/out-of-town adult children, India's aging-alone population); use one authentic sentence about why this matters, not generic "AI helps everyone."
- **Technical implementation** — the trend/anomaly detection logic (not just single-call summarization) is the piece that proves real engineering, not a thin LLM wrapper. Don't cut this for time if avoidable.

## 10. Demo script (3-minute video)
1. (10s) Problem statement — one sentence, real and personal.
2. (60s) Live call: place a real call, parent role speaks in Hindi/Hinglish, answers questions naturally including one deliberate "bad" answer (e.g., mentions dizziness or missed medicine).
3. (30s) Show the urgent WhatsApp alert landing immediately, distinct from a normal digest.
4. (40s) Show the dashboard: seeded 2-week trend chart, the new data point standing out, transcript + audio playback.
5. (20s) Close: name the differentiators explicitly (vernacular, WhatsApp-native, trend detection) and the stack used.

## 11. Git / repo hygiene rules (read before running any commands)
- Create the GitHub repo on Day 1 and commit early and often in small, logical chunks as each feature lands (call loop, extraction, WhatsApp delivery, dashboard, etc.) — **do not squash the whole project into one final commit.** Judges may check commit history/timestamps to confirm the project was built during the hackathon window (Aug 15–22, 2026).
- **Do not add Claude, Claude Code, Anthropic, or any AI tool as a git contributor, co-author, or committer under any circumstance.** Concretely:
  - No `Co-Authored-By: Claude <...>` (or similar) trailers in any commit message.
  - No commits authored/committed under a Claude/Anthropic/bot identity — every commit's author/committer must be a real human team member's name and email.
  - Do not include AI-generated attribution, watermark comments, or tool signatures in code files or commit messages.
  - If a tool defaults to adding such a trailer automatically, strip it before committing.
- Include a proper open-source license file (MIT is simplest) at the repo root — required for submission eligibility.
- Add a clear README with setup steps, the problem statement, differentiators, and a link to the demo video once ready.

## 12. Environment variables needed (put in `.env`, never commit this file)
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
GROQ_API_KEY=
SARVAM_API_KEY=
WHATSAPP_CLOUD_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

## 13. Definition of done for hackathon submission
- Hosted, working project URL (dashboard live on Vercel; voice backend awake and reachable).
- Public GitHub repo with incremental commit history from Aug 15 onward and an OSI license file.
- ~3-minute demo video per the script above.
- Completed Devpost submission form, submitted a few days before the deadline for baseline eligibility check, then refined until the deadline.
