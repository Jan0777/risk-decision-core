---
name: Drill loop scoring & constraint logic
description: How drill-loop scores configs and handles user-set constraint caps vs hard regulatory floors
---

# Drill Loop Scoring

## The Rule
- **Hard floor** (creditScoreMin < 600): suppress config entirely (`score = -999`)
- **Soft cap** (maxDefaultRate exceeded): add score penalty (`-2 per violation`) but still surface the config
- Do NOT use -999 for soft cap — if baseline already exceeds cap, all loosened configs would be suppressed

**Why:** Tested with maxDefaultRate=3 when baseline was 3.18% — every config got -999 and no results were returned. Fixed by only using -999 for regulatory hard floors.

## Final `send()` call must use `hasHardViolation` not `violations.length > 0`

## Pool selection
- `withoutHard`: configs with score > -999 (not hard-floor-blocked)
- If withoutHard has ≥ 3 configs → use as pool
- Otherwise fall back to all scored sorted by score descending
