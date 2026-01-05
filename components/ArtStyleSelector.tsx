import React from 'react';
import { Palette, X, Check, Zap, Layers, Info, Camera, Monitor, Film } from 'lucide-react';

export interface StyleOption {
  id: string;
  name: string;
  description: string;
  dna: string[];
  image: string;
  technicalHint: string;
}

// ✅ ข้อมูลชุดใหม่ (รวม Junji Ito + Unreal)
export const STYLES: StyleOption[] = [
  {
    id: 'Cinematic',
    name: 'Cinematic Master',
    description: 'High-end Hollywood aesthetics with professional depth of field and color grading.',
    dna: ['Anamorphic Lens', 'Golden Hour', 'Shallow Focus', '8K Raw'],
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=800',
    technicalHint: 'Adds: 35mm lens, dramatic lighting, anamorphic flares, color-graded'
  },
  {
    id: 'Anime',
    name: 'Neo Anime',
    description: 'Vibrant cel-shaded visuals inspired by modern Makoto Shinkai animation.',
    dna: ['Saturated Colors', 'Expressive Lines', 'Stylized Sky', 'Hand-drawn feel'],
    image: 'https://images.unsplash.com/photo-1542931287-023b922fa89b?auto=format&fit=crop&q=80&w=800',
    technicalHint: 'Adds: cel shaded, vibrant lines, anime aesthetic, stylized textures'
  },
  {
    id: 'Cyberpunk',
    name: 'Cyberpunk Edgy',
    description: 'Dystopian future aesthetics with high-contrast neon and rainy reflections.',
    dna: ['Neon Glow', 'Chromatic Aberration', 'Volumetric Fog', 'Night City'],
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800',
    technicalHint: 'Adds: neon lights, rainy street, cyberpunk aesthetic, high contrast'
  },
  {
    id: 'Horror',
    name: 'Atmospheric Horror',
    description: 'Eerie, desaturated, and high-tension compositions for mystery and suspense.',
    dna: ['Chiaroscuro', 'Heavy Grain', 'Shadow Play', 'Creepy Details'],
    image: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&q=80&w=800',
    technicalHint: 'Adds: dark atmosphere, grainy texture, low-key lighting, spooky vibe'
  },
  {
    id: 'Documentary',
    name: 'NatGeo Reality',
    description: 'Realistic, high-fidelity textures with neutral, natural lighting.',
    dna: ['Natural Light', 'Macro Detail', 'True Color', 'Clean Frame'],
    image: 'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?auto=format&fit=crop&q=80&w=800',
    technicalHint: 'Adds: neutral lighting, documentary style, macro lens, realistic textures'
  },
  {
    id: 'Unreal',
    name: 'Unreal Engine 5',
    description: 'Hyper-realistic 3D rendering with advanced global illumination and ray tracing.',
    dna: ['Lumen', 'Nanite', 'Ray Tracing', '8K Render'],
    image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&q=80&w=800',
    technicalHint: 'Adds: Unreal Engine 5 render, 8k resolution, lumen global illumination'
  },
  {
    id: 'JunjiIto',
    name: 'Horror Manga',
    description: 'Spirals, body horror, and psychological terror in the style of Junji Ito.',
    dna: ['Junji Ito', 'Manga Horror', 'Gore', 'Spiral'],
    image: 'https://images.unsplash.com/photo-1513569771920-c9e1d31714b0?auto=format&fit=crop&q=80&w=800',
    technicalHint: 'junji ito style, manga horror, black and white, grotesque, psychological horror, detailed line work, cross-hatching, spiral patterns, unsettling, body horror, dark fantasy anime'
  },
];

interface ArtStyleSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const ArtStyleSelector: React.FC<ArtStyleSelectorProps> = ({ selectedId, onSelect, onClose }) => {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/98 backdrop-blur-2xl p-6 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-7xl rounded-[4rem] p-12 relative shadow-3xl overflow-hidden ring-1 ring-slate-700">
        
        {/* Background Blobs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/5 blur-[120px] rounded-full pointer-events-none"></div>
        
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-10 right-10 text-slate-500 hover:text-white transition p-2 active:scale-90 z-20">
          <X size={32} />
        </button>

        {/* Header */}
        <div className="mb-12 relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-purple-600/20 rounded-2xl flex items-center justify-center text-purple-400 border border-purple-500/20">
                <Palette size={24} />
              </div>
              <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Artistic Direction</h3>
            </div>
            <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] ml-1">Select visual parameters for the Neural Generation Engine</p>
          </div>
          <div className="px-6 py-2 bg-slate-800 rounded-full flex items-center gap-3 border border-slate-700">
             <Layers size={14} className="text-purple-400" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{STYLES.length} Multi-Spectral Style Kernels</span>
          </div>
        </div>

        {/* Grid Container (UI แบบเดิมที่เป็นการ์ดใบใหญ่ มีรายละเอียดครบ) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-800">
          {STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => { onSelect(style.id); onClose(); }}
              className={`group relative flex flex-col text-left rounded-[2.5rem] border-2 transition-all duration-500 overflow-hidden active:scale-95 h-full ${
                selectedId === style.id 
                  ? 'border-purple-500 bg-purple-600/5 shadow-[0_0_50px_rgba(168,85,247,0.2)]' 
                  : 'border-slate-800 bg-slate-950 hover:border-slate-600'
              }`}
            >
              {/* Visual Preview Container */}
              <div className="h-48 w-full relative overflow-hidden transition-transform duration-700">
                 <img 
                   src={style.image} 
                   className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                   alt={style.name} 
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                 
                 {/* DNA Tags Overlay */}
                 <div className="absolute bottom-4 left-4 flex flex-wrap gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    {style.dna.slice(0, 2).map((tag, i) => (
                      <span key={i} className="text-[7px] font-black uppercase bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-purple-300 border border-purple-500/20">
                        {tag}
                      </span>
                    ))}
                 </div>

                 {selectedId === style.id && (
                   <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shadow-2xl ring-4 ring-purple-600/20 animate-in zoom-in duration-300">
                      <Check size={18} className="text-white" />
                   </div>
                 )}
              </div>

              {/* Text Content (รายละเอียดครบแบบเดิม) */}
              <div className="p-6 flex-1 flex flex-col">
                <div className="mb-4">
                  <h4 className={`text-lg font-black uppercase tracking-tight transition-colors mb-1 ${selectedId === style.id ? 'text-purple-400' : 'text-white group-hover:text-purple-300'}`}>
                    {style.name}
                  </h4>
                  <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                      <Camera size={10} /> Lens Core Active
                  </div>
                </div>
                
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium font-kanit italic mb-6 line-clamp-2">
                  {style.description}
                </p>

                <div className="mt-auto space-y-4">
                  <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 group-hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-2 mb-1.5">
                         <Monitor size={10} className="text-blue-400" />
                         <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Engine Parameters</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-tight italic font-mono uppercase tracking-tighter">
                         {style.technicalHint}
                      </p>
                  </div>
                  
                  <div className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    selectedId === style.id ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300'
                  }`}>
                    <Film size={12} /> {selectedId === style.id ? 'Selected Pattern' : 'Select Pattern'}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3">
               <Info size={16} className="text-slate-600" />
               <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Hardware Acceleration: V4 Cluster Active</span>
             </div>
             <div className="flex items-center gap-3">
               <Zap size={16} className="text-orange-500" fill="currentColor" />
               <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Style Transfer Optimization: On</span>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="px-12 py-5 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-700 transition shadow-xl border border-slate-700 active:scale-95"
          >
            Deploy Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArtStyleSelector;