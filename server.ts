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

// Free models tried in order — if one is rate-limited the next is used
const FREE_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
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

async function withFallback<T>(
  fn: (ai: OpenAI, model: string) => Promise<T>
): Promise<T> {
  const ai = getAI();
  let lastError: any;
  for (const model of FREE_MODELS) {
    try {
      return await fn(ai, model);
    } catch (err: any) {
      const isRateLimit = err?.status === 429 || err?.status === 503;
      if (isRateLimit) {
        console.warn(`Model ${model} rate-limited, trying next...`);
        lastError = err;
        // Brief pause before trying next model
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      throw err; // Non-rate-limit errors bubble up immediately
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
