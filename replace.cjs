const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /\/\/ Inside startServer or top level API definitions:\napp\.post\("\/api\/whatif", async \(req, res\) => \{[\s\S]*?\n\}\);\n/m;

const replacement = `// API routes go here FIRST
app.post("/api/whatif-plan", async (req, res) => {
  try {
    const ai = require("@google/genai").GoogleGenAI ? new (require("@google/genai").GoogleGenAI)({ apiKey: process.env.GEMINI_API_KEY }) : null;
    if (!ai) return res.status(500).json({ error: "Gemini API key not configured" });
    const { message, basePolicy } = req.body;
    
    const planPrompt = \`You are an expert Credit Union Underwriting Knowledge Assistant.
    The user wants to do a what-if analysis on the decision rules.
    Base Policy JSON: \${JSON.stringify(basePolicy)}
    User Request: "\${message}"

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
    Never propose prohibited-basis variables. If requested, refuse and set clarifyingQuestion instead.\`;

    const planRes = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: planPrompt,
      config: { responseMimeType: "application/json" }
    });

    let planData = { changes: [], draftPolicy: null, clarifyingQuestion: "" };
    try {
      let cleanText = planRes.text || "";
      cleanText = cleanText.replace(/\\x60\\x60\\x60json/i, '').replace(/\\x60\\x60\\x60/g, '').trim();
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
    const ai = require("@google/genai").GoogleGenAI ? new (require("@google/genai").GoogleGenAI)({ apiKey: process.env.GEMINI_API_KEY }) : null;
    if (!ai) return res.status(500).json({ error: "Gemini API key not configured" });
    const { swapset, plan } = req.body;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const analysisPrompt = \`Write a 2-paragraph tradeoff analysis for this swapset: \${JSON.stringify(swapset)}. 
    Changes proposed: \${JSON.stringify(plan?.changes || [])}.
    The rows are Baseline, the columns are Draft. Cite real-world underwriting logic, quote real counts. End with "Simulated on sample data; validate before production."\`;
    
    const stream = await ai.models.generateContentStream({
       model: "gemini-2.5-flash",
       contents: analysisPrompt
    });

    for await (const chunk of stream) {
       if (chunk.text) {
          res.write(\`data: \${JSON.stringify({ text: chunk.text })}\\n\\n\`);
       }
    }
    res.write('data: [DONE]\\n\\n');
    res.end();
  } catch (err: any) {
    let errorMessage = err.message;
    if (errorMessage?.includes("429") || errorMessage?.includes("quota")) {
      errorMessage = "Analysis unavailable due to API rate limits.";
    }
    res.write(\`data: \${JSON.stringify({ error: true, text: "\\\\n\\\\n[Notice: " + errorMessage + "]" })}\\n\\n\`);
    res.end();
  }
});\n`;

code = code.replace(regex, replacement);
fs.writeFileSync('server.ts', code);
