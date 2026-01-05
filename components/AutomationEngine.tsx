import React, { useEffect, useRef, useState } from 'react';
import { useAutomation } from '../contexts/AutomationContext';
import { fetchTrendingNews, generateShortsScript, generateImageForScene, generateVoiceover, generateVideoForScene, generatePodcastAudio } from '../services/geminiService';
import { getProject, saveProject, addToQueue, updateQueueItem, ProjectData, validateYoutubeMetadata } from '../services/projectService';
import { uploadVideoToYouTube } from '../services/youtubeService';
import { decodeAudioData } from '../utils/audioUtils';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import { GeneratorMode } from '../types';

// Configuration constants
const TICK_RATE = 5000; 
const MIN_QUEUE_BUFFER = 2; 

// [แก้ไข] เพิ่ม Interface รับ apiKey
interface AutomationEngineProps {
  apiKey: string;
}

const AutomationEngine: React.FC<AutomationEngineProps> = ({ apiKey }) => {
    const { isPassiveMode, queue, refreshQueue, addLog, setCurrentAction, isQuotaLimited, setQuotaLimited } = useAutomation();
    const [isProcessing, setIsProcessing] = useState(false);

    // Refs to allow logic to access latest state without re-triggering effects
    const isPassiveRef = useRef(isPassiveMode);
    const isProcessingRef = useRef(isProcessing);
    const isQuotaLimitedRef = useRef(isQuotaLimited);
    const queueRef = useRef(queue);
    const playerRef = useRef<VideoPlayerRef>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => { isPassiveRef.current = isPassiveMode; }, [isPassiveMode]);
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

    const waitForPlayerReady = async (timeout = 15000) => {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (playerRef.current && playerRef.current.renderVideo) return true;
            await new Promise(r => setTimeout(r, 500));
        }
        return false;
    };

    // 1. Trend Harvesting Logic
    const harvestTrends = async () => {
        addLog("📡 Scanning global trends...");
        setCurrentAction('Searching Topics');
        try {
            const categories = ['Technology', 'Science', 'History', 'Mystery', 'Horror Story', 'Business'];
            const randomCat = categories[Math.floor(Math.random() * categories.length)];
            const trends = await fetchTrendingNews('global', randomCat, '');

            if (trends.length > 0) {
                const trend = trends[0]; // Pick top trend
                addLog(`✨ Found Trend: ${trend.headline}`);

                // Create Project Skeleton
                const projectId = `auto-${Date.now()}`;
                const newProject: ProjectData = {
                    id: projectId,
                    type: 'shorts',
                    title: trend.headline.slice(0, 50),
                    topic: trend.headline,
                    lastUpdated: Date.now(),
                    config: {
                        mode: GeneratorMode.FACTS,
                        aspectRatio: '9:16',
                        language: 'English',
                        selectedVoice: 'Kore',
                        selectedVisualModel: 'gemini-2.5-flash-image',
                        selectedStyle: 'Cinematic',
                        subtitleStyle: { fontSize: 84, textColor: '#FFFF00', backgroundColor: '#000000', backgroundOpacity: 0.0, verticalOffset: 35, fontFamily: 'Kanit', outlineColor: '#000000', outlineWidth: 6, shadowBlur: 4, shadowColor: 'rgba(0,0,0,0.8)', fontWeight: '900' }
                    },
                    script: null
                };

                await saveProject(newProject);

                // Add to Queue
                const description = `Auto-generated short about ${trend.headline}. #shorts #ai`;
                const tags = ["AI", "Viral", "Shorts", randomCat, "Trending", "DeepDive", "Future", "Knowledge", "Smart", "TechNews"];
                const validation = validateYoutubeMetadata(trend.headline, description, tags);

                await addToQueue({
                    id: projectId,
                    projectId: projectId,
                    projectType: 'shorts',
                    metadata: {
                        title: trend.headline.slice(0, 100),
                        description,
                        tags,
                        privacy_status: 'private'
                    },
                    status: 'pending',
                    progress: 0,
                    system_note: validation.note,
                    addedAt: Date.now(),
                    queued_at: new Date().toISOString()
                });

                await refreshQueue();
                addLog(`📥 Added to Queue: ${trend.headline}`);
            } else {
                addLog("⚠️ No strong trends found, sleeping...");
            }
        } catch (e: any) {
            addLog(`❌ Harvesting failed: ${e.message}`);
        }
    };

    // 2. Production Logic
    const processQueueItem = async (item: any) => {
        setIsProcessing(true);
        const activeTitle = item.metadata?.title || item.title;
        setCurrentAction(`Producing: ${activeTitle}`);
        try {
            addLog(`🎬 Starting Production: ${activeTitle}`);

            let videoToUpload: Blob | undefined = item.videoBlob;

            if (!videoToUpload) {
                // Step A: Generate Script if missing
                let project = await getProject(item.projectId);
                if (!project) throw new Error("Project data lost");

                if (!project.script) {
                    await updateQueueItem(item.id, { status: 'generating', progress: 10 });
                    addLog("📝 Writing Script...");
                    const script = await generateShortsScript(project.topic, GeneratorMode.FACTS, '9:16', 'English', 'Cinematic');
                    project.script = script;
                    await saveProject(project);
                }

                // Step B: Generate Assets (Parallel)
                const scenes = project.script.scenes;
                const audioCtx = getAudioContext();
                if (audioCtx.state === 'suspended') await audioCtx.resume();

                let completedScenes = 0;
                for (const scene of scenes) {
                    if (scene.status === 'completed') {
                        completedScenes++;
                        continue;
                    }

                    await updateQueueItem(item.id, { progress: 15 + Math.floor((completedScenes / scenes.length) * 50) });
                    addLog(`🎨 Rendering Scene ${scene.id}...`);

                    const [visualResult, audioBase64] = await Promise.all([
                        generateImageForScene(scene.visual_prompt, 'gemini-2.5-flash-image', '9:16', 'Cinematic'),
                        generateVoiceover(scene.voiceover, 'Kore')
                    ]);

                    scene.imageUrl = visualResult;
                    scene.audioBase64 = audioBase64;
                    scene.audioBuffer = await decodeAudioData(audioBase64, audioCtx);
                    scene.status = 'completed';
                    completedScenes++;

                    // Save intermediate state
                    await saveProject(project);
                }

                // Step C: Render Video
                addLog("🎞️ Final Rendering...");
                await updateQueueItem(item.id, { status: 'rendering', progress: 70 });

                // We need to temporarily mount the project to the hidden player
                const ready = await waitForPlayerReady();
                if (!ready) throw new Error("Renderer timeout");

                const { blob } = await playerRef.current!.renderVideo((p) => {
                    // Progress callback could update item.progress here
                });
                videoToUpload = blob;
            } else {
                addLog("✨ Found pre-rendered segment cache. Skipping synthesis.");
            }

            // Step D: Upload
            const token = localStorage.getItem('yt_access_token');
            if (token && videoToUpload) {
                if (isQuotaLimitedRef.current) {
                    addLog("⚠️ YouTube Quota Exceeded. Skipping upload.");
                    throw new Error("YOUTUBE_QUOTA_EXCEEDED");
                }

                addLog("🚀 Uploading to YouTube...");
                await updateQueueItem(item.id, { status: 'uploading', progress: 90 });
                try {
                    const metadata = item.metadata || { title: item.title, description: item.description, tags: item.tags, privacy_status: item.privacy };
                    await uploadVideoToYouTube(videoToUpload, metadata.title, metadata.description, token, metadata.privacy_status, metadata.tags || []);
                    addLog(`✅ Published: ${metadata.title}`);
                    await updateQueueItem(item.id, { status: 'completed', progress: 100 });
                } catch (uErr: any) {
                    if (uErr.message === "YOUTUBE_QUOTA_EXCEEDED") {
                        setQuotaLimited(true);
                        addLog("🛑 YouTube Quota Limit Reached. Pausing automation.");
                        throw uErr;
                    }
                    throw uErr;
                }
            } else if (!token) {
                addLog("⚠️ No YouTube Token - Skipping Upload");
                await updateQueueItem(item.id, { status: 'completed', error: 'No Token', progress: 100 });
            }

        } catch (e: any) {
            if (e.message !== "YOUTUBE_QUOTA_EXCEEDED") {
                addLog(`❌ Task Failed: ${e.message}`);
            }
            await updateQueueItem(item.id, { status: 'error', error: e.message });
        } finally {
            setIsProcessing(false);
            setCurrentAction('Idle');
            refreshQueue();
        }
    };

    // Main Loop
    useEffect(() => {
        const loop = setInterval(async () => {
            // 1. Check if Engine is On
            if (!isPassiveRef.current) return;

            // 2. Check if Busy or Quota Limited
            if (isProcessingRef.current || isQuotaLimitedRef.current) return;

            // 3. Logic Router
            const pendingItems = queueRef.current.filter(i => i.status === 'pending' || i.status === 'waiting' || i.status === 'generating' || i.status === 'rendering');

            if (pendingItems.length > 0) {
                // High Priority: Clear Queue
                await processQueueItem(pendingItems[0]);
            } else {
                // Low Priority: Fill Queue (if running low)
                if (queueRef.current.length < MIN_QUEUE_BUFFER) {
                    await harvestTrends();
                }
            }

        }, TICK_RATE);

        return () => clearInterval(loop);
    }, []);

    // Getting current active project for the hidden player
    const activeItem = queue.find(i => (i.status === 'generating' || i.status === 'rendering') && !i.videoBlob);
    const [activeProject, setActiveProject] = useState<any>(null);

    useEffect(() => {
        const loadActive = async () => {
            if (activeItem) {
                const p = await getProject(activeItem.projectId);
                setActiveProject(p);
            } else {
                setActiveProject(null);
            }
        };
        loadActive();
    }, [activeItem?.id]); // Only re-fetch if item changes

    return (
        <div className="hidden">
            {/* Hidden Render Engine */}
            {activeProject && (
                <VideoPlayer
                    ref={playerRef}
                    scenes={activeProject.script?.scenes.filter((s: any) => s.status === 'completed') || []}
                    isReady={true}
                    aspectRatio={activeProject.config?.aspectRatio || '9:16'}
                    subtitleStyle={activeProject.config?.subtitleStyle}
                />
            )}
        </div>
    );
};

export default AutomationEngine;