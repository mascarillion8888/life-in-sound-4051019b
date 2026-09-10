import { useEffect, useRef } from "react";
import type { PosterModel } from "@/lib/ai/types";
import { renderPoster, type PosterSong } from "@/lib/ai/posterRenderer";

type Props = {
  model: PosterModel;
  songs: PosterSong[];
  alt: string;
  className?: string;
};

/**
 * Renders the personality-driven poster onto a real canvas. Client-only work
 * happens inside the effect, so SSR simply outputs an empty canvas frame.
 */
export function GeneratedPoster({ model, songs, alt, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderPoster(canvas, model, songs);
  }, [model, songs]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={alt}
      className={className ?? "w-full rounded-[1.5rem]"}
    />
  );
}

export default GeneratedPoster;
