import React from 'react';
import { 
  Video, Mic, MessageSquare, Newspaper, 
  Layout, Smartphone, Radio, Share2, 
  Zap, Crown, Sparkles, MoveRight, Play 
} from 'lucide-react';

interface HubProps {
  onNavigate: (tab: 'create' | 'long' | 'manual' | 'news' | 'dashboard' | 'youtube') => void;
}

const Hub: React.FC<HubProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 pb-32 font-kanit">
      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* Header Section */}
        <div className="space-y-6 text-center py-10 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
          <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400 uppercase tracking-tighter relative z-10">
            Creator Studio
          </h1>
          <p className="text-xl text-slate-400 font-light tracking-wide max-w-2xl mx-auto relative z-10">
            AI-Powered Content Production Suite
          </p>
        </div>

        {/* Main Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* 1. Shorts Creator */}
          <div 
            onClick={() => onNavigate('create')}
            className="group relative bg-slate-900/50 border border-slate-800 hover:border-orange-500/50 rounded-[2.5rem] p-8 cursor-pointer transition-all duration-500 hover:shadow-2xl hover:shadow-orange-900/20 hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-900/30 group-hover:scale-110 transition-transform duration-500">
                <Smartphone size={32} />
              </div>
              <div>
                <h3 className="text-3xl font-black uppercase tracking-tight mb-2 group-hover:text-orange-400 transition-colors">Shorts Factory</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Automated vertical video production. Generate viral scripts, AI voiceovers, and cinematic visuals in one click.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-500 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                Launch App <MoveRight size={14} />
              </div>
            </div>
          </div>

          {/* 2. Long Video Creator */}
          <div 
            onClick={() => onNavigate('long')}
            className="group relative bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 rounded-[2.5rem] p-8 cursor-pointer transition-all duration-500 hover:shadow-2xl hover:shadow-blue-900/20 hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/30 group-hover:scale-110 transition-transform duration-500">
                <Video size={32} />
              </div>
              <div>
                <h3 className="text-3xl font-black uppercase tracking-tight mb-2 group-hover:text-blue-400 transition-colors">Long Form</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Deep-dive documentary generator. Create 10+ minute educational content with detailed narration.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-500 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                Launch App <MoveRight size={14} />
              </div>
            </div>
          </div>

          {/* 3. Manual Studio */}
          <div 
            onClick={() => onNavigate('manual')}
            className="group relative bg-slate-900/50 border border-slate-800 hover:border-purple-500/50 rounded-[2.5rem] p-8 cursor-pointer transition-all duration-500 hover:shadow-2xl hover:shadow-purple-900/20 hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-900/30 group-hover:scale-110 transition-transform duration-500">
                <Zap size={32} />
              </div>
              <div>
                <h3 className="text-3xl font-black uppercase tracking-tight mb-2 group-hover:text-purple-400 transition-colors">Manual Studio</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Fine-tuned control for advanced creators. Manage every frame and timeline segment manually.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-purple-500 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                Open Studio <MoveRight size={14} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Hub;