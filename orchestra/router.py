"""Life in a Sound — LLM Orchestra role mapping.

Maps each role to a model_name declared in config.yaml and exposes a single
`run_role()` helper. Keys are loaded from .env via LiteLLM's os.environ passthrough.

Usage:
    from orchestra.router import run_role
    resp = run_role("researcher", "What is 2+2?")
"""

from __future__ import annotations

import os
from typing import Optional

from litellm import completion
from dotenv import load_dotenv

# Load .env (keys never reach frontend; this process runs server-side only).
load_dotenv()

# role -> litellm model string (provider/model). Keys loaded from .env.
# Kept in sync with model_list in config.yaml.
ROLE_MAP: dict[str, str] = {
    "orchestrator": "gemini/gemini-3-flash-preview",
    "coder":        "groq/llama-3.3-70b-versatile",
    "reviewer":     "openrouter/anthropic/claude-sonnet-4.6",
    "researcher":   "gemini/gemini-3.1-flash-lite",
    "verifier":     "mistral/mistral-large-latest",
    "summarizer":   "groq/qwen/qwen3.6-27b",
    "triage":       "mistral/mistral-small-latest",
    "guardian":     "openrouter/openai/gpt-5.2",
}

# Per-role system prompts (short, focused).
ROLE_PROMPTS: dict[str, str] = {
    "orchestrator": "You are the orchestrator. Decompose the task, assign sub-tasks to roles, and synthesize results.",
    "coder":        "You are a coder. Produce clean, minimal, correct code. No commentary unless asked.",
    "reviewer":     "You are a reviewer. Give brutally honest, actionable feedback. Flag risks.",
    "researcher":  "You are a researcher. Gather concise facts with sources. No filler.",
    "verifier":    "You are a verifier. Check claims against evidence. Pass/fail with reasons.",
    "summarizer":  "You are a summarizer. Compress to essentials. Bullet points.",
    "triage":      "You are triage. Classify and route. Output one role label only.",
    "guardian":    "You are the guardian. Block unsafe/illegal actions. If safe, say OK.",
}


def run_role(role: str, user_msg: str, temperature: float = 0.3, max_tokens: int = 512) -> str:
    """Run a single role call. Returns the assistant text."""
    if role not in ROLE_MAP:
        raise ValueError(f"Unknown role: {role}. Valid: {list(ROLE_MAP)}")
    resp = completion(
        model=ROLE_MAP[role],
        messages=[
            {"role": "system", "content": ROLE_PROMPTS[role]},
            {"role": "user", "content": user_msg},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return resp["choices"][0]["message"]["content"]


def list_roles() -> dict[str, str]:
    """Return role -> model_name mapping (no secrets)."""
    return dict(ROLE_MAP)


if __name__ == "__main__":
    import sys
    role = sys.argv[1] if len(sys.argv) > 1 else "triage"
    msg = sys.argv[2] if len(sys.argv) > 2 else "ping"
    print(run_role(role, msg))
