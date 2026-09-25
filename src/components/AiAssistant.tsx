import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  Clock3,
  Copy,
  ExternalLink,
  Plus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";

export type AssistantTable = {
  headers: string[];
  rows: string[][];
};

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  table?: AssistantTable | null;
  cta?: { label: string; href: string } | null;
  provider?: string;
};

type ChatResponse = {
  reply?: string;
  table?: AssistantTable | null;
  cta?: { label: string; href: string } | null;
  provider?: string;
  error?: string;
};

const SUGGESTIONS = [
  "How does this quarter compare to last?",
  "What's my gross profit margin?",
  "What are my biggest income sources?",
];

type Props = {
  open: boolean;
  onClose: () => void;
  contextLabel?: string;
  /** When true, mimics a skills-ported shell with a missing BFF (LIQ-24 demo defect). */
  broken?: boolean;
  userName?: string;
};

function newId() {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function safeCtaHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const trimmed = href.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

function normalizeTable(table: unknown): AssistantTable | null {
  if (!table || typeof table !== "object") return null;
  const candidate = table as { headers?: unknown; rows?: unknown };
  if (!Array.isArray(candidate.headers) || !Array.isArray(candidate.rows)) return null;
  return {
    headers: candidate.headers.map((h) => String(h)),
    rows: candidate.rows.map((row) => (Array.isArray(row) ? row.map((c) => String(c)) : [])),
  };
}

export function AiAssistant({
  open,
  onClose,
  contextLabel = "Dashboard",
  broken = false,
  userName = "Jordan",
}: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState(contextLabel);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContext(contextLabel);
  }, [contextLabel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    queueMicrotask(() => inputRef.current?.focus());
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, error]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setError(null);
      setDraft("");
      const userMsg: AssistantMessage = { id: newId(), role: "user", text: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setBusy(true);

      if (broken) {
        await new Promise((r) => setTimeout(r, 450));
        setBusy(false);
        setError(
          "Assistant service unavailable in Reporting. The AI rail was ported from Core, but /api/v1/assistant/chat was never wired on this BFF.",
        );
        return;
      }

      try {
        const res = await fetch("/api/v1/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            context,
            history: messages.slice(-6).map((m) => ({ role: m.role, content: m.text })),
          }),
        });
        const data = (await res.json()) as ChatResponse;
        if (!res.ok) {
          throw new Error(data.error ?? `assistant_http_${res.status}`);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            text: data.reply ?? "I could not generate a reply.",
            table: normalizeTable(data.table),
            cta: data.cta
              ? (() => {
                  const href = safeCtaHref(data.cta?.href);
                  if (!href || !data.cta?.label) return null;
                  return { label: String(data.cta.label), href };
                })()
              : null,
            provider: data.provider,
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "assistant_failed");
      } finally {
        setBusy(false);
      }
    },
    [busy, broken, context, messages],
  );

  if (!open) return null;

  const empty = messages.length === 0;

  return (
    <aside
      className="ai-assistant"
      role="complementary"
      aria-labelledby={titleId}
      data-broken={broken ? "true" : "false"}
    >
      <header className="ai-assistant-header">
        <div className="ai-assistant-title">
          <Sparkles size={18} aria-hidden="true" />
          <h2 id={titleId}>AI Assistant</h2>
          <span className="ai-assistant-beta">Beta</span>
        </div>
        <div className="ai-assistant-header-actions">
          <button type="button" className="ai-icon-btn" aria-label="History" disabled>
            <Clock3 size={16} />
          </button>
          <button
            type="button"
            className="ai-icon-btn"
            aria-label="New chat"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
          >
            <Plus size={16} />
          </button>
          <button type="button" className="ai-icon-btn" aria-label="Pop out" disabled>
            <ExternalLink size={16} />
          </button>
          <button type="button" className="ai-icon-btn" aria-label="Close assistant" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="ai-assistant-body" ref={scrollerRef}>
        {empty ? (
          <div className="ai-assistant-welcome">
            <Sparkles size={36} aria-hidden="true" />
            <h3>Hello {userName}!</h3>
            <p>How can I help you today?</p>
            <div className="ai-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => void send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="ai-message-list">
            {messages.map((message) => (
              <li key={message.id} className={`ai-message ai-message-${message.role}`}>
                {message.role === "user" ? (
                  <div className="ai-bubble-user">{message.text}</div>
                ) : (
                  <div className="ai-bubble-assistant">
                    <p>{message.text}</p>
                    {message.table ? (
                      <div className="ai-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              {message.table.headers.map((header, headerIndex) => (
                                <th key={`${message.id}-h-${headerIndex}`} scope="col">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {message.table.rows.map((row, index) => (
                              <tr key={`${message.id}-row-${index}`}>
                                {row.map((cell, cellIndex) => (
                                  <td key={`${message.id}-${index}-${cellIndex}`}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                    {message.cta ? (
                      <a className="ai-cta" href={message.cta.href}>
                        {message.cta.label} <ArrowRight size={14} />
                      </a>
                    ) : null}
                    <div className="ai-feedback" aria-label="Response actions">
                      <button type="button" aria-label="Helpful" disabled>
                        <ThumbsUp size={14} />
                      </button>
                      <button type="button" aria-label="Not helpful" disabled>
                        <ThumbsDown size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Copy"
                        onClick={() => {
                          void navigator.clipboard.writeText(message.text).catch(() => undefined);
                        }}
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    {message.provider ? (
                      <button type="button" className="ai-calc-row" disabled>
                        <Sparkles size={14} /> How this was calculated
                        <span className="ai-provider">via {message.provider}</span>
                      </button>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {busy ? (
          <p className="ai-typing" role="status">
            Thinking…
          </p>
        ) : null}
        {error ? <p className="ai-error" role="alert">{error}</p> : null}
      </div>

      <footer className="ai-assistant-footer">
        {context ? (
          <div className="ai-context">
            <span>Asking about: {context}</span>
            <button type="button" aria-label="Clear context" onClick={() => setContext("")}>
              <X size={12} />
            </button>
          </div>
        ) : null}
        <div className="ai-composer">
          <textarea
            ref={inputRef}
            rows={1}
            placeholder="Ask anything..."
            value={draft}
            aria-label="Ask the AI assistant"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
          />
          <button
            type="button"
            className="ai-send"
            aria-label="Send"
            disabled={busy || !draft.trim()}
            onClick={() => void send(draft)}
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="ai-disclaimer">All responses may be inaccurate. Verify important information.</p>
      </footer>
    </aside>
  );
}
