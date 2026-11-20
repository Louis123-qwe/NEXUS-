import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Send, Trash2, Volume2, X } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ChatMessage } from '../../types/nexus';
import { computeDashboardMetrics, formatCurrency } from '../../utils/calculations';
import { generateId } from '../../utils/validation';

export function AiCopilotDrawer() {
  const {
    copilotOpen,
    setCopilotOpen,
    transactions,
    projects,
    customers,
    tasks,
    dateFilter,
    currency,
    pushToast,
  } = useWorkspace();

  const [rolePreset, setRolePreset] = useState<'operations' | 'finance' | 'project' | 'fast'>(
    'operations'
  );
  const [modelTier, setModelTier] = useState<'balanced' | 'deep' | 'complex' | 'fast'>('balanced');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{
    base64: string;
    mimeType: string;
    preview: string;
  } | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_msg',
      role: 'model',
      text: 'NEXUS Operations Copilot ready. Ask about profit margins, overdue projects, CRM pipeline bottlenecks, or attach an invoice/document photo for instant analysis.',
      modelUsed: 'gemini-4-hydrogen',
      timestamp: new Date().toISOString(),
    },
  ]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (!copilotOpen) return null;

  const buildLiveSummary = () => {
    const m = computeDashboardMetrics(transactions, projects, customers, tasks, dateFilter);
    const overdue = projects
      .filter((p) => p.status !== 'completed' && p.deadline < '2026-11-20')
      .map((p) => `${p.title} (due ${p.deadline}, ${p.progress}%)`)
      .join('; ');
    return `Revenue: ${formatCurrency(m.totalRevenue, currency)}, Expenses: ${formatCurrency(m.totalExpenses, currency)}, Net Profit: ${formatCurrency(m.netProfit, currency)} (${m.profitMarginPct.toFixed(1)}% margin). Active Projects: ${m.activeProjectsCount}, Overdue: ${overdue || 'None'}. Customers: ${m.totalCustomers} total (${m.activeCustomersCount} active, ${m.conversionRatePct.toFixed(1)}% conversion). Open Tasks: ${m.openTasksCount}.`;
  };

  const handleAttachImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      pushToast({ title: 'Unsupported image format', description: 'Use PNG, JPEG, or WebP.', variant: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const preview = String(reader.result);
      setAttachedImage({
        base64: preview.split(',')[1],
        mimeType: file.type,
        preview,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const promptText = input.trim() || (attachedImage ? 'Analyze this uploaded business document or image.' : '');
    if (!promptText || sending) return;

    const userMsg: ChatMessage = {
      id: generateId('msg'),
      role: 'user',
      text: promptText,
      imagePreview: attachedImage?.preview,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    const currentImage = attachedImage;
    setAttachedImage(null);
    setSending(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
          rolePreset,
          modelTier,
          workspaceSummary: buildLiveSummary(),
          image: currentImage
            ? { base64: currentImage.base64, mimeType: currentImage.mimeType }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gemini request failed.');

      setMessages((prev) => [
        ...prev,
        {
          id: generateId('msg'),
          role: 'model',
          text: data.text,
          modelUsed: data.modelUsed,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unable to reach Gemini backend.';
      setMessages((prev) => [
        ...prev,
        {
          id: generateId('err'),
          role: 'model',
          text: `Error: ${errMsg}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleReadAloud = async (msg: ChatMessage) => {
    if (playingId === msg.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }

    try {
      setPlayingId(msg.id);
      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: msg.text,
          voiceName: 'Kore',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'TTS failed');
      const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      await audio.play();
    } catch (err) {
      setPlayingId(null);
      pushToast({
        title: 'Audio playback error',
        description: err instanceof Error ? err.message : 'TTS request failed.',
        variant: 'error',
      });
    }
  };

  return (
    <aside
      aria-label="NEXUS Operations Copilot"
      className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-white dark:bg-[#10131C] border-l border-slate-200 dark:border-[#232838] shadow-2xl flex flex-col no-print"
    >
      {/* Header */}
      <div className="h-16 px-4 border-b border-slate-200 dark:border-[#232838] flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            NEXUS Operations Copilot
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Multi-turn assistant · Vision & Voice enabled
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setMessages([
                {
                  id: 'welcome_reset',
                  role: 'model',
                  text: 'Conversation cleared. Ready for your next operational query.',
                  timestamp: new Date().toISOString(),
                },
              ])
            }
            aria-label="Clear conversation"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCopilotOpen(false)}
            aria-label="Close Copilot"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Role & Model Routing Controls */}
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-[#232838] grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-[#0B0D12]">
        <div>
          <label className="block text-[10px] text-slate-500 mb-1">Persona Role</label>
          <select
            value={rolePreset}
            onChange={(e) =>
              setRolePreset(e.target.value as 'operations' | 'finance' | 'project' | 'fast')
            }
            className="w-full px-2 py-1.5 rounded-md bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]"
          >
            <option value="operations">Operations Analyst</option>
            <option value="finance">Financial Auditor</option>
            <option value="project">Delivery Strategist</option>
            <option value="fast">Quick Assistant</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-1">Model Depth</label>
          <select
            value={modelTier}
            onChange={(e) =>
              setModelTier(e.target.value as 'balanced' | 'deep' | 'complex' | 'fast')
            }
            className="w-full px-2 py-1.5 rounded-md bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]"
          >
            <option value="balanced">Standard (gemini-4-hydrogen)</option>
            <option value="deep">Deep Reasoning (High Think)</option>
            <option value="complex">Complex / Multimodal</option>
            <option value="fast">Fast (gemini-3.1-flash-lite)</option>
          </select>
        </div>
      </div>

      {/* Scrollable Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 dark:bg-[#131620] border border-slate-200 dark:border-[#232838] text-slate-800 dark:text-slate-200'
              }`}
            >
              {m.imagePreview && (
                <img
                  src={m.imagePreview}
                  alt="Attached document"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-40 object-contain rounded-lg mb-2 bg-black/10"
                />
              )}
              {m.text}
            </div>
            {m.role === 'model' && (
              <div className="flex items-center gap-3 mt-1 px-1 text-[11px] text-slate-400">
                {m.modelUsed && <span className="font-mono">{m.modelUsed}</span>}
                <button
                  type="button"
                  onClick={() => handleReadAloud(m)}
                  className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  <Volume2 className="w-3 h-3" />
                  {playingId === m.id ? 'Stop' : 'Speak'}
                </button>
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="text-xs text-slate-400 animate-pulse px-1">
            Synthesizing operational response...
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t border-slate-200 dark:border-[#232838] space-y-2 bg-white dark:bg-[#10131C]"
      >
        {attachedImage && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#131620] text-xs">
            <span className="truncate text-slate-600 dark:text-slate-300">
              Image attached for analysis
            </span>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="text-slate-400 hover:text-rose-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label
            title="Attach image for analysis"
            className="p-2 rounded-lg border border-slate-200 dark:border-[#232838] text-slate-500 hover:text-violet-500 cursor-pointer shrink-0"
          >
            <ImagePlus className="w-4 h-4" />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAttachImage}
              className="sr-only"
            />
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask NEXUS Copilot..."
            className="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838] focus:outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={sending || (!input.trim() && !attachedImage)}
            aria-label="Send message"
            className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </aside>
  );
}
