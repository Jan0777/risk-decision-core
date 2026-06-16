import { MemoryStore } from './assistantMemory';

export interface CandidateChange {
  targetField: string; // e.g. "score", "dti", "zip"
  targetValue: any;
  changeType: 'threshold' | 'structural' | 'new_feature' | 'reason_code';
  direction?: 'up' | 'down';
}

export function checkProposal(candidateChange: CandidateChange) {
  const mems = MemoryStore.getMemories();
  
  const hardViolations: string[] = [];
  const softWarnings: any[] = [];
  let priorRejection = null;
  let requiredWorkflow = null;

  // 1. Hard Violations (BoardMandatedLimit, ComplianceRule)
  const boardLimits = mems.filter(m => m.type === 'BoardMandatedLimit' && m.target === candidateChange.targetField);
  for (const limit of boardLimits) {
      if (limit.bound.operator === '>=') {
          if (typeof candidateChange.targetValue === 'number' && candidateChange.targetValue < limit.bound.value) {
              hardViolations.push(`Breaches Board Limit: ${limit.note}`);
          }
      } else if (limit.bound.operator === '<=') {
          if (typeof candidateChange.targetValue === 'number' && candidateChange.targetValue > limit.bound.value) {
              hardViolations.push(`Breaches Board Limit: ${limit.note}`);
          }
      }
  }

  // Compliance rules checking (basic heuristic)
  if (['zip', 'race', 'gender', 'age'].includes(candidateChange.targetField)) {
     const compliance = mems.find(m => m.type === 'ComplianceRule');
     if (compliance) {
         hardViolations.push(`Compliance Violation: ${compliance.requirement} (${compliance.citation})`);
     }
  }

  // 2. Prior Rejections
  const rejections = mems.filter(m => m.type === 'RejectedAISuggestion');
  const matchingRejection = rejections.find(r => r.suggestion.target === candidateChange.targetField && r.suggestion.proposed_change === candidateChange.targetValue);
  if (matchingRejection) {
      priorRejection = matchingRejection;
  }

  // 3. Approval Workflow
  const workflows = mems.filter(m => m.type === 'RequiredApprovalWorkflow');
  const matchingWorkflow = workflows.find(w => w.change_type === candidateChange.changeType) || workflows.find(w => w.change_type === 'threshold');
  if (matchingWorkflow) {
      requiredWorkflow = matchingWorkflow;
  }

  // Soft Warnings (HistoricalRiskLessons, etc. omitted for brevity, but could check subprime/term combination)
  const lessons = mems.filter(m => m.type === 'HistoricalRiskLesson');
  if (candidateChange.targetField === 'term' && candidateChange.targetValue > 72) {
     softWarnings.push({ message: lessons[0]?.record || "Longer terms carry historical risk" });
  }

  return { hardViolations, softWarnings, priorRejection, requiredWorkflow };
}
