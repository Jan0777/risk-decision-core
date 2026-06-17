import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./src/lib/assistantSystemPrompt.js";

dotenv.config();

const app = express();
app.use(express.json());
const PORT = 5000;

// Primary model with automatic fallbacks — verified live from OpenRouter API
const FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",   // 120B params, 1M context (user selected)
  "meta-llama/llama-3.3-70b-instruct:free",   // Llama 3.3 70B
  "nousresearch/hermes-3-llama-3.1-405b:free", // Hermes 3 405B
  "openrouter/free",                           // Auto-router: always finds something available
];

function getAI(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://replit.com",
      "X-Title": "CU Policy Editor",
    },
  });
}

function shouldTryNextModel(err: any): boolean {
  // Retry on: rate limit, service unavailable, model not found / no longer free
  const s = err?.status;
  const msg: string = err?.error?.message || err?.message || '';
  return s === 429 || s === 503 || s === 404 ||
    msg.includes('rate') || msg.includes('unavailable') || msg.includes('free');
}

async function withFallback<T>(
  fn: (ai: OpenAI, model: string) => Promise<T>
): Promise<T> {
  const ai = getAI();
  let lastError: any;
  for (const model of FREE_MODELS) {
    try {
      return await fn(ai, model);
    } catch (err: any) {
      if (shouldTryNextModel(err)) {
        console.warn(`Model ${model} unavailable (${err?.status}), trying next...`);
        lastError = err;
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
      throw err; // Auth errors etc. bubble up immediately
    }
  }
  throw lastError;
}

function parseApiError(error: any): string {
  const status = error.status;
  const raw = error.message || '';

  if (status === 429 || raw.includes('429') || raw.includes('quota') || raw.includes('rate limit')) {
    return 'Rate limit reached. Please wait a moment and try again.';
  }
  if (status === 503 || raw.includes('503') || raw.includes('unavailable')) {
    return 'The AI model is temporarily unavailable. Please try again in a few seconds.';
  }
  if (status === 401 || raw.includes('401') || raw.includes('API key') || raw.includes('Unauthorized')) {
    return 'Invalid or missing API key. Please check your OPENROUTER_API_KEY configuration.';
  }
  if (status === 402 || raw.includes('402') || raw.includes('credits') || raw.includes('billing')) {
    return 'Insufficient credits on OpenRouter. Please top up your account at openrouter.ai.';
  }
  return raw || 'An unexpected error occurred. Please try again.';
}

// In-Memory Database
const mockDb = {
  rules: {
    eligibility: { fraudBound: 0.16, defaultProb: 0.25 },
    capacity: { dtiRatio: 0.45, creditScoreMin: 620 },
  },
  applications: [
    { id: "APP000000000", applicant: "Janarthanan S", requestedAmount: 25000, approval_strength_score: 645.6, fraud_propensity_score: 0.21, policy_decision_score: 596.6, policy_readiness: 602.1, status: "REVIEW_PENDING", submittedAt: "04-09-2026 05:38 PM", risk_band: "MEDIUM" },
    { id: "APP000000001", applicant: "John Doe", requestedAmount: 15000, approval_strength_score: 641.9, fraud_propensity_score: 0.06, policy_decision_score: 587.7, policy_readiness: 608.4, status: "AUTO_APPROVED", submittedAt: "04-09-2026 05:39 PM", risk_band: "LOW" },
    { id: "APP000000002", applicant: "Jane Smith", requestedAmount: 50000, approval_strength_score: 650.3, fraud_propensity_score: 0.05, policy_decision_score: 594.3, policy_readiness: 609.5, status: "AUTO_DENIED", submittedAt: "04-09-2026 05:40 PM", risk_band: "HIGH" },
  ],
  metrics: {
    totalApplications: 12450,
    approvalRate: 64.2,
    autoDecisionRate: 85.5,
    fraudCaught: 124,
  }
};

// API Routes
app.get("/api/rules", (req, res) => {
  res.json(mockDb.rules);
});

app.post("/api/rules", (req, res) => {
  mockDb.rules = { ...mockDb.rules, ...req.body };
  res.json(mockDb.rules);
});

app.get("/api/applications", (req, res) => {
  res.json(mockDb.applications);
});

app.post("/api/applications", (req, res) => {
  const newApp: any = {
    id: `APP${String(mockDb.applications.length).padStart(9, '0')}`,
    ...req.body,
    status: "REVIEW_PENDING",
    submittedAt: new Date().toLocaleString()
  };

  newApp.fraud_propensity_score = Math.random() * 0.3;
  newApp.approval_strength_score = 500 + Math.random() * 250;
  newApp.policy_decision_score = newApp.approval_strength_score * 0.9;
  newApp.policy_readiness = newApp.policy_decision_score + 10;

  if (newApp.fraud_propensity_score > mockDb.rules.eligibility.fraudBound) {
    newApp.status = "AUTO_DENIED";
    newApp.risk_band = "HIGH";
  } else if (newApp.approval_strength_score < mockDb.rules.capacity.creditScoreMin) {
    newApp.status = "REVIEW_PENDING";
    newApp.risk_band = "MEDIUM";
  } else {
    newApp.status = "AUTO_APPROVED";
    newApp.risk_band = "LOW";
  }

  mockDb.applications.unshift(newApp);
  mockDb.metrics.totalApplications++;
  res.json(newApp);
});

app.get("/api/metrics", (req, res) => {
  res.json(mockDb.metrics);
});

// What-If Plan endpoint
app.post("/api/whatif-plan", async (req, res) => {
  try {
    const { message, basePolicy } = req.body;

    const planPrompt = `You are an expert Credit Union Underwriting Knowledge Assistant.
The user wants to do a what-if analysis on the decision rules.
Base Policy JSON: ${JSON.stringify(basePolicy)}
User Request: "${message}"

Return ONLY a valid JSON object with the following structure:
{
  "intent": "Short summary of the user's goal",
  "summary": "High level summary of the proposed changes",
  "changes": [
    {
      "gate": "Gate ID or Name",
      "segment": "Segment Name",
      "field": "Rule/Condition Name",
      "before": "Old value",
      "after": "New value",
      "rationale": "Why this change",
      "citedModules": ["Module A"]
    }
  ],
  "expectedDirection": "String describing expected tradeoff",
  "clarifyingQuestion": "If the user request is ambiguous, ask a question. Or leave empty if clear.",
  "draftPolicy": {}
}
Never propose prohibited-basis variables. If requested, refuse and set clarifyingQuestion instead.`;

    const response = await withFallback((ai, model) =>
      ai.chat.completions.create({
        model,
        messages: [{ role: "user", content: planPrompt }],
        max_completion_tokens: 2048,
      })
    );

    let planData = { changes: [], draftPolicy: null, clarifyingQuestion: "" };
    try {
      let text = response.choices[0]?.message?.content || "";
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      planData = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse plan response");
    }
    res.json(planData);
  } catch (err: any) {
    console.error("whatif-plan error:", err);
    res.status(500).json({ error: parseApiError(err) });
  }
});

// What-If Narrate endpoint (streaming)
app.post("/api/whatif-narrate", async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  try {
    const { swapset, plan } = req.body;

    const analysisPrompt = `Write a 2-paragraph tradeoff analysis for this swapset: ${JSON.stringify(swapset)}.
Changes proposed: ${JSON.stringify(plan?.changes || [])}.
The rows are Baseline, the columns are Draft. Cite real-world underwriting logic, quote real counts. End with "Simulated on sample data; validate before production."`;

    const stream = await withFallback((ai, model) =>
      ai.chat.completions.create({
        model,
        messages: [{ role: "user", content: analysisPrompt }],
        stream: true,
        max_completion_tokens: 1024,
      })
    );

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error("whatif-narrate error:", err);
    res.write(`data: ${JSON.stringify({ error: parseApiError(err) })}\n\n`);
    res.end();
  }
});

// Main chat endpoint (streaming)
app.post("/api/chat", async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  try {
    const { message, history } = req.body;

    const priorTurns = Array.isArray(history)
      ? history
          .filter((m: any) => !m.isError)
          .map((m: { role: string; content: string }) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          } as OpenAI.Chat.ChatCompletionMessageParam))
      : [];

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...priorTurns,
      { role: 'user', content: message },
    ];

    let usedModel = FREE_MODELS[0];
    const stream = await withFallback((ai, model) => {
      usedModel = model;
      return ai.chat.completions.create({
        model,
        messages,
        stream: true,
        max_completion_tokens: 8192,
      });
    });

    // Send the model name as the first event so the UI can display it
    res.write(`data: ${JSON.stringify({ model: usedModel })}\n\n`);

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error("Chat error:", error);
    res.write(`data: ${JSON.stringify({ error: parseApiError(error) })}\n\n`);
    res.end();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CORRIDOR SIMULATION ENGINE  (server-side, single source of truth)
// ─────────────────────────────────────────────────────────────────────────────

interface SimParams {
  creditScoreMin: number;
  dtiMax: number;
  ltvMax: number;
  maxInquiries: number;
  maxVehicleAge: number;
  maxDpd30: number;
  allowChargeOffs: boolean;
}

interface SimMetrics {
  total: number;
  approvals: number;
  denials: number;
  reviews: number;
  approvalRate: number;
  denialRate: number;
  reviewRate: number;
  estimatedDefaultRate: number;
  reasonCodeBreakdown: Record<string, number>;
}

interface SwapsetMigration { from: string; to: string; count: number; }

const BASELINE_PARAMS: SimParams = {
  creditScoreMin: 620,
  dtiMax: 0.45,
  ltvMax: 1.25,
  maxInquiries: 8,
  maxVehicleAge: 12,
  maxDpd30: 2,
  allowChargeOffs: false,
};

function buildDataset(n = 10000): any[] {
  const out: any[] = [];
  for (let i = 0; i < n; i++) {
    const score = Math.floor(480 + Math.random() * 380);
    const nonScoreable = Math.random() > 0.95;
    out.push({
      id: i,
      custom_score: nonScoreable ? null : score,
      num_bankruptcies: Math.random() > 0.95 ? 1 : 0,
      repossessions: Math.random() > 0.97 ? 1 : 0,
      charge_offs: Math.random() > 0.93 ? 1 : 0,
      num_inquiries: Math.floor(Math.random() * 11),
      projected_di: 0.08 + Math.random() * 0.62,
      age_of_vehicle: Math.floor(Math.random() * 16),
      ltv_ratio: 0.65 + Math.random() * 0.85,
      dpd30_24m: Math.random() > 0.78 ? Math.floor(Math.random() * 4) : 0,
    });
  }
  return out;
}

// Generated once at startup — shared across all requests
const SIM_APPLICANTS = buildDataset();

function simEval(app: any, p: SimParams): { decision: string; reason: string } {
  if (app.num_bankruptcies > 0) return { decision: 'DENY', reason: 'bankruptcy' };
  if (app.repossessions > 0)    return { decision: 'DENY', reason: 'prior_repossession' };
  if (!p.allowChargeOffs && app.charge_offs > 0) return { decision: 'DENY', reason: 'charge_off' };
  if (app.age_of_vehicle > p.maxVehicleAge)       return { decision: 'DENY', reason: 'vehicle_age' };
  if (app.custom_score === null) return { decision: 'REVIEW', reason: 'non_scoreable' };

  const fails: string[] = [];
  if (app.custom_score < p.creditScoreMin)  fails.push('below_min_score');
  if (app.projected_di > p.dtiMax)          fails.push('dti_exceeded');
  if (app.ltv_ratio > p.ltvMax)             fails.push('ltv_exceeded');
  if (app.num_inquiries > p.maxInquiries)   fails.push('excessive_inquiries');
  if (app.dpd30_24m > p.maxDpd30)          fails.push('delinquency_history');

  if (fails.length === 0) return { decision: 'APPROVE', reason: 'passed_all' };
  // Single soft fail → REVIEW; multiple → DENY
  return { decision: fails.length === 1 ? 'REVIEW' : 'DENY', reason: fails[0] };
}

function runSim(p: SimParams): SimMetrics & { decisions: string[] } {
  let approvals = 0, denials = 0, reviews = 0;
  let highRiskApproved = 0;
  const rc: Record<string, number> = {};
  const decisions: string[] = [];

  for (const app of SIM_APPLICANTS) {
    const { decision, reason } = simEval(app, p);
    decisions.push(decision);
    if (decision === 'APPROVE') {
      approvals++;
      if ((app.custom_score || 999) < 660 && app.projected_di > 0.36) highRiskApproved++;
    } else {
      if (decision === 'DENY') denials++; else reviews++;
      if (reason && reason !== 'passed_all') rc[reason] = (rc[reason] || 0) + 1;
    }
  }

  const total = SIM_APPLICANTS.length;
  return {
    total, approvals, denials, reviews,
    approvalRate: parseFloat((approvals / total * 100).toFixed(2)),
    denialRate: parseFloat((denials / total * 100).toFixed(2)),
    reviewRate: parseFloat((reviews / total * 100).toFixed(2)),
    estimatedDefaultRate: approvals > 0 ? parseFloat((highRiskApproved / approvals * 100).toFixed(2)) : 0,
    reasonCodeBreakdown: rc,
    decisions,
  };
}

function computeSwapset(baseDec: string[], draftDec: string[]) {
  const counts: Record<string, Record<string, number>> = {};
  for (let i = 0; i < baseDec.length; i++) {
    const b = baseDec[i], d = draftDec[i];
    if (b !== d) {
      counts[b] = counts[b] || {};
      counts[b][d] = (counts[b][d] || 0) + 1;
    }
  }
  const migrations: SwapsetMigration[] = [];
  for (const [from, tos] of Object.entries(counts)) {
    for (const [to, count] of Object.entries(tos)) {
      migrations.push({ from, to, count });
    }
  }
  return migrations;
}

// POST /api/shadow-run  — single simulation against the backend dataset
app.post("/api/shadow-run", (req, res) => {
  try {
    const { params: overrides } = req.body;
    const params: SimParams = { ...BASELINE_PARAMS, ...overrides };
    const baseResult = runSim(BASELINE_PARAMS);
    const draftResult = runSim(params);
    const migrations = computeSwapset(baseResult.decisions, draftResult.decisions);

    res.json({
      metrics: {
        approvals: draftResult.approvals, denials: draftResult.denials,
        reviews: draftResult.reviews, total: draftResult.total,
        approvalRate: draftResult.approvalRate, denialRate: draftResult.denialRate,
        reviewRate: draftResult.reviewRate,
        estimatedDefaultRate: draftResult.estimatedDefaultRate,
        reasonCodeBreakdown: draftResult.reasonCodeBreakdown,
      },
      baselineMetrics: {
        approvals: baseResult.approvals, denials: baseResult.denials,
        reviews: baseResult.reviews, total: baseResult.total,
        approvalRate: baseResult.approvalRate,
        estimatedDefaultRate: baseResult.estimatedDefaultRate,
      },
      swapset: {
        baseline_distribution: { approve: baseResult.approvals, deny: baseResult.denials, manual: baseResult.reviews },
        new_distribution: { approve: draftResult.approvals, deny: draftResult.denials, manual: draftResult.reviews },
        migrations,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/drill-loop  — autonomous goal-directed optimization loop (SSE)
app.post("/api/drill-loop", async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (obj: any) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const { goal = '', constraintManifest = {}, baselineParamOverrides = {} } = req.body;

    const baseParams: SimParams = { ...BASELINE_PARAMS, ...baselineParamOverrides };
    const baseResult = runSim(baseParams);

    send({ type: 'baseline', metrics: { approvalRate: baseResult.approvalRate, estimatedDefaultRate: baseResult.estimatedDefaultRate } });

    // Candidate configurations to explore (8 iterations)
    const candidates = [
      { tag: 'Conservative_A',  risk: 'LOW',      p: { ...baseParams, creditScoreMin: baseParams.creditScoreMin - 10 } },
      { tag: 'Conservative_B',  risk: 'LOW',      p: { ...baseParams, dtiMax: baseParams.dtiMax + 0.02 } },
      { tag: 'Balanced_A',      risk: 'MODERATE', p: { ...baseParams, creditScoreMin: baseParams.creditScoreMin - 15, dtiMax: baseParams.dtiMax + 0.02 } },
      { tag: 'Balanced_B',      risk: 'MODERATE', p: { ...baseParams, dtiMax: baseParams.dtiMax + 0.03, maxInquiries: baseParams.maxInquiries + 1 } },
      { tag: 'Balanced_C',      risk: 'MODERATE', p: { ...baseParams, creditScoreMin: baseParams.creditScoreMin - 20, ltvMax: baseParams.ltvMax + 0.05 } },
      { tag: 'Aggressive_A',    risk: 'HIGH',     p: { ...baseParams, creditScoreMin: baseParams.creditScoreMin - 25, dtiMax: baseParams.dtiMax + 0.04 } },
      { tag: 'Aggressive_B',    risk: 'HIGH',     p: { ...baseParams, dtiMax: baseParams.dtiMax + 0.05, ltvMax: baseParams.ltvMax + 0.08, maxInquiries: baseParams.maxInquiries + 2 } },
      { tag: 'Aggressive_C',    risk: 'HIGH',     p: { ...baseParams, creditScoreMin: baseParams.creditScoreMin - 30, dtiMax: baseParams.dtiMax + 0.03 } },
    ];

    const scored: any[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      await new Promise(r => setTimeout(r, 80));

      const draftResult = runSim(cand.p);
      const migrations = computeSwapset(baseResult.decisions, draftResult.decisions);

      const approvalLift = draftResult.approvalRate - baseResult.approvalRate;
      const defaultDelta = Math.max(0, draftResult.estimatedDefaultRate - baseResult.estimatedDefaultRate);
      const thresholdChurn = Math.abs(cand.p.creditScoreMin - baseParams.creditScoreMin) * 0.01
                           + Math.abs(cand.p.dtiMax - baseParams.dtiMax) * 8;
      const score = approvalLift - defaultDelta * 3 - thresholdChurn;

      const paramDiff: Record<string, any> = {};
      for (const key of Object.keys(cand.p) as (keyof SimParams)[]) {
        if (cand.p[key] !== baseParams[key]) {
          paramDiff[key] = { before: baseParams[key], after: cand.p[key] };
        }
      }

      const violations: string[] = [];
      // Hard floor — never go below 600 minimum score (regulatory floor)
      if (cand.p.creditScoreMin < 600) violations.push('score_below_600_hard_floor');
      // Soft cap — informational badge, doesn't kill config scoring
      const maxDefaultRate = constraintManifest?.maxDefaultRate;
      if (maxDefaultRate && draftResult.estimatedDefaultRate > maxDefaultRate) {
        violations.push(`est_default_${draftResult.estimatedDefaultRate.toFixed(1)}%_above_${maxDefaultRate}%_target`);
      }

      // Only HARD violations suppress a config (score = -999)
      const hasHardViolation = violations.some(v => v.includes('hard_floor'));
      // Soft cap violations just add a penalty to the score but still surface the config
      const softPenalty = violations.filter(v => v.includes('_above_')).length * 2;

      scored.push({
        tag: cand.tag, riskLevel: cand.risk,
        params: cand.p, paramDiff,
        metrics: {
          approvals: draftResult.approvals, denials: draftResult.denials,
          reviews: draftResult.reviews, total: draftResult.total,
          approvalRate: draftResult.approvalRate, estimatedDefaultRate: draftResult.estimatedDefaultRate,
          denialRate: draftResult.denialRate, reviewRate: draftResult.reviewRate,
          reasonCodeBreakdown: draftResult.reasonCodeBreakdown,
        },
        score: hasHardViolation ? -999 : score - softPenalty,
        constraintViolations: violations,
        swapset: {
          baseline_distribution: { approve: baseResult.approvals, deny: baseResult.denials, manual: baseResult.reviews },
          new_distribution: { approve: draftResult.approvals, deny: draftResult.denials, manual: draftResult.reviews },
          migrations,
        },
      });

      send({
        type: 'iteration',
        iteration: i + 1,
        maxIterations: candidates.length,
        tag: cand.tag,
        riskLevel: cand.risk,
        approvalLift: approvalLift.toFixed(2),
        score: hasHardViolation ? -999 : parseFloat((score - softPenalty).toFixed(3)),
        constraintViolations: violations,
      });
    }

    // Pick best from each risk tier — prefer no-hard-violation configs, fallback to all sorted by score
    const withoutHard = scored.filter(r => r.score > -999).sort((a, b) => b.score - a.score);
    const pool = withoutHard.length >= 3 ? withoutHard : scored.sort((a, b) => b.score - a.score);
    const pick = (tier: string) => pool.find(r => r.riskLevel === tier);
    let topThree = [pick('LOW'), pick('MODERATE'), pick('HIGH')].filter(Boolean) as any[];
    if (topThree.length < 3) {
      for (const r of pool) {
        if (!topThree.includes(r) && topThree.length < 3) topThree.push(r);
      }
    }
    topThree = topThree.slice(0, 3);
    const labels = ['Conservative', 'Balanced', 'Aggressive'];
    topThree.forEach((r, i) => { r.label = labels[i]; });

    // AI headline for the results
    let headline = '';
    try {
      const ctx = topThree.map(r => ({
        label: r.label,
        approvalLift: `+${(r.metrics.approvalRate - baseResult.approvalRate).toFixed(1)}%`,
        defaultRate: `${r.metrics.estimatedDefaultRate}%`,
        changes: Object.entries(r.paramDiff).map(([k, v]: any) => {
          const isRate = k === 'dtiMax' || k === 'ltvMax';
          const fmt = (n: number | boolean) => isRate && typeof n === 'number' ? `${(n * 100).toFixed(0)}%` : String(n);
          return `${k}: ${fmt(v.before)} → ${fmt(v.after)}`;
        }).join(', '),
      }));

      const headlineRes = await withFallback((ai, model) =>
        ai.chat.completions.create({
          model,
          messages: [{
            role: 'user',
            content: `You are a Credit Union policy analyst. User goal: "${goal}". 
Simulation results (${candidates.length} iterations run): ${JSON.stringify(ctx)}
Write exactly 2 sentences: (1) What the analysis found overall. (2) Which configuration is recommended and why, citing specific numbers. Be concrete. No filler.`
          }],
          max_completion_tokens: 160,
        })
      );
      headline = headlineRes.choices[0]?.message?.content || '';
    } catch {
      const best = topThree[1] || topThree[0];
      if (best) {
        headline = `Ran ${candidates.length} simulations against 10,000 synthetic applicants. The ${best.label} configuration delivers +${(best.metrics.approvalRate - baseResult.approvalRate).toFixed(1)}% approval lift while keeping estimated default rate at ${best.metrics.estimatedDefaultRate}%.`;
      }
    }

    send({ type: 'complete', results: topThree, iterationsRun: candidates.length, baselineMetrics: { approvals: baseResult.approvals, denials: baseResult.denials, reviews: baseResult.reviews, total: baseResult.total, approvalRate: baseResult.approvalRate, estimatedDefaultRate: baseResult.estimatedDefaultRate }, headline });
    res.end();
  } catch (err: any) {
    console.error('drill-loop error:', err);
    send({ type: 'error', message: parseApiError(err) });
    res.end();
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
