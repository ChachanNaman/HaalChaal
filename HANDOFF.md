# Handoff notes

Status as of Day 1 (Aug 15, 2026) of the 7-day hackathon window. Read [`PRD.md`](PRD.md) first if you haven't — everything below assumes that context.

## What's done and verified live

**Must-haves (PRD section 6) — all working end-to-end:**
- Outbound call via Twilio, answered call runs a real conversational loop.
- STT → LLM → TTS working live in Hindi/Hinglish (and English) — tested with real phone calls, not just unit-level.
- Post-call structured extraction (`mood_score`, `coherence_score`, `medication_taken`, `new_complaint`, `flagged_urgent`) via Groq, strict JSON.
- Transcript + structured result stored in Supabase after every call.
- WhatsApp digest sent after each call, via WhatsApp Cloud API — confirmed delivered to a real WhatsApp chat.
- Escalation: rolling baseline comparison (mood/coherence drop, missed-medication streak, urgent keywords) triggers an urgent WhatsApp alert instead of the normal digest — tested live by mentioning chest pain on a call, correctly triggered.

**Should-haves — partially done:**
- ✅ Trend dashboard (Next.js + Recharts): mood/coherence line chart, seeded ~2-week history, urgent-call banner, expandable transcripts.
- ❌ **Sarvam AI swap not done yet.** Hindi/Hinglish currently works via Twilio's built-in speech recognition + Google WaveNet TTS (see "Known gaps" below) — good quality, but not what the PRD names as the actual differentiator. This is the top-priority remaining item.
- ⚠️ Transcript viewer done, audio playback is not — see gaps below.

**Repo hygiene:** public GitHub repo, MIT license, incremental commits with descriptive messages, no AI attribution anywhere (per PRD section 11 — keep it that way in any commits you make too).

## Architecture, quickly

```
voice-backend/   FastAPI (Python). Twilio call handling, Groq conversation + extraction,
                 escalation logic, WhatsApp delivery. Runs locally via ngrok during dev,
                 not deployed yet.
dashboard/       Next.js 16 (App Router) + Tailwind + Recharts + Supabase JS client.
                 Server components fetch directly from Supabase with the anon key.
supabase/        schema.sql (tables), seed.sql (demo history), disable_rls.sql (see below).
```

Full setup steps are in [`README.md`](README.md) — don't duplicate them here, just run it.

## Known gaps / things to be careful about

1. **Twilio ConversationRelay doesn't work on trial accounts.** We originally built the voice loop on ConversationRelay (real-time streaming STT/TTS) per the PRD's architecture table, but Twilio silently hangs up after ~3 seconds on trial accounts (premium feature gate). We switched to classic `<Gather>`/`<Say>` (turn-based, not streaming) — it works fine and sounds natural on a phone call, but it's not literally what the PRD's architecture section describes. If anyone upgrades the Twilio account later, ConversationRelay could be revisited for lower-latency, more interruptible conversation — but it's not necessary for the demo.
2. **No call recording yet**, so `audio_url` in the `calls` table is always `null`. The dashboard's audio player UI already handles this gracefully (shows "Audio recording not available" instead of a broken player), but wiring up Twilio call recording + a way to serve the audio (Twilio recordings need authenticated access, so it'd need a backend proxy route, not a direct `<audio src>` to Twilio's URL) is still open.
3. **Supabase RLS is disabled** on all three tables, with the `anon` role granted full CRUD (see `supabase/disable_rls.sql`). This is fine because the anon key currently only lives server-side (`voice-backend/.env`) — but the **dashboard also uses the anon key client-side** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), which means it ships to the browser. Right now that's an acceptable hackathon tradeoff (no auth on the dashboard at all, anyone with the URL can read/write all call data), but don't add write operations to the dashboard without first adding real RLS policies or an API layer in front of Supabase.
4. **Occasional script-mixing glitch**: saw one instance of the LLM producing a word half in Devanagari half in Latin script mid-reply (e.g. "हaha"). Rare, non-blocking, but worth keeping an eye on if it recurs — might need a stronger instruction or a post-processing pass in `prompts.py` / `services/llm.py`.
5. **Deployed as of Day 2**: dashboard on Vercel (auto-deploys on push to `main`, root directory `dashboard/`), backend on Render (auto-deploys on push to `main`, root directory `voice-backend/`, free tier so it sleeps after inactivity — first request after idle takes ~50s). URLs are in the README. Use the **permanent** WhatsApp System User token, not the 24-hour temporary one from the API Setup quickstart — the temporary token already broke the digest once after expiring overnight.

## For the frontend teammate specifically

The dashboard (`dashboard/`) is intentionally minimal right now — built to prove the data pipeline works, not polished. It's a great place to add real design value. Ideas, roughly in order of impact for the demo:

- **Visual polish pass overall.** Current UI is functional dark-mode Tailwind with no real design system — spacing, typography, color use could all be leveled up. The demo script (PRD section 10) explicitly wants the dashboard to "feel" impressive in the video, so this matters.
- **Empty/loading/error states.** Right now a parent with zero calls just shows "No calls yet." — fine, but could be nicer. Also no loading skeletons (data fetching is server-side so it's usually fast, but worth handling).
- **Mobile responsiveness** — not tested at all on small screens yet.
- **Call detail improvements**: right now expanding a call row just dumps the raw transcript as preformatted text with `Sukoon:`/`Parent:` prefixes (well, `HaalChaal:`/`Parent:` now) — could render as a proper chat bubble UI instead, which would look much better in the demo video.
- **Trend chart improvements**: could add a visual marker/annotation on the exact point where an urgent call happened (currently it's just a dip in the mood line, not explicitly called out on the chart itself), or a toggle between 2-week/all-time view.
- **Multi-parent support in the UI** is technically there (home page lists all parents) but untested with more than one parent — the PRD lists this as a nice-to-have (section 6) if you want to seed a second parent and make sure the UI holds up.
- **Auth**, if there's time — right now the dashboard has zero access control, anyone with the URL sees everything. Even something minimal (a shared password gate) would be worth it before a public demo link goes out. Ping the backend owner before changing anything Supabase-key-related, given the RLS note above.

Relevant files: `dashboard/src/app/page.tsx` (parent list), `dashboard/src/app/parent/[id]/page.tsx` (detail page), `dashboard/src/components/TrendChart.tsx`, `dashboard/src/components/CallList.tsx`.

## Git hygiene reminder (from PRD section 11)

- Commit early and often, small logical chunks, not one giant dump.
- **Never** add Claude/Anthropic/any AI tool as a commit author, committer, or co-author — no `Co-Authored-By` trailers, no bot identities. Every commit must be a real human teammate's name/email.
- Keep committing daily-ish — judges may check commit timestamps against the hackathon window (Aug 15–22, 2026).
