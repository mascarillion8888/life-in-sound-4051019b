import { Music, Headphones, Play } from "lucide-react";

import { getEraTheme } from "@/lib/era-themes";
import type { Question } from "@/types/question";
import type { Song } from "@/lib/song/types";

interface QuizCardProps {
  question: Question;
  song: Song | null;
  onSelect: (song: Song) => void;
  onNext: () => void;
  isActive: boolean;
  currentIndex: number;
  totalQuestions: number;
}

export function QuizCard({
  question,
  song,
  onSelect,
  onNext,
  isActive,
  currentIndex,
  totalQuestions,
}: QuizCardProps) {
  const eraTheme = getEraTheme(question.era);

  if (!isActive) return null;

  return (
    <div
      className={`
        relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden
        bg-gradient-to-br ${eraTheme.bg}
        shadow-2xl ${eraTheme.shadow}
        border ${eraTheme.accent} border-opacity-30
        transition-all duration-700
      `}
    >
      {/* Arka Plan Artwork (soluk) */}
      {song?.artworkUrl ? (
        <div
          className="absolute inset-0 opacity-10 bg-cover bg-center blur-sm scale-110"
          style={{ backgroundImage: `url(${song.artworkUrl})` }}
        />
      ) : null}

      {/* Overlay */}
      <div className={`absolute inset-0 ${eraTheme.overlay}`} />

      {/* İçerik */}
      <div className="relative z-10 p-8 md:p-12 min-h-[500px] flex flex-col justify-between">
        {/* Üst Bilgi */}
        <div>
          <div className="flex justify-between items-start">
            <div>
              <span className={`text-xs font-mono tracking-widest ${eraTheme.text} opacity-60`}>
                {question.label || "YAŞ"}
              </span>
              <h2 className={`text-4xl md:text-5xl font-bold ${eraTheme.text} mt-1 leading-tight`}>
                {question.lifeStage || question.title}
              </h2>
            </div>
            <span className={`text-sm font-mono ${eraTheme.text} opacity-50`}>
              {currentIndex + 1}/{totalQuestions}
            </span>
          </div>

          <div className="mt-4">
            <h3 className={`text-xl md:text-2xl font-serif italic ${eraTheme.text} opacity-80`}>
              {question.subtitle || question.title}
            </h3>
            <p className={`text-sm font-medium ${eraTheme.text} opacity-60 mt-1`}>
              {question.lifeContext || question.title}
            </p>
          </div>
        </div>

        {/* Orta Bölüm - Şarkı Bilgisi */}
        <div className="flex-1 flex items-center justify-center my-8">
          {song ? (
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Music className={`${eraTheme.text} opacity-80`} />
                <span className={`text-2xl md:text-3xl font-bold ${eraTheme.text}`}>
                  {song.title}
                </span>
              </div>
              <p className={`text-lg ${eraTheme.text} opacity-70`}>
                {song.artist} {song.releaseYear ? `(${song.releaseYear})` : ""}
              </p>
              {song.genre ? (
                <span className={`inline-block mt-2 px-3 py-1 text-xs font-mono rounded-full border ${eraTheme.accent} ${eraTheme.text} opacity-60`}>
                  {song.genre}
                </span>
              ) : null}
              {/* Preview butonu */}
              {song.previewUrl ? (
                <button
                  type="button"
                  onClick={() => void new Audio(song.previewUrl!).play()}
                  className={`mt-4 p-3 rounded-full ${eraTheme.accent} bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all`}
                  aria-label="Play preview"
                >
                  <Play className={eraTheme.text} />
                </button>
              ) : null}
            </div>
          ) : (
            <div className="text-center">
              <Headphones className={`${eraTheme.text} opacity-30 text-6xl`} />
              <p className={`${eraTheme.text} opacity-50 mt-3`}>Bir şarkı seç</p>
            </div>
          )}
        </div>

        {/* Alt Bölüm */}
        <div>
          <p className={`text-sm ${eraTheme.text} opacity-60 italic leading-relaxed`}>
            {question.description}
          </p>

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
            <span className={`text-xs ${eraTheme.text} opacity-30 font-mono`}>
              TM & © 2026 LifeInSound | Illus. R. Swanland
            </span>
            {song ? (
              <button
                type="button"
                onClick={onNext}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all
                  bg-white/10 backdrop-blur-sm hover:bg-white/20
                  ${eraTheme.text} border ${eraTheme.accent} border-opacity-30
                `}
              >
                Next Era →
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}