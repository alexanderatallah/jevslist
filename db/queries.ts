import { env } from "cloudflare:workers";
import { AppError } from "@/lib/errors";
import { hash } from "@/lib/normalization";
import type { List, Item } from "@/lib/shared";
export function database() { if (!env.DB) throw new AppError("The collections are temporarily unavailable. Please try again shortly.", 503); return env.DB; }
const listSelect = `SELECT b.id, b.slug, b.name, b.description, b.allow_urls AS allowUrls, b.created_at AS createdAt,
 (SELECT COUNT(*) FROM list_items i WHERE i.list_id=b.id) AS itemCount,
 (SELECT title FROM list_items i WHERE i.list_id=b.id ORDER BY score DESC,created_at ASC,id ASC LIMIT 1) AS topTitle,
 (SELECT score FROM list_items i WHERE i.list_id=b.id ORDER BY score DESC,created_at ASC,id ASC LIMIT 1) AS topScore FROM lists b`;
export const itemSelect = `SELECT id,title,content,source_url AS sourceUrl,source_host AS sourceHost,author,score,created_at AS createdAt FROM list_items`;
type StoredList = Omit<List,"allowUrls"> & {allowUrls:number|null};
function publicList(row:StoredList):List { return {...row,allowUrls:row.allowUrls===null?null:row.allowUrls===1}; }
export async function getList(slug: string) { const row=await database().prepare(`${listSelect} WHERE b.slug=?`).bind(slug).first<StoredList>();return row?publicList(row):null; }
export async function listExists(slug: string) { return !!await database().prepare("SELECT 1 FROM lists WHERE slug=?").bind(slug).first(); }
export async function duplicate(listId: string, inputHash: string, contentHash?: string) {
  return !!await database().prepare("SELECT 1 FROM list_items WHERE list_id=? AND (submission_hash=? OR content_hash=?) LIMIT 1").bind(listId, inputHash, contentHash || "").first();
}
export function encodeCursor(values: (string | number)[]) { return btoa(JSON.stringify(values)); }
export function decodeCursor(cursor: string | null): unknown[] | null {
  if (!cursor) return null;
  try { if (cursor.length>400) throw new Error(); const value=JSON.parse(atob(cursor)); if(!Array.isArray(value)) throw new Error(); return value; } catch { throw new AppError("That page link is invalid."); }
}
export async function listLists(cursor: string | null) {
  const c=decodeCursor(cursor); if(c && (c.length!==3 || typeof c[0]!=="number" || typeof c[1]!=="number" || typeof c[2]!=="string")) throw new AppError("That page link is invalid.");
  const {results}=await database().prepare(`SELECT * FROM (${listSelect}) ${c?"WHERE itemCount<? OR (itemCount=? AND createdAt<?) OR (itemCount=? AND createdAt=? AND id<?)":""} ORDER BY itemCount DESC,createdAt DESC,id DESC LIMIT 49`).bind(...(c?[c[0],c[0],c[1],c[0],c[1],c[2]]:[])).all<StoredList>();
  const lists=results.slice(0,48).map(publicList); const last=lists.at(-1);
  return {lists,nextCursor:results.length>48&&last?encodeCursor([last.itemCount,last.createdAt,last.id]):null};
}
export async function listItems(listId: string, cursor: string | null) {
  const c=decodeCursor(cursor); if(c && (c.length!==3 || typeof c[0]!=="number" || typeof c[1]!=="number" || typeof c[2]!=="string")) throw new AppError("That page link is invalid.");
  const {results}=await database().prepare(`${itemSelect} WHERE list_id=? ${c?"AND (score<? OR (score=? AND created_at>?) OR (score=? AND created_at=? AND id>?))":""} ORDER BY score DESC,created_at ASC,id ASC LIMIT 51`).bind(listId,...(c?[c[0],c[0],c[1],c[0],c[1],c[2]]:[])).all<Item>();
  const items=results.slice(0,50); const last=items.at(-1);
  return {items,nextCursor:results.length>50&&last?encodeCursor([last.score,last.createdAt,last.id]):null};
}
export async function acquireLock(key: string) {
  const token=crypto.randomUUID(); const now=Date.now();
  const r=await database().prepare("INSERT INTO operation_locks(key,token,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE operation_locks.expires_at<?").bind(key,token,now+300000,now).run();
  if (!r.meta.changes) throw new AppError("This submission is already being checked. Give Jev a moment, then refresh.",409);
  return async()=>{await database().prepare("DELETE FROM operation_locks WHERE key=? AND token=?").bind(key,token).run();};
}
export async function rateLimit(request: Request, kind: "list"|"item") {
  const now=Date.now(); const day=Math.floor(now/86400000); const hour=Math.floor(now/3600000);
  const visitor=await hash(`${day}:${request.headers.get("cf-connecting-ip") || "preview"}`);
  const limits=[{key:`${kind}:${hour}:${visitor}`,limit:kind==="list"?8:60,expiry:(hour+1)*3600000},{key:`all:${day}`,limit:Number(env.JEV_DAILY_LIMIT)||1000,expiry:(day+1)*86400000}];
  await database().prepare("DELETE FROM rate_limits WHERE expires_at<?").bind(now).run();
  for (const l of limits) {
    const row=await database().prepare("INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count").bind(l.key,l.expiry).first<{count:number}>();
    if (!row || row.count>l.limit) throw new AppError(l.key.startsWith("all:")?"Jev has reached today’s submission limit. Please come back tomorrow.":"You’re adding things a little quickly. Please try again in an hour.",429);
  }
}
