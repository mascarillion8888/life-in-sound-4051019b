import { useMemo, useState } from "react";
import { Check, CornerDownLeft, Pencil, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchCatalogue, type Suggestion } from "@/lib/soundmap/data";

export type Pick = Suggestion & { confirmed: boolean };

export function SongPicker({
  value,
  onChange,
}: {
  value: Pick | null;
  onChange: (pick: Pick | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState({ title: "", artist: "" });
  const [openList, setOpenList] = useState(false);

  const results = useMemo(() => searchCatalogue(query), [query]);
  const ghost = results[0] ? `${results[0].title} — ${results[0].artist}` : "";
  const ghostSuffix =
    ghost.toLowerCase().startsWith(query.toLowerCase()) && query ? ghost.slice(query.length) : "";

  const select = (s: Suggestion) => {
    onChange({ ...s, confirmed: false });
    setQuery("");
    setOpenList(false);
  };

  if (value) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-primary/30 bg-card/70 p-6 shadow-[0_0_60px_-25px_var(--gold)] backdrop-blur-xl sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Seçilen Parça
        </p>
        <p className="mt-3 text-xl font-semibold text-foreground sm:text-2xl">{value.title}</p>
        <p className="text-sm text-primary sm:text-base">{value.artist || "Bilinmeyen sanatçı"}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onChange(null)}
            className="h-12 flex-1 rounded-2xl border-border/60 text-base"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Şarkıyı Değiştir
          </Button>
          <Button
            onClick={() => onChange({ ...value, confirmed: true })}
            disabled={value.confirmed}
            className="h-12 flex-1 rounded-2xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Check className="mr-2 h-4 w-4" />
            {value.confirmed ? "Onaylandı" : "Şarkıyı Onayla"}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden pl-14 pr-5 text-base text-muted-foreground/50">
          <span className="invisible whitespace-pre">{query}</span>
          <span className="truncate whitespace-pre">{ghostSuffix}</span>
        </div>
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpenList(true);
          }}
          onFocus={() => setOpenList(true)}
          onKeyDown={(e) => {
            if (e.key === "Tab" && results[0]) {
              e.preventDefault();
              select(results[0]);
            }
            if (e.key === "Enter" && results[0]) {
              e.preventDefault();
              select(results[0]);
            }
          }}
          placeholder="Şarkı veya sanatçı ara…"
          aria-label="Şarkı ara"
          className="relative h-16 rounded-2xl border-border/60 bg-background/60 pl-14 text-base"
        />

        <AnimatePresence>
          {openList && results.length > 0 ? (
            <motion.ul
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border/60 bg-popover/95 backdrop-blur-xl"
            >
              {results.map((s) => (
                <li key={`${s.title}-${s.artist}`}>
                  <button
                    type="button"
                    onClick={() => select(s)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-primary/10"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {s.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.artist}
                      </span>
                    </span>
                    <CornerDownLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Listede yok mu? Elle ekle
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input
            value={manual.title}
            onChange={(e) => setManual((m) => ({ ...m, title: e.target.value }))}
            placeholder="Şarkı adı"
            aria-label="Şarkı adı"
            className="h-12 rounded-xl border-border/60 bg-background/60"
          />
          <Input
            value={manual.artist}
            onChange={(e) => setManual((m) => ({ ...m, artist: e.target.value }))}
            placeholder="Sanatçı adı"
            aria-label="Sanatçı adı"
            className="h-12 rounded-xl border-border/60 bg-background/60"
          />
        </div>
        <Button
          variant="outline"
          disabled={!manual.title.trim()}
          onClick={() => {
            onChange({
              title: manual.title.trim(),
              artist: manual.artist.trim(),
              confirmed: false,
            });
            setManual({ title: "", artist: "" });
          }}
          className="mt-4 h-11 w-full rounded-xl border-border/60"
        >
          Bu parçayı kullan
        </Button>
      </div>
    </div>
  );
}
