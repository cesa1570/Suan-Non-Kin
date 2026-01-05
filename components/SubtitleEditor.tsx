
import React from 'react';
import { SubtitleStyle } from '../types';
import { 
  Type, Move, Palette, Layers, Sparkles, 
  LayoutTemplate, CheckCircle2, BoxSelect 
} from 'lucide-react';

interface SubtitleEditorProps {
  style: SubtitleStyle;
  onChange: (updates: Partial<SubtitleStyle>) => void;
  presetType?: string; // Fix: Add optional presetType prop
}

const PRESETS: Record<string, SubtitleStyle> = {
  'Viral Neon': {
    fontSize: 84, textColor: '#FFFF00', backgroundColor: '#000000', backgroundOpacity: 0.0,
    verticalOffset: 35, fontFamily: 'Kanit', outlineColor: '#000000', outlineWidth: 8,
    shadowBlur: 15, shadowColor: 'rgba(0,0,0,1)', fontWeight: '900'
  },
  'Netflix Clean': {
    fontSize: 56, textColor: '#FFFFFF', backgroundColor: '#000000', backgroundOpacity: 0.0,
    verticalOffset: 15, fontFamily: 'Inter', outlineColor: '#000000', outlineWidth: 3,
    shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.8)', fontWeight: '600'
  },
  'Boxed Highlight': {
    fontSize: 64, textColor: '#FFFFFF', backgroundColor: '#F97316', backgroundOpacity: 1.0,
    verticalOffset: 25, fontFamily: 'Kanit', outlineColor: '#000000', outlineWidth: 0,
    shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)', fontWeight: '700'
  }
};

const SubtitleEditor: React.FC<SubtitleEditorProps> = ({ style, onChange, presetType }) => {
  
  // Helper to convert hex to rgba for preview
  const getShadowString = () => {
    return `0px 2px ${style.shadowBlur}px ${style.shadowColor || 'rgba(0,0,0,0.5)'}`;
  };

  const getTextStroke = () => {
    return style.outlineWidth > 0 
      ? `${style.outlineWidth * 0.5}px ${style.outlineColor}` 
      : 'none';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-slate-200">
      
      {/* 1. Live Preview Box */}
      <div className="w-full h-32 bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center rounded-2xl overflow-hidden border border-slate-700 shadow-2xl relative group">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span 
            style={{
              fontFamily: style.fontFamily,
              fontSize: `${style.fontSize * 0.6}px`, // Scale down for preview
              fontWeight: style.fontWeight,
              color: style.textColor,
              WebkitTextStroke: getTextStroke(),
              textShadow: getShadowString(),
              backgroundColor: style.backgroundOpacity > 0 ? style.backgroundColor : 'transparent',
              padding: style.backgroundOpacity > 0 ? '4px 12px' : '0',
              borderRadius: '8px',
              opacity: style.backgroundOpacity > 0 ? 0.9 : 1 // Simulate semi-transparent bg
            }}
            className="transition-all duration-300 text-center leading-tight select-none"
          >
            ตัวอย่างข้อความ
            <br/>
            Preview Text
          </span>
        </div>
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-[9px] font-mono text-slate-400 uppercase">
          Live Preview
        </div>
      </div>

      {/* 2. Presets */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <LayoutTemplate size={12}/> Quick Presets {presetType && `(${presetType})`}
        </label>
        <div className="grid grid-cols-3 gap-3">
            {Object.entries(PRESETS).map(([name, s]) => {
            const isActive = JSON.stringify(style.textColor) === JSON.stringify(s.textColor) && style.fontFamily === s.fontFamily;
            return (
                <button
                key={name}
                onClick={() => onChange(s)}
                className={`py-3 px-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all relative overflow-hidden ${
                    isActive
                    ? 'bg-purple-600/20 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600 hover:bg-slate-800'
                }`}
                >
                <div className="flex flex-col items-center gap-1.5 z-10 relative">
                    {isActive ? <CheckCircle2 size={14} className="text-purple-400"/> : <Sparkles size={14}/>}
                    {name}
                </div>
                </button>
            )
            })}
        </div>
      </div>

      <div className="h-px bg-slate-800" />

      {/* 3. Controls Grid */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* Typography Section */}
        <div className="space-y-4">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span className="flex items-center gap-2"><Type size={14} className="text-purple-400" /> Typography</span>
                <span className="text-slate-300 bg-slate-800 px-2 py-0.5 rounded">{style.fontSize}px</span>
            </div>
            
            <input 
                type="range" min="20" max="150" value={style.fontSize} 
                onChange={(e) => onChange({ fontSize: parseInt(e.target.value) })}
                className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer hover:bg-slate-700 transition-colors"
            />
            
            <div className="grid grid-cols-2 gap-3">
                <select 
                    value={style.fontFamily} 
                    onChange={(e) => onChange({ fontFamily: e.target.value as any })}
                    className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-white font-medium text-xs outline-none focus:border-purple-500 transition-colors"
                >
                    <option value="Kanit">Kanit (Thai/Eng)</option>
                    <option value="Prompt">Prompt (Modern)</option>
                    <option value="Inter">Inter (Clean)</option>
                    <option value="Sarabun">Sarabun (Formal)</option>
                </select>
                <select 
                    value={style.fontWeight} 
                    onChange={(e) => onChange({ fontWeight: e.target.value })}
                    className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-white font-medium text-xs outline-none focus:border-purple-500 transition-colors"
                >
                    <option value="400">Regular</option>
                    <option value="600">Semi Bold</option>
                    <option value="700">Bold</option>
                    <option value="900">Black</option>
                </select>
            </div>
        </div>

        {/* Colors & Effects Section */}
        <div className="space-y-5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Palette size={14} className="text-blue-400" /> Colors & Outline
            </label>
            
            <div className="grid grid-cols-2 gap-4">
                {/* Text Color */}
                <div className="space-y-2">
                    <label className="text-[9px] text-slate-400 uppercase font-bold">Text Color</label>
                    <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                        <input type="color" value={style.textColor} onChange={(e) => onChange({ textColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent" />
                        <span className="text-[10px] font-mono text-slate-300">{style.textColor}</span>
                    </div>
                </div>

                {/* Outline Color */}
                <div className="space-y-2">
                    <label className="text-[9px] text-slate-400 uppercase font-bold">Stroke Color</label>
                    <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                        <input type="color" value={style.outlineColor} onChange={(e) => onChange({ outlineColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent" />
                        <span className="text-[10px] font-mono text-slate-300">{style.outlineColor}</span>
                    </div>
                </div>
            </div>

            {/* Stroke Width Slider */}
            <div className="space-y-2 pt-2">
                 <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase">
                    <span>Stroke Width</span>
                    <span>{style.outlineWidth}px</span>
                 </div>
                 <input 
                    type="range" min="0" max="20" value={style.outlineWidth} 
                    onChange={(e) => onChange({ outlineWidth: parseInt(e.target.value) })}
                    className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer"
                />
            </div>
        </div>

        {/* Background & Shadow Section */}
        <div className="space-y-5">
             <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <BoxSelect size={14} className="text-orange-400" /> Background & Glow
            </label>

            {/* Background Color & Opacity (New Feature) */}
            <div className="grid grid-cols-[auto_1fr] gap-4 items-end">
                <div className="space-y-2">
                    <label className="text-[9px] text-slate-400 uppercase font-bold">Bg Color</label>
                    <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800 w-fit">
                        <input type="color" value={style.backgroundColor} onChange={(e) => onChange({ backgroundColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent" />
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase">
                        <span>Background Opacity</span>
                        <span>{Math.round(style.backgroundOpacity * 100)}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="1" step="0.1" value={style.backgroundOpacity} 
                        onChange={(e) => onChange({ backgroundOpacity: parseFloat(e.target.value) })}
                        className="w-full accent-orange-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer"
                    />
                </div>
            </div>

            {/* Shadow/Glow Slider */}
            <div className="space-y-2 pt-2">
                 <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase">
                    <span className="flex items-center gap-1"><Layers size={10}/> Glow / Shadow Blur</span>
                    <span>{style.shadowBlur}px</span>
                 </div>
                 <input 
                    type="range" min="0" max="50" value={style.shadowBlur} 
                    onChange={(e) => onChange({ shadowBlur: parseInt(e.target.value) })}
                    className="w-full accent-orange-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer"
                />
            </div>
        </div>

        {/* Position Section */}
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-3">
             <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span className="flex items-center gap-2"><Move size={14} className="text-green-400" /> Position Y</span>
                <span>{style.verticalOffset}%</span>
            </div>
            <input 
                type="range" min="5" max="90" value={style.verticalOffset} 
                onChange={(e) => onChange({ verticalOffset: parseInt(e.target.value) })}
                className="w-full accent-green-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer"
            />
            <p className="text-[9px] text-slate-500 text-center">Adjust vertical height from bottom</p>
        </div>

      </div>
    </div>
  );
};

export default SubtitleEditor;
