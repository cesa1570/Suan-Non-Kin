import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Video, Zap, Newspaper, Clapperboard, 
  Youtube, Grid, FileEdit, Key 
} from 'lucide-react';

// Components
import Dashboard from './components/Dashboard';
import Hub from './components/Hub';
import ShortsCreator from './components/ShortsCreator';
import LongVideoCreator from './components/LongVideoCreator';
import TrendingNews from './components/TrendingNews';
import YoutubeManager from './components/YoutubeManager';
import ManualStoryBoard from './components/ManualStoryBoard'; 
import AutomationEngine from './components/AutomationEngine';

import { NewsItem } from './types';
import { AutomationProvider } from './contexts/AutomationContext';
import { AppContext, AppContextType } from './contexts/AppContext';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hub' | 'dashboard' | 'create' | 'long' | 'news' | 'youtube' | 'manual'>('hub');
  
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<'Thai' | 'English'>('Thai');
  
  const [apiKey, setApiKey] = useState<string>(process.env.API_KEY || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  
  const [ytConnected, setYtConnected] = useState(!!localStorage.getItem('yt_access_token'));
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

  const handleSetApiKey = (key: string) => {
    setApiKey(key);
    setShowKeyModal(false);
  };

  const openKeySelection = () => setShowKeyModal(true);
  const resetKeyStatus = () => setApiKey('');

  const handleNewsTopicSelect = (topic: string, type: 'video' | 'social' | 'podcast', region: 'global' | 'thailand') => {
    setSelectedTopic(topic);
    setSelectedLanguage(region === 'global' ? 'English' : 'Thai');
    setActiveTab('create');
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

  const contextValue: AppContextType = {
    apiKey,
    setApiKey: handleSetApiKey,
    openKeySelection,
    resetKeyStatus,
    hasSelectedKey: !!apiKey
  };

  return (
    <AppContext.Provider value={contextValue}>
      <AutomationProvider apiKey={apiKey}>
        <AutomationEngine apiKey={apiKey} />
        
        <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
          
          <aside className="hidden md:flex w-72 flex-col fixed inset-y-0 z-50 bg-slate-900 border-r border-slate-800/50 shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-12 mt-2">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-xl"><Zap className="text-white" size={22} fill="currentColor" /></div>
                <div><h1 className="text-xl font-black text-white tracking-tight leading-none">AutoShorts</h1><span className="text-[10px] text-purple-400 font-black tracking-[0.2em] uppercase">AI Factory</span></div>
            </div>
            <div className="space-y-1 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <NavItem id="hub" label="Tools Hub" icon={Grid} />
                <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 mt-8">Studio</p>
                <NavItem id="manual" label="Manual Studio" icon={FileEdit} />
                <NavItem id="create" label="Shorts Creator" icon={Video} />
                <NavItem id="long" label="Long Video" icon={Clapperboard} />
                
                <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 mt-8">Intelligence</p>
                <NavItem id="news" label="Trending Trends" icon={Newspaper} />
                
                <NavItem id="dashboard" label="Analytics" icon={LayoutDashboard} />
                <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 mt-8">Publication</p>
                <NavItem id="youtube" label="YouTube Studio" icon={Youtube} badge={true} />
            </div>
            <div className="space-y-6 pt-6 border-t border-slate-800">
               <div className="px-4">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2 text-slate-500">
                    <span>Daily Quota</span>
                    <span>{apiRequestsToday} / {FREE_TIER_LIMIT}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${apiRequestsToday > FREE_TIER_LIMIT ? 'bg-red-500' : 'bg-purple-500'}`} style={{ width: `${(apiRequestsToday / FREE_TIER_LIMIT) * 100}%` }}></div>
                  </div>
               </div>
               <button onClick={() => setShowKeyModal(true)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${apiKey ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                    <div className="flex items-center gap-2"><Key size={14} /> {apiKey ? 'Pro Key Active' : 'Set API Key'}</div>
               </button>
            </div>
          </aside>

          <main className="flex-1 md:ml-72 flex flex-col h-screen overflow-hidden bg-slate-950">
            <div className="flex-1 overflow-y-auto pt-12 px-12 pb-12 custom-scrollbar">
                <header className="mb-12">
                    <div className="flex items-center gap-2 text-purple-400 text-xs font-black uppercase tracking-widest mb-2">
                        <div className="h-px w-8 bg-purple-500/30"></div>
                        <span>Engine Mode</span>
                    </div>
                    <h2 className="text-5xl font-black text-white uppercase tracking-tight">{activeTab === 'hub' ? 'Home' : activeTab === 'manual' ? 'Manual Studio' : activeTab}</h2>
                </header>
                
                <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                    {activeTab === 'hub' && <Hub onNavigate={(tab) => setActiveTab(tab)} />}
                    {activeTab === 'dashboard' && <Dashboard />}
                    
                    {activeTab === 'manual' && (
                        <ManualStoryBoard 
                            apiKey={apiKey} 
                            initialTopic={selectedTopic} 
                        />
                    )}

                    {activeTab === 'create' && <ShortsCreator initialTopic={selectedTopic} initialLanguage={selectedLanguage} apiKey={apiKey} />}
                    {activeTab === 'long' && <LongVideoCreator initialTopic={selectedTopic} initialLanguage={selectedLanguage} apiKey={apiKey} />}
                    
                    {activeTab === 'news' && (
                        <TrendingNews 
                            news={newsItems} setNews={setNewsItems} 
                            loading={newsLoading} setLoading={setNewsLoading} 
                            region={newsRegion} setRegion={setNewsRegion}
                            onSelectTopic={handleNewsTopicSelect} apiKey={apiKey}
                        />
                    )}
                    
                    {activeTab === 'youtube' && <YoutubeManager />}
                </div>
            </div>
          </main>
        </div>

        {/* Modal Key */}
        {showKeyModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md relative">
                    <button onClick={() => setShowKeyModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition">✕</button>
                    <h3 className="text-2xl font-black text-white uppercase mb-2 text-center">Enter Gemini API Key</h3>
                    <input 
                        type="password" placeholder="Paste API Key here..." 
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white mb-4 outline-none"
                        defaultValue={apiKey}
                        onChange={(e) => setApiKey(e.target.value)} 
                    />
                    <button onClick={() => handleSetApiKey(apiKey)} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold uppercase tracking-widest transition-all">Save & Unlock</button>
                </div>
            </div>
        )}
      </AutomationProvider>
    </AppContext.Provider>
  );
};

export default App;