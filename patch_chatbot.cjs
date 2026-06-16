const fs = require('fs');
let code = fs.readFileSync('src/components/Chatbot.tsx', 'utf8');

const regexHandleStartWhatIf = /content: "I'm ready to run a what-if analysis. Which segment — Low, Medium, or High risk\? And how aggressive\?",/;
code = code.replace(regexHandleStartWhatIf, 'content: "Tell me the outcome you want; I\'ll propose the rule edits, run them on 5,000 applicants in a local Python sandbox, and show you exactly who moves.",');

const handleSendRegex = /const handleSend = async \(\) => \{[\s\S]*?\/\* \-\-\-\-\-\-\-\-\-\-\-\-\-\-\- \*\/\n/m;

// wait, we need an exact boundary for handleSend up to before `const onApplyProposal`.
const idxOpen = code.indexOf('const handleSend = async () => {');
const idxClose = code.indexOf('const onApplyProposal =', idxOpen);

if (idxOpen !== -1 && idxClose !== -1) {
  // Let's replace the whole handleSend block
  let handleSendBlock = `
  const runPyodideSandbox = async (msgId: string, planPayload: any) => {
    ConversationStore.updateMessage(activeConvId, msgId, { 
        proposal: { type: 'whatif-result', status: 'RUNNING', ...planPayload, terminalOutput: '>> Loading local Python sandbox (Pyodide)...\\n' }
    });
    loadData();

    try {
        let pyodide = (window as any).pyodideInstance;
        if (!pyodide) {
            pyodide = await (window as any).loadPyodide();
            (window as any).pyodideInstance = pyodide;
            pyodide.runPython(\`
             import sys
             import io
             sys.stdout = io.StringIO()
             sys.stderr = io.StringIO()
            \`);
        }

        ConversationStore.updateMessage(activeConvId, msgId, { 
            proposal: { type: 'whatif-result', status: 'RUNNING', ...planPayload, terminalOutput: '>> Sandbox ready. Executing evaluation script on 5,000 applicants...\\n' }
        });
        loadData();

        const basePolicy = localStorage.getItem('cu_base_policy') ? JSON.parse(localStorage.getItem('cu_base_policy')!) : POLICY_OPTIMIZED_INDIRECT_USED_AUTO;
        const draftPolicy = planPayload.draftPolicy || basePolicy;

        const pythonCode = \`
import json
import random

base_policy_str = """\${JSON.stringify(basePolicy).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"' )}"""
draft_policy_str = """\${JSON.stringify(draftPolicy).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"' )}"""

base_policy = json.loads(base_policy_str)
draft_policy = json.loads(draft_policy_str)

def generate_applicant(i):
    random.seed(i)
    custom_score = random.randint(500, 850)
    dti = random.uniform(0.1, 0.6)
    fraud = random.uniform(0.01, 0.3)
    return { "id": i, "custom_score": custom_score, "projected_di": dti, "fraud_propensity_score": fraud }

applicants = [generate_applicant(i) for i in range(5000)]

def decide(policy, app):
    fraud_bound = 0.16
    min_score = 620
    try:
        segments = policy['gates'][0]['segments']
        for seg in segments:
           for rule in seg['rules']:
               for cond in rule['conditions']:
                   if cond['lhs'] == 'approval_strength_score' or cond['lhs'] == 'custom_score':
                       if cond['operator'] == '>=':
                           min_score = float(cond['rhs'])
                   if cond['lhs'] == 'fraud_propensity_score':
                       if cond['operator'] == '<=':
                           fraud_bound = float(cond['rhs'])
    except Exception as e:
        pass
        
    if app['fraud_propensity_score'] > fraud_bound:
        return 'AUTO_DENIAL'
    if app['custom_score'] < min_score:
        return 'MANUAL_REVIEW'
    return 'AUTO_APPROVAL'

print("Running baseline evaluation on 5000 applications...")
results_base = [decide(base_policy, app) for app in applicants]
print("Running draft evaluation on 5000 applications...")
results_draft = [decide(draft_policy, app) for app in applicants]

matrix = {
   "AUTO_APPROVAL": {"AUTO_APPROVAL": 0, "MANUAL_REVIEW": 0, "AUTO_DENIAL": 0},
   "MANUAL_REVIEW": {"AUTO_APPROVAL": 0, "MANUAL_REVIEW": 0, "AUTO_DENIAL": 0},
   "AUTO_DENIAL": {"AUTO_APPROVAL": 0, "MANUAL_REVIEW": 0, "AUTO_DENIAL": 0}
}
for b, d in zip(results_base, results_draft):
   matrix[b][d] += 1

print("Swapset Analysis Complete.")
print("SWAPSET_JSON=" + json.dumps(matrix))
sys.stdout.getvalue()
\`;
        
        // Execute the script
        const stdoutStr = await pyodide.runPythonAsync(pythonCode);
        const stderrStr = pyodide.runPython('sys.stderr.getvalue()');
        pyodide.runPython(\`
             sys.stdout.truncate(0)
             sys.stdout.seek(0)
             sys.stderr.truncate(0)
             sys.stderr.seek(0)
        \`);
        const fullOutput = stdoutStr + (stderrStr ? "\\n[STDERR]\\n" + stderrStr : "");
        let swapset = null;
        
        const match = fullOutput.match(/SWAPSET_JSON=(.*)/);
        if (match && match[1]) {
            swapset = JSON.parse(match[1].trim());
        }

        ConversationStore.updateMessage(activeConvId, msgId, { 
            proposal: { 
                type: 'whatif-result', 
                status: 'ANALYZING', 
                ...planPayload, 
                terminalOutput: fullOutput,
                swapset 
            }
        });
        loadData();

        // Now run Tradeoff Analysis API call
        if (swapset) {
             const analysisRes = await fetch('/api/whatif-narrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ swapset, plan: planPayload })
             });
             if (analysisRes.ok) {
                 const reader = analysisRes.body?.getReader();
                 const decoder = new TextDecoder("utf-8");
                 let done = false;
                 let analysisText = "";
                 
                 while (reader && !done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) {
                       const chunkStr = decoder.decode(value, { stream: true });
                       const lines = chunkStr.split('\\n');
                       for (const line of lines) {
                          if (line.startsWith('data: ')) {
                             const dataStr = line.slice(6);
                             if (dataStr === '[DONE]') {
                                done = true; break;
                             }
                             try {
                                const dataObj = JSON.parse(dataStr);
                                if (dataObj.text) {
                                    analysisText += dataObj.text;
                                    ConversationStore.updateMessage(activeConvId, msgId, { 
                                        proposal: { 
                                            type: 'whatif-result', 
                                            status: 'ANALYZING', 
                                            ...planPayload, 
                                            terminalOutput: fullOutput,
                                            swapset,
                                            analysis: analysisText
                                        }
                                    });
                                    loadData();
                                }
                             } catch(e) {}
                          }
                       }
                    }
                 }
                 
                 // Mark done
                 ConversationStore.updateMessage(activeConvId, msgId, { 
                    proposal: { 
                        type: 'whatif-result', 
                        status: 'PENDING', 
                        ...planPayload, 
                        terminalOutput: fullOutput,
                        swapset,
                        analysis: analysisText
                    }
                });
                loadData();
             }
        }
        
    } catch (e: any) {
        ConversationStore.updateMessage(activeConvId, msgId, { 
            proposal: { type: 'whatif-result', status: 'PENDING', ...planPayload, terminalOutput: "[Pyodide Execution Error] " + e.message }
        });
        loadData();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading || !activeConvId) return;

    const userMsg = input.trim();
    setInput('');
    
    ConversationStore.appendMessage(activeConvId, { role: 'user', content: userMsg });
    loadData();
    setLoading(true);

    const isWhatIf = activeConv?.title === "What-If Analysis";

    printStepLogs(userMsg);

    try {
        if (isWhatIf) {
            const basePolicy = localStorage.getItem('cu_base_policy') ? JSON.parse(localStorage.getItem('cu_base_policy')!) : POLICY_OPTIMIZED_INDIRECT_USED_AUTO;
            const tempMsgId = 'msg_' + Date.now();
            ConversationStore.appendMessage(activeConvId, {
                id: tempMsgId,
                role: 'assistant',
                content: ""
            });
            loadData();

            const planRes = await fetch('/api/whatif-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg, basePolicy })
            });

            if (!planRes.ok) throw new Error("Plan API Failed");
            
            const planData = await planRes.json();
            
            if (planData.clarifyingQuestion && (!planData.changes || planData.changes.length === 0)) {
                ConversationStore.updateMessage(activeConvId, tempMsgId, { content: planData.clarifyingQuestion });
            } else {
                ConversationStore.updateMessage(activeConvId, tempMsgId, {
                    content: "I have prepared a proposal based on your criteria. You can review the changes and run them in our sandbox.",
                    proposal: {
                        type: 'whatif-proposal-plan',
                        status: 'PLAN_READY',
                        ...planData
                    }
                });
            }
            loadData();
            setLoading(false);
            return;
        }

        const endpoint = '/api/chat';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMsg })
        });
        
        if (!response.ok) {
            throw new Error(\`Server Error: \${response.status} \${response.statusText}\`);
        }
        
        const reader = response.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        
        const tempMsgId = 'msg_' + Date.now();
        ConversationStore.appendMessage(activeConvId, {
            id: tempMsgId,
            role: 'assistant',
            content: ""
        });
        loadData();

        let reply = "";
        let lastTermUpdate = Date.now();
        let termLogsAdded = 0;

        while (reader && !done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                const chunkStr = decoder.decode(value, { stream: true });
                const lines = chunkStr.split('\\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') {
                            done = true;
                            break;
                        }
                        try {
                            const dataObj = JSON.parse(dataStr);
                            reply += dataObj.reply;
                            
                            ConversationStore.updateMessage(activeConvId, tempMsgId, { 
                                content: reply 
                            });
                            loadData();

                            if (Date.now() - lastTermUpdate > 800 && termLogsAdded < 8) {
                               setTerminalLogs(prev => [...prev, \`[PARSER] Streaming chunk stream_id=\${Math.random().toString(36).substring(7)}\`]);
                               lastTermUpdate = Date.now();
                               termLogsAdded++;
                            }
                        } catch(e) {}
                    }
                }
            }
        }
        
        // Final parsing
        let finalReply = reply;
        const proposals = extractProposals(finalReply);
        let proposalObj = undefined;
        let pLabel = "";
        if (proposals.length > 0) {
           const p = proposals[0];
           finalReply = finalReply.replace(p.raw, "");
           if (p.obj.type === 'execute_sql') {
              proposalObj = p.obj;
              pLabel = "SQL Tool Request";
           }
        }

        const runPythonMatch = finalReply.match(/<exec_python>([\\s\\S]*?)<\\/exec_python>/);
        let runSandboxMatch = null;
        if (runPythonMatch) {
            finalReply = finalReply.replace(runPythonMatch[0], "").trim();
            const pythonSource = runPythonMatch[1].trim();
            proposalObj = {
                type: 'run_python',
                source: pythonSource
            };
        }

        ConversationStore.updateMessage(activeConvId, tempMsgId, { 
            content: finalReply,
            proposal: proposalObj
        });
        loadData();

    } catch (err: any) {
        console.error(err);
        ConversationStore.appendMessage(activeConvId, {
            id: 'err_' + Date.now(),
            role: 'assistant',
            content: "I'm sorry, I encountered an error. " + err.message
        });
        loadData();
    }
    
    setLoading(false);
  };
`;
  
  code = code.substring(0, idxOpen) + handleSendBlock + "\n\n  " + code.substring(idxClose);
  fs.writeFileSync('src/components/Chatbot.tsx', code);
}
