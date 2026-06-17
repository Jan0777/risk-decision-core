---
name: Simulation engine baseline params
description: Default parameters for the server-side simulation engine
---

# Baseline Parameters (BASELINE_PARAMS in server.ts)

```
creditScoreMin: 620
dtiMax: 0.45
ltvMax: 1.25
maxInquiries: 8
maxVehicleAge: 12
maxDpd30: 2
allowChargeOffs: false
```

## Dataset
- 10,000 synthetic applicants generated at startup via `buildDataset()`
- Stored as module-level `SIM_APPLICANTS` — shared across all requests
- Score range: 480-860 uniformly; DTI: 0.08-0.70; LTV: 0.65-1.50

## Default rate proxy
- `estimatedDefaultRate` = (approved applicants with score < 660 AND DTI > 0.36) / total approved
- Typically 3-6% depending on baseline params

## Expected baseline approval rate
- ~13-15% given the hard denials (bankruptcy 5%, repo 3%, charge_off 7%, vehicle age >12 ~19%)
- Soft fails further reduce approvals
