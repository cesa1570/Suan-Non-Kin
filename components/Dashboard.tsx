import React from 'react';
import { TrendingUp, DollarSign, Video, Eye } from 'lucide-react';

const Dashboard: React.FC = () => {
  // Simulated data
  const stats = [
    { label: "Total Revenue", value: "$1,240.50", icon: <DollarSign size={20} />, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Active Shorts", value: "24", icon: <Video size={20} />, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Total Views", value: "842.1K", icon: <Eye size={20} />, color: "text-purple-400", bg: "bg-purple-400/10" },
    { label: "Avg. Engagement", value: "8.4%", icon: <TrendingUp size={20} />, color: "text-orange-400", bg: "bg-orange-400/10" },
  ];

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
             <div key={idx} className="bg-slate-800 border border-slate-700 p-5 rounded-xl flex flex-col gap-2 hover:border-slate-600 transition">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color} mb-2`}>
                   {stat.icon}
                </div>
                <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
             </div>
          ))}
       </div>

       <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Recent Viral Trends</h3>
          <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-400">
                <thead>
                   <tr className="border-b border-slate-700 text-slate-200">
                      <th className="py-3 px-2">Topic</th>
                      <th className="py-3 px-2">Views (Est)</th>
                      <th className="py-3 px-2">Competition</th>
                      <th className="py-3 px-2 text-right">Status</th>
                   </tr>
                </thead>
                <tbody>
                   <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer">
                      <td className="py-3 px-2 font-medium text-white">Scary Deep Sea Facts</td>
                      <td className="py-3 px-2">1.2M</td>
                      <td className="py-3 px-2 text-red-400">High</td>
                      <td className="py-3 px-2 text-right"><span className="bg-green-500/10 text-green-400 px-2 py-1 rounded text-xs">Trending</span></td>
                   </tr>
                   <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer">
                      <td className="py-3 px-2 font-medium text-white">Psychology Tricks</td>
                      <td className="py-3 px-2">850K</td>
                      <td className="py-3 px-2 text-yellow-400">Medium</td>
                      <td className="py-3 px-2 text-right"><span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs">Stable</span></td>
                   </tr>
                   <tr className="hover:bg-slate-700/30 cursor-pointer">
                      <td className="py-3 px-2 font-medium text-white">Unsolved Mysteries 2024</td>
                      <td className="py-3 px-2">2.1M</td>
                      <td className="py-3 px-2 text-red-400">High</td>
                      <td className="py-3 px-2 text-right"><span className="bg-green-500/10 text-green-400 px-2 py-1 rounded text-xs">Trending</span></td>
                   </tr>
                </tbody>
             </table>
          </div>
       </div>
    </div>
  );
};

export default Dashboard;