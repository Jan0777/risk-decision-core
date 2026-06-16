import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "crypto";
import { SYSTEM_PROMPT } from "./src/lib/assistantSystemPrompt.js";

dotenv.config();

const app = express();
app.use(express.json());
const PORT = 3000;

// Initialize Gemini
let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured. Please set GEMINI_API_KEY.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.status === 503 || error.status === 429)) {
      console.warn(`Gemini API call failed with ${error.status}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
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
  const newApp = {
    id: `APP${String(mockDb.applications.length).padStart(9, '0')}`,
    ...req.body,
    status: "REVIEW_PENDING", 
    submittedAt: new Date().toLocaleString()
  };
  
  // Simple risk scoring simulation
  newApp.fraud_propensity_score = Math.random() * 0.3;
  newApp.approval_strength_score = 500 + Math.random() * 250;
  newApp.policy_decision_score = newApp.approval_strength_score * 0.9;
  newApp.policy_readiness = newApp.policy_decision_score + 10;
  
  // Execute gate rules based on current mockDb rules
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



// API routes go here FIRST
app.post("/api/whatif-plan", async (req, res) => {
  try {
    const ai = getAI();
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
      "draftPolicy": { ... modified policy object ONLY if changes made ... }
    }
    Never propose prohibited-basis variables. If requested, refuse and set clarifyingQuestion instead.`;

    const planRes = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: planPrompt,
      config: { responseMimeType: "application/json" }
    })) as any;

    let planData = { changes: [], draftPolicy: null, clarifyingQuestion: "" };
    try {
      let cleanText = planRes.text || "";
      cleanText = cleanText.replace(/\x60\x60\x60json/i, '').replace(/\x60\x60\x60/g, '').trim();
      planData = JSON.parse(cleanText);
    } catch(e) {
      console.error("Failed to parse Gemini plan:", planRes.text);
    }
    res.json(planData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/whatif-narrate", async (req, res) => {
  try {
    const ai = getAI();
    const { swapset, plan } = req.body;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const analysisPrompt = `Write a 2-paragraph tradeoff analysis for this swapset: ${JSON.stringify(swapset)}. 
    Changes proposed: ${JSON.stringify(plan?.changes || [])}.
    The rows are Baseline, the columns are Draft. Cite real-world underwriting logic, quote real counts. End with "Simulated on sample data; validate before production."`;
    
    const stream = await withRetry(() => ai.models.generateContentStream({
       model: "gemini-2.5-flash",
       contents: analysisPrompt
    })) as any;

    for await (const chunk of stream) {
       if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
       }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    let errorMessage = err.message;
    if (errorMessage?.includes("429") || errorMessage?.includes("quota")) {
      errorMessage = "Analysis unavailable due to API rate limits.";
    }
    res.write(`data: ${JSON.stringify({ error: true, text: "\\n\\n[Notice: " + errorMessage + "]" })}\n\n`);
    res.end();
  }
});


app.post("/api/chat", async (req, res) => {
  try {
    const ai = getAI();
    const { message } = req.body;
    let model = "gemini-2.5-flash";
    
    // Using SSE (Server-Sent Events) for live streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const responseStream = await withRetry(() => ai.models.generateContentStream({
      model: model,
      contents: message,
      config: {
        systemInstruction: SYSTEM_PROMPT
      }
    })) as any;

    for await (const chunk of responseStream) {
      if (chunk.text) {
        // Send each chunk as an SSE message
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    let errorMessage = error.message;
    if (errorMessage?.includes("429") || errorMessage?.includes("quota")) {
      errorMessage = "You have exceeded your Gemini API Free Tier quota. Please wait a few seconds and try again, or check your billing plan.";
    } else {
      console.error("Chat error:", error);
    }
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
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
