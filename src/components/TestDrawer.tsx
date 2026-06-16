import React, { useState } from 'react';
import { X, PlayCircle, Loader2 } from 'lucide-react';
import { evaluatePolicy } from '../lib/engine';
import { FEATURE_REGISTRY, Policy, DecisionResult } from '../lib/types';
import { setGlobalTestResult } from '../pages/admin/WorkflowEditor';
import { POLICY_OPTIMIZED_INDIRECT_USED_AUTO } from '../lib/seedPolicy';

const TEST_CASES = [
  {
    name: 'A) High Score (Auto Approval expected)',
    data: { requested_amount: 5000, ltv_ratio: 1.33, projected_di: 0.10, age_of_vehicle: 13, vehicle_mileage: 202565, term: 48, custom_score: 750, primary_applicant_primary_score: 700 }
  },
  {
    name: 'B) Fails Hard Rule (Auto Denial expected)',
    data: { requested_amount: 44480, ltv_ratio: 1.17, projected_di: 0.23, age_of_vehicle: 3, vehicle_mileage: 42451, term: 48, custom_score: 650, primary_applicant_primary_score: 520, num_bankruptcies: 1 }
  },
  {
    name: 'C) Passes Hard, Fails Soft (Manual Review expected)',
    data: { requested_amount: 12751, ltv_ratio: 1.38, projected_di: 1.10, age_of_vehicle: 13, vehicle_mileage: 170249, term: 84, custom_score: 650, primary_applicant_primary_score: 650, num_bankruptcies: 0, foreclosures: 0, repossessions: 0, charge_offs: 0, tax_liens: 0, collection_balance: 0, '30dpd_24m': 0, '60dpd_24m': 0, '90dpd_24m': 0, num_inquiries: 2 }
  },
  {
    name: 'D) Non Scorable',
    data: { custom_score: '', primary_applicant_primary_score: '' }
  }
];

export function TestDrawer({ onClose }: { onClose: () => void }) {
  const [applicantData, setApplicantData] = useState<Record<string, string | number>>(
    FEATURE_REGISTRY.reduce((acc, feat) => ({ ...acc, [feat.name]: '' }), {})
  );

  const [result, setResult] = useState<DecisionResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Clear global test result on unmount
  React.useEffect(() => {
    return () => setGlobalTestResult(null);
  }, []);

  const loadTestCase = (tc: any) => {
     setApplicantData(prev => ({ ...prev, ...tc.data }));
  };

  const handleTest = () => {
    setLoading(true);
    setTimeout(() => {
      const parsedData = Object.fromEntries(
        Object.entries(applicantData).filter(([k,v]) => v !== '').map(([k, v]) => [k, Number(v)])
      );
      // For non-scorable tests, explicitly unset keys if they were blank string
      if (applicantData.custom_score === '') delete parsedData.custom_score;
      if (applicantData.primary_applicant_primary_score === '') delete parsedData.primary_applicant_primary_score;
      
      const basePolicy = localStorage.getItem('cu_base_policy') ? JSON.parse(localStorage.getItem('cu_base_policy')!) : POLICY_OPTIMIZED_INDIRECT_USED_AUTO;
      const res = evaluatePolicy(basePolicy, parsedData);
      setResult(res);
      setGlobalTestResult(res);
      setLoading(false);
    }, 400);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl border-l border-slate-200 z-[60] flex flex-col animate-in slide-in-from-right-16 duration-300">
      <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Test an Applicant</h2>
          <p className="text-slate-500 text-sm mt-0.5">Evaluate the current draft policy.</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {result ? (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className={`p-5 rounded-xl border ${result.final_decision === 'AUTO_APPROVAL' ? 'bg-emerald-50 border-emerald-200' : result.final_decision === 'AUTO_DENIAL' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
              <h3 className="text-sm font-semibold text-slate-500 mb-1 tracking-wider uppercase">Final Decision</h3>
              <div className={`text-2xl font-bold ${result.final_decision === 'AUTO_APPROVAL' ? 'text-emerald-700' : result.final_decision === 'AUTO_DENIAL' ? 'text-rose-700' : 'text-amber-700'}`}>
                 {result.final_decision.replace('_', ' ')}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                 <div className="flex justify-between border-b border-black/5 pb-2">
                    <span className="text-slate-600">Reason Code</span>
                    <span className="font-semibold text-slate-900">{result.decision_reason_code || 'N/A'}</span>
                 </div>
                 <div className="flex justify-between border-b border-black/5 pb-2">
                    <span className="text-slate-600">Risk Band</span>
                    <span className="font-semibold text-slate-900">{result.risk_band || 'N/A'}</span>
                 </div>
              </div>
            </div>

            <div>
               <h3 className="font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-3">Execution Path Trace</h3>
               <div className="space-y-2">
                 {result.path.map((step, i) => (
                   <div key={i} className="flex gap-3 text-sm">
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full mt-1 ${step.includes('NOT MET') ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        {i !== result.path.length - 1 && <div className="w-px h-full bg-slate-200 my-1" />}
                      </div>
                      <div className="pb-3 text-slate-700 font-medium">
                        {step}
                      </div>
                   </div>
                 ))}
               </div>
            </div>

            <button 
              onClick={() => setResult(null)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-lg transition-colors border border-slate-200 shadow-sm"
            >
              Run Another Test
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Load Test Case</h3>
              <div className="flex flex-col gap-2">
                 {TEST_CASES.map((tc, idx) => (
                    <button key={idx} onClick={() => loadTestCase(tc)} className="text-left text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-3 py-2 transition-colors font-medium text-slate-700">
                       {tc.name}
                    </button>
                 ))}
              </div>
            </div>
            <form className="space-y-4">
               {FEATURE_REGISTRY.map(feature => (
                 <div key={feature.name}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {feature.name} <span className="text-slate-400 text-xs font-normal">({feature.description})</span>
                    </label>
                    <input
                      type="number"
                      value={applicantData[feature.name] || ''}
                      onChange={e => setApplicantData({ ...applicantData, [feature.name]: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm"
                      placeholder={`Enter numeric value...`}
                    />
                 </div>
               ))}
            </form>
          </div>
        )}
      </div>

      {!result && (
        <div className="p-5 border-t border-slate-200 bg-slate-50 shrink-0">
          <button 
            onClick={handleTest}
            disabled={loading}
            className="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl shadow-md transition-all disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                 <PlayCircle className="w-5 h-5 mr-2" />
                 Evaluate Policy Engine
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
