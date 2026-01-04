import React, { useState, useRef, useEffect, memo } from 'react';
import { Scene } from '../types';
import { 
  Loader2, Trash2, Image as ImageIcon, Mic, 
  Play, Pause, Sparkles, UploadCloud, 
  ChevronUp, ChevronDown, Wand2,
  Move, Plus, Zap, Timer, Activity, Check, Film, AlertCircle, GripVertical, RefreshCw
} from 'lucide-react';

// --- Interfaces ---

interface SceneManagerProps {
  scenes: Scene[];
  onRegenerate: (scene: Scene) => void;
  onRefinePrompt?: (scene: Scene) => void;
  onAutoStoryboard?: () => void;
  onGenerateAudio?: (scene: Scene) => void;
  onGenerateVisual?: (scene: Scene) => void;
  onToggleSkip: (sceneId: number) => void;
  onUpdateScene: (sceneId: number, updates: Partial<Scene>) => void;
  onReorder?: (sceneId: number, direction: 'up' | 'down') => void;
  onDragReorder?: (startIndex: number, endIndex: number) => void;
  onAddScene?: () => void;
  onDelete?: (sceneId: number) => void;
  isProcessingAll: boolean;
}

interface SceneCardProps {
  scene: Scene;
  index: number;
  totalScenes: number;
  isDragging: boolean;
  isOver: boolean;
  draggedIdx: number | null;
  playingId: number | null;
  onPreviewAudio: (scene: Scene) => void;
  onUpdate: (id: number, updates: Partial<Scene>) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onRegenerate: (scene: Scene) => void;
  onRefine: (scene: Scene) => void;
  onToggleSkip: (id: number) => void;
  onDelete?: (id: number) => void;
  onReorder?: (id: number, dir: 'up' | 'down') => void;
}

// --- Sub-Component: SceneCard (Optimized) ---

const SceneCard = memo(({ 
  scene, index, totalScenes, isDragging, isOver, draggedIdx, playingId,
  onPreviewAudio, onUpdate, onDragStart, onDragOver, onDrop, onDragEnd,
  onRegenerate, onRefine, onToggleSkip, onDelete, onReorder 
}: SceneCardProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRefining, setIsRefining] = useState(false);

  const isSkipped = scene.status === 'skipped';
  const isGenerating = scene.status === 'generating';
  const isFailed = scene.status === 'failed';
  const hasAudio = !!scene.audioBase64 || !!scene.audioBuffer;
  const isAudioSynth = isGenerating && scene.assetStage === 'audio';
  const isVisualSynth = isGenerating && scene.assetStage === 'visual';
  const hasVisual = !!scene.imageUrl || !!scene.videoUrl;
  const progress = scene.processingProgress || 0;

  const audioStagePercent = isAudioSynth ? Math.min(100, Math.floor((progress / 40) * 100)) : (hasAudio ? 100 : 0);
  const visualStagePercent = isVisualSynth ? Math.min(100, Math.floor(((progress - 40) / 60) * 100)) : (hasVisual ? 100 : 0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (isVideo) {
        onUpdate(scene.id, { videoUrl: result, imageUrl: undefined, status: 'completed' });
      } else {
        onUpdate(scene.id, { imageUrl: result, videoUrl: undefined, status: 'completed' });
      }
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleRefineClick = async () => {
    setIsRefining(true);
    await onRefine(scene);
    setIsRefining(false);
  };

  return (
    <div 
      draggable={!isGenerating}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`relative group/scene transition-all duration-500 ease-out 
        ${isOver && draggedIdx !== null && draggedIdx !== index ? (draggedIdx < index ? 'pb-20' : 'pt-20') : ''} 
        ${isDragging ? 'opacity-20 scale-[0.98] blur-[1px]' : 'opacity-100'} 
        ${isSkipped ? 'grayscale opacity-60' : ''}`}
    >
      {/* Drop Indicator */}
      {isOver && draggedIdx !== null && draggedIdx !== index && (
        <div className={`absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent shadow-[0_0_15px_rgba(168,85,247,0.8)] z-20 rounded-full transition-all duration-300 ${draggedIdx < index ? 'bottom-0' : 'top-0'}`}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-purple-600 text-white text-[8px] font-black uppercase px-3 py-1.5 rounded-full border border-purple-400 shadow-xl flex items-center gap-1.5">
            <Move size={10} /> Sequence Destination
          </div>
        </div>
      )}

      <div className={`bg-slate-900 border ${isGenerating ? 'border-orange-500/50 ring-2 ring-orange-500/5 bg-slate-900/95' : isDragging ? 'border-purple-500/40' : 'border-slate-800'} p-6 rounded-[2.5rem] shadow-xl hover:border-slate-700 transition-all overflow-hidden relative`}>
        
        {/* Global Progress Bar (Top) */}
        {isGenerating && (
          <div className="absolute top-0 left-0 h-1 bg-slate-800 w-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-600 via-orange-500 to-yellow-500 transition-all duration-700 shadow-[0_0_20px_rgba(249,115,22,1)]" style={{ width: `${progress}%` }}></div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-6">
          {/* Drag Handle */}
          <div className="flex flex-col gap-1 items-center justify-center text-slate-700 group-hover/scene:text-purple-500 transition-all cursor-grab active:cursor-grabbing px-2 shrink-0 border-r border-slate-800/50">
            <GripVertical size={28} className="transition-transform group-active/scene:scale-110" />
            <span className="text-[7px] font-black uppercase tracking-tighter opacity-40 group-hover/scene:opacity-100 transition-opacity">ORDER</span>
          </div>

          {/* Media Preview Box */}
          <div className="w-full md:w-64 aspect-video rounded-[1.5rem] bg-slate-950 border border-slate-800 relative overflow-hidden shrink-0 shadow-inner group/preview">
            {scene.videoUrl ? (
              <video src={scene.videoUrl} className="w-full h-full object-cover" />
            ) : scene.imageUrl ? (
              <img src={scene.imageUrl} className="w-full h-full object-cover" alt="Scene preview" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-950 to-slate-900">
                {isGenerating ? (
                   <div className="flex flex-col items-center gap-3">
                      <div className="relative w-20 h-20">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle className="text-slate-800 stroke-current" strokeWidth="8" fill="transparent" r="40" cx="50" cy="50" />
                          <circle className="text-orange-500 stroke-current transition-all duration-700 ease-out shadow-[0_0_10px_rgba(249,115,22,0.5)]" strokeWidth="8" strokeLinecap="round" fill="transparent" r="40" cx="50" cy="50" style={{ strokeDasharray: 251.2, strokeDashoffset: 251.2 - (251.2 * progress) / 100 }} />
                        </svg>
                        <Activity size={18} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-400 animate-pulse" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-orange-500 uppercase tracking-[0.2em] animate-pulse">
                          {scene.assetStage === 'audio' ? 'Rendering VO' : 'Sampling Visuals'}
                        </span>
                        <span className="text-[16px] font-mono font-black text-white mt-0.5">{Math.round(progress)}%</span>
                      </div>
                   </div>
                ) : <ImageIcon size={28} className="text-slate-800 opacity-50" />}
              </div>
            )}
            
            {/* Upload Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
              <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-white transition transform active:scale-90 shadow-2xl" title="Upload Custom Visual">
                <UploadCloud size={18} />
              </button>
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" />
            </div>
          </div>

          {/* Controls & Inputs */}
          <div className="flex-1 space-y-5">
            {/* Header Row */}
            <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2.5">
                     <div className={`w-2.5 h-2.5 rounded-full ${isGenerating ? 'bg-orange-500 animate-ping shadow-[0_0_8px_rgba(249,115,22,0.8)]' : hasVisual && hasAudio ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-700'}`}></div>
                     NODE Cluster #{index + 1}
                  </span>
                  
                  {/* Status Badges */}
                  <div className="flex items-center gap-2">
                     {/* Audio Status */}
                     <div className={`flex flex-col min-w-[100px] rounded-xl border transition-all relative overflow-hidden ${hasAudio ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' : isAudioSynth ? 'bg-orange-500/10 text-orange-400 border-orange-400/30' : 'bg-slate-950 text-slate-700 border-slate-800'}`}>
                       <div className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase">
                         {hasAudio ? <Check size={10}/> : isAudioSynth ? <Loader2 size={10} className="animate-spin"/> : <Mic size={10}/>}
                         <span>{hasAudio ? 'VO READY' : isAudioSynth ? `${audioStagePercent}% Synth` : 'VO IDLE'}</span>
                       </div>
                       {isAudioSynth && (
                         <div className="h-0.5 w-full bg-slate-800 overflow-hidden"><div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${audioStagePercent}%` }}></div></div>
                       )}
                     </div>

                     {/* Visual Status */}
                     <div className={`flex flex-col min-w-[100px] rounded-xl border transition-all relative overflow-hidden ${hasVisual ? 'bg-blue-500/5 text-blue-400 border-blue-500/20' : isVisualSynth ? 'bg-orange-500/10 text-orange-400 border-orange-400/30' : 'bg-slate-950 text-slate-700 border-slate-800'}`}>
                       <div className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase">
                         {hasVisual ? <Check size={10}/> : isVisualSynth ? <Loader2 size={10} className="animate-spin"/> : <Film size={10}/>}
                         <span>{hasVisual ? 'ASSET READY' : isVisualSynth ? `${visualStagePercent}% Sample` : 'VISUAL IDLE'}</span>
                       </div>
                       {isVisualSynth && (
                         <div className="h-0.5 w-full bg-slate-800 overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${visualStagePercent}%` }}></div></div>
                       )}
                     </div>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2">
                   {isFailed && (
                      <div className="flex items-center gap-1.5 text-red-500 bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/30 text-[9px] font-black uppercase">
                         <AlertCircle size={12} /> Cluster Sync Error
                      </div>
                   )}
                   <div className="flex flex-col gap-1 mr-2">
                     <button onClick={(e) => { e.stopPropagation(); onReorder?.(scene.id, 'up'); }} disabled={index === 0 || isGenerating} className="p-1 bg-slate-950 text-slate-600 hover:text-purple-400 rounded-md border border-slate-800 disabled:opacity-20 transition-all"><ChevronUp size={14} /></button>
                     <button onClick={(e) => { e.stopPropagation(); onReorder?.(scene.id, 'down'); }} disabled={index === totalScenes - 1 || isGenerating} className="p-1 bg-slate-950 text-slate-600 hover:text-purple-400 rounded-md border border-slate-800 disabled:opacity-20 transition-all"><ChevronDown size={14} /></button>
                   </div>
                   <button onClick={(e) => { e.stopPropagation(); onToggleSkip(scene.id); }} className={`p-2.5 rounded-xl transition-all ${isSkipped ? 'bg-slate-800 text-slate-400' : 'bg-slate-950 text-slate-600 hover:text-white shadow-inner border border-slate-800 hover:border-slate-600 active:scale-90'}`}>
                     {isSkipped ? <Film size={18} className="text-red-500 line-through"/> : <Film size={18}/>}
                   </button>
                   {onDelete && (
                     <button onClick={(e) => { e.stopPropagation(); onDelete(scene.id); }} className="p-2.5 bg-slate-950 text-slate-600 hover:bg-red-600/10 hover:text-red-500 rounded-xl transition-all shadow-inner border border-slate-800 hover:border-red-500/30 active:scale-90">
                       <Trash2 size={18} />
                     </button>
                   )}
                </div>
            </div>

            {/* Input Areas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative group/ta">
                <textarea 
                  value={scene.voiceover} 
                  onChange={(e) => onUpdate(scene.id, { voiceover: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[13px] text-slate-300 font-kanit min-h-[100px] outline-none focus:ring-2 focus:ring-orange-600/20 resize-y transition-all shadow-inner" 
                  placeholder="Narrative dialogue..." 
                />
              </div>
              <div className="relative group/ta">
                <textarea 
                  value={scene.visual_prompt} 
                  onChange={(e) => onUpdate(scene.id, { visual_prompt: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 pr-12 text-[11px] text-slate-500 font-medium italic min-h-[100px] outline-none focus:ring-2 focus:ring-blue-600/20 resize-y transition-all shadow-inner scrollbar-hide" 
                  placeholder="Cinematic visual parameters..." 
                />
                <button 
                  onClick={handleRefineClick}
                  disabled={isRefining}
                  className={`absolute right-3 top-3 p-2 rounded-lg transition-all shadow-lg border ${isRefining ? 'bg-orange-600 text-white animate-spin' : 'bg-slate-900 text-slate-500 hover:text-orange-400 hover:border-orange-500/50 hover:bg-orange-600/10 border-slate-800'}`}
                  title="AI Visual Refinement"
                >
                  {isRefining ? <RefreshCw size={14} /> : <Wand2 size={14} />}
                </button>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-4 w-full">
                  <button 
                    onClick={() => onPreviewAudio(scene)}
                    disabled={isGenerating && !isAudioSynth}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg border ${
                      playingId === scene.id 
                        ? 'bg-red-600 border-red-500 text-white animate-pulse' 
                        : isAudioSynth
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 animate-pulse cursor-wait'
                        : !hasAudio
                        ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    {isAudioSynth ? <Loader2 size={14} className="animate-spin" /> : playingId === scene.id ? <Pause size={14} fill="currentColor"/> : !hasAudio ? <Mic size={14} /> : <Play size={14} fill="currentColor"/>}
                    {isAudioSynth ? 'Synthesizing...' : playingId === scene.id ? 'Monitoring VO' : !hasAudio ? 'Synth Voice' : 'Listen VO'}
                  </button>
                  
                  {isGenerating && (
                    <div className="flex flex-col gap-1 overflow-hidden">
                       <div className="flex items-center gap-2 text-[9px] font-black text-orange-500 uppercase tracking-tighter truncate">
                         <Zap size={10} fill="currentColor" className="animate-pulse" /> {scene.statusDetail || 'Synchronizing with Neural Core...'}
                       </div>
                       <div className="flex items-center gap-3 text-[8px] font-bold text-slate-600 uppercase tracking-widest">
                          <span className="flex items-center gap-1"><Timer size={8}/> P-Link Active</span>
                          <span className="flex items-center gap-1"><Activity size={8}/> Real-time Polling</span>
                       </div>
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => onRegenerate(scene)} 
                  disabled={isGenerating} 
                  className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 disabled:opacity-50 group/synth relative overflow-hidden shrink-0 ${isGenerating ? 'bg-slate-800 text-slate-400 cursor-wait' : 'bg-purple-600 text-white hover:bg-purple-500 shadow-purple-900/40'}`}
                >
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="group-hover/synth:rotate-12 transition-transform" />}
                  {isGenerating ? 'Produce Node...' : 'Produce Node'}
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  // Custom Memo Comparison to prevent excessive re-renders during typing
  return (
    prev.scene.id === next.scene.id &&
    prev.scene.voiceover === next.scene.voiceover &&
    prev.scene.visual_prompt === next.scene.visual_prompt &&
    prev.scene.status === next.scene.status &&
    prev.scene.processingProgress === next.scene.processingProgress &&
    prev.scene.videoUrl === next.scene.videoUrl &&
    prev.scene.imageUrl === next.scene.imageUrl &&
    prev.playingId === next.playingId &&
    prev.isDragging === next.isDragging &&
    prev.isOver === next.isOver &&
    prev.index === next.index
  );
});

// --- Main Component: SceneManager ---

const SceneManager: React.FC<SceneManagerProps> = ({ 
  scenes, onRegenerate, onRefinePrompt, onAutoStoryboard, onGenerateAudio, 
  onToggleSkip, onUpdateScene, onReorder, onDragReorder, onAddScene, 
  onDelete
}) => {
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const stopPreview = () => {
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch(e) {}
      activeSourceRef.current = null;
    }
    setPlayingId(null);
  };

  const handlePreviewAudio = async (scene: Scene) => {
    if (playingId === scene.id) {
      stopPreview();
      return;
    }
    if (!scene.audioBuffer && onGenerateAudio) {
      onGenerateAudio(scene);
      return;
    }
    if (!scene.audioBuffer) return;
    
    stopPreview();
    
    // Lazy load Audio Context
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    
    if (ctx.state === 'suspended') await ctx.resume();
    
    const source = ctx.createBufferSource();
    source.buffer = scene.audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => setPlayingId(null);
    activeSourceRef.current = source;
    setPlayingId(scene.id);
    source.start();
  };

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null) return;
    setDragOverIdx(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx !== null && onDragReorder && draggedIdx !== index) {
      onDragReorder(draggedIdx, index);
    }
    resetDragState();
  };

  const resetDragState = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-900/80 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm ring-1 ring-slate-800 gap-6">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-purple-600/10 rounded-2xl flex items-center justify-center text-purple-400 border border-purple-500/20">
              <Zap size={24} />
           </div>
           <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none">Production Architecture</h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1.5">Master Node Dashboard • {scenes.length} Clusters</p>
           </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
           {onAutoStoryboard && (
             <button onClick={onAutoStoryboard} className="flex items-center gap-2 px-5 py-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600/20 transition-all shadow-lg active:scale-95">
               <Wand2 size={12}/> AI Storyboard
             </button>
           )}
           {onAddScene && (
             <button onClick={onAddScene} className="flex items-center gap-2 px-5 py-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/20 transition-all shadow-lg active:scale-95">
               <Plus size={12}/> New Node
             </button>
           )}
           <div className="flex items-center gap-2 pl-4 border-l border-slate-800">
             <div className="flex -space-x-2">
               {scenes.slice(0, 8).map((s, i) => (
                 <div key={i} className={`w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${s.status === 'completed' ? 'bg-emerald-500' : s.status === 'generating' ? 'bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.5)]' : s.status === 'skipped' ? 'bg-slate-700' : 'bg-slate-800'}`}></div>
               ))}
             </div>
           </div>
        </div>
      </div>

      {/* Scene List */}
      <div className="grid grid-cols-1 gap-6 relative" onDragLeave={() => setDragOverIdx(null)}>
        {scenes.map((scene, idx) => (
          <SceneCard 
            key={scene.id}
            scene={scene}
            index={idx}
            totalScenes={scenes.length}
            isDragging={draggedIdx === idx}
            isOver={dragOverIdx === idx}
            draggedIdx={draggedIdx}
            playingId={playingId}
            onPreviewAudio={handlePreviewAudio}
            onUpdate={onUpdateScene}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={resetDragState}
            onRegenerate={onRegenerate}
            onRefine={onRefinePrompt!}
            onToggleSkip={onToggleSkip}
            onDelete={onDelete}
            onReorder={onReorder}
          />
        ))}

        {onAddScene && (
          <button 
            onClick={onAddScene}
            className="w-full py-8 border-2 border-dashed border-slate-800 rounded-[2.5rem] text-slate-600 hover:text-purple-400 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex flex-col items-center justify-center gap-3 group/add"
          >
            <div className="p-4 rounded-2xl bg-slate-800 group-hover/add:bg-purple-600/20 transition-all">
              <Plus size={32} className="group-hover/add:scale-110 transition-transform" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Add Production Node</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SceneManager;