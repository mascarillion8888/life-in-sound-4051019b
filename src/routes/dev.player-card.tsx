import { createFileRoute } from "@tanstack/react-router";
import { PlayerCard } from "@/components/results/PlayerCard";

export const Route = createFileRoute("/dev/player-card")({
  component: PlayerCardPreview,
});

const SAMPLES = [
  { genre: "Synth-pop", mood: "Euphoric", title: "Miami Nights", artist: "Bryan Ferry", era: "80’ler" },
  { genre: "Metal", mood: "Dark", title: "Fade to Black", artist: "Metallica", era: "80’ler" },
  { genre: "Jazz", mood: "Melancholic", title: "Blue in Green", artist: "Miles Davis", era: "50’ler" },
  { genre: "Hip-Hop", mood: "Energetic", title: "Lose Yourself", artist: "Eminem", era: "2000’ler" },
];

function PlayerCardPreview() {
  return (
    <div style={{ minHeight: "100vh", background: "#0c0618", display: "flex", flexWrap: "wrap", gap: 32, justifyContent: "center", padding: 24 }}>
      {SAMPLES.map((s) => (
        <PlayerCard
          key={s.title}
          genre={s.genre}
          mood={s.mood}
          metaLeft="9 YAŞ · İLK KIVILCIM"
          sequence="22/100"
          title={s.title}
          artist={s.artist}
          lore="Bir çocuk, loş odada kulaklıklarıyla bir şarkı dinliyor. İlk kıvılcım çakıyor, bir dünya açılıyor."
          score={9}
          scoreLabel="KEŞİF"
          eraTitle="DÖNEM"
          eraValue={s.era}
          moodTitle="MOOD"
          moodValue={s.mood.toUpperCase()}
          progress={0.4}
          timeLeft="0:12"
          timeRight="0:30"
          canPlay
          playLabel="ŞARKIYI ÇAL"
          collectLabel="KOLEKSİYONA EKLE"
        />
      ))}
    </div>
  );
}