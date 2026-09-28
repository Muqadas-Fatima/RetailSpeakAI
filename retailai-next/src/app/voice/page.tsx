"use client";

import { Link, useNavigate } from "@/lib/router-compat";import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Mic,
  Plus,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/shop/nav";
import { Card, CartButton, Screen } from "@/components/shop/primitives";
import { RetailAILogo } from "@/components/brand/RetailAILogo";
import { useCart } from "@/lib/cart";
import { useLanguage } from "@/lib/i18n";
import { useOrders } from "@/lib/orders";
import {
  VOICE_SCRIPT,
  formatPrice,
  getProduct,
  type ConversationBubble,
  type VoiceQuickAction,
} from "@/lib/catalog";
import { interpret } from "@/lib/voice/engine";
import { sanitizeTranscript, useLiveMic } from "@/lib/voice/live-mic";
import { cn } from "@/lib/utils";



const now = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function VoiceOrderingScreen() {
  const navigate = useNavigate();
  const { add, remove, clear, replaceWith, count, total, lines: cartLines } = useCart();
  const { orders } = useOrders();
  const { language } = useLanguage();

  const [conversation, setConversation] = useState<ConversationBubble[]>([
    // Time is filled in after mount (see effect below) so the server-rendered
    // markup matches the client and we avoid a hydration mismatch from
    // locale-dependent Date formatting.
    { role: "ai", text: VOICE_SCRIPT.greeting.text, time: "" },
  ]);
  const [suggestions, setSuggestions] = useState<VoiceQuickAction[]>(
    VOICE_SCRIPT.quickActions.slice(0, 4),
  );
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setConversation((prev) => {
      const first = prev[0];
      if (!first || first.time !== "") return prev;
      const updated: ConversationBubble = { ...first, time: now() };
      return [updated, ...prev.slice(1)];
    });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation, thinking]);

  /** Single pipeline: user text -> engine -> conversation + cart/nav effects. */
  const send = (text: string) => {
    const input = text.trim();
    if (!input || thinking) return;
    setConversation((prev) => [...prev, { role: "user", text: input, time: now() }]);
    setThinking(true);

    const lastOrder = orders[0];
    const turn = interpret(input, {
      count,
      total,
      ...(lastOrder ? { lastOrderId: lastOrder.id } : {}),
    });

    window.setTimeout(() => {
      switch (turn.effect.type) {
        case "add":
          turn.effect.lines.forEach((line) => add(line.id, line.qty));
          break;
        case "remove":
          turn.effect.lines.forEach((line) => remove(line.id));
          break;
        case "clear":
          clear();
          break;
        case "repeat-last-order":
          if (lastOrder) replaceWith(lastOrder.productIds);
          break;
        case "browse-menu":
          navigate({
            to: "/menu",
            search: turn.effect.query ? { query: turn.effect.query } : {},
          });
          break;
        case "navigate":
          navigate({ to: turn.effect.to });
          break;
        default:
          break;
      }

      setConversation((prev) => [
        ...prev,
        {
          role: "ai",
          text: turn.reply,
          time: now(),
          ...(turn.lines?.length ? { lines: turn.lines } : {}),
        },
      ]);
      setSuggestions(
        turn.suggestions.length ? turn.suggestions : VOICE_SCRIPT.quickActions.slice(0, 4),
      );
      setThinking(false);
    }, 450);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = sanitizeTranscript(draft);
    setDraft("");
    send(text);
  };

  /** Real browser microphone capture — permissions, security and errors handled.
   *  Transcribed speech fills the text field so the user can review it before
   *  pressing Send — the mic button transcribes, the send button submits. */
  const mic = useLiveMic({
    onTranscript: (text) => setDraft(text),
    lang: language === "ur" ? "ur-PK" : "en-US",
  });
  const listening = mic.isListening;

  const handleMic = () => {
    if (thinking) return;
    if (mic.sessionExpired) mic.resumeSession();
    mic.toggle();
  };

  const micLabel = mic.isListening
    ? (VOICE_SCRIPT.replies["listening"] ?? "Listening…")
    : mic.status === "requesting"
      ? "Waiting for mic permission…"
      : mic.status === "processing"
        ? "Processing…"
        : "Tap to speak";

  return (
    <>
      <Screen className="bg-white pb-0 " fullWidth fill>
        <header className="relative flex items-center justify-center">
          <Link
            to="/home"
            aria-label="Back"
            className="absolute start-0 top-1/2 -translate-y-1/2 rounded-lg p-1 text-brand-navy-deep transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
          >
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </Link>
          <RetailAILogo className="text-[1.6rem] sm:text-[1.75rem] lg:text-3xl" />
          <div className="absolute end-0 top-1/2 -translate-y-1/2 flex items-center gap-3">
            <CartButton />
          </div>
        </header>

        <section className="mt-auto space-y-3 lg:space-y-4" aria-live="polite">
          {conversation.map((bubble, index) =>
            bubble.role === "user" ? (
              <div key={index} className="flex justify-end">
                <div className="bg-brand-gradient max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 text-[13px] font-semibold text-white shadow-[0_14px_28px_-18px_rgba(0,160,175,0.8)] lg:text-sm">
                  <p>{bubble.text}</p>
                  <p className="mt-1 text-right text-[10px] font-medium text-white/70">
                    {bubble.time}
                  </p>
                </div>
              </div>
            ) : (
              <Card key={index} className="max-w-[92%]">
                <p className="text-[13px] font-semibold text-brand-navy-deep lg:text-sm">
                  {bubble.text}
                </p>
                {bubble.lines?.length ? (
                  <ul className="mt-3 space-y-2.5">
                    {bubble.lines.map((line, lineIndex) => {
                      const product = getProduct(line.id);
                      if (!product) return null;
                      const inCart = cartLines.some((cartLine) => cartLine.id === product.id);
                      return (
                        <li key={`${line.id}-${lineIndex}`} className="flex items-center gap-3">
                          <img
                            src={product.image}
                            alt={product.name}
                            width={512}
                            height={512}
                            loading="lazy"
                            className="h-9 w-9 shrink-0 object-contain"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-semibold text-brand-navy-deep lg:text-[13px]">
                              {product.name}
                            </p>
                            <p className="text-[11px] font-semibold text-brand-secondary-text ">
                              {formatPrice(product.price)}
                            </p>
                          </div>
                          {inCart ? (
                            <span className="shrink-0 text-[12px] font-bold text-brand-accent">
                              ×{line.qty}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                add(product.id, line.qty);
                                toast.success(`${product.name} added to cart`);
                              }}
                              className="bg-brand-gradient flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[10px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
                            >
                              <Plus className="h-3 w-3" /> Add
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                <p className="mt-2 text-[10px] font-medium text-brand-secondary-text ">
                  {bubble.time}
                </p>
              </Card>
            ),
          )}
          {thinking ? (
            <Card className="max-w-[60%]">
              <span className="flex items-center gap-1.5">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="h-2 w-2 animate-bounce rounded-full bg-brand-teal"
                    style={{ animationDelay: `${dot * 120}ms` }}
                  />
                ))}
              </span>
            </Card>
          ) : null}
          <div ref={endRef} />
        </section>

        {/* Spacer so the conversation never hides behind the pinned input dock */}
        <div aria-hidden className="h-[7.5rem] lg:h-[8.5rem]" />

        {/* Input dock: suggestions + mic + text input, pinned above the bottom nav */}
        <div className="fixed inset-x-0 bottom-[4.75rem] z-20 lg:bottom-[5.5rem]">
          <div className="w-full px-5 lg:px-10">
            <div className="space-y-3 rounded-t-2xl border-t border-brand-border-subtle bg-white/95 px-1 pt-3 pb-3 shadow-[0_-12px_24px_-18px_rgba(7,27,51,0.25)] backdrop-blur-md ">
              <div className="flex flex-wrap gap-2">
                {suggestions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => send(action.text)}
                    className="rounded-full border border-brand-teal/40 bg-white px-4 py-2 text-[11px] font-bold text-brand-accent transition-colors hover:bg-brand-teal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan lg:text-xs"
                  >
                    {action.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => navigate({ to: "/cart" })}
                  className="bg-brand-gradient rounded-full px-4 py-2 text-[11px] font-bold text-white transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan lg:text-xs"
                >
                  View Cart ({count}){total > 0 ? ` · ${formatPrice(total)}` : ""}
                </button>
              </div>

              {/* Privacy / status strip: recording state, errors, session timeout */}
              <div aria-live="polite" className="space-y-1.5 px-1">
                {mic.error ? (
                  <p className="flex items-start gap-1.5 text-[11px] font-semibold text-brand-danger">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {mic.error.message}
                  </p>
                ) : mic.sessionExpired ? (
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-secondary-text">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Mic session paused for privacy — tap the mic to resume.
                  </p>
                ) : listening ? (
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-brand-accent">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-brand-danger" />
                    Recording · noise suppression on
                    {mic.interim ? (
                      <span className="ms-1 min-w-0 truncate font-medium text-brand-secondary-text">
                        “{mic.interim}”
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-brand-secondary-text">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Mic off · audio stays on your device
                  </p>
                )}
                {!mic.sessionExpired && mic.sessionSecondsLeft <= 60 ? (
                  <p className="text-[10px] font-semibold text-brand-secondary-text">
                    Mic session pauses in {mic.sessionSecondsLeft}s
                  </p>
                ) : null}
              </div>

              

              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Speak naturally, or type your order…"
                  aria-label="Type your order"
                  maxLength={240}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-12 min-w-0 flex-1 rounded-full border border-brand-border-subtle bg-white px-4 text-[13px] font-medium text-brand-navy-deep outline-none placeholder:text-brand-secondary-text focus-visible:ring-2 focus-visible:ring-brand-cyan lg:text-sm"
                />
                <button
                  type="button"
                  onClick={handleMic}
                  aria-pressed={listening}
                  aria-label={micLabel}
                  disabled={thinking}
                  className={cn(
                    "grid h-12 w-12 shrink-0 place-items-center rounded-full border border-brand-border-subtle bg-white text-brand-secondary-text transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
                    listening && "text-brand-accent border-brand-teal/40",
                  )}
                >
                  {mic.isBusy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Mic className={cn("h-5 w-5", listening && "animate-pulse")} />
                  )}
                </button>
                <button
                  type="submit"
                  aria-label="Send"
                  className="bg-brand-gradient grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow-[0_14px_28px_-16px_rgba(0,160,175,0.8)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
                >
                  <Send className="h-5 w-5 rtl:-scale-x-100" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}

export default VoiceOrderingScreen;
