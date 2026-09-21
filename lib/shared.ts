export type List = { id: string; slug: string; name: string; description: string; allowUrls: boolean | null; createdAt: number; itemCount: number; topTitle: string | null; topScore: number | null };
export type Item = { id: string; title: string; content: string; sourceUrl: string | null; sourceHost: string | null; author: string | null; score: number; createdAt: number };
export function slugify(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");
}
export const suggestions = [
  { name: "Favorite Tweets", description: "Memorable English-language posts on X. Wit, insight, and ideas worth passing on." },
  { name: "Favorite Models", description: "AI language models, from everyday workhorses to the most capable frontier models." },
  { name: "Favorite Words", description: "English words with a beautiful sound, an interesting meaning, or a certain kind of magic." },
];

// Website excerpts are displayed as continuous prose, including older fetched rows.
export function compactWebText(content: string) {
  return content.replace(/\s+/g, " ").replace(/ +([,.;!?])/g, "$1").trim();
}
