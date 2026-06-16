export type MemoryType = 'BoardMandatedLimit' | 'RiskAppetiteStatement' | 'SegmentStrategy' | 'ComplianceRule' | 'ApprovedPolicyChange' | 'RejectedAISuggestion' | 'HistoricalRiskLesson' | 'RequiredApprovalWorkflow';

export const initialMemories: any[] = [
    {
        id: 'mem_1',
        type: 'BoardMandatedLimit',
        target: 'score', // corresponds to field in candidates
        bound: { operator: '>=', value: 540 },
        enforcement: 'HARD',
        note: 'FICO floor may never go below 540'
    },
    {
        id: 'mem_2',
        type: 'BoardMandatedLimit',
        target: 'term',
        bound: { operator: '<=', value: 84 },
        enforcement: 'HARD',
        note: 'Max auto term never above 84 months'
    },
    {
        id: 'mem_3',
        type: 'ComplianceRule',
        requirement: 'No prohibited-basis variable or proxy in any rule',
        enforcement: 'HARD',
        citation: 'ECOA'
    },
    {
        id: 'mem_4',
        type: 'RiskAppetiteStatement',
        metric: 'auto-approval rate',
        target_range: { min: 35, max: 55 },
        enforcement: 'SOFT'
    },
    {
        id: 'mem_5',
        type: 'SegmentStrategy',
        segment: 'subprime indirect auto',
        stance: 'shrink',
        enforcement: 'SOFT'
    },
    {
        id: 'mem_6',
        type: 'HistoricalRiskLesson',
        record: '84-month indirect subprime term expansion drove charge-offs in a prior cycle; be cautious loosening term there.'
    },
    {
        id: 'mem_7',
        type: 'RejectedAISuggestion',
        suggestion: { target: 'score', proposed_change: 520 },
        rejectedBy: 'Risk Committee',
        reason: 'Breaches risk appetite',
        date: '2025-10-12'
    },
    {
        id: 'mem_8',
        type: 'RequiredApprovalWorkflow',
        change_type: 'structural',
        required_approvers: ['CRO', 'Compliance']
    },
    {
        id: 'mem_9',
        type: 'RequiredApprovalWorkflow',
        change_type: 'threshold',
        required_approvers: ['Lending Manager']
    }
];

export const MemoryStore = {
  getMemories: () => {
     if (typeof window === 'undefined') return initialMemories;
     const stored = localStorage.getItem('cu_institutional_memory');
     if (!stored) {
         localStorage.setItem('cu_institutional_memory', JSON.stringify(initialMemories));
         return initialMemories;
     }
     return JSON.parse(stored);
  },
  saveMemory: (mem: any) => {
     if (typeof window === 'undefined') return;
     const all = MemoryStore.getMemories();
     all.push(mem);
     localStorage.setItem('cu_institutional_memory', JSON.stringify(all));
  },
  queryMemory: (type?: MemoryType, filter?: (m: any) => boolean) => {
      let mems = MemoryStore.getMemories();
      if (type) mems = mems.filter((m: any) => m.type === type);
      if (filter) mems = mems.filter(filter);
      return mems;
  }
};
