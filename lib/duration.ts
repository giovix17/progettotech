import { CreatorCalibration } from "./content";

export type SpeakingRate = "slow" | "natural" | "fast";

export type StoryBeatType =
  | "hook"
  | "context"
  | "problem"
  | "claim"
  | "evidence"
  | "reveal"
  | "comparison"
  | "payoff"
  | "twist"
  | "cta";

export interface StoryBeat {
  id: string;
  type: StoryBeatType;
  objective: string;
  spokenText: string;
  importance: 1 | 2 | 3 | 4 | 5;
  visualPriority: 1 | 2 | 3 | 4 | 5;
  retentionFunction: "curiosity" | "value" | "surprise" | "clarity" | "emotion" | "payoff";
  canCompress: boolean;
  wordCount?: number;
  pauseDurationSec?: number;
  durationSec?: number;
  startTimeSec?: number;
  endTimeSec?: number;
}

export interface DurationBudget {
  targetWords: number;
  acceptableWordRange: { min: number; max: number };
  wpm: number;
  pauseBudget: number;
  spokenSeconds: number;
}

export const BASE_WPM: Record<SpeakingRate, number> = { slow: 145, natural: 155, fast: 165 };

export const BEAT_PACE_MODIFIERS: Record<StoryBeatType, { wpmFactor: number; pauseSec: number }> = {
  hook: { wpmFactor: 1.08, pauseSec: 0.3 },
  reveal: { wpmFactor: 0.88, pauseSec: 0.8 },
  twist: { wpmFactor: 0.90, pauseSec: 0.7 },
  problem: { wpmFactor: 0.95, pauseSec: 0.5 },
  context: { wpmFactor: 1.0, pauseSec: 0.3 },
  claim: { wpmFactor: 1.0, pauseSec: 0.4 },
  evidence: { wpmFactor: 0.96, pauseSec: 0.4 },
  comparison: { wpmFactor: 1.0, pauseSec: 0.4 },
  payoff: { wpmFactor: 0.92, pauseSec: 0.6 },
  cta: { wpmFactor: 1.02, pauseSec: 0.4 },
};

const MARKERS = /\[(?:PAUSA[^\]]*|RESPIRO|CAMBIO SCENA|ENFASI|PIÙ VELOCE|PIÙ LENTO|TONO BASSO|TONO ALTO)\]/gi;

export function countSpokenWords(text: string): number {
  return (text.replace(MARKERS, " ").match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu) ?? []).length;
}

export function createDurationBudget(
  duration: number, 
  speakingRate: SpeakingRate = "natural", 
  contentType = "explainer",
  calibration?: CreatorCalibration
): DurationBudget {
  const pauseRatio = contentType === "news" || contentType === "ranking" ? 0.06 : contentType === "storytelling" ? 0.12 : 0.09;
  const pauseBudget = Math.round(duration * pauseRatio * 10) / 10;
  const spokenSeconds = Math.max(1, duration - pauseBudget);
  const effectiveWpm = calibration ? calibration.averageWpm : BASE_WPM[speakingRate];
  const targetWords = Math.round((spokenSeconds / 60) * effectiveWpm);
  const variance = Math.max(4, Math.round(targetWords * 0.1));

  return {
    targetWords,
    acceptableWordRange: { min: targetWords - variance, max: targetWords + variance },
    wpm: effectiveWpm,
    pauseBudget,
    spokenSeconds,
  };
}

export function computeBeatsTimeline(
  beats: StoryBeat[], 
  speakingRate: SpeakingRate = "natural",
  calibration?: CreatorCalibration
) {
  let currentTime = 0;

  const enrichedBeats = beats.map((beat, index) => {
    const words = countSpokenWords(beat.spokenText);
    const config = BEAT_PACE_MODIFIERS[beat.type] || { wpmFactor: 1.0, pauseSec: 0.4 };
    
    let effectiveWpm = BASE_WPM[speakingRate] * config.wpmFactor;
    if (calibration) {
      if (beat.type === "hook") effectiveWpm = calibration.hookWpm;
      else if (beat.type === "reveal" || beat.type === "twist") effectiveWpm = calibration.revealWpm;
      else if (beat.type === "cta") effectiveWpm = calibration.ctaWpm;
      else effectiveWpm = calibration.explainerWpm;
    }

    const spokenSec = (words / effectiveWpm) * 60;
    const beatDuration = Number((spokenSec + config.pauseSec).toFixed(1));
    const startTimeSec = Number(currentTime.toFixed(1));
    const endTimeSec = Number((startTimeSec + beatDuration).toFixed(1));

    currentTime = endTimeSec;

    return {
      ...beat,
      id: beat.id || `beat-${index + 1}`,
      wordCount: words,
      pauseDurationSec: config.pauseSec,
      durationSec: beatDuration,
      startTimeSec,
      endTimeSec,
    };
  });

  return {
    beats: enrichedBeats,
    totalCalculatedDuration: Number(currentTime.toFixed(1)),
    totalWords: enrichedBeats.reduce((sum, b) => sum + (b.wordCount || 0), 0),
  };
}

export function validateBeatsDuration(totalDuration: number, targetDuration: number) {
  const deviationPercent = Number((((totalDuration - targetDuration) / targetDuration) * 100).toFixed(1));
  const status = Math.abs(deviationPercent) <= 10 ? "within-target" : totalDuration > targetDuration ? "too-long" : "too-short";
  return { estimatedDuration: totalDuration, deviationPercent, status } as const;
}