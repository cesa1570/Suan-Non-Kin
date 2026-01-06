import React, { useState, useRef, useCallback } from 'react';
import { Scene } from '../types'; 
import { 
  Download, Plus, Settings2, Music, Mic, Monitor, Smartphone, 
  Image as ImageIcon, Layers, Wand2, CheckCircle2, Palette, ChevronRight 
} from 'lucide-react';
import SceneManager from './SceneManager';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import { generateVoiceover } from '../services/geminiService'; 
import { useApp } from '../contexts/AppContext';
import ArtStyleSelector, { STYLES } from './ArtStyleSelector';

const mockGenerateImage = async (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const randomId = Math.floor(Math.random() * 1000);
      resolve(`https://picsum.photos/seed/${randomId}/1920/1080`);
    }, 1500);
  });
};

interface ManualStoryBoardProps {
  initialTopic?: string;
  apiKey: string;
}

interface VideoSettings {
  aspectRatio: '16:9' | '9:16';
  voiceId: string;
  bgMusicVolume: number;
  globalTransition: Scene['transition'];
  visualStyle: string; // เก็บ ID เช่น 'Cinematic'
}

// --- Helper: Decode Audio ---
async function decodeAudioDataHelper(base64Data: string, ctx: AudioContext): Promise<AudioBuffer> {
  const cleanBase64 = base64Data.replace(/[\s\r\n]+/g, '');
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  let safeBuffer = bytes.buffer;
  if (bytes.byteLength % 2 !== 0) {
      const evenLength = bytes.byteLength - (bytes.byteLength % 2);
      safeBuffer = bytes.buffer.slice(0, evenLength);
  }
  const dataInt16 = new Int16Array(safeBuffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, 24000); 
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

const ManualStoryBoard: React.FC<ManualStoryBoardProps> = ({ initialTopic, apiKey }) => {
  const { openKeySelection, resetKeyStatus } = useApp();
  
  // State Settings
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    aspectRatio: '16:9',
    voiceId: 'th-TH-Standard-A',
    bgMusicVolume: 0.1,
    globalTransition: 'crossfade',
    visualStyle: 'Cinematic' // Default
  });

  // ✅ State สำหรับควบคุมการเปิด/ปิดหน้าเลือกสไตล์
  const [showStyleSelector, setShowStyleSelector] = useState(false);

  const [scenes, setScenes] = useState<Scene[]>([
    {
      id: Date.now(),
      stageLabel: "INTRO",
      voiceover: initialTopic ? `เรื่องราวของ ${initialTopic}` : "เริ่มเรื่อง...",
      visual_prompt: "A beautiful landscape",
      status: 'pending',
      duration_est: 5,
      transition: 'fade',
      videoVolume: 1,
      isMuted: false
    }
  ]);
  
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const playerRef = useRef<VideoPlayerRef>(null);

  // --- Actions ---
  const handleUpdateScene = useCallback((id: number, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const handleAddScene = () => {
    const newScene: Scene = {
      id: Date.now(),
      stageLabel: `SCENE ${scenes.length + 1}`,
      voiceover: "",
      visual_prompt: "",
      status: 'pending',
      duration_est: 5,
      transition: videoSettings.globalTransition,
      videoVolume: 1,
      isMuted: false
    };
    setScenes(prev => [...prev, newScene]);
  };

  const handleDeleteScene = (id: number) => {
    if (scenes.length <= 1) return;
    setScenes(prev => prev.filter(s => s.id !== id));
  };

  const handleDuplicate = (scene: Scene) => {
    const cloned: Scene = {
      ...scene,
      id: Date.now(),
      status: 'pending',
      stageLabel: `${scene.stageLabel} (Copy)`,
      imageUrl: scene.imageUrl,
      audioBase64: scene.audioBase64,
      audioBuffer: scene.audioBuffer,
      assetStage: 'script'
    };
    const idx = scenes.findIndex(s => s.id === scene.id);
    const newScenes = [...scenes];
    newScenes.splice(idx + 1, 0, cloned);
    setScenes(newScenes);
  };

  const handleReorder = (id: number, direction: 'up' | 'down') => {
    const idx = scenes.findIndex(s => s.id === id);
    if (idx === -1) return;
    const newScenes = [...scenes];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx >= 0 && swapIdx < newScenes.length) {
      [newScenes[idx], newScenes[swapIdx]] = [newScenes[swapIdx], newScenes[idx]];
      setScenes(newScenes);
    }
  };
  
  const handleDragReorder = (start: number, end: number) => {
    const newScenes = [...scenes];
    const [removed] = newScenes.splice(start, 1);
    newScenes.splice(end, 0, removed);
    setScenes(newScenes);
  };

  // --- Generation Logic ---

  const handleGenerateAudio = async (scene: Scene) => {
    if (!scene.voiceover) return;
    handleUpdateScene(scene.id, { status: 'generating', assetStage: 'audio', processingProgress: 10, statusDetail: "Generating Audio..." });
    try {
      const base64Audio = await generateVoiceover(scene.voiceover, videoSettings.voiceId);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioDataHelper(base64Audio, ctx);
      
      handleUpdateScene(scene.id, { 
        audioBase64: base64Audio, 
        audioBuffer: audioBuffer, 
        status: scene.imageUrl ? 'completed' : 'pending', 
        assetStage: 'visual',
        processingProgress: 100, 
        duration_est: audioBuffer.duration 
      });
    } catch (err) {
      handleUpdateScene(scene.id, { status: 'failed', error: "TTS Failed" });
    }
  };

  // ✅ Modified: Apply Visual Style from STYLES
  const handleGenerateVisual = async (scene: Scene) => {
    if (!scene.visual_prompt) return;
    
    handleUpdateScene(scene.id, { status: 'generating', assetStage: 'visual', processingProgress: 30, statusDetail: "Generating Image..." });
    
    try {
      // ✅ 2. แก้จาก ArtStyleSelector.find เป็น STYLES.find
      const selectedStyleObj = STYLES.find(s => s.id === videoSettings.visualStyle);
      
      // 2. สร้าง Suffix (ถ้าหาไม่เจอให้เป็นค่าว่าง)
      const styleSuffix = selectedStyleObj ? `, ${selectedStyleObj.technicalHint}` : '';
      
      // 3. รวม Prompt
      const finalPrompt = `${scene.visual_prompt}${styleSuffix}`;
      console.log("Generating with final prompt:", finalPrompt);
      
      const url = await mockGenerateImage(finalPrompt);
      
      handleUpdateScene(scene.id, { 
        imageUrl: url, 
        status: scene.audioBuffer ? 'completed' : 'pending',
        processingProgress: 100 
      });
    } catch (err) {
      handleUpdateScene(scene.id, { status: 'failed', error: "Image Failed" });
    }
  };

  const handleRegenerateFull = async (scene: Scene) => {
    await handleGenerateAudio(scene);
    await handleGenerateVisual(scene);
  };

  const handleGenerateAllAudio = async () => {
    const tasks = scenes.filter(s => !s.audioBuffer).map(s => handleGenerateAudio(s));
    await Promise.all(tasks);
  };

  const handleGenerateAllImages = async () => {
    const pending = scenes.filter(s => !s.imageUrl);
    for (let i = 0; i < pending.length; i += 2) {
        const batch = pending.slice(i, i + 2).map(s => handleGenerateVisual(s));
        await Promise.all(batch);
    }
  };

  const handleExportVideo = async () => {
    if (!playerRef.current) return;
    setIsRendering(true);
    setRenderProgress(0);
    try {
      const { blob } = await playerRef.current.renderVideo(
        (pct) => setRenderProgress(pct), 
        { resolution: '1080p', bitrate: 25000000 }
      );
      setExportUrl(URL.createObjectURL(blob));
    } catch (err) {
      alert("Render Failed");
    } finally {
      setIsRendering(false);
    }
  };

  // Helper to get current style object (Safe check)
  const currentStyle = STYLES.find(s => s.id === videoSettings.visualStyle) || STYLES[0];

  return (
    <div className="flex flex-col h-[85vh] bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
      
      {/* ✅ Modal ArtStyleSelector */}
      {showStyleSelector && (
        <ArtStyleSelector 
            selectedId={videoSettings.visualStyle}
            onSelect={(id) => setVideoSettings(prev => ({ ...prev, visualStyle: id }))}
            onClose={() => setShowStyleSelector(false)}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        
        {/* --- LEFT PANEL: Settings --- */}
        <div className="w-[450px] bg-slate-900 border-r border-slate-800 flex flex-col relative shrink-0">
           
           {/* Preview */}
           <div className="p-6 bg-black/40 border-b border-slate-800">
              <div className={`mx-auto bg-black rounded-lg overflow-hidden border border-slate-700 shadow-2xl transition-all duration-300 ${videoSettings.aspectRatio === '9:16' ? 'w-[180px]' : 'w-full'}`}>
                 <div className={`${videoSettings.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'} relative`}>
                    <VideoPlayer 
                        ref={playerRef} 
                        scenes={scenes} 
                        isReady={true} 
                        aspectRatio={videoSettings.aspectRatio} 
                        hideSubtitles={false} 
                    />
                 </div>
              </div>
           </div>

           {/* Settings Panel */}
           <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
              
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold flex items-center gap-2"><Settings2 size={18} /> Project Settings</h3>
              </div>

              {/* 1. Aspect Ratio */}
              <div className="space-y-3">
                 <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                    <Monitor size={12} /> Video Format
                 </label>
                 <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => setVideoSettings(prev => ({...prev, aspectRatio: '16:9'}))}
                        className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${videoSettings.aspectRatio === '16:9' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                        <span className="text-xs font-bold">16:9 Landscape</span>
                    </button>
                    <button 
                        onClick={() => setVideoSettings(prev => ({...prev, aspectRatio: '9:16'}))}
                        className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${videoSettings.aspectRatio === '9:16' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                        <span className="text-xs font-bold">9:16 Shorts</span>
                    </button>
                 </div>
              </div>

              {/* 2. Visual Style Trigger */}
              <div className="space-y-3">
                 <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                    <Palette size={12} /> Visual Style
                 </label>
                 
                 <button 
                    onClick={() => setShowStyleSelector(true)}
                    className="w-full relative group overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 hover:border-purple-500 transition-all duration-300 text-left"
                 >
                    {/* Background Image Blur */}
                    <div className="absolute inset-0">
                        <img src={currentStyle.image} className="w-full h-full object-cover opacity-30 group-hover:opacity-50 group-hover:scale-105 transition-all duration-500" alt="style bg" />
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent"></div>
                    </div>
                    
                    <div className="relative p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-white/10 shrink-0">
                                <img src={currentStyle.image} className="w-full h-full object-cover" alt="icon" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-wide group-hover:text-purple-300 transition-colors">
                                    {currentStyle.name}
                                </h4>
                                <p className="text-[10px] text-slate-400 line-clamp-1">
                                    {currentStyle.dna.join(' • ')}
                                </p>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-800/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-slate-400 group-hover:bg-purple-600 group-hover:text-white transition-all">
                            <ChevronRight size={16} />
                        </div>
                    </div>
                 </button>
                 <p className="text-[10px] text-slate-500 italic px-1">
                    *Applies aesthetic prompt modifiers automatically.
                 </p>
              </div>

              {/* 3. Global Voice */}
              <div className="space-y-3">
                 <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                    <Mic size={12} /> Narrator Voice
                 </label>
                 <div className="relative">
                    <select 
                        value={videoSettings.voiceId}
                        onChange={(e) => setVideoSettings(prev => ({...prev, voiceId: e.target.value}))}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-slate-750 transition-colors appearance-none"
                    >
                        <option value="th-TH-Standard-A">🇹🇭 Thai Female (Standard A)</option>
                        <option value="th-TH-Standard-B">🇹🇭 Thai Male (Standard B)</option>
                        <option value="en-US-Journey-F">🇺🇸 English Journey</option>
                    </select>
                 </div>
              </div>

              {/* 4. Background Music */}
              <div className="space-y-3">
                 <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                    <Music size={12} /> Background Music
                 </label>
                 <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                            <Music size={14} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-300">Lo-Fi Chill</span>
                            <span className="text-[10px] text-slate-500">Royalty Free</span>
                        </div>
                    </div>
                    <input 
                        type="range" min="0" max="1" step="0.1" 
                        value={videoSettings.bgMusicVolume}
                        onChange={(e) => setVideoSettings(prev => ({...prev, bgMusicVolume: parseFloat(e.target.value)}))}
                        className="w-20 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                 </div>
              </div>
           </div>

           {/* Export Action */}
           <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm">
              {exportUrl ? (
                 <a href={exportUrl} download="video.mp4" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white flex justify-center items-center gap-2 shadow-lg animate-pulse">
                    <CheckCircle2 size={16} /> Download Result
                 </a>
              ) : (
                 <button 
                    onClick={handleExportVideo} 
                    disabled={isRendering || scenes.length === 0} 
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl text-xs font-bold text-white flex justify-center items-center gap-2 shadow-lg shadow-indigo-900/20 transition-all"
                 >
                    {isRendering ? `Rendering ${Math.round(renderProgress)}%` : <><Download size={16} /> Export Final Video</>}
                 </button>
              )}
           </div>
        </div>

        {/* --- RIGHT PANEL: Timeline --- */}
        <div className="flex-1 bg-slate-950 flex flex-col min-w-0">
           
           {/* Toolbar */}
           <div className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                 <h2 className="text-white font-bold flex items-center gap-2 text-sm"><Layers size={18} className="text-indigo-400"/> Timeline</h2>
                 <div className="h-6 w-px bg-slate-700 mx-2"></div>
                 
                 <button onClick={handleGenerateAllAudio} className="text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 border border-slate-700/50">
                    <Wand2 size={14} className="text-purple-400" /> Gen All Audio
                 </button>
                 <button onClick={handleGenerateAllImages} className="text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 border border-slate-700/50">
                    <ImageIcon size={14} className="text-emerald-400" /> Gen All Images
                 </button>
              </div>

              <button 
                 onClick={handleAddScene} 
                 className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-indigo-500/20 transition-all"
              >
                 <Plus size={16} /> Add Scene
              </button>
           </div>

           {/* Timeline Content */}
           <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <SceneManager 
                 scenes={scenes}
                 isProcessingAll={false}
                 onUpdateScene={handleUpdateScene}
                 onGenerateAudio={handleGenerateAudio}
                 onGenerateVisual={handleGenerateVisual}
                 onRegenerate={handleRegenerateFull} 
                 onToggleSkip={(id) => handleUpdateScene(id, { status: scenes.find(s => s.id === id)?.status === 'skipped' ? 'completed' : 'skipped' })}
                 onReorder={handleReorder}
                 onDragReorder={handleDragReorder}
                 onDelete={handleDeleteScene}
                 onAddScene={handleAddScene}
              />
              <div className="h-20"></div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default ManualStoryBoard;