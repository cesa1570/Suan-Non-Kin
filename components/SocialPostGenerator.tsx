
import React, { useState, useEffect } from 'react';
import { Share2, Sparkles, Copy, Check, MessageSquare, Hash, Image as ImageIcon, Loader2, Zap, Instagram, Youtube, Twitter, Facebook, Languages, Send } from 'lucide-react';
import { generateSocialPost } from '../services/geminiService';
import { SocialPostData } from '../types';

interface SocialPostGeneratorProps {
  initialTopic?: string;
  initialLanguage?: 'Thai' | 'English';
}

const SocialPostGenerator: React.FC<SocialPostGeneratorProps> = ({ initialTopic, initialLanguage = 'Thai' }) => {
  const [topic, setTopic] = useState(initialTopic || '');
  const [language, setLanguage] = useState<'Thai' | 'English'>(initialLanguage);
  const [platform, setPlatform] = useState<'TikTok' | 'Instagram' | 'YouTube' | 'Facebook'>('TikTok');
  const [isGenerating, setIsGenerating] = useState(false);
  const [postData, setPostData] = useState<SocialPostData | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  useEffect(() => {
    if (initialTopic) setTopic(initialTopic);
  }, [initialTopic]);

  const handleGenerate = async () => {
    if (!topic) return;
    setIsGenerating(true);
    try {
      const data = await generateSocialPost(topic, platform, language);
      setPostData(data);
    } catch (error) {
      console.error("Social post generation failed", error);
      alert("Failed to generate social post. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const getPlatformIcon = (p: string) => {
    switch (p) {
      case 'Instagram': return <Instagram size={18} />;
      case 'YouTube': return <Youtube size={18} />;
      case 'Facebook': return <Facebook size={18} />;
      default: return <Zap size={18} />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none rotate-12">
          <Share2 size={120} />
        </div>
        
        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-pink-600/20 flex items-center justify-center text-pink-400 border border-pink-500/20 shadow-lg">
              <Share2 size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Viral Post Engine</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Algorithm Optimized Content</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="relative group">
              <input 
                type="text" 
                placeholder="What is your post about?" 
                className="w-full bg-slate-950 border border-slate-800 rounded-3xl p-6 pr-44 text-white text-xl font-kanit outline-none shadow-inner focus:ring-2 focus:ring-pink-600/50 transition-all" 
                value={topic} 
                onChange={(e) => setTopic(e.target.value)} 
              />
              <button 
                onClick={handleGenerate} 
                disabled={!topic || isGenerating} 
                className="absolute right-3 top-3 bottom-3 px-8 bg-pink-600 text-white rounded-2xl font-black transition flex items-center gap-2 uppercase tracking-widest text-xs hover:bg-pink-500 shadow-xl shadow-pink-900/40 disabled:opacity-50 active:scale-95"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18}/>}
                <span>Ignite</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Platform Target</label>
                <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-hide">
                  {['TikTok', 'Instagram', 'YouTube', 'Facebook'].map(p => (
                    <button 
                      key={p}
                      onClick={() => setPlatform(p as any)}
                      className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all whitespace-nowrap ${platform === p ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                      {getPlatformIcon(p)}
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Language Output</label>
                <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                  <button 
                    onClick={() => setLanguage('Thai')} 
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${language === 'Thai' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                  >
                    <Languages size={14} className="text-red-400" /> Thai
                  </button>
                  <button 
                    onClick={() => setLanguage('English')} 
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${language === 'English' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                  >
                    <Languages size={14} className="text-blue-400" /> English
                  </button>
                </div>
              </div>
              
              <div className="flex items-end">
                <div className="w-full p-4 bg-slate-950/50 border border-slate-800 rounded-2xl flex items-center gap-3">
                   <Zap size={16} className="text-yellow-500" />
                   <p className="text-[9px] text-slate-500 font-bold uppercase leading-tight">Algorithm Insight: Emotional hooks increase CTR by 40% on {platform}.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {postData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-6 duration-700">
          {/* Left: Generated Content */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 shadow-xl relative overflow-hidden">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare size={18} className="text-pink-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Viral Caption</h3>
                  </div>
                  <button 
                    onClick={() => handleCopy(postData.caption, 'caption')}
                    className="p-2 bg-slate-950 text-slate-500 hover:text-white rounded-xl border border-slate-800 transition active:scale-90"
                  >
                    {copiedSection === 'caption' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
               </div>
               <div className="bg-slate-950 border border-slate-800/50 rounded-3xl p-6 text-slate-300 font-kanit leading-relaxed whitespace-pre-wrap min-h-[120px]">
                  {postData.caption}
               </div>
               
               <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-3">
                    <Hash size={18} className="text-pink-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Optimized Tags</h3>
                  </div>
                  <button 
                    onClick={() => handleCopy(postData.hashtags.map(h => `#${h}`).join(' '), 'tags')}
                    className="p-2 bg-slate-950 text-slate-500 hover:text-white rounded-xl border border-slate-800 transition active:scale-90"
                  >
                    {copiedSection === 'tags' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
               </div>
               <div className="flex flex-wrap gap-2">
                  {postData.hashtags.map((tag, i) => (
                    <span key={i} className="text-[11px] font-black text-pink-400 bg-pink-500/5 border border-pink-500/10 px-3 py-1.5 rounded-full hover:bg-pink-500/10 transition-colors">#{tag}</span>
                  ))}
               </div>
            </div>
          </div>

          {/* Right: Visual Strategy */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 shadow-xl h-full">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ImageIcon size={18} className="text-blue-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Visual Hook Prompt</h3>
                  </div>
                  <button 
                    onClick={() => handleCopy(postData.image_prompt, 'visual')}
                    className="p-2 bg-slate-950 text-slate-500 hover:text-white rounded-xl border border-slate-800 transition active:scale-90"
                  >
                    {copiedSection === 'visual' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
               </div>
               <div className="bg-slate-950 border border-slate-800/50 rounded-3xl p-6 text-[11px] text-slate-500 font-mono italic leading-relaxed min-h-[100px]">
                  {postData.image_prompt}
               </div>
               <div className="p-6 bg-blue-600/5 border border-blue-500/20 rounded-3xl space-y-4">
                  <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                    <Send size={12}/> Strategy Summary
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">
                    This content is tailored for the <span className="text-pink-400 font-bold">{platform}</span> algorithm. Use a high-contrast thumbnail with the provided hook for maximum retention.
                  </p>
               </div>
            </div>
          </div>
        </div>
      )}

      {!postData && !isGenerating && (
        <div className="py-32 text-center space-y-6 bg-slate-900/20 rounded-[4rem] border-4 border-dashed border-slate-800 flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
            <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center text-slate-800 border-2 border-slate-800 shadow-inner">
               <Send size={48} className="animate-pulse" />
            </div>
            <div className="space-y-2">
              <p className="text-slate-500 text-2xl font-black uppercase tracking-tighter">Content Core Idle</p>
              <p className="text-slate-600 text-sm font-bold uppercase tracking-widest max-w-sm px-6">Input a topic above and let AI engineer your next viral sensation</p>
            </div>
        </div>
      )}
    </div>
  );
};

export default SocialPostGenerator;
