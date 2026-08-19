<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Bu repoda çalışmaya başlamadan önce SIRAYLA oku

1. **AGENTS.md** (bu dosya)
2. **STATE.md** — kalıcı kurallar (nadiren değişir): vizyon, yol haritası, dal
   topolojisi kuralı, kredi bitiş protokolü, çalışma kuralları.
3. **docs/HANDOFF.md** — şu an neredeyiz (HER ZAMAN önce buna bak): HEAD,
   test durumu, açık/bekleyen iş, sıradaki adım, olası sonuçlar.
4. `git status && git log --oneline -5` — `docs/HANDOFF.md` ile uyuşuyor mu
   doğrula. Uyuşmuyorsa **git'e güven, dosyaya değil** ve kullanıcıya bildir.

Bir operasyon bittiğinde veya kredi/oturum bitmeden önce `docs/HANDOFF.md`
TAMAMEN yeniden yazılmadan hiçbir oturum "tamamlandı" sayılmaz. Commit
mesajı: `checkpoint: [özet] — HANDOFF.md güncellendi`.

