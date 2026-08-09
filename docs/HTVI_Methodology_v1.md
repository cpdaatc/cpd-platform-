# HTVI Methodology v1 — Calculation Spec

**Source:** Taqyeem reference workbook/report.  
**Status:** Internal methodology. Not an SCFHS metric.

## Weights

| Level | Weight |
|---|---:|
| L1 — Reaction | 15% |
| L2 — Learning | 20% |
| L3 — Behaviour/Application | 25% |
| L4 — Results/Impact | 40% |

## Level scoring

- **L1:** `AVERAGE(rating items on 1..5 scale) / 5 * 100`
- **L2:** `MIN(post_test / target_post_test, 1) * 100`
- **L3:** `MIN(application_rate / target_application, 1) * 100`
- **L4:** weighted mean of impact-objective achievement.

## Objective achievement

For each objective: direction, baseline, target, post value, and weight.

### Increase

If `post >= target`, achievement is `100`.
Otherwise the validated proportional calculation is `post / target * 100`, subject to input validation.

### Decrease

If `post <= target`, achievement is `100`.
Otherwise achievement is `target / post * 100`.

Zero and invalid denominators must be handled explicitly; do not copy the spreadsheet divide-by-zero behavior.

Weighted objective score: `achievement * weight / 100`.

## Impact-domain score

Current domains:

- Patient Impact
- Healthcare Practitioner Impact
- Quality & Safety
- Service Efficiency

Domain score = weighted objective score sum divided by applicable objective-weight sum.

## Final HTVI

`HTVI = SUMPRODUCT(level weights, level scores) / SUM(level weights)`

Reference activity reproduces approximately `96.7` when all required components are final.

## Rating thresholds

| Score | Rating |
|---|---|
| >= 85 | Excellent / ممتاز |
| >= 75 | Very Good / جيد جدًا |
| >= 65 | Good / جيد |
| < 65 | Needs Improvement / بحاجة تحسين |

## Governance rules added by the platform

1. If any methodology-required component is incomplete, `HTVI_STATUS = PENDING` and final HTVI is `NULL`.
2. Required weights are never re-normalized while L3/L4 are pending.
3. `NOT_DUE` is not zero; `MISSING` is not automatically a poor result.
4. Each final report stores `methodology_version_id`.
5. Updating a methodology version never silently recalculates historical final reports.
6. Final Impact Report is exactly two pages; overflow details go to a separate Detailed Impact Annex.
7. System Admin may configure a draft methodology version; only an authorized `MANAGEMENT_APPROVER` may activate it.
