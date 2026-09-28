"use client";
/**
 * Owner AI Agent conversation state (frontend only).
 *
 * No response text is hardcoded in components. Messages typed by the owner are
 * held in local state and handed to `sendAgentMessage`, which is the single seam
 * a backend plugs into. Until then, replies are matched from
 * `src/data/owner/agent-replies.json`.
 */
import { useCallback, useRef, useState } from "react";
import agentData from "@/data/owner/agent-replies.json";

export type OwnerChatRole = "owner" | "agent";

export type OwnerChatStatus = "sent" | "processing" | "failed";

export type OwnerChatMessage = {
  id: string;
  role: OwnerChatRole;
  text: string;
  createdAt: string;
  status: OwnerChatStatus;
  /** Present when `status === "failed"`. */
  error?: string;
};

export type AgentPrompt = { id: string; label: string; text: string };

/**
 * Suggested prompts are UI configuration (capability hints), not business data.
 * A backend can replace this list via `GET /owner/agent/prompts` unchanged.
 */
export const AGENT_PROMPTS: AgentPrompt[] =
  ((agentData as { prompts?: AgentPrompt[] }).prompts ?? []) as AgentPrompt[];

/** Replace this body with a real request to enable live answers. */
export function sendAgentMessage(input: {
  message: string;
  history: OwnerChatMessage[];
}): Promise<{ reply: string }> {
  const query = input.message.toLowerCase();
  const match = agentData.replies.find((entry) =>
    entry.keywords.some((keyword) => query.includes(keyword)),
  );
  return new Promise((resolve) => {
    setTimeout(() => resolve({ reply: match?.reply ?? agentData.fallback }), 700);
  });
}

function messageId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function useOwnerAgent() {
  const [messages, setMessages] = useState<OwnerChatMessage[]>([]);
  const [isProcessing, setProcessing] = useState(false);
  const lastPrompt = useRef<string>("");

  const run = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      lastPrompt.current = trimmed;

      const ownerMessage: OwnerChatMessage = {
        id: messageId(),
        role: "owner",
        text: trimmed,
        createdAt: new Date().toISOString(),
        status: "sent",
      };
      const pending: OwnerChatMessage = {
        id: messageId(),
        role: "agent",
        text: "",
        createdAt: new Date().toISOString(),
        status: "processing",
      };

      setMessages((current) => [...current, ownerMessage, pending]);
      setProcessing(true);

      try {
        const history = messages;
        const result = await sendAgentMessage({ message: trimmed, history });
        setMessages((current) =>
          current.map((message) =>
            message.id === pending.id
              ? { ...message, text: result.reply, status: "sent" as OwnerChatStatus }
              : message,
          ),
        );
      } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Request failed";
        setMessages((current) =>
          current.map((message) =>
            message.id === pending.id
              ? { ...message, status: "failed" as OwnerChatStatus, error }
              : message,
          ),
        );
      } finally {
        setProcessing(false);
      }
    },
    [messages],
  );

  const retry = useCallback(() => {
    if (!lastPrompt.current) return;
    // Drop the failed exchange, then replay the prompt.
    setMessages((current) => {
      const next = [...current];
      while (next.length > 0 && next[next.length - 1]?.status === "failed") next.pop();
      if (next.length > 0 && next[next.length - 1]?.role === "owner") next.pop();
      return next;
    });
    void run(lastPrompt.current);
  }, [run]);

  const clear = useCallback(() => {
    setMessages([]);
    lastPrompt.current = "";
  }, []);

  return { messages, isProcessing, send: run, retry, clear, prompts: AGENT_PROMPTS };
}
