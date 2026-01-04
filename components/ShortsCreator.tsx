
import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, GeneratorMode, Scene, SubtitleStyle, ScriptData } from '../types';
import { generateShortsScript, generateImageForScene, generateVoiceover, generateVideoForScene, ERR_INVALID_KEY, refineVisualPrompt } from '../services/geminiService';
import { decodeAudioData } from '../utils/audioUtils';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import SceneManager from './SceneManager';
import MetadataManager from './MetadataManager';
import SubtitleEditor from './SubtitleEditor';
import YoutubeUploadModal from './YoutubeUploadModal';
import ArtStyleSelector, { StyleOption } from './ArtStyleSelector';
import { useApp } from '../App';
import { saveProject, listProjects, ProjectData, getProject, addToQueue } from '../services/projectService';
import {
  Wand2, Loader2, Save, History, X, Sparkles, Youtube, 
  Smartphone, Bot, CheckCircle2, Zap, Download, Type, Move, Palette, Layers, BarChart3, Clock, Eye, EyeOff, Music, PlusCircle, Trash2, ChevronRight, Info,
  Mic, VolumeX, Volume2, Play, Rocket, Upload, FileAudio, ToggleLeft, ToggleRight,
  Anchor, BookOpen, Lightbulb, TrendingUp, Megaphone, Send, ListPlus, ShieldCheck,
  Paintbrush, Activity, Check, BrainCircuit, Camera
} from 'lucide-react';

const SaveStatusIndicator = ({ status }: { status: 'draft' | 'saving' | 'saved' | 'error' }) => {
  switch (status) {
    case 'saving': return <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-400 uppercase tracking-widest"><Loader2 size={10} className="animate-spin"/> Syncing</div>;
    case 'saved': return <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 uppercase tracking-widest"><CheckCircle2 size={10}/> Master Saved</div>;
    case 'error': return <div className="flex items-center gap-1.5 text-[10px] font-black text-red-400 uppercase tracking-widest">Storage Error</div>;
    default: return <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Local Draft</div>;
  }
};

const ShortsCreator: React.FC<{ initialTopic?: string, initialLanguage?: 'Thai' | 'English' }> = ({ initialTopic, initialLanguage = 'Thai' }) => {
  const { openKeySelection, resetKeyStatus, hasSelectedKey } = useApp();
  const [state, setState] = useState<ProjectState>({ status: 'idle', topic: initialTopic || '', script: null, currentStep: '' });
  const [mode, setMode] = useState<GeneratorMode>(GeneratorMode.FACTS);
  const aspectRatio = '9:16';
  const [language, setLanguage] = useState<'Thai' | 'English'>(initialLanguage);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [selectedVisualModel, setSelectedVisualModel] = useState('gemini-2.5-flash-image');
  const [selectedTextModel, setSelectedTextModel] = useState('gemini-3-flash-preview');
  const [selectedStyle, setSelectedStyle] = useState('Cinematic');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState('Initializing');
  const [activeTab, setActiveTab] = useState<'scenes' | 'viral' | 'seo'>('scenes');
  const [currentVideoBlob, setCurrentVideoBlob] = useState<Blob | null>(null);
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'draft' | 'saving' | 'saved' | 'error'>('saved');
  const [hideSubtitles, setHideSubtitles] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(1.1);
  const [isQueuing, setIsQueuing] = useState(false);

  // Shared resources
  const audioContextRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<VideoPlayerRef>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  };

  // BGM State
  const [bgmUrl, setBgmUrl] = useState<string | undefined>(undefined);
  const [bgmFile, setBgmFile] = useState<Blob | null>(null);
  const [bgmName, setBgmName] = useState<string | null>(null);
  const [bgmVolume, setBgmVolume] = useState(0.12);

  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>({
    fontSize: 84, textColor: '#FFFF00', backgroundColor: '#000000', backgroundOpacity: 0.0, verticalOffset: 35, fontFamily: 'Kanit', outlineColor: '#000000', outlineWidth: 6, shadowBlur: 4, shadowColor: 'rgba(0,0,0,0.8)', fontWeight: '900'
  });

  useEffect(() => {
    if (bgmFile && !bgmUrl) {
      const url = URL.createObjectURL(bgmFile); setBgmUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [bgmFile]);

  useEffect(() => { setSaveStatus('draft'); }, [selectedVoice, selectedStyle, subtitleStyle, bgmVolume, voiceSpeed, hideSubtitles, selectedTextModel]);

  const handleGenerateScript = async () => {
    if (!state.topic) return;
    try {
      setState(prev => ({ ...prev, status: 'generating_script' }));
      const scriptData = await generateShortsScript(state.topic, mode, aspectRatio, language, selectedStyle, selectedTextModel);
      setState(prev => ({ ...prev, script: scriptData, status: 'idle' }));
      setSaveStatus('draft');
    } catch (error: any) { 
      if (error.code === ERR_INVALID_KEY) { resetKeyStatus(); await openKeySelection(); } 
      setState(prev => ({ ...prev, status: 'error', error: error.message })); 
    }
  };

  const handleRefinePrompt = async (scene: Scene) => {
    try {
      const refined = await refineVisualPrompt(state.topic, selectedStyle, scene.voiceover);
      updateScene(scene.id, { visual_prompt: refined });
    } catch (err) { console.error(err); }
  };

  const processScene = async (scene: Scene) => {
    if (scene.status === 'completed') return;

    updateScene(scene.id, { status: 'generating', processingProgress: 5, statusDetail: "Connecting..." });
    try {
      const audioBase64 = await generateVoiceover(scene.voiceover, selectedVoice);
      const audioCtx = getAudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      
      const audioBuffer = await decodeAudioData(audioBase64, audioCtx);
      updateScene(scene.id, { processingProgress: 30, audioBase64, audioBuffer, statusDetail: "Rendering Visuals..." });
      
      const isVideo = selectedVisualModel.startsWith('veo');
      let result: string;
      if (isVideo) {
        result = await generateVideoForScene(scene.visual_prompt, aspectRatio, selectedVisualModel, selectedStyle, (p) => {
          updateScene(scene.id, { processingProgress: 30 + (p * 5), statusDetail: `Generating Frames...` });
        });
      } else {
        result = await generateImageForScene(scene.visual_prompt, selectedVisualModel, aspectRatio, selectedStyle);
      }

      updateScene(scene.id, { status: 'completed', processingProgress: 100, statusDetail: "Ready", imageUrl: !isVideo ? result : undefined, videoUrl: isVideo ? result : undefined });
    } catch (err: any) { 
      console.error(`Scene ${scene.id} failed:`, err);
      updateScene(scene.id, { status: 'failed', error: err.message, statusDetail: "Sync Error" }); 
      throw err; 
    }
  };

  const handleGenerateAll = async () => {
    if (!state.script || isProcessingAll) return;
    setIsProcessingAll(true);
    try {
      const pending = state.script.scenes.filter(s => s.status !== 'completed' && s.status !== 'skipped');
      await Promise.allSettled(pending.map(s => processScene(s)));
      handleSaveProject();
    } catch (e) {
      console.error("Batch synthesis failed", e);
    } finally { 
      setIsProcessingAll(false); 
    }
  };

  const updateScene = (sceneId: number, updates: Partial<Scene>) => {
    setState(prev => ({ ...prev, script: prev.script ? { ...prev.script, scenes: prev.script.scenes.map(s => s.id === sceneId ? { ...s, ...updates } : s) } : null }));
  };

  const handleReorderScenes = (startIndex: number, endIndex: number) => {
    setState(prev => {
      if (!prev.script || !prev.script.scenes) return prev;
      const scenes = [...prev.script.scenes];
      const [removed] = scenes.splice(startIndex, 1);
      scenes.splice(endIndex, 0, removed);
      return { ...prev, script: { ...prev.script, scenes } };
    });
    setSaveStatus('draft');
  };

  const handleStepReorder = (sceneId: number, direction: 'up' | 'down') => {
    setState(prev => {
      if (!prev.script || !prev.script.scenes) return prev;
      const scenes = [...prev.script.scenes];
      const idx = scenes.findIndex(s => s.id === sceneId);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= scenes.length) return prev;
      const [removed] = scenes.splice(idx, 1);
      scenes.splice(newIdx, 0, removed);
      return { ...prev, script: { ...prev.script, scenes } };
    });
    setSaveStatus('draft');
  };

  const handleDeleteScene = (sceneId: number) => {
    if (!confirm("Delete this viral segment?")) return;
    setState(prev => {
      if (!prev.script || !prev.script.scenes) return prev;
      return { ...prev, script: { ...prev.script, scenes: prev.script.scenes.filter(s => s.id !== sceneId) } };
    });
    setSaveStatus('draft');
  };

  const handleAddScene = () => {
    setState(prev => {
      if (!prev.script) return prev;
      const newScene: Scene = {
        id: Date.now(),
        voiceover: "Add catchy dialogue here...",
        visual_prompt: "Visual description...",
        duration_est: 3,
        status: 'pending'
      };
      return { ...prev, script: { ...prev.script, scenes: [...(prev.script.scenes || []), newScene] } };
    });
    setSaveStatus('draft');
  };

  const handleSaveProject = async () => {
    if (!state.script) return; setSaveStatus('saving');
    const project: ProjectData = { id: state.id || `shorts-${Date.now()}`, type: 'shorts', title: state.script.title, topic: state.topic, lastUpdated: Date.now(), config: { mode, aspectRatio, language, selectedVoice, selectedVisualModel, selectedTextModel, selectedStyle, subtitleStyle, bgmName, bgmVolume, hideSubtitles, voiceSpeed }, script: state.script };
    try { await saveProject(project); setState(prev => ({ ...prev, id: project.id })); setSaveStatus('saved'); } catch (e) { setSaveStatus('error'); }
  };

  const handleExport = async () => {
    if (!playerRef.current) return;
    setIsExporting(true); setExportProgress(0); setExportStage('Checking Scene Assets...');
    try {
      const { blob } = await playerRef.current.renderVideo((p, stage) => { setExportProgress(p); setExportStage(stage); });
      setCurrentVideoBlob(blob); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `viral-short-${Date.now()}.webm`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (err: any) { alert("Render Failed: " + err.message); } finally { setIsExporting(false); }
  };

  const completedScenes = (state.script?.scenes || []).filter(s => s.status === 'completed');
  const completedCount = completedScenes.length;
  const totalCount = (state.script?.scenes || []).length;

  return (
    <div className="flex flex-col xl:flex-row gap-10 max-w-[1400px] mx-auto pb-20">
      {showStyleSelector && <ArtStyleSelector selectedId={selectedStyle} onSelect={setSelectedStyle} onClose={() => setShowStyleSelector(false)} />}
      
      <div className="xl:w-[400px] shrink-0 sticky top-12 self-start">
         <div className="relative p-3 bg-slate-900 rounded-[4rem] shadow-3xl border-[10px] border-slate-800 overflow-hidden">
            <div className="rounded-[3rem] overflow-hidden h-[700px] w-full bg-black relative">
               <VideoPlayer ref={playerRef} scenes={completedScenes} isReady={completedCount > 0} aspectRatio="9:16" subtitleStyle={subtitleStyle} hideSubtitles={hideSubtitles} onToggleSubtitles={() => setHideSubtitles(!hideSubtitles)} bgmUrl={bgmUrl} bgmVolume={bgmVolume} voiceSpeed={voiceSpeed} />
            </div>
            {isExporting && (
              <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center p-12 text-center backdrop-blur-xl">
                <div className="relative w-32 h-32 mb-8">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle className="text-slate-800 stroke-current" strokeWidth="8" fill="transparent" r="44" cx="50" cy="50" />
                    <circle className="text-orange-500 stroke-current transition-all duration-300" strokeWidth="8" strokeLinecap="round" fill="transparent" r="44" cx="50" cy="50" style={{ strokeDasharray: 276.5, strokeDashoffset: 276.5 - (276.5 * exportProgress) / 100 }} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-black text-white text-xl">{Math.round(exportProgress)}%</span>
                </div>
                <h4 className="text-white font-black uppercase tracking-widest text-[10px]">{exportStage}</h4>
              </div>
            )}
         </div>
         <div className="mt-8 flex flex-col gap-3">
            <button onClick={handleExport} disabled={completedCount === 0 || isExporting} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 transition-all">
              <Download size={20}/> Final Render (MP4)
            </button>
            <button onClick={() => setShowYoutubeModal(true)} disabled={!currentVideoBlob} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 transition-all">
              <Youtube size={20}/> Publish to Shorts
            </button>
         </div>
      </div>

      <div className="flex-1 flex flex-col gap-8">
        <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
           <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-5">
                 <div className="w-16 h-16 rounded-2xl bg-orange-600 flex items-center justify-center text-white shadow-xl"><Zap size={32} fill="currentColor"/></div>
                 <div><h2 className="text-4xl font-black text-white uppercase tracking-tighter">Shorts Factory</h2><SaveStatusIndicator status={saveStatus} /></div>
              </div>
           </div>
           <div className="space-y-8">
              <div className="relative">
                <input type="text" placeholder="Shorts Topic..." className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] p-7 pr-48 text-white text-xl font-kanit outline-none focus:ring-2 focus:ring-orange-600/30 transition-all" value={state.topic} onChange={(e) => setState(prev => ({ ...prev, topic: e.target.value }))} />
                <button onClick={handleGenerateScript} disabled={state.status !== 'idle'} className="absolute right-3.5 top-3.5 bottom-3.5 px-10 bg-orange-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-orange-500 shadow-2xl transition-all disabled:opacity-50">{state.status === 'generating_script' ? <Loader2 className="animate-spin" size={18} /> : 'Draft Script'}</button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                 <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                    <label className="text-[9px] font-black text-slate-600 uppercase block mb-2 flex items-center gap-1.5"><BrainCircuit size={10} className="text-purple-400"/> Intelligence</label>
                    <select value={selectedTextModel} onChange={(e) => setSelectedTextModel(e.target.value)} className="w-full bg-transparent text-white font-bold text-xs outline-none cursor-pointer">
                      <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
                      <option value="gemini-3-pro-preview">Gemini 3 Pro (Smart)</option>
                    </select>
                 </div>
                 <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                    <label className="text-[9px] font-black text-slate-600 uppercase block mb-2 flex items-center gap-1.5"><Palette size={10} className="text-pink-400" /> Art Style</label>
                    <button onClick={() => setShowStyleSelector(true)} className="w-full text-left text-white font-bold text-xs truncate flex items-center justify-between"><span>{selectedStyle}</span><ChevronRight size={14}/></button>
                    <div className="mt-2 flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 rounded-md border border-slate-800">
                       <Camera size={8} className="text-slate-600"/>
                       <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Style DNA Active</span>
                    </div>
                 </div>
                 <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800"><label className="text-[9px] font-black text-slate-600 uppercase block mb-2">Engine</label>
                 <select value={selectedVisualModel} onChange={(e) => setSelectedVisualModel(e.target.value)} className="w-full bg-transparent text-white font-bold text-xs outline-none cursor-pointer"><option value="gemini-2.5-flash-image">Static Core</option><option value="veo-3.1-fast-generate-preview">Motion Core</option></select></div>
                 <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800"><label className="text-[9px] font-black text-slate-600 uppercase block mb-2">Voice</label>
                 <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="w-full bg-transparent text-white font-bold text-xs outline-none cursor-pointer"><option value="Kore">Kore (Power)</option><option value="Charon">Charon (Deep)</option><option value="Zephyr">Zephyr (Bright)</option></select></div>
                 <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800"><label className="text-[9px] font-black text-slate-600 uppercase block mb-2">Tempo</label>
                 <select value={voiceSpeed} onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))} className="w-full bg-transparent text-white font-bold text-xs outline-none cursor-pointer"><option value="1.0">Normal</option><option value="1.15">Viral (Fast)</option><option value="1.3">Turbo</option></select></div>
              </div>
           </div>
        </div>
        {state.script && (
          <div className="bg-slate-900 border border-slate-800 rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col">
             <div className="flex border-b border-slate-800 p-2 gap-2">
                {[{id:'scenes', label:' storyboard', icon:<Layers size={16}/>}, {id:'viral', label:'Viral Styling', icon:<Type size={16}/>}, {id:'seo', label:'Deployment', icon:<BarChart3 size={16}/>}].map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 py-5 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-orange-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>{t.icon} {t.label}</button>
                ))}
             </div>
             <div className="p-10">
                {activeTab === 'scenes' && (
                  <div className="space-y-8">
                    <div className="bg-slate-950 p-8 rounded-[3rem] border border-slate-800 flex items-center justify-between shadow-inner">
                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-purple-600/10 rounded-2xl flex items-center justify-center text-purple-400 border border-purple-500/20"><Rocket size={28}/></div>
                          <div><h4 className="text-base font-black text-white uppercase tracking-widest leading-none mb-2">Parallel Core Production</h4><p className="text-[10px] text-slate-500 font-bold uppercase">{completedCount} / {totalCount} Ready</p></div>
                       </div>
                       <button onClick={handleGenerateAll} disabled={isProcessingAll || (completedCount === totalCount && totalCount > 0)} className={`px-12 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-4 active:scale-95 ${isProcessingAll ? 'bg-orange-600 text-white animate-pulse' : 'bg-purple-600 text-white hover:bg-purple-500 shadow-purple-900/40'}`}>
                         {isProcessingAll ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                         {isProcessingAll ? 'Batch Rendering...' : 'Synthesize All Scenes'}
                       </button>
                    </div>
                    <SceneManager 
                      scenes={state.script.scenes} 
                      onRegenerate={processScene} 
                      onRefinePrompt={handleRefinePrompt} 
                      onToggleSkip={(id) => updateScene(id, { status: 'skipped' })} 
                      onUpdateScene={updateScene} 
                      onDragReorder={handleReorderScenes}
                      onReorder={handleStepReorder}
                      onDelete={handleDeleteScene}
                      onAddScene={handleAddScene}
                      isProcessingAll={isProcessingAll} 
                    />
                  </div>
                )}
                {activeTab === 'viral' && (
                   <div className="bg-slate-950 p-10 rounded-[3rem] border border-slate-800 space-y-10 shadow-inner">
                      <div className="flex items-center justify-between border-b border-slate-800/50 pb-8"><div className="flex items-center gap-3"><Music size={20} className="text-orange-500"/><h4 className="text-lg font-black text-white uppercase tracking-tight">Audio Master</h4></div><div className="flex items-center gap-4"><input type="file" accept="audio/*" onChange={(e) => { const f = e.target.files?.[0]; if(f){ setBgmName(f.name); setBgmFile(f); } }} className="hidden" id="bgm-up" /><label htmlFor="bgm-up" className="flex items-center gap-3 px-8 py-3 bg-orange-600/10 text-orange-400 border border-orange-500/30 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-orange-600/20 transition cursor-pointer shadow-lg"><Upload size={16}/>{bgmName || 'Upload BGM'}</label></div></div>
                      <div className="space-y-4"><div className="flex justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest"><span>Atmosphere Gain</span><span className="text-orange-500">{Math.round(bgmVolume * 100)}%</span></div><input type="range" min="0" max="0.5" step="0.01" value={bgmVolume} onChange={(e) => setBgmVolume(parseFloat(e.target.value))} className="w-full accent-orange-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" /></div>
                      <div className="pt-8 border-t border-slate-800/50">
                        <SubtitleEditor style={subtitleStyle} onChange={(upd) => setSubtitleStyle(p => ({ ...p, ...upd }))} presetType="shorts" />
                      </div>
                   </div>
                )}
                {activeTab === 'seo' && <MetadataManager metadata={state.script} topic={state.topic} style={selectedStyle} />}
             </div>
          </div>
        )}
      </div>
      {showYoutubeModal && currentVideoBlob && state.script && <YoutubeUploadModal videoBlob={currentVideoBlob} initialTitle={state.script.seoTitle || state.script.title} initialDescription={state.script.longDescription} initialTags={state.script.hashtags} onClose={() => setShowYoutubeModal(false)} />}
    </div>
  );
};

export default ShortsCreator;
