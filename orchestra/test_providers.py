"""Test each provider with a tiny request. Prints pass/fail per model.

Run:  python -m orchestra.test_providers
"""

from __future__ import annotations

import os
import time
from litellm import completion
from dotenv import load_dotenv

load_dotenv()

# model_name, litellm model string, env var holding the key
TESTS = [
    ("groq-llama-3.3-70b",   "groq/llama-3.3-70b-versatile",        "GROQ_API_KEY"),
    ("groq-gpt-oss-120b",    "groq/openai/gpt-oss-120b",            "GROQ_API_KEY"),
    ("groq-qwen3.6-27b",     "groq/qwen/qwen3.6-27b",               "GROQ_API_KEY"),
    ("gemini-3-flash-preview","gemini/gemini-3-flash-preview",      "GEMINI_API_KEY"),
    ("gemini-3.1-flash-lite", "gemini/gemini-3.1-flash-lite",       "GEMINI_API_KEY"),
    ("mistral-large",        "mistral/mistral-large-latest",        "MISTRAL_API_KEY"),
    ("mistral-small",        "mistral/mistral-small-latest",        "MISTRAL_API_KEY"),
    ("openrouter-claude-sonnet-4.6","openrouter/anthropic/claude-sonnet-4.6","OPENROUTER_API_KEY"),
    ("openrouter-gpt-5.2",  "openrouter/openai/gpt-5.2",           "OPENROUTER_API_KEY"),
]


def main() -> int:
    results = []
    for name, model, key_env in TESTS:
        key = os.environ.get(key_env)
        if not key:
            print(f"[FAIL] {name:30s} missing env {key_env}")
            results.append(False)
            continue
        t0 = time.time()
        try:
            r = completion(
                model=model,
                messages=[{"role": "user", "content": "Reply with the single word: OK"}],
                max_tokens=10,
                temperature=0,
            )
            txt = r["choices"][0]["message"]["content"].strip()
            dt = time.time() - t0
            print(f"[ OK ] {name:30s} {model:45s} {dt:5.1f}s  ->  {txt!r}")
            results.append(True)
        except Exception as e:  # noqa: BLE001
            dt = time.time() - t0
            msg = str(e).splitlines()[0][:120]
            print(f"[FAIL] {name:30s} {model:45s} {dt:5.1f}s  ->  {msg}")
            results.append(False)

    passed = sum(results)
    print(f"\n{passed}/{len(results)} models responded.")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
