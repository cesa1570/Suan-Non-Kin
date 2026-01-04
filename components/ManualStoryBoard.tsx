import React, { useState, useRef, useCallback } from 'react';
import { Scene, GeneratorMode } from '../types';
import { 
  ArrowLeft, Save, Download, Plus, Wand2, 
  LayoutTemplate, AlertCircle, CheckCircle2 
} from 'lucide-react';
import SceneManager from './SceneManager'; // Reuse ตัวที่เราเพิ่งแก้จนเทพ
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import { generateVoiceover } from '../services/geminiService'; // เรียกใช้ TTS

interface ManualStoryBoardProps {
  onBack: () => void;
  apiKey: string; // ต้องใช้ Key สำหรับ TTS
}

const ManualStoryBoard: React.FC<ManualStoryBoardProps> = ({ onBack, apiKey }) => {
  // 1. State เริ่มต้นแบบว่างเปล่า (Blank Project)
  const [scenes, setScenes] = useState<Scene[]>([
    {
      id: Date.now(),
      voiceover: "ยินดีต้อนรับสู่โปรเจกต์ใหม่... พิมพ์ข้อความของคุณที่นี่",
      visual_prompt: "",
      status: 'completed', // Manual ถือว่าพร้อมใช้งานเลย
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
    if (scenes.length <= 1) return; // เหลือไว้อย่างน้อย 1
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
    const cloned: Scene = {
      ...scene,
      id: Date.now(), // New ID
    };
    // Insert after current
    const idx = scenes.findIndex(s => s.id === scene.id);
    const newScenes = [...scenes];
    newScenes.splice(idx + 1, 0, cloned);
    setScenes(newScenes);
  };

  // --- AI Helper: Text-to-Speech ---
  const handleGenerateAudio = async (scene: Scene) => {
    if (!scene.voiceover) return alert("Please type some text first.");
    
    handleUpdateScene(scene.id, { status: 'generating', assetStage: 'audio', processingProgress: 10 });
    
    try {
      // เรียกใช้ Service เดิมที่มีอยู่
      const base64Audio = await generateVoiceover(apiKey, scene.voiceover, 'th-TH-Standard-A'); // Default Thai Voice
      
      // Decode เพื่อเล่นใน Player
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // หมายเหตุ: ต้องมีฟังก์ชัน decodeAudioData ที่เราคุยกันก่อนหน้า
      // ถ้ายังไม่ได้ Import ให้ใช้โค้ด Decode ชุดนั้นครับ
      // ในที่นี้สมมติว่าเก็บ base64 ไว้ก่อน แล้ว Player จะไป Decode เองถ้าเราแก้ Player ให้รับ base64 ได้
      // หรือแปลงเป็น AudioBuffer ตรงนี้เลยก็ได้
      
      // *เพื่อให้ง่าย* ผมจะเก็บ base64 ไว้ แล้วให้ VideoPlayer จัดการ (หรือ SceneManager จัดการ preview)
      const audioBuffer = await decodeAudioDataHelper(base64Audio, ctx);

      handleUpdateScene(scene.id, { 
        audioBase64: base64Audio, 
        audioBuffer: audioBuffer,
        status: 'completed',
        processingProgress: 100
      });
      
    } catch (error) {
      console.error(error);
      handleUpdateScene(scene.id, { status: 'failed', statusDetail: 'TTS Failed' });
      alert("TTS Failed. Please check API Key.");
    }
  };

  // --- Export ---
  const handleExportVideo = async () => {
    if (!playerRef.current) return;
    setIsRendering(true);
    setExportUrl(null);
    
    try {
      const { blob } = await playerRef.current.renderVideo((pct, stage) => {
        setProgress(pct);
      }, { resolution: '1080p', bitrate: 25000000 });
      
      const url = URL.createObjectURL(blob);
      setExportUrl(url);
    } catch (err) {
      alert("Render Failed");
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      
      {/* 1. Top Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
             <h1 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
               <LayoutTemplate size={20} className="text-indigo-500" /> 
               Manual Studio
             </h1>
             <span className="text-[9px] text-slate-500 font-bold">Custom Production Pipeline</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
           {exportUrl ? (
             <a href={exportUrl} download="manual-story.mp4" className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-lg animate-in fade-in zoom-in">
               <CheckCircle2 size={16} /> Download Video
             </a>
           ) : (
             <button 
                onClick={handleExportVideo} 
                disabled={isRendering}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${isRendering ? 'bg-slate-800 text-slate-500 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50'}`}
             >
               {isRendering ? `Rendering ${progress}%` : <> <Download size={16} /> Export Video </>}
             </button>
           )}
        </div>
      </header>

      {/* 2. Main Workspace (Split View) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Preview Monitor */}
        <div className="w-[400px] xl:w-[500px] bg-black border-r border-slate-800 flex flex-col shrink-0">
           <div className="flex-1 p-6 flex flex-col justify-center relative">
              <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
                 <VideoPlayer 
                    ref={playerRef}
                    scenes={scenes}
                    isReady={true}
                    aspectRatio="16:9" // หรือทำ Toggle 9:16 ได้
                    hideSubtitles={false}
                 />
              </div>
              <p className="text-center text-[10px] text-slate-600 font-mono mt-4 uppercase tracking-widest">
                 Live Preview Monitor • 1080p
              </p>
           </div>
        </div>

        {/* Right: Timeline / Scene Editor */}
        <div className="flex-1 bg-slate-950 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 p-8">
           <div className="max-w-4xl mx-auto space-y-8">
              
              <div className="flex items-center justify-between">
                 <h2 className="text-xl font-black text-slate-200 uppercase tracking-tight">Timeline Sequences</h2>
                 <button onClick={handleAddScene} className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">
                    <Plus size={14} /> Add Scene
                 </button>
              </div>

              {/* ใช้ SceneManager ตัวเทพที่เราทำไว้ */}
              <SceneManager 
                 scenes={scenes}
                 isProcessingAll={false}
                 onUpdateScene={handleUpdateScene}
                 onGenerateAudio={handleGenerateAudio} // ต่อกับฟังก์ชัน TTS
                 onRegenerate={() => {}} // Manual mode ไม่ต้องใช้ AI Gen ภาพทั้งชุด
                 onToggleSkip={(id) => handleUpdateScene(id, { status: scenes.find(s => s.id === id)?.status === 'skipped' ? 'completed' : 'skipped' })}
                 onReorder={handleReorder}
                 onDragReorder={handleDragReorder}
                 onDelete={handleDeleteScene}
                 onDuplicateScene={handleDuplicate}
                 onAddScene={handleAddScene}
                 // Disable AI prompts refinement features for manual mode simplicity
                 onRefinePrompt={undefined} 
                 onAutoStoryboard={undefined}
              />

              <div className="h-20" /> {/* Bottom Spacer */}
           </div>
        </div>

      </div>
    </div>
  );
};

// --- Utils (ต้องใส่ไว้ในไฟล์เดียวกันหรือ import มา) ---
// ฟังก์ชันช่วย Decode (Copy จาก audioDecoder.ts มาใช้ หรือ import)
import { decodeAudioData } from '../utils/audioDecoder'; // สมมติว่าไฟล์นี้อยู่ path นี้

async function decodeAudioDataHelper(base64: string, ctx: AudioContext) {
    return await decodeAudioData(base64, ctx);
}

export default ManualStoryBoard;