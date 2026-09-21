import { z } from "zod";
import { AppError } from "./errors";
export async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const origin=request.headers.get("Origin");
  if ((origin && origin!==new URL(request.url).origin) || request.headers.get("Sec-Fetch-Site")==="cross-site") throw new AppError("Please submit from this site.",403);
  if (!request.headers.get("Content-Type")?.includes("application/json")) throw new AppError("Please submit a JSON request.",415);
  const reader=request.body?.getReader(); if(!reader) throw new AppError("Your submission is empty.");
  let length=0; let text=""; const decoder=new TextDecoder();
  try { while(true) { const {value,done}=await reader.read(); if(done) break; length+=value.byteLength; if(length>20000) { await reader.cancel(); throw new AppError("That submission is too long.",413); } text+=decoder.decode(value,{stream:true}); } text+=decoder.decode(); } finally { reader.releaseLock(); }
  let value; try { value=JSON.parse(text); } catch { throw new AppError("That submission could not be read."); }
  const parsed=schema.safeParse(value); if(!parsed.success) throw new AppError(parsed.error.issues[0]?.message||"Please check your submission."); return parsed.data;
}
export const listInput=z.object({allowUrls:z.boolean().nullable().default(null),name:z.string().trim().min(3,"Give your list a name of at least 3 characters.").max(80),description:z.string().trim().min(12,"Add a clearer description, at least 12 characters long.").max(1000),creatorHandle:z.string().trim().transform(s=>s.replace(/^@/,"")).pipe(z.string().regex(/^[A-Za-z0-9_]{0,15}$/, "An X handle uses up to 15 letters, numbers, or underscores.")).optional().default("")});
export const itemInput=z.object({item:z.string().trim().min(1,"Add an item first.").max(4000,"Please keep your submission under 4,000 characters.")});
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
