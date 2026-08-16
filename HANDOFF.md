# Handoff notes

Status as of Day 2 (Aug 16, 2026) of the 7-day hackathon window. Read [`PRD.md`](PRD.md) first if you haven't — everything below assumes that context.

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

**Beyond the PRD — multi-user auth (Day 2):** the dashboard is now multi-tenant. Users sign up/log in with Supabase Auth (email/password), register their own parent + family WhatsApp number at `/parents/new`, and only ever see their own parent(s) and call history — enforced by real RLS policies (`supabase/migrations/0002_multi_user_auth.sql`), not just app-level filtering. There's a "Call now" button that triggers a real call on demand via a new backend endpoint. This wasn't in the original PRD scope but was worth doing now since it also fixed the RLS security gap noted below.

**Repo hygiene:** public GitHub repo, MIT license, incremental commits with descriptive messages, no AI attribution anywhere (per PRD section 11 — keep it that way in any commits you make too).

## Architecture, quickly

```
voice-backend/   FastAPI (Python). Twilio call handling, Groq conversation + extraction,
                 escalation logic, WhatsApp delivery. Deployed on Render, uses the
                 service_role Supabase key (bypasses RLS -- it writes from webhooks,
                 not a logged-in user). Auth-gated with INTERNAL_API_KEY.
dashboard/       Next.js 16 (App Router) + Tailwind + Recharts + Supabase Auth (@supabase/ssr).
                 Deployed on Vercel. Server components/actions use the auth-aware client
                 in src/lib/supabase-server.ts; the browser client is in supabase-browser.ts.
                 middleware.ts protects every route except /login and /signup.
supabase/        schema.sql + migrations/0002_multi_user_auth.sql (tables + RLS policies),
                 seed.sql (demo history). disable_rls.sql is superseded, kept for reference.
```

Full setup steps are in [`README.md`](README.md) — don't duplicate them here, just run it.

## Known gaps / things to be careful about

1. **Twilio ConversationRelay doesn't work on trial accounts.** We originally built the voice loop on ConversationRelay (real-time streaming STT/TTS) per the PRD's architecture table, but Twilio silently hangs up after ~3 seconds on trial accounts (premium feature gate). We switched to classic `<Gather>`/`<Say>` (turn-based, not streaming) — it works fine and sounds natural on a phone call, but it's not literally what the PRD's architecture section describes. If anyone upgrades the Twilio account later, ConversationRelay could be revisited for lower-latency, more interruptible conversation — but it's not necessary for the demo.
2. **No call recording yet**, so `audio_url` in the `calls` table is always `null`. The dashboard's audio player UI already handles this gracefully (shows "Audio recording not available" instead of a broken player), but wiring up Twilio call recording + a way to serve the audio (Twilio recordings need authenticated access, so it'd need a backend proxy route, not a direct `<audio src>` to Twilio's URL) is still open.
3. **RLS is now properly enabled** (fixed on Day 2 — see the auth section above). One gotcha if you're touching Supabase directly: enabling RLS and writing `CREATE POLICY` statements is not enough on its own — the underlying Postgres role also needs a base `GRANT` on the table, or you'll hit `permission denied for table X` before RLS even gets evaluated. We had to explicitly `GRANT ... TO authenticated` (for the dashboard's logged-in users) and `GRANT ... TO service_role` (for the backend) in addition to the RLS policies. Also: after any `ALTER TABLE` via the SQL editor, PostgREST's schema cache can go stale (`Could not find the 'x' column in the schema cache` even though the column exists) — run `NOTIFY pgrst, 'reload schema';` to fix it.
4. **Occasional script-mixing glitch**: saw one instance of the LLM producing a word half in Devanagari half in Latin script mid-reply (e.g. "हaha"). Rare, non-blocking, but worth keeping an eye on if it recurs — might need a stronger instruction or a post-processing pass in `prompts.py` / `services/llm.py`.
5. **Deployed as of Day 2**: dashboard on Vercel (auto-deploys on push to `main`, root directory `dashboard/`), backend on Render (auto-deploys on push to `main`, root directory `voice-backend/`, free tier so it sleeps after inactivity — first request after idle takes ~50s). URLs are in the README. Use the **permanent** WhatsApp System User token, not the 24-hour temporary one from the API Setup quickstart — the temporary token already broke the digest once after expiring overnight.
6. **WhatsApp test-mode recipient limit**: the WhatsApp number is still in Meta's "test mode," which means every recipient must be manually added and OTP-verified through Meta's own console (Developers -> App -> WhatsApp -> API Setup) before they can receive anything — there's no API to do this programmatically, it's an anti-abuse control on Meta's side. So when a user registers a new parent through the dashboard, the family WhatsApp number they enter **will not actually receive digests** until someone manually adds + verifies it in Meta's console. The dashboard doesn't warn about this yet. Real fix is pursuing Meta business verification (Step 3 in their WhatsApp setup flow), which removes the restriction entirely — not done, decided to punt on it for now.
7. **Twilio verified-caller limit applies per parent too**: same trial restriction as before, now surfaced through the "Call now" button — registering a parent with an unverified number gives a clear 422 error ("No Twilio trial phone number is assigned... add as a verified recipient"). Same fix as always: Twilio Console -> Phone Numbers -> Verified Caller IDs.

## For the frontend teammate specifically

The dashboard (`dashboard/`) is intentionally minimal right now — built to prove the data pipeline works, not polished. It's a great place to add real design value. Ideas, roughly in order of impact for the demo:

- **Visual polish pass overall.** Current UI is functional dark-mode Tailwind with no real design system — spacing, typography, color use could all be leveled up. The demo script (PRD section 10) explicitly wants the dashboard to "feel" impressive in the video, so this matters.
- **Empty/loading/error states.** Right now a parent with zero calls just shows "No calls yet." — fine, but could be nicer. Also no loading skeletons (data fetching is server-side so it's usually fast, but worth handling).
- **Mobile responsiveness** — not tested at all on small screens yet.
- **Call detail improvements**: right now expanding a call row just dumps the raw transcript as preformatted text with `Sukoon:`/`Parent:` prefixes (well, `HaalChaal:`/`Parent:` now) — could render as a proper chat bubble UI instead, which would look much better in the demo video.
- **Trend chart improvements**: could add a visual marker/annotation on the exact point where an urgent call happened (currently it's just a dip in the mood line, not explicitly called out on the chart itself), or a toggle between 2-week/all-time view.
- **Multi-parent support** now works for real (auth added Day 2) — each user can register and see multiple parents of their own.
- **Auth pages need visual polish** — `/login`, `/signup`, and `/parents/new` are plain unstyled forms right now (functional, not designed). Same design-token treatment as the rest of the dashboard would help a lot here.
- **Surface the WhatsApp/Twilio verification gotchas in the UI** — right now if a newly registered parent's number isn't Twilio-verified, or the family WhatsApp number isn't added in Meta's console, things just silently don't work (or show a raw error). Worth a friendly inline note on the registration form and/or the parent page about both limitations (see Known Gaps #6 and #7 above).

Relevant files: `dashboard/src/app/page.tsx` (parent list), `dashboard/src/app/parent/[id]/page.tsx` (detail page), `dashboard/src/app/login/page.tsx`, `dashboard/src/app/signup/page.tsx`, `dashboard/src/app/parents/new/page.tsx`, `dashboard/src/components/TrendChart.tsx`, `dashboard/src/components/CallList.tsx`, `dashboard/src/components/CallNowButton.tsx`.

## Git hygiene reminder (from PRD section 11)

- Commit early and often, small logical chunks, not one giant dump.
- **Never** add Claude/Anthropic/any AI tool as a commit author, committer, or co-author — no `Co-Authored-By` trailers, no bot identities. Every commit must be a real human teammate's name/email.
- Keep committing daily-ish — judges may check commit timestamps against the hackathon window (Aug 15–22, 2026).
