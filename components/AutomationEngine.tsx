
import React, { useEffect, useRef, useState } from 'react';
import { useAutomation } from '../contexts/AutomationContext';
import { fetchTrendingNews, generateShortsScript, generateImageForScene, generateVoiceover, generateVideoForScene } from '../services/geminiService';
import { getProject, saveProject, addToQueue, updateQueueItem, ProjectData, validateYoutubeMetadata } from '../services/projectService';
import { uploadVideoToYouTube } from '../services/youtubeService';
import { decodeAudioData } from '../utils/audioUtils';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import { GeneratorMode, Scene } from '../types';

const TICK_RATE = 5000; 
const MIN_QUEUE_BUFFER = 2; 

interface AutomationEngineProps {
  apiKey: string;
}

const AutomationEngine: React.FC<AutomationEngineProps> = ({ apiKey }) => {
    const { isPassiveMode, queue, refreshQueue, addLog, setCurrentAction, isQuotaLimited, setQuotaLimited } = useAutomation();
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeProject, setActiveProject] = useState<ProjectData | null>(null);

    const isProcessingRef = useRef(isProcessing);
    const isQuotaLimitedRef = useRef(isQuotaLimited);
    const queueRef = useRef(queue);
    const playerRef = useRef<VideoPlayerRef>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
    useEffect(() => { isQuotaLimitedRef.current = isQuotaLimited; }, [isQuotaLimited]);
    useEffect(() => { queueRef.current = queue; }, [queue]);

    const getAudioContext = () => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
        }
        return audioContextRef.current;
    };

    const waitForPlayerReady = async (timeout = 30000) => {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (playerRef.current && playerRef.current.renderVideo) return true;
            await new Promise(r => setTimeout(r, 1000));
        }
        return false;
    };

    const harvestTrends = async () => {
        if (!apiKey) return;
        addLog("📡 [Auto-Pilot] Scanning global trends for new nodes...");
        try {
            const categories = ['Technology', 'Science', 'History', 'Mystery'];
            const randomCat = categories[Math.floor(Math.random() * categories.length)];
            const trends = await fetchTrendingNews('global', randomCat, '');

            if (trends.length > 0) {
                const trend = trends[0];
                const projectId = `auto-${Date.now()}`;
                const newProject: ProjectData = {
                    id: projectId,
                    type: 'shorts',
                    title: trend.headline.slice(0, 80),
                    topic: trend.headline,
                    lastUpdated: Date.now(),
                    config: {
                        aspectRatio: '9:16', language: 'English', selectedVoice: 'Kore',
                        selectedVisualModel: 'gemini-2.5-flash-image', selectedStyle: 'Cinematic'
                    },
                    script: null
                };
                await saveProject(newProject);
                await addToQueue({
                    id: projectId, projectId, projectType: 'shorts',
                    metadata: { title: trend.headline, description: trend.summary, tags: ["AI", "Shorts"], privacy_status: 'private' },
                    status: 'pending', progress: 0, system_note: "Auto-Pilot Growth Node",
                    addedAt: Date.now(), queued_at: new Date().toISOString()
                });
                await refreshQueue();
                addLog(`📥 [Auto-Pilot] New project queued: ${trend.headline}`);
            }
        } catch (e: any) { addLog(`❌ Harvesting failed: ${e.message}`); }
    };

    const processQueueItem = async (item: any) => {
        if (isProcessingRef.current) return;
        setIsProcessing(true);
        setCurrentAction(`Rendering: ${item.metadata?.title || 'Project'}`);
        
        try {
            addLog(`🎬 Background Production Started: ${item.metadata?.title}`);
            let project = await getProject(item.projectId);
            if (!project) throw new Error("Source data lost. Pipeline cleanup required.");

            // Scripting Phase
            if (!project.script) {
                await updateQueueItem(item.id, { status: 'generating', progress: 5 });
                addLog("📝 Engineering narrative sequence...");
                project.script = await generateShortsScript(project.topic, GeneratorMode.FACTS, project.config.aspectRatio || '9:16', project.config.language || 'English', project.config.selectedStyle || 'Cinematic');
                await saveProject(project);
            }

            // Asset Synthesis Phase
            const audioCtx = getAudioContext();
            const scenes = project.script.scenes as Scene[];
            for (let i = 0; i < scenes.length; i++) {
                const s = scenes[i];
                if (s.status === 'completed') continue;

                const stepProgress = 10 + Math.floor((i / scenes.length) * 50);
                await updateQueueItem(item.id, { progress: stepProgress, status: 'generating' });
                addLog(`🎨 Processing Node Segment ${i+1}/${scenes.length}...`);

                const [vo, vis] = await Promise.all([
                    generateVoiceover(s.voiceover, project.config.selectedVoice || 'Kore'),
                    generateImageForScene(s.visual_prompt, project.config.selectedVisualModel || 'gemini-2.5-flash-image', project.config.aspectRatio || '9:16', project.config.selectedStyle || 'Cinematic')
                ]);

                s.audioBase64 = vo;
                s.imageUrl = vis;
                s.audioBuffer = await decodeAudioData(vo, audioCtx);
                s.status = 'completed';
                await saveProject(project);
            }

            // High Fidelity Render Phase
            addLog("🎞️ Commencing Headless Cinematic Render...");
            await updateQueueItem(item.id, { status: 'rendering', progress: 70 });
            
            setActiveProject(project);
            await new Promise(r => setTimeout(r, 3000)); 

            const ready = await waitForPlayerReady();
            if (!ready) throw new Error("Render Farm Timeout: Hardware context lost.");

            const { blob } = await playerRef.current!.renderVideo((p) => {
                const renderProgress = 70 + Math.floor((p / 100) * 20);
                updateQueueItem(item.id, { progress: renderProgress });
            });

            // Upload/Broadcast Phase
            addLog("✅ Render verified. Initializing Broadcast Protocol.");
            await updateQueueItem(item.id, { progress: 90, status: 'uploading', videoBlob: blob });

            const token = localStorage.getItem('yt_access_token');
            if (token && !isQuotaLimitedRef.current) {
                const meta = item.metadata;
                try {
                    await uploadVideoToYouTube(blob, meta.title, meta.description, token, meta.privacy_status, meta.tags, meta.publish_at);
                    addLog(`🚀 Broadcast Online: ${meta.title}`);
                    await updateQueueItem(item.id, { status: 'completed', progress: 100 });
                } catch (uploadErr: any) {
                    if (uploadErr.message?.includes("QUOTA")) setQuotaLimited(true);
                    throw uploadErr;
                }
            } else {
                addLog("⏸️ Uplink unavailable. Asset cached in local node.");
                await updateQueueItem(item.id, { status: 'completed', progress: 100, system_note: "Rendered. Waiting for YouTube Auth." });
            }

        } catch (e: any) {
            const errorMsg = e.message || "Unknown hardware failure";
            addLog(`❌ Pipeline Terminal Error: ${errorMsg}`);
            await updateQueueItem(item.id, { status: 'error', error: errorMsg });
        } finally {
            setIsProcessing(false);
            setActiveProject(null);
            setCurrentAction('Engine Standby');
            refreshQueue();
        }
    };

    useEffect(() => {
        const loop = setInterval(async () => {
            if (isProcessingRef.current) return;
            const pending = queueRef.current.find(i => i.status === 'pending' || i.status === 'waiting');
            if (pending) {
                await processQueueItem(pending);
                return;
            }
            if (isPassiveMode && queueRef.current.length < MIN_QUEUE_BUFFER && !isQuotaLimitedRef.current) {
                await harvestTrends();
            }
        }, TICK_RATE);
        return () => clearInterval(loop);
    }, [isPassiveMode]);

    return (
        /* UI Fix: วาง Renderer ไว้นอกหน้าจอแทนการใช้ hidden (display:none) เพื่อให้ Browser ไม่หยุดการเรนเดอร์ Canvas */
        <div 
          className="fixed top-0 left-0 -translate-x-[5000px] pointer-events-none opacity-0 overflow-hidden" 
          style={{ width: '1920px', height: '1080px' }}
          aria-hidden="true"
        >
            {activeProject && (
                <VideoPlayer
                    ref={playerRef}
                    scenes={activeProject.script?.scenes.filter((s: any) => s.status === 'completed') || []}
                    isReady={true}
                    aspectRatio={activeProject.config?.aspectRatio || '9:16'}
                    subtitleStyle={activeProject.config?.subtitleStyle}
                    bgmVolume={activeProject.config?.bgmVolume}
                />
            )}
        </div>
    );
};

export default AutomationEngine;
