# Handoff notes

Status as of Day 3 (Aug 17, 2026) of the 7-day hackathon window. Read [`PRD.md`](PRD.md) first if you haven't — everything below assumes that context.

## Full PRD checklist (section 6) — status

**Must-haves — all done, verified live:**
- ✅ Outbound Twilio call, real conversational loop.
- ✅ STT → LLM → TTS, live, Hindi/Hinglish and English.
- ✅ Post-call structured extraction (mood/coherence/medication/complaint/urgent), Groq, strict JSON.
- ✅ Transcript + structured result stored in Supabase after every call.
- ✅ WhatsApp digest after each call.
- ✅ Rolling-baseline urgent escalation (mood/coherence drop, missed-medication streak, urgent keywords), separate from the normal digest.

**Should-haves — all done:**
- ✅ **Sarvam AI Saarika (STT) + Bulbul (TTS)** — the PRD's actual differentiator. Verified the exact request/response contract directly against Sarvam's live API (see "How Sarvam is wired in" below) before wiring it into the call flow. Falls back to Twilio's native Gather/Say on any Sarvam failure, so an API hiccup never breaks a live call.
- ✅ Trend dashboard (Next.js + Recharts): mood/coherence chart, seeded history, urgent banner, transcripts.
- ✅ Transcript viewer, now with chat-bubble rendering and an Original/English toggle (translated on demand via Groq).
- ⚠️ Audio playback: fully wired (recording, storage, authenticated proxy route), but Twilio trial accounts reject the `record=True` REST parameter outright ("Invalid or disallowed parameters"). The code detects this and falls back to placing the call without recording rather than failing it, so `audio_url` stays `null` on trial. Will start working with zero code changes if the Twilio account is ever upgraded.

**Nice-to-haves — all done:**
- ✅ Multiple parent profiles (via the multi-user auth work).
- ✅ Configurable check-in questions per family (`custom_questions` field on `parents`, woven into the system prompt).
- ✅ SMS fallback if WhatsApp delivery fails (Twilio SMS, same trial-verification caveat applies).

**Explicitly out of scope (per the PRD) — correctly excluded:** no diagnosis claims anywhere in the extraction/messaging copy, no payment flows, trial-only phone number handling is treated as an accepted limitation throughout.

**Beyond the PRD scope — multi-user auth (Day 2):** the dashboard is multi-tenant. Users sign up/log in (Supabase Auth), register their own parent + family WhatsApp number at `/parents/new`, and only ever see their own data — enforced by RLS (`supabase/migrations/0002_multi_user_auth.sql`). A "Call now" button triggers a real call on demand.

**What genuinely couldn't be finished without a human's direct involvement** (not a shortcut — these require things only a person can do):
- **Demo video** — needs an actual recording session with a real phone call happening on camera per the PRD's script (section 10).
- **Devpost submission form** — needs your team's own account, bios, and answers to submission questions.
- **Twilio account upgrade** — a financial decision; would unlock ConversationRelay and call recording, currently both blocked on trial.
- **Meta business verification** — Meta's own 2-10 day external document review process; would remove the WhatsApp test-mode recipient restriction.

**Repo hygiene:** public GitHub repo, MIT license, incremental commits with descriptive messages, no AI attribution anywhere (per PRD section 11 — keep it that way in any commits you make too).

## Architecture, quickly

```
voice-backend/   FastAPI (Python). Twilio call handling, Sarvam STT/TTS (with Twilio-native
                 fallback), Groq conversation + extraction, escalation logic, WhatsApp+SMS
                 delivery. Deployed on Render, uses the service_role Supabase key (bypasses
                 RLS -- writes from webhooks, not a logged-in user). Auth-gated with
                 INTERNAL_API_KEY on every endpoint that places a real call.
dashboard/       Next.js 16 (App Router) + Tailwind + Recharts + Supabase Auth (@supabase/ssr).
                 Deployed on Vercel. Server components/actions use the auth-aware client in
                 src/lib/supabase-server.ts; the browser client is in supabase-browser.ts.
                 middleware.ts protects every route except /login and /signup.
supabase/        schema.sql + migrations/000{2,3,4}_*.sql (auth/RLS, call recording, custom
                 questions), seed.sql (demo history). disable_rls.sql is superseded, kept for
                 reference.
```

Full setup steps are in [`README.md`](README.md) — don't duplicate them here, just run it.

## How Sarvam is wired in (read this before touching voice.py)

`app/services/sarvam.py` has two functions, both defensive (return `None` on any failure instead of raising):

- `synthesize_speech(text, language)` — Bulbul TTS. Confirmed live: `POST https://api.sarvam.ai/text-to-speech`, header `api-subscription-key`, body `{"inputs": [text], "target_language_code": "hi-IN"|"en-IN", "speaker": "anushka", "model": "bulbul:v2", "speech_sample_rate": 8000}`, response `{"audios": ["<base64 wav>"]}`. Returns valid 8kHz mono PCM WAV, which is exactly what Twilio's `<Play>` wants.
- `transcribe_audio(audio_bytes, language)` — Saarika STT. Confirmed live: `POST https://api.sarvam.ai/speech-to-text`, multipart `file` + `model=saarika:v2.5` + `language_code`, response `{"transcript": "..."}`. Round-tripped a synthesized phrase back to the exact original text in testing.

Since TwiML's `<Play>` needs a URL (not inline bytes), synthesized audio is cached in-memory (`app/services/audio_cache.py`) and served at `GET /tts-audio/{id}` — one-shot, not persisted, fine for a live call.

Since `<Gather>`'s built-in recognizer only works with Twilio's own STT, using Sarvam for STT means using `<Record>` instead: speak the prompt, record a short clip, POST to `/voice/record`, download the clip, transcribe it, feed the result into the same turn-handling logic (`_handle_turn` in `voice.py`) that the Twilio-native `/voice/gather` path also uses. An empty/failed transcription is treated exactly like silence, reusing the existing retry logic rather than needing a separate failure path.

**Not yet verified**: the actual `<Play>`/`<Record>` behavior on a real live phone call end-to-end (the HTTP-level Sarvam contract is confirmed correct, but Twilio fetching the `/tts-audio/{id}` URL and correctly triggering `/voice/record` needs a real answered call to fully confirm). Place a test call and listen -- if Sarvam's voice doesn't come through or a turn silently fails, check Render's logs first (every Sarvam call logs the exception on failure), then compare against Sarvam's current docs in case a field name has drifted.

## Known gaps / things to be careful about

1. **Twilio ConversationRelay doesn't work on trial accounts** (premium feature gate, hangs up after ~3s) — using `<Gather>`/`<Record>` + `<Say>`/`<Play>` instead, which works fine.
2. **Call recording blocked on trial** — see should-haves section above. `record=True` on `Calls.create` gets rejected outright; the code catches this and retries without it.
3. **RLS + GRANT gotcha**: `CREATE POLICY` is not enough on its own — the underlying Postgres role also needs a base `GRANT` on the table (`GRANT ... TO authenticated` and `GRANT ... TO service_role`), or you'll hit `permission denied for table X` before RLS even evaluates. Also: after any `ALTER TABLE` via the SQL editor, PostgREST's schema cache can go stale (`Could not find the 'x' column in the schema cache` even though the column exists) — run `NOTIFY pgrst, 'reload schema';` to fix it.
4. **Groq deprecates models without much warning** — `llama-3.3-70b-versatile` (originally used, and what the PRD names) was removed from Groq's lineup entirely partway through the hackathon, breaking every call with a 404. Now on `openai/gpt-oss-120b`. If this happens again, `GROQ_MODEL` is one env var away from a fix (check `curl https://api.groq.com/openai/v1/models` with your key for what's currently available). Note `gpt-oss` models reason before answering and will return **empty content** if `max_tokens` is too small for the reasoning + the actual reply -- pass `extra_body={"reasoning_effort": "low"}` (the pinned `groq` SDK version doesn't have this as a typed parameter) to keep replies fast and non-empty.
5. **Occasional script-mixing glitch**: saw one instance of the LLM producing a word half in Devanagari half in Latin script mid-reply (e.g. "हaha"). Rare, non-blocking.
6. **Deployed**: dashboard on Vercel, backend on Render, both auto-deploy from `main`. URLs in the README. Backend free tier sleeps after inactivity — wake it before a demo. Use the **permanent** WhatsApp System User token, not the 24h temporary one.
7. **WhatsApp test-mode recipient limit**: every recipient (including numbers entered when registering a parent) must be manually added and OTP-verified in Meta's console before they'll receive anything — no API for this, Meta anti-abuse control. The registration form now has an inline note about this.
8. **Twilio verified-caller limit** applies per parent too — the "Call now" button surfaces a plain-language error if the parent's number isn't verified yet, instead of the raw Twilio message.
9. **SMS fallback exists but inherits the same Twilio trial restriction** — an SMS to an unverified number will also fail; there's no way around this without upgrading the Twilio account.

## For the frontend teammate specifically

Auth pages (`/login`, `/signup`, `/parents/new`) now match the rest of the dashboard's design system (material-card, spring entrance motion, accent buttons) — no longer plain forms. Remaining ideas, roughly in order of impact:

- **Trend chart improvements**: a visual marker/annotation on the exact point an urgent call happened (currently just a dip in the line), or a toggle between 2-week/all-time view.
- **Mobile responsiveness** — not tested at all on small screens yet.
- **Loading states** — data fetching is server-side so it's usually fast, but there's no skeleton/spinner anywhere.
- **The chat-bubble transcript view** (`TranscriptView.tsx`) is new and functional but minimal — could use more visual distinction between speakers, timestamps per turn, etc.

Relevant files: `dashboard/src/app/page.tsx`, `dashboard/src/app/parent/[id]/page.tsx`, `dashboard/src/app/login/page.tsx`, `dashboard/src/app/signup/page.tsx`, `dashboard/src/app/parents/new/page.tsx`, `dashboard/src/components/TrendChart.tsx`, `dashboard/src/components/CallList.tsx`, `dashboard/src/components/TranscriptView.tsx`, `dashboard/src/components/CallNowButton.tsx`.

## Git hygiene reminder (from PRD section 11)

- Commit early and often, small logical chunks, not one giant dump.
- **Never** add Claude/Anthropic/any AI tool as a commit author, committer, or co-author — no `Co-Authored-By` trailers, no bot identities. Every commit must be a real human teammate's name/email.
- Keep committing daily-ish — judges may check commit timestamps against the hackathon window (Aug 15–22, 2026).
