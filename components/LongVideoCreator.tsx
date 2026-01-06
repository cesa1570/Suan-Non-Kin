import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, GeneratorMode, Scene, SubtitleStyle, ScriptData } from '../types';
import { generateLongVideoScript, generateVideoForScene, generateImageForScene, generateVoiceover, ERR_INVALID_KEY, summarizeScript, refineVisualPrompt, generateStoryboards } from '../services/geminiService';
import { decodeAudioData } from '../utils/audioUtils';
import { useApp } from '../contexts/AppContext';
import { useAutomation } from '../contexts/AutomationContext';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import SceneManager from './SceneManager';
import MetadataManager from './MetadataManager';
import SubtitleEditor from './SubtitleEditor';
import YoutubeUploadModal from './YoutubeUploadModal';
import ArtStyleSelector from './ArtStyleSelector';
import { saveProject, listProjects, ProjectData, exportProjectToJson, deleteProject, addToQueue, validateYoutubeMetadata } from '../services/projectService';
import {
  Video as VideoIcon, Loader2, AlertCircle, Save, History,
  Sparkles, Download, Youtube, Palette, Layers, BarChart3, 
  Type, Headphones, X, Upload, Trash2, MessageCircle, 
  CheckCircle2, Copy, FolderOpen, Clock, FileJson, Info, Book, Music, Play, Pause, Library, Layout, Settings, Eye, EyeOff, Rocket, VolumeX, Volume2, FileText, ChevronDown, ChevronUp, ListChecks, Tv, Activity, Send, ListPlus, ShieldCheck, Timer, Zap, Cpu, ChevronRight, Monitor, Settings2, Cloud, CloudOff, FileEdit, Wand2, FastForward, Plus, BrainCircuit, Calendar
} from 'lucide-react';

const SaveStatusIndicator = ({ status, lastSaved }: { status: 'draft' | 'saving' | 'saved' | 'error', lastSaved?: number }) => {
  const timeStr = lastSaved ? new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  
  switch (status) {
    case 'saving': return (
      <div className="flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/40 text-[11px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(37,99,235,0.3)] animate-pulse ring-1 ring-blue-500/30">
        <Loader2 size={16} className="animate-spin" />
        <span>Saving Changes...</span>
      </div>
    );
    case 'saved': return (
      <div className="flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/30">
        <CheckCircle2 size={16} className="text-emerald-500" />
        <span>All Changes Saved {timeStr && <span className="opacity-60 ml-1 font-bold">at {timeStr}</span>}</span>
      </div>
    );
    case 'error': return (
      <div className="flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/40 text-[11px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.3)] animate-bounce ring-1 ring-red-500/30">
        <CloudOff size={16} />
        <span>Save Failed</span>
      </div>
    );
    default: return (
      <div className="flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-black uppercase tracking-widest shadow-inner ring-1 ring-slate-700/50">
        <FileEdit size={16} className="text-slate-500" />
        <span>Draft • Unsaved</span>
      </div>
    );
  }
};

const formatTime = (seconds: number) => {
  if (!isFinite(seconds) || seconds < 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

interface LongVideoCreatorProps {
  initialTopic?: string;
  initialLanguage?: string;
  apiKey: string;
}

const LongVideoCreator: React.FC<LongVideoCreatorProps> = ({ initialTopic, initialLanguage = 'Thai', apiKey }) => {
  const { openKeySelection, resetKeyStatus } = useApp();
  const { addLog } = useAutomation();
  const [state, setState] = useState<ProjectState>({ status: 'idle', topic: initialTopic || '', script: null, currentStep: '' });
  const [language, setLanguage] = useState<'Thai' | 'English'>(initialLanguage as any);
  const [duration, setDuration] = useState(10);
  const aspectRatio = '16:9';
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [selectedVisualModel, setSelectedVisualModel] = useState('veo-3.1-fast-generate-preview');
  const [selectedTextModel, setSelectedTextModel] = useState('gemini-3-pro-preview');
  const [selectedStyle, setSelectedStyle] = useState('Cinematic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'script' | 'styling' | 'seo'>('script');
  const [currentVideoBlob, setCurrentVideoBlob] = useState<Blob | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'draft' | 'saving' | 'saved' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<number | undefined>(undefined);
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [savedProjects, setSavedProjects] = useState<ProjectData[]>([]);
  const [hideSubtitles, setHideSubtitles] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isRefiningAll, setIsRefiningAll] = useState(false);
  const [isSequencePlaying, setIsSequencePlaying] = useState(false);
  const [summary, setSummary] = useState<string[] | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isStoryboarding, setIsStoryboarding] = useState(false);
  
  // Queue Specific States
  const [scheduledTime, setScheduledTime] = useState<string>('');
  
  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState('');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [renderFps, setRenderFps] = useState(0);
  const renderStartTimeRef = useRef<number>(Date.now());

  const audioContextRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<VideoPlayerRef>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  };

  const [exportResolution, setExportResolution] = useState<'360p' | '720p' | '1080p' | '4k'>('1080p');
  const [useHighBitrate, setUseHighBitrate] = useState(true);
  const [isQueuing, setIsQueuing] = useState(false);

  const [bgmUrl, setBgmUrl] = useState<string | undefined>(undefined);
  const [bgmFile, setBgmFile] = useState<Blob | null>(null);
  const [bgmName, setBgmName] = useState<string | null>(null);
  const [bgmVolume, setBgmVolume] = useState(0.12);

  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>({
    fontSize: 42, textColor: '#FFFFFF', backgroundColor: '#000000', backgroundOpacity: 0.5, verticalOffset: 12, fontFamily: 'Inter', outlineColor: '#000000', outlineWidth: 1, shadowBlur: 2, shadowColor: 'rgba(0,0,0,0.5)', fontWeight: '400'
  });

  useEffect(() => { refreshProjectList(); }, []);
  const refreshProjectList = async () => { const projects = await listProjects('long'); setSavedProjects(projects); };

  useEffect(() => {
    if (bgmFile && !bgmUrl) {
      const url = URL.createObjectURL(bgmFile);
      setBgmUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [bgmFile]);

  useEffect(() => {
    setSaveStatus(prev => (prev === 'saved' ? 'draft' : prev));
  }, [language, duration, selectedVoice, selectedVisualModel, selectedStyle, subtitleStyle, bgmVolume, bgmName, hideSubtitles, selectedTextModel, state.topic, state.script]);

  const handleGenerateScript = async () => {
    if (!state.topic) return;
    setIsGenerating(true); setSummary(null);
    try {
      const scriptData = await generateLongVideoScript(state.topic, aspectRatio, language, duration, selectedStyle, selectedTextModel);
      setState(prev => ({ ...prev, script: scriptData, status: 'idle' }));
      setSaveStatus('draft');
    } catch (error: any) {
      if (error.code === ERR_INVALID_KEY) { resetKeyStatus(); openKeySelection(); }
      setState(prev => ({ ...prev, status: 'error', error: error.message }));
    } finally { setIsGenerating(false); }
  };

  const handleRefinePrompt = async (scene: Scene) => {
    try {
      updateScene(scene.id, { statusDetail: "AI Refining..." });
      const refined = await refineVisualPrompt(state.topic, selectedStyle, scene.voiceover);
      updateScene(scene.id, { visual_prompt: refined, statusDetail: "Style Optimized" });
    } catch (err) {
      console.error("Visual refinement failed", err);
    }
  };

  const handleAutoStoryboard = async () => {
    if (!state.script || !state.script.scenes || isStoryboarding) return;
    setIsStoryboarding(true);
    try {
      const scenesForAi = state.script.scenes.map(s => ({ id: s.id, voiceover: s.voiceover }));
      const newPrompts = await generateStoryboards(state.topic, selectedStyle, scenesForAi);
      setState(prev => {
        if (!prev.script) return prev;
        return {
          ...prev,
          script: {
            ...prev.script,
            scenes: prev.script.scenes.map(s => ({
              ...s,
              visual_prompt: newPrompts[s.id] || s.visual_prompt
            }))
          }
        };
      });
      setSaveStatus('draft');
      addLog?.("Storyboard sequence narratively and atmospherically optimized.");
    } catch (err) {
      console.error("Storyboarding failed", err);
    } finally {
      setIsStoryboarding(false);
    }
  };

  const handlePreviewVoiceover = async (scene: Scene) => {
    updateScene(scene.id, { statusDetail: "Synthesizing VO..." });
    try {
      const audioBase64 = await generateVoiceover(scene.voiceover, selectedVoice);
      const audioCtx = getAudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      const audioBuffer = await decodeAudioData(audioBase64, audioCtx);
      updateScene(scene.id, { audioBase64, audioBuffer, statusDetail: "VO Ready" });
    } catch (err: any) {
      updateScene(scene.id, { statusDetail: "VO Error" });
    }
  };

  const handleSummarize = async () => {
    if (!state.script) return;
    setIsSummarizing(true); setShowSummary(true);
    try { const bullets = await summarizeScript(state.script); setSummary(bullets); } catch (err) { console.error(err); } finally { setIsSummarizing(false); }
  };

  const processScene = async (scene: Scene) => {
    if (scene.status === 'completed') return;
    updateScene(scene.id, { status: 'generating', assetStage: 'audio', processingProgress: 5, statusDetail: "Syncing Voice..." });
    try {
      const audioBase64 = await generateVoiceover(scene.voiceover, selectedVoice);
      const audioCtx = getAudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      const audioBuffer = await decodeAudioData(audioBase64, audioCtx);
      updateScene(scene.id, { assetStage: 'visual', processingProgress: 35, audioBase64, audioBuffer, statusDetail: "Generating Visual..." });
      let activePrompt = scene.visual_prompt;
      const isVideo = selectedVisualModel.startsWith('veo');
      let visualResult: string;
      if (isVideo) {
        visualResult = await generateVideoForScene(activePrompt, aspectRatio, selectedVisualModel, selectedStyle, (polls) => {
             const p = Math.min(98, 35 + (polls * 4));
             updateScene(scene.id, { processingProgress: p, statusDetail: `Rendering...` });
          }
        );
      } else {
        visualResult = await generateImageForScene(activePrompt, selectedVisualModel, aspectRatio, selectedStyle);
      }
      updateScene(scene.id, { status: 'completed', assetStage: undefined, processingProgress: 100, statusDetail: "Synced", videoUrl: visualResult.startsWith('http') && isVideo ? visualResult : undefined, imageUrl: !isVideo ? visualResult : undefined });
    } catch (err: any) { 
      updateScene(scene.id, { status: 'failed', processingProgress: 0, error: err.message, statusDetail: "Node Error" }); 
    }
  };

  const handleGenerateAll = async () => {
    if (!state.script || isProcessingAll) return;
    setIsProcessingAll(true);
    try {
      const pendingScenes = (state.script.scenes || []).filter(s => s.status !== 'completed' && s.status !== 'skipped');
      const BATCH_SIZE = 3;
      for (let i = 0; i < pendingScenes.length; i += BATCH_SIZE) {
         const chunk = pendingScenes.slice(i, i + BATCH_SIZE);
         chunk.forEach(s => updateScene(s.id, { status: 'generating', statusDetail: 'Queued...' }));
         await Promise.allSettled(chunk.map(scene => processScene(scene)));
         await handleSaveProject();
      }
    } finally { 
      setIsProcessingAll(false); 
    }
  };

  const updateScene = (sceneId: number, updates: Partial<Scene>) => {
    setState(prev => { if (!prev.script) return prev; return { ...prev, script: { ...prev.script, scenes: (prev.script.scenes || []).map(s => s.id === sceneId ? { ...s, ...updates } : s) } }; });
    setSaveStatus('draft');
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
    if (!confirm("Remove this scene?")) return;
    setState(prev => {
      if (!prev.script || !prev.script.scenes) return prev;
      return { ...prev, script: { ...prev.script, scenes: prev.script.scenes.filter(s => s.id !== sceneId) } };
    });
    setSaveStatus('draft');
  };

  const handleAddScene = () => {
    setState(prev => {
      if (!prev.script) return prev;
      const newScene: Scene = { id: Date.now(), voiceover: "New segment...", visual_prompt: "Visual...", duration_est: 5, status: 'pending' };
      return { ...prev, script: { ...prev.script, scenes: [...(prev.script.scenes || []), newScene] } };
    });
    setSaveStatus('draft');
  };

  const handleSaveProject = async () => {
    if (!state.script && !state.topic) return;
    setSaveStatus('saving');
    const project: ProjectData = { id: state.id || `long-${Date.now()}`, type: 'long', title: state.script?.title || state.topic || "Untilted Documentary", topic: state.topic, lastUpdated: Date.now(), config: { language, duration, aspectRatio, selectedVoice, selectedVisualModel, selectedTextModel, selectedStyle, subtitleStyle, bgmVolume, bgmName, bgmFile, hideSubtitles }, script: state.script };
    try { await saveProject(project); setLastSavedTime(project.lastUpdated); setState(prev => ({ ...prev, id: project.id })); setSaveStatus('saved'); refreshProjectList(); } catch (e) { setSaveStatus('error'); }
  };

  const handleLoadProject = async (project: ProjectData) => {
    const ctx = getAudioContext();
    const updatedScenes = project.script?.scenes ? await Promise.all(project.script.scenes.map(async (scene: any) => {
      if (scene.audioBase64) { try { const buffer = await decodeAudioData(scene.audioBase64, ctx); return { ...scene, audioBuffer: buffer }; } catch (e) { return scene; } }
      return scene;
    })) : [];
    setState({ id: project.id, status: 'idle', topic: project.topic, script: project.script ? { ...project.script, scenes: updatedScenes } : null, currentStep: '' });
    if (project.config) {
      setLanguage(project.config.language || 'Thai'); setDuration(project.config.duration || 10); setSelectedVoice(project.config.selectedVoice || 'Kore'); setSelectedVisualModel(project.config.selectedVisualModel || 'veo-3.1-fast-generate-preview'); setSelectedTextModel(project.config.selectedTextModel || 'gemini-3-pro-preview'); setSelectedStyle(project.config.selectedStyle || 'Cinematic'); setSubtitleStyle(project.config.subtitleStyle || subtitleStyle); setBgmVolume(project.config.bgmVolume || 0.12); setBgmName(project.config.bgmName || null); setBgmFile(project.config.bgmFile || null); setHideSubtitles(project.config.hideSubtitles || false);
    }
    setShowHistory(false); setSummary(null); setShowSummary(false);
    setTimeout(() => { setSaveStatus('saved'); setLastSavedTime(project.lastUpdated); }, 100);
  };

  // [Fix] Added handleBgmUpload to handle custom background music files
  const handleBgmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgmName(file.name);
    setBgmFile(file);
  };

  const handleExport = async () => {
    if (!playerRef.current) return;
    setIsExporting(true); setExportProgress(0); setExportStage('Initializing...');
    setCurrentFrame(0); setTotalFrames(0); setEtaSeconds(0); setRenderFps(0);
    renderStartTimeRef.current = Date.now();
    let bitrate = 18000000;
    if (exportResolution === '4k') bitrate = 45000000;
    else if (exportResolution === '720p') bitrate = 8000000;
    try {
      const { blob, extension } = await playerRef.current.renderVideo((p, stage, cf, tf) => {
        setExportProgress(p); if (stage) setExportStage(stage);
        if (cf !== undefined) setCurrentFrame(cf); if (tf !== undefined) setTotalFrames(tf);
        if (cf && tf && cf > 0) {
          const elapsed = (Date.now() - renderStartTimeRef.current) / 1000;
          const fps = cf / elapsed; setRenderFps(fps);
          const remainingFrames = tf - cf; setEtaSeconds(remainingFrames / fps);
        }
      }, { resolution: exportResolution as any, bitrate: useHighBitrate ? bitrate : bitrate / 2 });
      setCurrentVideoBlob(blob); 
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `documentary-${Date.now()}.${extension}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (err: any) {
      alert("Render Failed.");
    } finally { setIsExporting(false); }
  };

  const handleAddToQueueFlow = async () => {
    if (!state.script) return;
    setIsQueuing(true);
    try {
      await handleSaveProject();
      const tagArray = state.script.hashtags || [];
      const validation = validateYoutubeMetadata(state.script.seoTitle || state.script.title, state.script.longDescription, tagArray);
      
      const publishAtISO = scheduledTime ? new Date(scheduledTime).toISOString() : undefined;

      await addToQueue({
        id: `q-${Date.now()}`,
        projectId: state.id || `long-${Date.now()}`,
        projectType: 'long',
        videoBlob: currentVideoBlob || undefined,
        metadata: {
          title: (state.script.seoTitle || state.script.title).substring(0, 100),
          description: state.script.longDescription,
          tags: tagArray,
          privacy_status: scheduledTime ? 'private' : 'private',
          publish_at: publishAtISO
        },
        status: 'waiting',
        progress: 0,
        system_note: `Cinema Node Queued. ${publishAtISO ? 'Scheduled for ' + new Date(publishAtISO).toLocaleString() : 'Pending Manual Start'}`,
        addedAt: Date.now(),
        queued_at: new Date().toISOString()
      });
      alert("Added to Autonomous Queue! คุณสามารถติดตามสถานะการเรนเดอร์และกำหนดการอัปโหลดได้ที่หน้า YouTube Studio");
    } catch (e) {
      alert("Queue failed.");
    } finally {
      setIsQueuing(false);
    }
  };

  const completedScenesCount = (state.script?.scenes || []).filter(s => s.status === 'completed').length || 0;
  const totalScenesCount = (state.script?.scenes || []).length || 0;

  return (
    <div className="flex flex-col gap-10 pb-20 relative">
      {showStyleSelector && <ArtStyleSelector selectedId={selectedStyle} onSelect={setSelectedStyle} onClose={() => setShowStyleSelector(false)} />}

      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-xl ring-1 ring-slate-800/50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 pr-8 border-r border-slate-800"><Layout className="text-purple-500" size={24} /><h1 className="text-xl font-black text-white uppercase tracking-tighter">Cinema Studio v4</h1></div>
          <div className="flex items-center gap-6">
            <button onClick={() => handleSaveProject()} disabled={saveStatus === 'saving'} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-lg ${saveStatus === 'saving' ? 'bg-slate-800 text-slate-500' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-750'}`}>
              <Save size={14}/> Save Pipeline
            </button>
            <SaveStatusIndicator status={saveStatus} lastSaved={lastSavedTime} />
          </div>
        </div>
        <div className="flex items-center gap-3"><button onClick={() => setShowHistory(true)} className="px-6 py-2.5 bg-indigo-600/10 text-indigo-400 rounded-xl border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600/20 transition-all"><History size={14} className="inline mr-2"/> Library</button></div>
      </div>

      <div className="flex flex-col xl:flex-row gap-10">
        <div className="flex-1 flex flex-col gap-10">
          <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3.5rem] shadow-2xl space-y-10 relative overflow-hidden ring-1 ring-slate-800/50">
            <div className="flex items-center justify-between relative z-10"><div className="flex items-center gap-3"><div className="w-14 h-14 bg-purple-600/20 rounded-2xl flex items-center justify-center text-purple-400 shadow-inner border border-purple-500/20"><Book size={28}/></div><div><h2 className="text-3xl font-black text-white uppercase tracking-tight">Narrative Direction</h2><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Cinema Grade Scripting</p></div></div>{state.script && (<button onClick={handleSummarize} disabled={isSummarizing} className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-700 shadow-xl transition-all disabled:opacity-50">{isSummarizing ? <Loader2 size={14} className="animate-spin" /> : <ListChecks size={14} />}Summary</button>)}</div>
            <div className="space-y-8 relative z-10"><div className="relative group"><input type="text" placeholder="Documentary Topic..." className="w-full bg-slate-950 border border-slate-800 rounded-3xl p-7 pr-48 text-white text-xl font-kanit outline-none focus:ring-4 focus:ring-purple-600/10 transition-all shadow-inner placeholder:text-slate-700" value={state.topic} onChange={(e) => setState(prev => ({ ...prev, topic: e.target.value }))} /><button onClick={handleGenerateScript} disabled={isGenerating} className="absolute right-3.5 top-3.5 bottom-3.5 px-10 bg-purple-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-purple-500 shadow-2xl transition-all disabled:opacity-50 active:scale-95">{isGenerating ? <Loader2 className="animate-spin" /> : 'Draft Script'}</button></div><div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-slate-950 p-5 rounded-[1.5rem] border border-slate-800 hover:border-slate-700 transition-colors">
                <label className="text-[9px] font-black text-slate-600 uppercase block mb-3 tracking-widest flex items-center gap-1.5"><BrainCircuit size={10} className="text-purple-400"/> Intelligence</label>
                <select value={selectedTextModel} onChange={(e) => setSelectedTextModel(e.target.value)} className="w-full bg-transparent text-white font-bold outline-none text-[13px] cursor-pointer">
                  <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                  <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                </select>
              </div>
              <div className="bg-slate-950 p-5 rounded-[1.5rem] border border-slate-800 hover:border-slate-700 transition-colors"><label className="text-[9px] font-black text-slate-600 uppercase block mb-3 tracking-widest">Time</label><select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full bg-transparent text-white font-bold outline-none text-[13px] cursor-pointer">{[5, 10, 15, 20, 30].map(opt => <option key={opt} value={opt} className="bg-slate-900">{opt} min</option>)}</select></div>
              <div className="bg-slate-950 p-5 rounded-[1.5rem] border border-slate-800 hover:border-slate-700 transition-colors">
                <label className="text-[9px] font-black text-slate-600 uppercase block mb-3 tracking-widest">Palette</label>
                <button onClick={() => setShowStyleSelector(true)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-white font-bold text-[13px] flex items-center justify-between hover:bg-slate-800 transition-all"><span className="truncate">{selectedStyle}</span><ChevronRight size={14} className="text-slate-600" /></button>
              </div>
              <div className="bg-slate-950 p-5 rounded-[1.5rem] border border-slate-800 hover:border-slate-700 transition-colors"><label className="text-[9px] font-black text-slate-600 uppercase block mb-3 tracking-widest">Engine</label><select value={selectedVisualModel} onChange={(e) => setSelectedVisualModel(e.target.value)} className="w-full bg-transparent text-white font-bold outline-none text-[13px] cursor-pointer">{['veo-3.1-fast-generate-preview', 'gemini-2.5-flash-image'].map(opt => <option key={opt} value={opt} className="bg-slate-900">{opt}</option>)}</select></div>
              <div className="bg-slate-950 p-5 rounded-[1.5rem] border border-slate-800 hover:border-slate-700 transition-colors"><label className="text-[9px] font-black text-slate-600 uppercase block mb-3 tracking-widest">Voice</label><select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="w-full bg-transparent text-white font-bold text-xs outline-none cursor-pointer">{['Kore', 'Charon', 'Zephyr'].map(opt => <option key={opt} value={opt} className="bg-slate-900">{opt}</option>)}</select></div>
            </div></div>
          </div>
          
          {state.script && (
            <div className="bg-slate-900 border border-slate-800 rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col ring-1 ring-slate-800/50">
               <div className="flex border-b border-slate-800 bg-slate-950/20 p-2 gap-2">{[{id:'script', label:'Timeline', icon:<Layers size={16}/>}, {id:'styling', label:'Aesthetics', icon:<Palette size={16}/>}, {id:'seo', label:'Distribution', icon:<BarChart3 size={16}/>}].map(t => (<button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 py-5 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-purple-600 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-800'}`}>{t.icon} {t.label}</button>))}</div>
               <div className="p-10 animate-in fade-in duration-500">
                  {activeTab === 'script' && (
                    <div className="space-y-8">
                      <div className="p-8 bg-slate-950 rounded-[2.5rem] border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-inner">
                          <div className="flex items-center gap-5">
                             <div className="w-14 h-14 bg-purple-600/10 rounded-2xl flex items-center justify-center text-purple-400 border border-purple-500/20"><Rocket size={28}/></div>
                             <div>
                               <h4 className="text-base font-black text-white uppercase tracking-tight">Production Orchestrator</h4>
                               <p className="text-[10px] text-slate-500 font-bold uppercase">{completedScenesCount} of {totalScenesCount} Ready</p>
                             </div>
                          </div>
                          <div className="flex flex-wrap gap-4 justify-center md:justify-end">
                             <button onClick={handleAutoStoryboard} disabled={isStoryboarding} className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 active:scale-95 ${isStoryboarding ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                               <Wand2 size={16} className="text-indigo-500" /> Storyboard
                             </button>
                             <button onClick={handleGenerateAll} disabled={isProcessingAll} className={`px-12 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.1em] transition-all shadow-xl flex items-center gap-4 group active:scale-95 ${isProcessingAll ? 'bg-orange-600 text-white animate-pulse' : 'bg-purple-600 text-white hover:bg-purple-500'}`}>
                               {isProcessingAll ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                               Synthesize All
                             </button>
                          </div>
                      </div>
                      <SceneManager scenes={state.script.scenes || []} onRegenerate={processScene} onRefinePrompt={handleRefinePrompt} onAutoStoryboard={handleAutoStoryboard} onGenerateAudio={handlePreviewVoiceover} onToggleSkip={(id) => updateScene(id, { status: 'skipped' })} onUpdateScene={updateScene} onDragReorder={handleReorderScenes} onReorder={handleStepReorder} onDelete={handleDeleteScene} onAddScene={handleAddScene} isProcessingAll={isProcessingAll} />
                    </div>
                  )}
                  {activeTab === 'styling' && (
                    <div className="space-y-12">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-3"><Music size={18} className="text-purple-500"/> Audio Production</h4>
                            <div className="flex items-center gap-4">
                              <input type="file" accept="audio/*" onChange={handleBgmUpload} className="hidden" id="long-bgm-up" />
                              <label htmlFor="long-bgm-up" className="px-5 py-2 bg-purple-600/10 text-purple-400 border border-purple-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-purple-600/20 transition-all flex items-center gap-2"><Upload size={12}/> BGM</label>
                            </div>
                          </div>
                          <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800 space-y-8 shadow-inner">
                            <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest"><span>Atmosphere Level</span><span className="text-purple-400">{Math.round(bgmVolume*100)}%</span></div>
                            <div className="flex items-center gap-4"><VolumeX size={14} className="text-slate-700" /><input type="range" min="0" max="0.3" step="0.01" value={bgmVolume} onChange={(e) => setBgmVolume(parseFloat(e.target.value))} className="w-full accent-purple-600 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" /><Volume2 size={14} className="text-slate-500" /></div>
                          </div>
                        </div>
                        <div className="space-y-6">
                          <div className="flex items-center justify-between"><h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-3"><Type size={18} className="text-purple-500"/> Subtitle Master</h4><button onClick={() => setHideSubtitles(!hideSubtitles)} className={`w-12 h-6 rounded-full transition-all relative flex items-center px-1 ${hideSubtitles ? 'bg-slate-800' : 'bg-purple-600'}`}><div className={`w-4 h-4 rounded-full bg-white shadow-md transition-all transform ${hideSubtitles ? 'translate-x-0' : 'translate-x-6'}`}></div></button></div>
                          <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-[2.5rem]">
                            <SubtitleEditor style={subtitleStyle} onChange={(upd) => setSubtitleStyle(p => ({ ...p, ...upd }))} presetType="long" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {activeTab === 'seo' && (
                    <div className="space-y-12">
                      <MetadataManager metadata={state.script} topic={state.topic} style={selectedStyle} onUpdateMetadata={(upd) => setState(p => p.script ? {...p, script: {...p.script, ...upd}} : p)} />
                      
                      <div className="bg-slate-950 p-12 rounded-[4rem] border border-purple-500/20 space-y-10 shadow-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5 text-purple-500 rotate-12"><Calendar size={140}/></div>
                        <div className="flex items-center justify-between border-b border-slate-800/50 pb-8 relative z-10">
                            <div>
                                <h4 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                  <Youtube size={28} className="text-red-600"/> Broadcast Pipeline
                                </h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Configure schedule for autonomous upload</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            <div className="space-y-4 p-8 bg-slate-900/50 rounded-[2.5rem] border border-slate-800">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                                  <Clock size={16} className="text-indigo-400" /> Set Broadcast Time (Optional)
                                </label>
                                <input 
                                  type="datetime-local" 
                                  value={scheduledTime}
                                  onChange={(e) => setScheduledTime(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-kanit outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-inner"
                                  style={{ colorScheme: 'dark' }}
                                />
                                <p className="text-[9px] text-slate-600 italic">Leaves as empty to upload as private immediately after rendering.</p>
                            </div>

                            <button 
                              onClick={handleAddToQueueFlow}
                              disabled={isQueuing}
                              className="flex flex-col items-center justify-center gap-5 bg-purple-600 text-white rounded-[3rem] hover:bg-purple-500 transition-all group active:scale-95 shadow-2xl shadow-purple-900/40 disabled:opacity-50"
                            >
                                {isQueuing ? <Loader2 size={32} className="animate-spin"/> : <ListPlus size={32} />}
                                <div className="text-center">
                                    <span className="text-base font-black uppercase tracking-[0.2em] block">Add to Auto-Queue</span>
                                    <span className="text-[10px] text-purple-200 font-bold uppercase mt-1 opacity-70">Submit to Dashboard Pipeline</span>
                                </div>
                            </button>
                        </div>
                      </div>
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>
        
        <div className="xl:w-[450px] shrink-0">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3.5rem] shadow-2xl flex flex-col items-center gap-8 sticky top-12 ring-1 ring-slate-800/50 overflow-hidden">
            {isExporting && (
              <div className="absolute inset-0 bg-slate-950/98 z-50 flex flex-col items-center justify-center p-10 text-center backdrop-blur-3xl animate-in fade-in">
                <div className="relative w-48 h-48 mb-8">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle className="text-slate-800 stroke-current" strokeWidth="4" fill="transparent" r="46" cx="50" cy="50" />
                    <circle className="text-purple-500 stroke-current transition-all duration-300" strokeWidth="4" strokeLinecap="round" fill="transparent" r="46" cx="50" cy="50" style={{ strokeDasharray: 289, strokeDashoffset: 289 - (289 * exportProgress) / 100 }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-white font-mono">{Math.round(exportProgress)}%</span>
                  </div>
                </div>
                <h4 className="text-white font-black uppercase tracking-widest text-[11px] mb-2">{exportStage}</h4>
              </div>
            )}
            <div className="w-full space-y-3">
              <div className="rounded-[2rem] overflow-hidden bg-black shadow-3xl border border-slate-800 aspect-video">
                <VideoPlayer ref={playerRef} scenes={(state.script?.scenes || []).filter(s => s.status === 'completed')} isReady={completedScenesCount > 0} aspectRatio="16:9" subtitleStyle={subtitleStyle} bgmVolume={bgmVolume} bgmUrl={bgmUrl} hideSubtitles={hideSubtitles} />
              </div>
            </div>
            {state.script && (
              <div className="w-full space-y-6">
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <div className="grid grid-cols-4 gap-2">
                    {(['360p', '720p', '1080p', '4k'] as const).map(res => (
                      <button key={res} onClick={() => setExportResolution(res)} className={`py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${exportResolution === res ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>{res}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={handleExport} disabled={completedScenesCount === 0 || isExporting} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3">
                    <Download size={20}/> Master Render
                  </button>
                  <button onClick={() => setShowYoutubeModal(true)} disabled={!currentVideoBlob || isExporting} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3">
                    <Youtube size={20} /> Publish Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {showHistory && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-8 animate-in fade-in duration-300"><div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-[4rem] p-12 relative shadow-3xl overflow-hidden ring-1 ring-slate-700"><button onClick={() => setShowHistory(false)} className="absolute top-10 right-10 text-slate-500 hover:text-white transition p-2 active:scale-90"><X size={36}/></button><h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-12">Archives</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto pr-6 scrollbar-thin scrollbar-thumb-slate-800">{savedProjects.map(proj => (<div key={proj.id} onClick={() => { handleLoadProject(proj); }} className="bg-slate-950 border border-slate-800 p-8 rounded-[2.5rem] hover:border-purple-500 hover:bg-purple-500/5 transition-all cursor-pointer group shadow-xl"><span className="text-[10px] font-black text-purple-400 uppercase block mb-3">{new Date(proj.lastUpdated).toLocaleDateString()}</span><h4 className="text-lg font-bold text-white line-clamp-1 uppercase tracking-tight group-hover:text-purple-400 transition-colors">{proj.title}</h4></div>))}{savedProjects.length === 0 && <div className="col-span-full py-20 text-center text-slate-600 font-black uppercase tracking-[0.4em]">Empty</div>}</div></div></div>)}
    </div>
  );
};

export default LongVideoCreator;