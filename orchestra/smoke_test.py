"""End-to-end orchestra smoke test: run every role on one task.

Run:  python -m orchestra.smoke_test
"""

from __future__ import annotations

import time

from .router import ROLE_MAP, run_role

TASK = "A user wants to generate a 3-second ambient rain sound. Outline the safest, minimal plan."


def main() -> int:
    print(f"Task: {TASK}\n{'='*60}")
    ok = 0
    for role in ROLE_MAP:
        t0 = time.time()
        try:
            out = run_role(role, TASK, max_tokens=120)
            dt = time.time() - t0
            preview = out.strip().replace("\n", " ")[:90]
            print(f"[ OK ] {role:12s} {dt:5.1f}s  ->  {preview}")
            ok += 1
        except Exception as e:  # noqa: BLE001
            dt = time.time() - t0
            print(f"[FAIL] {role:12s} {dt:5.1f}s  ->  {str(e)[:90]}")
    print(f"\n{ok}/{len(ROLE_MAP)} roles completed.")
    return 0 if ok == len(ROLE_MAP) else 1


if __name__ == "__main__":
    raise SystemExit(main())
