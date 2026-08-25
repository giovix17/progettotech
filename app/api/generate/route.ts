import { GoogleGenAI, Type } from "@google/genai";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { ContentGenerationInput } from "@/lib/content";
import { countSpokenWords, createDurationBudget, validateScriptDuration } from "@/lib/duration";

const strings = { type: Type.ARRAY, items: { type: Type.STRING } };
const obj = (properties: Record<string, unknown>, required: string[]) => ({ type: Type.OBJECT, properties, required });
const strategySchema = obj({
  topicAnalysis: obj({ audience: { type: Type.STRING }, whyItMatters: { type: Type.STRING }, surpriseFactor: { type: Type.STRING }, risks: strings }, ["audience", "whyItMatters", "surpriseFactor", "risks"]),
  angles: { type: Type.ARRAY, items: obj({ title: { type: Type.STRING }, rationale: { type: Type.STRING }, score: { type: Type.NUMBER } }, ["title", "rationale", "score"]) },
  hooks: { type: Type.ARRAY, items: obj({ text: { type: Type.STRING }, type: { type: Type.STRING }, visual: { type: Type.STRING }, reason: { type: Type.STRING }, score: { type: Type.NUMBER } }, ["text", "type", "visual", "reason", "score"]) },
}, ["topicAnalysis", "angles", "hooks"]);
const resultSchema = obj({
  strategy: obj({ selectedAngle: { type: Type.STRING }, alternativeAngles: { type: Type.ARRAY, items: obj({ title: { type: Type.STRING }, score: { type: Type.NUMBER } }, ["title", "score"]) }, contentScore: { type: Type.NUMBER }, retentionScore: { type: Type.NUMBER }, whyThisCouldWork: strings, whatCouldKillIt: strings }, ["selectedAngle", "alternativeAngles", "contentScore", "retentionScore", "whyThisCouldWork", "whatCouldKillIt"]),
  hooks: { type: Type.ARRAY, items: obj({ text: { type: Type.STRING }, type: { type: Type.STRING }, visual: { type: Type.STRING }, score: { type: Type.NUMBER } }, ["text", "type", "visual", "score"]) },
  script: obj({ clean: { type: Type.STRING }, performance: { type: Type.STRING }, title: { type: Type.STRING } }, ["clean", "performance", "title"]),
  timeline: { type: Type.ARRAY, items: obj({ section: { type: Type.STRING }, spokenText: { type: Type.STRING }, visual: { type: Type.STRING }, camera: { type: Type.STRING }, overlayText: { type: Type.STRING }, subtitleHighlight: { type: Type.STRING }, soundEffect: { type: Type.STRING }, transition: { type: Type.STRING }, editingInstruction: { type: Type.STRING } }, ["section", "spokenText", "visual", "camera", "overlayText", "subtitleHighlight", "soundEffect", "transition", "editingInstruction"]) },
  bRollPlan: { type: Type.ARRAY, items: obj({ shot: { type: Type.STRING }, visual: { type: Type.STRING }, action: { type: Type.STRING } }, ["shot", "visual", "action"]) },
  screenRecordPlan: { type: Type.ARRAY, items: obj({ step: { type: Type.NUMBER }, action: { type: Type.STRING }, zoomFocus: { type: Type.STRING } }, ["step", "action", "zoomFocus"]) },
  onScreenGraphics: { type: Type.ARRAY, items: obj({ graphicType: { type: Type.STRING }, description: { type: Type.STRING }, animationStyle: { type: Type.STRING } }, ["graphicType", "description", "animationStyle"]) },
  editingPlan: strings, subtitles: strings, aiVideoPrompts: strings,
  publishing: obj({ caption: { type: Type.STRING }, hashtags: strings, keywords: strings, cta: { type: Type.STRING } }, ["caption", "hashtags", "keywords", "cta"]),
  abHooks: { type: Type.ARRAY, items: obj({ angle: { type: Type.STRING }, script: { type: Type.STRING }, visualAction: { type: Type.STRING } }, ["angle", "script", "visualAction"]) },
  factCheck: { type: Type.ARRAY, items: obj({ claim: { type: Type.STRING }, confidence: { type: Type.STRING }, note: { type: Type.STRING } }, ["claim", "confidence", "note"]) }, retentionRisks: strings,
}, ["strategy", "hooks", "script", "timeline", "bRollPlan", "screenRecordPlan", "onScreenGraphics", "editingPlan", "subtitles", "aiVideoPrompts", "publishing", "abHooks", "factCheck", "retentionRisks"]);

function describe(input: ContentGenerationInput, budget: ReturnType<typeof createDurationBudget>) {
  return `Topic: ${input.topic}\nNotes: ${input.notes || "none"}\nProduct: ${input.product || "none"}\nDuration: ${input.duration}s; target words: ${budget.targetWords}; acceptable: ${budget.acceptableWordRange.min}-${budget.acceptableWordRange.max}; pause budget: ${budget.pauseBudget}s; rate: ${budget.wpm} WPM\nType: ${input.contentType}; style: ${input.videoStyle}; tone: ${input.tone}; audience: ${input.audience || "Italian tech audience"}; language: ${input.language}; ${input.researchMode ? "Research mode: flag unverified claims." : "Fast mode."}`;
}
function timeline(raw: any[], target: number) {
  const weights = raw.map((part) => Math.max(1, countSpokenWords(part.spokenText || "")));
  const total = weights.reduce((a, b) => a + b, 0); let start = 0;
  return raw.map((part, index) => { const duration = index === raw.length - 1 ? Number((target - start).toFixed(1)) : Number((target * weights[index] / total).toFixed(1)); const node = { ...part, startTime: Number(start.toFixed(1)), endTime: Number((start + duration).toFixed(1)), duration }; start += duration; return node; });
}

export async function POST(req: Request) {
  try {
    const { input, stage = "generate" } = await req.json() as { input: ContentGenerationInput; stage?: "strategy" | "generate" };
    if (!input?.topic || !input.duration) return NextResponse.json({ error: "Argomento e durata sono obbligatori." }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Configura GEMINI_API_KEY in .env.local." }, { status: 500 });
    const budget = createDurationBudget(input.duration, input.speakingRate, input.contentType);
    const prompt = stage === "strategy"
      ? `You are a short-form content strategist. Return Italian JSON only. Propose exactly 3 distinct content angles and at least 5 hooks in different categories (curiosity, contrarian, question, direct value, comparison). No invented facts or generic clickbait.\n${describe(input, budget)}`
      : `You are an Italian short-form Content Director. Return Italian JSON only. Build one production-ready vertical video. Selected angle: ${input.selectedAngle}. Selected hook: ${input.selectedHook}. The clean script MUST have ${budget.acceptableWordRange.min}-${budget.acceptableWordRange.max} spoken words; markers do not count. Adapt structure to duration. Every visual change needs a narrative reason. Timeline instructions must be actionable. Do not make up facts; list risky factual claims.\n${describe(input, budget)}`;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { responseMimeType: "application/json", responseSchema: stage === "strategy" ? strategySchema : resultSchema, temperature: 0.65 } });
    const data = JSON.parse(response.text || "{}");
    if (stage === "strategy") return NextResponse.json({ success: true, data });
    const duration = validateScriptDuration(data.script.clean, input.duration, input.language, input.speakingRate);
    data.timeline = timeline(data.timeline, input.duration);
    data.metadata = { durationTarget: input.duration, durationEstimated: duration.estimatedDuration, wordTarget: budget.targetWords, wordCount: countSpokenWords(data.script.clean), wpm: budget.wpm, deviationPercent: duration.deviationPercent, status: duration.status, contentType: input.contentType, tone: input.tone };
    data.voiceoverGuide = data.script.performance;
    data.ctaStrategies = [{ objective: "CTA", scriptLine: data.publishing.cta, onScreenText: data.publishing.cta }];
    data.timelineJsonExport = { fps: 30, nodes: data.timeline.map((node: any, index: number) => ({ id: `segment-${index + 1}`, type: node.section, startTime: node.startTime, duration: node.duration, content: node.spokenText })) };
    data.warnings = duration.status === "within-target" ? [] : [duration.status === "too-long" ? "SCRIPT TROPPO LUNGO: rigenera o accorcia semanticamente." : "Script sotto il target: aggiungi un dettaglio utile."];
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "Errore di elaborazione." }, { status: 500 }); }
}
