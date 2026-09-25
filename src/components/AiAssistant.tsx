import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Clock3,
  Copy,
  CornerDownRight,
  ExternalLink,
  Plus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import liquidMark from "../assets/liquid-mark.png";

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
  rationale?: string;
  relatedQuestions?: string[];
};

type ChatResponse = {
  reply?: string;
  table?: AssistantTable | null;
  cta?: { label: string; href: string } | null;
  provider?: string;
  rationale?: string;
  relatedQuestions?: string[];
  error?: string;
};

const WELCOME_SUGGESTIONS = [
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
  /** Reports each message's outcome (answered/failed) for usage analytics; never the message text. */
  onMessageOutcome?: (outcome: "answered" | "failed") => void;
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

function normalizeRelated(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

/** Lightweight safe markdown: paragraphs, numbered/bulleted lists, **bold**. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyPrefix}-b-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return part ? <span key={`${keyPrefix}-t-${index}`}>{part}</span> : null;
  });
}

function AssistantMarkdown({ text }: { text: string }) {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\s+(\d+)\.\s+/g, "\n$1. ")
    .replace(/\s+[-•]\s+/g, "\n- ")
    .trim();

  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const blocks: ReactNode[] = [];
  let listItems: { kind: "ol" | "ul"; items: string[] } | null = null;

  const flushList = (key: string) => {
    if (!listItems) return;
    const Tag = listItems.kind === "ol" ? "ol" : "ul";
    blocks.push(
      <Tag key={key} className="ai-md-list">
        {listItems.items.map((item, index) => (
          <li key={`${key}-${index}`}>{renderInline(item, `${key}-${index}`)}</li>
        ))}
      </Tag>,
    );
    listItems = null;
  };

  lines.forEach((line, index) => {
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    const bullet = line.match(/^[-•]\s+(.*)$/);
    if (ordered) {
      if (!listItems || listItems.kind !== "ol") {
        flushList(`list-pre-${index}`);
        listItems = { kind: "ol", items: [] };
      }
      listItems.items.push(ordered[1]);
      return;
    }
    if (bullet) {
      if (!listItems || listItems.kind !== "ul") {
        flushList(`list-pre-${index}`);
        listItems = { kind: "ul", items: [] };
      }
      listItems.items.push(bullet[1]);
      return;
    }
    flushList(`list-pre-${index}`);
    blocks.push(
      <p key={`p-${index}`} className="ai-md-p">
        {renderInline(line, `p-${index}`)}
      </p>,
    );
  });
  flushList("list-end");

  return <div className="ai-md">{blocks}</div>;
}

function CalculationAccordion({
  provider,
  rationale,
}: {
  provider?: string;
  rationale: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={`ai-calc${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="ai-calc-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ai-calc-toggle-main">
          <Sparkles size={14} aria-hidden="true" />
          How this was calculated
        </span>
        <ChevronDown size={16} className="ai-calc-chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div id={panelId} className="ai-calc-panel">
          <p>{rationale}</p>
          <p className="ai-calc-complete">
            <Sparkles size={12} aria-hidden="true" /> Complete
          </p>
          {provider ? <p className="ai-provider-foot">via {provider}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function AiAssistant({
  open,
  onClose,
  contextLabel = "Dashboard",
  broken = false,
  userName = "Jordan",
  onMessageOutcome,
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

  const relatedQuestions = useMemo(() => {
    if (messages.length === 0) return WELCOME_SUGGESTIONS;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "assistant" && message.relatedQuestions?.length) {
        return message.relatedQuestions;
      }
    }
    return WELCOME_SUGGESTIONS;
  }, [messages]);

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
        onMessageOutcome?.("failed");
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
            rationale:
              typeof data.rationale === "string" && data.rationale.trim()
                ? data.rationale.trim()
                : "Answered from Liquid Coffee Co. demo books for this page context.",
            relatedQuestions: normalizeRelated(data.relatedQuestions),
          },
        ]);
        onMessageOutcome?.("answered");
      } catch (err) {
        onMessageOutcome?.("failed");
        setError(err instanceof Error ? err.message : "assistant_failed");
      } finally {
        setBusy(false);
      }
    },
    [busy, broken, context, messages, onMessageOutcome],
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
          <img className="ai-brand-mark" src={liquidMark} alt="" width={18} height={18} />
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
            <img className="ai-welcome-mark" src={liquidMark} alt="" width={40} height={40} />
            <h3>Hello {userName}!</h3>
            <p>How can I help you today?</p>
          </div>
        ) : (
          <ul className="ai-message-list">
            {messages.map((message) => (
              <li key={message.id} className={`ai-message ai-message-${message.role}`}>
                {message.role === "user" ? (
                  <div className="ai-bubble-user">{message.text}</div>
                ) : (
                  <div className="ai-bubble-assistant">
                    <AssistantMarkdown text={message.text} />
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
                    {message.rationale ? (
                      <CalculationAccordion provider={message.provider} rationale={message.rationale} />
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
        {!busy && relatedQuestions.length > 0 ? (
          <div className="ai-related" aria-label={empty ? "Suggested questions" : "Related questions"}>
            {relatedQuestions.map((question) => (
              <button key={question} type="button" onClick={() => void send(question)}>
                <CornerDownRight size={14} aria-hidden="true" />
                <span>{question}</span>
              </button>
            ))}
          </div>
        ) : null}
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
