/**
 * UI string dictionaries for every supported language.
 *
 * "en" is the source locale: every other dictionary must expose the exact
 * same key structure — the parity test in i18n.test.ts enforces this.
 *
 * Only static UI chrome lives here. LLM-generated prose (Life Story, poetic
 * analysis) is localized through the `language` parameter of the analyzer
 * prompt, not through dictionaries.
 */
import type { Language } from "./languages";

export type Dictionary = {
  nav: {
    features: string;
    about: string;
    switchLanguage: string;
  };
  journey: {
    questionLabel: string;
    next: string;
    seeResults: string;
    startNewJourney: string;
    chooseSongHint: string;
    missingAnswers: (list: string) => string;
  };
  questionCard: {
    placeholder: string;
    inputAria: string;
    suggestionsAria: string;
    addToRitual: string;
    recognizedAria: string;
  };
  quizCard: {
    intensityLabel: string;
    playPreviewAria: string;
    mutePreviewAria: string;
    previewUnavailableAria: string;
  };
  results: {
    yourSoundmap: string;
    heroAccent: string;
    heroTagline: string;
    heroSub: string;
    lifeStoryEyebrow: string;
    lifeStoryTitle: string;
    lifeStoryLocked: string;
    dnaEyebrow: string;
    dnaTitle: string;
    favoriteEmotions: string;
    musicStyle: string;
    recommendedGenres: string;
    mapEyebrow: string;
    mapTitle: string;
    feedEyebrow: string;
    feedTitle: string;
    timelineEyebrow: string;
    timelineTitle: string;
    posterEyebrow: string;
    posterTitle: string;
    posterAlt: string;
    posterFullscreenAria: string;
  };
  poster: {
    yourMusicMap: string;
    ariaLabel: string;
    lifePhaseRoadmap: string;
    narrativeChapters: string;
    emotionalTimeline: string;
    waveformAria: string;
    theEightTracks: string;
    coreDuality: string;
    lifeFeedGrowing: string;
    downloadPoster: string;
    footerQuote1: string;
    footerQuote2: string;
    themeLabel: string;
    /** Localized titles for deterministic chapter ids (chapter-i..vi). */
    phaseTitles: Record<string, string>;
    /** Localized age-range labels for deterministic chapter ids. */
    phaseAgeRanges: Record<string, string>;
    /** Canvas export labels (map title, sections, tree branches, journey nodes). */
    canvas: {
      mapTitle: string;
      mapSubtitle: string;
      emotionalJourney: string;
      lifePlaylist: string;
      treeBranches: string[];
      journeyNodes: string[];
      moreOnMap: string;
      lifeCards: string;
    };
  };
};

const en: Dictionary = {
  nav: {
    features: "Features",
    about: "About",
    switchLanguage: "Change language",
  },
  journey: {
    questionLabel: "Question",
    next: "Next",
    seeResults: "See Your Results",
    startNewJourney: "Start New Journey",
    chooseSongHint: "Choose a song before moving on.",
    missingAnswers: (list) =>
      `Still missing an answer for question${list.includes(",") ? "s" : ""} ${list}.`,
  },
  questionCard: {
    placeholder: "e.g. Bad - Michael Jackson",
    inputAria: "Type a song and artist name",
    suggestionsAria: "Song suggestions",
    addToRitual: "Add to Ritual",
    recognizedAria: "recognized",
  },
  quizCard: {
    intensityLabel: "Intensity",
    playPreviewAria: "Play preview",
    mutePreviewAria: "Mute preview",
    previewUnavailableAria: "Preview unavailable",
  },
  results: {
    yourSoundmap: "Your SoundMap",
    heroAccent: "Eight songs.",
    heroTagline: "One life, in sound.",
    heroSub: "Everything below was shaped by the answers you just gave.",
    lifeStoryEyebrow: "Chapter one",
    lifeStoryTitle: "Life Story",
    lifeStoryLocked: "Complete your journey to unlock your Life Story.",
    dnaEyebrow: "Your signature",
    dnaTitle: "Music DNA",
    favoriteEmotions: "Favorite emotions",
    musicStyle: "Music style",
    recommendedGenres: "Recommended genres",
    mapEyebrow: "Your living map",
    mapTitle: "Dynamic Music Map",
    feedEyebrow: "Beyond the eighth song",
    feedTitle: "Life Feed",
    timelineEyebrow: "In order",
    timelineTitle: "Emotional Timeline",
    posterEyebrow: "Framed",
    posterTitle: "Cinematic Poster",
    posterAlt: "Placeholder cinematic poster of your personal SoundMap",
    posterFullscreenAria: "View poster fullscreen",
  },
  poster: {
    yourMusicMap: "Your Music Map",
    ariaLabel: "Dynamic Music Map poster",
    lifePhaseRoadmap: "Life Phase Roadmap",
    narrativeChapters: "Narrative Chapters",
    emotionalTimeline: "Emotional Frequency Timeline",
    waveformAria: "Emotional intensity waveform",
    theEightTracks: "The Eight Tracks",
    coreDuality: "Core Duality",
    lifeFeedGrowing: "Life Feed — the map keeps growing",
    downloadPoster: "Download Poster (PNG / High-Res)",
    footerQuote1: "First I tried to understand... And in the end, I allowed myself to feel.",
    footerQuote2: "Music changes. We change. But it always stays with us.",
    themeLabel: "Theme:",
    phaseTitles: {
      "chapter-i": "DISCOVERY & WONDER",
      "chapter-ii": "MENTAL AWAKENING",
      "chapter-iii": "STRENGTH & TRIUMPH",
      "chapter-iv": "THRESHOLD PORTALS",
      "chapter-v": "PURE ENERGY & JOY",
      "chapter-vi": "IDENTITY & SYNTHESIS",
    },
    phaseAgeRanges: {
      "chapter-i": "Ages 9-12",
      "chapter-ii": "Ages 12-18",
      "chapter-iii": "Ages 18-24",
      "chapter-iv": "Ages 24-30",
      "chapter-v": "Ages 30-35",
      "chapter-vi": "Ages 35+",
    },
    canvas: {
      mapTitle: "MUSIC MAP",
      mapSubtitle: "SOUNDTRACK OF A LIFE",
      emotionalJourney: "EMOTIONAL JOURNEY",
      lifePlaylist: "MY LIFE PLAYLIST",
      treeBranches: ["MIND", "POWER", "DARKNESS", "ACCEPTANCE"],
      journeyNodes: [
        "Discovery",
        "Rebellion",
        "Inquiry",
        "Darkness",
        "Triumph",
        "Longing",
        "Portal",
        "Depth",
      ],
      moreOnMap: "more on your living map",
      lifeCards: "LIFE CARDS",
    },
  },
};

const tr: Dictionary = {
  nav: {
    features: "Özellikler",
    about: "Hakkında",
    switchLanguage: "Dili değiştir",
  },
  journey: {
    questionLabel: "Soru",
    next: "İleri",
    seeResults: "Sonuçlarını Gör",
    startNewJourney: "Yeni Yolculuğa Başla",
    chooseSongHint: "Devam etmeden önce bir şarkı seç.",
    missingAnswers: (list) => `${list}. soru için hâlâ bir cevap eksik.`,
  },
  questionCard: {
    placeholder: "örn. Bad - Michael Jackson",
    inputAria: "Şarkı ve sanatçı adını yaz",
    suggestionsAria: "Şarkı önerileri",
    addToRitual: "Ritüele Ekle",
    recognizedAria: "tanındı",
  },
  quizCard: {
    intensityLabel: "Yoğunluk",
    playPreviewAria: "Önizlemeyi çal",
    mutePreviewAria: "Önizlemeyi sustur",
    previewUnavailableAria: "Önizleme yok",
  },
  results: {
    yourSoundmap: "SoundMap'in",
    heroAccent: "Sekiz şarkı.",
    heroTagline: "Seslerle anlatılan bir hayat.",
    heroSub: "Aşağıdaki her şey az önce verdiğin cevaplarla şekillendi.",
    lifeStoryEyebrow: "Birinci bölüm",
    lifeStoryTitle: "Hayat Hikâyesi",
    lifeStoryLocked: "Hayat Hikâyeni açmak için yolculuğunu tamamla.",
    dnaEyebrow: "İmzan",
    dnaTitle: "Müzik DNA'sı",
    favoriteEmotions: "Favori duygular",
    musicStyle: "Müzik tarzı",
    recommendedGenres: "Önerilen türler",
    mapEyebrow: "Yaşayan haritan",
    mapTitle: "Dinamik Müzik Haritası",
    feedEyebrow: "Sekizinci şarkının ötesi",
    feedTitle: "Life Feed",
    timelineEyebrow: "Sırasıyla",
    timelineTitle: "Duygusal Zaman Çizelgesi",
    posterEyebrow: "Çerçeveli",
    posterTitle: "Sinematik Poster",
    posterAlt: "Kişisel SoundMap'inin sinematik poster örneği",
    posterFullscreenAria: "Posteri tam ekran görüntüle",
  },
  poster: {
    yourMusicMap: "Müzik Haritan",
    ariaLabel: "Dinamik Müzik Haritası posteri",
    lifePhaseRoadmap: "Yaşam Evresi Yol Haritası",
    narrativeChapters: "Hikâye Bölümleri",
    emotionalTimeline: "Duygusal Frekans Zaman Çizelgesi",
    waveformAria: "Duygusal yoğunluk dalga formu",
    theEightTracks: "Sekiz Parça",
    coreDuality: "Öz İkilik",
    lifeFeedGrowing: "Life Feed — harita büyümeye devam ediyor",
    downloadPoster: "Posteri İndir (PNG / Yüksek Çözünürlük)",
    footerQuote1: "Önce anlamaya çalıştım... Sonunda ise kendimi hissetmeye bıraktım.",
    footerQuote2: "Müzik değişir. Biz değişiriz. Ama o hep bizimle kalır.",
    themeLabel: "Tema:",
    phaseTitles: {
      "chapter-i": "KEŞİF & BÜYÜLENME",
      "chapter-ii": "ZİHİNSEL UYANIŞ",
      "chapter-iii": "GÜÇ & AYAĞA KALKIŞ",
      "chapter-iv": "GEÇİŞ PORTALLARI",
      "chapter-v": "SAF ENERJİ & KEYİF",
      "chapter-vi": "SON NOKTA: KİMLİK",
    },
    phaseAgeRanges: {
      "chapter-i": "9–12 Yaş",
      "chapter-ii": "12–18 Yaş",
      "chapter-iii": "18–24 Yaş",
      "chapter-iv": "24–30 Yaş",
      "chapter-v": "30–35 Yaş",
      "chapter-vi": "35+ Yaş",
    },
    canvas: {
      mapTitle: "MÜZİK HARİTASI",
      mapSubtitle: "BİR HAYATIN SOUNDTRACK'İ",
      emotionalJourney: "DUYGUSAL YOLCULUK",
      lifePlaylist: "HAYAT PLAYLIST'İM",
      treeBranches: ["ZİHİN", "GÜÇ", "KARANLIK", "KABULLENİŞ"],
      journeyNodes: [
        "Keşif",
        "İsyan",
        "Sorgulama",
        "Karanlık",
        "Zafer",
        "Özlem",
        "Portal",
        "Derinlik",
      ],
      moreOnMap: "daha fazlası yaşayan haritanızda",
      lifeCards: "HAYAT KARTLARI",
    },
  },
};

const es: Dictionary = {
  nav: {
    features: "Funciones",
    about: "Acerca de",
    switchLanguage: "Cambiar idioma",
  },
  journey: {
    questionLabel: "Pregunta",
    next: "Siguiente",
    seeResults: "Ver tus resultados",
    startNewJourney: "Comenzar un nuevo viaje",
    chooseSongHint: "Elige una canción antes de continuar.",
    missingAnswers: (list) => `Aún falta una respuesta para la(s) pregunta(s) ${list}.`,
  },
  questionCard: {
    placeholder: "p. ej. Bad - Michael Jackson",
    inputAria: "Escribe una canción y un artista",
    suggestionsAria: "Sugerencias de canciones",
    addToRitual: "Añadir al ritual",
    recognizedAria: "reconocida",
  },
  quizCard: {
    intensityLabel: "Intensidad",
    playPreviewAria: "Reproducir vista previa",
    mutePreviewAria: "Silenciar vista previa",
    previewUnavailableAria: "Vista previa no disponible",
  },
  results: {
    yourSoundmap: "Tu SoundMap",
    heroAccent: "Ocho canciones.",
    heroTagline: "Una vida, en sonido.",
    heroSub: "Todo lo que sigue fue moldeado por las respuestas que acabas de dar.",
    lifeStoryEyebrow: "Capítulo uno",
    lifeStoryTitle: "Historia de vida",
    lifeStoryLocked: "Completa tu viaje para desbloquear tu Historia de vida.",
    dnaEyebrow: "Tu firma",
    dnaTitle: "ADN musical",
    favoriteEmotions: "Emociones favoritas",
    musicStyle: "Estilo musical",
    recommendedGenres: "Géneros recomendados",
    mapEyebrow: "Tu mapa vivo",
    mapTitle: "Mapa Musical Dinámico",
    feedEyebrow: "Más allá de la octava canción",
    feedTitle: "Life Feed",
    timelineEyebrow: "En orden",
    timelineTitle: "Cronología emocional",
    posterEyebrow: "Enmarcado",
    posterTitle: "Póster cinematográfico",
    posterAlt: "Póster cinematográfico de ejemplo de tu SoundMap personal",
    posterFullscreenAria: "Ver póster en pantalla completa",
  },
  poster: {
    yourMusicMap: "Tu Mapa Musical",
    ariaLabel: "Póster del Mapa Musical Dinámico",
    lifePhaseRoadmap: "Hoja de ruta de las fases de la vida",
    narrativeChapters: "Capítulos narrativos",
    emotionalTimeline: "Línea de frecuencia emocional",
    waveformAria: "Onda de intensidad emocional",
    theEightTracks: "Las ocho pistas",
    coreDuality: "Dualidad central",
    lifeFeedGrowing: "Life Feed — el mapa sigue creciendo",
    downloadPoster: "Descargar póster (PNG / Alta resolución)",
    footerQuote1: "Primero intenté comprender... Y al final, me permití sentir.",
    footerQuote2: "La música cambia. Nosotros cambiamos. Pero siempre permanece con nosotros.",
    themeLabel: "Tema:",
    phaseTitles: {
      "chapter-i": "DESCUBRIMIENTO & ASOMBRO",
      "chapter-ii": "DESPERTAR MENTAL",
      "chapter-iii": "FUERZA & TRIUNFO",
      "chapter-iv": "PORTALES DE PASO",
      "chapter-v": "ENERGÍA PURA & ALEGRÍA",
      "chapter-vi": "IDENTIDAD & SÍNTESIS",
    },
    phaseAgeRanges: {
      "chapter-i": "9–12 años",
      "chapter-ii": "12–18 años",
      "chapter-iii": "18–24 años",
      "chapter-iv": "24–30 años",
      "chapter-v": "30–35 años",
      "chapter-vi": "35+ años",
    },
    canvas: {
      mapTitle: "MAPA MUSICAL",
      mapSubtitle: "LA BANDA SONORA DE UNA VIDA",
      emotionalJourney: "VIAJE EMOCIONAL",
      lifePlaylist: "MI PLAYLIST DE VIDA",
      treeBranches: ["MENTE", "PODER", "OSCURIDAD", "ACEPTACIÓN"],
      journeyNodes: [
        "Descubrimiento",
        "Rebelión",
        "Indagación",
        "Oscuridad",
        "Triunfo",
        "Añoranza",
        "Portal",
        "Profundidad",
      ],
      moreOnMap: "más en tu mapa vivo",
      lifeCards: "TARJETAS DE VIDA",
    },
  },
};

const de: Dictionary = {
  nav: {
    features: "Funktionen",
    about: "Über uns",
    switchLanguage: "Sprache ändern",
  },
  journey: {
    questionLabel: "Frage",
    next: "Weiter",
    seeResults: "Ergebnisse ansehen",
    startNewJourney: "Neue Reise starten",
    chooseSongHint: "Wähle einen Song, bevor du weitermachst.",
    missingAnswers: (list) => `Es fehlt noch eine Antwort für Frage ${list}.`,
  },
  questionCard: {
    placeholder: "z. B. Bad - Michael Jackson",
    inputAria: "Gib einen Song- und Künstlernamen ein",
    suggestionsAria: "Song-Vorschläge",
    addToRitual: "Zum Ritual hinzufügen",
    recognizedAria: "erkannt",
  },
  quizCard: {
    intensityLabel: "Intensität",
    playPreviewAria: "Vorschau abspielen",
    mutePreviewAria: "Vorschau stummschalten",
    previewUnavailableAria: "Vorschau nicht verfügbar",
  },
  results: {
    yourSoundmap: "Deine SoundMap",
    heroAccent: "Acht Songs.",
    heroTagline: "Ein Leben, in Klang.",
    heroSub: "Alles Folgende wurde von den Antworten geformt, die du gerade gegeben hast.",
    lifeStoryEyebrow: "Kapitel eins",
    lifeStoryTitle: "Lebensgeschichte",
    lifeStoryLocked: "Schließe deine Reise ab, um deine Lebensgeschichte freizuschalten.",
    dnaEyebrow: "Deine Signatur",
    dnaTitle: "Musik-DNA",
    favoriteEmotions: "Lieblingsemotionen",
    musicStyle: "Musikstil",
    recommendedGenres: "Empfohlene Genres",
    mapEyebrow: "Deine lebendige Karte",
    mapTitle: "Dynamische Musikkarte",
    feedEyebrow: "Jenseits des achten Songs",
    feedTitle: "Life Feed",
    timelineEyebrow: "Der Reihe nach",
    timelineTitle: "Emotionale Zeitachse",
    posterEyebrow: "Gerahmt",
    posterTitle: "Filmisches Poster",
    posterAlt: "Platzhalter für das filmische Poster deiner persönlichen SoundMap",
    posterFullscreenAria: "Poster im Vollbild ansehen",
  },
  poster: {
    yourMusicMap: "Deine Musikkarte",
    ariaLabel: "Poster der dynamischen Musikkarte",
    lifePhaseRoadmap: "Lebensphasen-Roadmap",
    narrativeChapters: "Narrative Kapitel",
    emotionalTimeline: "Emotionale Frequenz-Timeline",
    waveformAria: "Wellenform der emotionalen Intensität",
    theEightTracks: "Die acht Tracks",
    coreDuality: "Kerndualität",
    lifeFeedGrowing: "Life Feed — die Karte wächst weiter",
    downloadPoster: "Poster herunterladen (PNG / Hohe Auflösung)",
    footerQuote1: "Zuerst versuchte ich zu verstehen... Und am Ende erlaubte ich mir zu fühlen.",
    footerQuote2: "Musik verändert sich. Wir verändern uns. Aber sie bleibt immer bei uns.",
    themeLabel: "Thema:",
    phaseTitles: {
      "chapter-i": "ENTDECKUNG & STAUNEN",
      "chapter-ii": "GEISTIGES ERWACHEN",
      "chapter-iii": "STÄRKE & TRIUMPH",
      "chapter-iv": "SCHWELLENPORTALE",
      "chapter-v": "REINE ENERGIE & FREUDE",
      "chapter-vi": "IDENTITÄT & SYNTHESE",
    },
    phaseAgeRanges: {
      "chapter-i": "9–12 Jahre",
      "chapter-ii": "12–18 Jahre",
      "chapter-iii": "18–24 Jahre",
      "chapter-iv": "24–30 Jahre",
      "chapter-v": "30–35 Jahre",
      "chapter-vi": "35+ Jahre",
    },
    canvas: {
      mapTitle: "MUSIKKARTE",
      mapSubtitle: "DER SOUNDTRACK EINES LEBENS",
      emotionalJourney: "EMOTIONALE REISE",
      lifePlaylist: "MEINE LEBENS-PLAYLIST",
      treeBranches: ["GEIST", "KRAFT", "DUNKELHEIT", "ANNAHME"],
      journeyNodes: [
        "Entdeckung",
        "Rebellion",
        "Hinterfragung",
        "Dunkelheit",
        "Triumph",
        "Sehnsucht",
        "Portal",
        "Tiefe",
      ],
      moreOnMap: "mehr auf deiner lebendigen Karte",
      lifeCards: "LEBENSKARTEN",
    },
  },
};

const fr: Dictionary = {
  nav: {
    features: "Fonctionnalités",
    about: "À propos",
    switchLanguage: "Changer de langue",
  },
  journey: {
    questionLabel: "Question",
    next: "Suivant",
    seeResults: "Voir tes résultats",
    startNewJourney: "Commencer un nouveau voyage",
    chooseSongHint: "Choisis une chanson avant de continuer.",
    missingAnswers: (list) => `Il manque encore une réponse pour la question ${list}.`,
  },
  questionCard: {
    placeholder: "p. ex. Bad - Michael Jackson",
    inputAria: "Écris une chanson et un artiste",
    suggestionsAria: "Suggestions de chansons",
    addToRitual: "Ajouter au rituel",
    recognizedAria: "reconnue",
  },
  quizCard: {
    intensityLabel: "Intensité",
    playPreviewAria: "Lire l'extrait",
    mutePreviewAria: "Couper le son de l'extrait",
    previewUnavailableAria: "Extrait indisponible",
  },
  results: {
    yourSoundmap: "Ta SoundMap",
    heroAccent: "Huit chansons.",
    heroTagline: "Une vie, en sons.",
    heroSub: "Tout ce qui suit a été façonné par les réponses que tu viens de donner.",
    lifeStoryEyebrow: "Chapitre un",
    lifeStoryTitle: "Histoire de vie",
    lifeStoryLocked: "Termine ton voyage pour débloquer ton Histoire de vie.",
    dnaEyebrow: "Ta signature",
    dnaTitle: "ADN musical",
    favoriteEmotions: "Émotions favorites",
    musicStyle: "Style musical",
    recommendedGenres: "Genres recommandés",
    mapEyebrow: "Ta carte vivante",
    mapTitle: "Carte Musicale Dynamique",
    feedEyebrow: "Au-delà de la huitième chanson",
    feedTitle: "Life Feed",
    timelineEyebrow: "Dans l'ordre",
    timelineTitle: "Chronologie émotionnelle",
    posterEyebrow: "Encadré",
    posterTitle: "Affiche cinématique",
    posterAlt: "Affiche cinématique d'exemple de ta SoundMap personnelle",
    posterFullscreenAria: "Voir l'affiche en plein écran",
  },
  poster: {
    yourMusicMap: "Ta Carte Musicale",
    ariaLabel: "Affiche de la Carte Musicale Dynamique",
    lifePhaseRoadmap: "Feuille de route des phases de la vie",
    narrativeChapters: "Chapitres narratifs",
    emotionalTimeline: "Chronologie des fréquences émotionnelles",
    waveformAria: "Forme d'onde de l'intensité émotionnelle",
    theEightTracks: "Les huit titres",
    coreDuality: "Dualité fondamentale",
    lifeFeedGrowing: "Life Feed — la carte continue de grandir",
    downloadPoster: "Télécharger l'affiche (PNG / Haute résolution)",
    footerQuote1:
      "D'abord j'ai essayé de comprendre... Et à la fin, je me suis autorisé à ressentir.",
    footerQuote2: "La musique change. Nous changeons. Mais elle reste toujours avec nous.",
    themeLabel: "Thème :",
    phaseTitles: {
      "chapter-i": "DÉCOUVERTE & ÉMERVEILLEMENT",
      "chapter-ii": "ÉVEIL MENTAL",
      "chapter-iii": "FORCE & TRIOMPHE",
      "chapter-iv": "PORTAILS DE PASSAGE",
      "chapter-v": "ÉNERGIE PURE & JOIE",
      "chapter-vi": "IDENTITÉ & SYNTHÈSE",
    },
    phaseAgeRanges: {
      "chapter-i": "9–12 ans",
      "chapter-ii": "12–18 ans",
      "chapter-iii": "18–24 ans",
      "chapter-iv": "24–30 ans",
      "chapter-v": "30–35 ans",
      "chapter-vi": "35+ ans",
    },
    canvas: {
      mapTitle: "CARTE MUSICALE",
      mapSubtitle: "LA BANDE-SON D'UNE VIE",
      emotionalJourney: "VOYAGE ÉMOTIONNEL",
      lifePlaylist: "MA PLAYLIST DE VIE",
      treeBranches: ["ESPRIT", "FORCE", "TÉNÈBRES", "ACCEPTATION"],
      journeyNodes: [
        "Découverte",
        "Rébellion",
        "Questionnement",
        "Ténèbres",
        "Triomphe",
        "Nostalgie",
        "Portail",
        "Profondeur",
      ],
      moreOnMap: "de plus sur votre carte vivante",
      lifeCards: "CARTES DE VIE",
    },
  },
};

export const dictionaries: Record<Language, Dictionary> = { en, tr, es, de, fr };
