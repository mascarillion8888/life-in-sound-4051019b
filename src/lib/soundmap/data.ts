export type Era = {
  id: number;
  /** Short phase label shown in the progress bar, e.g. "9-12 Yaş". */
  age: string;
  /** Era name, e.g. "Keşif". */
  phase: string;
  question: string;
  hint: string;
  /** Emotional intensity 0..1 used by the waveform chart. */
  intensity: number;
  /** Theme tag shown on the playlist rows. */
  tag: string;
  /** Tailwind-safe token name for the tag color. */
  tone: "violet" | "gold" | "silver";
  emotion: string;
};

export const eras: Era[] = [
  {
    id: 1,
    age: "5-9 Yaş",
    phase: "Keşif",
    question: "Çocukluğunu hatırlatan şarkı hangisi?",
    hint: "İlk kez bir sesin seni bir yere götürdüğü an.",
    intensity: 0.35,
    tag: "Masumiyet",
    tone: "silver",
    emotion: "Dünyanın hâlâ büyük ve yumuşak olduğu yıllar.",
  },
  {
    id: 2,
    age: "9-12 Yaş",
    phase: "Keşif",
    question: "İlk kez 'bu benim şarkım' dediğin parça?",
    hint: "Kendi zevkinin ilk imzası.",
    intensity: 0.45,
    tag: "İlk Kimlik",
    tone: "silver",
    emotion: "Zevkin bir aynaya dönüştüğü ilk eşik.",
  },
  {
    id: 3,
    age: "13-17 Yaş",
    phase: "İsyan",
    question: "Ergenliğinin isyanını taşıyan şarkı?",
    hint: "Kapıyı çarptığın gün çalan şey.",
    intensity: 0.78,
    tag: "İsyan",
    tone: "violet",
    emotion: "Ses seviyesinin duygudan yüksek olduğu dönem.",
  },
  {
    id: 4,
    age: "18-22 Yaş",
    phase: "Sorgulama",
    question: "Kim olduğunu sorgularken dinlediğin şarkı?",
    hint: "Gece yürüyüşlerinin parçası.",
    intensity: 0.6,
    tag: "Sorgulama",
    tone: "violet",
    emotion: "Cevaplardan çok soruların biriktiği yıllar.",
  },
  {
    id: 5,
    age: "18-28 Yaş",
    phase: "Güç",
    question: "Sana güç veren, seni ayağa kaldıran şarkı?",
    hint: "Omuzlarını dikleştiren parça.",
    intensity: 0.85,
    tag: "Güç",
    tone: "gold",
    emotion: "Çelikleşme: kırılganlığın zırha dönüşmesi.",
  },
  {
    id: 6,
    age: "23-30 Yaş",
    phase: "Karanlık",
    question: "En zor dönemine eşlik eden şarkı?",
    hint: "Yükü hafifletmeyen ama yalnız bırakmayan ses.",
    intensity: 0.25,
    tag: "Karanlık",
    tone: "violet",
    emotion: "Sesin ışıktan önce geldiği yer.",
  },
  {
    id: 7,
    age: "28+ Yaş",
    phase: "Derinlik",
    question: "Özlediğin birini hatırlatan şarkı?",
    hint: "Bir ismin melodiye dolanmış hâli.",
    intensity: 0.5,
    tag: "Özlem",
    tone: "gold",
    emotion: "Kaybın müzikle taşınabilir hâle geldiği an.",
  },
  {
    id: 8,
    age: "Şimdi",
    phase: "Kabullenme",
    question: "Jenerik akarken çalmasını istediğin şarkı?",
    hint: "Son sahne senin.",
    intensity: 0.68,
    tag: "Kabullenme",
    tone: "gold",
    emotion: "Sorguyla barışın aynı melodide buluşması.",
  },
];

export type Suggestion = { title: string; artist: string };

/** Local mock catalogue powering the fuzzy autocomplete. No network calls. */
export const songCatalogue: Suggestion[] = [
  { title: "Bad", artist: "Michael Jackson" },
  { title: "Billie Jean", artist: "Michael Jackson" },
  { title: "Smells Like Teen Spirit", artist: "Nirvana" },
  { title: "Come As You Are", artist: "Nirvana" },
  { title: "Creep", artist: "Radiohead" },
  { title: "Karma Police", artist: "Radiohead" },
  { title: "Everlong", artist: "Foo Fighters" },
  { title: "Numb", artist: "Linkin Park" },
  { title: "In the End", artist: "Linkin Park" },
  { title: "Chop Suey!", artist: "System of a Down" },
  { title: "Wish You Were Here", artist: "Pink Floyd" },
  { title: "Comfortably Numb", artist: "Pink Floyd" },
  { title: "Bohemian Rhapsody", artist: "Queen" },
  { title: "Under Pressure", artist: "Queen & David Bowie" },
  { title: "Heroes", artist: "David Bowie" },
  { title: "Hurt", artist: "Johnny Cash" },
  { title: "The Sound of Silence", artist: "Simon & Garfunkel" },
  { title: "Nothing Else Matters", artist: "Metallica" },
  { title: "Enter Sandman", artist: "Metallica" },
  { title: "Losing My Religion", artist: "R.E.M." },
  { title: "Zor Sevda", artist: "Sezen Aksu" },
  { title: "Bir Derdim Var", artist: "Mor ve Ötesi" },
  { title: "Cambaz", artist: "Mor ve Ötesi" },
  { title: "Hayat Bayram Olsa", artist: "Barış Manço" },
  { title: "Gülpembe", artist: "Barış Manço" },
  { title: "Uzun İnce Bir Yoldayım", artist: "Âşık Veysel" },
  { title: "Islak Islak", artist: "Duman" },
  { title: "Her Şeyi Yak", artist: "Duman" },
  { title: "Bu Sabah Yağmur Var İstanbul'da", artist: "Teoman" },
  { title: "Söz", artist: "Sagopa Kajmer" },
  { title: "Yalnızlık Paylaşılmaz", artist: "Ceza" },
  { title: "Sen Ağlama", artist: "Sezen Aksu" },
  { title: "Fix You", artist: "Coldplay" },
  { title: "Yellow", artist: "Coldplay" },
  { title: "Runaway", artist: "Kanye West" },
  { title: "Alright", artist: "Kendrick Lamar" },
  { title: "Redemption Song", artist: "Bob Marley" },
  { title: "Imagine", artist: "John Lennon" },
  { title: "Skinny Love", artist: "Bon Iver" },
  { title: "Holocene", artist: "Bon Iver" },
  { title: "Motion Picture Soundtrack", artist: "Radiohead" },
  { title: "Time", artist: "Hans Zimmer" },
  { title: "Nuvole Bianche", artist: "Ludovico Einaudi" },
  { title: "Svefn-g-englar", artist: "Sigur Rós" },
  { title: "Teardrop", artist: "Massive Attack" },
  { title: "Angel", artist: "Massive Attack" },
  { title: "Where Is My Mind?", artist: "Pixies" },
  { title: "Mad World", artist: "Gary Jules" },
  { title: "Dog Days Are Over", artist: "Florence + The Machine" },
  { title: "Video Games", artist: "Lana Del Rey" },
];

/** Cheap subsequence-based fuzzy score. Higher is better; 0 means no match. */
function fuzzyScore(needle: string, haystack: string): number {
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  if (!n) return 0;
  const direct = h.indexOf(n);
  if (direct === 0) return 1000;
  if (direct > 0) return 800 - direct;

  let score = 0;
  let hi = 0;
  let streak = 0;
  for (const ch of n) {
    const found = h.indexOf(ch, hi);
    if (found === -1) return 0;
    streak = found === hi ? streak + 1 : 0;
    score += 10 + streak * 4 - Math.min(found - hi, 8);
    hi = found + 1;
  }
  return score;
}

export function searchCatalogue(query: string, limit = 6): Suggestion[] {
  const q = query.trim();
  if (!q) return [];
  return songCatalogue
    .map((s) => ({
      s,
      score: Math.max(
        fuzzyScore(q, `${s.title} ${s.artist}`),
        fuzzyScore(q, `${s.artist} ${s.title}`),
      ),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.s);
}
