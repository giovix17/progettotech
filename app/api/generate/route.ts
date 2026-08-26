import { GoogleGenAI, Type } from "@google/genai";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import {
  calculateReadinessScore,
  auditContentMemory,
  computePerformanceLearnings,
} from "@/lib/content";
import {
  createDurationBudget,
  computeBeatsTimeline,
  validateBeatsDuration,
  StoryBeat,
} from "@/lib/duration";

const MODEL_NAME = "gemini-2.5-flash";
const strings = { type: Type.ARRAY, items: { type: Type.STRING } };
const obj = (properties: Record<string, unknown>, required: string[]) => ({ type: Type.OBJECT, properties, required });

const trendRadarSchema = obj({
  trends: {
    type: Type.ARRAY,
    items: obj({
      id: { type: Type.STRING },
      headline: { type: Type.STRING },
      sourceOrEntity: { type: Type.STRING },
      freshnessHours: { type: Type.NUMBER },
      summary: { type: Type.STRING },
      suggestedAngle: { type: Type.STRING },
      suggestedPillar: { type: Type.STRING },
    }, ["id", "headline", "sourceOrEntity", "freshnessHours", "summary", "suggestedAngle", "suggestedPillar"]),
  },
}, ["trends"]);

const singleBeatSchema = obj({
  spokenText: { type: Type.STRING },
  objective: { type: Type.STRING },
  retentionFunction: { type: Type.STRING },
}, ["spokenText", "objective", "retentionFunction"]);

const toneShiftSchema = obj({
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
      canCompress: { type: Type.BOOLEAN },
    }, ["id", "type", "objective", "spokenText", "importance", "visualPriority", "retentionFunction", "canCompress"]),
  },
}, ["beats"]);

const strategySchema = obj({
  topicAnalysis: obj({
    audience: { type: Type.STRING },
    whyItMatters: { type: Type.STRING },
    surpriseFactor: { type: Type.STRING },
    risks: strings,
  }, ["audience", "whyItMatters", "surpriseFactor", "risks"]),
  angles: {
    type: Type.ARRAY,
    items: obj({
      title: { type: Type.STRING },
      rationale: { type: Type.STRING },
      score: { type: Type.NUMBER },
    }, ["title", "rationale", "score"]),
  },
  hooks: {
    type: Type.ARRAY,
    items: obj({
      text: { type: Type.STRING },
      type: { type: Type.STRING },
      visual: { type: Type.STRING },
      reason: { type: Type.STRING },
      score: { type: Type.NUMBER },
    }, ["text", "type", "visual", "reason", "score"]),
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
    whatCouldKillIt: strings,
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
      canCompress: { type: Type.BOOLEAN },
    }, ["id", "type", "objective", "spokenText", "importance", "visualPriority", "retentionFunction", "canCompress"]),
  },
}, ["title", "strategy", "beats"]);

const visualPlanSchema = obj({
  timelineVisuals: {
    type: Type.ARRAY,
    items: obj({
      beatId: { type: Type.STRING },
      visual: { type: Type.STRING },
      visualSearchTerm: { type: Type.STRING },
      camera: { type: Type.STRING },
      overlayText: { type: Type.STRING },
      subtitleHighlight: { type: Type.STRING },
      soundEffect: { type: Type.STRING },
      transition: { type: Type.STRING },
      editingInstruction: { type: Type.STRING },
      continuity: obj({
        shotScale: { type: Type.STRING },
        zoomFactor: { type: Type.STRING },
        eyeLine: { type: Type.STRING },
        handPosition: { type: Type.STRING },
        cutTransitionReason: { type: Type.STRING },
        safeZonePlacement: { type: Type.STRING },
      }, ["shotScale", "zoomFactor", "eyeLine", "handPosition", "cutTransitionReason", "safeZonePlacement"]),
    }, ["beatId", "visual", "visualSearchTerm", "camera", "overlayText", "subtitleHighlight", "soundEffect", "transition", "editingInstruction", "continuity"]),
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
      fallback: { type: Type.STRING },
    }, ["id", "asset", "importance", "source", "available", "timeEstimateMin", "captureInstructions", "fallback"]),
  },
  bRollPlan: { type: Type.ARRAY, items: obj({ shot: { type: Type.STRING }, visual: { type: Type.STRING }, action: { type: Type.STRING } }, ["shot", "visual", "action"]) },
  screenRecordPlan: { type: Type.ARRAY, items: obj({ step: { type: Type.NUMBER }, action: { type: Type.STRING }, zoomFocus: { type: Type.STRING } }, ["step", "action", "zoomFocus"]) },
  onScreenGraphics: { type: Type.ARRAY, items: obj({ graphicType: { type: Type.STRING }, description: { type: Type.STRING }, animationStyle: { type: Type.STRING } }, ["graphicType", "description", "animationStyle"]) },
  editingPlan: strings,
  subtitles: strings,
  abHooks: { type: Type.ARRAY, items: obj({ angle: { type: Type.STRING }, script: { type: Type.STRING }, visualAction: { type: Type.STRING } }, ["angle", "script", "visualAction"]) },
  factCheck: { type: Type.ARRAY, items: obj({ claim: { type: Type.STRING }, confidence: { type: Type.STRING }, note: { type: Type.STRING } }, ["claim", "confidence", "note"]) },
  retentionRisks: strings,
}, ["timelineVisuals", "assetRequirements", "bRollPlan", "screenRecordPlan", "onScreenGraphics", "editingPlan", "subtitles", "abHooks", "factCheck", "retentionRisks"]);

const multiPlatformSchema = obj({
  platforms: {
    type: Type.ARRAY,
    items: obj({
      platform: { type: Type.STRING },
      titleOrHook: { type: Type.STRING },
      caption: { type: Type.STRING },
      hashtags: strings,
      ctaStrategy: { type: Type.STRING },
      firstCommentPrompt: { type: Type.STRING },
    }, ["platform", "titleOrHook", "caption", "hashtags", "ctaStrategy", "firstCommentPrompt"]),
  },
}, ["platforms"]);

const soundAndPacingSchema = obj({
  recommendedMusicBpm: { type: Type.NUMBER },
  musicGenre: { type: Type.STRING },
  averageEnergy: { type: Type.NUMBER },
  curve: {
    type: Type.ARRAY,
    items: obj({
      second: { type: Type.NUMBER },
      energyLevel: { type: Type.NUMBER },
      beatType: { type: Type.STRING },
      riskOfDrop: { type: Type.BOOLEAN },
      recommendation: { type: Type.STRING },
    }, ["second", "energyLevel", "beatType", "riskOfDrop", "recommendation"]),
  },
  sfxTimeline: {
    type: Type.ARRAY,
    items: obj({
      id: { type: Type.STRING },
      timestampSec: { type: Type.NUMBER },
      sfxType: { type: Type.STRING },
      reason: { type: Type.STRING },
      volumePercent: { type: Type.NUMBER },
    }, ["id", "timestampSec", "sfxType", "reason", "volumePercent"]),
  },
}, ["recommendedMusicBpm", "musicGenre", "averageEnergy", "curve", "sfxTimeline"]);

const repurposeSchema = obj({
  carouselSlides: {
    type: Type.ARRAY,
    items: obj({
      slideNumber: { type: Type.NUMBER },
      totalSlides: { type: Type.NUMBER },
      type: { type: Type.STRING },
      headline: { type: Type.STRING },
      body: { type: Type.STRING },
      visualPrompt: { type: Type.STRING },
    }, ["slideNumber", "totalSlides", "type", "headline", "body", "visualPrompt"]),
  },
  socialThread: strings,
  newsletterSection: { type: Type.STRING },
}, ["carouselSlides", "socialThread", "newsletterSection"]);

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { input = {}, stage = "generate", beatId, beatInstruction, newTone, currentBeats } = payload;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Configura GEMINI_API_KEY in .env.local." }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 1. TREND RADAR (Esecuzione immediata senza topic o durata)
    if (stage === "trend-radar") {
      const selectedPillar = input.pillar || "Tech & Gadget";
      const prompt = `Agisci come Trend Radar & News Jacker Tech.
Genera 5 argomenti o notizie calde ed emergenti per il pillar: "${selectedPillar}".
Restituisci esclusivamente un oggetto JSON con il campo "trends", dove ogni elemento include:
- id: stringa univoca (es. "trend-1")
- headline: titolo notizia ad alto impatto
- sourceOrEntity: azienda o testata coinvolta (es. Bloomberg, OpenAI, NVIDIA, The Verge)
- freshnessHours: numero di ore trascorse (es. 2, 4, 6)
- summary: sintesi di due frasi
- suggestedAngle: hook per video short
- suggestedPillar: "${selectedPillar}"

Restituisci solo JSON valido conforme allo schema.`;

      try {
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: { responseMimeType: "application/json", responseSchema: trendRadarSchema, temperature: 0.7 },
        });

        const trendData = JSON.parse(response.text || "{}");
        return NextResponse.json({ success: true, data: trendData });
      } catch (err: any) {
        return NextResponse.json({ error: `Errore Trend Radar AI: ${err.message}` }, { status: 500 });
      }
    }

    // 2. REGENERATE SINGLE BEAT
    if (stage === "regenerate-beat") {
      const targetBeat = currentBeats.find((b: any) => b.id === beatId);
      const prompt = `Sei un esperto editor di short video. Riscrivi questo singolo Story Beat:
Beat Corrente: "${targetBeat?.spokenText}" (Tipo: ${targetBeat?.type})
Istruzione: "${beatInstruction}"
Restituisci JSON.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: singleBeatSchema, temperature: 0.6 },
      });

      const updated = JSON.parse(response.text || "{}");
      const modifiedBeats = currentBeats.map((b: any) => {
        if (b.id === beatId) {
          return { ...b, spokenText: updated.spokenText, objective: updated.objective || b.objective, retentionFunction: updated.retentionFunction || b.retentionFunction };
        }
        return b;
      });

      const timelineData = computeBeatsTimeline(modifiedBeats, input?.speakingRate || "natural", input?.calibration);
      return NextResponse.json({ success: true, data: { beats: timelineData.beats, timelineData } });
    }

    // 3. AUTO-TONE SHIFT
    if (stage === "tone-shift") {
      const prompt = `Riscrivi i testi parlati di questi Story Beats cambiando il registro nel tono "${newTone}".
Non modificare i fatti né la struttura essenziale.
Beats:
${JSON.stringify(currentBeats, null, 2)}
Restituisci JSON.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: toneShiftSchema, temperature: 0.55 },
      });

      const parsed = JSON.parse(response.text || "{}");
      const shiftedBeats = parsed.beats || currentBeats;
      const timelineData = computeBeatsTimeline(shiftedBeats, input?.speakingRate || "natural", input?.calibration);
      return NextResponse.json({ success: true, data: { beats: timelineData.beats, timelineData } });
    }

    if (!input?.topic || !input.duration) {
      return NextResponse.json({ error: "Argomento e durata sono obbligatori." }, { status: 400 });
    }

    const budget = createDurationBudget(input.duration, input.speakingRate, input.contentType, input.calibration);
    const history = input.history || [];
    const memoryAudit = auditContentMemory(input.topic, input.pillar || "Tech & Gadget", history);
    const learnings = computePerformanceLearnings(history);

    // 4. STRATEGY & HOOK ENGINE
    if (stage === "strategy") {
      const memoryContext = history.length > 0
        ? `RECENT CONTENT TO AVOID:\n${history.slice(0, 5).map((h: any) => `- Topic: "${h.topic}" | Angle: "${h.angle}"`).join("\n")}`
        : "No prior content.";

      const prompt = `You are a strategic short-form director. Return Italian JSON only.
Propose 3 distinct angles and at least 5 hooks in different categories.
Favor hook type "${learnings.bestHookType}". Top pillar: "${learnings.topPerformingPillar}".
${memoryContext}
Topic: ${input.topic}; Pillar: ${input.pillar || "Tech & Gadget"}; Duration: ${input.duration}s.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: strategySchema, temperature: 0.65 },
      });

      const strategyData = JSON.parse(response.text || "{}");
      return NextResponse.json({ success: true, data: { ...strategyData, memoryAudit, learnings } });
    }

    // 5. SCRIPT BEATS ENGINE & AUTO-REWRITE LOOP
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
Return Italian JSON only adhering to schema.`
        : `REWRITE ATTEMPT ${attempts}/${maxAttempts}: Feedback: ${feedback}. Maintain Hook: "${input.selectedHook}". Target Words: ${budget.targetWords}.`;

      const scriptResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: storyScriptSchema, temperature: 0.4 },
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

    // 6. VISUAL CONTINUITY PLAN CON QUERY VISIVE PRECISE IN INGLESE
    const visualPrompt = `You are a Short-form Video Director & Cameraman.
For this approved script:
${JSON.stringify(validatedBeats, null, 2)}
Create matching B-roll and a complete VISUAL CONTINUITY PLAN for each beat.
Ensure each beat has a highly specific English "visualSearchTerm" suited for Pexels or Imagen (e.g., "vintage retro mp3 player classic", "printed circuit board repair closeup", "minimalist apple park glass building").
Return Italian JSON for descriptions and English for visualSearchTerm.`;

    const visualResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: visualPrompt,
      config: { responseMimeType: "application/json", responseSchema: visualPlanSchema, temperature: 0.5 },
    });
    const visualData = JSON.parse(visualResponse.text || "{}");

    // 7. MULTI-PLATFORM SEO OPTIMIZER
    const multiPlatformPrompt = `Generate 3 tailor-made publishing packages for this script:
Script: "${cleanScript}"
Title: "${storyData.title || input.topic}"
1. TikTok: Quick hook caption + debate question + hashtags + first comment prompt.
2. Instagram Reels: Detailed description with bullet points + hashtags.
3. YouTube Shorts: Search-optimized title + concise description.
Return Italian JSON.`;

    const multiPlatformResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: multiPlatformPrompt,
      config: { responseMimeType: "application/json", responseSchema: multiPlatformSchema, temperature: 0.6 },
    });
    const multiPlatformData = JSON.parse(multiPlatformResponse.text || "{}");

    // 8. SOUND DESIGN & SFX MATRIX
    const soundPrompt = `Analizza la narrazione di questo video da ${input.duration}s:
${JSON.stringify(validatedBeats, null, 2)}
Genera Pacing Curve, SFX Trigger Matrix, BPM e genere musicale. Restituisci JSON.`;

    const soundResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: soundPrompt,
      config: { responseMimeType: "application/json", responseSchema: soundAndPacingSchema, temperature: 0.5 },
    });
    const soundData = JSON.parse(soundResponse.text || "{}");

    // 9. REPURPOSING HUB
    const repurposePrompt = `Trasforma questo video script in:
1. 5-7 Carousel Slides per Instagram/LinkedIn.
2. Thread per X / LinkedIn.
3. Newsletter snippet approfondito.
Script: ${cleanScript}
Restituisci JSON.`;

    const repurposeResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: repurposePrompt,
      config: { responseMimeType: "application/json", responseSchema: repurposeSchema, temperature: 0.6 },
    });
    const repurposeData = JSON.parse(repurposeResponse.text || "{}");

    const assets = (visualData.assetRequirements || []).map((a: any, i: number) => ({
      id: a.id || `asset-${i + 1}`,
      asset: a.asset,
      importance: a.importance || "required",
      source: a.source || "user-owned",
      available: false,
      timeEstimateMin: a.timeEstimateMin || 2,
      captureInstructions: a.captureInstructions || "Clip verticale 4K.",
      fallback: a.fallback || "Stock footage o b-roll",
    }));

    const readinessScore = calculateReadinessScore(assets, true);

    const productionTasks = [
      { id: "task-1", category: "PRE-PRODUCTION", title: "Approva Script e Beat", detail: `Script verificato (${computedTimeline?.totalWords} parole / ${computedTimeline?.totalCalculatedDuration}s)`, completed: true },
      { id: "task-2", category: "PRE-PRODUCTION", title: "Configura Setup Video", detail: "Illuminazione frontale, microfono e camera 9:16", completed: false },
      { id: "task-3", category: "RECORDING", title: "Registra Voiceover / Parlato", detail: `Hook: "${validatedBeats[0]?.spokenText}"`, completed: false },
      { id: "task-4", category: "ASSETS", title: "Raccogli Asset Richiesti", detail: `${assets.length} asset pianificati dal visual engine`, completed: false },
      { id: "task-5", category: "EDITING", title: "Monta su Timeline & Applica Jump-Cuts", detail: "Applica zoom 1.2x/1.5x e trigger SFX", completed: false },
      { id: "task-6", category: "FINAL", title: "Safe-Zone & Export", detail: "Verifica che i testi ricadano nella safe area", completed: false },
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
        visualSearchTerm: visualInfo.visualSearchTerm || `${input.topic} technology hardware`,
        camera: visualInfo.camera || "Dynamic close-up",
        overlayText: visualInfo.overlayText || beat.objective,
        subtitleHighlight: visualInfo.subtitleHighlight || "",
        soundEffect: visualInfo.soundEffect || "none",
        transition: visualInfo.transition || "cut",
        editingInstruction: visualInfo.editingInstruction || `Focus su ${beat.retentionFunction}`,
        continuity: visualInfo.continuity || {
          shotScale: "medium",
          zoomFactor: "1.0x",
          eyeLine: "direct-camera",
          handPosition: "resting",
          cutTransitionReason: "Stacco ritmico",
          safeZonePlacement: "top-35-center"
        }
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
      pacingReport: soundData,
      multiPlatformSEO: multiPlatformData.platforms || [],
      repurposed: repurposeData,
      productionReadiness: readinessScore,
      productionTasks,
      bRollPlan: visualData.bRollPlan || [],
      screenRecordPlan: visualData.screenRecordPlan || [],
      onScreenGraphics: visualData.onScreenGraphics || [],
      editingPlan: visualData.editingPlan || [],
      subtitles: visualData.subtitles || [],
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
      warnings: validation?.status === "within-target" ? [] : [`Script registrato a ${computedTimeline?.totalCalculatedDuration}s`],
    };

    return NextResponse.json({ success: true, data: resultPayload });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore di elaborazione." }, { status: 500 });
  }
}