import React from 'react';

interface SoundtrackCardProps {
  ageTitle: string;
  subTitle: string;
  keyWord: string;
  cardNumber: string;
  artworkUrl: string;
  eraBadge: string;
  storyText: string;
  artistName: string;
  trackName: string;
  releaseYear: string;
  genre: string;
  score: string;
  scoreLabel: string;
}

export const SoundtrackCard: React.FC<SoundtrackCardProps> = ({
  ageTitle,
  subTitle,
  keyWord,
  cardNumber,
  artworkUrl,
  eraBadge,
  storyText,
  artistName,
  trackName,
  releaseYear,
  genre,
  score,
  scoreLabel
}) => {
  return (
    <div className="w-full max-w-sm aspect-[3/4] bg-neutral-950 border-4 border-amber-700/80 rounded-2xl p-4 shadow-2xl flex flex-col justify-between relative overflow-hidden font-serif">
      <div className="text-center border-b border-amber-700/50 pb-2 relative">
        <span className="absolute right-0 top-0 text-xs mono text-amber-600/80">{cardNumber}</span>
        <h1 className="text-2xl font-bold tracking-wide text-amber-100">{ageTitle}</h1>
        <p className="text-xs uppercase tracking-widest text-amber-500/90">{subTitle}</p>
        <div className="mt-1 inline-block bg-amber-950/80 border border-amber-600/60 rounded px-3 py-0.5 text-xs text-amber-300 font-semibold">
          {keyWord}
        </div>
      </div>

      <div className="relative w-full aspect-square my-2 border-2 border-amber-800/60 rounded-lg overflow-hidden bg-black">
        <img src={artworkUrl} alt={trackName} className="w-full h-full object-cover" />
      </div>

      <div className="space-y-2 bg-neutral-900/90 p-3 rounded-lg border border-amber-800/40">
        <div className="text-xs font-semibold text-amber-400 border-b border-neutral-800 pb-1">
          {eraBadge}
        </div>
        <p className="text-xs text-neutral-300 italic leading-relaxed">
          {storyText}
        </p>
        <div className="flex items-center justify-between pt-1 border-t border-neutral-800">
          <p className="text-xs font-bold text-amber-200">
            ♫ {artistName} &mdash; {trackName} ({releaseYear}) [{genre}]
          </p>
          <div className="text-center bg-amber-950 px-2 py-1 border border-amber-600/60 rounded-md">
            <span className="block text-xs font-bold text-amber-400">{score}</span>
            <span className="block text-[8px] text-amber-600 uppercase tracking-wider">{scoreLabel}</span>
          </div>
        </div>
      </div>

      <div className="text-center text-[8px] text-neutral-600 mono mt-1">
        TM &amp; &copy; 2026 LifeInSound | Illus. R. Swanland
      </div>
    </div>
  );
};
