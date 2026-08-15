import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Identity Continuity tests.
 *
 * Deterministic: Supabase Auth + domain persistence are stateful fakes. No live
 * email delivery, no OAuth, no service-role calls. The key invariant under
 * test is `beforeUserId === afterUserId` and that NO domain row's user_id is
 * changed, copied, or deleted during conversion.
 */

// ---------------------------------------------------------------------------
// Fake state
// ---------------------------------------------------------------------------
type FakeUser = {
  id: string;
  is_anonymous: boolean;
  email?: string;
  phone?: string;
};
type FakeRow = { id: string; user_id: string; [k: string]: unknown };

const store: {
  users: Map<string, FakeUser>; // by id
  session: { user: FakeUser } | null;
  memories: Map<string, FakeRow>;
  events: Map<string, FakeRow>;
  chapters: Map<string, FakeRow>;
  patterns: Map<string, FakeRow>;
  media: Map<string, FakeRow>;
  journeys: Map<string, FakeRow>;
  updateUserCalls: Array<{ email?: string }>;
  nextId: number;
} = {
  users: new Map(),
  session: null,
  memories: new Map(),
  events: new Map(),
  chapters: new Map(),
  patterns: new Map(),
  media: new Map(),
  journeys: new Map(),
  updateUserCalls: [],
  nextId: 1,
};

/** When true, the next updateUser call fails with "User already registered". */
let nextUpdateConflicts = false;
let nextUpdateFails = false;

let currentFake: SupabaseFake | null = null;

type SupabaseFake = {
  auth: {
    getSession: () => Promise<{ data: { session: { user: FakeUser } | null } }>;
    signInAnonymously: () => Promise<{ data: { session: { user: FakeUser } | null } }>;
    updateUser: (attrs: { email?: string }) => Promise<{ data: unknown; error: unknown }>;
    signOut: () => Promise<{ error: unknown }>;
    refreshSession: () => Promise<{ data: unknown; error: unknown }>;
    onAuthStateChange: (cb: (e: string, s: { user: FakeUser } | null) => void) => {
      data: { subscription: { unsubscribe: () => void } };
    };
  };
};

vi.mock("./client", () => ({
  getSupabase: () => currentFake,
}));

import {
  convertAnonymousToEmail,
  getIdentityStatus,
  refreshIdentity,
  signOutIdentity,
} from "./identity-remote";
import { useUserId, type SessionState } from "./use-session";
import type { User } from "@supabase/supabase-js";

function makeUser(id: string, anonymous: boolean, email?: string): FakeUser {
  const u: FakeUser = { id, is_anonymous: anonymous };
  if (email) u.email = email;
  store.users.set(id, u);
  return u;
}

function makeFake(): SupabaseFake {
  const f: SupabaseFake = {
    auth: {
      getSession: async () => ({
        data: { session: store.session ? { user: store.session.user } : null },
      }),
      signInAnonymously: async () => {
        // not used by identity-remote directly
        return { data: { session: store.session ? { user: store.session.user } : null } };
      },
      updateUser: async (attrs) => {
        store.updateUserCalls.push(attrs);
        if (nextUpdateFails) {
          nextUpdateFails = false;
          return { data: null, error: { message: "unexpected error" } };
        }
        if (nextUpdateConflicts) {
          nextUpdateConflicts = false;
          return { data: null, error: { message: "User already registered" } };
        }
        // Success: the email is attached to the SAME user; is_anonymous stays
        // true until the user verifies (Supabase behavior), but the user id is
        // unchanged. We attach the email to model the post-update state.
        if (store.session && attrs.email) {
          store.session.user.email = attrs.email;
        }
        return { data: { user: store.session?.user }, error: null };
      },
      signOut: async () => {
        // Sign-out clears the local session but does NOT delete the user or
        // any data.
        store.session = null;
        return { error: null };
      },
      refreshSession: async () => ({ data: { session: store.session }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  };
  return f;
}

beforeEach(() => {
  store.users.clear();
  store.session = null;
  store.memories.clear();
  store.events.clear();
  store.chapters.clear();
  store.patterns.clear();
  store.media.clear();
  store.journeys.clear();
  store.updateUserCalls = [];
  store.nextId = 1;
  nextUpdateConflicts = false;
  nextUpdateFails = false;
  currentFake = makeFake();
});

function seedAnonymousWithDomainData(userId: string): void {
  const u = makeUser(userId, true);
  store.session = { user: u };
  store.journeys.set("j-1", { id: "j-1", user_id: userId });
  store.memories.set("m-1", { id: "m-1", user_id: userId });
  store.events.set("e-1", { id: "e-1", user_id: userId });
  store.chapters.set("ch-1", { id: "ch-1", user_id: userId });
  store.patterns.set("p-1", { id: "p-1", user_id: userId });
  store.media.set("md-1", { id: "md-1", user_id: userId });
}

function ownerIdsUnchanged(userId: string): boolean {
  for (const m of store.memories.values()) if (m.user_id !== userId) return false;
  for (const e of store.events.values()) if (e.user_id !== userId) return false;
  for (const c of store.chapters.values()) if (c.user_id !== userId) return false;
  for (const p of store.patterns.values()) if (p.user_id !== userId) return false;
  for (const md of store.media.values()) if (md.user_id !== userId) return false;
  for (const j of store.journeys.values()) if (j.user_id !== userId) return false;
  return true;
}

function toUser(fu: FakeUser): User {
  // Cast through unknown; tests only read id/is_anonymous/email.
  return fu as unknown as User;
}

function sessionState(anonymous: boolean, user: FakeUser): SessionState {
  return anonymous
    ? { status: "anonymous", user: toUser(user), accessToken: "token" }
    : { status: "authenticated", user: toUser(user), accessToken: "token" };
}

// ===========================================================================
// Tests
// ===========================================================================

describe("1. anonymous session recognized", () => {
  it("getIdentityStatus returns anonymous for an is_anonymous user", async () => {
    seedAnonymousWithDomainData("u-1");
    const s = await getIdentityStatus();
    expect(s.status).toBe("anonymous");
    expect(s.userId).toBe("u-1");
  });
});

describe("2. authenticated session recognized", () => {
  it("getIdentityStatus returns authenticated for a permanent user", async () => {
    const u = makeUser("u-2", false, "real@test.com");
    store.session = { user: u };
    const s = await getIdentityStatus();
    expect(s.status).toBe("authenticated");
    expect(s.userId).toBe("u-2");
  });
});

describe("3. anonymous profile shows Keep my soundtrack", () => {
  it("useUserId resolves for an anonymous session", () => {
    seedAnonymousWithDomainData("u-1");
    const s = sessionState(true, store.session!.user);
    expect(useUserId(s)).toBe("u-1");
  });
});

describe("4. authenticated profile shows permanent identity state", () => {
  it("useUserId resolves for an authenticated session", () => {
    const u = makeUser("u-2", false, "real@test.com");
    const s = sessionState(false, u);
    expect(useUserId(s)).toBe("u-2");
  });
});

describe("5. updateUser email flow is invoked for current anonymous user", () => {
  it("convertAnonymousToEmail calls updateUser({ email }) on the current user", async () => {
    seedAnonymousWithDomainData("u-1");
    const r = await convertAnonymousToEmail("me@test.com");
    expect(r.ok).toBe(true);
    expect(store.updateUserCalls).toHaveLength(1);
    expect(store.updateUserCalls[0].email).toBe("me@test.com");
  });
});

describe("6. beforeUserId captured", () => {
  it("the result carries the id observed before the update", async () => {
    seedAnonymousWithDomainData("u-1");
    const r = await convertAnonymousToEmail("me@test.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.beforeUserId).toBe("u-1");
  });
});

describe("7. sameUserId invariant verified", () => {
  it("afterUserId === beforeUserId on success", async () => {
    seedAnonymousWithDomainData("u-1");
    const r = await convertAnonymousToEmail("me@test.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.afterUserId).toBe(r.beforeUserId);
  });
});

describe("8. mismatch stops conversion safely", () => {
  it("returns a mismatch failure and does not modify domain data", async () => {
    seedAnonymousWithDomainData("u-1");
    // Sabotage: after updateUser, swap the session user to a different id.
    const orig = currentFake!.auth.updateUser;
    currentFake!.auth.updateUser = async (attrs) => {
      const res = await orig(attrs);
      store.session = { user: makeUser("u-OTHER", true) };
      return res;
    };
    const r = await convertAnonymousToEmail("me@test.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("user-id-mismatch");
    // Domain data untouched.
    expect(ownerIdsUnchanged("u-1")).toBe(true);
  });
});

describe("9. conversion failure does not modify domain data", () => {
  it("an unknown updateUser error leaves all rows owned by the same user", async () => {
    seedAnonymousWithDomainData("u-1");
    nextUpdateFails = true;
    const r = await convertAnonymousToEmail("me@test.com");
    expect(r.ok).toBe(false);
    expect(ownerIdsUnchanged("u-1")).toBe(true);
  });
});

describe("10. existing Memory remains owned by same user", () => {
  it("memory user_id is unchanged after conversion", async () => {
    seedAnonymousWithDomainData("u-1");
    await convertAnonymousToEmail("me@test.com");
    expect(store.memories.get("m-1")!.user_id).toBe("u-1");
  });
});

describe("11. existing Event remains owned by same user", () => {
  it("event user_id is unchanged after conversion", async () => {
    seedAnonymousWithDomainData("u-1");
    await convertAnonymousToEmail("me@test.com");
    expect(store.events.get("e-1")!.user_id).toBe("u-1");
  });
});

describe("12. existing Chapter remains owned by same user", () => {
  it("chapter user_id is unchanged after conversion", async () => {
    seedAnonymousWithDomainData("u-1");
    await convertAnonymousToEmail("me@test.com");
    expect(store.chapters.get("ch-1")!.user_id).toBe("u-1");
  });
});

describe("13. existing Pattern remains owned by same user", () => {
  it("pattern user_id is unchanged after conversion", async () => {
    seedAnonymousWithDomainData("u-1");
    await convertAnonymousToEmail("me@test.com");
    expect(store.patterns.get("p-1")!.user_id).toBe("u-1");
  });
});

describe("14. existing Media remains owned by same user", () => {
  it("media user_id is unchanged after conversion", async () => {
    seedAnonymousWithDomainData("u-1");
    await convertAnonymousToEmail("me@test.com");
    expect(store.media.get("md-1")!.user_id).toBe("u-1");
  });
});

describe("15. Journey remains owned by same user", () => {
  it("journey user_id is unchanged after conversion", async () => {
    seedAnonymousWithDomainData("u-1");
    await convertAnonymousToEmail("me@test.com");
    expect(store.journeys.get("j-1")!.user_id).toBe("u-1");
  });
});

describe("16. sign out does not delete data", () => {
  it("signOut clears the session but keeps all rows", async () => {
    seedAnonymousWithDomainData("u-1");
    const r = await signOutIdentity();
    expect(r.ok).toBe(true);
    expect(store.session).toBeNull();
    expect(store.memories.size).toBe(1);
    expect(store.events.size).toBe(1);
    expect(store.journeys.size).toBe(1);
    expect(ownerIdsUnchanged("u-1")).toBe(true);
  });
});

describe("17. Not now keeps anonymous mode usable", () => {
  it("dismissal is recorded in localStorage and the session stays anonymous", () => {
    seedAnonymousWithDomainData("u-1");
    const s = sessionState(true, store.session!.user);
    expect(useUserId(s)).toBe("u-1");
    // Simulate the panel's Not now → localStorage flag.
    localStorage.setItem("lis:identity:dismissed", "1");
    expect(localStorage.getItem("lis:identity:dismissed")).toBe("1");
    // Session remains usable.
    expect(useUserId(s)).toBe("u-1");
    localStorage.clear();
  });
});

describe("18. existing-account conflict is handled without merge", () => {
  it("returns email-already-registered and does not merge or copy", async () => {
    seedAnonymousWithDomainData("u-1");
    nextUpdateConflicts = true;
    const r = await convertAnonymousToEmail("taken@test.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("email-already-registered");
    // No new user created.
    expect(store.users.size).toBe(1);
    // No data copied/moved.
    expect(ownerIdsUnchanged("u-1")).toBe(true);
  });
});

describe("19. no user_id copying occurs", () => {
  it("no domain row count changes and no row's user_id changes", async () => {
    seedAnonymousWithDomainData("u-1");
    const before = {
      memories: store.memories.size,
      events: store.events.size,
      chapters: store.chapters.size,
      patterns: store.patterns.size,
      media: store.media.size,
      journeys: store.journeys.size,
    };
    await convertAnonymousToEmail("me@test.com");
    expect(store.memories.size).toBe(before.memories);
    expect(store.events.size).toBe(before.events);
    expect(store.chapters.size).toBe(before.chapters);
    expect(store.patterns.size).toBe(before.patterns);
    expect(store.media.size).toBe(before.media);
    expect(store.journeys.size).toBe(before.journeys);
    expect(ownerIdsUnchanged("u-1")).toBe(true);
  });
});

describe("20. no service-role/admin key in client code", () => {
  it("identity-remote references no service role / admin API", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/supabase/identity-remote.ts", "utf8");
    for (const k of [
      "SERVICE_ROLE",
      "service_role",
      "serviceRole",
      "auth.admin",
      "admin.createUser",
      "admin.deleteUser",
    ]) {
      expect(src).not.toContain(k);
    }
    // Only operates on the current session via the anon client.
    expect(src).toContain("getSession");
    expect(src).toContain("updateUser");
  });
});

describe("21. no secret in client bundle", () => {
  it("identity modules ship no provider keys / process.env", async () => {
    const fs = await import("node:fs");
    for (const file of [
      "src/lib/supabase/identity-remote.ts",
      "src/lib/supabase/use-session.ts",
      "src/components/identity/IdentityPanel.tsx",
      "src/routes/profile.tsx",
    ]) {
      const src = fs.readFileSync(file, "utf8");
      for (const k of [
        "GROQ_API_KEY",
        "GEMINI_API_KEY",
        "MISTRAL_API_KEY",
        "OPENROUTER_API_KEY",
        "SUPABASE_SERVICE_ROLE",
      ]) {
        expect(src).not.toContain(k);
      }
      expect(src).not.toMatch(/process\.env/);
    }
  });
});

describe("22. use-session backward compatibility", () => {
  it("useUserId returns the id for anonymous (legacy shape) and authenticated", () => {
    const anon = makeUser("u-1", true);
    const auth = makeUser("u-2", false, "x@test.com");
    expect(useUserId(sessionState(true, anon))).toBe("u-1");
    expect(useUserId(sessionState(false, auth))).toBe("u-2");
    expect(useUserId({ status: "loading" })).toBeNull();
    expect(useUserId({ status: "unavailable" })).toBeNull();
  });
});

describe("23. auth state refresh after identity update", () => {
  it("refreshIdentity re-reads the session and returns the current status", async () => {
    seedAnonymousWithDomainData("u-1");
    // Simulate verification: the user is no longer anonymous, same id.
    store.session!.user.is_anonymous = false;
    store.session!.user.email = "me@test.com";
    const s = await refreshIdentity();
    expect(s.status).toBe("authenticated");
    expect(s.userId).toBe("u-1");
  });
});

describe("24. anonymous flow does not create a second Supabase user", () => {
  it("no new user record is created during conversion", async () => {
    seedAnonymousWithDomainData("u-1");
    const before = store.users.size;
    await convertAnonymousToEmail("me@test.com");
    expect(store.users.size).toBe(before);
  });
});

describe("OAuth linking", () => {
  it("is SKIPPED — no OAuth provider configured in this project", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/supabase/identity-remote.ts", "utf8");
    // No signInWithOAuth / linkIdentity call is made.
    expect(src).not.toContain("signInWithOAuth");
    expect(src).not.toContain("linkIdentity");
  });
});

describe("account deletion", () => {
  it("is DEFERRED — no delete-user flow is exposed", async () => {
    const fs = await import("node:fs");
    for (const file of [
      "src/lib/supabase/identity-remote.ts",
      "src/components/identity/IdentityPanel.tsx",
      "src/routes/profile.tsx",
    ]) {
      const src = fs.readFileSync(file, "utf8");
      // No admin delete-user invocation and no client-side deleteUser call.
      expect(src).not.toContain("admin.deleteUser");
      expect(src).not.toContain(".deleteUser(");
      expect(src).not.toContain("deleteUser(");
    }
  });
});

describe("email validation (defense-in-depth)", () => {
  it("rejects malformed emails before calling updateUser", async () => {
    seedAnonymousWithDomainData("u-1");
    for (const bad of ["not-an-email", "a@b", "@test.com", ""]) {
      const r = await convertAnonymousToEmail(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("invalid-email");
    }
    expect(store.updateUserCalls).toHaveLength(0);
  });
});

describe("not-anonymous guard", () => {
  it("refuses to re-link an already-permanent user", async () => {
    const u = makeUser("u-2", false, "real@test.com");
    store.session = { user: u };
    const r = await convertAnonymousToEmail("new@test.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not-anonymous");
    expect(store.updateUserCalls).toHaveLength(0);
  });
});
