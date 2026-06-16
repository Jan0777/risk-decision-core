import React from 'react';
import { History, Search, Filter } from 'lucide-react';

export function JobsDashboard() {
  return (
    <div className="flex h-full font-sans flex-col bg-slate-50 p-6">
      <div className="mb-6 flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Job History</h1>
            <p className="text-slate-500 text-sm mt-1">Review past execution logs and batch simulation jobs.</p>
         </div>
         <div className="flex items-center gap-3">
             <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Search jobs..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
             </div>
             <button className="flex items-center px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                 <Filter className="w-4 h-4 mr-2" />
                 Filter
             </button>
         </div>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm flex-1">
         <div className="flex items-center justify-center h-full flex-col text-slate-400">
             <History className="w-12 h-12 mb-4 text-slate-300" />
             <h3 className="text-lg font-medium text-slate-600 mb-1">No jobs executed</h3>
             <p className="text-sm">Batch simulation and background jobs will appear here.</p>
         </div>
      </div>
    </div>
  );
}

