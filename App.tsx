
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Project, Shot } from './types';
import { ShotGenerator } from './components/ShotGenerator';
import { ExportView } from './components/ExportView';
import { ProjectLibrary } from './components/ProjectLibrary';
import { CinematicBackground } from './components/CinematicBackground';
import { ErrorModal } from './components/ErrorModal';
import { getAllProjects, saveAllProjects } from './storage';
import { ArrowLeft, Clapperboard, Film, LayoutGrid, Key, Cpu, Loader2 } from 'lucide-react';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }
};

export const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'shots' | 'export'>('shots');
  const [globalError, setGlobalError] = useState<{title: string, message: string} | null>(null);
  const [isStudioBusy, setIsStudioBusy] = useState(false);

  // Load Key
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        try {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasKey(selected);
        } catch (err) {
          setHasKey(false);
        }
      } else {
        setHasKey(false);
      }
    };
    checkKey();
  }, []);

  // Load Data from IndexedDB
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getAllProjects();
        setProjects(data);
      } catch (e) {
        console.error("Failed to load from IndexedDB:", e);
        setGlobalError({
          title: "Storage Error",
          message: "Could not initialize the local database. Ensure your browser allows local storage."
        });
      } finally {
        setIsLoadingStorage(false);
      }
    };
    loadData();
  }, []);

  // Save Data to IndexedDB on change
  useEffect(() => {
    if (isLoadingStorage) return;
    
    const saveData = async () => {
      try {
        await saveAllProjects(projects);
      } catch (e) {
        console.error("Storage save error:", e);
        // Don't show modal for every save error to avoid annoyance, but log it
      }
    };
    
    // Simple debounce to prevent slamming IndexedDB
    const timeout = setTimeout(saveData, 1000);
    return () => clearTimeout(timeout);
  }, [projects, isLoadingStorage]);

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId), 
    [projects, activeProjectId]
  );
  
  const isProjectOpen = !!activeProjectId && !!activeProject;

  const handleSelectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setActiveTab('shots');
  }, []);

  const handleCreateProject = useCallback((title: string) => {
    const newProject: Project = {
      id: generateId(),
      title: title || "New Series",
      shots: [],
      draftingSlots: [
        { id: 'init-' + Date.now(), source: null, target: null, status: 'idle' }
      ],
      lastModified: Date.now()
    };
    setProjects(prev => [...prev, newProject]);
    handleSelectProject(newProject.id);
  }, [handleSelectProject]);

  const handleUpdateActiveProject = useCallback((updater: Project | ((prev: Project) => Project)) => {
    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        const updated = typeof updater === 'function' ? (updater as (prev: Project) => Project)(p) : updater;
        return { ...updated, lastModified: Date.now() };
      }
      return p;
    }));
  }, [activeProjectId]);

  const handleKeySelection = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setHasKey(true);
      } catch (err) {}
    }
  };

  const handleApiError = useCallback((err: any, context: string = "Studio Error") => {
    const errMsg = String(err);
    if (errMsg.includes("Requested entity was not found.")) {
      setHasKey(false);
      handleKeySelection();
      setGlobalError({
        title: "Key Selection Required",
        message: "Your current session key is invalid or has expired. Please re-select a paid Studio Key."
      });
    } else {
      setGlobalError({ title: context, message: errMsg });
    }
  }, []);

  if (isLoadingStorage) {
    return (
      <div className="min-h-screen bg-[#EAE3D9] flex flex-col items-center justify-center">
        <CinematicBackground />
        <Loader2 className="animate-spin text-black/20" size={48} />
        <p className="mt-4 font-black uppercase text-[10px] tracking-[0.4em] text-black/40">Syncing Drawing Archive...</p>
      </div>
    );
  }

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-[#EAE3D9] flex flex-col items-center justify-center p-6 text-center">
        <CinematicBackground />
        <div className="sketch-card p-12 max-w-md texture-hatch">
          <Key size={48} className="text-[#4A4A4A] mx-auto mb-6" />
          <h2 className="text-xl font-black text-black uppercase mb-4">Production Key Required</h2>
          <p className="text-xs text-black/50 mb-6 uppercase tracking-widest font-bold">Select a key from a paid GCP project to continue.</p>
          <button onClick={handleKeySelection} className="pencil-button w-full py-4 font-black uppercase text-xs tracking-widest">Select Studio Key</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row text-[#1A1A1A] relative overflow-hidden font-inter select-none">
      <CinematicBackground />
      
      {globalError && (
        <ErrorModal 
          title={globalError.title} 
          message={globalError.message} 
          onClose={() => setGlobalError(null)} 
          onRetryKey={handleKeySelection} 
        />
      )}
      
      <nav className="w-full md:w-20 lg:w-64 bg-[#F5F1EA]/80 backdrop-blur-sm border-r border-black/20 flex flex-col z-50">
        <div className="h-24 flex items-center px-8 border-b border-black/10 cursor-pointer texture-hatch-v" onClick={() => setActiveProjectId(null)}>
          <div className="flex flex-col">
            <span className="font-black text-2xl tracking-tighter text-black">CONTINUITY</span>
            <span className="text-[10px] font-black tracking-widest text-black/40 uppercase mt-[-4px]">VEO STUDIO</span>
          </div>
        </div>
        
        <div className="p-4 space-y-4 flex-grow">
          <button onClick={() => setActiveProjectId(null)} className={`w-full flex items-center gap-4 px-4 py-5 transition-all border-2 ${!isProjectOpen ? 'bg-black text-white border-black' : 'bg-transparent text-black/40 border-transparent hover:border-black/10'}`}>
            <LayoutGrid size={24} />
            <span className="font-black uppercase text-xs tracking-widest hidden lg:block">Registry</span>
          </button>
          {isProjectOpen && (
            <>
              <div className="h-px bg-black/10 my-4" />
              <NavButton active={activeTab === 'shots'} onClick={() => setActiveTab('shots')} icon={<Clapperboard size={22} />} label="Drawing Board" />
              <NavButton active={activeTab === 'export'} onClick={() => setActiveTab('export')} icon={<Film size={22} />} label="Manifest" />
            </>
          )}
        </div>
        
        <div className="p-4 border-t border-black/10 texture-dots flex justify-center">
          <Cpu size={16} className="text-black/20" />
        </div>
      </nav>

      <main className="flex-grow h-screen overflow-hidden flex flex-col relative z-10">
        <header className="h-16 border-b border-black/10 flex items-center justify-between px-10 bg-white/20 backdrop-blur-sm">
          {isProjectOpen ? (
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveProjectId(null)} className="text-black/40 hover:text-black transition-colors">
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-sm font-black text-black uppercase tracking-widest">{activeProject.title}</h1>
            </div>
          ) : (
            <h1 className="text-black/20 font-black text-lg uppercase tracking-[0.3em]">Drawing Archive</h1>
          )}
        </header>

        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 lg:p-12">
          {!isProjectOpen ? (
            <ProjectLibrary 
              projects={projects} 
              onCreateProject={handleCreateProject} 
              onSelectProject={handleSelectProject} 
              onDeleteProject={(id) => setProjects(prev => prev.filter(p => p.id !== id))} 
            />
          ) : (
            <div className="max-w-7xl mx-auto">
              {activeTab === 'shots' && (
                <ShotGenerator 
                  project={activeProject} 
                  isStudioBusy={isStudioBusy}
                  setIsStudioBusy={setIsStudioBusy}
                  onUpdateProject={handleUpdateActiveProject} 
                  onNavigateToExport={() => setActiveTab('export')} 
                  onApiError={handleApiError} 
                />
              )}
              {activeTab === 'export' && (
                <ExportView 
                  project={activeProject} 
                  onUpdateProject={handleUpdateActiveProject}
                  onApiError={handleApiError} 
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const NavButton = ({ onClick, icon, label, active }: any) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-4 px-5 py-5 transition-all border-2 ${active ? `bg-black text-white border-black` : 'text-black/40 border-transparent hover:border-black/10'}`}
  >
    {icon}
    <span className="font-black uppercase text-xs tracking-widest hidden lg:block">{label}</span>
  </button>
);

export default App;
