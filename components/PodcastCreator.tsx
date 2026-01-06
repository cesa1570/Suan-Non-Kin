
import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, GeneratorMode, Scene } from '../types';
import { generateScript, generatePodcastAudio, generateVideoForScene, generateImageForScene, ERR_INVALID_KEY, summarizeScript } from '../services/geminiService';
import { decodeAudioData } from '../utils/audioUtils';
// Fix: Correct the import source for useApp from the context file instead of App component
import { useApp } from '../contexts/AppContext';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import ArtStyleSelector from './ArtStyleSelector';
import { saveProject, listProjects, deleteProject, ProjectData, exportProjectToJson, addToQueue } from '../services/projectService';
import { 
  Mic, Wand2, Play, Pause, SkipBack, Loader2, AlertCircle, 
  Coffee, Headphones, MessageSquare, Volume2, Download,
  CheckCircle2, RefreshCw, GripVertical, AlignLeft, LogOut,
  Image as ImageIcon, Music, Trash2, Volume1, Save, FolderOpen,
  PlusCircle, History, Clock, ChevronRight, FileJson, Settings,
  Cloud, CloudOff, FileEdit, Video as VideoIcon, Sparkles, X,
  Activity, List, Timer, FileCheck, Film, DownloadCloud, ListPlus, Youtube,
  PlayCircle, FileSearch, Copy, Check, Rocket, BrainCircuit, Tv, Palette
} from 'lucide-react';

interface PodcastCreatorProps {
  initialTopic?: string;
  initialLanguage?: 'Thai' | 'English';
}

const PodcastCreator: React.FC<PodcastCreatorProps> = ({ initialTopic, initialLanguage = 'Thai' }) => {
  const { openKeySelection, hasSelectedKey, resetKeyStatus } = useApp();
  const [state, setState] = useState<ProjectState>({ status: 'idle', topic: initialTopic || '', script: null, currentStep: '' });

  const [language, setLanguage] = useState<'Thai' | 'English'>(initialLanguage);
  const [duration, setDuration] = useState(10);
  const [voiceA, setVoiceA] = useState('Kore');
  const [voiceB, setVoiceB] = useState('Puck');
  const [selectedTextModel, setSelectedTextModel] = useState('gemini-3-flash-preview');
  const [selectedVisualModel, setSelectedVisualModel] = useState<string>('veo-3.1-fast-generate-preview');
  const [selectedStyle, setSelectedStyle] = useState('Cinematic');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [introText, setIntroText] = useState('');
  const [outroText, setOutroText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState('');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [playingPreviewId, setPlayingPreviewId] = useState<number | null>(null);
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [audioBuffers, setAudioBuffers] = useState<Map<number, AudioBuffer>>(new Map());
  const [cooldown, setCooldown] = useState(0);
  const [sceneAssetStage, setSceneAssetStage] = useState<Map<number, 'audio' | 'visual'>>(new Map());
  const [summary, setSummary] = useState<string[] | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [savedProjects, setSavedProjects] = useState<ProjectData[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'draft' | 'saving' | 'saved' | 'error'>('draft');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const lastSaveRef = useRef<number>(Date.now());
  const [bgmUrl, setBgmUrl] = useState<string | undefined>(undefined);
  const [bgmBase64, setBgmBase64] = useState<string | undefined>(undefined);
  const [bgmName, setBgmName] = useState<string | null>(null);
  const [bgmVolume, setBgmVolume] = useState(0.15);
  const [currentVideoBlob, setCurrentVideoBlob] = useState<Blob | null>(null);
  const [isQueuing, setIsQueuing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const playerRef = useRef<VideoPlayerRef>(null);

  const refreshProjectList = async () => { const projects = await listProjects('podcast'); setSavedProjects(projects); };
  useEffect(() => { refreshProjectList(); }, [saveStatus]);
  useEffect(() => { if (initialTopic) setState(prev => ({ ...prev, topic: initialTopic })); if (initialLanguage) setLanguage(initialLanguage); }, [initialTopic, initialLanguage]);
  useEffect(() => { if (cooldown > 0) { const timer = setInterval(() => setCooldown(prev => prev - 1), 1000); return () => clearInterval(timer); } }, [cooldown]);
  useEffect(() => { if (state.script || state.topic) { setSaveStatus(prev => (prev === 'saved' ? 'draft' : prev)); } }, [state.topic, state.script, language, duration, voiceA, voiceB, introText, outroText, bgmName, bgmVolume, selectedVisualModel, selectedTextModel, selectedStyle]);

  const handleError = async (error: any) => { if (error.code === ERR_INVALID_KEY) { resetKeyStatus(); await openKeySelection(); } setState(prev => ({ ...prev, status: 'error', error: error.message })); };

  const handleSaveProject = async (saveAsNew: boolean = false) => {
    if (!state.script && !state.topic) return;
    setSaveStatus('saving');
    const projectId = (saveAsNew || !state.id) ? `podcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : state.id;
    const projectTitle = state.script?.title || state.topic || "Untitled Podcast";
    const project: ProjectData = { id: projectId, type: 'podcast', title: saveAsNew ? `${projectTitle} (v${Date.now()})` : projectTitle, topic: state.topic, lastUpdated: Date.now(), config: { language, duration, voiceA, voiceB, selectedVisualModel, selectedTextModel, selectedStyle, introText, outroText, bgmName, bgmVolume, bgmBase64 }, script: state.script };
    try { await saveProject(project); lastSaveRef.current = Date.now(); setState(prev => ({ ...prev, id: projectId })); setSaveStatus('saved'); await refreshProjectList(); } catch (err) { setSaveStatus('draft'); }
  };

  const handleLoadProject = async (project: ProjectData) => {
    stopAudio(); setCurrentVideoBlob(null); setSummary(null); setShowSummary(false);
    const restoredBuffers = new Map<number, AudioBuffer>();
    const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = ctx;
    const updatedScenes = project.script?.scenes ? await Promise.all(project.script.scenes.map(async (scene: any) => {
      if (scene.audioBase64) {
        try { const buffer = await decodeAudioData(scene.audioBase64, ctx); restoredBuffers.set(scene.id, buffer); return { ...scene, audioBuffer: buffer }; } catch (e) { return scene; }
      }
      return scene;
    })) : [];
    setState({ id: project.id, status: 'idle', topic: project.topic, script: project.script ? { ...project.script, scenes: updatedScenes } : null, currentStep: '' });
    setLanguage(project.config.language); setDuration(project.config.duration); setVoiceA(project.config.voiceA); setVoiceB(project.config.voiceB); setSelectedVisualModel(project.config.selectedVisualModel || 'gemini-2.5-flash-image'); setSelectedTextModel(project.config.selectedTextModel || 'gemini-3-flash-preview'); setSelectedStyle(project.config.selectedStyle || 'Cinematic'); setIntroText(project.config.introText || ''); setOutroText(project.config.outroText || ''); setBgmName(project.config.bgmName || null); setBgmVolume(project.config.bgmVolume || 0.15);
    if (project.config.bgmBase64) { setBgmBase64(project.config.bgmBase64); setBgmUrl(`data:audio/mpeg;base64,${project.config.bgmBase64}`); } else { setBgmUrl(undefined); setBgmBase64(undefined); }
    setAudioBuffers(restoredBuffers); setShowHistory(false); setSaveStatus('saved'); lastSaveRef.current = Date.now();
  };

  const handleBgmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBgmName(file.name); const url = URL.createObjectURL(file); setBgmUrl(url);
    const reader = new FileReader(); reader.onload = (ev) => { const result = ev.target?.result as string; const base64 = result.split(',')[1]; setBgmBase64(base64); }; reader.readAsDataURL(file);
  };

  const clearBgm = () => {
    if (bgmUrl && bgmUrl.startsWith('blob:')) URL.revokeObjectURL(bgmUrl);
    setBgmUrl(undefined); setBgmBase64(undefined); setBgmName(null);
    if (bgmSourceRef.current) { try { bgmSourceRef.current.stop(); } catch(e) {} bgmSourceRef.current = null; }
  };

  const handleGenerateScript = async () => {
    if (!state.topic) return;
    setIsGenerating(true); setSummary(null); setShowSummary(false);
    setState(prev => ({ ...prev, status: 'generating_script', error: undefined }));
    try {
      const promptWithContext = `${state.topic}${introText ? `. Intro: ${introText}` : ''}${outroText ? `. Outro: ${outroText}` : ''}`;
      const scriptData = await generateScript(promptWithContext, GeneratorMode.PODCAST, '16:9', language, duration, selectedVisualModel, selectedStyle, selectedTextModel);
      scriptData.scenes = scriptData.scenes.map(s => ({ ...s, status: 'pending' }));
      setState(prev => ({ ...prev, script: scriptData, status: 'idle' }));
    } catch (error: any) { handleError(error); } finally { setIsGenerating(false); }
  };

  const processScene = async (scene: Scene, forceVisual = false, forceAudio = false) => {
    updateScene(scene.id, { status: 'generating', error: undefined });
    try {
      let audioBase64 = scene.audioBase64;
      let buffer = audioBuffers.get(scene.id);
      if (!audioBase64 || forceAudio) {
        setSceneAssetStage(prev => new Map(prev).set(scene.id, 'audio'));
        audioBase64 = await generatePodcastAudio(scene.voiceover, voiceA, voiceB);
        const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = ctx;
        buffer = await decodeAudioData(audioBase64, ctx);
        setAudioBuffers(prev => new Map(prev).set(scene.id, buffer!));
      }
      let imageUrl = scene.imageUrl; let videoUrl = scene.videoUrl;
      const isVideoModel = selectedVisualModel.startsWith('veo');
      if (forceVisual || (!imageUrl && !videoUrl)) {
        setSceneAssetStage(prev => new Map(prev).set(scene.id, 'visual'));
        if (isVideoModel) { imageUrl = undefined; videoUrl = await generateVideoForScene(scene.visual_prompt, '16:9', selectedVisualModel, selectedStyle); } 
        else { videoUrl = undefined; imageUrl = await generateImageForScene(scene.visual_prompt, selectedVisualModel, '16:9', selectedStyle); }
      }
      updateScene(scene.id, { status: 'completed', audioBase64, audioBuffer: buffer, imageUrl, videoUrl });
      return buffer;
    } catch (err: any) {
      updateScene(scene.id, { status: 'failed', error: err.message });
      handleError(err); throw err;
    } finally { setSceneAssetStage(prev => { const next = new Map(prev); next.delete(scene.id); return next; }); }
  };

  const handleGenerateAllAssets = async () => {
    if (!state.script) return;
    if (selectedVisualModel.includes('veo') && !hasSelectedKey) { await openKeySelection(); return; }
    setState(prev => ({ ...prev, status: 'generating_assets' }));
    setShowQueue(true);
    const pending = state.script.scenes.filter(s => s.status !== 'completed' && s.status !== 'skipped');
    try {
        await Promise.all(pending.map(scene => processScene(scene)));
        setState(prev => ({ ...prev, status: 'ready' }));
        handleSaveProject();
    } catch (err: any) { handleError(err); }
  };

  const updateScene = (sceneId: number, updates: Partial<Scene>) => {
    setState(prev => { if (!prev.script) return prev; return { ...prev, script: { ...prev.script, scenes: prev.script.scenes.map(s => s.id === sceneId ? { ...s, ...updates } : s) } }; });
  };

  const stopAudio = () => {
    if (activeSourceRef.current) { try { activeSourceRef.current.stop(); } catch(e) {} activeSourceRef.current = null; }
    if (bgmSourceRef.current) { try { bgmSourceRef.current.stop(); } catch(e) {} bgmSourceRef.current = null; }
    setIsPlaying(false); setPlayingPreviewId(null);
  };

  const playSequence = async (index: number) => {
    if (!state.script || index >= state.script.scenes.length) { stopAudio(); setCurrentSceneIdx(0); return; }
    setCurrentSceneIdx(index);
    const scene = state.script.scenes[index];
    let buffer = audioBuffers.get(scene.id);
    if (!buffer) { try { buffer = await processScene(scene); } catch (e) { playSequence(index + 1); return; } }
    const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = ctx; if (ctx.state === 'suspended') await ctx.resume();
    if (index === 0 && bgmUrl && !bgmSourceRef.current) {
       try {
          const response = await fetch(bgmUrl); const arrayBuffer = await response.arrayBuffer(); const decodedBgm = await ctx.decodeAudioData(arrayBuffer);
          const bSource = ctx.createBufferSource(); bSource.buffer = decodedBgm; bSource.loop = true;
          const bGain = ctx.createGain(); bGain.gain.value = bgmVolume; bSource.connect(bGain); bGain.connect(ctx.destination); bSource.start();
          bgmSourceRef.current = bSource; bgmGainRef.current = bGain;
       } catch (e) { console.error("BGM player error", e); }
    }
    const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(ctx.destination);
    source.onended = () => { if (isPlaying) playSequence(index + 1); };
    activeSourceRef.current = source; source.start(); setIsPlaying(true); setPlayingPreviewId(null);
  };

  const handleExport = async () => {
    if (!playerRef.current) return;
    setIsExporting(true); setExportProgress(0); setExportStage('Encoding Viral Motion');
    try {
      const { blob, extension } = await playerRef.current.renderVideo((p, s, f, tf) => {
          setExportProgress(p); setExportStage(s);
          if (f !== undefined) setCurrentFrame(f); if (tf !== undefined) setTotalFrames(tf);
      });
      setCurrentVideoBlob(blob); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `podcast-${Date.now()}.${extension}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (err: any) { alert("ดาวน์โหลดล้มเหลว"); } finally { setIsExporting(false); }
  };

  const handleAddToQueue = async () => {
    if (!currentVideoBlob || !state.script) return;
    setIsQueuing(true);
    try {
      await addToQueue({ 
        id: `yt-q-${Date.now()}`, 
        projectId: state.id || 'unknown', 
        projectType: 'podcast', 
        videoBlob: currentVideoBlob || undefined, 
        metadata: {
          title: (state.script.seoTitle || state.script.title).substring(0, 100), 
          description: state.script.longDescription,
          tags: state.script.hashtags || [],
          privacy_status: 'private'
        },
        status: 'waiting', 
        progress: 0, 
        system_note: 'Queued from Podcast Studio',
        addedAt: Date.now(),
        queued_at: new Date().toISOString()
      });
      alert("Added to YouTube Auto Queue!");
    } catch (err) { alert("Failed to queue video."); } finally { setIsQueuing(false); }
  };

  const totalAssets = state.script?.scenes.length || 0;
  const completedAssets = state.script?.scenes.filter(s => s.status === 'completed').length || 0;

  return (
    <div className="flex flex-col gap-8 relative">
      {showStyleSelector && (
        <ArtStyleSelector 
          selectedId={selectedStyle} 
          onSelect={setSelectedStyle} 
          onClose={() => setShowStyleSelector(false)} 
        />
      )}

      {/* Workspace Controls */}
      <div className="flex flex-wrap items-center gap-4 bg-slate-900/50 p-4 rounded-[2rem] border border-slate-800/50 backdrop-blur-sm z-30">
         <button onClick={() => { if(confirm("Start new podcast?")) { stopAudio(); setState({status:'idle', topic:'', script:null, currentStep:''}); setSaveStatus('draft'); setCurrentVideoBlob(null); setSummary(null); setShowSummary(false); } }} className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-slate-300 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition shadow-lg border border-slate-700">
           <PlusCircle size={14}/> New Workspace
         </button>
         <div className="flex items-center gap-2">
            <button onClick={() => handleSaveProject(false)} disabled={saveStatus === 'saving'} className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg border ${saveStatus === 'saved' ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20' : saveStatus === 'saving' ? 'bg-purple-800 text-purple-300 cursor-wait border-purple-700' : 'bg-purple-600 text-white hover:bg-purple-500 border-purple-500 shadow-purple-900/30'}`}>
              {saveStatus === 'saving' ? <Loader2 size={14} className="animate-spin"/> : saveStatus === 'saved' ? <CheckCircle2 size={14}/> : <Save size={14}/>}
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Project Saved' : 'Save Project'}
            </button>
         </div>
         <button onClick={() => setShowHistory(!showHistory)} className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition ${showHistory ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}><History size={14}/> Recent Work</button>
         {state.script && (
            <button onClick={() => setShowQueue(!showQueue)} className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition ${showQueue ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}><Activity size={14}/> Queue {completedAssets}/{totalAssets}</button>
         )}
      </div>

      <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl">
        <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3"><Mic className="text-red-500" size={24}/><h2 className="text-xl font-black text-white uppercase tracking-tight">Podcast Studio</h2></div>
        </div>
        <div className="space-y-6">
          <div className="relative">
            <input type="text" placeholder="Enter a deep dive topic..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 pr-36 text-white text-lg font-kanit outline-none shadow-inner focus:ring-2 focus:ring-red-600/30 transition-all" value={state.topic} onChange={(e) => setState(prev => ({ ...prev, topic: e.target.value }))} />
            <button onClick={handleGenerateScript} disabled={!state.topic || isGenerating} className="absolute right-3 top-3 bottom-3 px-6 bg-red-600 text-white rounded-xl font-black transition flex items-center gap-2 uppercase tracking-widest text-[10px] hover:bg-red-500 shadow-lg shadow-red-900/30">{isGenerating ? <Loader2 className="animate-spin" size={18}/> : <Wand2 size={18}/>}<span>Compose Script</span></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
             <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <label className="text-[9px] font-black text-slate-600 uppercase block mb-2 flex items-center gap-1.5"><BrainCircuit size={10} className="text-purple-400"/> Intelligence</label>
                <select value={selectedTextModel} onChange={(e) => setSelectedTextModel(e.target.value)} className="w-full bg-transparent text-white font-bold text-xs outline-none cursor-pointer">
                  <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                  <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                </select>
             </div>
             <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <label className="text-[9px] font-black text-slate-600 uppercase block mb-2 flex items-center gap-1.5"><Tv size={10} className="text-blue-400"/> Visual Engine</label>
                <select value={selectedVisualModel} onChange={(e) => setSelectedVisualModel(e.target.value)} className="w-full bg-transparent text-white font-bold text-xs outline-none cursor-pointer">
                  <option value="gemini-2.5-flash-image">Static Core</option>
                  <option value="veo-3.1-fast-generate-preview">Motion Core</option>
                </select>
             </div>
             <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <label className="text-[9px] font-black text-slate-600 uppercase block mb-2 flex items-center gap-1.5"><Palette size={10} className="text-pink-400"/> Art Style</label>
                <button 
                  onClick={() => setShowStyleSelector(true)}
                  className="w-full flex items-center justify-between text-white font-bold text-xs outline-none cursor-pointer"
                >
                  <span className="truncate">{selectedStyle}</span>
                  <ChevronRight size={14} className="text-slate-600" />
                </button>
             </div>
             <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <label className="text-[9px] font-black text-slate-600 uppercase block mb-2">Voice Alpha</label>
                <select value={voiceA} onChange={(e) => setVoiceA(e.target.value)} className="w-full bg-transparent text-white font-bold text-xs outline-none cursor-pointer">
                  <option value="Kore">Kore (Male)</option>
                  <option value="Zephyr">Zephyr (Male)</option>
                </select>
             </div>
             <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <label className="text-[9px] font-black text-slate-600 uppercase block mb-2">Voice Beta</label>
                <select value={voiceB} onChange={(e) => setVoiceB(e.target.value)} className="w-full bg-transparent text-white font-bold text-xs outline-none cursor-pointer">
                  <option value="Puck">Puck (Female)</option>
                  <option value="Charon">Charon (Male)</option>
                </select>
             </div>
             <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <label className="text-[9px] font-black text-slate-600 uppercase block mb-2">Length (Mins)</label>
                <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full bg-transparent text-white font-bold text-xs outline-none cursor-pointer">
                  {[5, 10, 15, 20].map(v => <option key={v} value={v}>{v} min</option>)}
                </select>
             </div>
          </div>
        </div>
      </div>

      {state.script && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
          <div className="lg:col-span-7 space-y-4">
             <div className="flex items-center justify-between bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl relative overflow-hidden ring-1 ring-slate-800/50">
                <div className="flex items-center gap-5">
                   <div className="w-14 h-14 rounded-2xl bg-orange-600/10 flex items-center justify-center text-orange-500 shadow-inner border border-orange-500/20"><Rocket size={28}/></div>
                   <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">High-Velocity Pipeline</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{completedAssets} / {totalAssets} Ready</p>
                   </div>
                </div>
                <button 
                  onClick={handleGenerateAllAssets}
                  disabled={state.status === 'generating_assets' || (completedAssets === totalAssets && totalAssets > 0)}
                  className={`px-12 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 group active:scale-95 ${state.status === 'generating_assets' ? 'bg-orange-600 text-white animate-pulse' : 'bg-red-600 text-white hover:bg-red-500 shadow-red-900/30'}`}
                >
                  {state.status === 'generating_assets' ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />}
                  {state.status === 'generating_assets' ? 'Mass Synthesizing...' : 'Synthesize All Segments'}
                </button>
             </div>

             <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800 relative">
                {state.script.scenes.map((scene, idx) => (
                  <div key={scene.id} className={`p-6 rounded-2xl border transition-all relative group overflow-hidden ${currentSceneIdx === idx && isPlaying ? 'bg-red-600/10 border-red-500/50' : 'bg-slate-900 border-slate-800'}`}>
                    <div className="flex items-center justify-between mb-4">
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dialogue Segment #{idx + 1}</span>
                       <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${scene.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : scene.status === 'generating' ? 'bg-orange-500/10 text-orange-500 animate-pulse' : 'bg-slate-800 text-slate-600'}`}>
                             {scene.status}
                          </span>
                          <button onClick={() => processScene(scene, true, true)} className="p-2 text-slate-500 hover:text-white transition active:rotate-180 duration-500"><RefreshCw size={14}/></button>
                       </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/50 italic text-sm text-slate-300 font-kanit">
                          {scene.voiceover}
                       </div>
                       <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/50 text-[10px] text-slate-500 font-mono">
                          {scene.visual_prompt}
                       </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
          <div className="lg:col-span-5 space-y-6">
             <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl sticky top-24">
                <div className="rounded-[1.5rem] overflow-hidden bg-black mb-6 border border-slate-800 aspect-video">
                    <VideoPlayer ref={playerRef} scenes={state.script.scenes.filter(s => s.status === 'completed')} isReady={completedAssets > 0} aspectRatio="16:9" bgmUrl={bgmUrl} bgmVolume={bgmVolume} />
                </div>
                <div className="space-y-4">
                   <button onClick={() => isPlaying ? stopAudio() : playSequence(0)} className={`w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all ${isPlaying ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                      {isPlaying ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}
                      {isPlaying ? 'Halt Playback' : 'Master Audio Preview'}
                   </button>
                   <button onClick={handleExport} disabled={completedAssets === 0 || isExporting} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 disabled:opacity-50">
                      {isExporting ? <Loader2 size={18} className="animate-spin"/> : <Download size={18}/>}
                      {isExporting ? `Rendering ${Math.round(exportProgress)}%` : 'Export Broadcast (MP4)'}
                   </button>
                   <button onClick={handleAddToQueue} disabled={!currentVideoBlob || isQueuing} className="w-full py-4 bg-red-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 disabled:opacity-50">
                      {isQueuing ? <Loader2 size={18} className="animate-spin"/> : <Youtube size={18}/>}
                      Deploy to YouTube
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
      {showHistory && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-8 animate-in fade-in duration-300"><div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-[4rem] p-12 relative shadow-3xl overflow-hidden ring-1 ring-slate-700"><button onClick={() => setShowHistory(false)} className="absolute top-10 right-10 text-slate-500 hover:text-white transition p-2 active:scale-90"><X size={36}/></button><h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-12">Podcast Archives</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto pr-6 scrollbar-thin scrollbar-thumb-slate-800">{savedProjects.map(proj => (<div key={proj.id} onClick={() => { handleLoadProject(proj); }} className="bg-slate-950 border border-slate-800 p-8 rounded-[2.5rem] hover:border-purple-500 hover:bg-purple-500/5 transition-all cursor-pointer group shadow-xl"><span className="text-[10px] font-black text-purple-400 uppercase block mb-3">{new Date(proj.lastUpdated).toLocaleDateString()}</span><h4 className="text-lg font-bold text-white line-clamp-1 uppercase tracking-tight group-hover:text-purple-400 transition-colors">{proj.title}</h4><p className="text-[11px] text-slate-500 italic mt-3 line-clamp-2 leading-relaxed font-kanit">{proj.topic}</p></div>))}{savedProjects.length === 0 && <div className="col-span-full py-20 text-center text-slate-600 font-black uppercase tracking-[0.4em]">Archive Data Empty</div>}</div></div></div>)}
    </div>
  );
};

export default PodcastCreator;
