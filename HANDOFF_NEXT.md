# Handoff — stabilize main before anything else

## Read this first — ground truth as of right now

I audited `origin/main` directly (typecheck, full test suite, git history).
Do not trust commit messages claiming things are fixed — verify yourself
before touching anything.

**`main` does not currently build cleanly:**

```
npm run typecheck  →  30+ TS errors
npm test           →  48 of 612 tests FAIL (4 files)
```

Root cause: the `MusicDNA` type in `src/types/musicDna.ts` was redefined as
part of a "P0-Phase1 Music DNA" rewrite, but the migration was left
half-finished. Consumers still reference the OLD shape and are now broken:

- `src/routes/results.tsx` (~lines 396-421) — reads `.temporalPattern`,
  `.musicalIdentity`, `.songCount` on `MusicDNA` — none of these exist on
  the new type anymore.
- `src/types/socialShare.ts` (~lines 17-20) — same old-shape references.
- `src/lib/ai/pipelineGrounded.test.ts` — same old-shape references.
- `src/lib/ai/musicFeatures.ts` imports a `Song` type from
  `../../types/musicDna` that isn't exported there.
- `src/lib/ai/pipeline.ts` imports a `LifeContext` type from
  `@/types/musicDna` that isn't exported there either.
- `src/lib/ai/__tests__/musicFeatures.test.ts` — 48 failing tests here.
  Some fail because `extractSongFeaturesArray` doesn't exist (renamed or
  never finished), some because test fixtures pass `genre`/`mood` fields
  that aren't on the `Song` type, some because `null` is being assigned to
  fields typed `string | undefined`.

## History context — why this happened (don't repeat it)

`main` was force-pushed last night to restore from a backup taken around
commit `432aea8`. That restore point predates an earlier Cache V2 /
scene-system migration and a card-artwork prompt fix that were done in a
separate session (never merged — they were sitting in a local clone, not
pushed). **Both of those are currently NOT on `main`** and are not part of
this task; ignore them unless the human explicitly asks to reapply them
later.

There are also 4 stale branches from earlier abandoned attempts — do not
build on top of them, do not merge them, they're history, not current work:
`backup/pre-music-dna-rewrite-2026-09-01`, `feature/itunes-genre-era`,
`feature/music-dna-v1`, `revert-1-feature/music-dna-v1`. One of them
(`feature/music-dna-v1`) contains an earlier, different attempt at replacing
the card cover with a `SilhouetteCanvas` component — that was previously
reverted once already. Do not resurrect it without being asked.

## Your task, in order — do not skip ahead

### Step 1 — Get `main` compiling and green. Nothing else.

1. Decide the `MusicDNA` type's actual current shape (`src/types/musicDna.ts`
   as it stands right now) is the source of truth — do NOT revert it back to
   the old shape. Instead, update every consumer listed above to use the new
   shape correctly. If a consumer needs data the new type genuinely doesn't
   have (e.g. `results.tsx` displaying temporal/identity data), check whether
   the new type has an equivalent field under a different name before
   assuming data was lost — read the actual current `MusicDNA` type
   definition first, do not guess.
2. Export `Song` and `LifeContext` from wherever they're actually now
   defined (check `src/types/` broadly — they may have moved), and fix the
   two broken imports.
3. Fix `src/lib/ai/musicFeatures.ts` / its test: either the exported function
   name changed (find the real current export and fix the test's import) or
   the function was never finished (finish it) — check which before editing.
4. Fix the `Partial<Song>` test fixtures using `genre`/`mood` fields that
   don't exist on `Song` — either those fields belong on `Song` and were
   never added (check the P0 intent — was genre enrichment actually part of
   this phase, or out of scope per earlier project decisions?), or the test
   fixtures are wrong and should use whatever field actually carries that
   data now.
5. Fix the `null` vs `string | undefined` type mismatches — pick one
   consistent convention for "no value" across the codebase (this project
   has consistently used `null` for "known absent" elsewhere — prefer
   updating the type to accept `| null` over changing test data, unless the
   surrounding code clearly expects `undefined`).

**Do not touch card artwork prompts, scene/genre visual work, poster
rendering, or anything not required to make typecheck + tests pass.** Scope
is strictly: make the P0 Music DNA type migration internally consistent.

### Step 2 — Verify, don't assume

Run all three, in this order, and paste the full output before claiming
done:

```
npm run typecheck   # must be 0 errors
npm test             # must be 0 failures (record the exact pass count)
npm run lint          # must be 0 errors
```

"Tests passed" is not by itself permission to merge — this project has an
explicit rule about that from an earlier session. Confirm all three are
clean together, on the same tree, before saying the step is done.

### Step 3 — Stop and report back

Do not merge to `main` yet even if everything is green. Summarize:
- What you changed and why, file by file.
- Whether the original P0 Music DNA intent (grounding DNA in real `Song[]`
  data, not fabricating `genre`) was preserved or altered.
- Whether `results.tsx`'s Music DNA panel and Emotional Timeline panel still
  render the same real grounded data as before (don't silently downgrade
  them to placeholder text to make types pass).

Wait for explicit human confirmation before pushing anywhere. If branch
creation or push is rejected by GitHub's integration (this has happened
before in this repo), stop and report it rather than forcing anything or
falling back to committing straight to `main`.

## Explicit constraints

- Do not force-push. Ever. `main`'s history was already force-pushed once
  this week — do not do it again for any reason.
- Do not fabricate a `genre` field with heuristics/guessing if it's
  genuinely missing from real data — this was a deliberate earlier decision
  (no fake enrichment) and should not be quietly reversed while fixing types.
- Do not resurrect `SilhouetteCanvas`, the old `feature/music-dna-v1`
  branch, or any of the other stale branches.
- Do not touch `cardArtwork.server.ts`'s image-generation prompt text as
  part of this task — that's separate, already-decided work pending
  reapplication in a different session.