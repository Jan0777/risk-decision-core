import { Policy } from './types';

export const POLICY_OPTIMIZED_INDIRECT_USED_AUTO: Policy = {
  id: 'pol_indirect_used_auto_v1',
  name: 'Optimized Indirect Used Auto Policy',
  version: 1,
  status: 'Approved',
  gates: [
    {
      id: 'gate_1',
      name: 'Hard Rules',
      order: 1,
      blockLabel: 'Block-1',
      segmentationEnabled: true,
      notMetNode: 'AUTO_DENIAL',
      metNode: 'gate_2',
      segments: [
        {
          id: 'g1_seg1',
          name: 'Non Scorable: Custom Score or FICO Not Available',
          order: 1,
          matchType: 'IF',
          conditionLogic: 'OR',
          conditions: [
            { id: 'c1', lhs: 'custom_score', operator: 'is None' },
            { id: 'c2', lhs: 'primary_applicant_primary_score', operator: 'is None' }
          ],
          rules: [
            {
              id: 'r1_seg1',
              name: 'Continue',
              passLogic: 'AND',
              conditions: []
            }
          ]
        },
        {
          id: 'g1_seg2',
          name: 'Low Risk: Custom Score > 680',
          order: 2,
          matchType: 'IF',
          conditionLogic: 'AND',
          conditions: [
            { id: 'c1', lhs: 'custom_score', operator: 'is Not None' },
            { id: 'c2', lhs: 'custom_score', operator: '>', rhs: 680 }
          ],
          rules: [
            {
              id: 'r1_seg2',
              name: 'Risk Appetite: FICO Cutoff',
              passLogic: 'AND',
              reasonCode: 'Failed_FICO_Threshold',
              conditions: [
                { id: 'rc1', lhs: 'primary_applicant_primary_score', operator: '>=', rhs: 550 }
              ]
            }
          ]
        },
        {
          id: 'g1_seg3',
          name: 'Medium Risk: 600 < Custom Score <= 680',
          order: 3,
          matchType: 'IF',
          conditionLogic: 'AND',
          conditions: [
            { id: 'c1', lhs: 'custom_score', operator: 'is Not None' },
            { id: 'c2', lhs: 'custom_score', operator: '>', rhs: 600 },
            { id: 'c3', lhs: 'custom_score', operator: '<=', rhs: 680 }
          ],
          rules: [
            {
              id: 'r1_g1_s3',
              name: 'Risk Appetite: FICO Cutoff',
              passLogic: 'AND',
              reasonCode: 'Failed_FICO_Threshold',
              conditions: [{ id: 'rc1', lhs: 'primary_applicant_primary_score', operator: '>=', rhs: 550 }]
            },
            {
              id: 'r2_g1_s3',
              name: 'Derogatory: Bankruptcy Check',
              passLogic: 'AND',
              reasonCode: 'Bankruptcy',
              conditions: [{ id: 'rc1', lhs: 'num_bankruptcies', operator: '==', rhs: 0 }]
            },
            {
              id: 'r3_g1_s3',
              name: 'Derogatory: Derogatory Check',
              passLogic: 'AND',
              reasonCode: 'Derogatory_Tradelines',
              conditions: [
                { id: 'rc1', lhs: 'foreclosures', operator: '==', rhs: 0 },
                { id: 'rc2', lhs: 'repossessions', operator: '==', rhs: 0 },
                { id: 'rc3', lhs: 'charge_offs', operator: '==', rhs: 0 },
                { id: 'rc4', lhs: 'tax_liens', operator: '==', rhs: 0 },
                { id: 'rc5', lhs: 'collection_balance', operator: '<=', rhs: 500 }
              ]
            },
            {
              id: 'r4_g1_s3',
              name: 'Delinquency 30/60/90 Check',
              passLogic: 'AND',
              reasonCode: 'Delinquency',
              conditions: [
                { id: 'rc1', lhs: '30dpd_24m', operator: '<=', rhs: 1 },
                { id: 'rc2', lhs: '60dpd_24m', operator: '==', rhs: 0 },
                { id: 'rc3', lhs: '90dpd_24m', operator: '==', rhs: 0 }
              ]
            },
            {
              id: 'r5_g1_s3',
              name: 'Inquiry: Credit Inquiry Check',
              passLogic: 'AND',
              reasonCode: 'Credit_Inquiry',
              conditions: [{ id: 'rc1', lhs: 'num_inquiries', operator: '<=', rhs: 3 }]
            }
          ]
        },
        {
          id: 'g1_seg4',
          name: 'High Risk: Custom Score <= 600',
          order: 4,
          matchType: 'IF',
          conditionLogic: 'AND',
          conditions: [
            { id: 'c1', lhs: 'custom_score', operator: 'is Not None' },
            { id: 'c2', lhs: 'custom_score', operator: '<=', rhs: 600 }
          ],
          rules: [
            {
              id: 'r1_g1_s4',
              name: 'Auto Denial',
              passLogic: 'AND',
              reasonCode: 'Failed_Custom_Score_Threshold',
              conditions: [
                 { id: 'rc1', lhs: 'custom_score', operator: '>', rhs: 9999 } // always fail
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'gate_2',
      name: 'Soft Rules',
      order: 2,
      blockLabel: 'Block-2',
      segmentationEnabled: true,
      notMetNode: 'MANUAL_REVIEW',
      metNode: 'AUTO_APPROVAL',
      segments: [
        {
          id: 'g2_seg1',
          name: 'Non Scorable',
          order: 1,
          matchType: 'IF',
          conditionLogic: 'OR',
          conditions: [
            { id: 'c1', lhs: 'custom_score', operator: 'is None' },
            { id: 'c2', lhs: 'primary_applicant_primary_score', operator: 'is None' }
          ],
          rules: [
            {
              id: 'r1_g2_s1',
              name: 'Manual Review Route',
              passLogic: 'AND',
              reasonCode: 'Manual_Review_Required',
              conditions: [
                 { id: 'rc1', lhs: 'custom_score', operator: '>', rhs: 9999 } // always fail, route to terminal manual review
              ]
            }
          ]
        },
        {
          id: 'g2_seg2',
          name: 'Low Risk: Custom Score > 680',
          order: 2,
          matchType: 'IF',
          conditionLogic: 'AND',
          conditions: [
            { id: 'c1', lhs: 'custom_score', operator: 'is Not None' },
            { id: 'c2', lhs: 'custom_score', operator: '>', rhs: 680 }
          ],
          rules: [
            {
              id: 'r1_g2_s2',
              name: 'Age of Vehicle Cutoff',
              passLogic: 'AND',
              conditions: [{ id: 'rc1', lhs: 'age_of_vehicle', operator: '<=', rhs: 9 }]
            },
            {
              id: 'r2_g2_s2',
              name: 'Vehicle Mileage Cutoff',
              passLogic: 'AND',
              conditions: [{ id: 'rc1', lhs: 'vehicle_mileage', operator: '<=', rhs: 150000 }]
            },
            {
              id: 'r3_g2_s2',
              name: 'Max Term Limit',
              passLogic: 'AND',
              conditions: [{ id: 'rc1', lhs: 'term', operator: '<=', rhs: 84 }]
            }
          ]
        },
        {
          id: 'g2_seg3',
          name: 'Medium Risk: 600 < Custom Score <= 680',
          order: 3,
          matchType: 'IF',
          conditionLogic: 'AND',
          conditions: [
            { id: 'c1', lhs: 'custom_score', operator: 'is Not None' },
            { id: 'c2', lhs: 'custom_score', operator: '>', rhs: 600 },
            { id: 'c3', lhs: 'custom_score', operator: '<=', rhs: 680 }
          ],
          rules: [
            {
              id: 'r1_g2_s3',
              name: 'Thin File: Min Open Trade Lines',
              passLogic: 'AND',
              conditions: [{ id: 'rc1', lhs: 'num_open_trades', operator: '>=', rhs: 3 }]
            },
            {
              id: 'r2_g2_s3',
              name: 'Age of Vehicle Cutoff',
              passLogic: 'AND',
              conditions: [{ id: 'rc1', lhs: 'age_of_vehicle', operator: '<=', rhs: 6 }]
            },
            {
              id: 'r3_g2_s3',
              name: 'Vehicle Mileage Cutoff',
              passLogic: 'AND',
              conditions: [{ id: 'rc1', lhs: 'vehicle_mileage', operator: '<=', rhs: 150000 }]
            },
            {
              id: 'r4_g2_s3',
              name: 'Max Term Limit',
              passLogic: 'AND',
              conditions: [{ id: 'rc1', lhs: 'term', operator: '<=', rhs: 84 }]
            }
          ]
        }
      ]
    }
  ]
};
