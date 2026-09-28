import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiAssistant } from "./AiAssistant";

function mockChatOk(overrides: Record<string, unknown> = {}) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      reply: "Income is up versus last quarter.",
      provider: "fixture",
      rationale: "Compared June income to the prior quarter in demo books.",
      relatedQuestions: ["What drove the increase?", "Show expense trend"],
      table: {
        headers: ["Quarter", "Income"],
        rows: [
          ["Q1", "$120k"],
          ["Q2", "$148k"],
        ],
      },
      ...overrides,
    }),
  });
}

describe("AiAssistant", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<AiAssistant open={false} onClose={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows welcome state with suggested questions", () => {
    render(<AiAssistant open onClose={() => undefined} />);
    expect(screen.getByRole("heading", { name: "AI Assistant" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Hello Jordan/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Ask the AI assistant/i)).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AiAssistant open onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sends a suggestion, renders reply, table, and closed calculation accordion", async () => {
    const user = userEvent.setup();
    const fetchMock = mockChatOk();
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant open onClose={() => undefined} contextLabel="Dashboard" />);
    await user.click(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );

    expect(await screen.findByText(/Income is up versus last quarter/i)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Quarter" })).toBeInTheDocument();

    const accordion = screen.getByRole("button", { name: /How this was calculated/i });
    expect(accordion).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/via fixture/i)).not.toBeInTheDocument();

    await user.click(accordion);
    expect(accordion).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Compared June income/i)).toBeInTheDocument();
    expect(screen.getByText(/via fixture/i)).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/assistant/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("replaces welcome chips with related questions after a reply", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", mockChatOk());

    render(<AiAssistant open onClose={() => undefined} />);
    await user.click(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );
    await screen.findByText(/Income is up versus last quarter/i);

    const related = screen.getByLabelText(/Related questions/i);
    expect(within(related).getByRole("button", { name: /What drove the increase\?/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /How does this quarter compare to last\?/i }),
    ).not.toBeInTheDocument();
  });

  it("lists a saved chat in History and restores the reply", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", mockChatOk());

    render(<AiAssistant open onClose={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByText(/No chats yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "History" }));

    await user.click(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );
    expect(await screen.findByText(/Income is up versus last quarter/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "History" }));
    const list = screen.getByRole("list", { name: "Chat history" });
    expect(
      within(list).getByRole("button", { name: /How does this quarter compare to last\?/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New chat" }));
    expect(screen.getByRole("heading", { name: /Hello Jordan/i })).toBeInTheDocument();
    expect(screen.queryByText(/Income is up versus last quarter/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "History" }));
    const saved = screen.getByRole("list", { name: "Chat history" });
    await user.click(
      within(saved).getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );

    expect(screen.getByText(/Income is up versus last quarter/i)).toBeInTheDocument();
    expect(
      within(screen.getByLabelText(/Related questions/i)).getByRole("button", {
        name: /What drove the increase\?/i,
      }),
    ).toBeInTheDocument();
  });

  it("clears the thread with New chat", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", mockChatOk());

    render(<AiAssistant open onClose={() => undefined} />);
    await user.click(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );
    await screen.findByText(/Income is up versus last quarter/i);

    await user.click(screen.getByRole("button", { name: /New chat/i }));
    expect(screen.getByRole("heading", { name: /Hello Jordan/i })).toBeInTheDocument();
    expect(screen.queryByText(/Income is up versus last quarter/i)).not.toBeInTheDocument();
  });

  it("sends from the composer on Enter", async () => {
    const user = userEvent.setup();
    const fetchMock = mockChatOk({ reply: "**Bold** margin looks healthy." });
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant open onClose={() => undefined} />);
    const input = screen.getByLabelText(/Ask the AI assistant/i);
    await user.type(input, "What's my gross profit margin?{Enter}");

    expect(await screen.findByText(/margin looks healthy/i)).toBeInTheDocument();
    expect(screen.getByText("Bold")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });

  it("surfaces API failures as an alert", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: "assistant_unavailable" }),
      }),
    );

    render(<AiAssistant open onClose={() => undefined} />);
    await user.click(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/assistant_unavailable/i);
  });

  it("shows the intentional BFF miss when broken", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant open onClose={() => undefined} broken />);
    await user.click(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );

    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
      /never wired on this BFF/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders open invoice rows as a table and does not signal", async () => {
    const user = userEvent.setup();
    const fetchMock = mockChatOk({
      reply: "These invoices are still open on the Liquid Coffee Co. demo books.",
      answerKind: "table",
      table: {
        headers: ["Invoice", "Customer", "Due", "Amount"],
        rows: [["INV-1042", "Northwind Cafe", "3 Oct 2026", "$1,240"]],
      },
      chart: null,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant open onClose={() => undefined} />);
    await user.type(screen.getByLabelText(/Ask the AI assistant/i), "Show my open invoices in a table{Enter}");

    expect(await screen.findByRole("cell", { name: "INV-1042" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Invoice" })).toBeInTheDocument();
    expect(screen.queryByText("Answer failed to render as a table")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => call[0] === "/api/v1/product/signal")).toBe(false);
  });

  it("draws revenue by month as a chart and does not signal", async () => {
    const user = userEvent.setup();
    const fetchMock = mockChatOk({
      reply: "Revenue by month on the Liquid Coffee Co. demo books.",
      answerKind: "chart",
      table: null,
      chart: {
        points: [
          { label: "Jul", value: 18200 },
          { label: "Aug", value: 21450 },
          { label: "Sep", value: 19680 },
        ],
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant open onClose={() => undefined} />);
    await user.type(screen.getByLabelText(/Ask the AI assistant/i), "Show revenue by month as a chart{Enter}");

    expect(await screen.findByRole("img", { name: "Revenue by month" })).toBeInTheDocument();
    expect(screen.getByText("Jul")).toBeInTheDocument();
    expect(screen.getByText("Aug")).toBeInTheDocument();
    expect(screen.queryByText("Answer failed to render as a table")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => call[0] === "/api/v1/product/signal")).toBe(false);
  });

  it("opens and closes pop out on the same thread and does not signal", async () => {
    const user = userEvent.setup();
    const fetchMock = mockChatOk();
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant open onClose={() => undefined} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /How does this quarter compare to last\?/i }));
    expect(await screen.findByText(/Income is up versus last quarter/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pop out" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Income is up versus last quarter/i)).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pop out" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(screen.getByRole("complementary")).getByText(/Income is up versus last quarter/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => call[0] === "/api/v1/product/signal")).toBe(false);
  });

  it("does not signal for a normal prose answer", async () => {
    const user = userEvent.setup();
    const fetchMock = mockChatOk({
      reply: "Gross profit margin is about 58% this quarter.",
      answerKind: null,
      table: null,
      chart: null,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant open onClose={() => undefined} />);
    await user.type(screen.getByLabelText(/Ask the AI assistant/i), "What's my gross profit margin?{Enter}");

    expect(await screen.findByText(/58% this quarter/i)).toBeInTheDocument();
    expect(screen.queryByText("Answer failed to render as a table")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Revenue by month" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => call[0] === "/api/v1/product/signal")).toBe(false);
  });

  describe("usage outcomes (analytics, never message text)", () => {
    const ask = async (props: Partial<Parameters<typeof AiAssistant>[0]> = {}) => {
      const user = userEvent.setup();
      const onMessageOutcome = vi.fn();
      render(<AiAssistant open onClose={() => undefined} onMessageOutcome={onMessageOutcome} {...props} />);
      await user.type(screen.getByLabelText(/Ask the AI assistant/i), "What's my gross profit margin?{Enter}");
      return onMessageOutcome;
    };

    it("reports 'answered' after a successful reply", async () => {
      vi.stubGlobal("fetch", mockChatOk());
      const onMessageOutcome = await ask();
      expect(await screen.findByText(/Income is up/)).toBeInTheDocument();
      expect(onMessageOutcome).toHaveBeenCalledTimes(1);
      expect(onMessageOutcome).toHaveBeenCalledWith("answered");
    });

    it("reports 'failed' when the BFF errors", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "assistant_failed" }) }));
      const onMessageOutcome = await ask();
      await screen.findByRole("alert").catch(() => undefined);
      await vi.waitFor(() => expect(onMessageOutcome).toHaveBeenCalledWith("failed"));
      expect(onMessageOutcome).not.toHaveBeenCalledWith("answered");
    });

    it("reports 'failed' for the intentional broken rail, without calling the BFF", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const onMessageOutcome = await ask({ broken: true });
      await vi.waitFor(() => expect(onMessageOutcome).toHaveBeenCalledWith("failed"));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

