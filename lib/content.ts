export const CONTENT_TYPES = ["auto", "news", "explainer", "review", "comparison", "ranking", "opinion", "tutorial", "storytelling", "case-study", "why", "did-you-know", "dont-buy"] as const;
export const VIDEO_STYLES = ["faceless-voiceover", "screen-recording", "product-focus", "news-fast", "cinematic-tech", "explainer", "list-ranking", "storytelling", "hybrid"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export type VideoStyle = (typeof VIDEO_STYLES)[number];

export interface ContentGenerationInput {
  topic: string; notes?: string; product?: string; duration: number; contentType: ContentType;
  videoStyle: VideoStyle; tone: string; audience?: string; language: string; researchMode: boolean;
  selectedAngle?: string; selectedHook?: string; speakingRate?: "slow" | "natural" | "fast";
}
