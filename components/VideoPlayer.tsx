
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Scene, SubtitleStyle } from '../types';
import {
  Play, Pause, Loader2, VolumeX, Volume2, 
  Subtitles
} from 'lucide-react';

// --- Utility Helpers ---

// 1. Easing Function for Smooth Motion (Ken Burns นุ่มๆ)
const easeOutQuad = (t: number) => t * (2 - t);

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const hexToRgba = (hex: string, opacity: number) => {
  let r = 0, g = 0, b = 0;
  if (!hex) return `rgba(0,0,0,${opacity})`;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  if (!text) return [];
  const words = text.split(""); 
  const lines = [];
  let currentLine = "";
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + word).width;
    if (width < maxWidth) currentLine += word;
    else { lines.push(currentLine); currentLine = word; }
  }
  lines.push(currentLine);
  return lines;
};

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
};

// --- Interfaces ---
interface RenderOptions {
  resolution?: '360p' | '720p' | '1080p' | '4k';
  bitrate?: number;
}

interface VideoPlayerProps {
  scenes: Scene[];
  isReady: boolean;
  bgmUrl?: string;
  bgmVolume?: number;
  voiceSpeed?: number;
  aspectRatio?: '9:16' | '16:9';
  subtitleStyle?: SubtitleStyle;
  previewText?: string;
  hideSubtitles?: boolean;
  onToggleSubtitles?: () => void;
  onPlaybackChange?: (isPlaying: boolean) => void;
}

// Fix: Expanded onProgress signature to include frame information for callers
export interface VideoPlayerRef {
  renderVideo: (
    onProgress?: (percent: number, stage: string, currentFrame?: number, totalFrames?: number) => void,
    options?: RenderOptions
  ) => Promise<{ blob: Blob, extension: string }>;
  togglePlayback: () => void;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(({
  scenes,
  isReady,
  bgmUrl,
  bgmVolume = 0.2,
  voiceSpeed = 1.0,
  aspectRatio = '16:9',
  subtitleStyle = {
    fontSize: 84,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 0.75,
    verticalOffset: 30,
    fontFamily: 'Kanit',
    outlineColor: '#000000',
    outlineWidth: 4,
    shadowBlur: 5,
    shadowColor: 'rgba(0,0,0,0.8)',
    fontWeight: '900'
  },
  previewText = "AI MOTION ENGINE READY",
  hideSubtitles = false,
  onToggleSubtitles,
  onPlaybackChange
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Refs for Engine
  const isPlayingRef = useRef(false);
  const isRenderingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterStartTimeRef = useRef(0);
  const pauseTimeRef = useRef(0);
  const sceneTimestampsRef = useRef<{ start: number, end: number, id: number }[]>([]);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Asset Caches
  const [loadedImages, setLoadedImages] = useState<Map<number, HTMLImageElement>>(new Map());
  const [loadedVideos, setLoadedVideos] = useState<Map<number, HTMLVideoElement>>(new Map());
  const [bgmBuffer, setBgmBuffer] = useState<AudioBuffer | null>(null);

  const activeScenes = useMemo(() => (scenes || []).filter(s => s.status === 'completed'), [scenes]);
  const isLandscape = aspectRatio === '16:9';
  const BASE_WIDTH = isLandscape ? 1920 : 1080;
  const FPS = 30;

  // --- Asset Loading ---
  useEffect(() => {
    const dur = activeScenes.reduce((acc, s) => acc + (s.duration_est || 5), 0);
    setTotalDuration(dur);
  }, [activeScenes]);

  useEffect(() => {
    if (!bgmUrl || typeof window === 'undefined') { setBgmBuffer(null); return; }
    fetch(bgmUrl).then(r => r.arrayBuffer()).then(ab => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      return ctx.decodeAudioData(ab);
    }).then(setBgmBuffer).catch(() => setBgmBuffer(null));
  }, [bgmUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    activeScenes.forEach(scene => {
      if (scene.imageUrl && !loadedImages.has(scene.id)) {
        const img = new Image(); img.crossOrigin = "anonymous"; img.src = scene.imageUrl;
        img.onload = () => setLoadedImages(p => new Map(p).set(scene.id, img));
      }
      if (scene.videoUrl && !loadedVideos.has(scene.id)) {
        const vid = document.createElement('video'); vid.crossOrigin = "anonymous"; vid.src = scene.videoUrl;
        vid.muted = true; vid.loop = true; vid.preload = "auto";
        vid.onloadeddata = () => setLoadedVideos(p => new Map(p).set(scene.id, vid));
      }
    });
  }, [activeScenes]);

  // --- 🔥 MAIN RENDER ENGINE 🔥 ---
  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. High Quality Settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    let index = -1;
    let elapsed = 0;
    
    if (isPlayingRef.current || isRenderingRef.current) {
        const now = audioContextRef.current ? audioContextRef.current.currentTime : 0;
        elapsed = now - masterStartTimeRef.current;
    } else {
        elapsed = pauseTimeRef.current;
    }

    if (Math.abs(elapsed - currentTime) > 0.1) setCurrentTime(elapsed);

    // 🔥 FIX: คำนวณเวลาแบบสะสม (Cumulative) เพื่อป้องกัน Index เพี้ยน
    const timestamps = sceneTimestampsRef.current.length > 0 
        ? sceneTimestampsRef.current 
        : (() => {
            let t = 0;
            return activeScenes.map(s => {
                const d = s.duration_est || 5;
                const r = { start: t, end: t + d, id: s.id };
                t += d;
                return r;
            });
        })();

    index = timestamps.findIndex(t => elapsed >= t.start && elapsed < t.end);

    if (analyserRef.current && isPlayingRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(avg / 255);
    }

    const lastSceneEnd = timestamps[timestamps.length - 1]?.end || 0;
    if (index === -1 && elapsed >= lastSceneEnd && lastSceneEnd > 0) {
        if (isPlayingRef.current && !isRenderingRef.current) stopAll();
        index = activeScenes.length - 1;
        elapsed = lastSceneEnd;
    } else if (index === -1) {
        index = 0;
    }
    
    if (index !== currentSceneIndex) setCurrentSceneIndex(index);

    const scene = activeScenes[index];
    const timestamp = timestamps[index];

    // --- DRAWING LAYERS ---
    
    // Layer 1: Background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const source = scene ? (loadedVideos.get(scene.id) || loadedImages.get(scene.id)) : null;

    if (source && timestamp) {
        if (source instanceof HTMLVideoElement && (isPlayingRef.current || isRenderingRef.current)) {
            const targetTime = (elapsed - timestamp.start) * voiceSpeed;
            if (source.paused) source.play().catch(() => {});
            const vidDur = source.duration || 10;
            source.currentTime = targetTime % vidDur; 
        }

        const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
        const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
        
        // --- Layer 2: Visuals with Ken Burns & Grading ---
        const sceneDuration = timestamp.end - timestamp.start;
        const rawProgress = Math.max(0, Math.min(1, (elapsed - timestamp.start) / sceneDuration));
        const smoothProgress = easeOutQuad(rawProgress); // Smooth easing
        
        const maxZoom = source instanceof HTMLVideoElement ? 1.05 : 1.15;
        const zoomLevel = 1.0 + (smoothProgress * (maxZoom - 1.0));
        
        // Audio Pulse
        const beatPulse = (isPlayingRef.current && audioLevel > 0.2) ? (audioLevel * 0.015) : 0;
        const totalScale = zoomLevel + beatPulse;

        const ratio = Math.max(canvas.width / sw, canvas.height / sh) * totalScale;
        const dw = sw * ratio;
        const dh = sh * ratio;
        
        ctx.save();
        
        // 🎨 CINEMATIC COLOR GRADING
        ctx.filter = 'contrast(1.08) saturate(1.12) brightness(0.98)';

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh);
        
        ctx.filter = 'none'; // Reset filter
        ctx.restore();

        // --- Layer 3: Vignette (Dark Corners) ---
        ctx.save();
        const gradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, canvas.height * 0.4, 
            canvas.width / 2, canvas.height / 2, canvas.height * 0.85
        );
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,0.5)"); // 50% darkness at edges
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // --- Layer 4: Pro Subtitles ---
    if (!hideSubtitles) {
      const textToDraw = (isPlayingRef.current || isRenderingRef.current) && scene ? scene.voiceover : (isReady && activeScenes.length > 0 ? activeScenes[0].voiceover : previewText);
      
      if (textToDraw && textToDraw !== previewText) {
        const scale = canvas.width / BASE_WIDTH;
        const fontSize = (subtitleStyle.fontSize || 84) * scale;
        ctx.font = `${subtitleStyle.fontWeight || 900} ${fontSize}px "${subtitleStyle.fontFamily}", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        
        const lines = wrapText(ctx, textToDraw, canvas.width * 0.85);
        const lineHeight = fontSize * 1.3;
        const yBase = canvas.height * (1 - (subtitleStyle.verticalOffset / 100));
        const totalHeight = lines.length * lineHeight;
        const startY = yBase - totalHeight / 2 + lineHeight / 2;

        lines.forEach((line, i) => {
          const ly = startY + i * lineHeight;
          const tw = ctx.measureText(line).width;
          const pad = fontSize * 0.3;
          ctx.save();
          
          // Sub-Layer A: Background Box
          if (subtitleStyle.backgroundOpacity > 0) {
            ctx.shadowColor = "rgba(0,0,0,0.4)";
            ctx.shadowBlur = 12 * scale;
            ctx.fillStyle = hexToRgba(subtitleStyle.backgroundColor, subtitleStyle.backgroundOpacity);
            const bx = canvas.width / 2 - tw / 2 - pad;
            const by = ly - fontSize / 2 - pad / 2;
            const bw = tw + pad * 2;
            const bh = fontSize + pad;
            
            if (ctx.roundRect) {
              ctx.beginPath();
              ctx.roundRect(bx, by, bw, bh, 16 * scale);
              ctx.fill();
            } else {
              ctx.fillRect(bx, by, bw, bh);
            }
            ctx.shadowBlur = 0; // Reset
          }

          // Sub-Layer B: Glow (Reading safety)
          ctx.shadowColor = "rgba(0,0,0,0.9)";
          ctx.shadowBlur = 8 * scale;
          ctx.lineWidth = (subtitleStyle.outlineWidth || 4) * scale * 2.5;
          ctx.strokeStyle = subtitleStyle.outlineColor || '#000';
          ctx.lineJoin = 'round';
          ctx.strokeText(line, canvas.width / 2, ly);

          // Sub-Layer C: Sharp Outline
          ctx.shadowBlur = 0;
          ctx.lineWidth = (subtitleStyle.outlineWidth || 4) * scale * 1.5;
          ctx.strokeText(line, canvas.width / 2, ly);
          
          // Sub-Layer D: Text Fill
          ctx.fillStyle = subtitleStyle.textColor;
          ctx.fillText(line, canvas.width / 2, ly);
          
          ctx.restore();
        });
      }
    }
  };
  
  // --- Playback Logic ---
  const stopAll = () => {
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
    sourcesRef.current.clear();
    loadedVideos.forEach(v => { try { v.pause(); } catch(e){} });
    
    if (audioContextRef.current) {
        pauseTimeRef.current = audioContextRef.current.currentTime - masterStartTimeRef.current;
        audioContextRef.current.suspend();
    }
    
    setIsPlaying(false); 
    isPlayingRef.current = false; 
    setAudioLevel(0); 
    onPlaybackChange?.(false);
  };

  const startPlayback = async (ctx: AudioContext, dest: AudioNode | null, startTimeOffset: number = 0) => {
    audioContextRef.current = ctx; 
    if (ctx.state === 'suspended') await ctx.resume();
    
    const output = dest || ctx.destination;
    const analyser = ctx.createAnalyser(); 
    analyser.fftSize = 256; 
    analyserRef.current = analyser;
    analyser.connect(output);
    
    const now = ctx.currentTime; 
    masterStartTimeRef.current = now - startTimeOffset;
    
    let currentPos = 0;
    const timestamps: { start: number, end: number, id: number }[] = [];
    
    for (const scene of activeScenes) {
      const duration = scene.audioBuffer ? (scene.audioBuffer.duration / voiceSpeed) : (scene.duration_est || 3);
      const sceneStart = currentPos;
      const sceneEnd = currentPos + duration;
      
      timestamps.push({ start: sceneStart, end: sceneEnd, id: scene.id });

      if (sceneEnd > startTimeOffset) {
          if (scene.audioBuffer) {
            const source = ctx.createBufferSource(); 
            source.buffer = scene.audioBuffer;
            source.playbackRate.value = voiceSpeed; 
            source.connect(analyser);
            
            let startAt = now + (sceneStart - startTimeOffset);
            let offset = 0;

            if (sceneStart < startTimeOffset) {
                offset = (startTimeOffset - sceneStart) * voiceSpeed; 
                startAt = now;
            }
            
            source.start(startAt, offset);
            sourcesRef.current.add(source);
          }
      }
      currentPos += duration;
    }
    
    sceneTimestampsRef.current = timestamps;
    setTotalDuration(currentPos);

    if (bgmBuffer) {
      const bgmSource = ctx.createBufferSource(); 
      bgmSource.buffer = bgmBuffer; 
      bgmSource.loop = true;
      const gain = ctx.createGain(); 
      gain.gain.value = bgmVolume; 
      bgmSource.connect(gain); 
      gain.connect(output);
      
      const bgmOffset = (startTimeOffset % bgmBuffer.duration);
      bgmSource.start(now, bgmOffset); 
      sourcesRef.current.add(bgmSource);
    }
    return currentPos; 
  };

  const handlePlay = async () => {
    if (isPlaying) {
      stopAll();
    } else {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setIsPlaying(true); 
      isPlayingRef.current = true; 
      onPlaybackChange?.(true);
      const startFrom = pauseTimeRef.current >= totalDuration ? 0 : pauseTimeRef.current;
      await startPlayback(ctx, null, startFrom);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!totalDuration || !containerRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.min(1, Math.max(0, x / rect.width));
      const seekTime = percent * totalDuration;

      pauseTimeRef.current = seekTime;
      setCurrentTime(seekTime);
      drawFrame(); 

      if (isPlaying) {
          stopAll();
          setTimeout(async () => {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              setIsPlaying(true); 
              isPlayingRef.current = true; 
              await startPlayback(ctx, null, seekTime);
          }, 50);
      }
  };

  // --- 🔥 EXPORT LOGIC (FIXED) ---
  useImperativeHandle(ref, () => ({
    renderVideo: async (onProgress, options) => {
      if (activeScenes.length === 0) throw new Error("Synthesis Required");
      
      if (!activeScenes.every(s => (s.imageUrl && loadedImages.has(s.id)) || (s.videoUrl && loadedVideos.has(s.id)))) {
        onProgress?.(0, "Finalizing Assets...");
        await new Promise(r => setTimeout(r, 2000));
      }

      const resolution = options?.resolution || '1080p';
      let [width, height] = isLandscape ? [1920, 1080] : [1080, 1920];
      if (resolution === '360p') [width, height] = isLandscape ? [640, 360] : [360, 640];
      if (resolution === '4k') [width, height] = isLandscape ? [3840, 2160] : [2160, 3840];
      
      setIsRendering(true); isRenderingRef.current = true;
      pauseTimeRef.current = 0; 
      
      const canvas = canvasRef.current!;
      const [ow, oh] = [canvas.width, canvas.height];
      [canvas.width, canvas.height] = [width, height];
      
      drawFrame(); 

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      const dest = audioCtx.createMediaStreamDestination();
      const mimeType = getSupportedMimeType();
      
      const canvasStream = canvas.captureStream(FPS);
      const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      
      // High Bitrate (25 Mbps) for Cinematic Quality
      const recorder = new MediaRecorder(combinedStream, { 
        mimeType, 
        videoBitsPerSecond: options?.bitrate || 25000000 
      });
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      
      return new Promise((resolve, reject) => {
        recorder.onstop = () => {
          [canvas.width, canvas.height] = [ow, oh];
          setIsRendering(false); isRenderingRef.current = false;
          if (chunks.length === 0) reject(new Error("Encoding failed: No data."));
          else resolve({ blob: new Blob(chunks, { type: mimeType }), extension: mimeType.includes('mp4') ? 'mp4' : 'webm' });
        };

        recorder.onerror = (e) => reject(e);
        recorder.start();

        startPlayback(audioCtx, dest, 0).then((totalDur) => {
          
          // 🔥 FIX: เพิ่ม Buffer ท้ายคลิป 1.5 วินาที กันตัดจบ
          const END_BUFFER = 1.5; 
          const finalDuration = totalDur + END_BUFFER;

          const renderInterval = setInterval(() => {
            const elapsed = audioCtx.currentTime - masterStartTimeRef.current;
            const progress = Math.min(99, Math.floor((elapsed / totalDur) * 100));
            
            // Fix: Calculate frame info and provide 4 arguments to onProgress
            const cf = Math.floor(elapsed * FPS);
            const tf = Math.floor(totalDur * FPS);
            onProgress?.(progress, `Exporting... ${(elapsed).toFixed(1)}s / ${totalDur.toFixed(1)}s`, cf, tf);
            
            if (elapsed >= finalDuration) { 
              clearInterval(renderInterval);
              if (recorder.state === 'recording') {
                // 🔥 FIX: Force flush data
                recorder.requestData(); 
                setTimeout(() => {
                    recorder.stop();
                    stopAll();
                }, 100);
              }
            }
          }, 100);
        }).catch(reject);
      });
    },
    togglePlayback: handlePlay
  }));

  // --- Animation Loop (FIXED DEPENDENCIES) ---
  useEffect(() => {
    let anim: number; 
    const loop = () => { drawFrame(); anim = requestAnimationFrame(loop); };
    loop(); 
    return () => cancelAnimationFrame(anim);
  }, [
      isPlaying, 
      isRendering, 
      subtitleStyle, 
      voiceSpeed, 
      hideSubtitles, 
      isReady,
      // 🔥 FIX: ใส่ Dependency ให้ครบ เพื่อให้ Loop รู้จักซีนใหม่ๆ
      activeScenes,
      loadedImages
  ]);

  // --- UI Render ---
  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-neutral-950 rounded-xl overflow-hidden shadow-2xl border border-neutral-800">
      
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden group/player select-none">
        <canvas 
          ref={canvasRef} 
          width={BASE_WIDTH} 
          height={isLandscape ? 1080 : 1920} 
          className="max-w-full max-h-full object-contain shadow-lg"
        />

        {!isPlaying && !isRendering && isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all cursor-pointer" onClick={handlePlay}>
            <div className="p-6 rounded-full bg-white/10 border border-white/20 backdrop-blur-md shadow-2xl transform hover:scale-110 transition-all group-hover/player:bg-orange-600/90 group-hover/player:border-orange-500">
               <Play size={48} fill="white" className="ml-1 text-white"/>
            </div>
          </div>
        )}

        {(!isReady || isRendering) && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
            <span className="text-white font-medium tracking-wider animate-pulse">
              {isRendering ? 'RENDERING CINEMATIC CUT...' : 'AI ENGINE WARMING UP...'}
            </span>
          </div>
        )}
      </div>

      <div className="h-16 bg-neutral-900 border-t border-neutral-800 flex items-center px-4 gap-4 z-20 select-none">
        <button 
          onClick={handlePlay}
          disabled={!isReady || isRendering}
          className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors disabled:opacity-50"
        >
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>

        <div className="text-xs font-mono text-neutral-400 min-w-[80px]">
          <span className="text-white">{formatTime(currentTime)}</span> / {formatTime(totalDuration)}
        </div>

        <div 
            className="flex-1 h-2 bg-neutral-700 rounded-full overflow-hidden relative group/timeline cursor-pointer hover:h-3 transition-all"
            onClick={handleSeek}
        >
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-600 to-red-500 transition-all duration-100 ease-linear"
            style={{ width: `${Math.min(100, (currentTime / (totalDuration || 1)) * 100)}%` }}
          />
          <div className="absolute inset-0 bg-white/0 group-hover/timeline:bg-white/10 transition-colors" />
        </div>

        <div className="flex items-center gap-2 border-l border-neutral-800 pl-4">
           <button 
             onClick={onToggleSubtitles}
             className={`p-2 rounded-lg transition-colors ${hideSubtitles ? 'text-neutral-500 hover:text-white' : 'text-orange-500 bg-orange-500/10'}`}
             title="Toggle Subtitles"
           >
             <Subtitles size={18} />
           </button>

           <div className="flex items-center gap-2 text-neutral-400 w-24">
             {bgmVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
             <div className="h-1 flex-1 bg-neutral-700 rounded-full overflow-hidden">
               <div className="h-full bg-neutral-500" style={{ width: `${bgmVolume * 100}%` }} />
             </div>
           </div>
        </div>
      </div>
    </div>
  );
});

export default VideoPlayer;
