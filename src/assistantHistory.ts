/**
 * Per-browser assistant chats. Core and Reporting are different origins, so
 * each app keeps its own list. Stored data is untrusted on load.
 */

export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  relatedQuestions?: string[];
}

export interface StoredChat {
  id: string;
  title: string;
  updatedAt: number;
  messages: StoredChatMessage[];
}

export const ASSISTANT_HISTORY_KEY = "liquid-assistant-chats:v1";
const MAX_CHATS = 20;
const MAX_TITLE = 72;

function isMessage(value: unknown): value is StoredChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as StoredChatMessage;
  return (message.role === "user" || message.role === "assistant") && typeof message.id === "string" && typeof message.text === "string";
}

function isChat(value: unknown): value is StoredChat {
  if (!value || typeof value !== "object") return false;
  const chat = value as StoredChat;
  return typeof chat.id === "string" && typeof chat.title === "string" && typeof chat.updatedAt === "number" && Array.isArray(chat.messages) && chat.messages.every(isMessage);
}

export function loadChats(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): StoredChat[] {
  try {
    const raw = storage?.getItem(ASSISTANT_HISTORY_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(isChat).slice(0, MAX_CHATS);
  } catch {
    return [];
  }
}

export function chatTitle(messages: Array<{ role: string; text: string }>): string {
  const first = messages.find((message) => message.role === "user");
  const text = first?.text.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return "New chat";
  return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1).trimEnd()}…` : text;
}

/** Newest first. Returns the list that was stored. */
export function rememberChat(chat: StoredChat, storage: Pick<Storage, "getItem" | "setItem"> | undefined = globalThis.localStorage): StoredChat[] {
  const next = [chat, ...loadChats(storage).filter((item) => item.id !== chat.id)].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
  try {
    storage?.setItem(ASSISTANT_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* private mode — the open thread still works */
  }
  return next;
}
