# Closed Beta — Manual Test Script

Run this against a deployment that has provider keys configured (so the
Companion and memory extraction are live). Each step has a **Pass/Fail**.
A step fails if the product shows a raw error, loses user data silently, or
blocks the first-value path.

Pre-flight: open the app in a fresh browser session (no localStorage) so the
anonymous identity and onboarding state are clean.

## A. Onboarding + first-value path

1. Load `/`. Confirm the **Beta** pill is visible in the header.
   - Pass: pill visible, no console errors.
2. Click **Begin Your Journey**. Confirm `/journey` loads with question 1.
   - Pass: question 1 shown, progress bar at 1/8.
3. Answer all 8 questions (any song titles). On the last, click **Finish**.
   - Pass: navigates to `/results`; the SoundMap poster, Music DNA, and
     timeline render.
4. On `/results`, scroll to **"This was your first listen"**.
   - Pass: the section lists what the user can do (save a memory, revisit,
     discover patterns, build chapters, talk with a Companion) and shows a
     **Save your first memory** button linking to `/memory`.

## B. First memory

5. Click **Save your first memory** → `/results` navigates to `/memory`.
   - Pass: `/memory` compose phase shown.
6. Type a real note (song + moment) and click **Extract** (AI on).
   - Pass: either the AI fills the draft, OR a graceful manual-fallback
     message appears ("We couldn't structure your memory automatically…")
     and the note is preserved. No raw provider error.
7. Save the memory.
   - Pass: **Memory saved** confirmation; a **View this memory** button is
     present; the **"Did this feel meaningful?"** prompt appears.
8. Click **View this memory**.
   - Pass: navigates to `/memory/$memoryId` and the saved memory renders.
9. Go back to `/memory` and save another memory via **Save another memory**.
   - Pass: compose phase is empty again; the feedback prompt does **not**
     reappear (already answered).

## C. Companion

10. Navigate to `/companion`. Start a new conversation.
    - Pass: navigates to `/companion/$conversationId`; an opening line is
      shown for the empty conversation.
11. Send a message.
    - Pass: either a Companion reply appears, OR a calm "I couldn't reach the
      Companion just now…" message appears and your message is preserved with a
      **Retry** button. No raw 500/stack trace.
12. After the first reply, confirm the **"Was this helpful?"** prompt appears.
    - Pick Yes or Not really.
    - Pass: the prompt is replaced by a "Thanks — that helps us shape the
      beta." line.
13. Send a message that mentions a memory you saved. If the Companion surfaces
    a **"Remember this?"** candidate:
    - Click **Remember this**.
    - Pass: a "Got it. I'll remember that." confirmation appears and the
      candidate clears. No silent failure.

## D. Reliability (failure paths)

14. With the Companion open, disable network and send a message.
    - Pass: the calm "I couldn't reach the Companion…" message appears; your
      message is preserved; **Retry** is offered. Re-enable network and retry —
      it should succeed (no duplicated user turn).
15. On `/memory`, with network disabled, try to save a memory.
    - Pass: a clear "I couldn't save your memory…" message; nothing is
      reported as saved. No raw error.

## E. Privacy sanity

16. Open browser DevTools → Network. Send a Companion message.
    - Pass: the request body to the server fn contains the message text (it
      must, to be processed), but **no** provider API key, **no** access token
      in a URL, and **no** `VITE_`-prefixed secret. The provider call happens
      server-side; the browser never calls the provider directly.
17. Open the server logs (dev). Confirm telemetry events are categorical only
    (event name, result, latency bucket, capability, provider) — **no** raw
    message text, **no** memory content, **no** reflection text.

## F. Anonymous-first

18. Throughout A–D, confirm you were never forced to sign up. The anonymous
    identity is sufficient to save a memory and talk to the Companion.
    - Pass: no login wall appeared; data persisted for the session.

## Sign-off

All steps Pass → closed beta is ready. Any Fail → file an issue with the step
number and the observed behaviour before inviting testers.
