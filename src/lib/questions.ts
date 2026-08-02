export type Question = {
  id: number;
  title: string;
  description: string;
};

export const questions: Question[] = [
  {
    id: 1,
    title: "What song reminds you of your childhood?",
    description:
      "Think of a track that instantly takes you back to a younger version of yourself — a moment, a feeling, or a place you thought you'd forgotten.",
  },
  {
    id: 2,
    title: "What song defined your teenage years?",
    description:
      "The one that played on repeat while everything felt urgent, uncertain and impossibly important.",
  },
  {
    id: 3,
    title: "What song reminds you of your first love?",
    description:
      "A melody tangled up with someone's name — the beginning, the middle, or the end of it.",
  },
  {
    id: 4,
    title: "What song carried you through a hard time?",
    description:
      "The track you reached for when things fell apart, and that somehow made the weight easier to hold.",
  },
  {
    id: 5,
    title: "What song makes you feel unstoppable?",
    description:
      "Your personal anthem — the one that straightens your back and turns an ordinary day into a scene.",
  },
  {
    id: 6,
    title: "What song reminds you of a person you miss?",
    description:
      "Music has a way of keeping people close. Which song still sounds like them?",
  },
  {
    id: 7,
    title: "What song marks a turning point in your life?",
    description:
      "A move, a goodbye, a beginning — the soundtrack to the moment your story changed direction.",
  },
  {
    id: 8,
    title: "What song do you want to be remembered by?",
    description:
      "If your life had closing credits, this is the track that would play over them.",
  },
];
