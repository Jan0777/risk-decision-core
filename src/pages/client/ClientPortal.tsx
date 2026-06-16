import React, { useState } from 'react';
import { Building, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { NavLink } from 'react-router-dom';

export function ClientPortal() {
  const [formData, setFormData] = useState({
    applicant: '',
    email: '',
    ssn: '',
    income: '',
    requestedAmount: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           applicant: formData.applicant,
           requestedAmount: Number(formData.requestedAmount)
        })
      });
      if (res.ok) {
        setSuccess(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
       <header className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
             <div className="flex items-center">
                <Building className="w-6 h-6 text-indigo-600 mr-2" />
                <span className="font-semibold text-lg text-slate-800">Acme Credit Union</span>
             </div>
             <NavLink to="/admin" className="text-sm font-medium text-slate-500 hover:text-indigo-600">
                Staff Login
             </NavLink>
          </div>
       </header>

       <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full">
            {success ? (
               <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center animate-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                     <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Received</h2>
                  <p className="text-slate-600 mb-8">We've securely received your personal loan request. Our automated systems are reviewing it right now.</p>
                  <button 
                    onClick={() => { setSuccess(false); setFormData({ applicant: '', email: '', ssn: '', income: '', requestedAmount: '' }); }}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition-colors"
                  >
                    Submit Another Application
                  </button>
               </div>
            ) : (
             <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
                <div className="mb-8">
                   <h1 className="text-2xl font-bold text-slate-900">Personal Loan Application</h1>
                   <p className="text-slate-500 mt-2 text-sm">Secure, fast, and transparent decisioning.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">Full Legal Name</label>
                     <input 
                       required value={formData.applicant} onChange={e => setFormData({...formData, applicant: e.target.value})}
                       className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                       placeholder="e.g. Jane Doe"
                     />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Annual Income</label>
                       <div className="relative">
                         <span className="absolute left-4 top-2.5 text-slate-400">$</span>
                         <input 
                           required type="number" value={formData.income} onChange={e => setFormData({...formData, income: e.target.value})}
                           className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                           placeholder="0"
                         />
                       </div>
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Loan Amount</label>
                       <div className="relative">
                         <span className="absolute left-4 top-2.5 text-slate-400">$</span>
                         <input 
                           required type="number" value={formData.requestedAmount} onChange={e => setFormData({...formData, requestedAmount: e.target.value})}
                           className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                           placeholder="0"
                         />
                       </div>
                     </div>
                   </div>
                   
                   <div className="pt-4">
                     <button 
                       type="submit" 
                       disabled={submitting}
                       className="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl shadow-md transition-all disabled:opacity-70"
                     >
                       {submitting ? 'Processing securely...' : (
                          <>
                             Submit Application
                             <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                       )}
                     </button>
                   </div>
                   <div className="flex items-center justify-center text-xs text-slate-400 mt-6">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      256-bit bank-grade encryption
                   </div>
                </form>
             </div>
            )}
          </div>
       </main>
    </div>
  );
}
