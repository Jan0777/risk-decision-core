import React, { useState } from 'react';
import { Workflow, ChevronDown, Copy, Plus, Trash2, X } from 'lucide-react';
import { Gate, Segment, Rule, Operator, FEATURE_REGISTRY, REASON_CODES, Condition } from '../../lib/types';
import { cn } from '../../lib/utils';

export function InspectorPanel({ 
   gate, 
   baseGate,
   updateGate,
   onClose 
}: { 
   gate: Gate, 
   baseGate?: Gate | null,
   updateGate: (updated: Gate) => void,
   onClose: () => void 
}) {
   
   const handleSegmentUpdate = (segmentIndex: number, updated: Partial<Segment>) => {
      const newSegments = [...gate.segments];
      newSegments[segmentIndex] = { ...newSegments[segmentIndex], ...updated };
      updateGate({ ...gate, segments: newSegments });
   };

   const handleSegmentConditionUpdate = (segIdx: number, condIdx: number, updated: Partial<Condition>) => {
      const newSegments = [...gate.segments];
      const newConds = [...newSegments[segIdx].conditions];
      newConds[condIdx] = { ...newConds[condIdx], ...updated };
      newSegments[segIdx].conditions = newConds;
      updateGate({ ...gate, segments: newSegments });
   };

   const handleRuleUpdate = (segmentIndex: number, ruleIndex: number, updated: Partial<Rule>) => {
      const newSegments = [...gate.segments];
      const newRules = [...newSegments[segmentIndex].rules];
      newRules[ruleIndex] = { ...newRules[ruleIndex], ...updated };
      newSegments[segmentIndex].rules = newRules;
      updateGate({ ...gate, segments: newSegments });
   };

   const handleRuleConditionUpdate = (segIdx: number, ruleIdx: number, condIdx: number, updated: Partial<Condition>) => {
      const newSegments = [...gate.segments];
      const newRules = [...newSegments[segIdx].rules];
      const newConds = [...newRules[ruleIdx].conditions];
      newConds[condIdx] = { ...newConds[condIdx], ...updated };
      newRules[ruleIdx].conditions = newConds;
      newSegments[segIdx].rules = newRules;
      updateGate({ ...gate, segments: newSegments });
   };

   return (
      <div className="w-full sm:w-[500px] md:w-[580px] border-l border-slate-200 shadow-2xl flex flex-col absolute right-0 top-0 bottom-0 z-30 overflow-hidden text-sm bg-white animate-in slide-in-from-right-8 duration-200">
         {/* Sidebar Header */}
         <div className="h-[64px] border-b border-slate-200 flex items-center justify-between px-5 shrink-0 bg-white">
            <div className="flex items-center gap-3">
               <div className="bg-[#f0f9ff] p-2 rounded-lg">
                  <Workflow className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
               </div>
               <span className="font-semibold text-slate-800 text-[16px]">{gate.name}</span>
            </div>
            <div className="flex items-center gap-5">
               <div className="flex items-center gap-2 cursor-pointer" onClick={() => updateGate({...gate, segmentationEnabled: !gate.segmentationEnabled})}>
                  <div className={cn("w-9 h-5 rounded-full relative transition-colors", gate.segmentationEnabled ? "bg-blue-500" : "bg-slate-300")}>
                     <div className={cn("w-[14px] h-[14px] bg-white rounded-full absolute top-[3px] shadow-sm transition-all", gate.segmentationEnabled ? "right-[3px]" : "left-[3px]")}></div>
                  </div>
                  <span className="text-[13px] font-medium text-slate-700">Segmentation</span>
               </div>
               <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>
               <button onClick={onClose} className="p-1.5 flex items-center gap-1.5 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded transition-colors" title="Close Panel">
                  <span className="text-xs font-semibold uppercase tracking-wider hidden sm:block">Close</span>
                  <X className="w-5 h-5" />
               </button>
            </div>
         </div>

         {/* Content container */}
         <div className="flex-1 overflow-y-auto bg-white p-6 space-y-8">
            
            {gate.segments.map((segment, sIdx) => (
               <div key={segment.id} className="space-y-6">
                  {/* Segment Header and Condition */}
                  <div>
                     <div className="flex items-center gap-2 mb-3">
                        <ChevronDown className="w-5 h-5 text-slate-500" />
                        <span className="font-semibold text-slate-800 text-[15px] tracking-tight">{segment.name}</span>
                        <div className="ml-auto p-1.5 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer shadow-sm"> 
                           <Copy className="w-3 h-3 text-slate-400" /> 
                        </div>
                     </div>
                     <div className="flex flex-col gap-2 ml-7">
                        {segment.conditions.map((cond, cIdx) => (
                           <div key={cond.id} className="flex items-center gap-3 flex-wrap group">
                              {cIdx === 0 ? (
                                 <span className="bg-[#f8f9fa] border border-slate-200 text-slate-500 font-mono text-[11px] px-2 py-0.5 rounded shadow-sm font-semibold tracking-wider">IF</span>
                              ) : (
                                 <div className="bg-[#fffbeb] border border-[#fde68a] text-[#d97706] font-mono text-xs px-2.5 py-1 rounded shadow-sm outline-none">
                                    {segment.conditionLogic}
                                 </div>
                              )}
                              
                              <select 
                                 value={cond.lhs}
                                 onChange={(e) => handleSegmentConditionUpdate(sIdx, cIdx, { lhs: e.target.value })}
                                 className="bg-[#fffbeb] border border-[#fde68a] text-[#d97706] font-mono text-xs px-2.5 py-1 rounded shadow-sm outline-none cursor-pointer hover:border-[#fcd34d]"
                              >
                                 {FEATURE_REGISTRY.map(f => <option key={f.name} value={f.name}>{f.name} ({f.version})</option>)}
                              </select>
                              
                              <select 
                                 value={cond.operator}
                                 onChange={(e) => handleSegmentConditionUpdate(sIdx, cIdx, { operator: e.target.value as Operator })}
                                 className="text-slate-600 font-mono text-sm bg-transparent border-none outline-none cursor-pointer"
                              >
                                 <option value="<">{'<'}</option>
                                 <option value="<=">{'<='}</option>
                                 <option value="==">==</option>
                                 <option value=">=">{'>='}</option>
                                 <option value=">">{'>'}</option>
                                 <option value="!=">!=</option>
                                 <option value="is None">is None</option>
                                 <option value="is Not None">is Not None</option>
                              </select>
                              
                              {cond.operator !== 'is None' && cond.operator !== 'is Not None' && (
                                 <input 
                                    type="text" 
                                    value={cond.rhs?.toString() || ''}
                                    onChange={(e) => {
                                       const val = e.target.value;
                                       handleSegmentConditionUpdate(sIdx, cIdx, { rhs: isNaN(Number(val)) ? val : Number(val) });
                                    }}
                                    className="text-slate-800 font-mono text-sm border-b border-dashed border-slate-300 outline-none w-16 px-1 focus:border-indigo-500 hover:bg-slate-50"
                                 />
                              )}
                              <button onClick={() => {
                                 const newCond = [...segment.conditions];
                                 newCond.splice(cIdx, 1);
                                 handleSegmentUpdate(sIdx, { conditions: newCond });
                              }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                           </div>
                        ))}
                     </div>
                     
                     <button onClick={() => {
                        const newCond = [...segment.conditions, { id: Date.now().toString(), lhs: 'custom_score', operator: '==' }];
                        handleSegmentUpdate(sIdx, { conditions: newCond as Condition[] });
                     }} className="text-[11px] text-blue-600 font-medium flex items-center hover:opacity-80 mt-2 ml-7"><Plus className="w-3 h-3 mr-1"/> Add Condition</button>
                  </div>

                  {/* Rules */}
                  <div className="ml-7">
                     <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-slate-900 text-[13px] tracking-wider uppercase">Rules</h4>
                        <button onClick={() => {
                           const newRules = [...segment.rules, { id: Date.now().toString(), name: 'New Rule', passLogic: 'AND', conditions: [] }];
                           handleSegmentUpdate(sIdx, { rules: newRules as Rule[] });
                        }} className="text-[12px] text-blue-600 font-medium flex items-center hover:opacity-80"><Plus className="w-3.5 h-3.5 mr-1"/> Add Rule</button>
                     </div>
                     
                     <div className="space-y-4">
                        {segment.rules.map((rule, rIdx) => (
                           <div key={rule.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                              {/* Rule Header */}
                              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-[#f8f9fa]">
                                 <ChevronDown className="w-[18px] h-[18px] text-slate-500" />
                                 <span className="bg-white border border-slate-200 text-slate-500 font-mono text-[10px] px-1.5 py-0.5 rounded shadow-[0_1px_2px_rgba(0,0,0,0.05)] font-bold">IF</span>
                                 <input 
                                    value={rule.name}
                                    onChange={(e) => handleRuleUpdate(sIdx, rIdx, { name: e.target.value })}
                                    className="font-semibold text-slate-800 text-[14px] tracking-tight bg-transparent border-none outline-none w-full hover:bg-white px-1 py-0.5 rounded"
                                 />
                                 <div className="p-1 border border-slate-200 hover:bg-white rounded cursor-pointer shadow-sm bg-white shrink-0"> 
                                    <Copy className="w-3.5 h-3.5 text-slate-400" /> 
                                 </div>
                              </div>

                              {/* Rule Body */}
                              <div className="p-5">
                                 
                                 <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                       <span className="text-xs font-semibold text-slate-500 uppercase">Reason Code (on failure)</span>
                                    </div>
                                    <select 
                                       value={rule.reasonCode || ''}
                                       onChange={(e) => handleRuleUpdate(sIdx, rIdx, { reasonCode: e.target.value })}
                                       className="w-full bg-[#f8f9fa] border border-slate-200 text-slate-700 text-xs px-2.5 py-1.5 rounded outline-none"
                                    >
                                       <option value="">None</option>
                                       {REASON_CODES.map(rc => <option key={rc} value={rc}>{rc}</option>)}
                                    </select>
                                 </div>

                                 <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-slate-500 uppercase">Conditions ({rule.passLogic})</span>
                                    <button onClick={() => {
                                       const newCond = [...rule.conditions, { id: Date.now().toString(), lhs: 'custom_score', operator: '==' }];
                                       handleRuleUpdate(sIdx, rIdx, { conditions: newCond as Condition[] });
                                    }} className="text-[11px] text-blue-600 font-medium flex items-center"><Plus className="w-3 h-3 mr-1"/> Add Condition</button>
                                 </div>
                                 
                                 <div className="space-y-2">
                                 {rule.conditions.map((cond, cIdx) => (
                                 <div key={cond.id} className="flex items-center gap-3 flex-wrap group">
                                    <span className="bg-[#f8f9fa] border border-slate-200 text-slate-500 font-mono text-[11px] px-1.5 py-0.5 rounded shadow-sm font-semibold tracking-wider">
                                       {cIdx === 0 ? 'IF' : rule.passLogic}
                                    </span>
                                    
                                    <select 
                                       value={cond.lhs}
                                       onChange={(e) => handleRuleConditionUpdate(sIdx, rIdx, cIdx, { lhs: e.target.value })}
                                       className="bg-[#fffbeb] border border-[#fde68a] text-[#d97706] font-mono text-xs px-2.5 py-1 rounded shadow-sm outline-none cursor-pointer hover:border-[#fcd34d]"
                                    >
                                       {FEATURE_REGISTRY.map(f => <option key={f.name} value={f.name}>{f.name} ({f.version})</option>)}
                                    </select>
                                    
                                    <select 
                                       value={cond.operator}
                                       onChange={(e) => handleRuleConditionUpdate(sIdx, rIdx, cIdx, { operator: e.target.value as Operator })}
                                       className="text-slate-600 font-mono text-sm bg-transparent border-none outline-none cursor-pointer"
                                    >
                                       <option value="<">{'<'}</option>
                                       <option value="<=">{'<='}</option>
                                       <option value="==">==</option>
                                       <option value=">=">{'>='}</option>
                                       <option value=">">{'>'}</option>
                                       <option value="!=">!=</option>
                                       <option value="is None">is None</option>
                                       <option value="is Not None">is Not None</option>
                                    </select>
                                    
                                    {cond.operator !== 'is None' && cond.operator !== 'is Not None' && (
                                    <input 
                                       type="text" 
                                       value={cond.rhs?.toString() || ''}
                                       onChange={(e) => {
                                          const val = e.target.value;
                                          handleRuleConditionUpdate(sIdx, rIdx, cIdx, { rhs: isNaN(Number(val)) ? val : Number(val) });
                                       }}
                                       className="text-slate-800 font-mono text-sm border-b border-dashed border-slate-300 outline-none w-16 px-1 focus:border-indigo-500 hover:bg-slate-50"
                                    />
                                    )}
                                    <button onClick={() => {
                                       const newCond = [...rule.conditions];
                                       newCond.splice(cIdx, 1);
                                       handleRuleUpdate(sIdx, rIdx, { conditions: newCond });
                                    }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                                 </div>
                                 ))}
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* Footer */}
         <div className="border-t border-slate-200 px-6 py-4 shrink-0 text-[13.5px] text-slate-600 bg-slate-50 flex items-center justify-between">
            <div>
               <span className="font-bold text-slate-800">IF</span> Conditions are met, <span className="font-bold text-slate-800">THEN</span> Proceed to next <span className="font-bold text-slate-800">ELSE</span> Go to <span className="font-bold text-slate-800">{gate.notMetNode.replace('_', ' ')}</span>
            </div>
         </div>
      </div>
   );
}
