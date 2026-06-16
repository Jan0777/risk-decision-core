export type Operator = '<' | '<=' | '==' | '>=' | '>' | '!=' | 'is None' | 'is Not None';
export type MatchLogic = 'AND' | 'OR';
export type TerminalNode = 'AUTO_APPROVAL' | 'AUTO_DENIAL' | 'MANUAL_REVIEW';

export interface Condition {
  id: string;
  lhs: string; // feature name
  operator: Operator;
  rhs?: number | string | boolean; // optional for 'is None' check
}

export interface Rule {
  id: string;
  name: string;
  passLogic: MatchLogic;
  reasonCode?: string;
  conditions: Condition[];
}

export interface Segment {
  id: string;
  name: string;
  order: number;
  matchType: 'IF';
  conditionLogic: MatchLogic;
  conditions: Condition[];
  rules: Rule[];
}

export interface Gate {
  id: string;
  name: string;
  order: number;
  blockLabel: string;
  segmentationEnabled: boolean;
  segments: Segment[];
  notMetNode: TerminalNode;
  metNode: TerminalNode | string; // 'AUTO_APPROVAL' or next Gate ID
}

export interface Policy {
  id: string;
  name: string;
  version: number;
  status: 'Draft' | 'Approved';
  gates: Gate[];
}

export interface Feature {
  name: string;
  version: string;
  type: 'number' | 'string' | 'boolean';
  table: string;
  description: string;
}

export interface DecisionResult {
  final_decision: string;
  decision_reason_code: string;
  risk_band: string;
  path: string[];
  triggeredRules: string[];
  assignedVariables: Record<string, any>;
}

export const FEATURE_REGISTRY: Feature[] = [
  { name: 'custom_score', version: 'v1', type: 'number', table: 'computed', description: 'Model Score' },
  { name: 'primary_applicant_primary_score', version: 'v1', type: 'number', table: 'computed', description: 'Primary FICO' },
  { name: 'num_bankruptcies', version: 'v1', type: 'number', table: 'credit_bureau_summary_table', description: 'Bankruptcies count' },
  { name: 'foreclosures', version: 'v1', type: 'number', table: 'public_records_table', description: 'Foreclosures count' },
  { name: 'repossessions', version: 'v1', type: 'number', table: 'public_records_table', description: 'Repossessions count' },
  { name: 'charge_offs', version: 'v1', type: 'number', table: 'public_records_table', description: 'Charge offs count' },
  { name: 'tax_liens', version: 'v1', type: 'number', table: 'public_records_table', description: 'Tax Liens count' },
  { name: 'collection_balance', version: 'v1', type: 'number', table: 'public_records_table', description: 'Total collection balance' },
  { name: '30dpd_24m', version: 'v1', type: 'number', table: 'credit_bureau_summary_table', description: '30 DPD in 24 months' },
  { name: '60dpd_24m', version: 'v1', type: 'number', table: 'credit_bureau_summary_table', description: '60 DPD in 24 months' },
  { name: '90dpd_24m', version: 'v1', type: 'number', table: 'credit_bureau_summary_table', description: '90 DPD in 24 months' },
  { name: 'num_inquiries', version: 'v1', type: 'number', table: 'credit_bureau_summary_table', description: 'Credit inquiries' },
  { name: 'projected_di', version: 'v1', type: 'number', table: 'application_table', description: 'Projected DTI' },
  { name: 'age_of_vehicle', version: 'v1', type: 'number', table: 'application_table', description: 'Age of vehicle (years)' },
  { name: 'vehicle_mileage', version: 'v1', type: 'number', table: 'application_table', description: 'Vehicle mileage' },
  { name: 'term', version: 'v1', type: 'number', table: 'application_table', description: 'Loan term' },
  { name: 'num_open_trades', version: 'v1', type: 'number', table: 'credit_bureau_summary_table', description: 'Number of open trade lines' },
  { name: 'ltv_ratio', version: 'v1', type: 'number', table: 'application_table', description: 'Loan to value ratio' }
];

export const REASON_CODES = [
  'Bankruptcy', 'Debt_To_Income', 'Delinquency', 'Credit_Inquiry', 
  'Failed_Custom_Score_Threshold', 'Derogatory_Tradelines', 'Failed_FICO_Threshold',
  'Manual_Review_Required'
];
