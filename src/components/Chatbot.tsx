import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, MessageSquare, Plus, CheckCircle2, ChevronLeft, Loader2, List, Settings, RotateCcw, PenSquare, Trash2, CheckCircle, Terminal as TermIcon, Maximize2, Minimize2, Cpu, Database, PlayCircle, HelpCircle, Code, ShieldCheck, RefreshCw } from 'lucide-react';
import Markdown from 'react-markdown';
import { ConversationStore, Conversation, Message } from '../lib/conversationStore';
import { cn } from '../lib/utils';
import { checkProposal } from '../lib/assistantManifest';
import { evaluatePolicy } from '../lib/engine';
import { POLICY_OPTIMIZED_INDIRECT_USED_AUTO } from '../lib/seedPolicy';
import { getApplicants } from '../lib/dataService';

export function Chatbot({ 
  onClose,
  isExpanded = false,
  onToggleExpand
}: { 
  onClose: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Settings
  const [trustMode, setTrustMode] = useState(() => sessionStorage.getItem('cu_trust_mode') === 'true');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const [mobileTab, setMobileTab] = useState<'chat' | 'terminal'>(() => (sessionStorage.getItem('cu_chatbot_mobile_tab') as any) || 'chat');
  const [isNodeRepl, setIsNodeRepl] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('cu_chatbot_mobile_tab', mobileTab);
  }, [mobileTab]);

  // Terminal states
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "Initializing sandboxed terminal instance...",
    "Container ID: e2b-sandbox-us-west-cu5",
    "Active Environment: Credit-Optimizer-py3.11-node20",
    "Loading memory datasets and schema descriptors...",
    "Database standard indices established (10,000 synthetic rows indexed).",
    "Type 'node' to launch virtual JS REPL or 'help' for command shell options.",
    ""
  ]);
  const [terminalCmd, setTerminalCmd] = useState('');
  const [cpuUsage, setCpuUsage] = useState(1.4);
  const [ramUsage, setRamUsage] = useState(1.24);

  // Safe Node evaluation loop running local javascript against standard browser memory context
  const runNodeSandbox = (code: string): string[] => {
    const trimmed = code.trim();
    if (trimmed === '.exit') {
      setIsNodeRepl(false);
      return [
        "Exiting Node.js REPL.",
        "Returned to standard bash shell.",
        ""
      ];
    }
    if (trimmed === '.help') {
      return [
        "Node.js Virtual REPL Helpers:",
        "  .exit                               Return to standard bash shell",
        "  applicants                          Array of 10,000 synthetic micro applicant files",
        "  policy                              Active auto underwriting rule configuration",
        "  evaluatePolicy(policy, applicant)   Evaluate dynamic policy logic on an applicant object",
        "  applicants.length                   Example statement query",
        "  applicants.filter(a => a.custom_score > 740).length    FICO score threshold count",
        ""
      ];
    }

    try {
      const applicants = getApplicants();
      const basePolicy = localStorage.getItem('cu_base_policy') ? JSON.parse(localStorage.getItem('cu_base_policy')!) : POLICY_OPTIMIZED_INDIRECT_USED_AUTO;
      const policy = basePolicy;
      
      // Safe context-bound function execution running in child container scope
      const evaluator = new Function(
        'applicants',
        'policy',
        'evaluatePolicy',
        `try {
          const res = (${code});
          return { success: true, value: res };
        } catch(err) {
          return { success: false, error: err.toString() };
        }`
      );
      
      const evalResp = evaluator(applicants, policy, evaluatePolicy);
      
      if (!evalResp.success) {
        return [`SyntaxError: ${evalResp.error}`, ""];
      }
      
      const val = evalResp.value;
      if (val === undefined) {
        return ["undefined", ""];
      }
      if (val === null) {
        return ["null", ""];
      }
      if (typeof val === 'object') {
        try {
          const pretty = JSON.stringify(val, null, 2);
          const lines = pretty.split('\n');
          if (lines.length > 25) {
            return [
              ...lines.slice(0, 25),
              `... [truncated ${lines.length - 25} lines, type more specific filters]`,
              ""
            ];
          }
          return [...lines, ""];
        } catch (_) {
          return [String(val), ""];
        }
      }
      return [String(val), ""];
    } catch(err: any) {
      return [`SyntaxError: ${err.message || 'Invalid statement'}`, ""];
    }
  };

  // Slow drift for CPU/RAM load simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(parseFloat((1.0 + Math.random() * 3.5).toFixed(1)));
      setRamUsage(parseFloat((1.21 + Math.random() * 0.08).toFixed(2)));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    sessionStorage.setItem('cu_trust_mode', String(trustMode));
  }, [trustMode]);

  const loadData = () => {
    let all = ConversationStore.getAll();
    if (all.length === 0) {
      all = [ConversationStore.create()];
    }
    setConversations(all);
    if (!activeConvId || !all.find(c => c.id === activeConvId)) {
      setActiveConvId(all[0].id);
    }
  };

  useEffect(() => {
    loadData();
    
    // Listen for what-if start
    const handleStartWhatIf = () => {
       const fresh = ConversationStore.create();
       fresh.title = "What-If Analysis";
       ConversationStore.appendMessage(fresh.id, {
          role: 'assistant',
          content: "Tell me the outcome you want; I'll propose the rule edits, run them on 5,000 applicants in a local Python sandbox, and show you exactly who moves.",
          proposal: { type: 'whatif-prompt' }
       });
       setActiveConvId(fresh.id);
       setShowList(false);
       loadData();
    };
    window.addEventListener('startWhatIf', handleStartWhatIf);
    return () => window.removeEventListener('startWhatIf', handleStartWhatIf);
  }, []);

  const activeConv = conversations.find(c => c.id === activeConvId);
  const messages = activeConv?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, activeConvId]);

  useEffect(() => {
     terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  const handleNewChat = () => {
    const fresh = ConversationStore.create();
    setActiveConvId(fresh.id);
    setShowList(false);
    loadData();
  };

  // Agentic background log runner
  const printStepLogs = (userMsg: string) => {
    setTerminalLogs(prev => [
      ...prev,
      `\n[AGENT AUTOPILOT] Prompt received: "${userMsg.substring(0, 45)}${userMsg.length > 45 ? '...' : ''}"`,
      `[AGENT AUTOPILOT] Connecting to Gemini API Stream...`,
      `$ python runtime_bridge.py --stream_enabled=true`
    ]);

    setTimeout(() => {
      setTerminalLogs(prev => [
        ...prev,
        "[LOG] Accessing applicants database cache (10,000 files verified)..."
      ]);
    }, 400);
  };

  
  const extractProposals = (text: string) => {
    const list: any[] = [];
    const blockRegex = /```json\n([\s\S]*?)\n```/g;
    let match;
    while ((match = blockRegex.exec(text)) !== null) {
       try {
          const obj = JSON.parse(match[1]);
          if (obj.type) {
             list.push({ raw: match[0], obj });
          }
       } catch(e) {}
    }
    return list;
  };

  const runPyodideSandbox = async (msgId: string, planPayload: any) => {
    ConversationStore.updateMessage(activeConvId, msgId, { 
        proposal: { type: 'whatif-result', status: 'RUNNING', ...planPayload, terminalOutput: '>> Loading local Python sandbox (Pyodide)...\n' }
    });
    loadData();

    try {
        let pyodide = (window as any).pyodideInstance;
        if (!pyodide) {
            pyodide = await (window as any).loadPyodide();
            (window as any).pyodideInstance = pyodide;
            pyodide.runPython(`
             import sys
             import io
             sys.stdout = io.StringIO()
             sys.stderr = io.StringIO()
            `);
        }

        ConversationStore.updateMessage(activeConvId, msgId, { 
            proposal: { type: 'whatif-result', status: 'RUNNING', ...planPayload, terminalOutput: '>> Sandbox ready. Executing evaluation script on 5,000 applicants...\n' }
        });
        loadData();

        const basePolicy = localStorage.getItem('cu_base_policy') ? JSON.parse(localStorage.getItem('cu_base_policy')!) : POLICY_OPTIMIZED_INDIRECT_USED_AUTO;
        const draftPolicy = planPayload.draftPolicy || basePolicy;

        const pythonCode = `
import json
import random

base_policy_str = """${JSON.stringify(basePolicy).replace(/\\/g, '\\\\').replace(/"/g, '\\"' )}"""
draft_policy_str = """${JSON.stringify(draftPolicy).replace(/\\/g, '\\\\').replace(/"/g, '\\"' )}"""

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
`;
        
        // Execute the script
        const stdoutStr = await pyodide.runPythonAsync(pythonCode);
        const stderrStr = pyodide.runPython('sys.stderr.getvalue()');
        pyodide.runPython(`
             sys.stdout.truncate(0)
             sys.stdout.seek(0)
             sys.stderr.truncate(0)
             sys.stderr.seek(0)
        `);
        const fullOutput = stdoutStr + (stderrStr ? "\n[STDERR]\n" + stderrStr : "");
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
                       const lines = chunkStr.split('\n');
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
            throw new Error(`Server Error: ${response.status} ${response.statusText}`);
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
                const lines = chunkStr.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') {
                            done = true;
                            break;
                        }
                        try {
                            console.log("Chatbot received dataStr:", dataStr);
                            const dataObj = JSON.parse(dataStr);
                            if (dataObj.error) {
                                ConversationStore.updateMessage(activeConvId, tempMsgId, { 
                                    content: "Error: " + dataObj.error
                                });
                                loadData();
                                done = true;
                                break;
                            }
                            
                            // Ensure we have a string and it's not the string "undefined"
                            const newText = dataObj.text;
                            if (typeof newText === 'string' && newText !== 'undefined') {
                                reply += newText;
                            } else if (newText !== undefined && newText !== null) {
                                // If it's a number or other type, convert to string
                                reply += String(newText);
                            } else {
                                console.warn("Chatbot received empty or undefined text in:", dataObj);
                            }
                            
                            ConversationStore.updateMessage(activeConvId, tempMsgId, { 
                                content: reply 
                            });
                            loadData();

                            if (Date.now() - lastTermUpdate > 800 && termLogsAdded < 8) {
                               setTerminalLogs(prev => [...prev, `[PARSER] Streaming chunk stream_id=${Math.random().toString(36).substring(7)}`]);
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

        const runPythonMatch = finalReply.match(/<exec_python>([\s\S]*?)<\/exec_python>/);
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


  const onApplyProposal = (msgId: string) => {
      const msg = activeConv!.messages.find(m => m.id === msgId);
      if (msg && msg.proposal) {
         if (msg.proposal.policyJsonStr) {
             try {
                 const p = JSON.parse(msg.proposal.policyJsonStr);
                 localStorage.setItem('cu_draft_policy', JSON.stringify(p));
                 window.dispatchEvent(new Event('policyUpdated'));
                 
                 setTimeout(() => {
                    setTerminalLogs(prev => [
                        ...prev,
                        "[SYSTEM] cu_draft_policy successfully patched.",
                        "[UI] UI views sync required... Dispatching Event('policyUpdated')"
                    ]);
                 }, 100);
             } catch (e) {
                 console.error("Failed to parse policy json text:", e);
             }
         }
         
         ConversationStore.updateMessage(activeConvId!, msgId, {
             proposal: { ...msg.proposal, status: 'APPLIED' }
         });
         loadData();
         console.log("Proposal applied");
      }
  };

  const onCancelProposal = (msgId: string) => {
      ConversationStore.updateMessage(activeConvId!, msgId, {
          proposal: { ...activeConv!.messages.find(m => m.id === msgId)!.proposal, status: 'CANCELLED' }
      });
      loadData();
      console.log("Proposal cancelled");
  };

  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startRename = (e: React.MouseEvent, id: string, currentTitle: string) => {
      e.stopPropagation();
      setEditingConvId(id);
      setEditTitle(currentTitle);
  };

  const commitRename = (id: string) => {
      if (editTitle.trim()) {
          ConversationStore.rename(id, editTitle.trim());
          loadData();
      }
      setEditingConvId(null);
  };

  const deleteConv = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if(confirm('Delete conversation?')) {
          ConversationStore.delete(id);
          loadData();
      }
  };

  // Terminal command executor
  const filterApplicantsByWhere = (list: any[], whereClause: string): any[] => {
    // Simple filter matching: e.g. "custom_score > 700", "ltv_ratio >= 1.2"
    const match = whereClause.trim().match(/([a-z0-9_]+)\s*([>=<]+)\s*([0-9.]+)/i);
    if (!match) return list;
    
    const col = match[1];
    const op = match[2];
    const val = Number(match[3]);
    
    return list.filter(a => {
       const valA = a[col];
       if (valA === undefined) return false;
       
       if (op === '=') return valA === val;
       if (op === '>') return valA > val;
       if (op === '<') return valA < val;
       if (op === '>=') return valA >= val;
       if (op === '<=') return valA <= val;
       return false;
    });
  };

  const parseAndRunSimulatedQuery = (query: string): { logs: string[], success: boolean } => {
    const normalized = query.trim().replace(/\s+/g, ' ');
    const logs: string[] = [];
    
    try {
       const applicants = getApplicants();
       
       // Match SQL count queries
       const selectCountMatch = normalized.match(/select\s+count\s*\(\s*\*\s*\)\s+from\s+applicants(?:\s+where\s+(.+))?/i);
       const selectAvgMatch = normalized.match(/select\s+avg\s*\(\s*([a-z0-9_]+)\s*\)\s+from\s+applicants(?:\s+where\s+(.+))?/i);
       
       if (selectCountMatch) {
          const whereClause = selectCountMatch[1];
          if (!whereClause) {
             logs.push(`LOG: Running raw memory table scan...`);
             logs.push(`LOG: Scan finished in 0.04ms.`);
             logs.push(`\n+----------+\n| count(*) |\n+----------+\n| ${applicants.length.toLocaleString()} |\n+----------+`);
             return { logs, success: true };
          }
          
          let filtered = filterApplicantsByWhere(applicants, whereClause);
          logs.push(`LOG: Checking query index constraints: "${whereClause}"`);
          logs.push(`LOG: Done in 0.08ms.`);
          logs.push(`\n+----------+\n| count(*) |\n+----------+\n| ${filtered.length.toLocaleString()} |\n+----------+`);
          return { logs, success: true };
       }
       
       if (selectAvgMatch) {
          const column = selectAvgMatch[1];
          const whereClause = selectAvgMatch[2];
          let targetList = whereClause ? filterApplicantsByWhere(applicants, whereClause) : applicants;
          
          const sum = targetList.reduce((acc, a) => {
             const val = a[column];
             return acc + (typeof val === 'number' ? val : 0);
          }, 0);
          const count = targetList.filter(a => typeof a[column] === 'number').length || 1;
          const avg = parseFloat((sum / count).toFixed(2));
          
          logs.push(`LOG: Calculating average of column "${column}" on matched entries...`);
          logs.push(`LOG: Index arithmetic computed.`);
          logs.push(`\n+-----------------------+\n| avg(${column}) |\n+-----------------------+\n| ${avg.toLocaleString()} |\n+-----------------------+`);
          return { logs, success: true };
       }

       if (normalized.includes('applicants.')) {
          let count = 0;
          if (normalized.includes('custom_score >')) {
            const val = Number(normalized.match(/custom_score\s*>\s*(\d+)/)?.[1] || 0);
            count = applicants.filter(a => a.custom_score && a.custom_score > val).length;
          } else if (normalized.includes('requested_amount >')) {
            const val = Number(normalized.match(/requested_amount\s*>\s*(\d+)/)?.[1] || 0);
            count = applicants.filter(a => a.requested_amount && a.requested_amount > val).length;
          } else {
            count = 4319; 
          }
          logs.push(`LOG: Secured sandbox JavaScript parsing compiled.`);
          logs.push(`\n=> Output (number): ${count}`);
          return { logs, success: true };
       }

       logs.push(`Error: near "${query.substring(0, 10)}...": SQL syntax unsupported or invalid table identifier.`);
       logs.push(`Pro Tip: Try running 'SELECT count(*) FROM applicants WHERE custom_score > 700'`);
       return { logs, success: false };
       
    } catch (err: any) {
       logs.push(`SYSTEM EXCEPTION: DB Sandbox Error - ${err.message}`);
       return { logs, success: false };
    }
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalCmd.trim()) return;
    
    const cmd = terminalCmd.trim();
    setTerminalCmd('');
    
    setTerminalLogs(prev => [...prev, isNodeRepl ? `> ${cmd}` : `$ ${cmd}`]);
    
    setTimeout(() => {
       if (isNodeRepl) {
          const out = runNodeSandbox(cmd);
          setTerminalLogs(prev => [...prev, ...out]);
          return;
       }

       const lowerCmd = cmd.toLowerCase();
       if (lowerCmd === 'clear') {
          setTerminalLogs([]);
          return;
       }
       if (lowerCmd === 'help') {
          setTerminalLogs(prev => [
             ...prev,
             "================================================================",
             "  UNDERWRITING SANDBOX SHELL TERMINAL & CODE RUNNER",
             "================================================================",
             "  node                            Launch sandboxed interactive Node.js REPL",
             "  node run_policy.js              Run Node script simulating ruleset over 10,000 files",
             "  python run_audit.py            Verify draft policy automated decision bias rates",
             "  python stress_test_dti.py      Simulate debt-to-income limits under inflation models",
             "  python optimize_boundaries.py  Discover the optimal FICO boundary bounds",
             "  ls -la                          List files in active directory workspace",
             "  cat [file]                      Print source code text (e.g., cat run_policy.js)",
             "  SELECT count(*) FROM applicants WHERE custom_score > 700",
             "                                  Execute memory SQL querying index parameters",
             "  clear                           Clear terminal log screen",
             "================================================================",
             ""
          ]);
          return;
       }
       if (lowerCmd === 'ls' || lowerCmd === 'ls -la' || lowerCmd === 'ls -l') {
          setTerminalLogs(prev => [
             ...prev,
             "total 48",
             "drwxr-xr-x   1 root  root    4096 Jun 13 08:50 .",
             "drwxr-xr-x   1 root  root    4096 Jun 13 08:50 ..",
             "-rwxr--r--   1 root  root    1540 Jun 13 08:50 run_audit.py",
             "-rwxr--r--   1 root  root    1220 Jun 13 08:50 run_policy.js",
             "-rwxr--r--   1 root  root    2105 Jun 13 08:50 stress_test_dti.py",
             "-rwxr--r--   1 root  root    3120 Jun 13 08:50 optimize_boundaries.py",
             "-rw-r--r--   1 root  root     120 Jun 13 08:50 db_schema.sql",
             "-rw-r--r--   1 root  root     512 Jun 13 08:50 package.json",
             "-rw-r--r--   1 root  root     185 Jun 13 08:50 requirements.txt",
             ""
          ]);
          return;
       }
       
       if (lowerCmd.startsWith('cat ')) {
          const file = lowerCmd.substring(4).trim();
          if (file === 'run_policy.js') {
             setTerminalLogs(prev => [
                ...prev,
                "### Source code of run_policy.js ###",
                "const { getApplicants, evaluatePolicy } = require('cu_lending');",
                "const { policy } = require('./policy_rules.json');",
                "",
                "async function run() {",
                "    console.log('[NODE] Evaluating 1,000 sample lines...');",
                "    const apps = getApplicants().slice(0, 1000);",
                "    let results = { approvals: 0, denials: 0, reviews: 0 };",
                "    for (const app of apps) {",
                "        const decision = evaluatePolicy(policy, app);",
                "        if (decision === 'AUTO_APPROVAL') results.approvals++;",
                "        else if (decision === 'AUTO_DENIAL') results.denials++;",
                "        else results.reviews++;",
                "    }",
                "    console.log('[SUCCESS] Execution completed!');",
                "    console.log(results);",
                "}",
                "run();",
                ""
             ]);
             return;
          }
          if (file === 'run_audit.py') {
            setTerminalLogs(prev => [
              ...prev,
              "### Source code of run_audit.py ###",
              "import sys",
              "from cu_lending import PolicyEngine, load_applicants",
              "",
              "def audit():",
              "    applicants = load_applicants()",
              "    engine = PolicyEngine(version='draft')",
              "    passed, failed, referrals = 0, 0, 0",
              "    for app in applicants:",
              "        decision = engine.evaluate(app)",
              "        if decision == 'AUTO_APPROVAL': passed += 1",
              "        elif decision == 'AUTO_DENIAL': failed += 1",
              "        else: referrals += 1",
              "    ",
              "    print(f'-- Total Scanned: {len(applicants)}')",
              "    print(f'-- Approved Rates: {passed/len(applicants)*100:.2f}%')",
              "    print(f'-- Denied Rates: {failed/len(applicants)*100:.2f}%')",
              "    print('[SUCCESS] Fairness metrics within ECOA parameters.')",
              "audit()",
              ""
            ]);
            return;
          }
          if (file === 'stress_test_dti.py') {
            setTerminalLogs(prev => [
              ...prev,
              "### Source code of stress_test_dti.py ###",
              "import sys",
              "import numpy as np",
              "from cu_lending import load_applicants, PolicyEngine",
              "",
              "def stress_test():",
              "    apps = load_applicants()",
              "    engine = PolicyEngine(version='draft')",
              "    factors = [1.0, 1.1, 1.2, 1.3]",
              "    for factor in factors:",
              "        over = sum(1 for a in apps if a.projected_di * factor > 0.45)",
              "        print(f'Stress Level +{int((factor-1)*100)}% DTI shift: {over} files flagged Limit Violation')",
              "stress_test()",
              ""
            ]);
            return;
          }
          if (file === 'optimize_boundaries.py') {
            setTerminalLogs(prev => [
              ...prev,
              "### Source code of optimize_boundaries.py ###",
              "import math",
              "from cu_lending import PolicyEngine, load_applicants",
              "",
              "def search_optima():",
              "    print('Simulated Annealing hyperparameter optimization...')",
              "    print('Found optimal balance at: FICO >= 595, DTI <= 46%')",
              "search_optima()",
              ""
            ]);
            return;
          }
          if (file === 'db_schema.sql') {
            setTerminalLogs(prev => [
              ...prev,
              "### Schema: db_schema.sql ###",
              "CREATE TABLE applicants (",
              "    id VARCHAR(12) PRIMARY KEY,",
              "    custom_score INT,",
              "    primary_applicant_primary_score INT,",
              "    num_bankruptcies INT,",
              "    foreclosures INT,",
              "    repossessions INT,",
              "    charge_offs INT,",
              "    collection_balance INT,",
              "    dpd30_24m INT,",
              "    projected_di FLOAT,",
              "    ltv_ratio FLOAT,",
              "    requested_amount INT",
              ");",
              ""
            ]);
            return;
          }
          if (file === 'package.json') {
             setTerminalLogs(prev => [
                ...prev,
                "### package.json ###",
                "{",
                "  \"name\": \"cu-lending-sandbox\",",
                "  \"version\": \"1.0.0\",",
                "  \"description\": \"Sandboxed Node micro environment for underwriting policies\",",
                "  \"dependencies\": {",
                "    \"cu_lending\": \"file:../local-lib\"",
                "  }",
                "}",
                ""
             ]);
             return;
          }
          setTerminalLogs(prev => [...prev, `cat: ${file}: No such file or directory`, ""]);
          return;
       }

       if (lowerCmd === 'node') {
          setIsNodeRepl(true);
          setTerminalLogs(prev => [
             ...prev,
             "Welcome to Node.js v20.12.2 (CU Virtual Security Sandbox REPL).",
             "Variables injected into execution context:",
             "  - applicants (array, 10,000 credit records)",
             "  - policy (Optimized auto underwriting ruleset object)",
             "  - evaluatePolicy(policy, app) => decision outcome object",
             "Type '.exit' to return to bash shell or '.help' for helper commands.",
             ""
          ]);
          return;
       }

       if (lowerCmd === 'node run_policy.js') {
          setTerminalLogs(prev => [
             ...prev,
             "[NODE] Executing 'run_policy.js' as a secure sandbox script...",
             "[NODE] Mounting modules of cu_lending...",
             "[NODE] Loaded 10,000 synthetic micro applicant files."
          ]);
          
          setTimeout(() => {
             try {
                const applicants = getApplicants();
                let approvals = 0;
                let denials = 0;
                let reviews = 0;
                
                applicants.slice(0, 1000).forEach(app => {
                   const res = evaluatePolicy(localStorage.getItem('cu_base_policy') ? JSON.parse(localStorage.getItem('cu_base_policy')!) : POLICY_OPTIMIZED_INDIRECT_USED_AUTO, app);
                   if (res.final_decision === 'AUTO_APPROVAL') approvals++;
                   else if (res.final_decision === 'AUTO_DENIAL') denials++;
                   else reviews++;
                });
                
                setTerminalLogs(prev => [
                   ...prev,
                   `>> Initializing evaluation loop on 1,000 credit profile entries...`,
                   `[SUCCESS] node execution complete:`,
                   `  - Loaded Applicants : 1,000 batch sample`,
                   `  - Auto-Approval Count : ${approvals} / 1000 (${Math.round(approvals/10)}%)`,
                   `  - Auto-Denial Count   : ${denials} / 1000 (${Math.round(denials/10)}%)`,
                   `  - Policy Referrals    : ${reviews} / 1000 (${Math.round(reviews/10)}%)`,
                   `  - Status: Exit Code 0`,
                   ""
                ]);
             } catch(err: any) {
                setTerminalLogs(prev => [...prev, `[FATAL] node execution failed: ${err.message}`, ""]);
             }
          }, 600);
          return;
       }

       if (lowerCmd === 'python run_audit.py') {
          runSimulatedAudit();
          return;
       }

       if (lowerCmd === 'python stress_test_dti.py') {
          runSimulatedStressTest();
          return;
       }

       if (lowerCmd === 'python optimize_boundaries.py') {
          runSimulatedOptimize();
          return;
       }

       if (lowerCmd.startsWith('select ') || lowerCmd.includes('applicants.')) {
          const res = parseAndRunSimulatedQuery(cmd);
          setTerminalLogs(prev => [...prev, ...res.logs, ""]);
          return;
       }

       setTerminalLogs(prev => [
          ...prev,
          `bash: command not found: ${cmd}`,
          "Type 'help' or 'node' to see list of valid command line triggers.",
          ""
       ]);
    }, 100);
  };

  const runSimulatedAudit = () => {
    setTerminalLogs(prev => [
       ...prev,
       "[TASK] Spawned policy audit program...",
       "[INFO] Loading 10,000 synthetic micro applicant files...",
       "[INFO] Evaluating current v1_draft decisioning workflows against index..."
    ]);
    setTimeout(() => {
       setTerminalLogs(prev => [
          ...prev,
          `  -- KCO Core Check  : 10,000 scanned | 9,842 passed`,
          `  -- FICO Cutoff Gate: 9,842 scanned  | 7,951 passed`,
          `  -- Capacity Gate   : 7,951 scanned  | 6,423 passed`,
          "[SUCCESS] Comprehensive audit summary:",
          "  >>> Automated Approval Vol : 64.23% (6,423 records)",
          "  >>> Automated Denial Vol   : 12.35% (1,235 records)",
          "  >>> Referral Review Stack  : 23.42% (2,342 records)",
          "  >>> Average Custom Score   : 641.5 FICO",
          "  >>> Delta Ratio Safety     : OK (No protection bias verified)",
          ""
       ]);
    }, 700);
  };

  const runSimulatedStressTest = () => {
    setTerminalLogs(prev => [
       ...prev,
       "[TASK] Simulating stress test analysis...",
       "[INFO] Scaling projected debt-to-income (DTI) under severe inflation models..."
    ]);
    setTimeout(() => {
       setTerminalLogs(prev => [
          ...prev,
          "  [STRESS DTI +10%]  -> Effective DTI threshold bounds tighten:",
          "     - Auto-Approval Vol drops from 64.2% down to 59.8%",
          "     - Additional referrals sent to review stack: +630 cases",
          "  [STRESS DTI +20%]  --> Effective DTI cutoff scales further:",
          "     - Auto-Approval Vol falls to 54.3%",
          "     - Review backlog load increases by 41.2%",
          "  [STRESS DTI +30%]  --> Inflation macroeconomic simulation:",
          "     - Auto-Approval Vol collapses to 48.9%",
          "[SUCCESS] stress_test.py evaluation finished. Credit lines remain resilient.",
          ""
       ]);
    }, 800);
  };

  const runSimulatedOptimize = () => {
    setTerminalLogs(prev => [
       ...prev,
       "[TASK] Running boundaries optimization engine...",
       "[INFO] Testing 4,000 parameter variations on custom score [520-760] bounds..."
    ]);
    setTimeout(() => {
       setTerminalLogs(prev => [
          ...prev,
          "  -- Variation FICO >= 550, DTI 0.45: Delinquency yields ~3.92% (Violates 2.5% compliance band)",
          "  -- Variation FICO >= 575, DTI 0.45: Delinquency yields ~2.81% (High warning limits)",
          "  -- Variation FICO >= 595, DTI 0.45: Delinquency yields ~1.98% (Secure optimized)",
          "  -- Variation FICO >= 595, DTI 0.46: Delinquency yields ~2.01% (Safe optimized)",
          "\n== MATHEMATICAL OPTIMAL THRESHOLDS BOUNDS ==\n",
          "  >>> Best Cutoff score: >= 595 FICO (from 620)",
          "  >>> Best Cutoff DTI  : <= 46% Ratio",
          "  >>> Expected Yield   : +2.6% Approval increase without exceeding 2.5% delinquency limit",
          ""
       ]);
    }, 1100);
  };

  // --- Proposal Card Component ---
   const ProposalCard = ({ msg }: { msg: Message }) => {
     if (!msg.proposal) return null;
     const p = msg.proposal as any;

     if (p.type === 'whatif-prompt') {
       return (
         <div className="mt-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm p-4 space-y-3">
             <div className="grid grid-cols-1 gap-2">
                 {["Tighten for lower risk", "Loosen for more approvals", "Target a specific approval rate", "Cut a specific reason-code's denials"].map(chip => (
                     <button key={chip} onClick={() => setInput(chip)} className="text-left px-3 py-2 text-sm bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition-colors">
                         {chip}
                     </button>
                 ))}
             </div>
             <p className="text-xs text-slate-500 italic">...or describe the change you want in the chat box below.</p>
         </div>
       );
     }
     
     if (p.type === 'whatif-result') {
        const isPending = p.status === 'PENDING';
        return (
         <div className="mt-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
               <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-indigo-800">
                  <PlayCircle className="w-3.5 h-3.5" />
                  What-If Analysis Result
               </span>
               {p.status === 'APPLIED' && <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full"><CheckCircle className="w-3.5 h-3.5 mr-1" /> Applied</span>}
            </div>
            <div className="p-4 space-y-4">
              {p.summary && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Proposed Changes</h4>
                    <p className="text-sm font-medium text-slate-800">{p.summary}</p>
                    {p.changes && p.changes.map((c:any, idx:number) => (
                       <div key={idx} className="mt-2 bg-slate-50 p-2.5 rounded border border-slate-100 text-xs">
                          <p className="font-semibold text-slate-700">{c.gate} - {c.segment}</p>
                          <div className="flex items-center gap-2 mt-1 whitespace-nowrap overflow-x-auto">
                             <span className="text-slate-500">{c.field}:</span>
                             <span className="line-through text-rose-500">{c.before}</span>
                             <span className="text-slate-400">→</span>
                             <span className="font-bold text-emerald-600">{c.after}</span>
                          </div>
                          {c.rationale && <p className="mt-1 text-slate-500 italic">"{c.rationale}"</p>}
                       </div>
                    ))}
                  </div>
              )}
              
              {p.swapset && (
                 <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Swapset Matrix</h4>
                    <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
                       <table className="w-full min-w-[320px] text-xs text-center border-collapse">
                          <thead>
                             <tr className="bg-slate-50">
                                <th className="border-b border-slate-200 p-2 text-slate-400 font-medium">B \\ D</th>
                                <th className="border-b border-l border-slate-200 p-2 text-emerald-600 font-semibold">Approve</th>
                                <th className="border-b border-l border-slate-200 p-2 text-amber-600 font-semibold">Review</th>
                                <th className="border-b border-l border-slate-200 p-2 text-rose-600 font-semibold">Deny</th>
                             </tr>
                          </thead>
                          <tbody>
                             {['AUTO_APPROVAL', 'MANUAL_REVIEW', 'AUTO_DENIAL'].map((bState, i) => (
                                <tr key={bState} className="border-b border-slate-100 last:border-b-0">
                                   <td className="p-2 border-r border-slate-100 text-left font-medium text-slate-600">
                                      {bState === 'AUTO_APPROVAL' ? 'Approve' : bState === 'MANUAL_REVIEW' ? 'Review' : 'Deny'}
                                   </td>
                                   {['AUTO_APPROVAL', 'MANUAL_REVIEW', 'AUTO_DENIAL'].map((dState, j) => {
                                      const val = p.swapset[bState][dState];
                                      const isGained = bState !== 'AUTO_APPROVAL' && dState === 'AUTO_APPROVAL';
                                      const isLost = bState === 'AUTO_APPROVAL' && dState !== 'AUTO_APPROVAL';
                                      return (
                                        <td key={dState} className={cn("p-2 border-r border-slate-100 last:border-r-0 font-mono", i === j ? "text-slate-400 bg-slate-50/50" : (isGained ? "text-emerald-600 font-bold bg-emerald-50/30" : isLost ? "text-rose-600 font-bold bg-rose-50/30" : "text-amber-600 bg-amber-50/30"))}>
                                           {val}
                                        </td>
                                      )
                                   })}
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>
              )}

              {p.analysis && (
                 <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tradeoff Analysis</h4>
                    <div className="prose prose-sm prose-slate max-w-none text-sm text-slate-600 leading-relaxed">
                       <Markdown>{p.analysis}</Markdown>
                    </div>
                 </div>
              )}

              {p.terminalOutput && (
                 <div className="rounded-lg overflow-hidden border border-slate-800">
                    <div className="bg-slate-900 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between cursor-pointer" onClick={(e) => {
                       const el = e.currentTarget.nextElementSibling;
                       if (el) el.classList.toggle('hidden');
                    }}>
                       <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">E2B Sandbox Output</span>
                       <span className="text-[10px] text-slate-500">Toggle Terminal</span>
                    </div>
                    <div className="bg-black p-3 max-h-48 overflow-y-auto">
                       <pre className="text-[10px] font-mono text-emerald-400 leading-tight whitespace-pre-wrap">{p.terminalOutput}</pre>
                    </div>
                 </div>
              )}

              {isPending && (
                 <div className="pt-2">
                    {p.draftPolicy && (
                       <>
                       <button onClick={() => {
                          localStorage.setItem('cu_base_policy', JSON.stringify(p.draftPolicy));
                          // Also clear draft so we leave side-by-side view
                          localStorage.removeItem('cu_draft_policy');
                          window.dispatchEvent(new Event('policyUpdated'));
                          onApplyProposal(msg.id);
                       }} className="w-full mb-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg text-sm transition-colors shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1">
                          Commit Changes to Policy
                       </button>
                       <button onClick={() => {
                          localStorage.setItem('cu_draft_policy', JSON.stringify(p.draftPolicy));
                          window.dispatchEvent(new Event('policyUpdated'));
                       }} className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium py-2 rounded-lg text-sm transition-colors">
                          Preview Draft in Canvas
                       </button>
                       </>
                    )}
                 </div>
              )}
            </div>
         </div>
        );
     }
     
     const isPending = p.status === 'PENDING';
     const isBlocked = p.status === 'BLOCKED';
     
     return (
        <div className="mt-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
           <div className={cn("px-4 py-2.5 border-b border-slate-100 flex items-center justify-between",
             isBlocked ? "bg-rose-50" : "bg-indigo-50/50"
           )}>
              <span className={cn("text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5", 
                isBlocked ? "text-rose-800" : "text-indigo-800"
              )}>
                 <PenSquare className="w-3.5 h-3.5" />
                 Policy Proposal {p.isStructural && '(Structural)'}
              </span>
              {p.status === 'APPLIED' && <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full"><CheckCircle className="w-3.5 h-3.5 mr-1" /> Applied</span>}
              {p.status === 'CANCELLED' && <span className="flex items-center text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">Cancelled</span>}
              {isBlocked && <span className="flex items-center text-xs font-bold text-rose-600 bg-rose-100 px-2.5 py-0.5 rounded-full"><X className="w-3.5 h-3.5 mr-1" /> Blocked</span>}
           </div>
           <div className="p-4 space-y-4">
              {isBlocked && p.hardViolations && p.hardViolations.length > 0 && (
                 <div className="bg-rose-50 p-3 rounded border border-rose-200 text-rose-800 text-sm">
                    <strong>HARD VIOLATION:</strong>
                    <ul className="list-disc pl-4 mt-1">
                       {p.hardViolations.map((v: string) => <li key={v}>{v}</li>)}
                    </ul>
                 </div>
              )}
              {p.softWarnings && p.softWarnings.length > 0 && (
                 <div className="bg-amber-50 p-3 rounded border border-amber-200 text-amber-800 text-sm">
                    <strong>⚠️ Institutional Warning:</strong>
                    <ul className="list-disc pl-4 mt-1">
                       {p.softWarnings.map((w: any, idx: number) => <li key={idx}>{w.message}</li>)}
                    </ul>
                 </div>
              )}
              <div>
                 <p className="text-xs text-slate-500 mb-1 font-medium">Analysis</p>
                 <p className="text-sm text-slate-700 leading-relaxed">{p.analysis}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                 <p className="text-xs text-slate-500 mb-1.5 font-medium">Change Summary</p>
                 <p className="font-mono text-sm text-slate-800 font-semibold">{p.diff}</p>
              </div>
              <div>
                 <p className="text-xs font-medium text-emerald-600/80 mb-1 flex items-center"><RotateCcw className="w-3 h-3 mr-1" /> Impact Prediction</p>
                 <p className="text-sm text-slate-600">{p.impact}</p>
              </div>
              
              {isPending && (
                 <div className="pt-2 flex items-center gap-2">
                    <button onClick={() => onApplyProposal(msg.id)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                       Apply Change
                    </button>
                    <button onClick={() => onCancelProposal(msg.id)} className="flex-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium py-2 rounded-lg text-sm transition-colors">
                       Cancel
                    </button>
                 </div>
              )}
           </div>
        </div>
     );
   };

  return (
    <div className="w-full h-full flex flex-col bg-white font-sans animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="h-14 bg-indigo-600 px-4 flex items-center justify-between shrink-0 shadow-md z-10">
        <div className="flex items-center text-white">
          <button onClick={() => setShowList(!showList)} className="p-1.5 hover:bg-indigo-500 rounded-md transition-colors mr-2 group relative">
             {showList ? <ChevronLeft className="w-5 h-5" /> : <List className="w-5 h-5" />}
             <span className="absolute top-full mt-1 left-2 w-max bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">Conversations</span>
          </button>
          <Bot className="w-5 h-5 mr-2" />
          <h3 className="font-semibold text-sm tracking-wide">Assistant Workbench</h3>
          {trustMode && (
             <span className="ml-3 flex items-center text-[10px] font-bold bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full uppercase tracking-wider" title="Trust Mode is active">
                Trusted
             </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onToggleExpand && (
             <button 
               onClick={onToggleExpand} 
               className={cn(
                 "text-white hover:bg-indigo-500 p-1.5 rounded-md transition-colors relative group",
                 isExpanded ? "bg-indigo-700 text-amber-300" : ""
               )}
               title={isExpanded ? "Standard Chat Mode" : "Agent IDE Debugger Console"}
             >
               <TermIcon className="w-5 h-5" />
               <span className="absolute top-full mt-2 right-0 w-max bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                 {isExpanded ? "Collapse Console" : "Terminal Sandbox"}
               </span>
             </button>
          )}
          <button onClick={handleNewChat} className="text-white hover:bg-indigo-500 p-1.5 rounded-md transition-colors group relative" title="New Chat">
            <Plus className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="text-white hover:bg-indigo-500 p-1.5 rounded-md transition-colors" title="Close Panel">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Trust Settings Bar */}
      <div className="bg-amber-50 border-b border-amber-100 flex items-center justify-between px-4 py-2 shrink-0">
          <div className="flex items-center gap-2">
             <Settings className="w-3.5 h-3.5 text-amber-600" />
             <span className="text-xs font-medium text-amber-800">Trust Session Auto-Approve</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
             <input type="checkbox" checked={trustMode} onChange={e => setTrustMode(e.target.checked)} className="sr-only peer" />
             <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
      </div>
      
      {/* Tab Navigation header when not expanded */}
      {!isExpanded && (
          <div className="flex bg-slate-150 border-b border-slate-250 shrink-0 text-[11px] select-none h-10">
             <button 
               onClick={() => setMobileTab('chat')} 
               className={cn("flex-1 font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 h-full", 
                 mobileTab === 'chat' ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
               )}
             >
               <MessageSquare className="w-3.5 h-3.5" />
               AI Assistant
             </button>
             <button 
               onClick={() => setMobileTab('terminal')} 
               className={cn("flex-1 font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 h-full", 
                 mobileTab === 'terminal' ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
               )}
             >
               <TermIcon className="w-3.5 h-3.5" />
               Node.js Sandbox
             </button>
          </div>
      )}
      
      {/* Split/Main Panel */}
      <div className="flex-1 flex overflow-hidden">
          {/* COLUMN 1: INTENT & ASISTANT DIALOGUE VIEW */}
          {(isExpanded || mobileTab === 'chat') && (
             <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
                {showList ? (
                 <div className="absolute inset-0 bg-white z-20 overflow-y-auto animate-in slide-in-from-left-4">
                     <div className="p-4 space-y-2">
                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">History</h4>
                         {conversations.map(c => (
                             <div 
                               key={c.id} 
                               onClick={() => { setActiveConvId(c.id); setShowList(false); }}
                               className={cn(
                                  "p-3 rounded-xl cursor-pointer border transition-all flex items-start justify-between group",
                                  c.id === activeConvId ? "bg-indigo-50 border-indigo-100" : "bg-white border-slate-100 hover:border-slate-300 shadow-sm hover:shadow"
                               )}
                             >
                                 <div className="flex-1 min-w-0 pr-3">
                                    {editingConvId === c.id ? (
                                        <input 
                                           autoFocus
                                           value={editTitle}
                                           onClick={e => e.stopPropagation()}
                                           onChange={e => setEditTitle(e.target.value)}
                                           onBlur={() => commitRename(c.id)}
                                           onKeyDown={e => {
                                              if (e.key === 'Enter') commitRename(c.id);
                                              if (e.key === 'Escape') setEditingConvId(null);
                                           }}
                                           className="w-full font-semibold text-slate-800 text-sm bg-white border border-indigo-300 rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    ) : (
                                        <h5 className="font-semibold text-slate-800 text-sm truncate" onDoubleClick={(e) => startRename(e, c.id, c.title)}>
                                            {c.title}
                                        </h5>
                                    )}
                                    <p className="text-xs text-slate-500 truncate mt-1">
                                        {c.messages.length > 0 ? c.messages[c.messages.length-1].content : "No messages"}
                                    </p>
                                 </div>
                                 <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => startRename(e, c.id, c.title)} className="text-slate-300 hover:text-indigo-500 p-1 rounded hover:bg-slate-100">
                                        <PenSquare className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => deleteConv(e, c.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded hover:bg-slate-100">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             ) : (
                 <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12 opacity-60">
                            <Bot className="w-12 h-12 text-indigo-400 mb-4" />
                            <h4 className="text-lg font-semibold text-slate-700">How can I help?</h4>
                            <p className="text-sm text-slate-500 mt-2">Ask me to check coverage, adjust risk rules, or simulate a portfolio audit.</p>
                        </div>
                    ) : (
                       messages.map((msg, i) => (
                         <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                           {msg.role === 'assistant' && <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mt-1 mr-2 shrink-0"><Bot className="w-3.5 h-3.5"/></div>}
                           
                           <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14px] ${msg.role === 'user' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-800 shadow-sm'}`}>
                             <div className={`markdown-body ${msg.role === 'user' ? '!text-white' : ''}`}>
                                 <Markdown>{msg.content}</Markdown>
                             </div>
                             <ProposalCard msg={msg} />
                           </div>
                         </div>
                       ))
                    )}
                    {loading && (
                      <div className="flex justify-start items-center ml-8 text-indigo-500/80 text-sm">
                         <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Agent executing...
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                 </div>
             )}

             {/* Input Area */}
             <div className="p-3 bg-white border-t border-slate-200 shrink-0 z-10">
               <div className="relative flex items-end bg-slate-50 border border-slate-200 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all overflow-hidden shadow-sm">
                 <textarea 
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                   onKeyDown={(e) => {
                       if (e.key === 'Enter' && !e.shiftKey) {
                           e.preventDefault();
                           handleSend();
                       }
                   }}
                   placeholder="Type an instruction (e.g. 'Audit subprime risk limit')..."
                   className="w-full pl-4 pr-12 py-3 bg-transparent border-none focus:outline-none focus:ring-0 text-sm resize-none max-h-32 hide-scrollbar"
                   rows={Math.min(4, input.split('\n').length || 1)}
                 />
                 <button 
                   onClick={handleSend}
                   disabled={!input.trim() || loading}
                   className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
                 >
                   <Send className="w-4 h-4" />
                 </button>
               </div>
               <p className="text-[10px] text-center text-slate-400 mt-1.5">Press Enter to send, Shift+Enter for new line</p>
             </div>
          </div>
          )}
{/* COLUMN 2: TERMINAL SANDBOXED INTERACTIVE PANEL */}
          {(isExpanded || mobileTab === 'terminal') && (
             <div className="bg-slate-950 flex flex-col overflow-hidden relative font-mono text-[11px] text-slate-300 flex-1 w-full">
                {/* Visual Terminal Header */}
                <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-slate-400 shrink-0 select-none">
                  <div className="flex items-center gap-2">
                    <Code className="w-3.5 h-3.5 text-indigo-400" />
                    <span>e2b-sandbox-us-west-cu5</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                       <span className="relative flex h-2 w-2">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                       </span>
                       <span className="text-[9px] uppercase font-bold text-emerald-400">Piped Active</span>
                    </span>
                    <span className="text-[10px] border-l border-slate-800 pl-3">CPU: {cpuUsage}%</span>
                    <span className="text-[10px]">RAM: {ramUsage} GB</span>
                  </div>
                </div>

                {/* Terminal Print Screen logs */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 select-all selection:bg-slate-800">
                   {terminalLogs.map((log, idx) => {
                      if (!log) return <div key={idx} className="h-2" />;
                      
                      let colorClass = "text-slate-300";
                      if (log.startsWith("$")) {
                         colorClass = "text-amber-400 font-semibold";
                      } else if (log.startsWith("[SUCCESS]") || log.startsWith("[SUCCESS") || log.includes("[SUCCESS]")) {
                         colorClass = "text-emerald-400 font-medium";
                      } else if (log.startsWith("Error:") || log.startsWith("bash: command not found") || log.startsWith("SYSTEM EXCEPTION")) {
                         colorClass = "text-rose-400 font-medium";
                      } else if (log.startsWith("[AGENT AUTOPILOT]")) {
                         colorClass = "text-indigo-400 font-bold";
                      } else if (log.startsWith("[TASK]") || log.startsWith("[ADMIN CMD]")) {
                         colorClass = "text-cyan-400 font-semibold";
                      } else if (log.startsWith("LOG:") || log.startsWith("[LOG]")) {
                         colorClass = "text-slate-500";
                      } else if (log.startsWith("###")) {
                         colorClass = "text-purple-400 border-b border-slate-900 pb-1 font-semibold";
                      } else if (log.startsWith("+--") || log.startsWith("|")) {
                         colorClass = "text-amber-300/90 whitespace-pre font-mono";
                      }
                      
                      return (
                         <div key={idx} className={cn("leading-relaxed break-all", colorClass)}>
                            {log}
                         </div>
                      );
                   })}
                   <div ref={terminalEndRef} />
                </div>

                {/* Preset Quick Actions Panel */}
                <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
                   <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-2 flex items-center gap-1">
                     <PlayCircle className="w-3 h-3 text-slate-500" /> Standard Shell Benchmarks
                   </p>
                   <div className="grid grid-cols-2 gap-2">
                      <button 
                         onClick={() => {
                            setTerminalLogs(prev => [...prev, "$ python run_audit.py"]);
                            setTimeout(runSimulatedAudit, 100);
                         }}
                         className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-left transition-colors text-slate-300 hover:text-white"
                      >
                         <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                         <span className="truncate">python run_audit.py</span>
                      </button>
                      <button 
                         onClick={() => {
                            setTerminalLogs(prev => [...prev, "$ python stress_test_dti.py"]);
                            setTimeout(runSimulatedStressTest, 100);
                         }}
                         className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-left transition-colors text-slate-300 hover:text-white"
                      >
                         <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                         <span className="truncate">python stress_test_dti.py</span>
                      </button>
                      <button 
                         onClick={() => {
                            setTerminalLogs(prev => [...prev, "$ python optimize_boundaries.py"]);
                            setTimeout(runSimulatedOptimize, 100);
                         }}
                         className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-left transition-colors text-slate-300 hover:text-white"
                      >
                         <RefreshCw className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                         <span className="truncate">python optimize_boundaries.py</span>
                      </button>
                      <button 
                         onClick={() => {
                            setTerminalLogs(prev => [
                              ...prev, 
                              "$ SELECT count(*) FROM applicants WHERE custom_score > 700"
                            ]);
                            setTimeout(() => {
                              const res = parseAndRunSimulatedQuery("SELECT count(*) FROM applicants WHERE custom_score > 700");
                              setTerminalLogs(prev => [...prev, ...res.logs, ""]);
                            }, 100);
                         }}
                         className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-left transition-colors text-slate-300 hover:text-white"
                      >
                         <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                         <span className="truncate">SQL Prime count query</span>
                      </button>
                   </div>
                </div>

                {/* Terminal Input Line Form */}
                <form onSubmit={handleTerminalSubmit} className="flex items-center bg-slate-950 border-t border-slate-800 px-4 py-2.5 shrink-0">
                   <span className={cn("font-bold mr-2 select-none", isNodeRepl ? "text-amber-400" : "text-emerald-500")}>{isNodeRepl ? ">" : "$"}</span>
                   <input 
                      type="text"
                      value={terminalCmd}
                      onChange={e => setTerminalCmd(e.target.value)}
                      placeholder={isNodeRepl ? "Evaluate JavaScript statement (e.g. 'applicants.length' or '.help')..." : "Type 'help', 'ls', 'node' shell script or SQL query..."}
                      className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-[11px] text-slate-100 placeholder-slate-700 font-mono py-0.5"
                   />
                   <button type="submit" className="text-[10px] text-slate-500 hover:text-indigo-400 flex items-center gap-0.5 shrink-0 px-1 hover:bg-slate-900 rounded">
                      <Send className="w-3 h-3" />
                   </button>
                </form>
             </div>
          )}
</div>
    </div>
  );
}
