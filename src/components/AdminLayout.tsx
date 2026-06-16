import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, Search, History, Clock, Bell, Settings, 
  CheckCircle2, ChevronDown, Play, Copy, FilePlus, MoreVertical
} from 'lucide-react';
import { cn } from '../lib/utils';
import { TestDrawer } from './TestDrawer';

export function AdminLayout() {
  const [testDrawerOpen, setTestDrawerOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden relative">
      {/* Top Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-4 shrink-0 overflow-hidden">
        <div className="flex items-center text-sm overflow-hidden whitespace-nowrap mr-2">
          <div className="p-1.5 hover:bg-slate-100 rounded cursor-pointer mr-2 max-sm:hidden">
            <Home className="w-4 h-4 text-slate-600" />
          </div>
          <span className="text-slate-400 mx-2 max-sm:hidden">/</span>
          <span className="text-slate-600 font-medium max-sm:hidden">Underwriting</span>
          <span className="text-slate-400 mx-1 md:mx-2 max-sm:hidden">/</span>
          <span className="text-[#3b82f6] font-semibold text-xs py-1 px-2 md:px-2.5 bg-blue-50 border border-blue-100 rounded-full sm:bg-transparent sm:border-none sm:text-slate-600 sm:font-medium sm:p-0">Policy</span>
          <span className="text-slate-400 mx-1 md:mx-2 select-none">/</span>
          <span className="text-slate-700 font-medium truncate max-w-[120px] sm:max-w-[250px]">Optimized Indirect Used Auto Policy</span>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="relative flex items-center max-md:hidden">
            <Search className="w-4 h-4 text-slate-400 absolute left-3" />
            <input 
              type="text" 
              placeholder="Search (Ctrl + K)" 
              className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-sm w-36 lg:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300"
            />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 text-slate-600">
            <button className="p-1.5 hover:bg-slate-100 rounded-full relative max-md:hidden">
              <History className="w-5 h-5" />
            </button>
            <button className="p-1.5 hover:bg-slate-100 rounded-full relative">
              <Clock className="w-5 h-5" />
              <div className="absolute top-1 right-1 w-4 h-4 bg-orange-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">2</div>
            </button>
            <button className="p-1.5 hover:bg-slate-100 rounded-full relative">
              <Bell className="w-5 h-5" />
              <div className="absolute top-1 right-0 w-5 h-4 bg-rose-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold px-1">99+</div>
            </button>
            <button className="p-1.5 hover:bg-slate-100 rounded-full max-sm:hidden">
              <Settings className="w-5 h-5" />
            </button>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-700 text-white flex items-center justify-center text-sm font-semibold cursor-pointer shrink-0">
            M
          </div>
        </div>
      </header>

      {/* Title & Actions Row */}
      <div className="bg-white px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 border-b border-slate-100">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-xs font-semibold shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 fill-emerald-600 text-white" />
            Approved
          </div>
          <button className="flex items-center px-2.5 py-1 border border-slate-200 rounded-lg text-xs md:text-sm font-medium hover:bg-slate-50 transition-colors bg-white shadow-sm shrink-0">
            Version 1
            <ChevronDown className="w-3.5 h-3.5 ml-1.5 text-slate-400" />
          </button>
          <h1 className="text-[1.125rem] font-semibold text-slate-900 tracking-tight leading-tight truncate">Optimized Indirect Used Auto Policy</h1>
        </div>
        
        <div className="flex items-center gap-2 relative self-end md:self-auto">
          <div className="relative">
            <button 
              onClick={() => setTestDrawerOpen(true)}
              className="flex items-center px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs md:text-sm font-medium transition-colors shadow-sm"
            >
              <Play className="w-[14px] h-[14px] mr-1.5" fill="currentColor" strokeWidth={1} />
              Run Test
            </button>
          </div>
          <button className="p-1.5 md:p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors shadow-sm bg-white ml-1">
            <Copy className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button className="p-1.5 md:p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors shadow-sm bg-white">
            <FilePlus className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button className="p-1.5 md:p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors shadow-sm bg-white">
            <MoreVertical className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="bg-white px-6 border-b border-slate-200 flex space-x-1 shrink-0 overflow-x-auto hide-scrollbar">
        {[
          { name: 'Details', path: '#' },
          { name: 'Decision Workflow', path: '/' },
          { name: 'Offer Display', path: '#' },
          { name: 'Single Record Review', path: '#', onClick: () => setTestDrawerOpen(true) },
          { name: 'Dashboard', path: '/dashboard' },
          { name: 'Jobs', path: '/jobs' },
          { name: 'Change History', path: '#' },
          { name: 'Approvals', path: '#' },
          { name: 'More', path: '#', hasDropdown: true },
        ].map((tab, i) => (
          <NavLink
            key={i}
            to={tab.path}
            onClick={(e) => {
              if (tab.onClick) {
                e.preventDefault();
                tab.onClick();
              }
            }}
            className={() => {
              const isTabActive = tab.path === '/' 
                ? (location.pathname === '/' || location.pathname === '/workflow')
                : (location.pathname === tab.path);
              return cn(
                "whitespace-nowrap py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center",
                isTabActive ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              );
            }}
          >
            {/* Adding appropriate icons based on tab name */}
            {tab.name === 'Details' && <FilePlus className="w-4 h-4 mr-2 opacity-70" />}
            {tab.name === 'Decision Workflow' && <Settings className="w-4 h-4 mr-2 opacity-70" />}
            {tab.name === 'Dashboard' && <Search className="w-4 h-4 mr-2 opacity-70" />}
            {tab.name === 'Jobs' && <Clock className="w-4 h-4 mr-2 opacity-70" />}
            {tab.name === 'Change History' && <History className="w-4 h-4 mr-2 opacity-70" />}
            {tab.name === 'Approvals' && <CheckCircle2 className="w-4 h-4 mr-2 opacity-70" />}
            {tab.name === 'Offer Display' && <Settings className="w-4 h-4 mr-2 opacity-70" />}
            {tab.name === 'Single Record Review' && <CheckCircle2 className="w-4 h-4 mr-2 opacity-70" />}
            {tab.name}
            {tab.hasDropdown && <ChevronDown className="w-4 h-4 ml-1 opacity-70" />}
          </NavLink>
        ))}
      </div>

      {/* Main Content & Sidebar Container */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 min-w-0 relative overflow-auto bg-[#f8fafc]">
          <Outlet />
        </main>
      </div>

      {/* Test Drawer Overlay */}
      {testDrawerOpen && <TestDrawer onClose={() => setTestDrawerOpen(false)} />}
    </div>
  );
}
