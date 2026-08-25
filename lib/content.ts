export const CONTENT_TYPES = [
  "auto", "news", "explainer", "review", "comparison", "ranking", 
  "opinion", "tutorial", "storytelling", "case-study", "why", "did-you-know", "dont-buy"
] as const;

export const VIDEO_STYLES = [
  "faceless-voiceover", "screen-recording", "product-focus", "news-fast", 
  "cinematic-tech", "explainer", "list-ranking", "storytelling", "hybrid"
] as const;

export const CONTENT_PILLARS = [
  "Tech & Gadget",
  "AI & Automazione",
  "Business & Finanza Tech",
  "App & Produttività",
  "Tutorial & How-To",
  "News & Analisi Settore"
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
export type VideoStyle = (typeof VIDEO_STYLES)[number];
export type ContentPillar = (typeof CONTENT_PILLARS)[number];

export type AssetSource =
  | "user-owned"
  | "screen-recording"
  | "screenshot"
  | "stock"
  | "ai-generated"
  | "web-image";

export interface AssetRequirement {
  id: string;
  asset: string;
  importance: "required" | "recommended" | "optional";
  source: AssetSource;
  available: boolean;
  timeEstimateMin: number;
  captureInstructions: string;
  fallback?: string;
}

export interface ProductionTask {
  id: string;
  category: "PRE-PRODUCTION" | "RECORDING" | "ASSETS" | "EDITING" | "FINAL";
  title: string;
  detail: string;
  completed: boolean;
}

export interface VideoAnalytics {
  views: number;
  watchTimeSec: number;
  completionRate: number; // 0 - 100%
  retention3s: number;    // 0 - 100%
  shares: number;
  saves: number;
  comments: number;
}

export interface ContentMemory {
  id: string;
  topic: string;
  pillar: string;
  angle: string;
  hook: string;
  hookType?: string;
  contentType: string;
  duration: number;
  keyTakeaway: string;
  createdAt: string;
  analytics?: VideoAnalytics;
}

export interface CreatorCalibration {
  averageWpm: number;
  hookWpm: number;
  explainerWpm: number;
  revealWpm: number;
  ctaWpm: number;
}

export interface PerformanceLearnings {
  bestHookType: string;
  optimalDurationRange: string;
  topPerformingPillar: string;
  averageCompletionRate: number;
  insights: string[];
}

export interface ContentGenerationInput {
  topic: string;
  notes?: string;
  product?: string;
  duration: number;
  contentType: ContentType;
  videoStyle: VideoStyle;
  pillar?: ContentPillar;
  tone: string;
  audience?: string;
  language: string;
  researchMode: boolean;
  selectedAngle?: string;
  selectedHook?: string;
  speakingRate?: "slow" | "natural" | "fast";
  history?: ContentMemory[];
  calibration?: CreatorCalibration;
  learnings?: PerformanceLearnings;
}

export function calculateReadinessScore(assets: AssetRequirement[], hasApprovedScript: boolean): number {
  if (!hasApprovedScript) return 20;
  if (!assets.length) return 90;

  const weights = { required: 3, recommended: 2, optional: 1 };
  let totalWeight = 0;
  let earnedWeight = 0;

  assets.forEach((a) => {
    const w = weights[a.importance] || 1;
    totalWeight += w;
    if (a.available) earnedWeight += w;
  });

  const assetScore = totalWeight > 0 ? (earnedWeight / totalWeight) * 60 : 60;
  return Math.round(40 + assetScore);
}

export function computePerformanceLearnings(history: ContentMemory[]): PerformanceLearnings {
  const tracked = history.filter((h) => h.analytics && h.analytics.views > 0);
  if (tracked.length === 0) {
    return {
      bestHookType: "direct value",
      optimalDurationRange: "25-35s",
      topPerformingPillar: "Tech & Gadget",
      averageCompletionRate: 0,
      insights: ["Nessun dato analitico disponibile. Inserisci le visualizzazioni e retention dei video pubblicati per abilitare il Creator Learning Engine."]
    };
  }

  // 1. Hook con retention 3s più alta
  const hookStats: Record<string, { totalRet: number; count: number }> = {};
  tracked.forEach((t) => {
    const type = t.hookType || "curiosity";
    if (!hookStats[type]) hookStats[type] = { totalRet: 0, count: 0 };
    hookStats[type].totalRet += t.analytics!.retention3s;
    hookStats[type].count += 1;
  });

  let bestHookType = "direct value";
  let maxHookRet = 0;
  Object.entries(hookStats).forEach(([type, stat]) => {
    const avg = stat.totalRet / stat.count;
    if (avg > maxHookRet) {
      maxHookRet = avg;
      bestHookType = type;
    }
  });

  // 2. Pillar con più completion rate
  const pillarStats: Record<string, { totalComp: number; count: number }> = {};
  tracked.forEach((t) => {
    if (!pillarStats[t.pillar]) pillarStats[t.pillar] = { totalComp: 0, count: 0 };
    pillarStats[t.pillar].totalComp += t.analytics!.completionRate;
    pillarStats[t.pillar].count += 1;
  });

  let topPerformingPillar = "Tech & Gadget";
  let maxPillarComp = 0;
  Object.entries(pillarStats).forEach(([pillar, stat]) => {
    const avg = stat.totalComp / stat.count;
    if (avg > maxPillarComp) {
      maxPillarComp = avg;
      topPerformingPillar = pillar;
    }
  });

  const avgCompletion = Math.round(tracked.reduce((acc, t) => acc + t.analytics!.completionRate, 0) / tracked.length);

  const insights = [
    `Gli hook "${bestHookType}" registrano la retention a 3s più alta (~${Math.round(maxHookRet)}%).`,
    `Il pillar "${topPerformingPillar}" genera il completion rate medio più alto (~${Math.round(maxPillarComp)}%).`,
    `Completion rate medio complessivo del canale: ${avgCompletion}%.`
  ];

  return {
    bestHookType,
    optimalDurationRange: "25-35s",
    topPerformingPillar,
    averageCompletionRate: avgCompletion,
    insights
  };
}

export function auditContentMemory(newTopic: string, selectedPillar: string, history: ContentMemory[]) {
  const warnings: string[] = [];
  const normalizedNew = newTopic.toLowerCase().trim();
  const wordsNew = new Set(normalizedNew.split(/\s+/).filter((w) => w.length > 3));

  let maxSimilarity = 0;

  for (const item of history) {
    const itemWords = item.topic.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const matches = itemWords.filter((w) => wordsNew.has(w)).length;
    const similarity = wordsNew.size > 0 ? matches / Math.max(wordsNew.size, itemWords.length) : 0;

    if (similarity > maxSimilarity) maxSimilarity = similarity;
    if (similarity >= 0.6) {
      warnings.push(`Argomento simile a: "${item.topic}" (Angle: "${item.angle}"). Considera un angle diverso.`);
    }
  }

  const pillarDistribution: Record<string, number> = {};
  CONTENT_PILLARS.forEach((p) => (pillarDistribution[p] = 0));
  history.forEach((h) => {
    if (pillarDistribution[h.pillar] !== undefined) pillarDistribution[h.pillar]++;
  });

  const totalHistory = history.length;
  const currentPillarCount = pillarDistribution[selectedPillar] || 0;
  if (totalHistory >= 3 && currentPillarCount / totalHistory > 0.5) {
    warnings.push(`Stai usando spesso "${selectedPillar}" (${Math.round((currentPillarCount / totalHistory) * 100)}% dei video).`);
  }

  return {
    hasConflict: warnings.length > 0,
    similarityScore: Math.round(maxSimilarity * 100),
    repetitionWarnings: warnings,
    pillarDistribution,
  };
}