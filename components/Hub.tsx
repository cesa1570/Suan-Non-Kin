import React, { useState } from 'react';
import { 
  Zap, Compass, PenTool, Share2, Flame, Video, 
  Clapperboard, Mic, Share, Youtube, ChevronRight,
  FileJson, Database, Download, Loader2, FileEdit // Imported FileEdit
} from 'lucide-react';
import { exportAllData } from '../services/projectService';

interface HubProps {
  onNavigate: (tab: any) => void;
}

const Hub: React.FC<HubProps> = ({ onNavigate }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportAllData();
    } catch (err) {
      alert("Export failed. Check console for details.");
    } finally {
      setIsExporting(false);
    }
  };

  const Step = ({ num, label, sub }: { num: number, label: string, sub: string }) => (
    <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 p-3 px-5 rounded-2xl">
      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-orange-500 font-black text-xs border border-slate-700">
        {num}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-black text-white uppercase tracking-tighter">{label}</span>
        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{sub}</span>
      </div>
    </div>
  );

  const ToolCard = ({ 
    id, title, desc, icon: Icon, color, badge, wide = false, onClick 
  }: { 
    id?: string, title: string, desc: string, icon: any, color: string, badge?: string, wide?: boolean, onClick?: () => void 
  }) => (
    <button 
      onClick={onClick || (() => id && onNavigate(id))}
      className={`${wide ? 'col-span-full' : 'col-span-1'} group bg-slate-900 border border-slate-800 hover:border-purple-500/50 p-8 rounded-[2.5rem] transition-all duration-500 text-left relative overflow-hidden shadow-2xl hover:shadow-purple-500/10 active:scale-[0.98]`}
    >
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700">
        <Icon size={120} />
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center shadow-lg border border-white/10 group-hover:scale-110 transition-transform`}>
            <Icon size={28} className="text-white" fill="currentColor" />
          </div>
          {badge && (
            <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 border ${badge === 'Hot' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : badge === 'New' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
              <Flame size={10} fill="currentColor" /> {badge}
            </div>
          )}
        </div>
        <h4 className="text-xl font-black text-white uppercase tracking-tight mb-2 group-hover:text-purple-400 transition-colors font-kanit">
          {title}
        </h4>
        <p className="text-xs text-slate-500 font-medium font-kanit leading-relaxed max-w-[240px]">
          {desc}
        </p>
      </div>
    </button>
  );

  return (
    <div className="space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Hero Banner */}
      <div className="relative bg-gradient-to-br from-purple-700 to-indigo-900 p-12 rounded-[3.5rem] shadow-3xl overflow-hidden ring-1 ring-white/10">
        <div className="absolute top-0 right-0 p-16 opacity-10 pointer-events-none animate-pulse">
          <Zap size={240} fill="currentColor" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center text-white border border-white/20">
              <Zap size={36} fill="currentColor" />
            </div>
            <h2 className="text-5xl font-black text-white uppercase tracking-tighter">Tools Hub</h2>
          </div>
          <p className="text-lg font-bold text-purple-200 font-kanit mb-4 uppercase tracking-tight">ศูนย์รวมเครื่องมือสร้างคอนเทนต์ AI</p>
          <p className="text-sm text-purple-100/60 font-medium font-kanit leading-relaxed">
            เลือกเครื่องมือที่คุณต้องการใช้งาน ไม่ว่าจะเป็นการสร้างวิดีโอสั้น วิดีโอยาว พอดแคสต์ หรือโซเชียลโพสต์ ทุกอย่างทำได้ง่ายด้วยพลัง AI
          </p>
        </div>
      </div>

      {/* Process Steps */}
      <div className="flex items-center justify-center gap-6">
        <Step num={1} label="Discover" sub="ค้นหาไอเดีย" />
        <ChevronRight className="text-slate-700" size={16} />
        <Step num={2} label="Create" sub="สร้างคอนเทนต์" />
        <ChevronRight className="text-slate-700" size={16} />
        <Step num={3} label="Publish" sub="เผยแพร่" />
      </div>

      {/* Discover Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-500">
            <Compass size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Discover</h3>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">ค้นหาไอเดียและหัวข้อ Trending</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ToolCard 
            id="news" 
            title="Trending Trends" 
            desc="ค้นหาหัวข้อที่กำลัง Viral และเป็นที่นิยม" 
            icon={Flame} 
            color="bg-orange-500" 
            badge="Hot" 
            wide
          />
        </div>
      </section>

      {/* Create Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-500">
            <PenTool size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Create</h3>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">สร้างคอนเทนต์ด้วย AI</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* ----- Manual Story Mode Added Here ----- */}
          <ToolCard 
            id="manual" 
            title="Manual Story" 
            desc="เขียนบท วางโครงเรื่อง และสร้างสตอรี่บอร์ดด้วยตัวเองแบบ Manual" 
            icon={FileEdit} 
            color="bg-indigo-500" 
            badge="New" 
          />
          {/* -------------------------------------- */}

          <ToolCard 
            id="create" 
            title="Shorts Creator" 
            desc="สร้างวิดีโอสั้นแนวตั้งสำหรับ TikTok, Reels, Shorts" 
            icon={Video} 
            color="bg-pink-500" 
            badge="Popular" 
          />
          <ToolCard 
            id="long" 
            title="Long Video" 
            desc="สร้างวิดีโอยาวสำหรับ YouTube หรือ Facebook" 
            icon={Clapperboard} 
            color="bg-blue-500" 
          />
          <ToolCard 
            id="podcast" 
            title="Podcast Creator" 
            desc="สร้างพอดแคสต์ด้วย AI Voice และ Script อัตโนมัติ" 
            icon={Mic} 
            color="bg-emerald-500" 
          />
          <ToolCard 
            id="social" 
            title="Social Post" 
            desc="สร้างโพสต์โซเชียลมีเดียพร้อมรูปและแคปชั่น" 
            icon={Share} 
            color="bg-red-400" 
          />
        </div>
      </section>

      {/* Publish Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500">
            <Share2 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Publish</h3>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">เผยแพร่ไปยังแพลตฟอร์ม</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ToolCard 
            id="youtube" 
            title="YouTube Studio" 
            desc="จัดการและอัปโหลดวิดีโอไปยัง YouTube" 
            icon={Youtube} 
            color="bg-red-600" 
            wide
          />
        </div>
      </section>

      {/* Maintenance Section */}
      <section className="space-y-6 pt-12 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
            <Database size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">System Maintenance</h3>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">บริหารจัดการข้อมูลสตูดิโอ</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ToolCard 
            title="Export System Data" 
            desc="ส่งออกข้อมูลโปรเจกต์และคิวงานทั้งหมดเป็นไฟล์ JSON สำหรับการสำรองข้อมูล" 
            icon={isExporting ? Loader2 : FileJson} 
            color="bg-slate-800" 
            onClick={handleExport}
            badge={isExporting ? "Processing" : undefined}
            wide
          />
        </div>
      </section>
    </div>
  );
};

export default Hub;