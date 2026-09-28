"use client";
/** DTOs shared by every data-driven screen. Shapes mirror the future API responses. */

export type Product = {
  id: string;
  name: string;
  description: string;
  ingredients: string;
  price: number;
  rating: number;
  reviews: number;
  /** Resolved image URL. */
  image: string;
  /** Menu tab / group id this product belongs to. */
  tab: string;
  categoryId: string;
  keywords: string[];
  available: boolean;
};

export type Category = {
  id: string;
  name: string;
  image: string;
};

export type OrderStatus = "delivered" | "active" | "cancelled";

export type OrderLine = { name: string; qty: number };

export type Order = {
  id: string;
  date: string;
  items: OrderLine[];
  total: number;
  status: OrderStatus;
  productIds: string[];
  /** ISO timestamp — present on orders placed in-session (drives live tracking). */
  placedAt?: string;
  paymentMethodId?: string;
  instructions?: string;
};

export type MenuTab = { id: string; label: string };

export type OrderTab = { id: string; label: string; status?: OrderStatus };

export type Collection = {
  id: string;
  title: string;
  actionLabel?: string;
  products: Product[];
};

export type Currency = { code: string; symbol: string; locale: string };

export type Pricing = { deliveryFee: number; discount: number; discountThreshold: number };

export type DeliveryLocation = { label: string; value: string };

export type CustomizationGroup = {
  id: string;
  label: string;
  options: string[];
  defaultIndex: number;
};

export type ProfileRow = {
  id: string;
  label: string;
  icon: string;
  to?: string;
  /** Dynamic value slot (e.g. current language) resolved by the screen. */
  valueKey?: string;
};

export type ProfileSection = { id: string; title: string; rows: ProfileRow[] };

export type ProfileConfig = {
  fallbackUser: { fullName: string; phone: string; email: string };
  editAction: { label: string; to: string };
  logout: { label: string; to: string };
  sections: ProfileSection[];
};

export type SortOption = { id: string; label: string };

export type ProductFilter = { id: string; label: string };

export type PaymentMethod = { id: string; label: string; icon: string; enabled: boolean };

export type CheckoutConfig = {
  orderIdPrefix: string;
  etaLabel: string;
  address: { label: string; value: string };
  contact: { name: string; phone: string };
};

export type TrackingStage = { id: string; label: string; afterSeconds: number };

export type TrackingConfig = {
  etaMinutes: number;
  stages: TrackingStage[];
  rider: { name: string; initials: string; rating: number };
};

export type ProductQuery = {
  query?: string;
  tab?: string;
  categoryId?: string;
  sort?: string;
  availableOnly?: boolean;
};

export type ConversationLine = { id: string; qty: number };

export type ConversationBubble = {
  role: "user" | "ai";
  text: string;
  time: string;
  lines?: ConversationLine[];
};

export type VoiceQuickAction = { id: string; label: string; text: string };

export type VoiceIntent = {
  id: string;
  keywords: string[];
  action:
    | "repeat-last-order"
    | "navigate-checkout"
    | "summarize-cart"
    | "browse-menu"
    | "recommend"
    | "message";
  reply: string;
  fallbackReply?: string;
  suggestions?: string[];
};

export type VoiceScript = {
  greeting: { role: "ai"; text: string };
  quantityWords: Record<string, number>;
  removeKeywords: string[];
  clearKeywords: string[];
  intents: VoiceIntent[];
  replies: Record<string, string>;
  simulatedSpeech: string[];
  quickActions: VoiceQuickAction[];
};

export type PreferenceOption = { id: string; label: string };

export type PreferenceField = {
  id: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea";
  placeholder: string;
};

export type PreferencesConfig = {
  editTitle: string;
  editFields: PreferenceField[];
  languageTitle: string;
  languageOptions: PreferenceOption[];
};
