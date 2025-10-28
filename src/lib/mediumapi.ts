export type MediumUserIdResponse = {
  user_id?: string;
};

export type MediumArticle = {
  id?: string;
  article_id?: string;
  title?: string;
  url?: string;
  clap_count?: number;
  claps?: number;
  tags?: string[];
  subtitle?: string;
  created_at?: string;
};

export type MediumTopArticlesResponse = {
  articles?: MediumArticle[];
  items?: MediumArticle[];
  data?: MediumArticle[];
};

function getRapidHeaders() {
  const key = process.env.RAPID_API_KEY;
  const host = process.env.RAPID_API_HOST;
  if (!key || !host) return null;
  return {
    key,
    host,
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": host,
    },
  } as const;
}

export async function getMediumUserIdByUsername(username: string): Promise<string | null> {
  const cfg = getRapidHeaders();
  if (!cfg) return null;
  const res = await fetch(`https://${cfg.host}/user/id_for/${encodeURIComponent(username)}`, {
    headers: cfg.headers,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as MediumUserIdResponse;
  const uid = (data as any)?.user_id ?? (data as any)?.id ?? null;
  return typeof uid === "string" ? uid : null;
}

export async function getMediumTopArticlesByUserId(userId: string, limit = 5): Promise<MediumArticle[]> {
  const cfg = getRapidHeaders();
  if (!cfg) return [];
  const res = await fetch(`https://${cfg.host}/user/${encodeURIComponent(userId)}/top_articles`, {
    headers: cfg.headers,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as MediumTopArticlesResponse | MediumArticle[];
  const arr = Array.isArray(data) ? data : data.articles || data.items || data.data || [];
  const items = Array.isArray(arr) ? arr : [];
  return items.slice(0, limit);
}

export function buildMediumProfileText(username: string, articles: MediumArticle[]): string {
  const lines: string[] = [];
  lines.push("Medium Profile:");
  lines.push(`Username: ${username}`);
  if (articles.length) {
    lines.push("Top Articles:");
    for (const a of articles) {
      const id = a.article_id || a.id || "";
      const title = a.title || "Untitled";
      const url = a.url || (id ? `https://medium.com/p/${id}` : "");
      const claps = a.claps ?? a.clap_count;
      const cl = typeof claps === "number" ? ` | Claps: ${claps}` : "";
      lines.push(`- ${title}${cl}${url ? ` | ${url}` : ""}`);
    }
  }
  return lines.join("\n");
}
