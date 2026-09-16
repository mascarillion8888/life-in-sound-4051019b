# Prompt Engine — bilinçli olarak boş (placeholder)

Bu dosya 0-byte olarak izleniyor. İçerik bilinçli olarak doldurulmamıştır — sessiz tuzak olmasın diye bu not eklendi.

- Prompt sentezi gerçek çalışan koddur: `src/lib/ai/moodInference.server.ts` (mood promptu),
  `src/lib/llm/poetic-analyzer.ts` + `src/lib/llm/generateAnalysis.server.ts` (poetic analyzer),
  `src/lib/llm/prompts.ts` (life story), `src/lib/llm/generateStory.server.ts`,
  `src/lib/art/cardArtwork.server.ts::buildCardArtworkPrompt` + `src/lib/art/cardBlueprint.ts`
  (görsel prompt sentezi — saf/deterministik). LLM köprüsü: `src/lib/openrouter.server.ts`.

İleride doldurulacak: prompt sözleşmeleri ve şablon kataloğu için ayrı doküman.

_Tarih: 2026-09-16 (Hermes — DOCUMENTATION-ONLY; kod değişmedi.)_