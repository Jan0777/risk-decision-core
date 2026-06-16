import React, { useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend 
} from 'recharts';
import { 
  ShieldAlert, Users, CheckCircle, Clock 
} from 'lucide-react';

export function PerformanceDashboard() {
  const [data] = useState([
    { name: 'Jan', approvals: 400, denials: 240, review: 100 },
    { name: 'Feb', approvals: 300, denials: 139, review: 220 },
    { name: 'Mar', approvals: 200, denials: 980, review: 229 },
    { name: 'Apr', approvals: 278, denials: 390, review: 200 },
    { name: 'May', approvals: 189, denials: 480, review: 218 },
    { name: 'Jun', approvals: 239, denials: 380, review: 250 },
    { name: 'Jul', approvals: 349, denials: 430, review: 210 },
  ]);

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Performance Dashboard</h1>
          <p className="text-sm text-slate-500">Historical performance metrics of your underwriting models.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Volume</p>
                <p className="text-2xl font-black text-slate-800">12,482</p>
             </div>
             <div className="bg-indigo-50 p-2.5 rounded-lg text-indigo-600">
                <Users className="w-5 h-5" />
             </div>
          </div>
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Auto Approval Rate</p>
                <p className="text-2xl font-black text-emerald-600">42.8%</p>
             </div>
             <div className="bg-emerald-50 p-2.5 rounded-lg text-emerald-600">
                <CheckCircle className="w-5 h-5" />
             </div>
          </div>
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Manual Review Rate</p>
                <p className="text-2xl font-black text-amber-600">24.1%</p>
             </div>
             <div className="bg-amber-50 p-2.5 rounded-lg text-amber-600">
                <Clock className="w-5 h-5" />
             </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Auto Denial Rate</p>
                <p className="text-2xl font-black text-rose-600">33.1%</p>
             </div>
             <div className="bg-rose-50 p-2.5 rounded-lg text-rose-600">
                <ShieldAlert className="w-5 h-5" />
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="text-sm font-bold text-slate-700 mb-6">Historical Decision Trend</h3>
             <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorApprove" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                       <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                     </linearGradient>
                     <linearGradient id="colorDeny" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                       <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} stroke="#94a3b8" />
                   <YAxis fontSize={11} tickLine={false} axisLine={false} tickMargin={10} stroke="#94a3b8" />
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <RechartsTooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                   <Area type="monotone" dataKey="approvals" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorApprove)" />
                   <Area type="monotone" dataKey="denials" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorDeny)" />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="text-sm font-bold text-slate-700 mb-6">Decision Breakdown by Month</h3>
             <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                   <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} stroke="#94a3b8" />
                   <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="#94a3b8" />
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                   <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                   <Bar dataKey="approvals" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                   <Bar dataKey="review" stackId="a" fill="#f59e0b" />
                   <Bar dataKey="denials" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
