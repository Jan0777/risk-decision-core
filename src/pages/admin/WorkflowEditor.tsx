import React, { useState, useEffect } from 'react';
import { Play, FileText, UserPlus, Info, Plus, Minus, Maximize, CheckCircle, Workflow, ChevronRight, MessageSquare } from 'lucide-react';
import { InspectorPanel } from './InspectorPanel';
import { Gate, Policy, DecisionResult } from '../../lib/types';
import { evaluatePolicy } from '../../lib/engine';
import { cn } from '../../lib/utils';
import { POLICY_OPTIMIZED_INDIRECT_USED_AUTO } from '../../lib/seedPolicy';
import { SwapsetMatrix } from './SwapsetMatrix';
import Markdown from 'react-markdown';
import { Chatbot } from '../../components/Chatbot';

// Global trace for simple communication between TestDrawer and WorkflowEditor
export let globalTestResult: DecisionResult | null = null;
export const setGlobalTestResult = (res: DecisionResult | null) => { 
  globalTestResult = res; 
  window.dispatchEvent(new Event('policyTestUpdated')); 
};

export function WorkflowEditor() {
  const [policy, setPolicy] = useState<Policy>(() => {
    const saved = localStorage.getItem('cu_base_policy');
    return saved ? JSON.parse(saved) : POLICY_OPTIMIZED_INDIRECT_USED_AUTO;
  });
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [activeTestPath, setActiveTestPath] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [draftPolicy, setDraftPolicy] = useState<Policy | null>(() => {
    const saved = localStorage.getItem('cu_draft_policy');
    return saved ? JSON.parse(saved) : null;
  });
  
  // Chatbot states
  const [chatOpen, setChatOpen] = useState(() => sessionStorage.getItem('cu_dw_chat_open') === 'true');
  const [chatExpanded, setChatExpanded] = useState(() => {
    const val = sessionStorage.getItem('cu_dw_chat_expanded');
    return val !== null ? val === 'true' : false;
  });
  const [showComparison, setShowComparison] = useState(true);

  useEffect(() => {
    sessionStorage.setItem('cu_dw_chat_open', String(chatOpen));
  }, [chatOpen]);

  useEffect(() => {
    sessionStorage.setItem('cu_dw_chat_expanded', String(chatExpanded));
  }, [chatExpanded]);

  useEffect(() => {
    const handleUpdate = () => {
      setActiveTestPath(globalTestResult?.path || []);
    };
    window.addEventListener('policyTestUpdated', handleUpdate);
    return () => window.removeEventListener('policyTestUpdated', handleUpdate);
  }, []);

  useEffect(() => {
    localStorage.setItem('cu_base_policy', JSON.stringify(policy));
    window.dispatchEvent(new Event('policyUpdated'));
  }, [policy]);

  useEffect(() => {
    const handleSync = () => {
      const saved = localStorage.getItem('cu_base_policy');
      if (saved) {
        setPolicy(JSON.parse(saved));
      }
      const savedDraft = localStorage.getItem('cu_draft_policy');
      setDraftPolicy(savedDraft ? JSON.parse(savedDraft) : null);
    };
    window.addEventListener('policyUpdated', handleSync);
    return () => window.removeEventListener('policyUpdated', handleSync);
  }, []);

  const activePolicyObj = draftPolicy || policy;
  const selectedGate = activePolicyObj.gates.find((g: any) => g.id === selectedGateId);
  const baseGate = draftPolicy ? policy.gates.find(g => g.id === selectedGateId) : null;

  const updateSelectedGate = (updated: Gate) => {
    setPolicy(prev => ({
      ...prev,
      gates: prev.gates.map(g => g.id === updated.id ? updated : g)
    }));
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.1, 2));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.1, 0.5));
  const handleZoomReset = () => setZoom(1);

  return (
    <div className="flex h-full font-sans overflow-hidden bg-slate-50">
      {/* Main Workflow Area (80% if chat open, 100% if closed) */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        {/* Top Controls Overlay */}
        <div className="absolute top-6 left-6 z-20 flex flex-col gap-3">
           <button onClick={() => { 
              setChatOpen(true);
              // We don't need chatExpanded for 20% side panel, but we'll keep the state if it's used elsewhere
              setChatExpanded(false); 
              window.dispatchEvent(new Event('startWhatIf'));
           }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors">
              <Play className="w-4 h-4 fill-current" />
              Run What-If Analysis
           </button>
        
           {draftPolicy && (
               <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
                 <input type="checkbox" checked={showComparison} onChange={(e) => setShowComparison(e.target.checked)} className="form-checkbox h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                 <span className="text-[13px] font-semibold text-slate-700">View What-If Comparison</span>
               </label>
           )}
        </div>

        {/* Zoom / Info Tools */}
        <div className="absolute right-6 top-6 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col p-1.5 gap-1 z-20 w-10 items-center">
          <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><Info className="w-4 h-4" /></button>
          <div className="w-5 h-px bg-slate-100 my-0.5" />
          <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-100 rounded text-slate-500" title="Zoom In"><Plus className="w-4 h-4" /></button>
          <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-100 rounded text-slate-500" title="Zoom Out"><Minus className="w-4 h-4" /></button>
          <button onClick={handleZoomReset} className="p-1.5 hover:bg-slate-100 rounded text-slate-500" title="Reset Zoom"><Maximize className="w-4 h-4" /></button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          {draftPolicy && showComparison ? (
             <div className="flex-1 flex overflow-hidden">
                <PolicyCanvas policy={policy} title="Baseline Policy" activeTestPath={activeTestPath} selectedGateId={selectedGateId} setSelectedGateId={setSelectedGateId} zoom={zoom} />
                <div className="w-px bg-slate-200 z-10 box-border shrink-0" />
                <PolicyCanvas policy={draftPolicy} title="Draft Policy" activeTestPath={activeTestPath} selectedGateId={selectedGateId} setSelectedGateId={setSelectedGateId} zoom={zoom} isDraft basePolicy={policy} />
             </div>
          ): (
             <PolicyCanvas policy={policy} title="Live Policy" activeTestPath={activeTestPath} selectedGateId={selectedGateId} setSelectedGateId={setSelectedGateId} zoom={zoom} />
          )}

          {/* Floating Right Rules Panel - now absolute inside this flex-1 area */}
          {selectedGate && (
             <InspectorPanel 
                gate={selectedGate} 
                baseGate={baseGate}
                updateGate={updateSelectedGate} 
                onClose={() => setSelectedGateId(null)} 
             />
          )}
        </div>

        {/* Docked Launcher when closed */}
        {!chatOpen && (
          <div className="absolute bottom-6 right-6 z-30">
            <button 
              onClick={() => setChatOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-full shadow-xl hover:bg-indigo-700 transition-all font-medium animate-in zoom-in-95"
            >
              <MessageSquare className="w-5 h-5 fill-current opacity-80" />
              CU Knowledge Assistant
            </button>
          </div>
        )}
      </div>

      {/* Chatbot Side Panel - persistent side of the screen min-w-[320px] and max 25vw */}
      <div className={cn(
         "h-full transition-all duration-300 ease-in-out bg-white border-l border-slate-200 z-40 flex flex-col overflow-hidden shrink-0",
         chatOpen ? (chatExpanded ? "w-[40vw] min-w-[400px] max-w-[800px]" : "w-[25vw] min-w-[320px] max-w-[500px]") : "w-0 border-none"
      )}>
        {chatOpen && (
          <Chatbot 
            onClose={() => setChatOpen(false)} 
            isExpanded={chatExpanded}
            onToggleExpand={() => setChatExpanded(!chatExpanded)}
          />
        )}
      </div>
    </div>
  );

}


// Helpers

function VerticalArrow({ label, active }: { label?: string, active?: boolean }) {
  return (
    <div className={`w-px h-[48px] relative flex justify-center shrink-0 transition-colors ${active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-emerald-300'}`}>
       {label && (
         <span className={`absolute top-1/2 -translate-y-1/2 bg-white px-2 py-0.5 text-[10px] font-bold tracking-widest border-x border-[#f8f9fa] z-10 leading-tight block ${active ? 'text-emerald-700' : 'text-[#64748b]'}`}>{label}</span>
       )}
       <div className={`absolute bottom-0 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] transform lg:translate-y-[2px] translate-y-1 transition-colors ${active ? 'border-t-emerald-500' : 'border-t-emerald-300'}`} />
    </div>
  )
}

function GateNode({ title, blockLabel, active, testPassed, testFailed, onClick, isModified }: { title: string, blockLabel: string, active: boolean, testPassed?: boolean, testFailed?: boolean, onClick: () => void, isModified?: boolean }) {
  let stateBorder = 'border border-[#3b82f6] z-10';
  if (isModified) stateBorder = 'border-[2px] border-orange-400 ring-[3px] ring-orange-50 z-20 shadow-[0_0_15px_rgba(251,146,60,0.3)]';
  else if (active) stateBorder = 'border-[1.5px] border-blue-500 ring-[3px] ring-blue-50 z-20';
  else if (testPassed) stateBorder = 'border-2 border-emerald-400 bg-emerald-50/20 shadow-[0_0_15px_rgba(16,185,129,0.2)] z-10';
  else if (testFailed) stateBorder = 'border-2 border-rose-400 bg-rose-50/20 shadow-[0_0_15px_rgba(244,63,94,0.2)] z-10';

  return (
    <div 
      onClick={onClick} 
      className={cn(
         "relative bg-white rounded-lg px-4 py-4 w-[320px] h-[84px] flex items-center shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] cursor-pointer transition-all hover:shadow-md",
         stateBorder
      )}
    >
       {isModified && <div className="absolute -top-3 -right-3 bg-orange-100 text-orange-700 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-orange-200 shadow-sm z-30">Modified</div>}
       <div className="absolute top-[-9px] left-1/2 -translate-x-1/2 bg-white px-2 py-px text-[10px] font-medium text-slate-500 tracking-wider z-10">{blockLabel}</div>
       <div className={cn("text-blue-500 p-2 rounded-lg mr-3 shrink-0 ml-1", testPassed ? 'bg-emerald-100/50 text-emerald-600' : testFailed ? 'bg-rose-100/50 text-rose-600' : 'bg-[#f0f9ff]')}>
          <Workflow className="w-[18px] h-[18px]" strokeWidth={1.5} />
       </div>
       <div className="flex flex-col pt-0.5">
          <span className="font-semibold text-slate-800 tracking-tight text-[14px] leading-tight">{title}</span>
          <span className="text-[#64748b] text-[11px] mt-[2px]">{blockLabel}</span>
       </div>
    </div>
  );
}

function HorizontalBranch({ title, targetType, result, active }: { title: string, targetType: string, result: string, active?: boolean }) {
  const isDenial = targetType === 'AUTO_DENIAL';
  const lineColorDeactive = isDenial ? 'bg-[#f87171]' : 'bg-[#fbbf24]'; // lighter for deactive state
  const lineColorActive = isDenial ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'; // normal for active
  const lineColor = active ? lineColorActive : lineColorDeactive;
  const arrowColor = active ? (isDenial ? 'border-r-[#ef4444]' : 'border-r-[#f59e0b]') : (isDenial ? 'border-r-[#fca5a5]' : 'border-r-[#fde68a]');

  return (
    <div className="absolute right-[50%] top-1/2 -translate-y-1/2 flex items-center h-full z-0 whitespace-nowrap pr-[160px]">
       <div className={cn("bg-white border rounded-lg h-[54px] w-[150px] flex items-center relative overflow-hidden box-border shrink-0 transition-all", active ? `border-${isDenial?'rose':'amber'}-300 shadow-[0_0_15px_${isDenial?'rgba(244,63,94,0.3)':'rgba(245,158,11,0.3)'}] z-30` : "border-slate-200 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] z-20")}>
          <div className={cn(`absolute left-0 top-0 bottom-0 w-[5px] transition-colors`, lineColor)} />
          <div className="pl-[14px]">
             {isDenial ? <FileText className={`w-[18px] h-[18px] ${active ? 'text-rose-500' : 'text-slate-500'}`} strokeWidth={1.5} /> : <UserPlus className={`w-[18px] h-[18px] ${active ? 'text-amber-500' : 'text-slate-500'}`} strokeWidth={1.5} />}
          </div>
          <span className={cn("text-[13px] font-semibold tracking-tight ml-2.5 truncate pr-1 text-ellipsis overflow-hidden", active ? 'text-slate-900' : 'text-slate-700')}>{title}</span>
       </div>

       <div className={cn(`h-[1px] w-[70px] relative flex items-center shrink-0 z-0 transition-colors`, lineColor)}>
          <div className={cn(`absolute left-0 -ml-[4px] w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-r-[5px] transition-colors`, arrowColor)} />
          <div className="absolute left-[50%] -translate-x-1/2 -top-[21px] flex items-center justify-center">
             <div className="flex flex-col items-center bg-white border border-white leading-tight">
                <span className={cn("text-[10px] font-bold tracking-widest leading-none mb-0.5", active ? (isDenial ? 'text-rose-600' : 'text-amber-600') : 'text-[#94a3b8]')}>{result.split(' ')[0]}</span>
                <span className={cn("text-[10px] font-bold tracking-widest leading-none", active ? (isDenial ? 'text-rose-600' : 'text-amber-600') : 'text-[#94a3b8]')}>{result.split(' ')[1]}</span>
             </div>
          </div>
       </div>
    </div>
  );
}

export function PolicyCanvas({ policy, title, activeTestPath, selectedGateId, setSelectedGateId, zoom, isDraft, basePolicy }: any) {
  return (
      <div className="flex-1 overflow-auto p-4 md:p-8 relative node-canvas-bg z-0 lg:min-h-[900px] min-h-[1200px] flex justify-start md:justify-center items-start">
         {title && <div className="absolute top-4 left-6 py-1.5 px-3 bg-white border border-slate-200 rounded-lg shadow-sm z-10 font-bold text-slate-700 text-sm tracking-tight">{title}</div>}
         <div 
            className="flex flex-col items-center gap-0 relative pt-12 pb-32 w-[820px] shrink-0 transition-transform origin-top-left md:origin-top"
            style={{ transform: `scale(${zoom})` }}
         >
            
            <div className={`border ${activeTestPath.some((step:any) => step.startsWith('MET') || step.includes('NOT MET')) ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500' : 'border-emerald-400'} rounded-full pl-2 pr-6 py-2 flex items-center justify-center gap-3 bg-white w-auto z-10 relative shadow-sm h-[48px]`}>
               <div className="flex items-center justify-center text-emerald-500 bg-emerald-50 border border-emerald-100 rounded-full w-8 h-8 shrink-0"><Play className="w-[14px] h-[14px]" strokeWidth={2.5} fill="currentColor" /></div>
               <span className="font-bold text-slate-800 text-[14px]">Start</span>
            </div>

            <VerticalArrow active={activeTestPath.length > 0} />

            {policy?.gates?.map((gate: any, index: number) => {
               const traceMet = activeTestPath.some((step:any) => step.startsWith('MET: ' + gate.name));
               const traceNotMet = activeTestPath.some((step:any) => step.startsWith('NOT MET: ' + gate.name));
               const denialTitle = gate.notMetNode === 'AUTO_DENIAL' ? 'Auto Denial' : 'Manual Review';
               
               let isModified = false;
               if (isDraft && basePolicy) {
                  const baseGate = basePolicy.gates.find((g:any) => g.id === gate.id);
                  isModified = JSON.stringify(gate) !== JSON.stringify(baseGate);
               }

               return (
                 <React.Fragment key={gate.id}>
                   <div className="relative flex justify-center w-full z-10">
                      <HorizontalBranch 
                        title={denialTitle} 
                        targetType={gate.notMetNode} 
                        result="NOT MET" 
                        active={traceNotMet}
                      />
                      <GateNode 
                        title={gate.name} 
                        blockLabel={gate.blockLabel}
                        active={selectedGateId === gate.id}
                        testPassed={traceMet}
                        testFailed={traceNotMet}
                        onClick={() => setSelectedGateId(gate.id)}
                        isModified={isModified}
                      />
                   </div>
                   <VerticalArrow label="MET" active={traceMet} />
                 </React.Fragment>
               )
            })}

            <div className={`border ${activeTestPath.some((step:any) => step === 'AUTO_APPROVAL') || (activeTestPath.length > 0 && !activeTestPath.some((s:any) => s.startsWith('NOT MET'))) ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'border-slate-200'} rounded-lg pl-2 pr-5 py-3 flex items-center justify-center gap-3 bg-white w-[200px] z-10 relative shadow-sm h-[60px] transition-all`}>
               <div className="flex items-center justify-center text-emerald-500 bg-white border border-slate-100 rounded-md shadow-sm w-8 h-8"><CheckCircle className="w-[20px] h-[20px]" strokeWidth={2} /></div>
               <span className="font-semibold text-slate-800 text-[15px]">Auto Approval</span>
            </div>

         </div>
      </div>
  );
}

