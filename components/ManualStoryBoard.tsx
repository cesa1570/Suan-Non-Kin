
import React, { useState, useRef, useCallback } from 'react';
import { Scene } from '../types';
import { 
  Download, Plus, LayoutTemplate, CheckCircle2 
} from 'lucide-react';
import SceneManager from './SceneManager';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import { generateVoiceover } from '../services/geminiService'; 

// ✅ Interface เหมือน Shorts/Long Video
interface ManualStoryBoardProps {
  initialTopic?: string;
  initialLanguage?: string;
  apiKey: string;
}

// --- Helper: Decode Audio (เหมือนเดิม) ---
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

const ManualStoryBoard: React.FC<ManualStoryBoardProps> = ({ initialTopic, initialLanguage, apiKey }) => {
  // เริ่มต้น State (ถ้ามี initialTopic ก็เอามาใส่เล่นๆ ได้ แต่ Manual คือเริ่มใหม่หมด)
  const [scenes, setScenes] = useState<Scene[]>([
    {
      id: Date.now(),
      voiceover: initialTopic ? `เริ่มต้นโปรเจกต์: ${initialTopic}` : "พิมพ์ข้อความที่นี่...",
      visual_prompt: "Abstract background",
      status: 'completed',
      assetStage: 'audio',
      duration_est: 5,
    }
  ]);
  
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  
  const playerRef = useRef<VideoPlayerRef>(null);

  // --- Actions ---
  const handleUpdateScene = useCallback((id: number, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const handleAddScene = () => {
    const newScene: Scene = {
      id: Date.now(),
      voiceover: "",
      visual_prompt: "",
      status: 'completed',
      duration_est: 5,
    };
    setScenes(prev => [...prev, newScene]);
  };

  const handleDeleteScene = (id: number) => {
    if (scenes.length <= 1) return alert("Must have at least one scene.");
    setScenes(prev => prev.filter(s => s.id !== id));
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

  const handleDuplicate = (scene: Scene) => {
    const cloned: Scene = { ...scene, id: Date.now(), status: 'completed' };
    const idx = scenes.findIndex(s => s.id === scene.id);
    const newScenes = [...scenes];
    newScenes.splice(idx + 1, 0, cloned);
    setScenes(newScenes);
  };

  const handleGenerateAudio = async (scene: Scene) => {
    if (!scene.voiceover) return alert("Please type text.");
    handleUpdateScene(scene.id, { status: 'generating', assetStage: 'audio', processingProgress: 20 });
    try {
      // Fix: generateVoiceover only takes text and voiceName
      const base64Audio = await generateVoiceover(scene.voiceover, 'th-TH-Standard-A');
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioDataHelper(base64Audio, ctx);
      handleUpdateScene(scene.id, { 
        audioBase64: base64Audio, audioBuffer: audioBuffer, status: 'completed', processingProgress: 100, duration_est: audioBuffer.duration 
      });
    } catch (error) {
      handleUpdateScene(scene.id, { status: 'failed' });
      alert("TTS Failed.");
    }
  };

  const handleExportVideo = async () => {
    if (!playerRef.current || scenes.length === 0) return;
    setIsRendering(true);
    try {
      const { blob } = await playerRef.current.renderVideo((pct) => setProgress(pct), { resolution: '1080p', bitrate: 25000000 });
      setExportUrl(URL.createObjectURL(blob));
    } catch (err) {
      alert("Render Failed.");
    } finally {
      setIsRendering(false);
    }
  };

  return (
    // 🔥 ปรับ Layout ให้เข้ากับ Container หลัก (ไม่ต้อง h-screen)
    <div className="flex flex-col h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Workspace Split */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Preview */}
        <div className="w-[45%] bg-black border-r border-slate-800 flex flex-col relative">
           <div className="flex-1 p-6 flex flex-col justify-center bg-slate-950/50">
              <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
                 <VideoPlayer ref={playerRef} scenes={scenes} isReady={true} aspectRatio="16:9" hideSubtitles={false} />
              </div>
              <div className="mt-6 flex justify-between items-center px-2">
                 <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                    Duration: {scenes.reduce((acc, s) => acc + (s.duration_est || 5), 0).toFixed(1)}s
                 </div>
                 {/* Export Button moved here */}
                 {exportUrl ? (
                   <a href={exportUrl} download="manual.mp4" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white shadow-lg transition-all">
                     <CheckCircle2 size={14} /> Download
                   </a>
                 ) : (
                   <button onClick={handleExportVideo} disabled={isRendering || scenes.length === 0} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-indigo-900/50 transition-all disabled:opacity-50">
                     {isRendering ? `Rendering ${progress}%` : <><Download size={14} /> Export</>}
                   </button>
                 )}
              </div>
           </div>
        </div>

        {/* Right: Timeline Editor */}
        <div className="flex-1 bg-slate-900 overflow-y-auto custom-scrollbar p-6">
           <div className="space-y-6 pb-20">
              <div className="flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10 py-2 border-b border-slate-800">
                 <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <LayoutTemplate size={18} className="text-indigo-500" /> Timeline
                 </h2>
                 <button onClick={handleAddScene} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border border-slate-700">
                    <Plus size={14} /> Add Scene
                 </button>
              </div>

              {/* Fix: Removed unsupported onDuplicateScene prop from SceneManager */}
              <SceneManager 
                 scenes={scenes}
                 isProcessingAll={false}
                 onUpdateScene={handleUpdateScene}
                 onGenerateAudio={handleGenerateAudio}
                 onRegenerate={() => {}} 
                 onToggleSkip={(id) => handleUpdateScene(id, { status: scenes.find(s => s.id === id)?.status === 'skipped' ? 'completed' : 'skipped' })}
                 onReorder={handleReorder}
                 onDragReorder={handleDragReorder}
                 onDelete={handleDeleteScene}
                 onAddScene={handleAddScene}
                 onRefinePrompt={undefined} 
                 onAutoStoryboard={undefined}
              />
           </div>
        </div>

      </div>
    </div>
  );
};

export default ManualStoryBoard;
