
import React, { useState, useEffect, useRef } from 'react';
import { 
  Youtube, Key, Trash2, Loader2, Radio, LogOut, Zap, 
  Terminal, Users, PlaySquare, Eye, RefreshCw, Send, 
  CheckCircle2, AlertCircle, AlertTriangle, Library,
  PlusCircle, X, Lock, EyeOff, Globe, Hash, FileText,
  Video, Clapperboard, Mic, AlignLeft, BarChart2,
  ExternalLink, FileVideo
} from 'lucide-react';
import { getQueue, removeFromQueue, updateQueueItem, YoutubeQueueItem, getProject, saveProject, listProjects, ProjectData, addToQueue, validateYoutubeMetadata } from '../services/projectService';
import { getYouTubeChannelProfile } from '../services/youtubeService';
import { useAutomation } from '../contexts/AutomationContext';

const formatNumber = (num: string | number) => {
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  if (isNaN(n)) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
};

const YoutubeManager: React.FC = () => {
  const { isPassiveMode, togglePassiveMode, logs, addLog, queue, refreshQueue, currentAction, isQuotaLimited, setQuotaLimited } = useAutomation();

  const [token, setToken] = useState(localStorage.getItem('yt_access_token') || '');
  const [isSaved, setIsSaved] = useState(!!localStorage.getItem('yt_access_token'));
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Library states
  const [localProjects, setLocalProjects] = useState<ProjectData[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isRefreshingLibrary, setIsRefreshingLibrary] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);

  // Queue Modal states
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [queueTitle, setQueueTitle] = useState('');
  const [queueDesc, setQueueDesc] = useState('');
  const [queueTags, setQueueTags] = useState('');
  const [queuePrivacy, setQueuePrivacy] = useState<'public' | 'private' | 'unlisted'>('private');

  const isMounted = useRef(true);

  const fetchLibrary = async () => {
    setIsRefreshingLibrary(true);
    try {
      const projects = await listProjects();
      setLocalProjects(projects);
    } finally {
      setIsRefreshingLibrary(false);
    }
  };

  /**
   * Fetches the YouTube Channel Profile using the provided Access Token
   */
  const fetchProfile = async (accessToken: string) => {
    if (!accessToken || !isMounted.current) return;
    setLoadingProfile(true);
    setAuthError(null);
    setQuotaLimited(false);
    
    try {
      const data = await getYouTubeChannelProfile(accessToken);
      if (!isMounted.current) return;
      setProfile(data);
      setIsSaved(true);
      setQuotaLimited(false);
    } catch (err: any) {
      if (!isMounted.current) return;
      
      if (err.message === "YOUTUBE_QUOTA_EXCEEDED") {
        setQuotaLimited(true);
        setAuthError("YouTube API Quota Exceeded. Daily limit reached (10,000 units/day). Video uploads require 1,600 units.");
      } else {
        setAuthError(err.message || "Invalid or Expired Token. Please reconnect.");
      }
      
      setProfile(null);
      // Only reset "isSaved" if it's an auth error, not a quota error
      if (!err.message?.includes("QUOTA")) {
          setIsSaved(false);
          localStorage.removeItem('yt_access_token');
      }
    } finally {
      if (isMounted.current) setLoadingProfile(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    const savedToken = localStorage.getItem('yt_access_token');
    if (savedToken) {
      fetchProfile(savedToken);
    }
    fetchLibrary();
    return () => { isMounted.current = false; };
  }, []);

  const saveToken = () => {
    if (!token) return;
    localStorage.setItem('yt_access_token', token);
    setIsSaved(true);
    fetchProfile(token);
    window.dispatchEvent(new CustomEvent('yt-connection-changed'));
  };

  const clearToken = () => {
    if (!confirm("Disconnect YouTube account?")) return;
    localStorage.removeItem('yt_access_token');
    setToken('');
    setIsSaved(false);
    setProfile(null);
    setQuotaLimited(false);
    setAuthError(null);
    window.dispatchEvent(new CustomEvent('yt-connection-changed'));
  };

  const handleOpenQueueModal = (project: ProjectData) => {
    setSelectedProject(project);
    setQueueTitle(project.script?.seoTitle || project.title || '');
    setQueueDesc(project.script?.longDescription || project.topic || '');
    setQueueTags(project.script?.hashtags?.join(', ') || '');
    setQueuePrivacy('private');
    setIsQueueModalOpen(true);
  };

  const handleAddToQueue = async () => {
    if (!selectedProject) return;
    
    const tagArray = queueTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const validation = validateYoutubeMetadata(queueTitle, queueDesc, tagArray);

    if (!validation.isValid) {
      alert("Validation Failed:\n" + validation.issues.join("\n"));
      return;
    }

    if (tagArray.length < 10 || tagArray.length > 15) {
      if (!confirm(`Warning: You have ${tagArray.length} tags. Optimal range is 10-15. Proceed?`)) return;
    }

    const queued_at = new Date().toISOString();
    const id = `vid_${Date.now()}`;

    const newItem: YoutubeQueueItem = {
      id,
      projectId: selectedProject.id,
      projectType: selectedProject.type,
      metadata: {
        title: queueTitle,
        description: queueDesc,
        tags: tagArray,
        privacy_status: queuePrivacy
      },
      status: 'pending',
      progress: 0,
      system_note: validation.note,
      addedAt: Date.now(),
      queued_at
    };

    // Return structured JSON Object for "Backend processing" (Console & Log)
    const backendPayload = {
      action: "add_to_queue",
      queue_item: {
        id: newItem.id,
        file_path: `/output/rendered/${selectedProject.id}.mp4`,
        metadata: newItem.metadata,
        status: newItem.status,
        system_note: newItem.system_note,
        queued_at: newItem.queued_at
      }
    };

    console.log("Structured Queue Item ready for backend processing:", backendPayload);
    addLog(`[Pipeline] New item queued: ${newItem.metadata.title}`);
    addLog(`[Pipeline] Note: ${newItem.system_note}`);

    try {
      await addToQueue(newItem);
      refreshQueue();
      setIsQueueModalOpen(false);
      setSelectedProject(null);
    } catch (e) {
      alert("Failed to add to queue");
    }
  };

  const handleRetryItem = async (itemId: string) => {
    try {
      await updateQueueItem(itemId, { status: 'pending', error: undefined, progress: 0 });
      refreshQueue();
    } catch (e) {
      alert("Retry failed");
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'shorts': return <Video size={14} />;
      case 'long': return <Clapperboard size={14} />;
      case 'podcast': return <Mic size={14} />;
      default: return <Zap size={14} />;
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-32">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-10 rounded-[4rem] shadow-2xl relative overflow-hidden ring-1 ring-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 relative z-10">
          <div className="flex items-center gap-8">
            <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-2xl transition-all duration-700 ${isPassiveMode ? 'bg-orange-600 shadow-orange-900/50' : 'bg-slate-800'}`}>
              <Radio size={48} className={isPassiveMode ? "animate-pulse text-white" : "text-slate-500"} />
            </div>
            <div>
              <h2 className="text-5xl font-black text-white uppercase tracking-tighter">Autonomous Studio</h2>
              <p className="text-sm text-red-500 font-black uppercase tracking-[0.4em] flex items-center gap-2 mt-1">
                <Zap size={14} fill="currentColor" /> {isQuotaLimited ? 'QUOTA HALT' : currentAction}
              </p>
            </div>
          </div>
          {isQuotaLimited && (
             <div className="bg-orange-600/20 border border-orange-500/30 px-6 py-3 rounded-2xl flex items-center gap-3 animate-bounce">
                <AlertTriangle className="text-orange-500" size={20} />
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Daily API Quota Depleted</span>
             </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Auth & Channel Info */}
        <div className="lg:col-span-7">
          <div className="bg-slate-900 border border-slate-800 p-12 rounded-[4rem] shadow-2xl min-h-[480px] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none rotate-12">
               <Youtube size={200} fill="currentColor" />
            </div>

            {!profile ? (
              <div className="space-y-10 relative z-10">
                <div className="flex items-center gap-6">
                  <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center border shadow-3xl ${isQuotaLimited ? 'bg-orange-600/10 text-orange-500 border-orange-500/20' : 'bg-red-600/10 text-red-500 border-red-500/20'}`}>
                    {isQuotaLimited ? <AlertTriangle size={36} /> : <Key size={36} />}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight">{isQuotaLimited ? 'Quota Restricted' : 'OAuth Authentication'}</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                      Connect your YouTube channel to enable auto-uploads
                    </p>
                  </div>
                </div>

                {authError && (
                  <div className={`border p-6 rounded-[2.5rem] flex flex-col gap-4 animate-in shake-1 duration-300 ${isQuotaLimited ? 'bg-orange-500/10 border-orange-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <div className="flex items-start gap-4">
                      {isQuotaLimited ? <AlertTriangle className="text-orange-500 shrink-0 mt-1" size={24} /> : <AlertCircle className="text-red-500 shrink-0 mt-1" size={24} />}
                      <div className="flex-1">
                        <h4 className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isQuotaLimited ? 'text-orange-500' : 'text-red-500'}`}>
                          {isQuotaLimited ? 'System Halted: Quota Exceeded' : 'Authorization Protocol Failed'}
                        </h4>
                        <p className="text-slate-300 text-sm font-medium leading-relaxed font-kanit italic">{authError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {!loadingProfile && !isQuotaLimited && (
                  <div className="bg-slate-950 p-10 rounded-[3rem] border border-slate-800 space-y-8 shadow-inner">
                    <div>
                      <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-4 ml-1">Paste Temporary OAuth Access Token</label>
                      <input
                        type="text" value={token} onChange={(e) => setToken(e.target.value)}
                        placeholder="Bearer token..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white text-base font-mono outline-none focus:ring-2 focus:ring-red-600/50 transition-all shadow-inner"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <a
                        href="https://developers.google.com/oauthplayground/#step1&apisSelect=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.upload&url=https%3A%2F%2F&content_type=application%2Fjson&http_method=GET&useDefaultOauthCred=checked"
                        target="_blank" rel="noreferrer"
                        className="flex-1 py-5 bg-slate-800 text-slate-300 rounded-[2rem] font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 flex items-center justify-center gap-2 border border-slate-700 active:scale-95 transition-all shadow-lg"
                      >
                        <ExternalLink size={14} /> Get Token via Playground
                      </a>
                      <button onClick={saveToken} className="flex-[2] py-5 bg-red-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest hover:bg-red-500 shadow-xl shadow-red-900/40 active:scale-95 transition-all">
                        Initialize Channel Connection
                      </button>
                    </div>
                  </div>
                )}

                {loadingProfile && (
                  <div className="py-20 flex flex-col items-center gap-8">
                    <div className="relative">
                      <Loader2 size={64} className="text-red-600 animate-spin" strokeWidth={3} />
                      <Youtube size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-white uppercase tracking-[0.3em] animate-pulse">Establishing Secure Uplink</p>
                      <p className="text-[10px] text-slate-600 font-bold uppercase mt-2">Synchronizing Channel Metadata...</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-12 h-full flex flex-col relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Channel Node Active</h2>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => fetchProfile(localStorage.getItem('yt_access_token') || '')} className="p-4 bg-slate-800 text-slate-400 rounded-2xl hover:text-white transition shadow-lg border border-slate-750">
                      <RefreshCw size={24} className={loadingProfile ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={clearToken} className="p-4 bg-slate-800 text-slate-400 rounded-2xl hover:text-red-500 transition shadow-lg border border-slate-750">
                      <LogOut size={24} />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 p-10 rounded-[3rem] border border-red-600/20 flex flex-col md:flex-row items-center gap-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]"></div>
                  <div className="relative shrink-0">
                    <img src={profile.snippet.thumbnails.high.url} className="w-40 h-40 rounded-full border-[8px] border-slate-900 object-cover shadow-3xl" alt="Avatar" />
                    <div className="absolute bottom-2 right-2 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center border-4 border-slate-900">
                      <Youtube size={16} fill="white" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-6 text-center md:text-left w-full">
                    <div>
                      <h3 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">{profile.snippet.title}</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-3 flex items-center justify-center md:justify-start gap-2">
                         <Globe size={12} className="text-slate-700"/> Broadcast Locale: {profile.snippet.country || 'Global'}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
                        <Users size={16} className="text-red-600 mx-auto mb-2" />
                        <div className="text-lg font-black text-white leading-none">{formatNumber(profile.statistics.subscriberCount)}</div>
                        <div className="text-[8px] font-black text-slate-600 uppercase mt-1 tracking-widest">Subscribers</div>
                      </div>
                      <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
                        <PlaySquare size={16} className="text-red-600 mx-auto mb-2" />
                        <div className="text-lg font-black text-white leading-none">{formatNumber(profile.statistics.videoCount)}</div>
                        <div className="text-[8px] font-black text-slate-600 uppercase mt-1 tracking-widest">Broadcasts</div>
                      </div>
                      <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
                        <Eye size={16} className="text-red-600 mx-auto mb-2" />
                        <div className="text-lg font-black text-white leading-none">{formatNumber(profile.statistics.viewCount)}</div>
                        <div className="text-[8px] font-black text-slate-600 uppercase mt-1 tracking-widest">Total Reach</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-auto pt-8 border-t border-slate-800 flex gap-4">
                   <button 
                    onClick={() => { setShowLibrary(!showLibrary); if (!showLibrary) fetchLibrary(); }}
                    className={`flex-1 py-6 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-4 border shadow-xl active:scale-95 ${showLibrary ? 'bg-purple-600 text-white border-purple-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'}`}
                   >
                     <Library size={20} /> {showLibrary ? 'Close Archives' : 'Source Library Data'}
                   </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Logs */}
        <div className="lg:col-span-5 flex flex-col gap-10">
          <div className="bg-slate-900 border border-slate-800 p-10 rounded-[4rem] shadow-2xl flex-1 flex flex-col relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 p-8 opacity-5 pointer-events-none -rotate-12">
               <Terminal size={180} />
            </div>
            <div className="flex items-center justify-between mb-10 relative z-10">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-purple-600/10 rounded-2xl flex items-center justify-center text-purple-400 border border-purple-500/20">
                   <Terminal size={24} />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">System Monitor</h3>
              </div>
              <div className="px-4 py-1.5 bg-slate-950 rounded-full border border-slate-800 text-[8px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Real-time Stream</div>
            </div>
            <div className="flex-1 bg-slate-950 rounded-[2.5rem] border border-slate-800 p-8 font-mono text-[10px] space-y-4 overflow-y-auto max-h-[450px] scrollbar-thin scrollbar-thumb-slate-800 shadow-inner relative z-10">
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-4 border-l-2 pl-4 transition-all duration-500 ${i === 0 ? 'text-emerald-400 border-emerald-500 translate-x-1' : 'text-slate-500 border-slate-900 opacity-60'}`}>
                  <span className="shrink-0 text-slate-700">[{i}]</span>
                  {log}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-slate-800 italic uppercase font-black text-center py-20 opacity-30 tracking-widest">No Log Packets Received</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Project Library Browser */}
      {showLibrary && (
        <div className="bg-slate-900 border border-slate-800 p-12 rounded-[5rem] shadow-3xl animate-in fade-in slide-in-from-top-6 duration-500 relative ring-1 ring-slate-800">
          <div className="flex items-center justify-between mb-12 border-b border-slate-800 pb-10">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-purple-600/10 rounded-3xl flex items-center justify-center text-purple-400 border border-purple-500/20 shadow-inner">
                 <Library size={32} />
              </div>
              <div>
                <h3 className="text-4xl font-black text-white uppercase tracking-tight">Project Node Archives</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-2">Select generated node for deployment</p>
              </div>
            </div>
            <button onClick={fetchLibrary} className="p-4 bg-slate-800 text-slate-400 rounded-2xl hover:text-white transition shadow-xl border border-slate-750 active:scale-90">
              <RefreshCw size={24} className={isRefreshingLibrary ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {localProjects.map(proj => {
              const isReady = proj.script?.scenes?.every((s: any) => s.status === 'completed');
              return (
                <div key={proj.id} className={`bg-slate-950 border p-10 rounded-[3.5rem] hover:border-purple-600/50 transition-all group relative overflow-hidden shadow-2xl flex flex-col h-full ${isReady ? 'ring-1 ring-emerald-500/20' : 'border-slate-800'}`}>
                  <div className="flex justify-between items-start mb-8">
                     <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-full border border-slate-800 text-[9px] font-black text-slate-500 uppercase tracking-widest shadow-inner group-hover:text-purple-400 transition-colors">
                        {getTypeIcon(proj.type)} {proj.type}
                     </div>
                     <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${isReady ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-600 border border-slate-800'}`}>
                        {isReady ? 'Ready for Deployment' : 'Draft Node'}
                     </span>
                  </div>
                  <h4 className="text-2xl font-black text-white line-clamp-1 mb-4 uppercase tracking-tighter group-hover:text-purple-400 transition-colors">{proj.title}</h4>
                  <p className="text-sm text-slate-500 line-clamp-3 mb-10 font-kanit italic font-medium leading-relaxed">{proj.topic}</p>
                  <div className="mt-auto">
                    <button 
                      onClick={() => handleOpenQueueModal(proj)}
                      className="w-full py-5 bg-slate-900 text-slate-300 rounded-[2rem] font-black uppercase text-[11px] tracking-widest border border-slate-800 hover:bg-purple-600 hover:text-white hover:border-purple-500 transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95"
                    >
                      <PlusCircle size={20} /> Deploy to Pipeline
                    </button>
                  </div>
                </div>
              );
            })}
            {localProjects.length === 0 && (
              <div className="col-span-full py-40 text-center flex flex-col items-center gap-8">
                <div className="w-24 h-24 rounded-full bg-slate-800/30 border-4 border-dashed border-slate-800 flex items-center justify-center text-slate-700">
                   <Library size={48} />
                </div>
                <div>
                   <p className="text-slate-600 text-2xl font-black uppercase tracking-[0.4em]">Local Archive Dormant</p>
                   <p className="text-slate-700 text-xs font-bold uppercase tracking-widest mt-2">Initialize a Creator Engine to populate data</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Autonomous Pipeline (Queue) */}
      <div className="bg-slate-900 border border-slate-800 p-16 rounded-[6rem] shadow-4xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none">
           <Zap size={300} fill="currentColor" />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-12 mb-20 border-b border-slate-800 pb-16 relative z-10">
          <div className="flex items-center gap-10">
            <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center shadow-3xl transition-all duration-1000 ${isPassiveMode ? 'bg-orange-600 shadow-orange-900/40 rotate-12' : 'bg-slate-800'}`}>
              <Zap size={56} className={isPassiveMode ? 'text-white' : 'text-slate-500'} fill="currentColor" />
            </div>
            <div>
              <h3 className="text-5xl font-black text-white uppercase tracking-tighter">Autonomous Pipeline</h3>
              <p className="text-base text-slate-500 font-bold uppercase tracking-[0.3em] mt-2">{queue.length} Production Tasks in Loop</p>
            </div>
          </div>
          <button 
            onClick={togglePassiveMode} 
            disabled={queue.length === 0 || isQuotaLimited} 
            className={`px-16 py-8 rounded-[3rem] text-sm font-black uppercase tracking-[0.4em] transition-all shadow-2xl active:scale-95 disabled:opacity-50 group relative overflow-hidden ${isPassiveMode ? 'bg-orange-600 text-white animate-pulse' : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105'}`}
          >
            {isPassiveMode ? (
              <span className="flex items-center gap-4"><Loader2 size={24} className="animate-spin" /> Core Overload Override</span>
            ) : (
              <span className="flex items-center gap-4"><Send size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> Engage Neural Autopilot</span>
            )}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 relative z-10">
          {queue.map((item) => (
            <div key={item.id} className={`bg-slate-950 border p-12 rounded-[4rem] transition-all duration-700 relative group overflow-hidden ${item.status === 'generating' || item.status === 'rendering' || item.status === 'uploading' ? 'border-orange-500 ring-4 ring-orange-500/10 shadow-orange-900/20' : item.status === 'error' ? 'border-red-600/50' : 'border-slate-800 shadow-2xl'}`}>
              {item.status === 'uploading' && (
                <div className="absolute inset-0 bg-orange-600/5 animate-pulse pointer-events-none"></div>
              )}
              <div className="flex justify-between items-start mb-10">
                <div className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border shadow-2xl transition-colors ${item.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : item.status === 'error' ? 'bg-red-600/20 text-red-500 border-red-500/30' : 'bg-orange-600/10 text-orange-400 border-orange-400/30'}`}>
                  {item.status === 'uploading' ? 'SYNCING BROADCAST' : item.status}
                </div>
                <div className="flex gap-2">
                  {item.status === 'error' && (
                    <button onClick={() => handleRetryItem(item.id)} className="text-orange-500 hover:text-orange-400 transition-all p-2 active:scale-90 bg-slate-900/50 rounded-xl border border-slate-800">
                      <RefreshCw size={20} />
                    </button>
                  )}
                  <button onClick={() => { if(confirm("Terminate task lifecycle?")) removeFromQueue(item.id).then(refreshQueue); }} className="text-slate-800 hover:text-red-500 transition-all p-2 active:scale-90 bg-slate-900/50 rounded-xl border border-slate-800">
                    <Trash2 size={22} />
                  </button>
                </div>
              </div>
              <h4 className="text-2xl font-black text-white line-clamp-2 mb-10 uppercase font-kanit tracking-tighter leading-tight group-hover:text-orange-400 transition-colors">{item.metadata?.title}</h4>
              <div className="space-y-6">
                <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden p-1 border border-slate-800 shadow-inner">
                  <div className={`h-full rounded-full transition-all duration-1000 ${item.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]' : item.status === 'error' ? 'bg-red-600' : 'bg-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.6)]'}`} style={{ width: `${item.progress}%` }}></div>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500 tracking-widest">
                  <span className="flex items-center gap-3">
                    {item.status === 'completed' ? <CheckCircle2 size={16} className="text-emerald-500" /> : item.status === 'error' ? <AlertCircle size={16} className="text-red-500" /> : <Loader2 size={16} className="animate-spin text-orange-500" />} 
                    <span className={item.status === 'completed' ? 'text-emerald-500' : item.status === 'error' ? 'text-red-500' : 'text-orange-400'}>{item.status === 'uploading' ? 'Publishing...' : item.status === 'completed' ? 'Successfully Broadcasted' : item.status === 'error' ? 'Task Failure' : 'Processing Task'}</span>
                  </span>
                  <span className="text-white font-mono text-xs">{item.progress}%</span>
                </div>
                {item.error && (
                  <p className="text-[10px] text-red-400 font-medium font-kanit leading-tight line-clamp-2 mt-2 italic">Error: {item.error}</p>
                )}
                {item.videoBlob && (
                   <div className="flex items-center gap-2 mt-2 text-[9px] text-emerald-500 font-black uppercase tracking-widest">
                      <FileVideo size={12}/> Local Cache Segment Attached
                   </div>
                )}
              </div>
            </div>
          ))}
          {queue.length === 0 && (
            <div className="col-span-full py-40 text-center flex flex-col items-center gap-10 bg-slate-950/40 rounded-[5rem] border-4 border-dashed border-slate-800/50">
               <div className="w-32 h-32 bg-slate-900 rounded-[3rem] flex items-center justify-center text-slate-800 shadow-inner group">
                  <PlusCircle size={64} className="group-hover:text-slate-700 transition-colors" />
               </div>
               <div>
                  <p className="text-slate-600 text-3xl font-black uppercase tracking-[0.5em]">Pipeline Standby</p>
                  <p className="text-slate-700 text-sm font-bold uppercase tracking-[0.2em] mt-4">Awaiting Task Assignment in Local Node archives</p>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Queue Task Configuration Modal */}
      {isQueueModalOpen && selectedProject && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/98 backdrop-blur-3xl p-6 animate-in fade-in duration-500">
          <div className="bg-slate-900 border border-slate-800 rounded-[5rem] w-full max-w-2xl p-16 relative shadow-4xl ring-1 ring-slate-700 flex flex-col max-h-[90vh] overflow-hidden">
            <button onClick={() => setIsQueueModalOpen(false)} className="absolute top-12 right-12 text-slate-500 hover:text-white transition p-2 active:scale-90 z-20"><X size={40}/></button>
            
            <div className="flex items-center gap-8 mb-16 relative z-10">
               <div className="w-20 h-20 rounded-[2rem] bg-orange-600/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shadow-inner">
                  <Zap size={40} fill="currentColor" />
               </div>
               <div>
                  <h3 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Task Initialization</h3>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-3">Readying Protocol for Autonomous Loop</p>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-6 space-y-10 scrollbar-thin scrollbar-thumb-slate-800 relative z-10">
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                    <FileText size={14} className="text-orange-500"/> Catchy SEO Title (Max 100)
                  </label>
                  <input 
                    type="text" value={queueTitle} onChange={(e) => setQueueTitle(e.target.value)} maxLength={100}
                    className="w-full bg-slate-950 border border-slate-800 rounded-3xl p-6 text-white text-xl font-kanit outline-none focus:ring-4 focus:ring-orange-600/10 transition-all shadow-inner"
                  />
                  <div className="flex justify-between px-2">
                    <span className="text-[8px] font-black text-slate-600 uppercase">Requirement: Under 100 characters</span>
                    <span className={`text-[10px] font-black ${queueTitle.length > 95 ? 'text-red-500' : 'text-orange-500'}`}>{queueTitle.length}/100</span>
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                    <Hash size={14} className="text-orange-500"/> High-Relevance Tags (10-15 keywords)
                  </label>
                  <input 
                    type="text" value={queueTags} onChange={(e) => setQueueTags(e.target.value)} placeholder="keyword1, keyword2, keyword3..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 text-white text-sm font-mono outline-none focus:ring-4 focus:ring-orange-600/10 transition-all shadow-inner"
                  />
                  <div className="flex justify-between px-2">
                    <span className="text-[8px] font-black text-slate-600 uppercase">Optimal: 10 to 15 keywords</span>
                    <span className="text-[10px] font-black text-orange-500">{queueTags.split(',').filter(t => t.trim()).length} Tags</span>
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                    <Globe size={14} className="text-orange-500"/> Broadcast Privacy Status
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { id: 'private', label: 'Private', icon: <Lock size={16} /> },
                      { id: 'unlisted', label: 'Unlisted', icon: <EyeOff size={16} /> },
                      { id: 'public', label: 'Public', icon: <Globe size={16} /> },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setQueuePrivacy(opt.id as any)}
                        className={`py-6 rounded-3xl text-[10px] font-black uppercase flex flex-col items-center gap-3 border transition-all duration-300 shadow-lg active:scale-95 ${queuePrivacy === opt.id ? 'bg-orange-600 border-orange-500 text-white scale-105 shadow-orange-900/30' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                    <AlignLeft size={14} className="text-orange-500"/> Summary & Narrative (Hook/Summary/#Tags)
                  </label>
                  <textarea 
                    value={queueDesc} onChange={(e) => setQueueDesc(e.target.value)} maxLength={5000}
                    className="w-full bg-slate-950 border border-slate-800 rounded-[2.5rem] p-8 text-slate-300 text-sm font-kanit h-48 outline-none focus:ring-4 focus:ring-orange-600/10 transition-all resize-none shadow-inner scrollbar-thin scrollbar-thumb-slate-800 leading-relaxed italic"
                  />
                  <div className="flex justify-end px-2">
                    <span className={`text-[10px] font-black ${queueDesc.length > 4500 ? 'text-red-500' : 'text-orange-500'}`}>{queueDesc.length}/5000</span>
                  </div>
               </div>
            </div>

            <div className="pt-12 border-t border-slate-800 mt-10 relative z-10">
               <button 
                onClick={handleAddToQueue}
                className="w-full py-8 bg-orange-600 text-white rounded-[3rem] font-black uppercase text-base tracking-[0.4em] hover:bg-orange-500 transition-all shadow-2xl shadow-orange-900/50 active:scale-[0.98] flex items-center justify-center gap-6 group"
               >
                 <PlusCircle size={28} className="group-hover:rotate-90 transition-transform duration-500" /> Confirm Deployment Pipeline
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YoutubeManager;
