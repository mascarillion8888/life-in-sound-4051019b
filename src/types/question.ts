export interface Question {
  id: number;
  title: string;
  /** Age band shown atop the card (e.g. "9 YAŞ"). */
  label?: string;
  /** Era theme key ("80s", "90s", "2000s"). */
  era?: string;
  /** Life-stage / mood band (e.g. "KEŞİF & BÜYÜLENME"). */
  lifeStage?: string;
  /** Subtitle / period label (e.g. "İLK KIVILCIM"). */
  subtitle?: string;
  /** Life context descriptor (e.g. "Efsanevi Hayat Dönemi – Çocukluk"). */
  lifeContext?: string;
  /** Long descriptive text shown on the card. */
  description: string;
  /** Question prompt asked to the user. */
  prompt: string;
}