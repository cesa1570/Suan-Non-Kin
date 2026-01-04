
import React, { useState, useEffect, createContext, useContext } from 'react';
import { LayoutDashboard, Video, Zap, Newspaper, Share2, Clapperboard, Mic, Activity, Key, Youtube, Home, Grid } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Hub from './components/Hub';
import ShortsCreator from './components/ShortsCreator';
import LongVideoCreator from './components/LongVideoCreator';
import TrendingNews from './components/TrendingNews';
import SocialPostGenerator from './components/SocialPostGenerator';
import PodcastCreator from './components/PodcastCreator';
import YoutubeManager from './components/YoutubeManager';
import { NewsItem } from './types';
import { AutomationProvider } from './contexts/AutomationContext';
import AutomationEngine from './components/AutomationEngine';

interface AppContextType {
  hasSelectedKey: boolean;
  openKeySelection: () => Promise<void>;
  resetKeyStatus: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hub' | 'dashboard' | 'create' | 'long' | 'news' | 'social' | 'podcast' | 'youtube'>('hub');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<'Thai' | 'English'>('Thai');
  const [hasSelectedKey, setHasSelectedKey] = useState(false);
  const [ytConnected, setYtConnected] = useState(!!localStorage.getItem('yt_access_token'));
  
  // Persistent News State
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsRegion, setNewsRegion] = useState<'global' | 'thailand'>('thailand');

  const [apiRequestsToday, setApiRequestsToday] = useState(0);
  const FREE_TIER_LIMIT = 1500;

  useEffect(() => {
    const today = new Date().toDateString();
    if (localStorage.getItem('gemini-usage-date') !== today) {
      localStorage.setItem('gemini-usage-date', today);
      localStorage.setItem('gemini-usage-count', '0');
      setApiRequestsToday(0);
    } else {
      setApiRequestsToday(parseInt(localStorage.getItem('gemini-usage-count') || '0'));
    }
    const handleUsage = () => setApiRequestsToday(prev => {
      const next = prev + 1;
      localStorage.setItem('gemini-usage-count', next.toString());
      return next;
    });
    const handleYtChange = () => setYtConnected(!!localStorage.getItem('yt_access_token'));
    window.addEventListener('gemini-api-usage', handleUsage);
    window.addEventListener('yt-connection-changed', handleYtChange);
    return () => {
      window.removeEventListener('gemini-api-usage', handleUsage);
      window.removeEventListener('yt-connection-changed', handleYtChange);
    };
  }, []);

  useEffect(() => {
    if ((window as any).aistudio?.hasSelectedApiKey) {
      (window as any).aistudio.hasSelectedApiKey().then(setHasSelectedKey);
    }
  }, []);

  const handleOpenKeySelection = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setHasSelectedKey(true);
    }
  };

  const handleNewsTopicSelect = (topic: string, type: 'video' | 'social' | 'podcast', region: 'global' | 'thailand') => {
    setSelectedTopic(topic);
    setSelectedLanguage(region === 'global' ? 'English' : 'Thai');
    if (type === 'video') setActiveTab('create');
    else if (type === 'podcast') setActiveTab('podcast');
    else setActiveTab('social');
  };

  const NavItem = ({ id, label, icon: Icon, badge }: { id: any, label: string, icon: any, badge?: boolean }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-all text-sm group ${
        activeTab === id 
          ? 'bg-purple-600/10 text-purple-400 border-r-4 border-purple-500' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={20} className={activeTab === id ? 'text-purple-400' : 'text-slate-500 group-hover:text-white'} />
        {label}
      </div>
      {badge && <div className={`w-2 h-2 rounded-full ${ytConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`}></div>}
    </button>
  );

  const usagePercent = Math.min(100, (apiRequestsToday / FREE_TIER_LIMIT) * 100);

  return (
    <AppContext.Provider value={{ hasSelectedKey, openKeySelection: handleOpenKeySelection, resetKeyStatus: () => setHasSelectedKey(false) }}>
      <AutomationProvider>
        <AutomationEngine />
        <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
          <aside className="hidden md:flex w-72 flex-col fixed inset-y-0 z-50 bg-slate-900 border-r border-slate-800/50 shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-12 mt-2">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-xl"><Zap className="text-white" size={22} fill="currentColor" /></div>
                <div><h1 className="text-xl font-black text-white tracking-tight leading-none">AutoShorts</h1><span className="text-[10px] text-purple-400 font-black tracking-[0.2em] uppercase">AI Factory</span></div>
            </div>
            <div className="space-y-1 flex-1 overflow-y-auto pr-2">
                <NavItem id="hub" label="Tools Hub" icon={Grid} />
                <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 mt-8">Studio</p>
                <NavItem id="create" label="Shorts Creator" icon={Video} />
                <NavItem id="long" label="Long Video" icon={Clapperboard} />
                <NavItem id="podcast" label="Podcast Creator" icon={Mic} />
                <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 mt-8">Intelligence</p>
                <NavItem id="news" label="Trending Trends" icon={Newspaper} />
                <NavItem id="social" label="Social Post" icon={Share2} />
                <NavItem id="dashboard" label="Analytics" icon={LayoutDashboard} />
                <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 mt-8">Publication</p>
                <NavItem id="youtube" label="YouTube Studio" icon={Youtube} badge={true} />
            </div>
            <div className="space-y-6 pt-6 border-t border-slate-800">
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                    <div className="flex justify-between items-center mb-3"><div className="flex items-center gap-1.5"><Activity size={12} className="text-slate-500" /><span className="text-[10px] font-black text-slate-500 uppercase">Daily Quota</span></div></div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">{hasSelectedKey ? <div className="h-full w-full bg-gradient-to-r from-emerald-600 to-teal-400 animate-pulse rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div> : <div className={`h-full rounded-full ${usagePercent > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${usagePercent}%` }}></div>}</div>
                </div>
                <button onClick={handleOpenKeySelection} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${hasSelectedKey ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}><Key size={14} />{hasSelectedKey ? 'Pro Active' : 'Free Mode'}</button>
            </div>
          </aside>

          <main className="flex-1 md:ml-72 flex flex-col h-screen overflow-hidden">
            <div className="flex-1 overflow-y-auto pt-12 px-12 pb-12">
                <header className="mb-12">
                    <div className="flex items-center gap-2 text-purple-400 text-xs font-black uppercase tracking-widest mb-2"><div className="h-px w-8 bg-purple-500/30"></div><span>Engine Mode</span></div>
                    <h2 className="text-5xl font-black text-white uppercase tracking-tight">{activeTab === 'hub' ? 'Home' : activeTab}</h2>
                </header>
                <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                    {activeTab === 'hub' && <Hub onNavigate={setActiveTab} />}
                    {activeTab === 'dashboard' && <Dashboard />}
                    {activeTab === 'create' && <ShortsCreator initialTopic={selectedTopic} initialLanguage={selectedLanguage} />}
                    {activeTab === 'long' && <LongVideoCreator initialTopic={selectedTopic} initialLanguage={selectedLanguage} />}
                    {activeTab === 'podcast' && <PodcastCreator initialTopic={selectedTopic} initialLanguage={selectedLanguage} />}
                    {activeTab === 'news' && (
                      <TrendingNews 
                        news={newsItems} 
                        setNews={setNewsItems} 
                        loading={newsLoading} 
                        setLoading={setNewsLoading} 
                        region={newsRegion}
                        setRegion={setNewsRegion}
                        onSelectTopic={handleNewsTopicSelect} 
                      />
                    )}
                    {activeTab === 'social' && <SocialPostGenerator initialTopic={selectedTopic} initialLanguage={selectedLanguage} />}
                    {activeTab === 'youtube' && <YoutubeManager />}
                </div>
            </div>
          </main>
        </div>
      </AutomationProvider>
    </AppContext.Provider>
  );
};

export default App;
