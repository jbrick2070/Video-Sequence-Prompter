
import React, { useState, useRef, useCallback } from 'react';
import { Shot, Project, DraftingSlot } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Film, Trash2, Loader2, Plus, 
  Layers, X, ArrowRight, ArrowDownLeft, Zap, Workflow
} from 'lucide-react';

interface ShotGeneratorProps {
  project: Project;
  isStudioBusy: boolean;
  setIsStudioBusy: (busy: boolean) => void;
  onUpdateProject: (updater: Project | ((prev: Project) => Project)) => void;
  onNavigateToExport: () => void;
  onApiError?: (error: any, context?: string) => void;
}

type BatchProcessingMode = 'standard' | 'chained' | 'looper';

export const ShotGenerator: React.FC<ShotGeneratorProps> = ({ 
  project, isStudioBusy, setIsStudioBusy, onUpdateProject, onNavigateToExport, onApiError 
}) => {
  const [styleDirective, setStyleDirective] = useState<string>(
    "Cinematic storyboards, high-fidelity textures, detailed lighting, dynamic action sequence."
  );
  const [batchMode, setBatchMode] = useState<BatchProcessingMode>('chained');
  const [dragType, setDragType] = useState<string | null>(null);
  
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const updateDrafts = useCallback((updater: DraftingSlot[] | ((prev: DraftingSlot[]) => DraftingSlot[])) => {
    onUpdateProject(prev => ({
      ...prev,
      draftingSlots: typeof updater === 'function' ? updater(prev.draftingSlots || []) : updater
    }));
  }, [onUpdateProject]);

  const addPair = () => {
    updateDrafts(prev => [...prev, { 
      id: 'shot-' + Math.random().toString(36).substr(2, 9), 
      source: null, 
      target: null, 
      status: 'idle' 
    }]);
  };

  const handleNuclearReset = useCallback(() => {
    if (window.confirm("RESET EVERYTHING? This will delete all drafting work and the final sequence strip.")) {
      onUpdateProject((prev) => ({
        ...prev,
        shots: [],
        draftingSlots: [{ id: 'shot-' + Date.now(), source: null, target: null, status: 'idle' }],
        startingSequenceNumber: 1
      }));
      setDragType(null);
    }
  }, [onUpdateProject]);

  const removePendingPair = (id: string) => {
    updateDrafts(prev => {
      if (prev.length <= 1) {
        return [{ id: 'shot-' + Date.now(), source: null, target: null, status: 'idle' }];
      }
      return prev.filter(p => p.id !== id);
    });
  };

  const syncAlphaToBeta = (id: string) => {
    updateDrafts(prev => prev.map(p => 
      p.id === id ? { ...p, target: p.source } : p
    ));
  };

  const syncBetaToNext = (id: string) => {
    updateDrafts(prev => {
      const idx = prev.findIndex(p => p.id === id);
      if (idx !== -1 && idx < prev.length - 1) {
        const currentTarget = prev[idx].target;
        return prev.map((p, i) => i === idx + 1 ? { ...p, source: currentTarget } : p);
      }
      return prev;
    });
  };

  const processFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (id: string, file: File, type: 'source' | 'target') => {
    if (!file.type.startsWith('image/')) return;
    const base64 = await processFile(file);
    updateDrafts(prev => prev.map(p => 
      p.id === id ? { ...p, [type]: base64 } : p
    ));
  };

  const handleBatchDrop = async (e: React.DragEvent, type: 'alpha' | 'beta' | 'mixed') => {
    e.preventDefault();
    setDragType(null);
    const files = (Array.from(e.dataTransfer?.files || []) as File[]).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    const base64Files = await Promise.all(files.map(f => processFile(f)));

    updateDrafts(prev => {
      let currentPairs = [...prev.filter(p => p.source || p.target)];
      
      if (type === 'alpha') {
        base64Files.forEach((img, i) => {
          if (currentPairs[i]) currentPairs[i].source = img;
          else currentPairs.push({ id: 'b-a-' + i + Date.now(), source: img, target: null, status: 'idle' });
        });
      } else if (type === 'beta') {
        base64Files.forEach((img, i) => {
          if (currentPairs[i]) currentPairs[i].target = img;
          else currentPairs.push({ id: 'b-b-' + i + Date.now(), source: null, target: img, status: 'idle' });
        });
      } else {
        if (batchMode === 'chained') {
          base64Files.forEach((current, i) => {
            const next = base64Files[i + 1];
            currentPairs.push({ id: 'h-' + i + Date.now(), source: current, target: current, status: 'idle' });
            if (next) {
              currentPairs.push({ id: 'm-' + i + Date.now(), source: current, target: next, status: 'idle' });
            }
          });
        } else if (batchMode === 'looper') {
          base64Files.forEach((img, i) => {
            currentPairs.push({ id: 'l-' + i + Date.now(), source: img, target: img, status: 'idle' });
          });
        } else {
          for (let i = 0; i < base64Files.length; i += 2) {
            currentPairs.push({ id: 'p-' + i + Date.now(), source: base64Files[i], target: base64Files[i+1] || null, status: 'idle' });
          }
        }
      }
      return currentPairs.length > 0 ? currentPairs : [{ id: 'shot-' + Date.now(), source: null, target: null, status: 'idle' }];
    });
  };

  const handleDragOver = (e: React.DragEvent, type: string) => {
    e.preventDefault(); e.stopPropagation(); setDragType(type);
  };

  const handleDropSlot = async (e: React.DragEvent, id: string, type: 'source' | 'target') => {
    e.preventDefault(); e.stopPropagation(); setDragType(null);
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(id, file, type);
  };

  const triggerInput = (id: string, type: 'source' | 'target') => {
    fileInputRefs.current[`${id}-${type}`]?.click();
  };

  const processBatch = async () => {
    const validPairs = project.draftingSlots.filter(p => p.source && p.target && p.status !== 'completed');
    if (validPairs.length === 0) return;

    setIsStudioBusy(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    for (const pair of validPairs) {
      updateDrafts(prev => prev.map(p => p.id === pair.id ? { ...p, status: 'processing' } : p));
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { text: `Analyze cinematic motion between frames. Style: ${styleDirective}. Output JSON.` },
              { inlineData: { data: pair.source!.split(',')[1], mimeType: 'image/png' } },
              { inlineData: { data: pair.target!.split(',')[1], mimeType: 'image/png' } }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                analysis: { type: Type.STRING },
                prompt: { type: Type.STRING }
              },
              required: ['topic', 'analysis', 'prompt']
            }
          }
        });
        
        const result = JSON.parse(response.text || "{}");
        
        // Use functional updater to get latest state for sequence numbers
        onUpdateProject(prev => {
          const baseNum = prev.startingSequenceNumber || 1;
          const currentCount = baseNum + prev.shots.length;
          
          const newShot: Shot = {
            id: 'gen-' + Math.random().toString(36).substr(2, 9),
            sequenceOrder: currentCount,
            topic: result.topic || "Sequence",
            visualAnalysis: result.analysis,
            actionPrompt: result.prompt,
            sourceImage: pair.source!,
            targetImage: pair.target!,
            model: 'veo-3.1-generate-preview',
            aspectRatio: '16:9',
            resolution: '1080p'
          };
          
          return { ...prev, shots: [...prev.shots, newShot] };
        });
        
        updateDrafts(prev => prev.map(p => p.id === pair.id ? { ...p, status: 'completed' } : p));
      } catch (err) {
        updateDrafts(prev => prev.map(p => p.id === pair.id ? { ...p, status: 'error' } : p));
        if (onApiError) onApiError(err);
      }
    }
    
    setIsStudioBusy(false);
    updateDrafts(prev => {
        const filtered = prev.filter(p => p.status !== 'completed');
        return filtered.length > 0 ? filtered : [{ id: 'shot-' + Date.now(), source: null, target: null, status: 'idle' }];
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
      <div className="lg:col-span-6 space-y-8">
        <div className="sketch-card texture-dots relative flex flex-col h-[90vh]">
          <div className="sticky top-0 z-40 bg-[#F5F1EA] border-b-2 border-black/10 px-8 pt-8 pb-4 rounded-t-[3rem] shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-black text-white sketch-border"><Layers size={20} /></div>
                <div>
                  <h2 className="text-lg font-black text-black uppercase tracking-tighter leading-tight">Drafting Table</h2>
                  <p className="text-[9px] text-black/60 font-black uppercase tracking-widest">Mega Batch Hub</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-[7px] font-black uppercase text-black/50">Start #</span>
                  <input 
                    type="number" 
                    value={project.startingSequenceNumber || 1}
                    onChange={(e) => onUpdateProject(prev => ({ ...prev, startingSequenceNumber: parseInt(e.target.value) || 1 }))}
                    className="w-12 bg-white text-[10px] font-black text-center sketch-border p-0.5 outline-none focus:border-black"
                  />
                </div>
                <button onClick={addPair} className="pencil-button px-4 py-2 text-[9px] font-black uppercase flex items-center gap-2 shadow-sm active:translate-y-0.5 transition-all"><Plus size={12} /> Add</button>
                <button onClick={handleNuclearReset} className="pencil-button px-4 py-2 text-[9px] font-black uppercase bg-red-600 text-white border-red-900 hover:bg-red-500 flex items-center gap-2 active:translate-y-0.5 transition-all"><Trash2 size={12} /> Reset All</button>
              </div>
            </div>

            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[8px] font-black text-black/40 uppercase tracking-[0.3em] flex items-center gap-2"><Zap size={10}/> Batch Logic Mode</span>
                <div className="flex bg-black/5 p-1 rounded-lg border border-black/10">
                  <button onClick={() => setBatchMode('standard')} className={`px-3 py-1 text-[7px] font-black uppercase tracking-widest rounded transition-all ${batchMode === 'standard' ? 'bg-black text-white' : 'text-black/40 hover:text-black'}`}>Standard</button>
                  <button onClick={() => setBatchMode('chained')} className={`px-3 py-1 text-[7px] font-black uppercase tracking-widest rounded transition-all ${batchMode === 'chained' ? 'bg-black text-white' : 'text-black/40 hover:text-black'}`}>Chained</button>
                  <button onClick={() => setBatchMode('looper')} className={`px-3 py-1 text-[7px] font-black uppercase tracking-widest rounded transition-all ${batchMode === 'looper' ? 'bg-black text-white' : 'text-black/40 hover:text-black'}`}>Looper</button>
                </div>
              </div>

              <div onDragOver={e => handleDragOver(e, 'mixed')} onDrop={e => handleBatchDrop(e, 'mixed')} className={`h-14 border-2 border-dashed flex flex-col items-center justify-center texture-hatch transition-all cursor-pointer ${dragType === 'mixed' ? 'bg-black/10 border-black scale-[1.01]' : 'bg-black/5 border-black/20 hover:border-black/60'}`}>
                <div className="flex items-center gap-3">
                   <Workflow size={16} className="text-black/40" />
                   <span className="text-[9px] font-black uppercase text-black/60 tracking-[0.4em]">Drop Batch For {batchMode.toUpperCase()} Logic</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto p-8 custom-scrollbar space-y-8 pb-40">
            {project.draftingSlots.map((pair, idx) => (
              <div key={pair.id} className="relative p-6 border-2 border-black bg-white shadow-sm animate-in slide-in-from-left-2 transition-all hover:shadow-md">
                <div className="absolute top-0 left-0 bg-black text-white text-[9px] font-black px-3 py-1 uppercase tracking-widest">
                  Shot {(project.startingSequenceNumber || 1) + project.shots.length + idx}
                </div>
                
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 pt-4">
                  <div onClick={() => triggerInput(pair.id, 'source')} onDragOver={e => handleDragOver(e, `slot-${pair.id}-alpha`)} onDrop={e => handleDropSlot(e, pair.id, 'source')} className={`aspect-video bg-[#D8D0C5] border-2 flex items-center justify-center overflow-hidden cursor-pointer relative shadow-inner transition-all ${dragType === `slot-${pair.id}-alpha` ? 'border-black bg-white scale-[1.02]' : 'border-black/10 hover:border-black/40'}`}>
                    {pair.source ? <img src={pair.source} className="w-full h-full object-cover brightness-95" /> : <Plus className="text-black/20" size={24} />}
                    <div className="absolute bottom-1 right-1 text-[6px] font-black uppercase text-black/30">Alpha</div>
                    <input type="file" ref={el => { fileInputRefs.current[`${pair.id}-source`] = el; }} className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(pair.id, e.target.files[0], 'source')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => syncAlphaToBeta(pair.id)} title="Sync to Beta" className="p-1.5 hover:bg-black hover:text-white rounded-full text-black/20 transition-all active:scale-90"><ArrowRight size={14} /></button>
                  </div>
                  <div onClick={() => triggerInput(pair.id, 'target')} onDragOver={e => handleDragOver(e, `slot-${pair.id}-beta`)} onDrop={e => handleDropSlot(e, pair.id, 'target')} className={`aspect-video bg-[#D8D0C5] border-2 flex items-center justify-center overflow-hidden cursor-pointer relative shadow-inner transition-all ${dragType === `slot-${pair.id}-beta` ? 'border-black bg-white scale-[1.02]' : 'border-black/10 hover:border-black/40'}`}>
                    {pair.target ? <img src={pair.target} className="w-full h-full object-cover brightness-95" /> : <Plus className="text-black/20" size={24} />}
                    <div className="absolute bottom-1 right-1 text-[6px] font-black uppercase text-black/30">Beta</div>
                    <input type="file" ref={el => { fileInputRefs.current[`${pair.id}-target`] = el; }} className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(pair.id, e.target.files[0], 'target')} />
                  </div>
                </div>
                {idx < project.draftingSlots.length - 1 && (
                  <button onClick={() => syncBetaToNext(pair.id)} className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-10 bg-white border border-black/20 px-3 py-1 text-[7px] font-black uppercase shadow-sm flex items-center gap-2 hover:border-black hover:bg-black hover:text-white transition-all rounded-full">
                    <ArrowDownLeft size={8} /> Push to next alpha
                  </button>
                )}
                <button onClick={() => removePendingPair(pair.id)} className="absolute top-2 right-2 text-black/10 hover:text-black transition-colors"><X size={14} /></button>
                {pair.status === 'processing' && <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20 backdrop-blur-[1px]"><Loader2 className="animate-spin text-black" size={24} /></div>}
              </div>
            ))}

            <div className="pt-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-black/40 tracking-widest">Aesthetic Style Directive</label>
                <textarea value={styleDirective} onChange={e => setStyleDirective(e.target.value)} className="w-full h-24 bg-white border-2 border-black/10 p-4 text-[11px] font-mono leading-relaxed outline-none focus:border-black resize-none transition-all shadow-inner" placeholder="Cinematic textures, high fidelity lighting..." />
              </div>
              <button onClick={processBatch} disabled={isStudioBusy} className="w-full pencil-button py-6 text-sm font-black uppercase tracking-[0.4em] shadow-lg active:scale-[0.98] transition-all">
                {isStudioBusy ? <Loader2 className="animate-spin mx-auto" /> : 'EXECUTE DRAFT BATCH'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-6 space-y-8">
        <h3 className="text-2xl font-black text-black uppercase italic flex items-center gap-4"><Film className="text-black/20" /> Series Sequence</h3>
        <div className="space-y-6 overflow-y-auto h-[85vh] pr-4 custom-scrollbar pb-32">
          {project.shots.length === 0 ? (
            <div className="py-40 text-center border-4 border-dashed border-black/5 texture-hatch opacity-20">
              <span className="font-black uppercase text-xs tracking-[0.6em]">No Action Sketched</span>
            </div>
          ) : (
            [...project.shots].sort((a,b) => b.sequenceOrder - a.sequenceOrder).map((shot) => (
              <div key={shot.id} className="sketch-card p-6 group animate-in fade-in slide-in-from-right-4 duration-500 relative overflow-hidden">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-black text-black/10 italic">#{shot.sequenceOrder}</span>
                    <span className="text-[10px] font-black uppercase text-black border-b border-black/10 tracking-widest truncate max-w-[200px]">{shot.topic}</span>
                  </div>
                  <button onClick={() => onUpdateProject(prev => ({...prev, shots: prev.shots.filter(s => s.id !== shot.id)}))} className="text-black/10 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                </div>
                <div className="flex gap-8">
                  <div className="w-48 space-y-2 flex-shrink-0">
                    <div className="aspect-video border-2 border-black/5 bg-black/5 overflow-hidden shadow-inner"><img src={shot.sourceImage} className="w-full h-full object-cover" /></div>
                    <div className="aspect-video border-2 border-black/5 bg-black/5 overflow-hidden shadow-inner"><img src={shot.targetImage} className="w-full h-full object-cover" /></div>
                  </div>
                  <div className="flex-grow space-y-4">
                    <div className="p-3 bg-black/5 border-l-4 border-black/20 italic"><p className="text-[10px] text-black/50 leading-snug">{shot.visualAnalysis}</p></div>
                    <div className="p-4 border-2 border-black/10 bg-white texture-hatch relative"><p className="text-[11px] text-black font-mono leading-relaxed line-clamp-4">{shot.actionPrompt}</p></div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
