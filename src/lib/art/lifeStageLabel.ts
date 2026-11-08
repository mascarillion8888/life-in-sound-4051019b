/**
 * Life-stage chip label for a listener age. Shared by PlayerCard (which derives
 * it from the meta line) and QuizCard (which derives it from the real age), so
 * the thresholds live in exactly one place.
 */
export function stageLabelForAge(age: number): string {
  if (age <= 12) return "Childhood";
  if (age <= 17) return "Teen years";
  if (age <= 24) return "Youth";
  if (age <= 39) return "Young adult";
  if (age <= 59) return "Adulthood";
  return "Later life";
}
