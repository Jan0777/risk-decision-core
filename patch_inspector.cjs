const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/InspectorPanel.tsx', 'utf8');

// 1. Add baseGate to props
code = code.replace(
  `export function InspectorPanel({ 
   gate, 
   updateGate,
   onClose 
}: { 
   gate: Gate, 
   updateGate: (updated: Gate) => void,
   onClose: () => void 
})`,
  `export function InspectorPanel({ 
   gate, 
   baseGate,
   updateGate,
   onClose 
}: { 
   gate: Gate, 
   baseGate?: Gate | null,
   updateGate: (updated: Gate) => void,
   onClose: () => void 
})`
);

// 2. Add visual indicator for segment
const segHeaderRegex = /<span className="font-semibold text-slate-800 tracking-tight">\{segment.name\}<\/span>/;
code = code.replace(segHeaderRegex, `{(() => {
    let sBadge = null;
    if (baseGate) {
        const bSeg = baseGate.segments.find(s => s.id === segment.id);
        if (!bSeg) sBadge = <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold px-1.5 rounded-sm">Added</span>;
        else if (JSON.stringify(bSeg) !== JSON.stringify(segment)) sBadge = <span className="bg-orange-100 text-orange-700 text-[10px] uppercase font-bold px-1.5 rounded-sm">Modified</span>;
    }
    return <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-800 tracking-tight">{segment.name}</span>
        {sBadge}
    </div>;
})()}`);

// 3. Strikethrough for changed fields
// In the <input> for rhs value:
const rhsRegex = /\{cond\.operator !== 'is None' && cond\.operator !== 'is Not None' && \(\s*<input[^>]+>\s*\)\}/;
code = code.replace(rhsRegex, `{cond.operator !== 'is None' && cond.operator !== 'is Not None' && (() => {
    let oldRhs = null;
    if (baseGate) {
        const bSeg = baseGate.segments.find(s => s.id === segment.id);
        if (bSeg) {
            const bRule = bSeg.rules.find(r => r.id === rule.id);
            if (bRule) {
                const bCond = bRule.conditions.find(c => c.id === cond.id);
                if (bCond && bCond.rhs !== cond.rhs) oldRhs = bCond.rhs;
            }
        }
    }
    return (
        <div className="flex items-center gap-1.5">
           {oldRhs !== null && <span className="text-rose-500 line-through font-mono text-sm">{oldRhs}</span>}
           {oldRhs !== null && <span className="text-slate-400">→</span>}
           <input 
               type="text" 
               value={cond.rhs?.toString() || ''}
               onChange={(e) => {
                  const val = e.target.value;
                  handleRuleConditionUpdate(sIdx, rIdx, cIdx, { rhs: isNaN(Number(val)) ? val : Number(val) });
               }}
               className={cn("font-mono text-sm border-b border-dashed outline-none w-16 px-1 focus:border-indigo-500 hover:bg-slate-50", oldRhs !== null ? "text-emerald-600 font-bold border-emerald-300" : "text-slate-800 border-slate-300")}
           />
        </div>
    );
})()}`);

fs.writeFileSync('src/pages/admin/InspectorPanel.tsx', code);
