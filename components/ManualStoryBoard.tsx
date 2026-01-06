
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Scene, SubtitleStyle, ScriptData, GeneratorMode } from '../types'; 
import { 
  Download, Plus, Settings2, Music, Mic, Monitor, Smartphone, 
  Image as ImageIcon, Layers, Wand2, CheckCircle2, Palette, 
  ChevronRight, Save, History, X, Sparkles, Youtube, 
  Type, Loader2, Volume2, VolumeX, Upload, Trash2,
  Rocket, RefreshCw, FileText, Share2
} from 'lucide-react';
import SceneManager from './SceneManager';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import SubtitleEditor from './SubtitleEditor';
import ArtStyleSelector, { STYLES } from './ArtStyleSelector';
import { generateVoiceover, generateImageForScene, generateScript, refineVisualPrompt } from '../services/geminiService'; 
import { useApp } from '../contexts/AppContext';
import { useAutomation } from '../contexts/AutomationContext';
import { saveProject, listProjects, ProjectData, addToQueue, deleteProject } from '../services/projectService';
import { decodeAudioData } from '../utils/audioUtils';

interface ManualStoryBoardProps {
  initialTopic?: string;
  apiKey: string;
}

interface VideoSettings {
  aspectRatio: '16:9' | '9:16';
  voiceId: string;
  bgMusicVolume: number;
  globalTransition: Scene['transition'];
  visualStyle: string;
}

const ManualStoryBoard: React.FC<ManualStoryBoardProps> = ({ initialTopic, apiKey }) => {
  const { openKeySelection, resetKeyStatus } = useApp();
  const { addLog } = useAutomation();
  
  // --- States ---
  const [projectId, setProjectId] = useState<string | null>(null);
  const [topic, setTopic] = useState(initialTopic || "");
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    aspectRatio: '16:9',
    voiceId: 'Kore',
    bgMusicVolume: 0.12,
    globalTransition: 'fade',
    visualStyle: 'Cinematic'
  });

  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>({
    fontSize: 48, textColor: '#FFFFFF', backgroundColor: '#000000', backgroundOpacity: 0.5, 
    verticalOffset: 15, fontFamily: 'Kanit', outlineColor: '#000000', outlineWidth: 2, 
    shadowBlur: 4, shadowColor: 'rgba(0,0,0,0.5)', fontWeight: '700'
  });

  const [scenes, setScenes] = useState<Scene[]>([
    {
      id: Date.now(),
      stageLabel: "INTRO",
      voiceover: initialTopic ? `เรื่องราวเกี่ยวกับ ${initialTopic}` : "เริ่มการเล่าเรื่องที่นี่...",
      visual_prompt: "Cinematic establishing shot",
      status: 'pending',
      duration_est: 5,
      transition: 'fade'
    }
  ]);

  const [bgmUrl, setBgmUrl] = useState<string | undefined>(undefined);
  const [bgmName, setBgmName] = useState<string | null>(null);
  const [bgmFile, setBgmFile] = useState<Blob | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'draft' | 'saving' | 'saved' | 'error'>('saved');
  const [showHistory, setShowHistory] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [savedProjects, setSavedProjects] = useState<ProjectData[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'subtitles' | 'audio'>('settings');
  const [currentVideoBlob, setCurrentVideoBlob] = useState<Blob | null>(null);

  const playerRef = useRef<VideoPlayerRef>(null);

  // --- Initial Load ---
  useEffect(() => { refreshHistory(); }, []);

  const refreshHistory = async () => {
    const list = await listProjects('manual');
    setSavedProjects(list);
  };

  // --- Persistence ---
  const handleSave = async (silent = false) => {
    if (!silent) setSaveStatus('saving');
    const project: ProjectData = {
      id: projectId || `man-${Date.now()}`,
      type: 'manual',
      title: topic || "Manual Project",
      topic: topic,
      lastUpdated: Date.now(),
      config: { videoSettings, subtitleStyle, bgmName, bgmFile },
      script: { scenes }
    };
    try {
      await saveProject(project);
      if (!projectId) setProjectId(project.id);
      setSaveStatus('saved');
      refreshHistory();
    } catch (e) {
      setSaveStatus('error');
    }
  };

  const handleLoad = async (p: ProjectData) => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const restoredScenes = p.script.scenes ? await Promise.all(p.script.scenes.map(async (s: any) => {
      if (s.audioBase64) {
        try { const buf = await decodeAudioData(s.audioBase64, ctx); return { ...s, audioBuffer: buf }; } catch(e) { return s; }
      }
      return s;
    })) : [];

    setProjectId(p.id);
    setTopic(p.topic);
    setScenes(restoredScenes);
    if (p.config) {
      setVideoSettings(p.config.videoSettings || videoSettings);
      setSubtitleStyle(p.config.subtitleStyle || subtitleStyle);
      setBgmName(p.config.bgmName || null);
      setBgmFile(p.config.bgmFile || null);
    }
    setShowHistory(false);
    setSaveStatus('saved');
  };

  // --- Scene Actions ---
  const handleUpdateScene = useCallback((id: number, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    setSaveStatus('draft');
  }, []);

  const handleAddScene = () => {
    setScenes(prev => [...prev, {
      id: Date.now(),
      stageLabel: `SCENE ${prev.length + 1}`,
      voiceover: "",
      visual_prompt: "",
      status: 'pending',
      duration_est: 5,
      transition: videoSettings.globalTransition
    }]);
    setSaveStatus('draft');
  };

  const handleDeleteScene = (id: number) => {
    if (scenes.length <= 1) return;
    setScenes(prev => prev.filter(s => s.id !== id));
    setSaveStatus('draft');
  };

  // [Fix] Added handleReorder to support manual repositioning of scenes in the timeline
  const handleReorder = (sceneId: number, direction: 'up' | 'down') => {
    setScenes(prev => {
      const newScenes = [...prev];
      const idx = newScenes.findIndex(s => s.id === sceneId);
      if (idx === -1) return prev;
      
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= newScenes.length) return prev;
      
      const [removed] = newScenes.splice(idx, 1);
      newScenes.splice(newIdx, 0, removed);
      return newScenes;
    });
    setSaveStatus('draft');
  };

  // [Fix] Added handleDragReorder to support drag-and-drop scene management
  const handleDragReorder = (startIndex: number, endIndex: number) => {
    setScenes(prev => {
      const newScenes = [...prev];
      const [removed] = newScenes.splice(startIndex, 1);
      newScenes.splice(endIndex, 0, removed);
      return newScenes;
    });
    setSaveStatus('draft');
  };

  // --- Generation ---
  const handleAiScriptAssist = async () => {
    if (!topic) return;
    setIsGenerating(true);
    addLog(`[Manual] Requesting AI script assistance for: ${topic}`);
    try {
      const data = await generateScript(topic, GeneratorMode.FACTS, videoSettings.aspectRatio, 'Thai');
      setScenes(data.scenes.map(s => ({ ...s, status: 'pending' })));
      addLog(`[Manual] AI Script generated: ${data.scenes.length} scenes.`);
    } catch (e) {
      alert("Script generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAudio = async (scene: Scene) => {
    handleUpdateScene(scene.id, { status: 'generating', assetStage: 'audio', statusDetail: 'Synthesizing...' });
    try {
      const base64 = await generateVoiceover(scene.voiceover, videoSettings.voiceId);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buf = await decodeAudioData(base64, ctx);
      handleUpdateScene(scene.id, { 
        audioBase64: base64, 
        audioBuffer: buf!, 
        duration_est: buf!.duration, 
        status: scene.imageUrl ? 'completed' : 'pending',
        statusDetail: 'VO Ready'
      });
    } catch (e) {
      handleUpdateScene(scene.id, { status: 'failed', error: 'VO Error' });
    }
  };

  const handleGenerateVisual = async (scene: Scene) => {
    handleUpdateScene(scene.id, { status: 'generating', assetStage: 'visual', statusDetail: 'Painting...' });
    try {
      const styleObj = STYLES.find(s => s.id === videoSettings.visualStyle);
      const prompt = `${scene.visual_prompt}. Technical: ${styleObj?.technicalHint || ''}`;
      const url = await generateImageForScene(prompt, 'gemini-2.5-flash-image', videoSettings.aspectRatio, videoSettings.visualStyle);
      handleUpdateScene(scene.id, { 
        imageUrl: url, 
        status: scene.audioBuffer ? 'completed' : 'pending',
        statusDetail: 'Image Ready'
      });
    } catch (e) {
      handleUpdateScene(scene.id, { status: 'failed', error: 'Image Error' });
    }
  };

  const handleBatchGenerate = async () => {
    for (const scene of scenes) {
      if (scene.status !== 'completed') {
        if (!scene.audioBuffer) await handleGenerateAudio(scene);
        if (!scene.imageUrl) await handleGenerateVisual(scene);
      }
    }
    handleSave(true);
  };

  const handleExport = async () => {
    if (!playerRef.current) return;
    setIsRendering(true);
    setRenderProgress(0);
    try {
      const { blob } = await playerRef.current.renderVideo((p) => setRenderProgress(p));
      setCurrentVideoBlob(blob);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `manual-studio-${Date.now()}.mp4`;
      a.click();
    } catch (e) {
      alert("Render failed");
    } finally {
      setIsRendering(false);
    }
  };

  const handleAddToQueue = async () => {
    if (!currentVideoBlob || !topic) return;
    try {
      await addToQueue({
        id: `man-q-${Date.now()}`,
        projectId: projectId || 'unknown',
        projectType: 'manual',
        videoBlob: currentVideoBlob,
        metadata: { title: topic, description: "Created via Manual Studio", tags: ["manual", "studio"], privacy_status: 'private' },
        status: 'waiting', progress: 0, system_note: "Manual Studio Export", addedAt: Date.now(), queued_at: new Date().toISOString()
      });
      alert("Added to YouTube Queue!");
    } catch(e) { alert("Failed to add to queue"); }
  };

  const currentStyle = STYLES.find(s => s.id === videoSettings.visualStyle) || STYLES[0];

  return (
    <div className="flex flex-col h-[88vh] bg-slate-950 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-4xl relative">
      
      {/* --- Main Workspace --- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Inspector & Settings */}
        <div className="w-[420px] bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          
          {/* Player Preview */}
          <div className="p-8 bg-black/40 border-b border-slate-800 flex flex-col items-center gap-4">
             <div className={`bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl transition-all duration-500 ${videoSettings.aspectRatio === '9:16' ? 'w-48 aspect-[9/16]' : 'w-full aspect-video'}`}>
                <VideoPlayer 
                  ref={playerRef} 
                  scenes={scenes.filter(s => s.status === 'completed')} 
                  isReady={true} 
                  aspectRatio={videoSettings.aspectRatio} 
                  subtitleStyle={subtitleStyle}
                  bgmUrl={bgmUrl}
                  bgmVolume={videoSettings.bgMusicVolume}
                />
             </div>
             <div className="flex gap-2">
                <button onClick={handleExport} disabled={isRendering} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                  {isRendering ? <Loader2 size={12} className="animate-spin" /> : <Download size={12}/>}
                  {isRendering ? `${Math.round(renderProgress)}%` : 'Export MP4'}
                </button>
                {currentVideoBlob && (
                  <button onClick={handleAddToQueue} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                    <Youtube size={12}/> Queue YT
                  </button>
                )}
             </div>
          </div>

          {/* Config Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/20 p-2 gap-1">
             {[
               { id: 'settings', icon: Settings2, label: 'Core' },
               { id: 'subtitles', icon: Type, label: 'Subs' },
               { id: 'audio', icon: Music, label: 'Audio' }
             ].map(tab => (
               <button 
                key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-3 rounded-xl flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}
               >
                 <tab.icon size={16} />
                 <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
               </button>
             ))}
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
             {activeTab === 'settings' && (
               <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="space-y-4">
                     <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] flex items-center gap-2"><Monitor size={14} className="text-indigo-400"/> Video Framework</label>
                     <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setVideoSettings(v => ({ ...v, aspectRatio: '16:9' }))} className={`p-4 rounded-2xl border text-[10px] font-black uppercase transition-all ${videoSettings.aspectRatio === '16:9' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>16:9 Cinematic</button>
                        <button onClick={() => setVideoSettings(v => ({ ...v, aspectRatio: '9:16' }))} className={`p-4 rounded-2xl border text-[10px] font-black uppercase transition-all ${videoSettings.aspectRatio === '9:16' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>9:16 Shorts</button>
                     </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] flex items-center gap-2"><Palette size={14} className="text-pink-400"/> Visual DNA</label>
                    <button onClick={() => setShowStyleSelector(true)} className="w-full group bg-slate-950 border border-slate-800 rounded-3xl p-5 text-left relative overflow-hidden transition-all hover:border-pink-500/50">
                       <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent z-10"></div>
                       <img src={currentStyle.image} className="absolute inset-0 w-full h-full object-cover opacity-20 blur-[2px]" />
                       <div className="relative z-20 flex justify-between items-center">
                          <div>
                             <h4 className="text-sm font-black text-white uppercase">{currentStyle.name}</h4>
                             <p className="text-[8px] text-slate-500 uppercase mt-1">{currentStyle.dna.slice(0,2).join(' • ')}</p>
                          </div>
                          <ChevronRight size={16} className="text-slate-700 group-hover:text-pink-400 transition-colors" />
                       </div>
                    </button>
                  </div>

                  <div className="space-y-4">
                     <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] flex items-center gap-2"><Mic size={14} className="text-purple-400"/> Primary Voice</label>
                     <select 
                      value={videoSettings.voiceId} onChange={e => setVideoSettings(v => ({ ...v, voiceId: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-xs font-bold outline-none cursor-pointer focus:border-purple-500"
                     >
                        <option value="Kore">Kore (Male Power)</option>
                        <option value="Zephyr">Zephyr (Bright Narrator)</option>
                        <option value="Puck">Puck (Female Calm)</option>
                        <option value="Charon">Charon (Deep Mystery)</option>
                     </select>
                  </div>
               </div>
             )}

             {activeTab === 'subtitles' && (
               <div className="animate-in fade-in duration-300">
                  <SubtitleEditor style={subtitleStyle} onChange={(u) => setSubtitleStyle(s => ({ ...s, ...u }))} presetType="manual" />
               </div>
             )}

             {activeTab === 'audio' && (
               <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Atmospheric Music</label>
                        {bgmName && <button onClick={() => {setBgmName(null); setBgmUrl(undefined);}} className="text-red-500 hover:text-red-400 transition"><Trash2 size={14}/></button>}
                     </div>
                     <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 flex flex-col items-center gap-4 text-center">
                        <input type="file" accept="audio/*" onChange={e => {const f = e.target.files?.[0]; if(f){ setBgmName(f.name); setBgmUrl(URL.createObjectURL(f)); }}} className="hidden" id="bgm-upload" />
                        {bgmName ? (
                          <div className="space-y-2 w-full">
                             <Music size={32} className="text-indigo-500 mx-auto" />
                             <p className="text-[10px] font-bold text-slate-300 truncate w-full">{bgmName}</p>
                          </div>
                        ) : (
                          <label htmlFor="bgm-upload" className="w-full py-8 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center gap-3 cursor-pointer hover:bg-slate-900 transition group">
                             <Upload size={24} className="text-slate-700 group-hover:text-indigo-400" />
                             <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Select Audio Stream</span>
                          </label>
                        )}
                     </div>
                  </div>

                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                     <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-500">
                        <span>Background Gain</span>
                        <span className="text-indigo-400">{Math.round(videoSettings.bgMusicVolume * 100)}%</span>
                     </div>
                     <div className="flex items-center gap-4">
                        <VolumeX size={14} className="text-slate-700" />
                        <input type="range" min="0" max="0.5" step="0.01" value={videoSettings.bgMusicVolume} onChange={e => setVideoSettings(v => ({ ...v, bgMusicVolume: parseFloat(e.target.value) }))} className="w-full h-1 bg-slate-800 rounded-full accent-indigo-500" />
                        <Volume2 size={14} className="text-slate-500" />
                     </div>
                  </div>
               </div>
             )}
          </div>

          {/* Persistent Save Status */}
          <div className="p-6 border-t border-slate-800 bg-slate-950/30 flex items-center justify-between">
             <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-orange-500 animate-pulse'}`}></div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{saveStatus}</span>
             </div>
             <button onClick={() => handleSave()} disabled={saveStatus === 'saving'} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">
               {saveStatus === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} className="inline mr-2" />}
               Save Logic
             </button>
          </div>
        </div>

        {/* Right: Main Timeline Control */}
        <div className="flex-1 bg-slate-950 flex flex-col min-w-0">
           
           {/* Top Control Bar */}
           <div className="h-20 bg-slate-900 border-b border-slate-800 px-10 flex items-center justify-between shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><Rocket size={100} /></div>
              
              <div className="flex items-center gap-6 relative z-10">
                 <div className="flex flex-col">
                    <input 
                      type="text" value={topic} onChange={e => setTopic(e.target.value)}
                      placeholder="Project Identity..."
                      className="bg-transparent text-xl font-black text-white uppercase tracking-tighter outline-none focus:text-indigo-400 transition-colors w-64 placeholder-slate-800"
                    />
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Manual Master Node • {scenes.length} Timeline Clusters</p>
                 </div>
                 <div className="h-8 w-px bg-slate-800 mx-2"></div>
                 <button 
                  onClick={handleAiScriptAssist} disabled={isGenerating || !topic}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 transition flex items-center gap-2"
                 >
                    {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-indigo-500"/>}
                    AI Content Boost
                 </button>
              </div>

              <div className="flex items-center gap-4 relative z-10">
                 <button onClick={handleBatchGenerate} className="px-6 py-2.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2">
                    <RefreshCw size={14} /> Batch Sync All
                 </button>
                 <button onClick={() => setShowHistory(true)} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition shadow-lg">
                    <History size={20} />
                 </button>
                 <button onClick={handleAddScene} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center gap-3">
                    <Plus size={18} /> New Node
                 </button>
              </div>
           </div>

           {/* Timeline Canvas */}
           <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative">
              <SceneManager 
                scenes={scenes}
                onUpdateScene={handleUpdateScene}
                onGenerateAudio={handleGenerateAudio}
                onGenerateVisual={handleGenerateVisual}
                onRegenerate={(s) => {handleGenerateAudio(s); handleGenerateVisual(s);}}
                onToggleSkip={(id) => handleUpdateScene(id, { status: scenes.find(s => s.id === id)?.status === 'skipped' ? 'completed' : 'skipped' })}
                onReorder={handleReorder}
                onDragReorder={handleDragReorder}
                onDelete={handleDeleteScene}
                onAddScene={handleAddScene}
                isProcessingAll={false}
              />
              
              {/* Timeline Footer */}
              <div className="mt-16 flex flex-col items-center gap-8 py-10 border-t border-slate-900 border-dashed">
                 <div className="flex items-center gap-4 text-slate-700 opacity-40">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.5em]">End of Logic Pipeline</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                 </div>
                 <button onClick={handleAddScene} className="flex flex-col items-center gap-4 group">
                    <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-dashed border-slate-800 flex items-center justify-center text-slate-700 group-hover:text-indigo-500 group-hover:border-indigo-500/50 transition-all">
                       <Plus size={32} />
                    </div>
                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest group-hover:text-indigo-400">Append Next Sequence</span>
                 </button>
              </div>
           </div>
        </div>

      </div>

      {/* --- Overlay Modals --- */}
      {showStyleSelector && (
        <ArtStyleSelector 
          selectedId={videoSettings.visualStyle} 
          onSelect={(id) => {setVideoSettings(v => ({ ...v, visualStyle: id })); setSaveStatus('draft');}} 
          onClose={() => setShowStyleSelector(false)} 
        />
      )}

      {showHistory && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/98 backdrop-blur-3xl p-8 animate-in fade-in duration-500">
           <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-[4rem] p-16 relative shadow-4xl ring-1 ring-slate-700 flex flex-col">
              <button onClick={() => setShowHistory(false)} className="absolute top-12 right-12 text-slate-600 hover:text-white transition p-2 active:scale-90"><X size={44}/></button>
              <div className="flex items-center gap-6 mb-16">
                 <div className="w-20 h-20 bg-indigo-600/10 rounded-3xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-2xl">
                    <History size={40} />
                 </div>
                 <div>
                    <h3 className="text-5xl font-black text-white uppercase tracking-tighter">Project Archives</h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.4em] mt-3">Restore state from local IndexedDB storage</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-800 max-h-[50vh]">
                 {savedProjects.map(proj => (
                   <div key={proj.id} className="bg-slate-950 border border-slate-800 p-10 rounded-[3.5rem] hover:border-indigo-500/50 transition-all group relative overflow-hidden flex flex-col h-full shadow-2xl">
                      <div className="flex justify-between items-start mb-8">
                         <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20 uppercase tracking-widest">{new Date(proj.lastUpdated).toLocaleDateString()}</span>
                         <button onClick={(e) => {e.stopPropagation(); deleteProject(proj.id).then(refreshHistory);}} className="text-slate-800 hover:text-red-500 transition opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                      </div>
                      <h4 className="text-2xl font-black text-white line-clamp-1 mb-4 uppercase tracking-tighter">{proj.title}</h4>
                      <p className="text-xs text-slate-500 font-kanit italic line-clamp-3 mb-12 flex-1">{proj.topic}</p>
                      <button onClick={() => handleLoad(proj)} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-widest border border-slate-800 hover:bg-indigo-600 transition-all flex items-center justify-center gap-3">
                         Restore Interface <Share2 size={16}/>
                      </button>
                   </div>
                 ))}
                 {savedProjects.length === 0 && (
                   <div className="col-span-full py-40 text-center flex flex-col items-center gap-8">
                      <div className="w-32 h-32 rounded-[3rem] border-4 border-dashed border-slate-800 flex items-center justify-center text-slate-800"><History size={48}/></div>
                      <p className="text-slate-600 text-2xl font-black uppercase tracking-[0.4em]">Archived Core Dormant</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ManualStoryBoard;
