"use client";
/**
 * Owner AI Agent chat surface: message bubbles, processing indicator, retry
 * state, suggested prompts and a composer with a voice-input button.
 * Purely presentational — all state is owned by `useOwnerAgent`.
 */
import { AlertTriangle, Mic, RotateCcw, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/owner/spinner";
import type { AgentPrompt, OwnerChatMessage } from "@/lib/owner/agent";
import { cn } from "@/lib/utils";

function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function ChatMessageBubble({
  message,
  onRetry,
}: {
  message: OwnerChatMessage;
  onRetry: () => void;
}) {
  const isOwner = message.role === "owner";

  if (message.status === "processing") {
    return (
      <div className="flex justify-start">
        <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-brand-border-subtle bg-white px-3.5 py-2.5 text-sm font-semibold text-brand-secondary-text ">
          <Spinner className="h-4 w-4 text-brand-accent" />
          Thinking…
        </div>
      </div>
    );
  }

  if (message.status === "failed") {
    return (
      <div className="flex justify-start">
        <div
          role="alert"
          className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-md border border-brand-danger/30 bg-brand-danger/10 px-3.5 py-3"
        >
          <p className="flex items-start gap-2 text-xs font-semibold text-brand-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {message.error ?? "The agent could not respond."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-brand-navy-deep transition-colors hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex", isOwner ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
          isOwner
            ? "bg-brand-gradient rounded-br-md font-semibold text-white"
            : "rounded-bl-md border border-brand-border-subtle bg-white text-brand-navy-deep ",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <span
          className={cn(
            "mt-1 block text-[10px] font-semibold",
            isOwner ? "text-white/70" : "text-brand-muted",
          )}
        >
          {timeLabel(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function SuggestedPrompts({
  prompts,
  onSelect,
  disabled,
}: {
  prompts: AgentPrompt[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}) {
  if (prompts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt.text)}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy-deep transition-colors hover:border-brand-accent hover:text-brand-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
        >
          <Sparkles className="h-3.5 w-3.5 text-brand-accent" aria-hidden="true" />
          {prompt.label}
        </button>
      ))}
    </div>
  );
}

/** Composer with a voice button. Voice capture is a UI affordance only. */
export function ChatComposer({
  onSend,
  disabled,
  placeholder = "Ask about sales, stock, suppliers…",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex items-end gap-2"
    >
      <label htmlFor="owner-agent-input" className="sr-only">
        Message the AI agent
      </label>
      <textarea
        id="owner-agent-input"
        rows={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className="min-h-11 max-h-32 w-full flex-1 resize-y rounded-2xl border border-brand-border bg-white px-3.5 py-2.5 text-sm text-brand-navy-deep placeholder:text-brand-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
      />
      <button
        type="button"
        aria-pressed={listening}
        aria-label={listening ? "Stop voice input" : "Start voice input"}
        onClick={() => setListening((current) => !current)}
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
          listening
            ? "border-transparent bg-brand-gradient text-white"
            : "border-brand-border bg-white text-brand-navy-deep hover:bg-brand-surface-2 ",
        )}
      >
        <Mic className={cn("h-5 w-5", listening && "animate-pulse")} />
      </button>
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        aria-label="Send message"
        className="bg-brand-gradient grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
      >
        <Send className="h-5 w-5" />
      </button>
    </form>
  );
}

/** Scrolling thread that keeps the latest message in view. */
export function ChatThread({
  messages,
  onRetry,
  emptyState,
}: {
  messages: OwnerChatMessage[];
  onRetry: () => void;
  emptyState: React.ReactNode;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) return <>{emptyState}</>;

  return (
    <div aria-live="polite" className="space-y-3 pe-1">
      {messages.map((message) => (
        <ChatMessageBubble key={message.id} message={message} onRetry={onRetry} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
