import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, GeneratorMode, Scene, SubtitleStyle } from '../types';
import { generateScript, generateImageForScene, generateVoiceover, generateVideoForScene, ERR_INVALID_KEY } from '../services/geminiService';
import { decodeAudioData } from '../utils/audioUtils';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import SceneManager from './SceneManager';
import MetadataManager from './MetadataManager';
import YoutubeUploadModal from './YoutubeUploadModal';
import { useApp } from '../contexts/AppContext';
import { saveProject, listProjects, ProjectData } from '../services/projectService';
import {
  Wand2, Loader2, Save, History, X, Sparkles, Youtube, 
  Smartphone, Bot, CheckCircle2, Zap, Download, Type, Move, Palette, Layers, BarChart3, Clock
} from 'lucide-react';

const ProjectBuilder: React.FC<{ initialTopic?: string, initialLanguage?: 'Thai' | 'English' }> = ({ initialTopic, initialLanguage = 'Thai' }) => {
  const { openKeySelection, resetKeyStatus } = useApp();
  const [state, setState] = useState<ProjectState>({ status: 'idle', topic: initialTopic || '', script: null, currentStep: '' });
  const [mode, setMode] = useState<GeneratorMode>(GeneratorMode.FACTS);
  const aspectRatio = '9:16';
  const [language, setLanguage] = useState<'Thai' | 'English'>(initialLanguage);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [selectedVisualModel, setSelectedVisualModel] = useState('gemini-2.5-flash-image');
  const [selectedStyle, setSelectedStyle] = useState('Cinematic');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'scenes' | 'viral' | 'seo'>('scenes');
  const [currentVideoBlob, setCurrentVideoBlob] = useState<Blob | null>(null);
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);

  // Viral Shorts style: Large bouncy text, Neon Yellow, Center-aligned, heavy outline
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>({
    fontSize: 84, textColor: '#FFFF00', backgroundColor: '#000000', backgroundOpacity: 0.0, verticalOffset: 35, fontFamily: 'Kanit', outlineColor: '#000000', outlineWidth: 6, shadowBlur: 4, shadowColor: 'rgba(0,0,0,0.8)', fontWeight: '900'
  });

  const playerRef = useRef<VideoPlayerRef>(null);

  const handleGenerateScript = async () => {
    if (!state.topic) return;
    try {
      setState(prev => ({ ...prev, status: 'generating_script' }));
      const scriptData = await generateScript(state.topic, mode, aspectRatio, language, 1, selectedVisualModel, selectedStyle);
      setState(prev => ({ ...prev, script: scriptData, status: 'idle' }));
    } catch (error: any) { 
      if (error.code === ERR_INVALID_KEY) { resetKeyStatus(); await openKeySelection(); } 
      setState(prev => ({ ...prev, status: 'error', error: error.message })); 
    }
  };

  const processScene = async (scene: Scene) => {
    updateScene(scene.id, { status: 'generating' });
    try {
      const isVideo = selectedVisualModel.startsWith('veo');
      const [visualResult, audioBase64] = await Promise.all([
        isVideo ? generateVideoForScene(scene.visual_prompt, aspectRatio, selectedVisualModel, selectedStyle) : generateImageForScene(scene.visual_prompt, selectedVisualModel, aspectRatio, selectedStyle),
        generateVoiceover(scene.voiceover, selectedVoice)
      ]);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(audioBase64, audioCtx);
      updateScene(scene.id, { status: 'completed', imageUrl: !isVideo ? visualResult : undefined, videoUrl: isVideo ? visualResult : undefined, audioBase64, audioBuffer });
    } catch (err: any) { updateScene(scene.id, { status: 'failed', error: err.message }); }
  };

  const updateScene = (sceneId: number, updates: Partial<Scene>) => {
    setState(prev => { if (!prev.script) return prev; return { ...prev, script: { ...prev.script, scenes: prev.script.scenes.map(s => s.id === sceneId ? { ...s, ...updates } : s) } }; });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-12 max-w-[1300px] mx-auto animate-in slide-in-from-bottom-8 duration-700">
      
      {/* 1. Mobile Preview Center (Fixed Layout) */}
      <div className="lg:w-[450px] shrink-0 flex flex-col items-center">
         <div className="relative p-5 bg-slate-900 rounded-[4.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] border-[10px] border-slate-800 ring-1 ring-slate-700 group">
            {/* The Phone Header */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-8 bg-slate-800 rounded-b-3xl z-20 flex items-center justify-center">
               <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
            </div>
            
            <div className="rounded-[3rem] overflow-hidden h-[740px] w-[360px] bg-black">
               <VideoPlayer ref={playerRef} scenes={(state.script?.scenes || []).filter(s => s.status === 'completed')} isReady={!!state.script?.scenes?.some(s => s.status === 'completed')} aspectRatio="9:16" subtitleStyle={subtitleStyle} />
            </div>

            {/* Floating Action Buttons inside phone frame context */}
            {state.script && (
               <div className="absolute bottom-10 right-10 flex flex-col gap-4 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => playerRef.current?.renderVideo().then(({blob}) => setCurrentVideoBlob(blob))} className="w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition"><Download size={24}/></button>
                  <button onClick={() => setShowYoutubeModal(true)} disabled={!currentVideoBlob} className="w-14 h-14 bg-red-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition disabled:opacity-50"><Youtube size={24}/></button>
               </div>
            )}
         </div>
         <p className="mt-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Viral Preview: Vertical 9:16</p>
      </div>

      {/* 2. Control Console */}
      <div className="flex-1 flex flex-col gap-8">
        <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden ring-1 ring-slate-800/50">
           <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none"><Zap size={140} fill="currentColor"/></div>
           
           <div className="flex items-center gap-4 mb-10">
              <div className="w-14 h-14 rounded-2xl bg-orange-600/20 flex items-center justify-center text-orange-500 shadow-lg border border-orange-500/20"><Zap size={28} fill="currentColor"/></div>
              <div>
                 <h2 className="text-3xl font-black text-white uppercase tracking-tight leading-none">Shorts Factory</h2>
                 <span className="text-[10px] text-orange-500 font-black uppercase tracking-[0.3em] mt-2 block">High-Speed Viral Content</span>
              </div>
           </div>

           <div className="space-y-6">
              <div className="relative group">
                <input type="text" placeholder="Shorts Topic (e.g. 5 Creepy Facts)..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 pr-44 text-white text-xl font-kanit outline-none shadow-inner focus:ring-2 focus:ring-orange-600/30 transition-all" value={state.topic} onChange={(e) => setState(prev => ({ ...prev, topic: e.target.value }))} />
                <button onClick={handleGenerateScript} disabled={state.status !== 'idle'} className="absolute right-3 top-3 bottom-3 px-8 bg-orange-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-orange-500 shadow-xl transition-all disabled:opacity-50">
                   {state.status === 'generating_script' ? <Loader2 className="animate-spin" /> : 'Create Viral Script'}
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                 {[
                   { label: 'Category', value: mode, setter: (v: any) => setMode(v), options: Object.values(GeneratorMode).filter(m => m !== GeneratorMode.LONG_VIDEO) },
                   { label: 'Art Style', value: selectedStyle, setter: (v: any) => setSelectedStyle(v), options: ['Cinematic', 'Anime', 'Cyberpunk', 'Horror'] },
                   { label: 'Engine', value: selectedVisualModel, setter: (v: any) => setSelectedVisualModel(v), options: ['gemini-2.5-flash-image', 'veo-3.1-fast-generate-preview'] },
                   { label: 'Voice', value: selectedVoice, setter: (v: any) => setSelectedVoice(v), options: ['Kore', 'Charon', 'Zephyr'] }
                 ].map((field, i) => (
                   <div key={i} className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <label className="text-[9px] font-black text-slate-600 uppercase block mb-2 tracking-widest">{field.label}</label>
                      <select value={field.value} onChange={(e) => field.setter(e.target.value as any)} className="w-full bg-transparent text-white font-bold outline-none text-[11px] truncate">
                         {field.options.map(o => <option key={o} value={o} className="bg-slate-900">{o}</option>)}
                      </select>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {state.script && (
          <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col">
             <div className="flex border-b border-slate-800 p-2 gap-2">
                {[{id:'scenes', label:'Storyboard', icon:<Layers size={14}/>}, {id:'viral', label:'Viral Styling', icon:<Type size={14}/>}, {id:'seo', label:'SEO Metadata', icon:<BarChart3 size={14}/>}].map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
                    {t.icon} {t.label}
                  </button>
                ))}
             </div>
             <div className="p-8 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                {activeTab === 'scenes' && <SceneManager scenes={state.script.scenes} onRegenerate={processScene} onToggleSkip={(id) => updateScene(id, { status: 'skipped' })} onUpdateScene={updateScene} isProcessingAll={false} />}
                {activeTab === 'viral' && (
                  <div className="space-y-10 animate-in fade-in">
                     <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800 space-y-8">
                        <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-2"><Smartphone size={16} className="text-orange-500"/> Subtitle Physics</h4>
                        <div className="space-y-6">
                           <div className="space-y-3">
                              <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest"><span>Viral Font Size</span><span>{subtitleStyle.fontSize}px</span></div>
                              <input type="range" min="40" max="150" value={subtitleStyle.fontSize} onChange={(e) => setSubtitleStyle(p => ({...p, fontSize: parseInt(e.target.value)}))} className="w-full accent-orange-500 h-1 bg-slate-800 rounded-full appearance-none" />
                           </div>
                           <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Caption Accent Color</span>
                              <input type="color" value={subtitleStyle.textColor} onChange={(e) => setSubtitleStyle(p => ({...p, textColor: e.target.value}))} className="bg-transparent border-none w-10 h-10 cursor-pointer" />
                           </div>
                        </div>
                     </div>
                  </div>
                )}
                {activeTab === 'seo' && <MetadataManager metadata={state.script} topic={state.topic} style={selectedStyle} />}
             </div>
          </div>
        )}
      </div>

      {showYoutubeModal && currentVideoBlob && state.script && (
        <YoutubeUploadModal videoBlob={currentVideoBlob} initialTitle={state.script.seoTitle || state.script.title} initialDescription={state.script.longDescription} initialTags={state.script.hashtags} onClose={() => setShowYoutubeModal(false)} />
      )}
    </div>
  );
};

export default ProjectBuilder;