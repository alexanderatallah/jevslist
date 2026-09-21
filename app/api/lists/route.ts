import { acquireLock, listExists, database, getList, listLists, rateLimit } from "@/db/queries";
import { errorResponse, AppError } from "@/lib/errors";
import { body, listInput, json } from "@/lib/http";
import { approveList, requireJev } from "@/lib/jev";
import { slugify } from "@/lib/shared";
export async function GET(request:Request) {try{return json(await listLists(new URL(request.url).searchParams.get("cursor")));}catch(e){return errorResponse(e);}}
export async function POST(request:Request) {
  let release:(()=>Promise<void>)|undefined;
  try {
    const input=await body(request,listInput);const slug=slugify(input.name);
    if(slug.length<3)throw new AppError("The list name needs at least 3 English letters or numbers.");
    if(await listExists(slug))throw new AppError("A list with this URL already exists. Choose another name.",409);
    requireJev();await rateLimit(request,"list");release=await acquireLock(`list:${slug}`);
    if(await listExists(slug))throw new AppError("A list with this URL already exists. Choose another name.",409);
    const approved=await approveList({name:input.name,description:input.description,allowUrls:input.allowUrls});
    try{await database().prepare("INSERT INTO lists(id,slug,name,description,allow_urls,creator_handle,approval_id,model,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),slug,input.name,input.description,input.allowUrls===null?null:Number(input.allowUrls),input.creatorHandle||null,approved.id,approved.model,Date.now()).run();}
    catch(e){if(await listExists(slug))throw new AppError("Someone just created a list with this URL. Choose another name.",409);throw e;}
    return json({list:await getList(slug)},201);
  }catch(e){return errorResponse(e);}finally{if(release)await release().catch(()=>{});}
}
