"use client";
/**
 * Image registry: mock JSON data references images by key, so the same records
 * can later come from an API that returns absolute URLs instead.
 *
 * Images live in /public/assets and are referenced by plain string path
 * (served statically by Next.js), matching the original resolved-URL contract.
 */

const IMAGES: Record<string, string> = {
  "food-zinger": "/assets/food-zinger.png",
  "food-cheeseburger": "/assets/food-cheeseburger.png",
  "food-beefburger": "/assets/food-beefburger.png",
  "food-pizza": "/assets/food-pizza.png",
  "food-fries": "/assets/food-fries.png",
  "food-dessert": "/assets/food-dessert.png",
  "item-cola": "/assets/item-cola.png",
  "item-milk": "/assets/item-milk.png",
  "item-bread": "/assets/item-bread.png",
  "item-eggs": "/assets/item-eggs.png",
  "cat-groceries": "/assets/cat-groceries.png",
  "cat-beverages": "/assets/cat-beverages.png",
  "cat-dairy": "/assets/cat-dairy.png",
  "cat-snacks": "/assets/cat-snacks.png",
};

/** Resolve an image reference; absolute/relative URLs pass through untouched. */
export function resolveImage(ref: string): string {
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith("/") || ref.startsWith("data:")) return ref;
  return IMAGES[ref] ?? "";
}
