import React from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface AIPersonalityCardProps {
  personality: string;
  emotions?: string[]; // e.g. ["joy", "curiosity"]
  archetype?: string;
  dominantColor?: string; // any valid CSS color, used for subtle accent
  quote?: string;
}

const containerVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  hover: { scale: 1.02, transition: { type: "spring", stiffness: 300, damping: 18 } },
};

export default function AIPersonalityCard({
  personality,
  emotions = [],
  archetype,
  dominantColor = "rgba(255,255,255,0.06)",
  quote,
}: AIPersonalityCardProps) {
  // Inline style for gradient border color based on dominantColor for subtle customization
  const accent = dominantColor;

  return (
    <motion.div
      className="relative p-1 rounded-2xl"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
    >
      {/* Animated gradient border using an absolutely positioned element */}
      <div
        aria-hidden
        className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-pink-500 via-indigo-500 to-cyan-400 blur-[6px] opacity-90 animate-gradientShift"
        style={{
          zIndex: 0,
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          padding: "1px",
        }}
      />

      {/* Glassmorphism card body */}
      <Card className="relative overflow-hidden rounded-2xl backdrop-blur-md bg-white/6 border border-white/6 shadow-lg">
        <CardHeader className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-white text-lg md:text-xl font-semibold">
                {personality}
              </CardTitle>
              {archetype && (
                <CardDescription className="text-sm text-white/70 mt-1">
                  {archetype}
                </CardDescription>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full ring-2 ring-white/20 shadow-inner"
                style={{ background: accent }}
                aria-hidden
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0">
          <motion.blockquote
            className="text-white/90 text-sm md:text-base italic leading-relaxed mb-4"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            {quote || "A nuanced reflection of an AI-driven personality."}
          </motion.blockquote>

          <div className="flex flex-wrap gap-2 items-center">
            {emotions.length > 0 ? (
              emotions.map((e) => (
                <motion.span
                  key={e}
                  className="px-3 py-1 rounded-full text-xs font-medium text-white/90 bg-white/6 border border-white/6"
                  whileHover={{ scale: 1.05 }}
                >
                  {e}
                </motion.span>
              ))
            ) : (
              <span className="text-sm text-white/60">No emotions provided</span>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-white/60">Dominant color</div>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full ring-1 ring-white/10"
                style={{ background: accent }}
                aria-hidden
              />
              <div className="text-sm text-white/80">{dominantColor}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoped styles injected to provide animated gradient shift and ensure responsive glass look */}
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradientShift {
          background-size: 400% 400%;
          animation: gradientShift 6s ease infinite;
        }

        /* Make sure the blur doesn't overflow on small devices */
        @media (max-width: 640px) {
          .blur-\[6px\] { filter: blur(4px); }
        }
      `}</style>
    </motion.div>
  );
}
