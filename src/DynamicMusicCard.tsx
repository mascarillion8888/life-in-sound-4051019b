import React from 'react';

export type MusicGenre = 'gothic' | 'jazz' | 'pop' | 'newage' | 'classical';

interface DynamicMusicCardProps {
  genre?: MusicGenre;
  ageLabel: string;
  stageTitle: string;
  eraSubtitle: string;
  imageUrl: string;
  narrative: string;
  songTitle: string;
  artistName: string;
  releaseYear: string | number;
  cardNumber: string;
}

export const DynamicMusicCard: React.FC<DynamicMusicCardProps> = ({
  genre = 'gothic',
  ageLabel,
  stageTitle,
  eraSubtitle,
  imageUrl,
  narrative,
  songTitle,
  artistName,
  releaseYear,
  cardNumber
}) => {
  return (
    <div id="exportable-card" className={`card-container genre-${genre}`}>
      {/* Üst Header */}
      <div className="card-header">
        <div className="card-age-row">
          <span>{ageLabel}</span>
          <span>1/100</span>
        </div>
        <div className="card-stage">{stageTitle}</div>
        <div className="card-era">{eraSubtitle}</div>
      </div>

      {/* Albüm Görseli */}
      <div className="card-image-frame">
        <img src={imageUrl} alt={songTitle} crossOrigin="anonymous" />
      </div>

      {/* Hayat Dönemi Şeridi */}
      <div className="card-banner">
        <span>Hayat Dönemi</span>
        <span className="card-symbol">❖</span>
      </div>

      {/* Gemini Metni */}
      <div className="card-narrative">
        "{narrative}"
      </div>

      {/* Künye & Rozet */}
      <div className="card-footer">
        <div className="card-meta">
          🎵 {artistName} — {songTitle} ({releaseYear})
        </div>
        <div className="card-badge">
          <div>{cardNumber}</div>
          <div className="badge-sub">KEŞİF</div>
        </div>
      </div>

      <div className="card-watermark">
        TM & © 2026 LifeinSound | Master Collection
      </div>
    </div>
  );
};