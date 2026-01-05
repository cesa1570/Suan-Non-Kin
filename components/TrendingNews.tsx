
import React, { useState, useCallback, useEffect } from 'react';
import { Flame, RefreshCw, Globe, MapPin, Search, Video, X, Clock, Calendar, Eye, Bot, Sparkles, TrendingUp, Zap, BarChart3, AlertCircle, Radio, Activity, ChevronRight, Clapperboard } from 'lucide-react';
import { fetchTrendingNews } from '../services/geminiService';
import { NewsItem } from '../types';

// Fix: Removed apiKey from TrendingNewsProps
interface TrendingNewsProps {
  news: NewsItem[];
  setNews: (items: NewsItem[]) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
  region: 'global' | 'thailand';
  setRegion: (r: 'global' | 'thailand') => void;
  onSelectTopic: (topic: string, type: 'video' | 'social' | 'podcast', region: 'global' | 'thailand', autoPilot?: boolean) => void;
}

const CATEGORIES = [
  { id: 'All', label: '🔥 All Trends' }, { id: 'Physics', label: '⚛️ Science' }, { id: 'Horror', label: '👻 Mystery' },
  { id: 'Technology', label: '💻 Tech' }, { id: 'History', label: '📜 History' }, { id: 'Entertainment', label: '🎬 Ent' },
  { id: 'True Crime', label: '🔪 Crime' },
];

const TrendingNews: React.FC<TrendingNewsProps> = ({ news, setNews, loading, setLoading, region, setRegion, onSelectTopic }) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchTrendingNews(region, activeCategory, searchQuery);
      setNews(items);
      if (items.length === 0) setError("No news found for this criteria.");
    } catch (err: any) {
      console.error("Failed to fetch news:", err);
      setError("Intelligence uplink failure. Re-scanning recommended.");
    } finally {
      setLoading(false);
    }
  }, [region, activeCategory, searchQuery, setNews, setLoading]);

  useEffect(() => {
    if (news.length === 0) loadNews();
  }, [news.length, loadNews]);

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') loadNews();
  };

  return (
    <div className="space-y-10">
      {/* Control Panel */}
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3.5rem] shadow-2xl space-y-8 relative overflow-hidden ring-1 ring-slate-800">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none rotate-12">
           <Activity size={120} />
        </div>

        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 relative z-10">
            <div>
              <h2 className="text-3xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
                <div className="w-12 h-12 bg-orange-600/20 rounded-2xl flex items-center justify-center text-orange-500 shadow-inner border border-orange-500/20">
                   <Flame fill="currentColor" size={24} />
                </div>
                Trending Intelligence
              </h2>
              <p className="text-slate-500 text-[10px] mt-2 uppercase tracking-[0.3em] font-black ml-1">V4 Neural Growth Analytics & Viral Momentum</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                  <button onClick={() => setRegion('thailand')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${region === 'thailand' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}><MapPin size={14} className="text-red-400" /> TH</button>
                  <button onClick={() => setRegion('global')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${region === 'global' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}><Globe size={14} className="text-blue-400" /> WW</button>
              </div>
              <button onClick={loadNews} disabled={loading} className="p-4 bg-purple-600 rounded-2xl text-white hover:bg-purple-500 transition shadow-xl active:scale-95 group disabled:opacity-50">
                <RefreshCw size={24} className={`${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              </button>
            </div>
        </div>
        <div className="relative">
          <Search className="absolute left-6 top-6 text-slate-500" size={24} />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={handleSearch} placeholder="Search viral nodes (e.g. Prehistoric discovery, AI breakthroughs)..." className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] py-6 pl-16 pr-12 text-slate-200 text-xl outline-none focus:ring-4 focus:ring-purple-600/10 shadow-inner font-kanit placeholder:text-slate-800" />
        </div>
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase whitespace-nowrap border transition-all ${activeCategory === cat.id ? 'bg-purple-600 border-purple-500 text-white shadow-xl' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}>{cat.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{[1, 2, 3, 4, 5, 6].map(i => (<div key={i} className="h-[480px] bg-slate-900/40 rounded-[3rem] animate-pulse border border-slate-800"></div>))}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {news.map((item, idx) => (
            <div key={idx} className="group bg-[#0d1525] border border-slate-800/80 hover:border-purple-600/50 rounded-[3.5rem] p-10 transition-all duration-500 cursor-pointer flex flex-col h-full shadow-2xl relative overflow-hidden hover:shadow-purple-500/10" onClick={() => setSelectedItem(item)}>
              
              <div className="flex justify-between items-center mb-10">
                <span className="text-[10px] font-black uppercase tracking-widest px-5 py-2 rounded-full border bg-slate-950 text-slate-400 border-slate-800 group-hover:text-purple-400 transition-colors">
                  {item.category.replace('/', ' / ')}
                </span>
                <div className="flex items-center gap-2.5 px-5 py-2 rounded-full bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-[0.2em] shadow-lg group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500">
                  <Zap size={12} fill="currentColor" className="animate-pulse" /> Active
                </div>
              </div>

              <h3 className="text-xl font-black text-white leading-snug mb-6 font-kanit group-hover:text-purple-400 transition-colors uppercase tracking-tight line-clamp-2">
                {item.headline}
              </h3>
              
              <p className="text-sm text-slate-500 line-clamp-4 mb-10 font-medium font-kanit leading-relaxed flex-1 group-hover:text-slate-300 transition-colors">
                {item.summary}
              </p>
              
              <div className="space-y-10">
                {/* Viral Hot Meter */}
                <div className="space-y-4">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-600 group-hover:text-slate-400 transition-colors">Viral Hot Meter</span>
                      <span className="text-emerald-500 group-hover:text-emerald-400 transition-colors">% Intensity</span>
                   </div>
                   <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 group-hover:border-slate-700 transition-colors">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-all duration-1000" style={{ width: `${item.virality_score || 72}%` }}></div>
                   </div>
                </div>

                {/* Velocity Stats */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-800/50 pt-8 group-hover:border-purple-600/20 transition-colors">
                   <div className="space-y-1.5">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Velocity</span>
                      <div className="flex items-center gap-2">
                         <TrendingUp size={16} className="text-emerald-500" />
                         <span className="text-lg font-black text-white">{item.velocity || '+12%'}</span>
                      </div>
                   </div>
                   <div className="text-right space-y-1.5">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Reach Est.</span>
                      <div className="flex items-center justify-end gap-2">
                         <Eye size={16} className="text-blue-500" />
                         <span className="text-lg font-black text-white">{item.est_reach || '100K'}</span>
                      </div>
                   </div>
                </div>
              </div>

              {/* Hover Button Overlay */}
              <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center p-8 backdrop-blur-md">
                 <div className="w-16 h-16 rounded-3xl bg-purple-600 text-white flex items-center justify-center mb-8 shadow-3xl transform group-hover:scale-110 transition-transform duration-500">
                    <Zap size={32} fill="currentColor" />
                 </div>
                 <p className="text-center text-white font-black uppercase text-xs tracking-[0.3em] mb-10">Neural Topic Synchronized</p>
                 <button className="w-full py-5 bg-white text-slate-900 rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all mb-4">Initialize Studio Protocol</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 backdrop-blur-3xl p-6 animate-in fade-in duration-500">
              <div className="bg-[#0a101f] border border-slate-800 rounded-[5rem] w-full max-w-2xl p-16 relative shadow-4xl ring-1 ring-slate-700 flex flex-col">
                <button onClick={() => setSelectedItem(null)} className="absolute top-12 right-12 text-slate-600 hover:text-white transition active:scale-90 p-2"><X size={44} /></button>
                
                <div className="mb-12 space-y-8">
                  <div className="flex items-center gap-6">
                     <div className="w-20 h-20 rounded-3xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-2xl">
                        <Zap size={40} fill="currentColor" className="animate-pulse" />
                     </div>
                     <div>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-2 block">{selectedItem.category} • {selectedItem.source}</span>
                        <h3 className="text-3xl font-black text-white leading-tight font-kanit uppercase tracking-tighter">{selectedItem.headline}</h3>
                     </div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-[3rem] p-10 shadow-inner">
                     <p className="text-slate-300 text-xl leading-relaxed font-kanit italic">"{selectedItem.summary}"</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-10 mb-16">
                    <div className="space-y-4">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-600"><span>Viral Growth</span><span>Intensity</span></div>
                        <div className="h-2 w-full bg-slate-950 rounded-full border border-slate-800 p-0.5">
                           <div className="h-full rounded-full bg-emerald-500" style={{ width: '84%' }}></div>
                        </div>
                    </div>
                    <div className="flex justify-around items-center">
                        <div className="text-center">
                           <span className="text-[9px] font-black text-slate-600 uppercase block mb-1">Velocity</span>
                           <span className="text-2xl font-black text-white">{selectedItem.velocity}</span>
                        </div>
                        <div className="text-center">
                           <span className="text-[9px] font-black text-slate-600 uppercase block mb-1">Impact</span>
                           <span className="text-2xl font-black text-blue-400">{selectedItem.est_reach}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-950/50 p-10 rounded-[4rem] border border-slate-800 space-y-10 shadow-3xl">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] text-center">Select Production Interface</p>
                    <div className="grid grid-cols-2 gap-8">
                        <button onClick={() => { onSelectTopic(selectedItem.headline, 'video', region); setSelectedItem(null); }} className="flex flex-col items-center gap-6 p-10 bg-pink-600/10 border border-pink-500/20 hover:border-pink-500 hover:bg-pink-600/20 rounded-[3rem] transition-all group active:scale-95 shadow-xl">
                          <div className="w-20 h-20 rounded-[2rem] bg-pink-600 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform"><Video size={40} /></div>
                          <div className="text-center">
                            <span className="font-black text-white text-sm uppercase tracking-[0.2em] block">Shorts Engine</span>
                            <span className="text-[9px] text-pink-500 font-bold uppercase mt-2 block">Concise & Viral</span>
                          </div>
                        </button>
                        <button onClick={() => { onSelectTopic(selectedItem.headline, 'video', region); setSelectedItem(null); }} className="flex flex-col items-center gap-6 p-10 bg-blue-600/10 border border-blue-500/20 hover:border-blue-500 hover:bg-blue-600/20 rounded-[3rem] transition-all group active:scale-95 shadow-xl">
                          <div className="w-20 h-20 rounded-[2rem] bg-blue-600 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform"><Clapperboard size={40} /></div>
                          <div className="text-center">
                            <span className="font-black text-white text-sm uppercase tracking-[0.2em] block">Cinema Core</span>
                            <span className="text-[9px] text-blue-500 font-bold uppercase mt-2 block">In-depth & Pro</span>
                          </div>
                        </button>
                    </div>
                </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TrendingNews;
