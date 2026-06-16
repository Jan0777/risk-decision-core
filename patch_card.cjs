const fs = require('fs');
let code = fs.readFileSync('src/components/Chatbot.tsx', 'utf8');

const regexProposalCard = /const ProposalCard = \(\{\s*msg\s*\}\s*:\s*\{\s*msg:\s*Message\s*\}\)\s*=>\s*\{[\s\S]*?return null;\n\s*\};\n\n/m;

// Replace exactly ProposalCard definition.
const startIdx = code.indexOf('const ProposalCard = ({ msg }: { msg: Message }) => {');
const endIdx = code.indexOf('const onApplyProposal =', startIdx);
if (startIdx !== -1 && endIdx !== -1) {
    const proposalCardCode = `
   const ProposalCard = ({ msg }: { msg: Message }) => {
     if (!msg.proposal) return null;
     const p = msg.proposal as any;

     if (p.type === 'whatif-prompt') {
       return (
         <div className="mt-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm p-4 space-y-3">
             <div className="grid grid-cols-1 gap-2">
                 {["Tighten for lower risk", "Loosen for more approvals", "Target a specific approval rate", "Cut a specific reason-code's denials"].map(chip => (
                     <button key={chip} onClick={() => setInput(chip)} className="text-left px-3 py-2 text-sm bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition-colors">
                         {chip}
                     </button>
                 ))}
             </div>
             <p className="text-xs text-slate-500 italic">...or describe the change you want in the chat box below.</p>
         </div>
       );
     }
     
     if (p.type === 'whatif-proposal-plan' || p.type === 'whatif-result') {
        const isPending = p.status === 'PENDING';
        return (
         <div className="mt-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
               <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-indigo-800">
                  <PlayCircle className="w-3.5 h-3.5" />
                  What-If Analysis
               </span>
               {p.status === 'APPLIED' && <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full"><CheckCircle className="w-3.5 h-3.5 mr-1" /> Applied</span>}
               {p.status === 'RUNNING' && <span className="flex items-center text-xs font-bold text-indigo-600 bg-indigo-100 px-2.5 py-0.5 rounded-full">Running...</span>}
               {p.status === 'ANALYZING' && <span className="flex items-center text-xs font-bold text-indigo-600 bg-indigo-100 px-2.5 py-0.5 rounded-full">Analyzing...</span>}
            </div>
            <div className="p-4 space-y-4">
              {p.summary && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Proposed Changes</h4>
                    <p className="text-sm font-medium text-slate-800">{p.summary}</p>
                    {p.changes && p.changes.map((c:any, idx:number) => (
                       <div key={idx} className="mt-2 bg-slate-50 p-2.5 rounded border border-slate-100 text-xs">
                          <p className="font-semibold text-slate-700">{c.gate} - {c.segment}</p>
                          <div className="flex items-center gap-2 mt-1 whitespace-nowrap overflow-x-auto">
                             <span className="text-slate-500">{c.field}:</span>
                             <span className="line-through text-rose-500">{c.before}</span>
                             <span className="text-slate-400">→</span>
                             <span className="font-bold text-emerald-600">{c.after}</span>
                          </div>
                          {c.rationale && <p className="mt-1 text-slate-500 italic">"{c.rationale}"</p>}
                       </div>
                    ))}
                  </div>
              )}
              
              {p.type === 'whatif-proposal-plan' && (
                 <div className="pt-2 flex gap-2">
                    <button onClick={() => runPyodideSandbox(msg.id, p)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg text-sm transition-colors shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1">
                        Run in Sandbox
                    </button>
                    <button className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium py-2 rounded-lg text-sm transition-colors">
                        Adjust
                    </button>
                 </div>
              )}

              {p.swapset && (
                 <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Swapset Matrix</h4>
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                       <table className="w-full text-xs text-center border-collapse">
                          <thead>
                             <tr className="bg-slate-50">
                                <th className="border-b border-slate-200 p-2 text-slate-400 font-medium">B \\ D</th>
                                <th className="border-b border-l border-slate-200 p-2 text-emerald-600 font-semibold">Approve</th>
                                <th className="border-b border-l border-slate-200 p-2 text-amber-600 font-semibold">Review</th>
                                <th className="border-b border-l border-slate-200 p-2 text-rose-600 font-semibold">Deny</th>
                             </tr>
                          </thead>
                          <tbody>
                             {['AUTO_APPROVAL', 'MANUAL_REVIEW', 'AUTO_DENIAL'].map((bState, i) => (
                                <tr key={bState} className="border-b border-slate-100 last:border-b-0">
                                   <td className="p-2 border-r border-slate-100 text-left font-medium text-slate-600">
                                      {bState === 'AUTO_APPROVAL' ? 'Approve' : bState === 'MANUAL_REVIEW' ? 'Review' : 'Deny'}
                                   </td>
                                   {['AUTO_APPROVAL', 'MANUAL_REVIEW', 'AUTO_DENIAL'].map((dState, j) => {
                                      const val = p.swapset[bState][dState];
                                      const isGained = bState !== 'AUTO_APPROVAL' && dState === 'AUTO_APPROVAL';
                                      const isLost = bState === 'AUTO_APPROVAL' && dState !== 'AUTO_APPROVAL';
                                      return (
                                        <td key={dState} className={"p-2 border-r border-slate-100 last:border-r-0 font-mono " + (i === j ? "text-slate-400 bg-slate-50/50" : (isGained ? "text-emerald-600 font-bold bg-emerald-50/30" : isLost ? "text-rose-600 font-bold bg-rose-50/30" : "text-amber-600 bg-amber-50/30"))}>
                                           {val}
                                        </td>
                                      )
                                   })}
                                </tr>
                             ))}
                          </tbody>
                       </table>
                       <div className="bg-slate-50 text-[10px] text-slate-500 font-mono text-center p-1.5 border-t border-slate-100">
                          Σ = 5000 ✓
                       </div>
                    </div>
                 </div>
              )}

              {p.analysis && (
                 <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tradeoff Analysis</h4>
                    <div className="prose prose-sm prose-slate max-w-none text-sm text-slate-600 leading-relaxed">
                       <Markdown>{p.analysis}</Markdown>
                    </div>
                 </div>
              )}

              {p.terminalOutput && (
                 <div className="rounded-lg overflow-hidden border border-slate-800">
                    <div className="bg-slate-900 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between cursor-pointer" onClick={(e) => {
                       const el = e.currentTarget.nextElementSibling;
                       if (el) el.classList.toggle('hidden');
                    }}>
                       <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Python Sandbox Log (Pyodide)</span>
                       <span className="text-[10px] text-slate-500">Toggle Terminal</span>
                    </div>
                    <div className="bg-black p-3 max-h-48 overflow-y-auto">
                       <pre className="text-[10px] font-mono text-emerald-400 leading-tight whitespace-pre-wrap">{p.terminalOutput}</pre>
                    </div>
                 </div>
              )}

              {isPending && (
                 <div className="pt-2">
                    {p.draftPolicy && (
                       <>
                       <button onClick={() => {
                          localStorage.setItem('cu_base_policy', JSON.stringify(p.draftPolicy));
                          localStorage.removeItem('cu_draft_policy');
                          window.dispatchEvent(new Event('policyUpdated'));
                          onApplyProposal(msg.id);
                       }} className="w-full mb-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg text-sm transition-colors shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1">
                          Commit Changes to Policy
                       </button>
                       <button onClick={() => {
                          localStorage.setItem('cu_draft_policy', JSON.stringify(p.draftPolicy));
                          window.dispatchEvent(new Event('policyUpdated'));
                       }} className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium py-2 rounded-lg text-sm transition-colors">
                          Preview Draft in Canvas
                       </button>
                       </>
                    )}
                 </div>
              )}
            </div>
         </div>
        );
     }

     return null;
   };

`;
    code = code.substring(0, startIdx) + proposalCardCode + code.substring(endIdx);
    fs.writeFileSync('src/components/Chatbot.tsx', code);
}
