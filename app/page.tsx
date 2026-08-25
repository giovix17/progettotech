'use client';

import React, { useState } from 'react';

export default function Page() {
  const [topic, setTopic] = useState('');
  const [targetProduct, setTargetProduct] = useState('');
  const [rawScript, setRawScript] = useState('');
  const [videoStyle, setVideoStyle] = useState('Faceless Tech Review (Ritmo Serrato)');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, targetProduct, rawScript, videoStyle }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Errore del server: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setResult(data.data);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Errore durante la generazione.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="border-b border-slate-800 pb-6">
          <div className="inline-block px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold rounded-full mb-3">
            Faceless Creator Edition • Voice & Graphics Suite
          </div>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
            Faceless Studio & Voiceover Controller
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Ottimizzato per registrazioni vocali reali, overlay grafici 2D/3D, screen-recording e asset visivi unici.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleGenerate} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Argomento / Topic</label>
              <input 
                type="text" 
                value={topic} 
                onChange={(e) => setTopic(e.target.value)} 
                placeholder="Es. Guida ai comandi terminale per sviluppatori" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Prodotto / Sponsor (Opzionale)</label>
              <input 
                type="text" 
                value={targetProduct} 
                onChange={(e) => setTargetProduct(e.target.value)} 
                placeholder="Es. VS Code Extension" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Stile Video Faceless</label>
              <select
                value={videoStyle}
                onChange={(e) => setVideoStyle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="Faceless Tech Review (Ritmo Serrato)">Faceless Tech (Ritmo Serrato)</option>
                <option value="Minimal & Dark Mode">Minimal & Dark Mode UI</option>
                <option value="Educational Screen-Recording">Educational / Screen Recording Focus</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Punti Chiave Video</label>
            <textarea 
              rows={3}
              value={rawScript} 
              onChange={(e) => setRawScript(e.target.value)} 
              placeholder="Inserisci i punti principali..." 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 font-extrabold text-slate-950 py-3.5 rounded-xl text-sm hover:opacity-90 cursor-pointer disabled:opacity-50 transition-all shadow-xl shadow-cyan-500/10"
          >
            {loading ? 'Generazione script con marcatori vocali & grafica...' : 'Genera Pacchetto Faceless Completo'}
          </button>
        </form>

        {/* Results */}
        {result && (
          <div className="space-y-8">

            {/* 1. VOICEOVER PACING & BREATHING GUIDE */}
            {result.voiceoverGuide && (
              <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-extrabold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                      🎙️ Voiceover Pacing & Breathing Guide (Per Registrazione Microfono)
                    </span>
                    <p className="text-xs text-slate-400 mt-1">Usa questa versione sul leggio/monitor mentre registri la tua voce.</p>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(result.voiceoverGuide, 'vo-guide')}
                    className="text-xs bg-cyan-950 hover:bg-cyan-900 text-cyan-300 px-3 py-1.5 rounded-lg border border-cyan-700/50 transition-all cursor-pointer"
                  >
                    {copiedKey === 'vo-guide' ? '✓ Copiato' : '📋 Copia Guida Registrazione'}
                  </button>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl text-slate-200 text-sm font-mono whitespace-pre-line leading-relaxed">
                  {result.voiceoverGuide}
                </div>
              </div>
            )}

            {/* 2. ON-SCREEN GRAPHICS & OVERLAYS */}
            {result.onScreenGraphics && (
              <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 space-y-4">
                <span className="text-xs font-extrabold text-purple-400 uppercase tracking-wider">
                  🖥️ On-Screen Graphics & Text Overlay Blueprint
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.onScreenGraphics.map((item: any, idx: number) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-mono text-cyan-400 font-bold">⏱️ {item.timestamp}</span>
                        <span className="bg-purple-950 text-purple-300 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-800/40">
                          {item.graphicType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 font-medium">{item.description}</p>
                      <div className="text-[11px] text-slate-400 border-t border-slate-900 pt-2">
                        ✨ Animazione: <strong className="text-slate-300">{item.animationStyle}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. SCREEN RECORDING ACTION PLAN */}
            {result.screenRecordPlan && (
              <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 space-y-4">
                <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                  📹 Screen Recording & Live Demo Action Plan
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {result.screenRecordPlan.map((rec: any, idx: number) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between text-xs mb-2">
                          <span className="font-mono text-emerald-400 font-bold">Step #{rec.step}</span>
                          <span className="text-slate-500 text-[10px]">{rec.duration}</span>
                        </div>
                        <p className="text-xs text-slate-200 font-semibold">{rec.action}</p>
                      </div>
                      <div className="text-[11px] text-slate-400 bg-slate-900 p-2 rounded border border-slate-800/80 mt-2">
                        🔍 Zoom Target: <span className="text-slate-300">{rec.zoomFocus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. MIDJOURNEY PROMPTS PER ASSET FACELESS */}
            {result.midjourneyPrompts && (
              <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 space-y-4">
                <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider">
                  🎨 Prompt Midjourney / DALL-E per Sfondi & Grafiche Uniche
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.midjourneyPrompts.map((mj: any, idx: number) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-amber-300">{mj.assetName}</span>
                        <span className="font-mono text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded">{mj.aspectRatio}</span>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-lg font-mono text-[11px] text-slate-300 relative group">
                        <p className="pr-12">{mj.prompt}</p>
                        <button
                          onClick={() => copyToClipboard(mj.prompt, `mj-${idx}`)}
                          className="absolute top-2 right-2 bg-amber-600 hover:bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                        >
                          {copiedKey === `mj-${idx}` ? '✓' : 'Copia'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* A/B HOOKS & CTA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {result.abHooks && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                  <span className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider">🎯 Intro A/B Testing</span>
                  <div className="space-y-3">
                    {result.abHooks.map((h: any, i: number) => (
                      <div key={i} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                        <span className="text-[10px] text-cyan-400 font-bold uppercase">{h.angle}</span>
                        <p className="text-slate-200 font-medium">&ldquo;{h.script}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.ctaStrategies && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                  <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">⚡ Opzioni CTA</span>
                  <div className="space-y-3">
                    {result.ctaStrategies.map((c: any, i: number) => (
                      <div key={i} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase">{c.objective}</span>
                        <p className="text-slate-200 font-medium">&ldquo;{c.scriptLine}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </main>
  );
}