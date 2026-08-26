"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import {
  ContentType,
  VideoStyle,
  ContentPillar,
  CONTENT_PILLARS,
  ContentMemory,
  CreatorCalibration,
  calculateReadinessScore,
  computePerformanceLearnings,
} from "@/lib/content";
import { createDurationBudget } from "@/lib/duration";
import {
  getAllMemoriesFromDB,
  saveMemoryToDB,
  clearAllMemoriesFromDB,
  getCalibrationFromDB,
  saveCalibrationToDB,
} from "@/lib/db";

const durations = [15, 20, 30, 45, 60, 90, 120];
const types: { value: ContentType; label: string }[] = [
  { value: "auto", label: "Auto" }, { value: "news", label: "News" }, { value: "explainer", label: "Explainer" },
  { value: "review", label: "Review" }, { value: "comparison", label: "X vs Y" }, { value: "ranking", label: "Ranking" },
  { value: "opinion", label: "Opinion" }, { value: "tutorial", label: "Tutorial" }, { value: "storytelling", label: "Storytelling" },
];
const styles: { value: VideoStyle; label: string }[] = [
  { value: "faceless-voiceover", label: "Faceless voiceover" }, { value: "screen-recording", label: "Screen recording" },
  { value: "product-focus", label: "Product focus" }, { value: "news-fast", label: "News fast-paced" },
  { value: "cinematic-tech", label: "Cinematic tech" }, { value: "explainer", label: "Explainer" },
  { value: "list-ranking", label: "List / ranking" }, { value: "storytelling", label: "Storytelling" }, { value: "hybrid", label: "Hybrid" },
];

const WIZARD_STEPS = ["Trend & Idea", "Formato", "Setup", "Strategia & Hook", "Risultato"] as const;
const dashboardTabs = [
  "Overview", "Safe-Zone Mask", "Jump-Cut & Visuals", "Multi-Platform SEO", 
  "Sound Design Matrix", "Carousel & Repurpose", "Beat Editor", "Production Mode", 
  "Memory Brain (IndexedDB)", "Script", "Storyboard"
] as const;

const defaultCalibration: CreatorCalibration = {
  averageWpm: 152,
  hookWpm: 164,
  explainerWpm: 146,
  revealWpm: 132,
  ctaWpm: 150,
};

export default function Page() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [product, setProduct] = useState("");
  const [duration, setDuration] = useState(30);
  const [contentType, setContentType] = useState<ContentType>("auto");
  const [pillar, setPillar] = useState<ContentPillar>("Tech & Gadget");
  const [videoStyle, setVideoStyle] = useState<VideoStyle>("faceless-voiceover");
  const [tone, setTone] = useState("Smart");
  const [researchMode, setResearchMode] = useState(false);

  const [strategy, setStrategy] = useState<any>(null);
  const [angle, setAngle] = useState("");
  const [hook, setHook] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [renderingVideo, setRenderingVideo] = useState(false);
  const [renderStatus, setRenderStatus] = useState<string>("");

  const [trendNews, setTrendNews] = useState<any[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);

  const [tab, setTab] = useState<(typeof dashboardTabs)[number]>("Overview");
  const [history, setHistory] = useState<ContentMemory[]>([]);
  const [calibration, setCalibration] = useState<CreatorCalibration>(defaultCalibration);

  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);
  const [beatPrompt, setBeatPrompt] = useState("");
  const [updatingBeat, setUpdatingBeat] = useState(false);
  const [safeZonePlatform, setSafeZonePlatform] = useState<"tiktok" | "reels" | "shorts">("tiktok");

  useEffect(() => {
    async function initFromDB() {
      try {
        const dbMemories = await getAllMemoriesFromDB();
        setHistory(dbMemories);
        const dbCal = await getCalibrationFromDB();
        if (dbCal) setCalibration(dbCal);
      } catch (e) {
        console.error("Errore IndexedDB:", e);
      }
    }
    initFromDB();
  }, []);

  const handleSaveCalibration = async (newCal: CreatorCalibration) => {
    setCalibration(newCal);
    await saveCalibrationToDB(newCal);
  };

  const budget = useMemo(() => createDurationBudget(duration, "natural", contentType, calibration), [duration, contentType, calibration]);
  const learnings = useMemo(() => computePerformanceLearnings(history), [history]);

  const input = {
    topic, notes, product, duration, contentType, videoStyle, pillar,
    tone, language: "it", researchMode, selectedAngle: angle, selectedHook: hook,
    speakingRate: "natural" as const, history, calibration, learnings,
  };

  async function fetchTrendRadar() {
    setLoadingTrends(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "trend-radar",
          input: { pillar },
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Errore durante la scansione radar.");
      }

      if (body.data?.trends && body.data.trends.length > 0) {
        setTrendNews(body.data.trends);
      } else {
        throw new Error("Nessun trend rilevato. Riprova tra qualche istante.");
      }
    } catch (err: any) {
      console.error("Trend Radar Frontend Error:", err);
      setError(err.message || "Errore di connessione con il Trend Radar.");
    } finally {
      setLoadingTrends(false);
    }
  }

  async function callStrategy() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, stage: "strategy" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setStrategy(body.data);
      setAngle(body.data.angles[0]?.title || "");
      setHook(body.data.hooks[0]?.text || "");
      setCurrentStep(3);
    } catch (e: any) {
      setError(e.message || "Errore durante l'elaborazione strategica.");
    } finally {
      setLoading(false);
    }
  }

  async function callFinalGeneration() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, stage: "generate" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setResult(body.data);

      const memItem: ContentMemory = {
        id: body.data.id || `mem-${Date.now()}`,
        topic,
        pillar,
        angle: body.data.strategy?.selectedAngle || angle,
        hook: body.data.hooks[0]?.text || hook,
        hookType: body.data.hookType || "curiosity",
        contentType,
        duration,
        keyTakeaway: body.data.script.title,
        createdAt: new Date().toLocaleDateString("it-IT"),
        analytics: { views: 0, watchTimeSec: 0, completionRate: 0, retention3s: 0, shares: 0, saves: 0, comments: 0 },
      };

      await saveMemoryToDB(memItem);
      const updatedMemories = await getAllMemoriesFromDB();
      setHistory(updatedMemories);

      setCurrentStep(4);
      setTab("Overview");
    } catch (e: any) {
      setError(e.message || "Errore durante la generazione dello script.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerRenderEngine() {
    if (!result) return;
    setRenderingVideo(true);
    setRenderStatus("Montaggio multi-scena in corso (tagli per Beat, zoom dinamico e transizioni)...");
    try {
      const res = await fetch("/api/render-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptText: result.script.clean,
          videoSubject: result.script.title,
          videoTerms: result.multiPlatformSEO?.[0]?.hashtags?.join(", ") || topic,
          duration: result.metadata.durationEstimated,
          beats: result.beats || result.timeline || [],
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setRenderStatus("✓ Video montato con successo secondo gli Story Beats in output_renders!");
    } catch (err: any) {
      setRenderStatus(`❌ Errore: ${err.message}`);
    } finally {
      setRenderingVideo(false);
    }
  }

  async function handleRegenerateBeat(bId: string) {
    if (!beatPrompt.trim() || !result) return;
    setUpdatingBeat(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "regenerate-beat",
          beatId: bId,
          beatInstruction: beatPrompt,
          currentBeats: result.beats,
          input,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);

      const updatedBeats = body.data.beats;
      const cleanText = updatedBeats.map((b: any) => b.spokenText).join(" ");
      const updatedTimeline = result.timeline.map((t: any, i: number) => ({
        ...t,
        spokenText: updatedBeats[i]?.spokenText || t.spokenText,
        duration: updatedBeats[i]?.durationSec || t.duration,
        startTime: updatedBeats[i]?.startTimeSec || t.startTime,
        endTime: updatedBeats[i]?.endTimeSec || t.endTime,
      }));

      setResult({
        ...result,
        beats: updatedBeats,
        timeline: updatedTimeline,
        script: { ...result.script, clean: cleanText },
        metadata: {
          ...result.metadata,
          wordCount: body.data.timelineData.totalWords,
          durationEstimated: body.data.timelineData.totalCalculatedDuration,
        },
      });
      setEditingBeatId(null);
      setBeatPrompt("");
    } catch (err: any) {
      alert(err.message || "Errore durante l'aggiornamento del beat.");
    } finally {
      setUpdatingBeat(false);
    }
  }

  async function handleToneShift(targetTone: string) {
    if (!result) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "tone-shift",
          newTone: targetTone,
          currentBeats: result.beats,
          input,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);

      const updatedBeats = body.data.beats;
      const cleanText = updatedBeats.map((b: any) => b.spokenText).join(" ");
      setResult({
        ...result,
        beats: updatedBeats,
        script: { ...result.script, clean: cleanText },
        metadata: {
          ...result.metadata,
          tone: targetTone,
          wordCount: body.data.timelineData.totalWords,
          durationEstimated: body.data.timelineData.totalCalculatedDuration,
        },
      });
    } catch (err: any) {
      alert(err.message || "Errore durante il cambio di registro.");
    } finally {
      setLoading(false);
    }
  }

  const toggleAsset = (assetId: string) => {
    if (!result) return;
    const updated = result.assets.map((a: any) => a.id === assetId ? { ...a, available: !a.available } : a);
    setResult({ ...result, assets: updated, productionReadiness: calculateReadinessScore(updated, true) });
  };

  const toggleTask = (taskId: string) => {
    if (!result) return;
    const updated = result.productionTasks.map((t: any) => t.id === taskId ? { ...t, completed: !t.completed } : t);
    setResult({ ...result, productionTasks: updated });
  };

  const updateAnalytics = async (id: string, field: "views" | "retention3s" | "completionRate", val: number) => {
    const item = history.find((h) => h.id === id);
    if (item) {
      const a = item.analytics || { views: 0, watchTimeSec: 0, completionRate: 0, retention3s: 0, shares: 0, saves: 0, comments: 0 };
      const updatedItem = { ...item, analytics: { ...a, [field]: val } };
      await saveMemoryToDB(updatedItem);
      const updatedMemories = await getAllMemoriesFromDB();
      setHistory(updatedMemories);
    }
  };

  const Card = ({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) => (
    <button type="button" onClick={onClick} className={`rounded-xl border p-3 text-left transition ${active ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-white/[.03] hover:border-white/25"}`}>
      {children}
    </button>
  );

  return (
    <main className="min-h-screen px-4 py-7 text-slate-100 md:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">AI CONTENT STUDIO · VIRAL PRODUCTION SUITE</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">Dall’idea allo script,<br /><span className="gradient-text">con Safe-Zone, Jump-Cuts e Auto-Render MP4.</span></h1>
          </div>
          <div className="flex gap-3">
            <div className="stat"><span>Memoria Video</span><strong>{history.length} salvati</strong></div>
            <div className="stat"><span>Target Duration</span><strong>{duration}s · {budget.targetWords}w</strong></div>
          </div>
        </header>

        {/* STEPPER WIZARD */}
        <nav className="flex items-center justify-between gap-2 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] p-3">
          {WIZARD_STEPS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => { if (index < currentStep || (index === 3 && strategy) || (index === 4 && result)) setCurrentStep(index); }}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                currentStep === index
                  ? "bg-cyan-400 text-slate-950"
                  : index < currentStep
                  ? "text-cyan-300 hover:bg-white/5"
                  : "text-slate-500 opacity-60"
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
                {index + 1}
              </span>
              {label}
            </button>
          ))}
        </nav>

        {/* STEP 0: IDEA & TREND RADAR */}
        {currentStep === 0 && (
          <section className="panel space-y-6">
            <div className="flex items-center justify-between">
              <div className="section-title !mb-0">
                <span className="step">01</span>
                <div>
                  <h2>Trend Radar & Topic</h2>
                  <p>Inserisci un argomento o scansiona gli annunci emergenti in tempo reale.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchTrendRadar}
                disabled={loadingTrends}
                className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20 transition disabled:opacity-50"
              >
                {loadingTrends ? "⏳ Scansione radar in corso..." : "📡 Scansiona Trend Radar"}
              </button>
            </div>

            {error && <p className="error">{error}</p>}

            {loadingTrends && (
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-6 text-center text-xs text-cyan-200 animate-pulse">
                Analisi dei trend e breaking news in corso per il pillar <b>{pillar}</b>...
              </div>
            )}

            {trendNews.length > 0 && !loadingTrends && (
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4 space-y-3">
                <div className="flex justify-between items-center text-xs text-cyan-300 font-bold uppercase">
                  <span>⚡ Notizie ed Argomenti Caldi Rilevati (Clicca per selezionare)</span>
                  <span>Ultime ore</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {trendNews.map((t: any) => (
                    <div
                      key={t.id || t.headline}
                      onClick={() => {
                        setTopic(t.headline);
                        setNotes(`Angolo: ${t.suggestedAngle}`);
                        if (t.suggestedPillar) setPillar(t.suggestedPillar as ContentPillar);
                      }}
                      className="cursor-pointer rounded-lg border border-white/10 bg-slate-900/80 p-3 text-xs space-y-1.5 transition hover:border-cyan-400 hover:bg-slate-800"
                    >
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{t.sourceOrEntity}</span>
                        <span className="text-cyan-400">~{t.freshnessHours || 2}h fa</span>
                      </div>
                      <b className="text-white block line-clamp-2">{t.headline}</b>
                      <p className="text-slate-300 text-[11px] line-clamp-2">{t.summary}</p>
                      <span className="text-[10px] text-cyan-300 block font-semibold">💡 {t.suggestedAngle}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <label className="md:col-span-2">Idea / Argomento
                <input required value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Es. Perché NVIDIA domina i chip per l'AI?" />
              </label>
              <label>Pillar Editoriale
                <select value={pillar} onChange={(e) => setPillar(e.target.value as ContentPillar)}>
                  {CONTENT_PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label>Prodotto (Opzionale)
                <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Es. iPhone 17 Pro, RTX 5090..." />
              </label>
              <label>Note e Angoli Personali
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Esperienze d'uso, dati chiave da citare..." />
              </label>
            </div>

            <div className="flex justify-end pt-4">
              <button type="button" disabled={!topic.trim()} onClick={() => setCurrentStep(1)} className="primary !w-auto !px-8">
                Avanti: Scegli Formato →
              </button>
            </div>
          </section>
        )}

        {/* STEP 1: FORMAT */}
        {currentStep === 1 && (
          <section className="panel space-y-6">
            <div className="section-title">
              <span className="step">02</span>
              <div>
                <h2>Formato e Durata</h2>
                <p>Il Duration Engine dimensiona in tempo reale le parole target.</p>
              </div>
            </div>

            <div>
              <h3>Tipo di Contenuto</h3>
              <div className="choice-grid">
                {types.map((item) => (
                  <Card key={item.value} active={contentType === item.value} onClick={() => setContentType(item.value)}>
                    <strong>{item.label}</strong>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h3>Durata Target</h3>
              <div className="choice-grid duration-grid">
                {durations.map((seconds) => (
                  <Card key={seconds} active={duration === seconds} onClick={() => setDuration(seconds)}>
                    <strong>{seconds}s</strong>
                  </Card>
                ))}
                <label className="custom">Custom
                  <input type="number" min="10" max="180" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                </label>
              </div>
              <div className="budget mt-3">
                <span>Target {budget.targetWords} parole</span>
                <span>Range {budget.acceptableWordRange.min}–{budget.acceptableWordRange.max} parole</span>
                <span>{budget.pauseBudget}s budget pause</span>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button type="button" onClick={() => setCurrentStep(0)} className="rounded-lg border border-white/10 px-5 py-2 text-xs hover:bg-white/5">
                ← Indietro
              </button>
              <button type="button" onClick={() => setCurrentStep(2)} className="primary !w-auto !px-8">
                Avanti: Stile & Tono →
              </button>
            </div>
          </section>
        )}

        {/* STEP 2: SETUP */}
        {currentStep === 2 && (
          <section className="panel space-y-6">
            <div className="section-title">
              <span className="step">03</span>
              <div>
                <h2>Stile Visivo e Tono</h2>
                <p>Configura l'approccio narrativo prima dell'analisi strategica.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label>Stile Video
                <select value={videoStyle} onChange={(e) => setVideoStyle(e.target.value as VideoStyle)}>
                  {styles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label>Tono di Voce
                <select value={tone} onChange={(e) => setTone(e.target.value)}>
                  {["Smart", "Conversational", "Energetic", "Premium", "Funny", "Provocative", "Educational", "Analytical"].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="research">
                <input type="checkbox" checked={researchMode} onChange={(e) => setResearchMode(e.target.checked)} />
                Research Mode <small>Fact-checking attivo</small>
              </label>
            </div>

            <div className="flex justify-between pt-4">
              <button type="button" onClick={() => setCurrentStep(1)} className="rounded-lg border border-white/10 px-5 py-2 text-xs hover:bg-white/5">
                ← Indietro
              </button>
              <button type="button" disabled={loading} onClick={callStrategy} className="primary !w-auto !px-8">
                {loading ? "Elaborazione Strategica..." : "Elabora Strategia & Hook →"}
              </button>
            </div>
            {error && <p className="error">{error}</p>}
          </section>
        )}

        {/* STEP 3: STRATEGY & HOOK */}
        {currentStep === 3 && strategy && (
          <section className="panel space-y-6">
            <div className="section-title">
              <span className="step">04</span>
              <div>
                <h2>Scegli Angolo e Hook</h2>
                <p>{strategy.topicAnalysis?.whyItMatters}</p>
              </div>
            </div>

            <div>
              <h3>Content Angles Proposti</h3>
              <div className="grid gap-3 md:grid-cols-3">
                {strategy.angles.map((item: any) => (
                  <Card key={item.title} active={angle === item.title} onClick={() => setAngle(item.title)}>
                    <b>{item.score}/100</b>
                    <strong>{item.title}</strong>
                    <p>{item.rationale}</p>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h3>Hook Engine</h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {strategy.hooks.map((item: any) => (
                  <Card key={item.text} active={hook === item.text} onClick={() => setHook(item.text)}>
                    <b>{item.type} · {item.score}/100</b>
                    <strong>“{item.text}”</strong>
                    <p>Visual: {item.visual}</p>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button type="button" onClick={() => setCurrentStep(2)} className="rounded-lg border border-white/10 px-5 py-2 text-xs hover:bg-white/5">
                ← Modifica Setup
              </button>
              <button type="button" disabled={loading} onClick={callFinalGeneration} className="primary !w-auto !px-8">
                {loading ? "Auto-Rewrite & Validazione Attiva..." : `Genera Script & Beats (${duration}s) →`}
              </button>
            </div>
            {error && <p className="error">{error}</p>}
          </section>
        )}

        {/* STEP 4: DASHBOARD OUTPUT */}
        {currentStep === 4 && result && (
          <section className="space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <nav className="tabs !border-b-0">
                {dashboardTabs.map((item) => (
                  <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
                    {item}
                  </button>
                ))}
              </nav>
              <button type="button" onClick={() => setCurrentStep(0)} className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-400/20">
                + Nuovo Video
              </button>
            </div>

            {/* AUTO-TONE SHIFT BAR */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
              <span className="font-bold text-slate-300">⚡ Auto-Tone Shift:</span>
              <div className="flex flex-wrap gap-2">
                {["Smart", "Energetic", "Provocative", "Conversational", "Funny"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={loading || result.metadata.tone === t}
                    onClick={() => handleToneShift(t)}
                    className={`rounded px-3 py-1 font-semibold transition ${result.metadata.tone === t ? "bg-cyan-400 text-slate-950" : "bg-white/5 hover:bg-white/15"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <DashboardOutput
              tab={tab}
              result={result}
              history={history}
              calibration={calibration}
              safeZonePlatform={safeZonePlatform}
              editingBeatId={editingBeatId}
              beatPrompt={beatPrompt}
              updatingBeat={updatingBeat}
              renderingVideo={renderingVideo}
              renderStatus={renderStatus}
              onTriggerRenderEngine={handleTriggerRenderEngine}
              onSetSafeZonePlatform={setSafeZonePlatform}
              onSetEditingBeatId={setEditingBeatId}
              onSetBeatPrompt={setBeatPrompt}
              onRegenerateBeat={handleRegenerateBeat}
              onSaveCalibration={handleSaveCalibration}
              onUpdateAnalytics={updateAnalytics}
              onClearMemory={async () => {
                await clearAllMemoriesFromDB();
                setHistory([]);
              }}
              onToggleAsset={toggleAsset}
              onToggleTask={toggleTask}
            />
          </section>
        )}
      </div>
    </main>
  );
}

function DashboardOutput({
  tab,
  result,
  history,
  calibration,
  safeZonePlatform,
  editingBeatId,
  beatPrompt,
  updatingBeat,
  renderingVideo,
  renderStatus,
  onTriggerRenderEngine,
  onSetSafeZonePlatform,
  onSetEditingBeatId,
  onSetBeatPrompt,
  onRegenerateBeat,
  onSaveCalibration,
  onUpdateAnalytics,
  onClearMemory,
  onToggleAsset,
  onToggleTask,
}: any) {
  // PRODUCTION MODE CON AUTO-RENDER MULTI-SCENA
  if (tab === "Production Mode") {
    return (
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">PRODUCTION READINESS</p>
              <h2 className="text-2xl font-bold">Video Ready: {result.productionReadiness}%</h2>
            </div>
            <div className="stat"><span>Stato</span><strong>{result.productionReadiness >= 80 ? "✓ Pronto a registrare" : "⚠ Raccogli gli asset"}</strong></div>
          </div>

          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <b className="text-emerald-300 block text-sm">🎬 Auto-Render Engine (Multi-Clip & Story Beats)</b>
                <span className="text-xs text-slate-300">Genera tagli sincronizzati ai beat, zoom dinamico e salva in output_renders/</span>
              </div>
              <button
                type="button"
                disabled={renderingVideo}
                onClick={onTriggerRenderEngine}
                className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-300 transition"
              >
                {renderingVideo ? "Montaggio in corso..." : "Avvia Render MP4"}
              </button>
            </div>
            {renderStatus && (
              <p className="text-xs font-mono text-emerald-200 border-t border-emerald-500/20 pt-2">{renderStatus}</p>
            )}
          </div>

          <h3>Checklist di Produzione</h3>
          <div className="list">
            {result.productionTasks?.map((task: any) => (
              <label key={task.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm hover:bg-white/[0.05]">
                <input type="checkbox" checked={task.completed} onChange={() => onToggleTask(task.id)} className="mt-1" />
                <div>
                  <b className="text-cyan-300">[{task.category}] {task.title}</b>
                  <p className="text-xs text-slate-400">{task.detail}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="panel space-y-4">
          <p className="eyebrow">ASSET ENGINE</p>
          <h3>Asset Richiesti & Istruzioni Scatto</h3>
          <div className="space-y-3">
            {result.assets?.map((asset: any) => (
              <div key={asset.id} className={`rounded-lg border p-3 text-xs transition ${asset.available ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                <div className="flex items-center justify-between font-bold">
                  <span>{asset.asset} ({asset.source})</span>
                  <button type="button" onClick={() => onToggleAsset(asset.id)} className="rounded px-2 py-1 bg-white/10 hover:bg-white/20">
                    {asset.available ? "✓ Disponibile" : "○ Segna Pronto"}
                  </button>
                </div>
                <p className="mt-1 text-slate-300"><b>Istruzioni:</b> {asset.captureInstructions}</p>
                <p className="mt-1 text-slate-400"><b>Tempo:</b> ~{asset.timeEstimateMin} min · <b>Fallback:</b> {asset.fallback}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // SAFE-ZONE MASK
  if (tab === "Safe-Zone Mask") {
    return (
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col items-center">
          <div className="mb-3 flex gap-2">
            {(["tiktok", "reels", "shorts"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onSetSafeZonePlatform(p)}
                className={`rounded px-3 py-1 text-xs font-bold uppercase transition ${safeZonePlatform === p ? "bg-cyan-400 text-slate-950" : "bg-white/10 text-slate-300 hover:bg-white/20"}`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="relative aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-[2rem] border-4 border-slate-700 bg-slate-950 shadow-2xl">
            <div className="absolute inset-0 flex flex-col justify-center p-6 text-center">
              <span className="font-mono text-[10px] text-cyan-400 uppercase tracking-widest">[Safe Zone 30%-60%]</span>
              <h3 className="mt-2 text-base font-black text-white">{result.timeline[0]?.overlayText || result.script.title}</h3>
              <p className="mt-3 text-xs text-slate-300 font-medium leading-relaxed bg-black/60 p-2.5 rounded-lg backdrop-blur-sm">
                "{result.hooks[0]?.text}"
              </p>
            </div>

            {safeZonePlatform === "tiktok" && (
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
                <div className="flex justify-between items-center text-[10px] font-bold text-white/50 pt-2">
                  <span>LIVE</span>
                  <span>Seguiti | Per te</span>
                  <span>🔍</span>
                </div>
                <div className="flex justify-between items-end pb-3">
                  <div className="max-w-[70%] space-y-1 text-left text-[11px] text-white">
                    <p className="font-bold">@creator_studio</p>
                    <p className="text-[10px] text-white/80 line-clamp-2">Guarda fino alla fine per la spiegazione completa...</p>
                  </div>
                  <div className="flex flex-col items-center gap-3 text-white">
                    <div className="h-7 w-7 rounded-full bg-rose-500/80 border border-white flex items-center justify-center text-[10px] font-bold">♥</div>
                    <span className="text-[9px]">48.2K</span>
                  </div>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-12 bottom-24 border-y border-dashed border-cyan-400/40 bg-cyan-400/5 flex items-center justify-center">
              <span className="text-[10px] text-cyan-300 font-mono tracking-wider opacity-60">SAFE AREA OTTIMALE</span>
            </div>
          </div>
        </div>

        <div className="panel space-y-4">
          <p className="eyebrow">SAFE-ZONE COMPLIANCE</p>
          <h2 className="text-xl font-bold">Posizionamento Testi e Grafiche</h2>
          <div className="space-y-3 pt-2">
            {result.timeline.map((beat: any, idx: number) => (
              <div key={idx} className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-cyan-300">0:{String(beat.startTime).padStart(2, "0")}s — [{beat.section}]</span>
                  <span className="text-emerald-400">Posizione: {beat.continuity?.safeZonePlacement || "top-35-center"}</span>
                </div>
                <p className="text-slate-200"><b>Overlay:</b> {beat.overlayText}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // JUMP-CUT & VISUALS
  if (tab === "Jump-Cut & Visuals") {
    return (
      <div className="panel space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">VISUAL CONTINUITY & RHYTHM PLANNER</p>
            <h2 className="text-xl font-bold">Piano Inquadrature & Raccordi Jump-Cut</h2>
          </div>
          <span className="stat text-xs"><b>Alternanza:</b> ogni 2.5s - 3.5s</span>
        </div>

        <div className="space-y-3 pt-2">
          {result.timeline.map((beat: any, idx: number) => (
            <div key={idx} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold">
                <span className="text-cyan-300 uppercase">
                  [{beat.section}] 0:{String(beat.startTime).padStart(2, "0")}s - 0:{String(beat.endTime).padStart(2, "0")}s ({beat.duration}s)
                </span>
                <span className="rounded bg-cyan-400/20 text-cyan-300 px-2.5 py-0.5 border border-cyan-400/40">
                  Zoom: {beat.continuity?.zoomFactor || "1.0x"} ({beat.continuity?.shotScale || "medium"})
                </span>
              </div>
              <p className="text-sm text-slate-200">"{beat.spokenText}"</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-white/5 text-[11px] text-slate-300">
                <div><b>👁 Sguardo:</b> {beat.continuity?.eyeLine || "direct-camera"}</div>
                <div><b>✋ Mani:</b> {beat.continuity?.handPosition || "resting"}</div>
                <div><b>🎬 Taglio:</b> {beat.continuity?.cutTransitionReason || "Zoom di stacco"}</div>
                <div><b>📐 Safe-Area:</b> {beat.continuity?.safeZonePlacement || "top-35-center"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // MULTI-PLATFORM SEO
  if (tab === "Multi-Platform SEO") {
    const platforms = result.multiPlatformSEO || [];
    return (
      <div className="space-y-6">
        <div className="panel space-y-2">
          <p className="eyebrow">MULTI-PLATFORM SEO & CAPTION ENGINE</p>
          <h2 className="text-xl font-bold">Pacchetti di Pubblicazione Ottimizzati</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {platforms.map((p: any) => (
            <div key={p.platform} className="panel flex flex-col justify-between space-y-4 border-cyan-400/20">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="eyebrow font-mono uppercase">{p.platform}</span>
                  <span className="stat !p-1 text-[10px] text-cyan-300">Target Ottimizzato</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-bold">Titolo / Apertura:</span>
                  <p className="text-xs font-bold text-white">{p.titleOrHook}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-bold">Caption:</span>
                  <div className="rounded-lg bg-black/40 p-3 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-[180px] overflow-y-auto">
                    {p.caption}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-bold">Hashtag:</span>
                  <div className="flex flex-wrap gap-1">
                    {p.hashtags?.map((h: string) => (
                      <span key={h} className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-cyan-300">
                        {h.startsWith("#") ? h : `#${h}`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${p.caption}\n\n${p.hashtags?.join(" ")}`);
                  alert(`Copiato per ${p.platform.toUpperCase()}!`);
                }}
                className="primary !py-1.5 text-xs"
              >
                Copia Caption & Tag
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // SOUND DESIGN MATRIX
  if (tab === "Sound Design Matrix") {
    const report = result.pacingReport || {};
    return (
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">SFX TRIGGER MATRIX</p>
              <h2 className="text-xl font-bold">Tabella Trigger Effetti Audio</h2>
            </div>
            <span className="stat text-xs"><b>{report.sfxTimeline?.length || 0}</b> Punti SFX</span>
          </div>

          <div className="space-y-2">
            {report.sfxTimeline?.map((sfx: any) => (
              <div key={sfx.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs">
                <div>
                  <b className="text-cyan-300 uppercase font-mono">[{sfx.sfxType}]</b>
                  <p className="text-[11px] text-slate-300 mt-0.5">{sfx.reason}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-cyan-400 font-bold block">0:{String(sfx.timestampSec).padStart(2, "0")}s</span>
                  <span className="text-[10px] text-slate-400">Vol: {sfx.volumePercent || 80}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel space-y-4">
          <p className="eyebrow">MUSIC BPM & GENRE</p>
          <h3>Colonna Sonora Consigliata</h3>
          <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4 text-xs space-y-2">
            <p className="text-slate-300"><b>BPM Ideale:</b> <span className="text-cyan-300 font-bold text-sm">{report.recommendedMusicBpm || 120} BPM</span></p>
            <p className="text-slate-300"><b>Genere:</b> {report.musicGenre || "Tech Minimal Synth"}</p>
          </div>
        </div>
      </div>
    );
  }

  // CAROUSEL & REPURPOSE
  if (tab === "Carousel & Repurpose") {
    const rep = result.repurposed || {};
    return (
      <div className="space-y-6">
        <div className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">REPURPOSING HUB</p>
              <h2 className="text-xl font-bold">Instagram & LinkedIn Carousel ({rep.carouselSlides?.length || 0} Slides)</h2>
            </div>
            <span className="text-xs text-slate-400">Formato 4:5</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rep.carouselSlides?.map((slide: any) => (
              <div key={slide.slideNumber} className="relative flex flex-col justify-between rounded-xl border border-white/10 bg-slate-900/90 p-4 aspect-[4/5] shadow-lg">
                <div className="flex justify-between text-[11px] font-mono text-cyan-400 border-b border-white/10 pb-2">
                  <span className="uppercase font-bold">{slide.type}</span>
                  <span>{slide.slideNumber}/{slide.totalSlides}</span>
                </div>
                <div className="my-auto space-y-2">
                  <h4 className="text-sm font-black text-white leading-snug">{slide.headline}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{slide.body}</p>
                </div>
                <div className="pt-2 border-t border-white/5 text-[10px] text-slate-500 italic">
                  🎨 {slide.visualPrompt}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="panel space-y-3">
            <p className="eyebrow">SOCIAL THREAD (X / LINKEDIN)</p>
            <div className="space-y-2">
              {rep.socialThread?.map((post: string, idx: number) => (
                <div key={idx} className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs">
                  <span className="font-mono text-cyan-400 font-bold block mb-1">Post {idx + 1}/{rep.socialThread.length}</span>
                  <p className="text-slate-200 whitespace-pre-wrap">{post}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel space-y-3">
            <p className="eyebrow">NEWSLETTER SECTION</p>
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-xs">
              <pre className="whitespace-pre-wrap font-sans text-slate-200 leading-relaxed">{rep.newsletterSection}</pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // BEAT EDITOR
  if (tab === "Beat Editor") {
    return (
      <div className="panel space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">GRANULAR BEAT CONTROL</p>
            <h2 className="text-xl font-bold">Modifica e Rigenera Singoli Beat</h2>
          </div>
          <p className="text-xs text-slate-400">Ricalcola automaticamente la timeline deterministica</p>
        </div>

        <div className="space-y-3">
          {result.beats?.map((b: any) => (
            <div key={b.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold">
                <span className="text-cyan-300 uppercase">[{b.type}] Beat #{b.id} · {b.durationSec}s ({b.wordCount} parole)</span>
                <button
                  type="button"
                  onClick={() => { onSetEditingBeatId(editingBeatId === b.id ? null : b.id); onSetBeatPrompt(""); }}
                  className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
                >
                  {editingBeatId === b.id ? "Annulla" : "✏ Modifica con AI"}
                </button>
              </div>
              <p className="text-sm text-slate-200">{b.spokenText}</p>

              {editingBeatId === b.id && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                  <input
                    value={beatPrompt}
                    onChange={(e) => onSetBeatPrompt(e.target.value)}
                    placeholder="Es. Rendi il reveal più drammatico, accorcia di 3 parole..."
                    className="!text-xs"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={updatingBeat || !beatPrompt.trim()}
                      onClick={() => onRegenerateBeat(b.id)}
                      className="primary !w-auto !px-4 !py-1.5 text-xs"
                    >
                      {updatingBeat ? "Riscrivendo..." : "Applica Riscrittura Beat"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // OVERVIEW
  if (tab === "Overview") {
    return (
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel">
          <p className="eyebrow">[{result.pillar}] {result.script.title}</p>
          <h2 className="mt-2 text-2xl font-bold">{result.strategy.selectedAngle}</h2>
          <p className="mt-4 text-lg">“{result.hooks[0]?.text}”</p>
          <div className="score-row">
            {[["Content", result.strategy.contentScore], ["Retention", result.strategy.retentionScore], ["Readiness", `${result.productionReadiness}%`]].map(([label, value]) => (
              <div key={String(label)} className="stat"><span>{label}</span><strong>{value}</strong></div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h3>Duration Engine Report</h3>
          <p className="ok">✓ Pipeline Validata ({result.metadata.rewriteAttempts} iterazioni)</p>
          <p>{result.metadata.wordCount} parole · {result.metadata.durationEstimated}s calcolati ({result.metadata.wpm} WPM)</p>
          <p className="text-xs text-slate-400 mt-2">Tono: <b className="text-cyan-300">{result.metadata.tone}</b></p>
          {result.warnings?.map((w: string) => <p className="warning" key={w}>{w}</p>)}
        </div>
      </div>
    );
  }

  // MEMORY BRAIN (INDEXEDDB)
  if (tab === "Memory Brain (IndexedDB)") {
    return (
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">INDEXEDDB ARCHIVE</p>
              <h2 className="text-2xl font-bold">Libreria Video ({history.length})</h2>
            </div>
            {history.length > 0 && <button type="button" onClick={onClearMemory} className="text-xs text-rose-400 hover:underline">Azzera Database</button>}
          </div>
          <div className="space-y-3">
            {history.map((item: any) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2 text-xs">
                <div className="flex justify-between font-bold text-cyan-300">
                  <span>[{item.pillar}] {item.topic}</span>
                  <span className="text-slate-400">{item.createdAt}</span>
                </div>
                <p className="text-slate-300"><b>Hook:</b> “{item.hook}”</p>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                  <label>Views<input type="number" value={item.analytics?.views || 0} onChange={(e) => onUpdateAnalytics(item.id, "views", Number(e.target.value))} className="!p-1 text-xs" /></label>
                  <label>Ret. 3s (%)<input type="number" value={item.analytics?.retention3s || 0} onChange={(e) => onUpdateAnalytics(item.id, "retention3s", Number(e.target.value))} className="!p-1 text-xs" /></label>
                  <label>Comp. (%)<input type="number" value={item.analytics?.completionRate || 0} onChange={(e) => onUpdateAnalytics(item.id, "completionRate", Number(e.target.value))} className="!p-1 text-xs" /></label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel space-y-4">
          <p className="eyebrow">CREATOR CALIBRATION</p>
          <h3>Velocità di Lettura (WPM)</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label>Media<input type="number" value={calibration.averageWpm} onChange={(e) => onSaveCalibration({ ...calibration, averageWpm: Number(e.target.value) })} /></label>
            <label>Hook<input type="number" value={calibration.hookWpm} onChange={(e) => onSaveCalibration({ ...calibration, hookWpm: Number(e.target.value) })} /></label>
            <label>Explainer<input type="number" value={calibration.explainerWpm} onChange={(e) => onSaveCalibration({ ...calibration, explainerWpm: Number(e.target.value) })} /></label>
            <label>Reveal<input type="number" value={calibration.revealWpm} onChange={(e) => onSaveCalibration({ ...calibration, revealWpm: Number(e.target.value) })} /></label>
          </div>
        </div>
      </div>
    );
  }

  // SCRIPT & STORYBOARD
  if (tab === "Script") return <div className="grid gap-5 lg:grid-cols-2"><TextPanel title="Clean script" body={result.script.clean} /><TextPanel title="Performance script" body={result.voiceoverGuide} /></div>;
  if (tab === "Storyboard") {
    return (
      <div className="panel">
        <h2>Timeline Story Beats</h2>
        <div className="timeline">
          {result.timeline.map((part: any) => (
            <article key={part.startTime} style={{ flexGrow: part.duration }}>
              <b>{part.startTime}s–{part.endTime}s</b>
              <strong>{part.section}</strong>
              <span>{part.visual}</span>
              <small>{part.overlayText}</small>
            </article>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

const TextPanel = ({ title, body }: { title: string; body: string }) => <div className="panel"><h3>{title}</h3><pre>{body}</pre></div>;