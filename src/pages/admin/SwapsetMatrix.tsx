import React, { useState } from 'react';
import { ArrowRight, Loader2, Play } from 'lucide-react';
import { getApplicants } from '../../lib/dataService';
import { evaluatePolicy } from '../../lib/engine';
import { POLICY_OPTIMIZED_INDIRECT_USED_AUTO } from '../../lib/seedPolicy';
import { Policy } from '../../lib/types';
import { cn } from '../../lib/utils';

export function SwapsetMatrix({ draftPolicy, onAnalysisComplete }: { draftPolicy: Policy, onAnalysisComplete?: (text: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [matrix, setMatrix] = useState<any>(null);

  const runWhatIf = async () => {
    setLoading(true);
    
    // Slight artificial delay
    await new Promise(r => setTimeout(r, 600));

    const applicants = getApplicants().slice(0, 5000); // sample
    
    let uu = 0, ud = 0, ur = 0; // baseline Auto Approve
    let ru = 0, rd = 0, rr = 0; // baseline Manual Review
    let du = 0, dd = 0, dr = 0; // baseline Auto Deny

    const basePolicy = localStorage.getItem('cu_base_policy') ? JSON.parse(localStorage.getItem('cu_base_policy')!) : POLICY_OPTIMIZED_INDIRECT_USED_AUTO;

    applicants.forEach(app => {
      const baseline = evaluatePolicy(basePolicy, app).final_decision;
      const draft = evaluatePolicy(draftPolicy, app).final_decision;

      if (baseline === 'AUTO_APPROVAL') {
        if (draft === 'AUTO_APPROVAL') uu++;
        else if (draft === 'AUTO_DENIAL') ud++;
        else ur++;
      } else if (baseline === 'MANUAL_REVIEW') {
        if (draft === 'AUTO_APPROVAL') ru++;
        else if (draft === 'AUTO_DENIAL') rd++;
        else rr++;
      } else { // AUTO_DENIAL
        if (draft === 'AUTO_APPROVAL') du++;
        else if (draft === 'AUTO_DENIAL') dd++;
        else dr++;
      }
    });

    setMatrix({
      unchanged_auto_approval: uu,
      approval_to_manual_review: ur,
      approval_lost: ud,
      manual_review_to_approval: ru,
      unchanged_manual_review: rr,
      manual_review_to_denial: rd,
      approval_gained: du,
      denial_to_manual_review: dr,
      unchanged_auto_denial: dd,
      total: applicants.length
    });

    setLoading(false);

    if (onAnalysisComplete) {
       onAnalysisComplete(`What-If run complete. ${ud} approvals lost to denial. ${ru} reviews turned to approvals.`);
    }
  };

  return (
    <div className="bg-white border flex-1 border-slate-200 rounded-xl shadow-sm p-6 overflow-hidden flex flex-col">
       <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-slate-800 text-lg tracking-tight">What-If Analysis</h3>
            <p className="text-slate-500 text-sm">Compare draft policy outcomes against baseline.</p>
          </div>
          <button onClick={runWhatIf} disabled={loading} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" fill="currentColor" />}
            Run What-If
          </button>
       </div>

       {matrix ? (
       <div className="flex-1 overflow-auto">
          <div className="mb-4 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 relative">
             <span className="font-semibold text-slate-800">Swapset Matrix</span> (Sample size: {matrix.total})
             <p className="mt-1">Rows: Baseline outcome. Columns: Draft outcome.</p>
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="border border-slate-200 p-3 bg-slate-50 text-slate-500"></th>
                <th className="border border-slate-200 p-3 bg-slate-50 font-semibold text-slate-800">Draft: Approve</th>
                <th className="border border-slate-200 p-3 bg-slate-50 font-semibold text-slate-800">Draft: Review</th>
                <th className="border border-slate-200 p-3 bg-slate-50 font-semibold text-slate-800">Draft: Deny</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-200 p-3 font-semibold bg-slate-50 text-slate-800">Base: Approve</td>
                <td className={cn("border border-slate-200 p-3 text-center", matrix.unchanged_auto_approval > 0 ? "bg-emerald-50 text-emerald-700 font-bold" : "")}>{matrix.unchanged_auto_approval}</td>
                <td className={cn("border border-slate-200 p-3 text-center", matrix.approval_to_manual_review > 0 ? "bg-amber-50 text-amber-700 font-bold" : "")}>{matrix.approval_to_manual_review}</td>
                <td className={cn("border border-slate-200 p-3 text-center", matrix.approval_lost > 0 ? "bg-rose-50 text-rose-700 font-bold" : "")}>{matrix.approval_lost}</td>
              </tr>
              <tr>
                <td className="border border-slate-200 p-3 font-semibold bg-slate-50 text-slate-800">Base: Review</td>
                <td className={cn("border border-slate-200 p-3 text-center", matrix.manual_review_to_approval > 0 ? "bg-emerald-50 text-emerald-700 font-bold" : "")}>{matrix.manual_review_to_approval}</td>
                <td className={cn("border border-slate-200 p-3 text-center", matrix.unchanged_manual_review > 0 ? "text-slate-700 font-bold" : "")}>{matrix.unchanged_manual_review}</td>
                <td className={cn("border border-slate-200 p-3 text-center", matrix.manual_review_to_denial > 0 ? "bg-rose-50 text-rose-700 font-bold" : "")}>{matrix.manual_review_to_denial}</td>
              </tr>
              <tr>
                <td className="border border-slate-200 p-3 font-semibold bg-slate-50 text-slate-800">Base: Deny</td>
                <td className={cn("border border-slate-200 p-3 text-center", matrix.approval_gained > 0 ? "bg-emerald-50 text-emerald-700 font-bold" : "")}>{matrix.approval_gained}</td>
                <td className={cn("border border-slate-200 p-3 text-center", matrix.denial_to_manual_review > 0 ? "bg-amber-50 text-amber-700 font-bold" : "")}>{matrix.denial_to_manual_review}</td>
                <td className={cn("border border-slate-200 p-3 text-center", matrix.unchanged_auto_denial > 0 ? "text-slate-700 font-bold" : "")}>{matrix.unchanged_auto_denial}</td>
              </tr>
            </tbody>
          </table>
       </div>
       ) : (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
             <div className="text-slate-400 mb-2"><ArrowRight className="w-8 h-8"/></div>
             <p className="text-slate-500 font-medium text-sm">Run What-If to generate Swapset Matrix</p>
          </div>
       )}
    </div>
  );
}
