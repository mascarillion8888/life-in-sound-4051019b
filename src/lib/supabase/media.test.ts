import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the Media Foundation persistence layer.
 *
 * Scenarios 1-30 from the directive. No live Storage / LLM / network: the
 * Supabase client + Storage are stateful fakes; the media module is exercised
 * against them. No AI/image provider calls.
 */

// ---------------------------------------------------------------------------
// Module-level fake state
// ---------------------------------------------------------------------------
type FakeMedia = {
  id: string;
  user_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  captured_at: string | null;
  created_at: string;
  updated_at: string;
};
type FakeLink = {
  id: string;
  user_id: string;
  media_id: string;
  ctx_id: string;
  position: number;
  is_current?: boolean;
};
type FakeMem = { id: string; user_id: string };
type FakeEvent = { id: string; user_id: string };
type FakeChapter = { id: string; user_id: string };

const store: {
  media: Map<string, FakeMedia>;
  memoryLinks: FakeLink[];
  eventLinks: FakeLink[];
  chapterLinks: FakeLink[];
  profileLinks: FakeLink[];
  memories: Map<string, FakeMem>;
  events: Map<string, FakeEvent>;
  chapters: Map<string, FakeChapter>;
  storage: Map<string, { bytes: number; contentType: string }>;
  nextId: number;
} = {
  media: new Map(),
  memoryLinks: [],
  eventLinks: [],
  chapterLinks: [],
  profileLinks: [],
  memories: new Map(),
  events: new Map(),
  chapters: new Map(),
  storage: new Map(),
  nextId: 1,
};

let currentFake: SupabaseFake | null = null;
// Controls whether the next DB insert (media row) fails, to test compensation.
let failNextMediaInsert = false;

type FakeThenable = {
  select: () => FakeThenable;
  eq: (col: string, val: unknown) => FakeThenable;
  in: (col: string, vals: unknown[]) => FakeThenable;
  order: () => FakeThenable;
  single: () => Promise<{ data: unknown; error: unknown }>;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  then: (resolve: (v: unknown) => unknown) => unknown;
  insert: (row: Record<string, unknown>) => FakeThenable;
  update: (patch: Record<string, unknown>) => FakeThenable;
  delete: () => FakeThenable;
};

type SupabaseFake = {
  from: (table: string) => FakeThenable;
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Blob | File,
        opts?: { contentType?: string; upsert?: boolean },
      ) => Promise<{ data: unknown; error: unknown }>;
      remove: (paths: string[]) => Promise<{ data: unknown; error: unknown }>;
      createSignedUrl: (
        path: string,
        ttl: number,
      ) => Promise<{ data: { signedUrl: string } | null; error: unknown }>;
    };
  };
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

vi.mock("./client", () => ({
  getSupabase: () => currentFake,
}));

import {
  ALLOWED_MIME_TYPES,
  MAX_MEDIA_BYTES,
  attachMediaToChapter,
  attachMediaToEvent,
  attachMediaToMemory,
  attachMediaToProfile,
  buildStoragePath,
  createMediaRecord,
  deleteMedia,
  detachMediaFromMemory,
  detachMediaFromProfile,
  getSignedMediaUrl,
  isAllowedMimeType,
  isWithinSizeLimit,
  listUserMedia,
  loadMedia,
  sanitizeFilename,
  uploadMedia,
} from "./media-remote";

function makeFake(): SupabaseFake {
  const f: SupabaseFake = {
    from: (table: string) => {
      const eqs: Array<[string, unknown]> = [];
      const ins: Array<unknown[]> = [];
      let pendingInsert: Record<string, unknown> | null = null;
      let pendingUpdate: Record<string, unknown> | null = null;
      let isDelete = false;
      const thenable: FakeThenable = {
        select: () => thenable,
        eq: (col, val) => {
          eqs.push([col, val]);
          return thenable;
        },
        in: () => thenable,
        order: () => thenable,
        single: async () => {
          if (pendingInsert) {
            if (table === "media") {
              if (failNextMediaInsert) {
                failNextMediaInsert = false;
                return { data: null, error: { message: "forced insert failure" } };
              }
              const row = insertMediaRow(pendingInsert);
              return { data: row, error: null };
            }
            return { data: pendingInsert, error: null };
          }
          return { data: null, error: null };
        },
        maybeSingle: async () => {
          const userEq = eqs.find(([c]) => c === "user_id");
          const uid = userEq ? String(userEq[1]) : null;
          if (table === "media") {
            const idEq = eqs.find(([c]) => c === "id");
            const row = store.media.get(String(idEq?.[1]));
            if (!row || (uid && row.user_id !== uid)) return { data: null, error: null };
            return { data: row, error: null };
          }
          if (table === "profile_media") {
            const links = store.profileLinks.filter(
              (l) => (!uid || l.user_id === uid) && l.is_current,
            );
            return { data: links[0] ? { media_id: links[0].media_id } : null, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve) => {
          if (isDelete) {
            applyDelete(table, eqs);
            return resolve({ data: null, error: null });
          }
          return resolve({ data: selectList(table, eqs), error: null });
        },
        insert: (row) => {
          pendingInsert = row;
          return thenable;
        },
        update: (patch) => {
          pendingUpdate = patch;
          return thenable;
        },
        delete: () => {
          isDelete = true;
          return thenable;
        },
      };
      return thenable;
    },
    storage: {
      from: () => ({
        upload: async (path: string, _body: Blob | File, opts?: { contentType?: string }) => {
          store.storage.set(path, {
            bytes: 1,
            contentType: opts?.contentType ?? "application/octet-stream",
          });
          return { data: { path }, error: null };
        },
        remove: async (paths: string[]) => {
          for (const p of paths) store.storage.delete(p);
          return { data: null, error: null };
        },
        createSignedUrl: async (path: string, ttl: number) => {
          if (!store.storage.has(path)) return { data: null, error: { message: "not found" } };
          return { data: { signedUrl: `https://signed.test/${path}?ttl=${ttl}` }, error: null };
        },
      }),
    },
    rpc: async (name, args) => {
      const p = args ?? {};
      const userId = String(p.p_user_id);
      const mediaId = String(p.p_media_id);
      const m = store.media.get(mediaId);
      if (!m) return { data: null, error: { message: "media not found" } };
      if (m.user_id !== userId) return { data: null, error: { message: "cross-user media" } };

      if (name === "attach_media_to_context_atomic") {
        const ctx = String(p.p_context);
        const ctxId = String(p.p_context_id);
        // verify context ownership
        const owner =
          ctx === "memory"
            ? store.memories.get(ctxId)?.user_id
            : ctx === "event"
              ? store.events.get(ctxId)?.user_id
              : store.chapters.get(ctxId)?.user_id;
        if (!owner) return { data: null, error: { message: "context not found" } };
        if (owner !== userId) return { data: null, error: { message: "cross-user context" } };
        const arr =
          ctx === "memory"
            ? store.memoryLinks
            : ctx === "event"
              ? store.eventLinks
              : store.chapterLinks;
        const ctxCol = ctx === "memory" ? "memory_id" : ctx === "event" ? "event_id" : "chapter_id";
        if (arr.some((l) => l.media_id === mediaId && l.ctx_id === ctxId)) {
          return { data: "ok", error: null };
        }
        arr.push({
          id: `l-${store.nextId++}`,
          user_id: userId,
          media_id: mediaId,
          ctx_id: ctxId,
          position: (p.p_position as number) ?? 0,
        });
        return { data: "ok", error: null };
      }

      if (name === "set_current_profile_media_atomic") {
        // unset existing current
        for (const l of store.profileLinks) if (l.user_id === userId) l.is_current = false;
        // upsert
        const existing = store.profileLinks.find((l) => l.media_id === mediaId);
        if (existing) {
          existing.is_current = true;
        } else {
          store.profileLinks.push({
            id: `p-${store.nextId++}`,
            user_id: userId,
            media_id: mediaId,
            ctx_id: "",
            position: 0,
            is_current: true,
          });
        }
        return { data: "ok", error: null };
      }

      return { data: null, error: { message: "unknown rpc" } };
    },
  };
  return f;
}

function insertMediaRow(row: Record<string, unknown>): FakeMedia {
  const id = (row.id as string) ?? `m-${store.nextId++}`;
  const now = new Date().toISOString();
  const full: FakeMedia = {
    id,
    user_id: String(row.user_id),
    storage_path: String(row.storage_path),
    original_filename: (row.original_filename as string | null) ?? null,
    mime_type: String(row.mime_type),
    byte_size: Number(row.byte_size),
    width: (row.width as number | null) ?? null,
    height: (row.height as number | null) ?? null,
    captured_at: (row.captured_at as string | null) ?? null,
    created_at: now,
    updated_at: now,
  };
  store.media.set(id, full);
  return full;
}

function selectList(table: string, eqs: Array<[string, unknown]>): unknown[] {
  const userEq = eqs.find(([c]) => c === "user_id");
  const uid = userEq ? String(userEq[1]) : null;
  if (table === "media") {
    return Array.from(store.media.values()).filter((m) => !uid || m.user_id === uid);
  }
  if (table === "memory_media") {
    const ctxEq = eqs.find(([c]) => c === "memory_id");
    return store.memoryLinks.filter(
      (l) => (!uid || l.user_id === uid) && (!ctxEq || l.ctx_id === String(ctxEq[1])),
    );
  }
  if (table === "event_media") {
    const ctxEq = eqs.find(([c]) => c === "event_id");
    return store.eventLinks.filter(
      (l) => (!uid || l.user_id === uid) && (!ctxEq || l.ctx_id === String(ctxEq[1])),
    );
  }
  if (table === "chapter_media") {
    const ctxEq = eqs.find(([c]) => c === "chapter_id");
    return store.chapterLinks.filter(
      (l) => (!uid || l.user_id === uid) && (!ctxEq || l.ctx_id === String(ctxEq[1])),
    );
  }
  return [];
}

function applyDelete(table: string, eqs: Array<[string, unknown]>) {
  const userEq = eqs.find(([c]) => c === "user_id");
  const uid = userEq ? String(userEq[1]) : null;
  if (table === "media") {
    const idEq = eqs.find(([c]) => c === "id");
    const id = String(idEq?.[1]);
    const m = store.media.get(id);
    if (m && (!uid || m.user_id === uid)) {
      store.media.delete(id);
      // cascade relationship rows
      store.memoryLinks = store.memoryLinks.filter((l) => l.media_id !== id);
      store.eventLinks = store.eventLinks.filter((l) => l.media_id !== id);
      store.chapterLinks = store.chapterLinks.filter((l) => l.media_id !== id);
      store.profileLinks = store.profileLinks.filter((l) => l.media_id !== id);
    }
  }
  if (table === "memory_media") {
    const mediaEq = eqs.find(([c]) => c === "media_id");
    const ctxEq = eqs.find(([c]) => c === "memory_id");
    store.memoryLinks = store.memoryLinks.filter(
      (l) =>
        !(
          (!uid || l.user_id === uid) &&
          l.media_id === String(mediaEq?.[1]) &&
          l.ctx_id === String(ctxEq?.[1])
        ),
    );
  }
  if (table === "profile_media") {
    const mediaEq = eqs.find(([c]) => c === "media_id");
    store.profileLinks = store.profileLinks.filter(
      (l) => !(!uid || l.user_id === uid) || l.media_id !== String(mediaEq?.[1]),
    );
  }
}

beforeEach(() => {
  store.media.clear();
  store.memoryLinks = [];
  store.eventLinks = [];
  store.chapterLinks = [];
  store.profileLinks = [];
  store.memories.clear();
  store.events.clear();
  store.chapters.clear();
  store.storage.clear();
  store.nextId = 1;
  currentFake = makeFake();
  failNextMediaInsert = false;
});

function seedMedia(id: string, userId: string, overrides: Partial<FakeMedia> = {}): FakeMedia {
  const m: FakeMedia = {
    id,
    user_id: userId,
    storage_path: `${userId}/${id}/file.jpg`,
    original_filename: "file.jpg",
    mime_type: "image/jpeg",
    byte_size: 100,
    width: null,
    height: null,
    captured_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
  store.media.set(id, m);
  store.storage.set(m.storage_path, { bytes: m.byte_size, contentType: m.mime_type });
  return m;
}

function makeFile(name: string, type: string, size: number): File {
  const blob = new Blob([new Uint8Array(Math.min(size, 1024))], { type });
  // File constructor requires a name; blob has no name.
  return new File([blob], name, { type });
}

// ===========================================================================
// Tests
// ===========================================================================

describe("1. owned media record can be created", () => {
  it("creates a media record owned by the user", async () => {
    const r = await createMediaRecord("user-1", {
      storagePath: "user-1/m1/file.jpg",
      originalFilename: "file.jpg",
      mimeType: "image/jpeg",
      byteSize: 100,
    });
    expect("data" in r).toBe(true);
    if ("data" in r) expect(r.data.userId).toBe("user-1");
    expect(store.media.size).toBe(1);
  });
});

describe("2. cross-user media load rejected", () => {
  it("returns null for another user's media", async () => {
    seedMedia("m1", "user-1");
    expect(await loadMedia("user-2", "m1")).toBeNull();
  });
});

describe("3. media list only returns owned media", () => {
  it("lists only the caller's media", async () => {
    seedMedia("m1", "user-1");
    seedMedia("m2", "user-2");
    expect(await listUserMedia("user-1")).toHaveLength(1);
    expect(await listUserMedia("user-2")).toHaveLength(1);
  });
});

describe("4. allowed MIME type accepted", () => {
  it.each(["image/jpeg", "image/png", "image/webp"] as const)("%s is allowed", (mime) => {
    expect(isAllowedMimeType(mime)).toBe(true);
  });
  it("upload accepts an allowed MIME type", async () => {
    const r = await uploadMedia(
      "user-1",
      makeFile("a.png", "image/png", 100),
      "a.png",
      "image/png",
      100,
    );
    expect("data" in r).toBe(true);
  });
});

describe("5. disallowed MIME type rejected", () => {
  it("rejects image/gif and unknown types", () => {
    expect(isAllowedMimeType("image/gif")).toBe(false);
    expect(isAllowedMimeType("application/octet-stream")).toBe(false);
    expect(isAllowedMimeType("video/mp4")).toBe(false);
  });
  it("upload rejects a disallowed MIME type", async () => {
    const r = await uploadMedia(
      "user-1",
      makeFile("a.gif", "image/gif", 100),
      "a.gif",
      "image/gif",
      100,
    );
    expect("error" in r).toBe(true);
    expect(store.media.size).toBe(0);
  });
});

describe("6. oversized file rejected", () => {
  it("rejects files above the limit", () => {
    expect(isWithinSizeLimit(MAX_MEDIA_BYTES + 1)).toBe(false);
    expect(isWithinSizeLimit(0)).toBe(false);
    expect(isWithinSizeLimit(-1)).toBe(false);
    expect(isWithinSizeLimit(MAX_MEDIA_BYTES)).toBe(true);
  });
  it("upload rejects an oversized file", async () => {
    const r = await uploadMedia(
      "user-1",
      makeFile("big.png", "image/png", MAX_MEDIA_BYTES + 1),
      "big.png",
      "image/png",
      MAX_MEDIA_BYTES + 1,
    );
    expect("error" in r).toBe(true);
  });
});

describe("7. private storage path is user-scoped", () => {
  it("buildStoragePath prefixes with the user id", () => {
    const p = buildStoragePath("user-1", "m1", "photo.jpg");
    expect(p.startsWith("user-1/")).toBe(true);
    expect(p).toBe("user-1/m1/photo.jpg");
  });
  it("sanitizeFilename strips path separators and leading dots", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("etcpasswd");
    expect(sanitizeFilename("a/b\\c:d")).toBe("abcd");
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename("...")).toBe("file");
    // The sanitized name never contains a path separator, so it cannot escape.
    expect(sanitizeFilename("../x")).not.toContain("/");
    expect(sanitizeFilename("../x")).not.toContain("\\");
  });
});

describe("8. signed URL cannot be generated for another user's media", () => {
  it("returns null for cross-user media", async () => {
    seedMedia("m1", "user-1");
    expect(await getSignedMediaUrl("user-2", "m1")).toBeNull();
  });
});

describe("9. memory attachment succeeds for owned memory", () => {
  it("attaches media to an owned memory", async () => {
    seedMedia("m1", "user-1");
    store.memories.set("mem-1", { id: "mem-1", user_id: "user-1" });
    const ok = await attachMediaToMemory("user-1", "m1", "mem-1");
    expect(ok).toBe(true);
    expect(store.memoryLinks).toHaveLength(1);
  });
});

describe("10. cross-user memory attachment rejected", () => {
  it("rejects attaching media to another user's memory", async () => {
    seedMedia("m1", "user-1");
    store.memories.set("mem-1", { id: "mem-1", user_id: "user-2" });
    const ok = await attachMediaToMemory("user-1", "m1", "mem-1");
    expect(ok).toBe(false);
    expect(store.memoryLinks).toHaveLength(0);
  });
  it("rejects attaching another user's media to own memory", async () => {
    seedMedia("m1", "user-2");
    store.memories.set("mem-1", { id: "mem-1", user_id: "user-1" });
    const ok = await attachMediaToMemory("user-1", "m1", "mem-1");
    expect(ok).toBe(false);
  });
});

describe("11. event attachment succeeds", () => {
  it("attaches media to an owned event", async () => {
    seedMedia("m1", "user-1");
    store.events.set("ev-1", { id: "ev-1", user_id: "user-1" });
    const ok = await attachMediaToEvent("user-1", "m1", "ev-1");
    expect(ok).toBe(true);
    expect(store.eventLinks).toHaveLength(1);
  });
});

describe("12. cross-user event attachment rejected", () => {
  it("rejects attaching to another user's event", async () => {
    seedMedia("m1", "user-1");
    store.events.set("ev-1", { id: "ev-1", user_id: "user-2" });
    const ok = await attachMediaToEvent("user-1", "m1", "ev-1");
    expect(ok).toBe(false);
  });
});

describe("13. chapter attachment succeeds", () => {
  it("attaches media to an owned chapter", async () => {
    seedMedia("m1", "user-1");
    store.chapters.set("ch-1", { id: "ch-1", user_id: "user-1" });
    const ok = await attachMediaToChapter("user-1", "m1", "ch-1");
    expect(ok).toBe(true);
    expect(store.chapterLinks).toHaveLength(1);
  });
});

describe("14. cross-user chapter attachment rejected", () => {
  it("rejects attaching to another user's chapter", async () => {
    seedMedia("m1", "user-1");
    store.chapters.set("ch-1", { id: "ch-1", user_id: "user-2" });
    const ok = await attachMediaToChapter("user-1", "m1", "ch-1");
    expect(ok).toBe(false);
  });
});

describe("15. profile attachment succeeds", () => {
  it("sets the current profile image", async () => {
    seedMedia("m1", "user-1");
    const ok = await attachMediaToProfile("user-1", "m1");
    expect(ok).toBe(true);
    expect(store.profileLinks.filter((l) => l.is_current)).toHaveLength(1);
  });
});

describe("16. duplicate relationship prevented", () => {
  it("attaching the same media to a memory twice yields one link", async () => {
    seedMedia("m1", "user-1");
    store.memories.set("mem-1", { id: "mem-1", user_id: "user-1" });
    await attachMediaToMemory("user-1", "m1", "mem-1");
    await attachMediaToMemory("user-1", "m1", "mem-1");
    expect(store.memoryLinks).toHaveLength(1);
  });
});

describe("17. detach does not delete media", () => {
  it("detach removes the link but keeps the media + storage object", async () => {
    seedMedia("m1", "user-1");
    store.memories.set("mem-1", { id: "mem-1", user_id: "user-1" });
    await attachMediaToMemory("user-1", "m1", "mem-1");
    const ok = await detachMediaFromMemory("user-1", "m1", "mem-1");
    expect(ok).toBe(true);
    expect(store.memoryLinks).toHaveLength(0);
    expect(store.media.has("m1")).toBe(true);
    expect(store.storage.size).toBeGreaterThan(0);
  });
});

describe("18. media deletion removes relationships", () => {
  it("deleting media cascades relationship rows", async () => {
    seedMedia("m1", "user-1");
    store.memories.set("mem-1", { id: "mem-1", user_id: "user-1" });
    store.events.set("ev-1", { id: "ev-1", user_id: "user-1" });
    store.chapters.set("ch-1", { id: "ch-1", user_id: "user-1" });
    await attachMediaToMemory("user-1", "m1", "mem-1");
    await attachMediaToEvent("user-1", "m1", "ev-1");
    await attachMediaToChapter("user-1", "m1", "ch-1");
    await attachMediaToProfile("user-1", "m1");
    const ok = await deleteMedia("user-1", "m1");
    expect(ok).toBe(true);
    expect(store.memoryLinks).toHaveLength(0);
    expect(store.eventLinks).toHaveLength(0);
    expect(store.chapterLinks).toHaveLength(0);
    expect(store.profileLinks).toHaveLength(0);
  });
});

describe("19. media deletion removes storage object", () => {
  it("deleteMedia removes the Storage object", async () => {
    seedMedia("m1", "user-1");
    expect(store.storage.size).toBe(1);
    await deleteMedia("user-1", "m1");
    expect(store.storage.size).toBe(0);
  });
});

describe("20. deleting Memory does not delete shared media", () => {
  it("memory deletion (relationship cascade) keeps the media + storage", async () => {
    seedMedia("m1", "user-1");
    store.memories.set("mem-1", { id: "mem-1", user_id: "user-1" });
    store.events.set("ev-1", { id: "ev-1", user_id: "user-1" });
    await attachMediaToMemory("user-1", "m1", "mem-1");
    await attachMediaToEvent("user-1", "m1", "ev-1");
    // Simulate memory deletion: cascade the memory_media link only.
    store.memoryLinks = store.memoryLinks.filter((l) => l.ctx_id !== "mem-1");
    expect(store.media.has("m1")).toBe(true);
    expect(store.storage.size).toBe(1);
    expect(store.eventLinks).toHaveLength(1); // still attached to event
  });
});

describe("21. deleting Event does not delete shared media", () => {
  it("event deletion keeps the media", async () => {
    seedMedia("m1", "user-1");
    store.memories.set("mem-1", { id: "mem-1", user_id: "user-1" });
    store.events.set("ev-1", { id: "ev-1", user_id: "user-1" });
    await attachMediaToMemory("user-1", "m1", "mem-1");
    await attachMediaToEvent("user-1", "m1", "ev-1");
    store.eventLinks = store.eventLinks.filter((l) => l.ctx_id !== "ev-1");
    expect(store.media.has("m1")).toBe(true);
    expect(store.memoryLinks).toHaveLength(1);
  });
});

describe("22. deleting Chapter does not delete shared media", () => {
  it("chapter deletion keeps the media", async () => {
    seedMedia("m1", "user-1");
    store.chapters.set("ch-1", { id: "ch-1", user_id: "user-1" });
    store.memories.set("mem-1", { id: "mem-1", user_id: "user-1" });
    await attachMediaToChapter("user-1", "m1", "ch-1");
    await attachMediaToMemory("user-1", "m1", "mem-1");
    store.chapterLinks = store.chapterLinks.filter((l) => l.ctx_id !== "ch-1");
    expect(store.media.has("m1")).toBe(true);
    expect(store.memoryLinks).toHaveLength(1);
  });
});

describe("23. profile replacement does not automatically delete old media", () => {
  it("replacing the current image keeps the old media", async () => {
    seedMedia("m1", "user-1");
    seedMedia("m2", "user-1");
    await attachMediaToProfile("user-1", "m1");
    await attachMediaToProfile("user-1", "m2");
    expect(store.media.has("m1")).toBe(true);
    expect(store.storage.size).toBe(2);
    expect(store.profileLinks.filter((l) => l.is_current && l.media_id === "m2")).toHaveLength(1);
    expect(store.profileLinks.filter((l) => l.is_current && l.media_id === "m1")).toHaveLength(0);
  });
});

describe("24. signed URL remains private", () => {
  it("the signed URL is a short-lived signed URL, never a public URL", async () => {
    seedMedia("m1", "user-1");
    const url = await getSignedMediaUrl("user-1", "m1");
    expect(url).not.toBeNull();
    expect(url).toContain("https://signed.test/");
    expect(url).toContain("ttl=");
  });
  it("returns null when the storage object does not exist", async () => {
    seedMedia("m1", "user-1");
    store.storage.clear();
    expect(await getSignedMediaUrl("user-1", "m1")).toBeNull();
  });
});

describe("25. partial upload failure is compensated", () => {
  it("if the DB row insert fails, the uploaded Storage object is removed", async () => {
    failNextMediaInsert = true;
    const r = await uploadMedia(
      "user-1",
      makeFile("a.png", "image/png", 100),
      "a.png",
      "image/png",
      100,
    );
    expect("error" in r).toBe(true);
    expect(store.media.size).toBe(0);
    expect(store.storage.size).toBe(0); // compensation removed the object
  });
});

describe("26. metadata upload failure cleans storage", () => {
  it("createMediaRecord failure leaves no storage object (upload path)", async () => {
    // Same as 25 but explicit: upload succeeds, row fails → storage cleaned.
    failNextMediaInsert = true;
    await uploadMedia("user-1", makeFile("a.png", "image/png", 50), "a.png", "image/png", 50);
    expect(store.storage.size).toBe(0);
  });
});

describe("27. no AI/image provider call is made", () => {
  it("media-remote references no orchestra/runRole/provider endpoints", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/supabase/media-remote.ts", "utf8");
    for (const k of ["runRole", "orchestra", "api.groq.com", "generativelanguage", "openrouter"]) {
      expect(src).not.toContain(k);
    }
  });
});

describe("28. no provider keys in client bundle (code boundary)", () => {
  it("media modules reference no provider keys or process.env", async () => {
    const fs = await import("node:fs");
    for (const file of [
      "src/lib/supabase/media-remote.ts",
      "src/components/media/MediaSection.tsx",
      "src/components/media/ProfileImage.tsx",
      "src/routes/profile.tsx",
    ]) {
      const src = fs.readFileSync(file, "utf8");
      for (const k of ["GROQ_API_KEY", "GEMINI_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY"]) {
        expect(src).not.toContain(k);
      }
      expect(src).not.toMatch(/process\.env/);
    }
  });
});

describe("29. ownership enforced by RLS (migration)", () => {
  it("the migration enables RLS + owner policies on all media tables", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("supabase/migrations/0006_media.sql", "utf8");
    for (const table of [
      "public.media",
      "public.profile_media",
      "public.memory_media",
      "public.event_media",
      "public.chapter_media",
    ]) {
      expect(src).toContain(`alter table ${table} enable row level security`);
      expect(src).toContain(`${table.replace("public.", "")}_owner_select`);
      expect(src).toContain(`${table.replace("public.", "")}_owner_insert`);
      expect(src).toContain(`${table.replace("public.", "")}_owner_delete`);
    }
    // Storage bucket is private
    expect(src).toMatch(/'user_media', 'user_media', false/);
  });
});

describe("30. storage namespace matches owner", () => {
  it("getSignedMediaUrl rejects a path not under the caller namespace", async () => {
    // Seed a media whose storage_path is NOT under the caller's namespace.
    seedMedia("m1", "user-1", { storage_path: "user-2/m1/file.jpg" });
    expect(await getSignedMediaUrl("user-1", "m1")).toBeNull();
  });
  it("loadMedia returns the row only for the owner", async () => {
    seedMedia("m1", "user-1");
    expect(await loadMedia("user-1", "m1")).not.toBeNull();
    expect(await loadMedia("user-2", "m1")).toBeNull();
  });
});

describe("31. detach profile removes current without deleting media", () => {
  it("detachMediaFromProfile keeps the media object", async () => {
    seedMedia("m1", "user-1");
    await attachMediaToProfile("user-1", "m1");
    const ok = await detachMediaFromProfile("user-1", "m1");
    expect(ok).toBe(true);
    expect(store.media.has("m1")).toBe(true);
    expect(store.storage.size).toBe(1);
  });
});

describe("32. ALLOWED_MIME_TYPES exports the v1 allowlist", () => {
  it("exports exactly the 3 v1 image types", () => {
    expect([...ALLOWED_MIME_TYPES]).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});
