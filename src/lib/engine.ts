import { Policy, DecisionResult, Condition, MatchLogic, Gate, Segment, Rule, TerminalNode } from './types';

function evaluateCondition(applicantRecord: Record<string, any>, condition: Condition): boolean {
  let fieldName = condition.lhs;
  
  // Note: any_applicant and all_applicants aggregation can be implemented if the input data 
  // had multiple applicants structure. For now, assuming applicantRecord has aggregated fields directly,
  // or we evaluate against the base record.
  let val = applicantRecord[fieldName];

  switch (condition.operator) {
    case 'is None':
      return val === undefined || val === null || val === '';
    case 'is Not None':
      return val !== undefined && val !== null && val !== '';
  }

  // If we are doing numerical/string comparisons and value is null, typical engines fail the condition
  if (val === undefined || val === null || val === '') {
    return false;
  }

  const numVal = Number(val);
  const numRhs = Number(condition.rhs);
  const isNumeric = !isNaN(numVal) && !isNaN(numRhs);

  switch (condition.operator) {
    case '<': return isNumeric ? numVal < numRhs : val < condition.rhs!;
    case '<=': return isNumeric ? numVal <= numRhs : val <= condition.rhs!;
    case '==': return val == condition.rhs;
    case '>=': return isNumeric ? numVal >= numRhs : val >= condition.rhs!;
    case '>': return isNumeric ? numVal > numRhs : val > condition.rhs!;
    case '!=': return val != condition.rhs;
    default: return false;
  }
}

function evaluateConditions(applicantRecord: Record<string, any>, conditions: Condition[], logic: MatchLogic): boolean {
  if (!conditions || conditions.length === 0) return true; // empty conditions = true
  if (logic === 'AND') {
    return conditions.every(c => evaluateCondition(applicantRecord, c));
  } else {
    return conditions.some(c => evaluateCondition(applicantRecord, c));
  }
}

export function evaluatePolicy(policy: Policy, applicantRecord: Record<string, any>): DecisionResult {
  const result: DecisionResult = {
    final_decision: 'UNKNOWN',
    decision_reason_code: '',
    risk_band: 'UNKNOWN',
    path: [],
    triggeredRules: [],
    assignedVariables: {},
  };

  for (const gate of policy.gates) {
    let gatePassed = false;
    let fallbackSegmentMet = false; // did ANY segment match?

    for (const segment of gate.segments) {
      if (evaluateConditions(applicantRecord, segment.conditions, segment.conditionLogic)) {
        fallbackSegmentMet = true;
        result.path.push(`MET: ${segment.name}`);
        
        let allRulesPassed = true;
        let failedReason = '';

        for (const rule of segment.rules) {
          if (!evaluateConditions(applicantRecord, rule.conditions, rule.passLogic)) {
            allRulesPassed = false;
            failedReason = rule.reasonCode || failedReason;
            break;
          } else {
            result.triggeredRules.push(rule.name);
          }
        }

        if (allRulesPassed) {
          gatePassed = true;
        } else {
          gatePassed = false;
          result.decision_reason_code = failedReason;
        }
        break; // Stop evaluating segments after the FIRST one matches
      }
    }

    if (!fallbackSegmentMet) {
       // if no segment matched, applicant falls out of policy bounds. Usually a denial.
       gatePassed = false;
       result.decision_reason_code = 'OUT_OF_BOUNDS';
    }

    if (!gatePassed) {
      result.path.push(`NOT MET: ${gate.name}`);
      result.final_decision = gate.notMetNode;
      return result;
    } else {
      result.path.push(`MET: ${gate.name}`);
    }
  }

  result.final_decision = 'AUTO_APPROVAL';
  if (!result.decision_reason_code) result.decision_reason_code = 'PASSED_ALL_GATES';
  return result;
}
