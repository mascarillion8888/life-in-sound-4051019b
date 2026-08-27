import { describe, expect, it, vi } from "vitest";

import type { CardRow } from "@/lib/supabase/cards-remote";

import {
  canvasToPngBlob,
  downloadSharePoster,
  exportSharePoster,
  sharePosterFileName,
  trySharePoster,
} from "./sharePoster";

function card(overrides: Partial<CardRow> = {}): CardRow {
  return {
    id: "id",
    trackKey: "itunes:123",
    title: "Fragile",
    artist: "Sting",
    genre: null,
    releaseYear: 1987,
    birthYear: 1978,
    encounterAge: 9,
    eraYear: 1987,
    userMemory: null,
    scene: "gothic",
    lore: null,
    imagePath: null,
    createdAt: "2026-08-26T00:00:00Z",
    ...overrides,
  };
}

describe("sharePosterFileName", () => {
  it("lowercases and slugifies the title", () => {
    expect(sharePosterFileName("Black Sabbath — Iron Man")).toBe(
      "lifeinsound-black-sabbath-iron-man.png",
    );
  });

  it("falls back to card for an empty/symbol-only title", () => {
    expect(sharePosterFileName("!!!")).toBe("lifeinsound-card.png");
  });
});

describe("canvasToPngBlob", () => {
  it("resolves the blob from toBlob when it succeeds", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const toBlob = (_c: HTMLCanvasElement, cb: (b: Blob | null) => void) => cb(blob);
    const result = await canvasToPngBlob(document.createElement("canvas"), toBlob);
    expect(result).toBe(blob);
  });

  it("falls back to a DataURL -> Blob when toBlob returns null", async () => {
    const toBlob = (_c: HTMLCanvasElement, cb: (b: Blob | null) => void) => cb(null);
    const toDataUrl = () => "data:image/png;base64," + btoa("\x89PNGfake-image-bytes");
    const result = await canvasToPngBlob(document.createElement("canvas"), toBlob, toDataUrl);
    expect(result.type).toBe("image/png");
    expect(result.size).toBeGreaterThan(0);
  });

  it("rejects when both backends fail", async () => {
    const toBlob = (_c: HTMLCanvasElement, cb: (b: Blob | null) => void) => cb(null);
    const toDataUrl = () => {
      throw new Error("encoding failed");
    };
    await expect(
      canvasToPngBlob(document.createElement("canvas"), toBlob, toDataUrl),
    ).rejects.toThrow("encoding failed");
  });
});

describe("downloadSharePoster", () => {
  it("triggers a blob download with the right file name", async () => {
    // jsdom has no 2D canvas context; a null context means renderSharePoster
    // resolves the untouched canvas. We stub toBlob via canvas prototype.
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob(["x"], { type: "image/png" }));
    } as never;

    const link = { download: "", href: "", click: vi.fn() };
    const createLink = () => link;

    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:fake") as never;
    URL.revokeObjectURL = vi.fn() as never;

    try {
      await downloadSharePoster(card({ title: "Fragile" }), createLink as never);
    } finally {
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }

    expect(link.click).toHaveBeenCalledTimes(1);
    expect(link.download).toBe("lifeinsound-fragile.png");
    expect(link.href).toBe("blob:fake");
  });
});

describe("trySharePoster", () => {
  it("returns false when the Web Share API is unavailable", async () => {
    // jsdom has no navigator.share — this is the natural fallback path.
    expect(await trySharePoster(card())).toBe(false);
  });

  it("returns false when share rejects (user cancel)", async () => {
    // renderSharePoster awaits document.fonts.ready and the blob path calls
    // canvas.toBlob — stub both so the render resolves in jsdom.
    const originalFonts = Object.getOwnPropertyDescriptor(Document.prototype, "fonts");
    Object.defineProperty(Document.prototype, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob(["png"], { type: "image/png" }));
    } as never;

    type ShareableNavigator = {
      share?: (d?: ShareData) => Promise<void>;
      canShare?: (d?: ShareData) => boolean;
    };
    const nav = navigator as unknown as ShareableNavigator;
    const share = vi.fn().mockRejectedValue(new Error("AbortError"));
    nav.share = share;
    nav.canShare = (data?: ShareData) => Boolean(data?.files?.length);

    try {
      expect(await trySharePoster(card())).toBe(false);
    } finally {
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
      if (originalFonts) Object.defineProperty(Document.prototype, "fonts", originalFonts);
      else delete (Document.prototype as { fonts?: unknown }).fonts;
      nav.share = undefined;
      nav.canShare = undefined;
    }
  });
});

describe("exportSharePoster", () => {
  it("reports shared when the native share succeeds", async () => {
    const result = await exportSharePoster(card(), {
      tryWebShare: async () => true,
      download: async () => {
        throw new Error("should not fall back");
      },
    });
    expect(result).toBe("shared");
  });

  it("falls back to download when Web Share is unavailable", async () => {
    const download = vi.fn().mockResolvedValue(undefined);
    const result = await exportSharePoster(card(), {
      tryWebShare: async () => false,
      download,
    });
    expect(result).toBe("downloaded");
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("reports failed when both share and download fail", async () => {
    const result = await exportSharePoster(card(), {
      tryWebShare: async () => false,
      download: async () => {
        throw new Error("boom");
      },
    });
    expect(result).toBe("failed");
  });
});
