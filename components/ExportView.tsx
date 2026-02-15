
import React, { useState, useMemo } from 'react';
import { Project, Shot } from '../types';
import { FileText, Package, Loader2, Sparkles, Palette, Wand2, Zap, ShieldAlert, Rocket } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import JSZip from 'jszip';

interface ExportViewProps {
  project: Project;
  onUpdateProject: (updater: Project | ((prev: Project) => Project)) => void;
  onApiError: (error: any) => void;
}

export const ExportView: React.FC<ExportViewProps> = ({ project, onUpdateProject, onApiError }) => {
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [refineDirective, setRefineDirective] = useState('Cinematic movie style, detailed textures, high fidelity lighting, smooth transition logic');
  
  // Use useMemo to avoid re-sorting on every render and fix mutation bug
  const sortedShots = useMemo(() => {
    return [...project.shots].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }, [project.shots]);

  const content = useMemo(() => {
    return sortedShots.map((s) => {
      return `${s.sequenceOrder}. [${s.topic}]
Visual Analysis: ${s.visualAnalysis}
Production Prompt: ${s.actionPrompt}`;
    }).join('\n\n---\n\n');
  }, [sortedShots]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRefineAll = async () => {
    if (project.shots.length === 0 || !refineDirective) return;
    setIsRefining(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = `You are an Aesthetic Master for Veo 3.1 cinematic sequences. Style: ${refineDirective}. Rewrite the action prompts to be descriptive and stylistically locked. Return JSON array.`;
      const shotData = sortedShots.map(s => ({ id: s.id, original_prompt: s.actionPrompt }));
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: systemInstruction }, { text: JSON.stringify(shotData) }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { id: { type: Type.STRING }, refined_prompt: { type: Type.STRING } },
              required: ['id', 'refined_prompt']
            }
          }
        }
      });
      const refinedData = JSON.parse(response.text || "[]");
      if (Array.isArray(refinedData)) {
        onUpdateProject(prev => ({
          ...prev,
          shots: prev.shots.map((shot) => {
            const refined = refinedData.find(r => r.id === shot.id);
            return refined ? { ...shot, actionPrompt: refined.refined_prompt } : shot;
          })
        }));
      }
    } catch (err) { onApiError(err); } finally { setIsRefining(false); }
  };

  const handleOptimizeVeo3 = async () => {
    if (project.shots.length === 0) return;
    setIsOptimizing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = `You are the Veo 3 Engine Optimizer. 1. COPYRIGHT SCRUBBING. 2. PROMPT DENSITY. 3. CINEMATIC LOGIC. Return JSON array.`;
      const shotData = sortedShots.map(s => ({ id: s.id, prompt: s.actionPrompt }));
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: systemInstruction }, { text: JSON.stringify(shotData) }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { id: { type: Type.STRING }, optimized_prompt: { type: Type.STRING } },
              required: ['id', 'optimized_prompt']
            }
          }
        }
      });
      const optimizedData = JSON.parse(response.text || "[]");
      if (Array.isArray(optimizedData)) {
        onUpdateProject(prev => ({
          ...prev,
          shots: prev.shots.map((shot) => {
            const opt = optimizedData.find(o => o.id === shot.id);
            return opt ? { ...shot, actionPrompt: opt.optimized_prompt } : shot;
          })
        }));
      }
    } catch (err) { onApiError(err); } finally { setIsOptimizing(false); }
  };

  const downloadZipPack = async () => {
    if (project.shots.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const imgFolder = zip.folder("production_frames");
      sortedShots.forEach((shot) => {
        const num = shot.sequenceOrder.toString().padStart(3, '0');
        if (shot.sourceImage) imgFolder?.file(`SHOT_${num}_A_START.png`, shot.sourceImage.split(',')[1], { base64: true });
        if (shot.targetImage) imgFolder?.file(`SHOT_${num}_B_END.png`, shot.targetImage.split(',')[1], { base64: true });
      });
      zip.file("MASTER_PRODUCTION_SCRIPT.txt", content);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.title.replace(/\s+/g, '_')}_Master_Pack.zip`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {} finally { setIsZipping(false); }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="border-b border-black/10 pb-6 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-black italic uppercase tracking-tighter">Production Master Pack</h2>
          <p className="text-[10px] text-black/40 font-black uppercase tracking-[0.4em] mt-2">Final Batch Sequence Suite</p>
        </div>
        <button onClick={downloadZipPack} disabled={isZipping || project.shots.length === 0} className="pencil-button px-8 py-4 font-black uppercase text-xs tracking-widest flex items-center gap-3 disabled:opacity-30">
          {isZipping ? <Loader2 className="animate-spin" size={18} /> : <Package size={18} />} Download ZIP
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="sketch-card p-8 rounded-[3rem] space-y-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none"><Palette size={160} /></div>
          <div className="flex items-center gap-4 text-black border-b border-black/5 pb-4">
             <Sparkles size={24} />
             <div>
               <h3 className="text-xl font-black text-black italic uppercase tracking-tighter leading-none">Aesthetic Overhaul</h3>
               <p className="text-[8px] font-black text-black/30 uppercase tracking-[0.3em] mt-1">Global Cinematic Style Injection</p>
             </div>
          </div>
          <div className="space-y-4 relative z-10">
            <label className="text-[9px] font-black uppercase text-black/40 tracking-[0.3em] flex items-center gap-2"><Zap size={12} /> Global Aesthetic Directive</label>
            <textarea value={refineDirective} onChange={(e) => setRefineDirective(e.target.value)} className="w-full h-32 bg-white border-2 border-black/10 rounded-2xl p-4 text-[11px] font-mono leading-relaxed outline-none focus:border-black transition-all resize-none shadow-inner" />
          </div>
          <button onClick={handleRefineAll} disabled={isRefining || project.shots.length === 0} className="w-full pencil-button py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-[0.3em] flex items-center justify-center gap-4">
            {isRefining ? <Loader2 className="animate-spin" /> : <Wand2 size={18} />} Apply Master Refinement
          </button>
        </div>

        <div className="sketch-card p-8 rounded-[3rem] space-y-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none"><Rocket size={160} /></div>
          <div className="flex items-center gap-4 text-red-600 border-b border-black/5 pb-4">
             <ShieldAlert size={24} />
             <div>
               <h3 className="text-xl font-black text-black italic uppercase tracking-tighter leading-none">Veo Optimizer</h3>
               <p className="text-[8px] font-black text-black/30 uppercase tracking-[0.3em] mt-1">Copyright Scrub & Tuning</p>
             </div>
          </div>
          <div className="space-y-4 relative z-10 flex-grow flex flex-col justify-center">
            <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
              <ul className="text-[10px] text-black/50 font-medium space-y-2 uppercase tracking-wide">
                <li>• Auto-removes copyrighted brand terms</li>
                <li>• Transforms text into efficient tokens</li>
                <li>• Optimizes for high-motion consistency</li>
              </ul>
            </div>
          </div>
          <button onClick={handleOptimizeVeo3} disabled={isOptimizing || project.shots.length === 0} className="w-full mt-auto bg-white border-2 border-red-500/40 text-red-600 py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-red-500 hover:text-white transition-all">
            {isOptimizing ? <Loader2 className="animate-spin" /> : <Rocket size={18} />} Action: Optimize Logic
          </button>
        </div>
      </div>

      <div className="sketch-card flex flex-col overflow-hidden">
        <div className="bg-black/5 p-6 border-b border-black/10 flex justify-between items-center">
          <span className="text-[10px] font-black uppercase text-black/60 tracking-[0.3em] flex items-center gap-2"><FileText size={14} /> Final Production Script</span>
          <button onClick={handleCopy} className={`px-6 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border ${copied ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' : 'bg-white border-black/10 text-black hover:border-black'}`}>{copied ? 'COPIED' : 'COPY ALL'}</button>
        </div>
        <pre className="p-8 text-xs font-mono text-black/60 leading-relaxed overflow-y-auto max-h-[600px] whitespace-pre-wrap selection:bg-black selection:text-white">
          {content || "No shots synthesized in current strip."}
        </pre>
      </div>
    </div>
  );
};
