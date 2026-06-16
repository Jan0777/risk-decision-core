const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/WorkflowEditor.tsx', 'utf8');

// Add showComparison state
code = code.replace(
  `const [chatExpanded, setChatExpanded] = useState(false);`,
  `const [chatExpanded, setChatExpanded] = useState(false);\n  const [showComparison, setShowComparison] = useState(true);`
);

// Replace the UI area
const topAreaRegex = /<div className="absolute top-6 left-6 z-20">([\s\S]*?)<\/div>/;
const replacementTop = `<div className="absolute top-6 left-6 z-20 flex flex-col gap-3">
$1
         {draftPolicy && (
             <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
               <input type="checkbox" checked={showComparison} onChange={(e) => setShowComparison(e.target.checked)} className="form-checkbox h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
               <span className="text-[13px] font-semibold text-slate-700">View What-If Comparison</span>
             </label>
         )}
      </div>`;
code = code.replace(topAreaRegex, replacementTop);

// Replace {draftPolicy ? (
code = code.replace(
  `{draftPolicy ? (
         <div className="flex-1 flex overflow-hidden">`,
  `{draftPolicy && showComparison ? (
         <div className="flex-1 flex overflow-hidden">`
);

fs.writeFileSync('src/pages/admin/WorkflowEditor.tsx', code);
