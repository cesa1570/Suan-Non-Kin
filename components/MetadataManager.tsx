import React, { useState } from 'react';
import { ScriptData } from '../types';
import { generateThumbnail, generateSeoMetadata } from '../services/geminiService';
import { 
  Copy, Check, Hash, ImageIcon, Loader2, Download, Sparkles, 
  BarChart3, AlertTriangle, CheckCircle2, Youtube, ExternalLink, 
  RefreshCw, Wand2, ScrollText
} from 'lucide-react';

interface MetadataManagerProps {
  metadata: ScriptData;
  topic?: string;
  style?: string;
  onUpdateMetadata?: (updates: Partial<ScriptData>) => void;
  onRegenerateText?: (field: 'title' | 'description') => Promise<string>; 
}

const MetadataManager: React.FC<MetadataManagerProps> = ({ 
  metadata, 
  topic, 
  style = 'Cinematic', 
  onUpdateMetadata,
  onRegenerateText 
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);
  
  const [isRegenTitle, setIsRegenTitle] = useState(false);
  const [isRegenDesc, setIsRegenDesc] = useState(false);

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(metadata.thumbnailUrl || null);

  const handleCopy = (text: string, section: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const getWordCount = (text: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return 0;
    return /[ก-๙]/.test(trimmed) 
      ? Math.floor(trimmed.length / 2.5) 
      : trimmed.split(/\s+/).length;
  };

  // --- Helper: Clean Hashtags (แก้ปัญหา ##) ---
  const formatTag = (tag: string) => {
    // ลบ # ออกให้หมดก่อน แล้วเติมใหม่ทีเดียว เพื่อป้องกัน ## หรือ ###
    return `#${tag.replace(/^#+/, '')}`;
  };

  const wordCount = getWordCount(metadata.longDescription);
  const charCount = (metadata.longDescription || '').length;
  const seoScore = Math.min(100, Math.floor((wordCount / 500) * 100));

  const handleGenerateThumbnail = async () => {
    setIsGeneratingThumbnail(true);
    try {
      const img = await generateThumbnail(
        metadata.seoTitle || metadata.title, 
        topic || metadata.title, 
        style
      );
      setThumbnailUrl(img);
      onUpdateMetadata?.({ thumbnailUrl: img });
    } catch (err) {
      alert("Thumbnail generation failed.");
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const handleGenerateSeoTags = async () => {
    setIsGeneratingSeo(true);
    try {
      const result = await generateSeoMetadata(
        topic || metadata.title,
        metadata.seoTitle || metadata.title,
        metadata.longDescription
      );
      onUpdateMetadata?.({ 
        hashtags: result.hashtags || [], 
        seoKeywords: result.seoKeywords || ''
      });
    } catch (err) {
      alert("SEO generation failed.");
    } finally {
      setIsGeneratingSeo(false);
    }
  };

  const handleRegenText = async (field: 'title' | 'description') => {
      if (!onRegenerateText) return;
      field === 'title' ? setIsRegenTitle(true) : setIsRegenDesc(true);
      try {
          const res = await onRegenerateText(field);
          if (field === 'title') onUpdateMetadata?.({ seoTitle: res });
          else onUpdateMetadata?.({ longDescription: res });
      } catch (e) {
          alert("Text regeneration failed");
      } finally {
          field === 'title' ? setIsRegenTitle(false) : setIsRegenDesc(false);
      }
  };

  // 🔥 FIX 1: ใช้ formatTag เพื่อแก้ปัญหา ## ในสตริงสำหรับ Copy
  const hashtagString = (metadata.hashtags || []).map(formatTag).join(' ');
  const youtubeBlock = `${metadata.seoTitle}\n\n${metadata.longDescription}\n\nTAGS:\n${hashtagString}\n${metadata.seoKeywords}`;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 border border-slate-800 p-8 rounded-[3.5rem] shadow-2xl backdrop-blur-2xl ring-1 ring-slate-800">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-[2rem] bg-red-600/10 flex items-center justify-center text-red-500 border border-red-500/20 shadow-inner">
            <Youtube size={36} fill="currentColor" />
          </div>
          <div>
            <h3 className="text-3xl font-black text-white uppercase tracking-tight leading-none">YouTube Paste-Ready Engine</h3>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-2">SEO Algorithm Mastery • Indexed Growth Assets</p>
          </div>
        </div>
        
        <button 
          onClick={() => handleCopy(youtubeBlock, 'all')}
          className={`flex items-center gap-4 px-10 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all shadow-2xl active:scale-95 group ${
            copiedSection === 'all' ? 'bg-emerald-600 text-white' : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40'
          }`}
        >
          {copiedSection === 'all' ? <CheckCircle2 size={20}/> : <Copy size={20} className="group-hover:translate-x-0.5 transition-transform" />}
          {copiedSection === 'all' ? 'Ready for Paste' : 'Copy All YT Metadata'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        <div className="space-y-10">
          
          {/* Title Hook Section */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-[3rem] p-10 space-y-6 shadow-xl relative overflow-hidden">
             <div className="absolute -top-4 -right-4 w-20 h-20 bg-blue-500/5 blur-3xl rounded-full"></div>
             <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <BarChart3 size={16} className="text-blue-400" /> Viral Title
                </label>
                <div className="flex items-center gap-2">
                    {onRegenerateText && (
                        <button onClick={() => handleRegenText('title')} disabled={isRegenTitle} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 hover:text-blue-400 transition shadow-inner disabled:opacity-50">
                            {isRegenTitle ? <Loader2 size={18} className="animate-spin"/> : <Wand2 size={18}/>}
                        </button>
                    )}
                    <button onClick={() => handleCopy(metadata.seoTitle, 'title')} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 hover:text-white hover:border-slate-600 transition shadow-inner">
                        {copiedSection === 'title' ? <Check size={18} className="text-emerald-500"/> : <Copy size={18} className="text-slate-500" />}
                    </button>
                </div>
             </div>
             <div className="bg-slate-950/80 p-8 rounded-[2rem] border border-blue-500/10 shadow-inner group">
                <textarea 
                    value={metadata.seoTitle || ''} 
                    onChange={(e) => onUpdateMetadata?.({ seoTitle: e.target.value })}
                    className="w-full bg-transparent border-none outline-none text-2xl font-black text-white leading-tight font-kanit uppercase tracking-tight resize-none h-24 placeholder-slate-700"
                    placeholder="CLICK TO EDIT TITLE..."
                />
                <div className="mt-2 flex justify-end">
                   <span className={`text-[10px] font-black ${(metadata.seoTitle || '').length > 100 ? 'text-red-500' : 'text-slate-600'}`}>{(metadata.seoTitle || '').length} / 100</span>
                </div>
             </div>
          </div>

          {/* Description Section */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-[3rem] p-10 space-y-6 shadow-xl relative group">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ScrollText size={16} className="text-red-500" /> SEO Description
              </label>
              <div className="flex items-center gap-4">
                <div className={`hidden sm:flex px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border items-center gap-2 ${wordCount >= 500 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse'}`}>
                  {wordCount >= 500 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                  {wordCount} Words
                </div>
                <div className="flex items-center gap-2">
                    {onRegenerateText && (
                        <button onClick={() => handleRegenText('description')} disabled={isRegenDesc} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 hover:text-blue-400 transition shadow-inner disabled:opacity-50">
                            {isRegenDesc ? <Loader2 size={18} className="animate-spin"/> : <Wand2 size={18}/>}
                        </button>
                    )}
                    <button onClick={() => handleCopy(metadata.longDescription, 'desc')} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 hover:text-white transition shadow-inner">
                        {copiedSection === 'desc' ? <Check size={18} className="text-emerald-500"/> : <Copy size={18} className="text-slate-500" />}
                    </button>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden p-1 border border-slate-800 shadow-inner">
                <div className={`h-full rounded-full transition-all duration-1000 ${wordCount >= 500 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-orange-500'}`} style={{ width: `${seoScore}%` }}></div>
              </div>
              <div className="bg-slate-950/80 p-8 rounded-[2rem] border border-slate-800 h-[500px] shadow-inner relative">
                 <textarea 
                    value={metadata.longDescription || ''}
                    onChange={(e) => onUpdateMetadata?.({ longDescription: e.target.value })}
                    className="w-full h-full bg-transparent border-none outline-none text-sm text-slate-400 leading-relaxed font-kanit font-medium resize-none scrollbar-thin scrollbar-thumb-slate-800 p-2"
                    placeholder="AI is generating description..."
                 />
              </div>
              <div className="flex items-center justify-between px-2">
                 <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Length: {charCount} / 5000</span>
                 <a href="https://studio.youtube.com" target="_blank" rel="noreferrer" className="text-[9px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-1.5 transition-colors">Go to Studio <ExternalLink size={10} /></a>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-10">
          
          {/* Visual Artwork Section */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-[3rem] p-10 space-y-8 shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none"><ImageIcon size={160} /></div>
             <div className="flex items-center justify-between relative z-10">
                <div>
                   <h4 className="text-xl font-black text-white uppercase tracking-tight">Viral Cover Design</h4>
                </div>
                <button onClick={handleGenerateThumbnail} disabled={isGeneratingThumbnail} className="flex items-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl active:scale-95 disabled:opacity-50">
                   {isGeneratingThumbnail ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                   {isGeneratingThumbnail ? 'Rendering...' : 'Re-Draft Design'}
                </button>
             </div>
             <div className="aspect-video bg-slate-950 rounded-[2.5rem] border border-slate-800 overflow-hidden relative flex items-center justify-center group shadow-2xl ring-1 ring-slate-800/50">
                {thumbnailUrl ? (
                   <>
                      <img src={thumbnailUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Viral Thumbnail" />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-sm">
                         <a href={thumbnailUrl} download={`youtube-art-${Date.now()}.png`} className="p-5 bg-white text-slate-900 rounded-full shadow-3xl hover:scale-110 transition active:scale-90"><Download size={32} /></a>
                      </div>
                   </>
                ) : (
                  <div className="flex flex-col items-center gap-6 opacity-20">
                    <ImageIcon size={80} />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Canvas Standby</span>
                  </div>
                )}
                {isGeneratingThumbnail && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center space-y-6">
                    <Loader2 size={56} className="animate-spin text-red-500" />
                    <span className="text-xs font-black text-white uppercase tracking-[0.4em] animate-pulse block">Synthesizing Art...</span>
                  </div>
                )}
             </div>
          </div>

          {/* Tags Section (Fixed Double Hash) */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-[3rem] p-10 space-y-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Hash size={16} className="text-pink-400" /> Massive Tag Cloud</label>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleGenerateSeoTags}
                  disabled={isGeneratingSeo}
                  className="flex items-center gap-2 px-5 py-2 bg-pink-600/10 text-pink-400 border border-pink-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-pink-600 hover:text-white transition-all disabled:opacity-50"
                >
                  {isGeneratingSeo ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Generate 50+ Tags
                </button>
                <button onClick={() => handleCopy(hashtagString, 'tags')} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 hover:text-white transition shadow-inner">
                  {copiedSection === 'tags' ? <Check size={18} className="text-emerald-500"/> : <Copy size={18} className="text-slate-500" />}
                </button>
              </div>
            </div>
            
            <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800 relative">
               {isGeneratingSeo && (
                 <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-[2rem]">
                    <div className="flex items-center gap-3">
                      <Loader2 size={16} className="animate-spin text-pink-500" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest animate-pulse">Mining High-Traffic Keywords...</span>
                    </div>
                 </div>
               )}
               
               <div className="flex flex-wrap gap-2 max-h-[280px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-pink-500/20 scrollbar-track-transparent">
                 {(metadata.hashtags || []).map((tag, i) => (
                   // 🔥 FIX 2: ใช้ formatTag() ตรงนี้เพื่อแสดงผลถูกต้อง (ไม่ซ้อน ##)
                   <span key={i} className="text-[10px] font-black text-pink-400 bg-pink-500/5 border border-pink-500/10 px-4 py-2 rounded-lg hover:bg-pink-500/10 transition-all cursor-default whitespace-nowrap">
                     {formatTag(tag)}
                   </span>
                 ))}
                 {(metadata.hashtags || []).length === 0 && !isGeneratingSeo && <span className="text-[10px] text-slate-600 italic uppercase w-full text-center py-10 block">No Tags Linked</span>}
               </div>
               
               <div className="mt-8 pt-6 border-t border-slate-800/50">
                  <div className="flex justify-between items-center mb-3">
                     <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Semantic Keywords (Comma Separated)</p>
                     <button onClick={() => handleCopy(metadata.seoKeywords, 'kw')} className="text-[9px] font-bold text-slate-500 hover:text-white uppercase">
                        {copiedSection === 'kw' ? 'Copied!' : 'Copy Keywords'}
                     </button>
                  </div>
                  <textarea 
                     value={metadata.seoKeywords || ''}
                     onChange={(e) => onUpdateMetadata?.({ seoKeywords: e.target.value })}
                     className="w-full bg-transparent border-none outline-none text-[10px] text-slate-400 font-medium font-mono leading-relaxed italic resize-none h-24"
                     placeholder="Keywords pending..."
                  />
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetadataManager;