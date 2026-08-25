export type SpeakingRate = "slow" | "natural" | "fast";

export interface DurationBudget {
  targetWords: number;
  acceptableWordRange: { min: number; max: number };
  wpm: number;
  pauseBudget: number;
  spokenSeconds: number;
}

const WPM: Record<SpeakingRate, number> = { slow: 145, natural: 155, fast: 165 };
const MARKERS = /\[(?:PAUSA[^\]]*|RESPIRO|CAMBIO SCENA|ENFASI|PIÙ VELOCE|PIÙ LENTO|TONO BASSO|TONO ALTO)\]/gi;

export function countSpokenWords(text: string) {
  return (text.replace(MARKERS, " ").match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu) ?? []).length;
}

export function estimateSpeechDuration(text: string, language = "it", speakingRate: SpeakingRate = "natural") {
  const words = countSpokenWords(text);
  const localeAdjustment = language.toLowerCase().startsWith("it") ? 1 : 0.96;
  const pauses = [...text.matchAll(/\[PAUSA\s*([\d.,]+)?s?\]/gi)].reduce((total, match) => total + Number((match[1] ?? "0.4").replace(",", ".")), 0);
  const breaths = (text.match(/\[RESPIRO\]/gi) ?? []).length * 0.3;
  return (words / (WPM[speakingRate] * localeAdjustment)) * 60 + pauses + breaths;
}

export function calculateTargetWordCount(duration: number, speakingRate: SpeakingRate = "natural", pauseBudget = 0) {
  const spokenSeconds = Math.max(1, duration - pauseBudget);
  return Math.round((spokenSeconds / 60) * WPM[speakingRate]);
}

export function createDurationBudget(duration: number, speakingRate: SpeakingRate = "natural", contentType = "explainer"): DurationBudget {
  const pauseRatio = contentType === "news" || contentType === "ranking" ? 0.06 : contentType === "storytelling" ? 0.12 : 0.09;
  const pauseBudget = Math.round(duration * pauseRatio * 10) / 10;
  const targetWords = calculateTargetWordCount(duration, speakingRate, pauseBudget);
  const variance = Math.max(4, Math.round(targetWords * 0.1));
  return { targetWords, acceptableWordRange: { min: targetWords - variance, max: targetWords + variance }, wpm: WPM[speakingRate], pauseBudget, spokenSeconds: duration - pauseBudget };
}

export function validateScriptDuration(script: string, targetDuration: number, language = "it", speakingRate: SpeakingRate = "natural") {
  const estimatedDuration = Number(estimateSpeechDuration(script, language, speakingRate).toFixed(1));
  const deviationPercent = Number((((estimatedDuration - targetDuration) / targetDuration) * 100).toFixed(1));
  return { estimatedDuration, deviationPercent, status: Math.abs(deviationPercent) <= 10 ? "within-target" : estimatedDuration > targetDuration ? "too-long" : "too-short" } as const;
}
