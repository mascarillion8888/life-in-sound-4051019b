# orchestra/ — Development Multi-Model Tool (NOT part of the product runtime)

This directory is a **development-only** tool. It is **not** part of the
product's runtime. No code in `src/` imports or executes anything here.

## What this is for

The Python files (`router.py`, `config.yaml`, `test_providers.py`,
`smoke_test.py`) implement a multi-role, multi-provider "Orchestra" spec.
That spec was designed for ad-hoc use during **development sessions**
(e.g. when using OpenHands to author code) to get multi-model opinions
across roles like `orchestrator`, `coder`, `reviewer`, `researcher`,
`verifier`, `triage`, and `guardian`.

## Why it is not runtime

The product's **only** real LLM call is the `summarizer` role, invoked from
`src/lib/llm/generateStory.server.ts` via the TypeScript-native
`src/lib/llm/orchestra.ts` bridge (native `fetch`, no LiteLLM, no Python).
The seven non-`summarizer` roles are never called by any product code path.
They are kept here as a reference spec and an authoring-time convenience,
nothing more.

## How to run it (development only)

Run the scripts here directly with Python during a development session. Do
**not** wire any product import to this directory. If a future sprint
genuinely needs a multi-role runtime call in the product, that decision
must be made explicitly — do not silently start importing `orchestra/` from
`src/`.
