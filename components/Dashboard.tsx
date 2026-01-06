
import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, DollarSign, Video, Eye, Loader2, Calendar, 
  Activity, Zap, CheckCircle2, Clock, AlertCircle, 
  X, BarChart3, Youtube, Users, ShieldCheck,
  ArrowUpRight, Target, Share2, Cpu, Layers, HardDrive,
  Trophy, History as HistoryIcon, ArrowRight, RefreshCw,
  Film, FileVideo, ChevronRight
} from 'lucide-react';
import { listProjects, ProjectData, YoutubeQueueItem } from '../services/projectService';
import { getYouTubeChannelProfile, getYouTubeActivities } from '../services/youtubeService';
import { useAutomation } from '../contexts/AutomationContext';

const Dashboard: React.FC = () => {
  const { queue, logs, isPassiveMode, isQuotaLimited } = useAutomation();
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [ytStats, setYtStats] = useState<any>(null);
  const [geminiUsage, setGeminiUsage] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [allProjects, savedUsage] = await Promise.all([
          listProjects(),
          localStorage.getItem('gemini-usage-count')
        ]);
        setProjects(allProjects);
        setGeminiUsage(parseInt(savedUsage || '0'));

        const token = localStorage.getItem('yt_access_token');
        if (token) {
          const profile = await getYouTubeChannelProfile(token);
          const activities = await getYouTubeActivities(token);
          setYtStats({
            views: parseInt(profile.statistics.viewCount),
            subs: parseInt(profile.statistics.subscriberCount),
            videos: parseInt(profile.statistics.videoCount),
            estRevenue: parseInt(profile.statistics.viewCount) * 0.0012,
            recentUploads: activities.filter((a: any) => a.snippet.type === 'upload'),
            history: JSON.parse(localStorage.getItem('yt_upload_history') || '[]')
          });
        }
      } catch (error) {
        console.error("Dashboard Sync Failed", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatNumber = (num: number) => Intl.NumberFormat('en-US', { notation: "compact" }).format(num);

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-500 gap-6">
        <Loader2 className="animate-spin text-purple-500" size={48} strokeWidth={3} />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Syncing Neural Network...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-20">
       
       {/* Status Badges */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl relative overflow-hidden group">
             <div className="w-12 h-12 rounded-2xl bg-orange-600/10 text-orange-500 flex items-center justify-center mb-6 border border-orange-500/20">
                <Zap size={24} fill="currentColor" className={isPassiveMode ? "animate-pulse" : ""} />
             </div>
             <div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Automation Engine</p>
                <p className={`text-2xl font-black uppercase tracking-tighter mt-1 ${isPassiveMode ? 'text-orange-400' : 'text-slate-500'}`}>
                   {isPassiveMode ? 'Auto-Pilot Active' : 'Manual Control'}
                </p>
             </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl">
             <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 text-emerald-500 flex items-center justify-center mb-6 border border-emerald-500/20">
                <DollarSign size={24} />
             </div>
             <div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Est. Net Revenue</p>
                <p className="text-3xl font-black text-white tracking-tighter mt-1">${ytStats ? formatNumber(ytStats.estRevenue) : '0.00'}</p>
             </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl">
             <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-500 flex items-center justify-center mb-6 border border-blue-500/20">
                <Users size={24} />
             </div>
             <div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Subscribers</p>
                <p className="text-3xl font-black text-white tracking-tighter mt-1">{ytStats ? formatNumber(ytStats.subs) : '0'}</p>
             </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl">
             <div className="w-12 h-12 rounded-2xl bg-purple-600/10 text-purple-400 flex items-center justify-center mb-6 border border-purple-500/20">
                <Layers size={24} />
             </div>
             <div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Production Nodes</p>
                <p className="text-3xl font-black text-white tracking-tighter mt-1">{projects.length}</p>
             </div>
          </div>
       </div>

       {/* Autonomous Pipeline - Main Focus */}
       <div className="bg-[#0b1222] border border-slate-800 rounded-[4rem] shadow-4xl overflow-hidden flex flex-col ring-1 ring-white/5">
          <div className="p-10 border-b border-white/5 bg-white/2 flex items-center justify-between">
             <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-orange-600/10 rounded-2xl flex items-center justify-center text-orange-500 border border-orange-500/20 shadow-inner">
                   <Activity size={28} />
                </div>
                <div>
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Autonomous Pipeline</h3>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-1.5">Real-time production monitoring</p>
                </div>
             </div>
             <div className="px-8 py-3 bg-slate-800/40 rounded-2xl border border-white/5 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                {queue.length} Nodes In Queue
             </div>
          </div>
          
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-white/2 text-slate-600 uppercase text-[10px] font-black tracking-[0.3em] border-b border-white/5">
                      <th className="py-8 px-12">Sync Identity</th>
                      <th className="py-8 px-6 text-center">Engine Logic</th>
                      <th className="py-8 px-6">Processing Loop</th>
                      <th className="py-8 px-12 text-right">Synchronization Status</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                   {queue.length === 0 ? (
                     <tr>
                        <td colSpan={4} className="py-32 text-center text-slate-700 font-black uppercase tracking-[0.6em] italic text-sm">
                           Pipeline Core Empty • Awaiting Target Protocol
                        </td>
                     </tr>
                   ) : (
                     queue.map((item) => (
                        <tr key={item.id} className="hover:bg-white/[0.03] transition-all group">
                           <td className="py-8 px-12">
                              <div className="flex items-center gap-5">
                                 <div className={`w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-600 transition-all duration-500 group-hover:border-orange-500/40 group-hover:text-orange-500 shadow-inner ${item.status === 'generating' || item.status === 'rendering' ? 'animate-pulse' : ''}`}>
                                    {item.projectType === 'shorts' ? <Video size={20} /> : <Film size={20} />}
                                 </div>
                                 <div>
                                    <div className="text-base font-black text-white group-hover:text-orange-400 transition-colors uppercase tracking-tight line-clamp-1 max-w-md">
                                       {item.metadata?.title || 'System Protocol Task'}
                                    </div>
                                    <div className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em] mt-1.5 flex items-center gap-3">
                                       ID: {item.id.slice(-10)} 
                                       {item.metadata?.publish_at && (
                                         <span className="text-blue-500 flex items-center gap-1.5 border-l border-white/10 pl-3">
                                           <Clock size={10}/> Scheduled
                                         </span>
                                       )}
                                    </div>
                                 </div>
                              </div>
                           </td>
                           <td className="py-8 px-6 text-center">
                              <div className="inline-flex flex-col gap-1 items-center">
                                 <span className="px-4 py-2 rounded-xl bg-slate-900 border border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-white group-hover:bg-slate-800 transition-all">
                                    {item.projectType}
                                 </span>
                                 <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Core Engine</span>
                              </div>
                           </td>
                           <td className="py-8 px-6">
                              <div className="flex flex-col gap-3 w-48">
                                 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-600">
                                    <span>Depth</span>
                                    <span className="text-white font-mono">{item.progress}%</span>
                                 </div>
                                 <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-white/5">
                                    <div 
                                       className="h-full bg-gradient-to-r from-orange-600 to-yellow-500 rounded-full shadow-[0_0_15px_rgba(234,88,12,0.4)] transition-all duration-1000 ease-out" 
                                       style={{ width: `${item.progress}%` }}
                                    ></div>
                                 </div>
                              </div>
                           </td>
                           <td className="py-8 px-12 text-right">
                              <div className="flex flex-col items-end gap-2">
                                 <span className={`px-6 py-2 rounded-2xl text-[10px] font-black uppercase border tracking-[0.2em] shadow-lg transition-all ${
                                    item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                    item.status === 'error' ? 'bg-red-600/10 text-red-400 border-red-500/20' : 
                                    'bg-orange-600/10 text-orange-400 border-orange-500/20 animate-pulse'
                                 }`}>
                                    {item.status === 'uploading' ? 'Broadcasting...' : item.status}
                                 </span>
                                 {item.error ? (
                                    <span className="text-[9px] text-red-500/80 font-bold uppercase tracking-widest italic max-w-[200px] truncate">
                                       Error: {item.error}
                                    </span>
                                 ) : (
                                    <span className="text-[9px] text-slate-700 font-bold uppercase tracking-widest">
                                       Added: {new Date(item.addedAt).toLocaleTimeString()}
                                    </span>
                                 )}
                              </div>
                           </td>
                        </tr>
                     ))
                   )}
                </tbody>
             </table>
          </div>
          <div className="p-10 bg-white/[0.01] border-t border-white/5 flex items-center justify-center">
             <button className="group flex items-center gap-4 text-[11px] font-black text-slate-500 hover:text-white uppercase tracking-[0.5em] transition-all">
                Full Production Protocol <ArrowRight size={16} className="group-hover:translate-x-3 transition-transform duration-500"/>
             </button>
          </div>
       </div>

       {/* Neural Telemetry Stream */}
       <div className="bg-slate-900 border border-slate-800 p-10 rounded-[4rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-10 ring-1 ring-white/5">
          <div className="flex items-center gap-8">
             <div className="w-16 h-16 bg-slate-950 rounded-3xl flex items-center justify-center text-slate-600 border border-white/5 shadow-inner">
                <Cpu size={32} />
             </div>
             <div>
                <p className="text-[11px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-4">
                   Neural Telemetry Stream 
                   <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                   </span>
                </p>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest font-mono mt-2 opacity-80 max-w-xl truncate">
                   {logs[0] || 'Awaiting initial telemetry packets from production clusters...'}
                </p>
             </div>
          </div>
          <button className="px-10 py-5 bg-slate-800 text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] border border-white/5 hover:bg-slate-750 hover:text-white transition-all shadow-2xl active:scale-95">
             Analyze Event History
          </button>
       </div>
    </div>
  );
};

export default Dashboard;
