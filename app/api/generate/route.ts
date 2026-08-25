import { GoogleGenAI, Type } from "@google/genai";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { 
  ContentGenerationInput, 
  calculateReadinessScore, 
  auditContentMemory,
  computePerformanceLearnings 
} from "@/lib/content";
import { 
  createDurationBudget, 
  computeBeatsTimeline, 
  validateBeatsDuration, 
  StoryBeat 
} from "@/lib/duration";

const strings = { type: Type.ARRAY, items: { type: Type.STRING } };
const obj = (properties: Record<string, unknown>, required: string[]) => ({ type: Type.OBJECT, properties, required });

const strategySchema = obj({
  topicAnalysis: obj({
    audience: { type: Type.STRING },
    whyItMatters: { type: Type.STRING },
    surpriseFactor: { type: Type.STRING },
    risks: strings
  }, ["audience", "whyItMatters", "surpriseFactor", "risks"]),
  angles: { 
    type: Type.ARRAY, 
    items: obj({ title: { type: Type.STRING }, rationale: { type: Type.STRING }, score: { type: Type.NUMBER } }, ["title", "rationale", "score"]) 
  },
  hooks: { 
    type: Type.ARRAY, 
    items: obj({ text: { type: Type.STRING }, type: { type: Type.STRING }, visual: { type: Type.STRING }, reason: { type: Type.STRING }, score: { type: Type.NUMBER } }, ["text", "type", "visual", "reason", "score"]) 
  },
}, ["topicAnalysis", "angles", "hooks"]);

const storyScriptSchema = obj({
  title: { type: Type.STRING },
  strategy: obj({
    selectedAngle: { type: Type.STRING },
    alternativeAngles: { type: Type.ARRAY, items: obj({ title: { type: Type.STRING }, score: { type: Type.NUMBER } }, ["title", "score"]) },
    contentScore: { type: Type.NUMBER },
    retentionScore: { type: Type.NUMBER },
    whyThisCouldWork: strings,
    whatCouldKillIt: strings
  }, ["selectedAngle", "alternativeAngles", "contentScore", "retentionScore", "whyThisCouldWork", "whatCouldKillIt"]),
  beats: {
    type: Type.ARRAY,
    items: obj({
      id: { type: Type.STRING },
      type: { type: Type.STRING },
      objective: { type: Type.STRING },
      spokenText: { type: Type.STRING },
      importance: { type: Type.NUMBER },
      visualPriority: { type: Type.NUMBER },
      retentionFunction: { type: Type.STRING },
      canCompress: { type: Type.BOOLEAN }
    }, ["id", "type", "objective", "spokenText", "importance", "visualPriority", "retentionFunction", "canCompress"])
  }
}, ["title", "strategy", "beats"]);

const visualPlanSchema = obj({
  timelineVisuals: {
    type: Type.ARRAY,
    items: obj({
      beatId: { type: Type.STRING },
      visual: { type: Type.STRING },
      camera: { type: Type.STRING },
      overlayText: { type: Type.STRING },
      subtitleHighlight: { type: Type.STRING },
      soundEffect: { type: Type.STRING },
      transition: { type: Type.STRING },
      editingInstruction: { type: Type.STRING }
    }, ["beatId", "visual", "camera", "overlayText", "subtitleHighlight", "soundEffect", "transition", "editingInstruction"])
  },
  assetRequirements: {
    type: Type.ARRAY,
    items: obj({
      id: { type: Type.STRING },
      asset: { type: Type.STRING },
      importance: { type: Type.STRING },
      source: { type: Type.STRING },
      available: { type: Type.BOOLEAN },
      timeEstimateMin: { type: Type.NUMBER },
      captureInstructions: { type: Type.STRING },
      fallback: { type: Type.STRING }
    }, ["id", "asset", "importance", "source", "available", "timeEstimateMin", "captureInstructions", "fallback"])
  },
  bRollPlan: { type: Type.ARRAY, items: obj({ shot: { type: Type.STRING }, visual: { type: Type.STRING }, action: { type: Type.STRING } }, ["shot", "visual", "action"]) },
  screenRecordPlan: { type: Type.ARRAY, items: obj({ step: { type: Type.NUMBER }, action: { type: Type.STRING }, zoomFocus: { type: Type.STRING } }, ["step", "action", "zoomFocus"]) },
  onScreenGraphics: { type: Type.ARRAY, items: obj({ graphicType: { type: Type.STRING }, description: { type: Type.STRING }, animationStyle: { type: Type.STRING } }, ["graphicType", "description", "animationStyle"]) },
  editingPlan: strings,
  subtitles: strings,
  publishing: obj({ caption: { type: Type.STRING }, hashtags: strings, keywords: strings, cta: { type: Type.STRING } }, ["caption", "hashtags", "keywords", "cta"]),
  abHooks: { type: Type.ARRAY, items: obj({ angle: { type: Type.STRING }, script: { type: Type.STRING }, visualAction: { type: Type.STRING } }, ["angle", "script", "visualAction"]) },
  factCheck: { type: Type.ARRAY, items: obj({ claim: { type: Type.STRING }, confidence: { type: Type.STRING }, note: { type: Type.STRING } }, ["claim", "confidence", "note"]) },
  retentionRisks: strings,
}, ["timelineVisuals", "assetRequirements", "bRollPlan", "screenRecordPlan", "onScreenGraphics", "editingPlan", "subtitles", "publishing", "abHooks", "factCheck", "retentionRisks"]);

export async function POST(req: Request) {
  try {
    const { input, stage = "generate" } = await req.json() as { input: ContentGenerationInput; stage?: "strategy" | "generate" };
    if (!input?.topic || !input.duration) return NextResponse.json({ error: "Argomento e durata sono obbligatori." }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Configura GEMINI_API_KEY in .env.local." }, { status: 500 });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const budget = createDurationBudget(input.duration, input.speakingRate, input.contentType, input.calibration);
    const history = input.history || [];
    const memoryAudit = auditContentMemory(input.topic, input.pillar || "Tech & Gadget", history);
    const learnings = computePerformanceLearnings(history);

    if (stage === "strategy") {
      const memoryContext = history.length > 0
        ? `RECENT PRODUCED CONTENT TO AVOID:\n${history.slice(0, 5).map((h) => `- Topic: "${h.topic}" | Angle: "${h.angle}"`).join("\n")}`
        : "No prior content.";

      const learningsContext = `CREATOR LEARNINGS: Favorisci hook tipo "${learnings.bestHookType}". Miglior pillar del canale: "${learnings.topPerformingPillar}".`;

      const prompt = `You are a strategic short-form director. Return Italian JSON only.
Propose exactly 3 distinct content angles and at least 5 hooks.
${learningsContext}
${memoryContext}

Topic: ${input.topic}; Pillar: ${input.pillar || "Tech & Gadget"}; Duration: ${input.duration}s.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: strategySchema, temperature: 0.65 }
      });

      const strategyData = JSON.parse(response.text || "{}");
      return NextResponse.json({ 
        success: true, 
        data: {
          ...strategyData,
          memoryAudit,
          learnings
        } 
      });
    }

    // 1. STORY BEAT ENGINE & AUTO-REWRITE LOOP CON CALIBRAZIONE
    let attempts = 0;
    const maxAttempts = 3;
    let storyData: any = null;
    let computedTimeline: ReturnType<typeof computeBeatsTimeline> | null = null;
    let validation: ReturnType<typeof validateBeatsDuration> | null = null;
    let feedback = "";

    while (attempts < maxAttempts) {
      attempts++;
      const prompt = attempts === 1
        ? `Create definitive STORY BEATS for a ${input.duration}s vertical video.
Topic: ${input.topic}
Angle: ${input.selectedAngle}
Hook: "${input.selectedHook}"
Target Words: ${budget.targetWords} (range: ${budget.acceptableWordRange.min}-${budget.acceptableWordRange.max}).
Return Italian JSON only.`
        : `REWRITE ATTEMPT ${attempts}/${maxAttempts}: Feedback: ${feedback}. Maintain Hook: "${input.selectedHook}". Target Words: ${budget.targetWords}.`;

      const scriptResponse = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: storyScriptSchema, temperature: 0.4 }
      });

      storyData = JSON.parse(scriptResponse.text || "{}");
      const beats = (storyData.beats || []) as StoryBeat[];
      computedTimeline = computeBeatsTimeline(beats, input.speakingRate, input.calibration);
      validation = validateBeatsDuration(computedTimeline.totalCalculatedDuration, input.duration);

      if (validation.status === "within-target") break;
      feedback = validation.status === "too-long"
        ? `Compress script by ${Number((computedTimeline.totalCalculatedDuration - input.duration).toFixed(1))}s.`
        : `Expand script by ${Number((input.duration - computedTimeline.totalCalculatedDuration).toFixed(1))}s.`;
    }

    const validatedBeats = computedTimeline?.beats || [];
    const cleanScript = validatedBeats.map((b) => b.spokenText).join(" ");
    const performanceScript = validatedBeats.map((b) => `[${b.type.toUpperCase()}] ${b.spokenText} [PAUSA ${b.pauseDurationSec}s]`).join("\n\n");

    // 2. VISUAL PLAN
    const visualPrompt = `Extract asset requirements and editing directions from this approved script:
${JSON.stringify(validatedBeats, null, 2)}
Return Italian JSON.`;

    const visualResponse = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: visualPrompt,
      config: { responseMimeType: "application/json", responseSchema: visualPlanSchema, temperature: 0.5 }
    });

    const visualData = JSON.parse(visualResponse.text || "{}");
    const assets = (visualData.assetRequirements || []).map((a: any, i: number) => ({
      id: a.id || `asset-${i + 1}`,
      asset: a.asset,
      importance: a.importance || "required",
      source: a.source || "user-owned",
      available: false,
      timeEstimateMin: a.timeEstimateMin || 2,
      captureInstructions: a.captureInstructions || "Registra clip in 4K.",
      fallback: a.fallback || "Stock video o b-roll secondario"
    }));

    const readinessScore = calculateReadinessScore(assets, true);

    const productionTasks = [
      { id: "task-1", category: "PRE-PRODUCTION", title: "Approva Script e Beat", detail: `Script verificato (${computedTimeline?.totalWords} parole / ${computedTimeline?.totalCalculatedDuration}s)`, completed: true },
      { id: "task-2", category: "PRE-PRODUCTION", title: "Configura Setup Video", detail: "Illuminazione frontale, microfono direzionale e camera 9:16", completed: false },
      { id: "task-3", category: "RECORDING", title: "Registra Voiceover / Parlato", detail: `Hook: "${validatedBeats[0]?.spokenText}"`, completed: false },
      { id: "task-4", category: "ASSETS", title: "Raccogli Asset Richiesti", detail: `${assets.length} asset pianificati dal visual engine`, completed: false },
      { id: "task-5", category: "EDITING", title: "Monta su Timeline & Taglia Pause", detail: "Applica transizioni e reveal visivi", completed: false },
      { id: "task-6", category: "FINAL", title: "Quality Check & Export", detail: "Verifica retention primi 3s e audio bilanciato", completed: false }
    ];

    const fullTimeline = validatedBeats.map((beat) => {
      const visualInfo = visualData.timelineVisuals?.find((v: any) => v.beatId === beat.id) || {};
      return {
        section: beat.type,
        spokenText: beat.spokenText,
        startTime: beat.startTimeSec,
        endTime: beat.endTimeSec,
        duration: beat.durationSec,
        visual: visualInfo.visual || `Visual per ${beat.type}`,
        camera: visualInfo.camera || "Dynamic close-up",
        overlayText: visualInfo.overlayText || beat.objective,
        subtitleHighlight: visualInfo.subtitleHighlight || "",
        soundEffect: visualInfo.soundEffect || "none",
        transition: visualInfo.transition || "cut",
        editingInstruction: visualInfo.editingInstruction || `Focus su ${beat.retentionFunction}`,
      };
    });

    const resultPayload = {
      id: `content-${Date.now()}`,
      createdAt: new Date().toISOString(),
      pillar: input.pillar || "Tech & Gadget",
      hookType: validatedBeats[0]?.retentionFunction || "curiosity",
      strategy: {
        selectedAngle: storyData.strategy?.selectedAngle || input.selectedAngle,
        alternativeAngles: storyData.strategy?.alternativeAngles || [],
        contentScore: storyData.strategy?.contentScore || 90,
        retentionScore: storyData.strategy?.retentionScore || 92,
        whyThisCouldWork: storyData.strategy?.whyThisCouldWork || [],
        whatCouldKillIt: storyData.strategy?.whatCouldKillIt || [],
      },
      hooks: [{ text: input.selectedHook || validatedBeats[0]?.spokenText || "", type: "selected", visual: fullTimeline[0]?.visual || "", score: 95 }],
      script: {
        clean: cleanScript,
        performance: performanceScript,
        title: storyData.title || input.topic,
      },
      beats: validatedBeats,
      timeline: fullTimeline,
      assets,
      productionReadiness: readinessScore,
      productionTasks,
      bRollPlan: visualData.bRollPlan || [],
      screenRecordPlan: visualData.screenRecordPlan || [],
      onScreenGraphics: visualData.onScreenGraphics || [],
      editingPlan: visualData.editingPlan || [],
      subtitles: visualData.subtitles || [],
      publishing: visualData.publishing || { caption: "", hashtags: [], keywords: [], cta: "" },
      abHooks: visualData.abHooks || [],
      factCheck: visualData.factCheck || [],
      retentionRisks: visualData.retentionRisks || [],
      voiceoverGuide: performanceScript,
      metadata: {
        durationTarget: input.duration,
        durationEstimated: computedTimeline?.totalCalculatedDuration || input.duration,
        wordTarget: budget.targetWords,
        wordCount: computedTimeline?.totalWords || 0,
        wpm: budget.wpm,
        deviationPercent: validation?.deviationPercent || 0,
        status: validation?.status || "within-target",
        contentType: input.contentType,
        tone: input.tone,
        rewriteAttempts: attempts,
      },
      ctaStrategies: [{ objective: "CTA", scriptLine: visualData.publishing?.cta || "", onScreenText: visualData.publishing?.cta || "" }],
      timelineJsonExport: {
        fps: 30,
        nodes: fullTimeline.map((node: any, index: number) => ({
          id: `beat-${index + 1}`,
          type: node.section,
          startTime: node.startTime,
          duration: node.duration,
          content: node.spokenText,
        })),
      },
      warnings: validation?.status === "within-target" ? [] : [`Script registrato a ${computedTimeline?.totalCalculatedDuration}s`],
    };

    return NextResponse.json({ success: true, data: resultPayload });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore di elaborazione." }, { status: 500 });
  }
}