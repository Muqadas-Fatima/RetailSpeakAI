"use client";
/**
 * Mock conversational engine for voice / chat ordering.
 * Nothing is hardcoded in the UI: intents, replies and suggestions come from
 * `src/data/voice.json`, and product matching is derived from the catalog
 * keywords. Replacing this with a real NLU/AI endpoint later means swapping
 * `interpret()` for an async API call — the screen contract stays the same.
 */
import {
  PRODUCTS,
  VOICE_SCRIPT,
  formatPrice,
  type ConversationLine,
  type Product,
  type VoiceIntent,
  type VoiceQuickAction,
} from "@/lib/catalog";

export type VoiceEffect =
  | { type: "add"; lines: ConversationLine[] }
  | { type: "remove"; lines: ConversationLine[] }
  | { type: "clear" }
  | { type: "repeat-last-order" }
  | { type: "browse-menu"; query: string }
  | { type: "navigate"; to: "/cart" | "/checkout" }
  | { type: "none" };

export type VoiceContext = {
  count: number;
  total: number;
  lastOrderId?: string | undefined;
};

export type VoiceTurn = {
  reply: string;
  lines?: ConversationLine[];
  effect: VoiceEffect;
  suggestions: VoiceQuickAction[];
};

const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");

function suggestionsFor(ids: string[] | undefined): VoiceQuickAction[] {
  if (!ids?.length) return [];
  return ids
    .map((id) => VOICE_SCRIPT.quickActions.find((action) => action.id === id))
    .filter((action): action is VoiceQuickAction => Boolean(action));
}

function fillTemplate(
  template: string,
  context: VoiceContext & { items?: string; orderId?: string },
) {
  return template
    .replace("{count}", String(context.count))
    .replace("{total}", formatPrice(context.total))
    .replace("{items}", context.items ?? "")
    .replace("{orderId}", context.orderId ?? "");
}

/** Aliases a product can be recognised by, longest first for greedy matching. */
function aliasesFor(product: Product): string[] {
  return [product.name, ...product.keywords]
    .map((alias) => normalize(alias).trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function quantityBefore(text: string, index: number): number {
  const before = text.slice(0, index).trim().split(/\s+/).slice(-2);
  for (const word of before.reverse()) {
    const digit = Number.parseInt(word, 10);
    if (Number.isFinite(digit) && digit > 0 && digit < 50) return digit;
    const mapped = VOICE_SCRIPT.quantityWords[word];
    if (mapped) return mapped;
  }
  return 1;
}

/** Extract every product mentioned in free text, with quantities. */
export function extractLines(input: string): ConversationLine[] {
  const text = ` ${normalize(input)} `;
  const found = new Map<string, number>();
  let consumed = text;

  for (const product of PRODUCTS) {
    for (const alias of aliasesFor(product)) {
      const index = consumed.indexOf(` ${alias} `);
      if (index === -1) continue;
      const qty = quantityBefore(consumed, index + 1);
      found.set(product.id, (found.get(product.id) ?? 0) + qty);
      consumed = consumed.replace(` ${alias} `, " ");
      break;
    }
  }

  return [...found.entries()].map(([id, qty]) => ({ id, qty }));
}

function describe(lines: ConversationLine[]): string {
  return lines
    .map((line) => {
      const product = PRODUCTS.find((item) => item.id === line.id);
      return `${product?.name ?? line.id} ×${line.qty}`;
    })
    .join(", ");
}

function matchIntent(text: string): VoiceIntent | undefined {
  return VOICE_SCRIPT.intents.find((intent) =>
    intent.keywords.some((keyword) => text.includes(normalize(keyword))),
  );
}

function browseQuery(text: string, intent: VoiceIntent): string {
  const commandWords = [
    ...intent.keywords,
    "please",
    "all",
    "products",
    "product",
    "items",
    "item",
    "menu",
    "mujhe",
    "saare",
    "sab",
  ];
  let query = text;
  for (const word of commandWords.sort((a, b) => b.length - a.length)) {
    query = query.replaceAll(normalize(word), " ");
  }
  return query.replace(/\s+/g, " ").trim();
}

/** Turn free-form user input into a reply plus the frontend effect to apply. */
export function interpret(input: string, context: VoiceContext): VoiceTurn {
  const text = normalize(input);
  const { replies } = VOICE_SCRIPT;

  const earlyIntent = matchIntent(text);
  if (earlyIntent?.action === "browse-menu") {
    const query = browseQuery(text, earlyIntent);
    return {
      reply: query
        ? earlyIntent.reply.replace("{query}", query)
        : (earlyIntent.fallbackReply ?? earlyIntent.reply.replace("{query}", "products")),
      effect: { type: "browse-menu", query },
      suggestions: suggestionsFor(earlyIntent.suggestions),
    };
  }

  if (VOICE_SCRIPT.clearKeywords.some((keyword) => text.includes(normalize(keyword)))) {
    return {
      reply: replies["cleared"] ?? "Cart cleared.",
      effect: { type: "clear" },
      suggestions: suggestionsFor(["recommend"]),
    };
  }

  const lines = extractLines(input);
  const removing = VOICE_SCRIPT.removeKeywords.some((keyword) => text.includes(normalize(keyword)));

  if (lines.length > 0) {
    const items = describe(lines);
    return {
      reply: fillTemplate((removing ? replies["removed"] : replies["added"]) ?? "{items}", {
        ...context,
        items,
      }),
      lines,
      effect: removing ? { type: "remove", lines } : { type: "add", lines },
      suggestions: suggestionsFor(["add-drink", "view-cart", "checkout"]),
    };
  }

  const intent = matchIntent(text);
  if (intent) {
    const hasItems = context.count > 0;
    switch (intent.action) {
      case "repeat-last-order":
        return context.lastOrderId
          ? {
              reply: fillTemplate(intent.reply, { ...context, orderId: context.lastOrderId }),
              effect: { type: "repeat-last-order" },
              suggestions: suggestionsFor(intent.suggestions),
            }
          : {
              reply: intent.fallbackReply ?? intent.reply,
              effect: { type: "none" },
              suggestions: suggestionsFor(["recommend"]),
            };
      case "navigate-checkout":
        return hasItems
          ? {
              reply: fillTemplate(intent.reply, context),
              effect: { type: "navigate", to: "/checkout" },
              suggestions: [],
            }
          : {
              reply: intent.fallbackReply ?? intent.reply,
              effect: { type: "none" },
              suggestions: suggestionsFor(["recommend"]),
            };
      case "summarize-cart":
        return {
          reply: fillTemplate(
            hasItems ? intent.reply : (intent.fallbackReply ?? intent.reply),
            context,
          ),
          effect: hasItems ? { type: "navigate", to: "/cart" } : { type: "none" },
          suggestions: suggestionsFor(intent.suggestions),
        };
      case "recommend": {
        const picks = [...PRODUCTS].sort((a, b) => b.reviews - a.reviews).slice(0, 3);
        return {
          reply: intent.reply,
          lines: picks.map((product) => ({ id: product.id, qty: 1 })),
          effect: { type: "none" },
          suggestions: suggestionsFor(intent.suggestions),
        };
      }
      default:
        return {
          reply: fillTemplate(intent.reply, context),
          effect: { type: "none" },
          suggestions: suggestionsFor(intent.suggestions),
        };
    }
  }

  return {
    reply: replies["notFound"] ?? "Sorry, I didn't catch that.",
    effect: { type: "none" },
    suggestions: suggestionsFor(["recommend", "view-cart"]),
  };
}

/** Random simulated transcript used when the mic button is pressed. */
export function simulatedSpeech(): string {
  const samples = VOICE_SCRIPT.simulatedSpeech;
  return samples[Math.floor(Math.random() * samples.length)] ?? "";
}
