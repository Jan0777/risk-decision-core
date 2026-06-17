---
name: Analytical vs chat routing in Chatbot
description: How the Chatbot routes user messages to drill loop vs standard chat
---

# Routing Logic in Chatbot.tsx

## `isAnalyticalQuery(msg)` detection
Regex: `/\b(optimize|find\s+best|increase|decrease|improve|reduce|maximize|minimize|what[\s-]?if|sweep|explore|best\s+config|threshold|approval\s+rate|default\s+risk|which\s+rule|how\s+much|how\s+can|suggest|analyze|analysis|simulate|simulation|run\s+an?\s+(analysis|sim)|search|discover)\b/i`

## If analytical → drill loop
1. Append placeholder message with `proposal: { type: 'drill-running', iteration: 0, maxIterations: 8 }`
2. POST to `/api/drill-loop` (SSE)
3. Update that message in-place as iterations stream in
4. On `type: complete`, update to `proposal: { type: 'drill-result', results, baselineMetrics, headline }`

## If not analytical → standard chat
1. Append empty assistant message
2. POST to `/api/chat` (SSE streaming text)
3. Accumulate text chunks into message content

## Key types
- `drill-running`: shows `DrillAnimation` (terminal-style progress bar)
- `drill-result`: shows `DrillResults` (3 config cards + recharts bar chart + swapset migrations)
