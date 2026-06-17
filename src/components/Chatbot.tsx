import React, { useState, useRef, useEffect } from 'react';
import {
  X, Send, Bot, MessageSquare, Plus, CheckCircle2, ChevronLeft, Loader2,
  List, Settings, RotateCcw, PenSquare, Trash2, CheckCircle, Square,
  ShieldCheck, AlertTriangle, TrendingUp, Target, Zap, RefreshCw
} from 'lucide-react';
import Markdown from 'react-markdown';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ConversationStore, Conversation, Message } from '../lib/conversationStore';
import { cn } from '../lib/utils';

export function Chatbot({
  onClose,
  isExpanded = false,
  onToggleExpand,
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
  const [trustMode, setTrustMode] = useState(
    () => sessionStorage.getItem('cu_trust_mode') === 'true'
  );
  const [isDrilling, setIsDrilling] = useState(false);
  const drillAbortRef = useRef<AbortController | null>(null);

  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionStorage.setItem('cu_trust_mode', String(trustMode));
  }, [trustMode]);

  const loadData = () => {
    let all = ConversationStore.getAll();
    if (all.length === 0) all = [ConversationStore.create()];
    setConversations(all);
    if (!activeConvId || !all.find(c => c.id === activeConvId)) {
      setActiveConvId(all[0].id);
    }
  };

  useEffect(() => {
    loadData();
    const handleStartWhatIf = () => {
      const fresh = ConversationStore.create();
      fresh.title = 'Policy Optimization';
      ConversationStore.appendMessage(fresh.id, {
        role: 'assistant',
        content:
          "I'm ready to help optimize your policy. Describe your goal in plain language — for example: *\"Increase approval rate for the 620–660 credit score band without pushing default risk above 3%\"* — and I'll run an automated analysis across multiple configurations and surface the best options.",
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, activeConvId]);

  const handleNewChat = () => {
    const fresh = ConversationStore.create();
    setActiveConvId(fresh.id);
    setShowList(false);
    loadData();
  };

  // ── Analytical intent detection ─────────────────────────────────────────────
  const isAnalyticalQuery = (msg: string) =>
    /\b(optimize|find\s+best|increase|decrease|improve|reduce|maximize|minimize|what[\s-]?if|sweep|explore|best\s+config|threshold|approval\s+rate|default\s+risk|which\s+rule|how\s+much|how\s+can|suggest|analyze|analysis|simulate|simulation|run\s+an?\s+(analysis|sim)|search|discover)\b/i.test(
      msg
    );

  // ── Drill loop runner ────────────────────────────────────────────────────────
  const runDrillLoop = async (goal: string, drillMsgId: string) => {
    setIsDrilling(true);
    const ctrl = new AbortController();
    drillAbortRef.current = ctrl;

    try {
      const response = await fetch('/api/drill-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, constraintManifest: {} }),
        signal: ctrl.signal,
      });

      if (!response.ok) throw new Error(`Drill failed: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'iteration') {
              ConversationStore.updateMessage(activeConvId!, drillMsgId, {
                proposal: {
                  type: 'drill-running',
                  iteration: data.iteration,
                  maxIterations: data.maxIterations,
                  lastTag: data.tag,
                  lastRisk: data.riskLevel,
                },
              });
              loadData();
            }

            if (data.type === 'complete') {
              ConversationStore.updateMessage(activeConvId!, drillMsgId, {
                content: '',
                proposal: {
                  type: 'drill-result',
                  results: data.results,
                  baselineMetrics: data.baselineMetrics,
                  iterationsRun: data.iterationsRun,
                  headline: data.headline,
                },
              });
              loadData();
            }

            if (data.type === 'error') {
              ConversationStore.updateMessage(activeConvId!, drillMsgId, {
                content: data.message || 'Analysis failed.',
                isError: true,
                proposal: undefined,
              });
              loadData();
            }
          } catch (_) {}
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        ConversationStore.updateMessage(activeConvId!, drillMsgId, {
          content: 'Analysis failed: ' + (e.message || 'Unknown error'),
          isError: true,
          proposal: undefined,
        });
        loadData();
      }
    } finally {
      setIsDrilling(false);
      drillAbortRef.current = null;
    }
  };

  // ── handleSend ───────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || loading || !activeConvId) return;
    const userMsg = input.trim();
    setInput('');

    ConversationStore.appendMessage(activeConvId, { role: 'user', content: userMsg });
    loadData();
    setLoading(true);

    try {
      if (isAnalyticalQuery(userMsg)) {
        // ── Drill loop path ──────────────────────────────────────────────────
        const drillMsgId = 'drill_' + Date.now();
        ConversationStore.appendMessage(activeConvId, {
          id: drillMsgId,
          role: 'assistant',
          content: '',
          proposal: { type: 'drill-running', iteration: 0, maxIterations: 8, lastTag: '', lastRisk: '' },
        });
        loadData();
        await runDrillLoop(userMsg, drillMsgId);
      } else {
        // ── Standard chat path ───────────────────────────────────────────────
        const historyToSend = (activeConv?.messages || []).filter(m => m.role !== 'system');
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMsg, history: historyToSend }),
        });

        if (!response.ok) throw new Error(`Server Error: ${response.status}`);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        const tempMsgId = 'msg_' + Date.now();
        ConversationStore.appendMessage(activeConvId, { id: tempMsgId, role: 'assistant', content: '' });
        loadData();

        let reply = '';
        while (reader && !done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (!value) continue;
          const chunkStr = decoder.decode(value, { stream: true });
          for (const line of chunkStr.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') { done = true; break; }
            try {
              const obj = JSON.parse(dataStr);
              if (obj.error) {
                ConversationStore.updateMessage(activeConvId, tempMsgId, { content: obj.error, isError: true });
                loadData();
                done = true;
                break;
              }
              if (obj.model) {
                ConversationStore.updateMessage(activeConvId, tempMsgId, { model: obj.model });
              }
              if (obj.text) {
                reply += obj.text;
                ConversationStore.updateMessage(activeConvId, tempMsgId, { content: reply });
                loadData();
              }
            } catch (_) {}
          }
        }
      }
    } catch (err: any) {
      ConversationStore.appendMessage(activeConvId, {
        id: 'err_' + Date.now(),
        role: 'assistant',
        content: err.message || 'An unexpected error occurred.',
        isError: true,
      });
      loadData();
    }

    setLoading(false);
  };

  // ── Conversation management ──────────────────────────────────────────────────
  const startRename = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setEditingConvId(id);
    setEditTitle(title);
  };
  const commitRename = (id: string) => {
    if (editTitle.trim()) ConversationStore.rename(id, editTitle.trim());
    setEditingConvId(null);
    loadData();
  };
  const deleteConv = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) { ConversationStore.delete(id); loadData(); }
  };

  // ── Drill Animation ──────────────────────────────────────────────────────────
  const DrillAnimation = ({ proposal }: { proposal: any }) => {
    const { iteration = 0, maxIterations = 8, lastTag = '', lastRisk = '' } = proposal;
    const pct = maxIterations > 0 ? Math.round((iteration / maxIterations) * 100) : 0;
    const filled = Math.round(pct / 10);
    const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
    const riskColor = lastRisk === 'LOW' ? 'text-emerald-400' : lastRisk === 'HIGH' ? 'text-rose-400' : 'text-amber-400';

    return (
      <div className="mt-2 bg-slate-900 border border-slate-700 rounded-xl p-3 font-mono text-xs">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
          <span className="text-indigo-300 font-semibold">
            Drilling… iteration {iteration} of {maxIterations} against applicants_10k
          </span>
        </div>
        <div className="text-indigo-400 mb-1.5">[{bar}] {pct}%</div>
        {lastTag && (
          <p className="text-slate-400">
            testing <span className={`font-bold ${riskColor}`}>{lastTag}</span> configuration
          </p>
        )}
        <button
          onClick={() => { drillAbortRef.current?.abort(); setIsDrilling(false); }}
          className="mt-2 flex items-center gap-1 text-slate-500 hover:text-rose-400 transition-colors text-[10px]"
        >
          <Square className="w-2.5 h-2.5" /> Stop analysis
        </button>
      </div>
    );
  };

  // ── Format param name helper ────────────────────────────────────────────────
  const fmtParam = (key: string, val: any): string => {
    if (key === 'dtiMax' || key === 'ltvMax') return `${(val * 100).toFixed(0)}%`;
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  };
  const fmtParamLabel = (key: string) => ({
    creditScoreMin: 'Min Credit Score',
    dtiMax: 'Max DTI',
    ltvMax: 'Max LTV',
    maxInquiries: 'Max Inquiries',
    maxVehicleAge: 'Max Vehicle Age',
    maxDpd30: 'Max 30-DPD',
    allowChargeOffs: 'Allow Charge-Offs',
  }[key] || key);

  // ── Drill Results ────────────────────────────────────────────────────────────
  const DrillResults = ({ proposal, msgId }: { proposal: any; msgId: string }) => {
    const { results, baselineMetrics, iterationsRun, headline } = proposal;
    if (!results || results.length === 0) return null;

    const styleMap: Record<string, { bg: string; border: string; badge: string; accent: string }> = {
      Conservative: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', accent: 'text-emerald-700' },
      Balanced:     { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-800',   accent: 'text-amber-700'   },
      Aggressive:   { bg: 'bg-rose-50',    border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-800',     accent: 'text-rose-700'    },
    };

    // Bar chart data
    const barData = [
      { name: 'Baseline', approvals: baselineMetrics.approvals, reviews: baselineMetrics.reviews, denials: baselineMetrics.denials },
      ...results.map((r: any) => ({
        name: r.label,
        approvals: r.metrics.approvals,
        reviews: r.metrics.reviews,
        denials: r.metrics.denials,
      })),
    ];

    // Primary swapset migrations (from balanced/middle config)
    const primaryResult = results[1] || results[0];
    const migrations = (primaryResult?.swapset?.migrations || [])
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 6);

    return (
      <div className="mt-3 space-y-3">
        {/* Headline */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide">
              Analysis Complete — {iterationsRun} simulations run · applicants_10k
            </span>
          </div>
          <p className="text-sm text-indigo-800 leading-relaxed">{headline}</p>
        </div>

        {/* 3 Config Cards */}
        {results.map((r: any) => {
          const s = styleMap[r.label] || styleMap.Balanced;
          const lift = (r.metrics.approvalRate - baselineMetrics.approvalRate).toFixed(1);
          const defDelta = (r.metrics.estimatedDefaultRate - baselineMetrics.estimatedDefaultRate).toFixed(1);
          const isPositiveLift = parseFloat(lift) >= 0;

          return (
            <div key={r.label} className={`rounded-xl border ${s.border} ${s.bg} p-3 space-y-2`}>
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.badge}`}>{r.label}</span>
                  <span className="font-semibold text-slate-800 text-sm">{r.metrics.approvalRate}% approval</span>
                </div>
                <span className={`text-xs font-bold ${isPositiveLift ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isPositiveLift ? '+' : ''}{lift}% vs baseline
                </span>
              </div>

              {/* Param changes */}
              {Object.keys(r.paramDiff || {}).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(r.paramDiff).map(([key, v]: any) => (
                    <span key={key} className="text-[10px] bg-white/80 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-slate-600">
                      {fmtParamLabel(key)}: {fmtParam(key, v.before)} → <strong>{fmtParam(key, v.after)}</strong>
                    </span>
                  ))}
                </div>
              )}

              {/* Metrics row */}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>
                  Default risk:{' '}
                  <span className={parseFloat(defDelta) > 0.5 ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                    {r.metrics.estimatedDefaultRate}%
                  </span>{' '}
                  <span className="text-slate-400">({parseFloat(defDelta) >= 0 ? '+' : ''}{defDelta}%)</span>
                </span>
                <span className="text-slate-300">|</span>
                <span>
                  Denials: <span className="font-medium text-slate-700">{r.metrics.denialRate}%</span>
                </span>
              </div>

              {/* Constraint violations */}
              {r.constraintViolations?.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {r.constraintViolations.join(' · ')}
                </div>
              )}

              {/* Apply button */}
              <button
                onClick={() => {
                  const paramMsg = Object.entries(r.paramDiff || {}).map(([k, v]: any) =>
                    `${fmtParamLabel(k)}: ${fmtParam(k, v.before)} → ${fmtParam(k, v.after)}`
                  ).join(', ');
                  alert(`✓ ${r.label} configuration noted.\n\nChanges: ${paramMsg}\n\nTo apply: open the policy gate in the canvas and adjust these thresholds, then run a full swapset comparison.`);
                }}
                className="w-full py-1.5 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 font-medium text-xs rounded-lg transition-colors"
              >
                Apply {r.label} to Draft →
              </button>
            </div>
          );
        })}

        {/* Decision distribution chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
            Decision Distribution — Baseline vs Configurations
          </h4>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={barData} barGap={2} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(val: any, name: string) => [
                  val.toLocaleString(),
                  name === 'approvals' ? 'Approved' : name === 'reviews' ? 'Review' : 'Denied',
                ]}
              />
              <Bar dataKey="approvals" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="reviews" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              <Bar dataKey="denials" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Swapset migrations */}
        {migrations.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Decision Migrations — {primaryResult?.label || 'Balanced'} Config
            </h4>
            <div className="space-y-1">
              {migrations.map((m: any, idx: number) => {
                const isGain = m.to === 'APPROVE';
                return (
                  <div key={idx} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${isGain ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                    <span className={`font-bold tabular-nums ${isGain ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {m.count.toLocaleString()}
                    </span>
                    <span className="text-slate-400">records</span>
                    <span className="text-slate-600 font-medium">{m.from}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-600 font-medium">{m.to}</span>
                    <span className={`ml-auto text-[10px] font-bold ${isGain ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isGain ? '↑ Approval gain' : '↓ Decision shift'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Manifest confirmed */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-start gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-600">Manifest Respected ✓</span>
            <span className="ml-1">Bankruptcy lookback: NOT TOUCHED · Score floor ≥ 600: MAINTAINED · Fraud rules: UNCHANGED</span>
          </div>
        </div>

        {/* Confidence note */}
        <p className="text-[10px] text-slate-400 italic px-1">
          Ran against 10,000 synthetic applicants. Results are directional — validate against your full portfolio before implementation.
        </p>
      </div>
    );
  };

  // ── Reason-code breakdown chip (for existing proposal cards) ─────────────────
  const ReasonBadge = ({ reason }: { reason: string }) => (
    <span className="inline-block text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-mono">
      {reason.replace(/_/g, ' ')}
    </span>
  );

  // ── Proposal Card ────────────────────────────────────────────────────────────
  const ProposalCard = ({ msg }: { msg: Message }) => {
    if (!msg.proposal) return null;
    const p = msg.proposal as any;

    if (p.type === 'drill-running') {
      return <DrillAnimation proposal={p} />;
    }

    if (p.type === 'drill-result') {
      return <DrillResults proposal={p} msgId={msg.id} />;
    }

    if (p.type === 'whatif-result') {
      const isPending = p.status === 'PENDING';
      return (
        <div className="mt-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-indigo-800">
              <TrendingUp className="w-3.5 h-3.5" /> What-If Result
            </span>
            {p.status === 'APPLIED' && (
              <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Applied
              </span>
            )}
          </div>
          <div className="p-4 space-y-3">
            {p.summary && <p className="text-sm text-slate-700">{p.summary}</p>}
            {p.changes?.map((c: any, idx: number) => (
              <div key={idx} className="bg-slate-50 p-2.5 rounded border border-slate-100 text-xs">
                <p className="font-semibold text-slate-700">{c.gate} — {c.segment}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-500">{c.field}:</span>
                  <span className="line-through text-rose-500">{c.before}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-bold text-emerald-600">{c.after}</span>
                </div>
              </div>
            ))}
            {isPending && p.draftPolicy && (
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => {
                    localStorage.setItem('cu_base_policy', JSON.stringify(p.draftPolicy));
                    localStorage.removeItem('cu_draft_policy');
                    window.dispatchEvent(new Event('policyUpdated'));
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg text-sm transition-colors"
                >
                  Commit to Policy
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('cu_draft_policy', JSON.stringify(p.draftPolicy));
                    window.dispatchEvent(new Event('policyUpdated'));
                  }}
                  className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium py-2 rounded-lg text-sm transition-colors"
                >
                  Preview Draft in Canvas
                </button>
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
        <div className={cn('px-4 py-2.5 border-b border-slate-100 flex items-center justify-between', isBlocked ? 'bg-rose-50' : 'bg-indigo-50/50')}>
          <span className={cn('text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5', isBlocked ? 'text-rose-800' : 'text-indigo-800')}>
            <PenSquare className="w-3.5 h-3.5" /> Policy Proposal
          </span>
          {p.status === 'APPLIED' && <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Applied</span>}
          {p.status === 'CANCELLED' && <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Cancelled</span>}
          {isBlocked && <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full flex items-center"><X className="w-3 h-3 mr-1" /> Blocked</span>}
        </div>
        <div className="p-4 space-y-3">
          {isBlocked && p.hardViolations?.length > 0 && (
            <div className="bg-rose-50 p-3 rounded border border-rose-200 text-rose-800 text-sm">
              <strong>HARD VIOLATION:</strong>
              <ul className="list-disc pl-4 mt-1">{p.hardViolations.map((v: string) => <li key={v}>{v}</li>)}</ul>
            </div>
          )}
          {p.analysis && <p className="text-sm text-slate-700 leading-relaxed">{p.analysis}</p>}
          {p.diff && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <p className="font-mono text-sm text-slate-800 font-semibold">{p.diff}</p>
            </div>
          )}
          {p.impact && <p className="text-sm text-slate-600">{p.impact}</p>}
          {isPending && (
            <div className="pt-1 flex gap-2">
              <button
                onClick={() => {
                  ConversationStore.updateMessage(activeConvId!, msg.id, { proposal: { ...p, status: 'APPLIED' } });
                  loadData();
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                Apply Change
              </button>
              <button
                onClick={() => {
                  ConversationStore.updateMessage(activeConvId!, msg.id, { proposal: { ...p, status: 'CANCELLED' } });
                  loadData();
                }}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium py-2 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Quick-start prompts shown on empty chat ──────────────────────────────────
  const QUICK_PROMPTS = [
    { icon: <Target className="w-4 h-4" />, label: 'Optimize approval rate for 620–660 band without exceeding 3% default risk', tag: 'goal' },
    { icon: <TrendingUp className="w-4 h-4" />, label: 'Which rules contribute most to my current denial rate?', tag: 'explore' },
    { icon: <Zap className="w-4 h-4" />, label: 'Sweep DTI from 43% to 50% — show approval and risk tradeoffs at each step', tag: 'sweep' },
    { icon: <RefreshCw className="w-4 h-4" />, label: 'What happens if I lower the minimum credit score from 620 to 600?', tag: 'whatif' },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col bg-white font-sans animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="h-14 bg-indigo-700 px-4 flex items-center justify-between shrink-0 shadow-md z-10">
        <div className="flex items-center text-white">
          <button
            onClick={() => setShowList(!showList)}
            className="p-1.5 hover:bg-indigo-600 rounded-md transition-colors mr-2"
            title="Conversations"
          >
            {showList ? <ChevronLeft className="w-5 h-5" /> : <List className="w-5 h-5" />}
          </button>
          <Bot className="w-5 h-5 mr-2 opacity-80" />
          <div>
            <h3 className="font-semibold text-sm leading-tight">Policy Intelligence Assistant</h3>
            <p className="text-[10px] text-indigo-300 leading-tight">Corridor · AI-augmented underwriting</p>
          </div>
          {trustMode && (
            <span className="ml-3 text-[10px] font-bold bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Trusted
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isDrilling && (
            <button
              onClick={() => { drillAbortRef.current?.abort(); setIsDrilling(false); }}
              className="flex items-center gap-1 text-white text-[11px] bg-rose-600 hover:bg-rose-500 px-2 py-1 rounded-md transition-colors mr-1"
              title="Stop analysis"
            >
              <Square className="w-3 h-3" /> Stop
            </button>
          )}
          <button onClick={handleNewChat} className="text-white hover:bg-indigo-600 p-1.5 rounded-md transition-colors" title="New Chat">
            <Plus className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="text-white hover:bg-indigo-600 p-1.5 rounded-md transition-colors" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Trust toggle */}
      <div className="bg-amber-50 border-b border-amber-100 flex items-center justify-between px-4 py-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs font-medium text-amber-800">Trust Session Auto-Approve</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={trustMode}
            onChange={e => setTrustMode(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500" />
        </label>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden relative">
        {/* Conversation list overlay */}
        {showList && (
          <div className="absolute inset-0 bg-white z-20 overflow-y-auto animate-in slide-in-from-left-4">
            <div className="p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">History</h4>
              {conversations.map(c => (
                <div
                  key={c.id}
                  onClick={() => { setActiveConvId(c.id); setShowList(false); }}
                  className={cn(
                    'p-3 rounded-xl cursor-pointer border transition-all flex items-start justify-between group',
                    c.id === activeConvId
                      ? 'bg-indigo-50 border-indigo-100'
                      : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm hover:shadow'
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
                        className="w-full font-semibold text-slate-800 text-sm bg-white border border-indigo-300 rounded px-1.5 py-0.5 outline-none"
                      />
                    ) : (
                      <h5
                        className="font-semibold text-slate-800 text-sm truncate"
                        onDoubleClick={e => startRename(e, c.id, c.title)}
                      >
                        {c.title}
                      </h5>
                    )}
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {c.messages.length > 0 ? c.messages[c.messages.length - 1].content.slice(0, 60) : 'No messages'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => startRename(e, c.id, c.title)} className="text-slate-300 hover:text-indigo-500 p-1 rounded hover:bg-slate-100">
                      <PenSquare className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={e => deleteConv(e, c.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded hover:bg-slate-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {messages.length === 0 ? (
            <div className="space-y-5 pt-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-6 h-6 text-indigo-600" />
                </div>
                <h4 className="text-base font-semibold text-slate-700">Policy Intelligence Assistant</h4>
                <p className="text-sm text-slate-500 mt-1 max-w-[280px] mx-auto leading-relaxed">
                  Describe your goal and I'll run automated simulations to find the best policy configuration.
                </p>
              </div>
              <div className="space-y-2">
                {QUICK_PROMPTS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(q.label)}
                    className="w-full text-left px-3 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-xl text-sm text-slate-700 hover:text-indigo-700 transition-all flex items-start gap-2.5 shadow-sm"
                  >
                    <span className="text-indigo-400 shrink-0 mt-0.5">{q.icon}</span>
                    <span className="leading-snug">{q.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && !msg.isError && (
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mt-1 mr-2 shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                {msg.isError && (
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mt-1 mr-2 shrink-0 text-xs font-bold">!</div>
                )}

                {msg.isError ? (
                  <div className="max-w-[90%] rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800 shadow-sm">
                    <p className="font-semibold text-rose-700 mb-0.5 text-xs uppercase tracking-wider">Error</p>
                    <p>{msg.content}</p>
                    <p className="text-[11px] text-rose-400 mt-1.5">Please try again. If this is a rate limit, wait a moment.</p>
                  </div>
                ) : (
                  <div className="max-w-[90%] flex flex-col gap-1">
                    <div
                      className={`rounded-2xl px-4 py-3 text-[14px] ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                      }`}
                    >
                      {msg.content && (
                        <div className={`markdown-body ${msg.role === 'user' ? '!text-white' : ''}`}>
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      )}
                      <ProposalCard msg={msg} />
                    </div>
                    {msg.role === 'assistant' && msg.model && (
                      <div className="flex items-center gap-1 pl-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] text-slate-400 font-mono leading-none">
                          <svg className="w-2.5 h-2.5 text-emerald-400" fill="currentColor" viewBox="0 0 8 8">
                            <circle cx="4" cy="4" r="3" />
                          </svg>
                          {msg.model.split('/').pop()?.replace(':free', '')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {loading && !isDrilling && (
            <div className="flex justify-start items-center ml-8 text-indigo-500/80 text-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Thinking…
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-3 bg-white border-t border-slate-200 shrink-0 z-10">
          <div className="relative flex items-end bg-slate-50 border border-slate-200 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all overflow-hidden shadow-sm">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your goal or ask a question… (analytical queries auto-trigger simulation)"
              className="w-full pl-4 pr-12 py-3 bg-transparent border-none focus:outline-none focus:ring-0 text-sm resize-none max-h-36 hide-scrollbar"
              rows={Math.min(4, (input.match(/\n/g) || []).length + 1 || 1)}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-1.5">
            Enter to send · Shift+Enter for new line · Analytical questions trigger automated simulation
          </p>
        </div>
      </div>
    </div>
  );
}
