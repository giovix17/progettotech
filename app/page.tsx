"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormEvent, useEffect, useMemo, useState } from "react";
import { 
  ContentType, 
  VideoStyle, 
  ContentPillar, 
  CONTENT_PILLARS, 
  ContentMemory, 
  CreatorCalibration,
  calculateReadinessScore,
  computePerformanceLearnings 
} from "@/lib/content";
import { createDurationBudget } from "@/lib/duration";

const durations = [15, 20, 30, 45, 60, 90, 120];
const types: { value: ContentType; label: string }[] = [
  { value: "auto", label: "Auto" }, { value: "news", label: "News" }, { value: "explainer", label: "Explainer" },
  { value: "review", label: "Review" }, { value: "comparison", label: "X vs Y" }, { value: "ranking", label: "Ranking" },
  { value: "opinion", label: "Opinion" }, { value: "tutorial", label: "Tutorial" }, { value: "storytelling", label: "Storytelling" }
];
const styles: { value: VideoStyle; label: string }[] = [
  { value: "faceless-voiceover", label: "Faceless voiceover" }, { value: "screen-recording", label: "Screen recording" },
  { value: "product-focus", label: "Product focus" }, { value: "news-fast", label: "News fast-paced" },
  { value: "cinematic-tech", label: "Cinematic tech" }, { value: "explainer", label: "Explainer" },
  { value: "list-ranking", label: "List / ranking" }, { value: "storytelling", label: "Storytelling" }, { value: "hybrid", label: "Hybrid" }
];
const tabs = ["Overview", "Production Mode", "Memory Brain", "Script", "Storyboard", "Record", "Edit", "Publish", "Test"] as const;

const defaultCalibration: CreatorCalibration = {
  averageWpm: 152,
  hookWpm: 164,
  explainerWpm: 146,
  revealWpm: 132,
  ctaWpm: 150
};

export default function Page() {
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [product, setProduct] = useState("");
  const [duration, setDuration] = useState(30);
  const [contentType, setContentType] = useState<ContentType>("auto");
  const [pillar, setPillar] = useState<ContentPillar>("Tech & Gadget");
  const [videoStyle, setVideoStyle] = useState<VideoStyle>("faceless-voiceover");
  const [tone, setTone] = useState("Smart");
  const [researchMode, setResearchMode] = useState(false);
  const [strategy, setStrategy] = useState<any>();
  const [angle, setAngle] = useState("");
  const [hook, setHook] = useState("");
  const [result, setResult] = useState<any>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [history, setHistory] = useState<ContentMemory[]>([]);
  const [calibration, setCalibration] = useState<CreatorCalibration>(defaultCalibration);

  useEffect(() => {
    const savedMem = localStorage.getItem("content_brain_memory");
    if (savedMem) {
      try { setHistory(JSON.parse(savedMem)); } catch {}
    }
    const savedCal = localStorage.getItem("creator_voice_calibration");
    if (savedCal) {
      try { setCalibration(JSON.parse(savedCal)); } catch {}
    }
  }, []);

  const saveCalibration = (newCal: CreatorCalibration) => {
    setCalibration(newCal);
    localStorage.setItem("creator_voice_calibration", JSON.stringify(newCal));
  };

  const saveToMemory = (savedResult: any) => {
    const memoryItem: ContentMemory = {
      id: savedResult.id || `mem-${Date.now()}`,
      topic,
      pillar,
      angle: savedResult.strategy?.selectedAngle || angle,
      hook: savedResult.hooks[0]?.text || hook,
      hookType: savedResult.hookType || "curiosity",
      contentType,
      duration,
      keyTakeaway: savedResult.script.title,
      createdAt: new Date().toLocaleDateString("it-IT"),
      analytics: { views: 0, watchTimeSec: 0, completionRate: 0, retention3s: 0, shares: 0, saves: 0, comments: 0 }
    };
    const updated = [memoryItem, ...history];
    setHistory(updated);
    localStorage.setItem("content_brain_memory", JSON.stringify(updated));
  };

  const updateAnalytics = (id: string, field: "views" | "retention3s" | "completionRate", val: number) => {
    const updated = history.map((h) => {
      if (h.id === id) {
        const a = h.analytics || { views: 0, watchTimeSec: 0, completionRate: 0, retention3s: 0, shares: 0, saves: 0, comments: 0 };
        return { ...h, analytics: { ...a, [field]: val } };
      }
      return h;
    });
    setHistory(updated);
    localStorage.setItem("content_brain_memory", JSON.stringify(updated));
  };

  const clearMemory = () => {
    setHistory([]);
    localStorage.removeItem("content_brain_memory");
  };

  const budget = useMemo(() => createDurationBudget(duration, "natural", contentType, calibration), [duration, contentType, calibration]);
  const learnings = useMemo(() => computePerformanceLearnings(history), [history]);

  const input = { 
    topic, notes, product, duration, contentType, videoStyle, pillar, 
    tone, language: "it", researchMode, selectedAngle: angle, selectedHook: hook, 
    speakingRate: "natural" as const, history, calibration, learnings 
  };

  async function call(stage: "strategy" | "generate") {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, stage })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (stage === "strategy") {
        setStrategy(body.data);
        setAngle(body.data.angles[0]?.title || "");
        setHook(body.data.hooks[0]?.text || "");
      } else {
        setResult(body.data);
        saveToMemory(body.data);
        setTab("Production Mode");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Errore di generazione.");
    } finally {
      setLoading(false);
    }
  }

  const toggleAsset = (assetId: string) => {
    if (!result) return;
    const updatedAssets = result.assets.map((a: any) => a.id === assetId ? { ...a, available: !a.available } : a);
    const newScore = calculateReadinessScore(updatedAssets, true);
    setResult({ ...result, assets: updatedAssets, productionReadiness: newScore });
  };

  const toggleTask = (taskId: string) => {
    if (!result) return;
    const updatedTasks = result.productionTasks.map((t: any) => t.id === taskId ? { ...t, completed: !t.completed } : t);
    setResult({ ...result, productionTasks: updatedTasks });
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
            <p className="eyebrow">AI CONTENT STUDIO · ADAPTIVE LEARNING OS</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">Dall’idea al video,<br /><span className="gradient-text">guidato dalle tue metriche reali.</span></h1>
          </div>
          <div className="flex gap-3">
            <div className="stat"><span>Calibrazione Voce</span><strong>{calibration.averageWpm} WPM</strong></div>
            <div className="stat"><span>Target Duration</span><strong>{duration}s · {budget.targetWords}w</strong></div>
          </div>
        </header>

        <form onSubmit={(e: FormEvent) => { e.preventDefault(); call("strategy"); }} className="panel space-y-7">
          <div className="section-title"><span className="step">01</span><div><h2>Che video vuoi creare?</h2><p>Inserisci topic e pillar editoriale.</p></div></div>
          
          <div className="grid gap-4 md:grid-cols-3">
            <label className="md:col-span-2">Idea / argomento<input required value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Es. Perché NVIDIA vale così tanto?" /></label>
            <label>Content Pillar
              <select value={pillar} onChange={(e) => setPillar(e.target.value as ContentPillar)}>
                {CONTENT_PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label>Prodotto (opzionale)<input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Es. iPhone 17 Pro" /></label>
            <label>Note personali<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Angolo, esperienza personale, fonti…" /></label>
          </div>

          <section>
            <div className="section-title"><span className="step">02</span><div><h2>Formato & Durata Calcolata</h2><p>Adattati al tuo ritmo vocale calibrato.</p></div></div>
            <div className="choice-grid">{types.map((item) => <Card key={item.value} active={contentType === item.value} onClick={() => setContentType(item.value)}><strong>{item.label}</strong></Card>)}</div>
            <div className="choice-grid duration-grid mt-3">{durations.map((seconds) => <Card key={seconds} active={duration === seconds} onClick={() => setDuration(seconds)}><strong>{seconds}s</strong></Card>)}
              <label className="custom">Custom<input type="number" min="10" max="180" value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <label>Stile<select value={videoStyle} onChange={(e) => setVideoStyle(e.target.value as VideoStyle)}>{styles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label>Tono<select value={tone} onChange={(e) => setTone(e.target.value)}>{["Smart", "Conversational", "Energetic", "Premium", "Funny", "Provocative", "Educational", "Analytical"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="research"><input type="checkbox" checked={researchMode} onChange={(e) => setResearchMode(e.target.checked)} /> Research mode <small>Fact-checking attivo</small></label>
          </section>

          <button className="primary" disabled={loading}>{loading ? "Analisi & Memory Brain attivo…" : "Verifica memoria e trova angoli"}</button>
          {error && <p className="error">{error}</p>}
        </form>

        {strategy && (
          <section className="panel space-y-6">
            {strategy.memoryAudit?.repetitionWarnings?.length > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                <b className="text-amber-300">⚠ CONTENT BRAIN ALERT: Possibili Ripetizioni</b>
                <ul className="mt-2 space-y-1 text-xs text-amber-200">
                  {strategy.memoryAudit.repetitionWarnings.map((w: string, i: number) => <li key={i}>• {w}</li>)}
                </ul>
              </div>
            )}

            <div className="section-title"><span className="step">04</span><div><h2>Scegli Angolo e Hook strategico</h2><p>{strategy.topicAnalysis?.whyItMatters}</p></div></div>
            <div>
              <h3>Content angles</h3>
              <div className="grid gap-3 md:grid-cols-3">{strategy.angles.map((item: any) => <Card key={item.title} active={angle === item.title} onClick={() => setAngle(item.title)}><b>{item.score}/100</b><strong>{item.title}</strong><p>{item.rationale}</p></Card>)}</div>
            </div>
            <div>
              <h3>Hook engine</h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{strategy.hooks.map((item: any) => <Card key={item.text} active={hook === item.text} onClick={() => setHook(item.text)}><b>{item.type} · {item.score}/100</b><strong>“{item.text}”</strong><p>Visual: {item.visual}</p></Card>)}</div>
            </div>
            <button className="primary" type="button" disabled={loading} onClick={() => call("generate")}>{loading ? "Pipeline deterministica in corso…" : `Genera video (${duration}s)`}</button>
          </section>
        )}

        {result && (
          <section className="space-y-5">
            <nav className="tabs">{tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
            <Output 
              tab={tab} 
              result={result} 
              history={history} 
              learnings={learnings}
              calibration={calibration}
              onSaveCalibration={saveCalibration}
              onUpdateAnalytics={updateAnalytics}
              onClearMemory={clearMemory} 
              onToggleAsset={toggleAsset} 
              onToggleTask={toggleTask} 
            />
          </section>
        )}
      </div>
    </main>
  );
}

function Output({ 
  tab, 
  result, 
  history, 
  learnings,
  calibration,
  onSaveCalibration,
  onUpdateAnalytics,
  onClearMemory, 
  onToggleAsset, 
  onToggleTask 
}: { 
  tab: string; 
  result: any; 
  history: ContentMemory[]; 
  learnings: any;
  calibration: CreatorCalibration;
  onSaveCalibration: (c: CreatorCalibration) => void;
  onUpdateAnalytics: (id: string, field: "views" | "retention3s" | "completionRate", val: number) => void;
  onClearMemory: () => void; 
  onToggleAsset: (id: string) => void; 
  onToggleTask: (id: string) => void 
}) {
  if (tab === "Memory Brain") {
    return (
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">PERFORMANCE LEARNING ENGINE</p>
              <h2 className="text-2xl font-bold">Libreria & Analytics Post-Publish</h2>
            </div>
            {history.length > 0 && (
              <button type="button" onClick={onClearMemory} className="text-xs text-rose-400 hover:underline">Azzera memoria</button>
            )}
          </div>
          <div className="space-y-3">
            {history.map((item) => (
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
          <p className="eyebrow">CREATOR VOICE & CALIBRATION</p>
          <h3>Calibrazione Velocità Reale (WPM)</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label>Media Generale<input type="number" value={calibration.averageWpm} onChange={(e) => onSaveCalibration({ ...calibration, averageWpm: Number(e.target.value) })} /></label>
            <label>Hook Speed<input type="number" value={calibration.hookWpm} onChange={(e) => onSaveCalibration({ ...calibration, hookWpm: Number(e.target.value) })} /></label>
            <label>Explainer Speed<input type="number" value={calibration.explainerWpm} onChange={(e) => onSaveCalibration({ ...calibration, explainerWpm: Number(e.target.value) })} /></label>
            <label>Reveal Speed<input type="number" value={calibration.revealWpm} onChange={(e) => onSaveCalibration({ ...calibration, revealWpm: Number(e.target.value) })} /></label>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
            <p className="eyebrow">LEARNING INSIGHTS</p>
            <ul className="space-y-1 text-xs text-cyan-200">
              {learnings.insights.map((ins: string, i: number) => <li key={i}>• {ins}</li>)}
            </ul>
          </div>
        </div>
      </div>
    );
  }

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
          <p className="eyebrow">ASSET AVAILABILITY ENGINE</p>
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
          <h3>Deterministic Engine Status</h3>
          <p className="ok">✓ Calibrato su {calibration.averageWpm} WPM ({result.metadata.rewriteAttempts} iterazioni)</p>
          <p>{result.metadata.wordCount} parole · {result.metadata.durationEstimated}s calcolati</p>
          {result.warnings?.map((warning: string) => <p className="warning" key={warning}>{warning}</p>)}
        </div>
      </div>
    );
  }

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
        <div className="list">
          {result.timeline.map((part: any) => (
            <article key={part.startTime}>
              <b>{part.startTime}s · {part.section}</b>
              <p>{part.spokenText}</p>
              <p>Visual: {part.visual} · {part.editingInstruction}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }
  if (tab === "Record") return <div className="grid gap-5 lg:grid-cols-2"><TextPanel title="Voiceover guide" body={result.voiceoverGuide} /><ListPanel title="Shot list" items={result.bRollPlan.map((x: any) => `${x.shot}: ${x.visual} — ${x.action}`)} /><ListPanel title="Screen recording" items={result.screenRecordPlan.map((x: any) => `${x.step}. ${x.action} (${x.zoomFocus})`)} /></div>;
  if (tab === "Edit") return <div className="grid gap-5 lg:grid-cols-2"><ListPanel title="Editing timeline" items={result.editingPlan} /><ListPanel title="Subtitles" items={result.subtitles} /><ListPanel title="On-screen graphics" items={result.onScreenGraphics.map((x: any) => `${x.graphicType}: ${x.description} (${x.animationStyle})`)} /></div>;
  if (tab === "Publish") return <div className="grid gap-5 lg:grid-cols-2"><TextPanel title="Caption" body={result.publishing.caption} /><ListPanel title="Hashtags" items={result.publishing.hashtags} /><ListPanel title="Keywords" items={result.publishing.keywords} /><TextPanel title="CTA" body={result.publishing.cta} /></div>;
  return <div className="grid gap-5 lg:grid-cols-2"><ListPanel title="A/B hooks" items={result.abHooks.map((x: any) => `${x.angle}: ${x.script} — ${x.visualAction}`)} /><ListPanel title="Retention risks" items={result.retentionRisks} /><ListPanel title="Fact check" items={result.factCheck.map((x: any) => `${x.confidence}: ${x.claim} — ${x.note}`)} /></div>;
}

const TextPanel = ({ title, body }: { title: string; body: string }) => <div className="panel"><h3>{title}</h3><pre>{body}</pre></div>;
const ListPanel = ({ title, items }: { title: string; items: string[] }) => <div className="panel"><h3>{title}</h3><ul>{items.map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}</ul></div>;