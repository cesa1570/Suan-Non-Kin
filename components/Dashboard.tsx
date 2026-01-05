import React, { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Video, Eye, Loader2, Calendar, Activity } from 'lucide-react';
import { listProjects, ProjectData } from '../services/projectService'; // ดึง Service ที่มีอยู่แล้ว

// Interface สำหรับข้อมูลสรุป
interface DashboardStats {
  revenue: number;
  activeShorts: number;
  totalViews: number;
  engagement: number;
}

const Dashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    revenue: 0,
    activeShorts: 0,
    totalViews: 0,
    engagement: 0
  });

  // --- 1. Fetch Real Data ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // ดึงข้อมูลโปรเจกต์จริงจาก LocalStorage
        const allProjects = await listProjects();
        
        // เรียงลำดับเอาอันใหม่สุดขึ้นก่อน
        const sortedProjects = allProjects.sort((a, b) => b.lastUpdated - a.lastUpdated);
        
        setProjects(sortedProjects);

        // --- 2. Calculate Stats (Logic จำลองการคำนวณ) ---
        // ในระบบจริง: ค่าเหล่านี้จะดึงจาก YouTube Analytics API
        // ในที่นี้: เราจะจำลองตัวเลขโดยอิงจากจำนวนโปรเจกต์จริงเพื่อให้ดูสมจริง
        const totalProjects = allProjects.length;
        
        setStats({
          activeShorts: totalProjects, // ข้อมูลจริง: จำนวนโปรเจกต์ที่สร้าง
          revenue: totalProjects * 124.50, // Mockup: สมมติรายได้ต่อคลิป
          totalViews: totalProjects * 35000, // Mockup: สมมติยอดวิวต่อคลิป
          engagement: 8.4 // Mockup: Engagement rate คงที่
        });

      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- Helper: Format Currency ---
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  // --- Helper: Format Number (K/M) ---
  const formatCompactNumber = (num: number) => {
    return Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
  };

  // --- Helper: Get Status Badge ---
  const getStatusBadge = (project: ProjectData) => {
    // เช็คจากข้อมูลจริง ถ้า export แล้วให้ขึ้น Published (สมมติ)
    const isCompleted = project.script?.scenes?.every(s => s.status === 'completed');
    
    if (isCompleted) {
      return <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded text-xs font-bold border border-green-500/20">Ready</span>;
    }
    return <span className="bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded text-xs font-bold border border-yellow-500/20">Drafting</span>;
  };

  // ข้อมูล Cards (ผูกกับ State)
  const statCards = [
    { label: "Est. Revenue", value: formatCurrency(stats.revenue), icon: <DollarSign size={20} />, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Active Projects", value: stats.activeShorts.toString(), icon: <Video size={20} />, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Total Views (Est)", value: formatCompactNumber(stats.totalViews), icon: <Eye size={20} />, color: "text-purple-400", bg: "bg-purple-400/10" },
    { label: "Avg. Engagement", value: `${stats.engagement}%`, icon: <TrendingUp size={20} />, color: "text-orange-400", bg: "bg-orange-400/10" },
  ];

  if (isLoading) {
    return <div className="h-64 flex items-center justify-center text-slate-500 gap-2"><Loader2 className="animate-spin" /> Loading Dashboard...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
       
       {/* 1. Stat Cards */}
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, idx) => (
             <div key={idx} className="bg-slate-800/50 border border-slate-700/50 p-5 rounded-2xl flex flex-col gap-2 hover:border-slate-600 hover:bg-slate-800 transition-all group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color} mb-2 group-hover:scale-110 transition-transform`}>
                   {stat.icon}
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-black text-white font-kanit tracking-tight">{stat.value}</p>
             </div>
          ))}
       </div>

       {/* 2. Recent Projects Table (Real Data) */}
       <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2rem] p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Activity size={20} className="text-orange-500" />
                Recent Productions
            </h3>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {projects.length} Total
            </span>
          </div>
          
          <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-400">
                <thead>
                   <tr className="border-b border-slate-700 text-slate-200 uppercase text-[10px] font-black tracking-widest">
                      <th className="py-4 px-2">Project Topic</th>
                      <th className="py-4 px-2">Last Updated</th>
                      <th className="py-4 px-2">Mode</th>
                      <th className="py-4 px-2 text-right">Status</th>
                   </tr>
                </thead>
                <tbody className="font-medium">
                   {projects.length === 0 ? (
                       <tr>
                           <td colSpan={4} className="py-8 text-center text-slate-500 italic">
                               No projects found. Start creating!
                           </td>
                       </tr>
                   ) : (
                       projects.slice(0, 5).map((project) => (
                          <tr key={project.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors cursor-pointer group">
                             <td className="py-4 px-2 text-white group-hover:text-orange-400 transition-colors">
                                 {project.topic || "Untitled Project"}
                             </td>
                             <td className="py-4 px-2 flex items-center gap-2">
                                <Calendar size={12} />
                                {new Date(project.lastUpdated).toLocaleDateString('th-TH')}
                             </td>
                             <td className="py-4 px-2">
                                <span className="px-2 py-1 rounded-md bg-slate-700/50 border border-slate-600/50 text-[10px] uppercase">
                                    {project.config.mode}
                                </span>
                             </td>
                             <td className="py-4 px-2 text-right">
                                {getStatusBadge(project)}
                             </td>
                          </tr>
                       ))
                   )}
                </tbody>
             </table>
          </div>
       </div>
    </div>
  );
};

export default Dashboard;