import { acquireLock, database, duplicate, getList, rateLimit } from "@/db/queries";
import { AppError, errorResponse, publicError } from "@/lib/errors";
import { body, itemInput } from "@/lib/http";
import { approveItem, enforceUrlPolicy, requireJev, scoreItem, type ItemValidationState } from "@/lib/jev";
import { extractContent } from "@/lib/content";
import { hash, inputUrl, normalizeText, submissionHash } from "@/lib/normalization";
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}) {
  let release:(()=>Promise<void>)|undefined;
  try {
    const {slug}=await params;const list=await getList(slug);if(!list)throw new AppError("This list could not be found.",404);
    const {item:input}=await body(request,itemInput);const url=inputUrl(input);enforceUrlPolicy(list.allowUrls,url);const inputHash=await submissionHash(input,url);
    if(await duplicate(list.id,inputHash))throw new AppError("This thing is already on the list. Take a look at its score below.",409);
    requireJev();await rateLimit(request,"item");release=await acquireLock(`item:${list.id}:${inputHash}`);
    const unlock=release;
    const stream=new ReadableStream({async start(controller){
      const encoder=new TextEncoder();let connected=true;
      const send=(data:unknown)=>{if(connected){try{controller.enqueue(encoder.encode(JSON.stringify(data)+"\n"));}catch{connected=false;}}};
      try {
        if(await duplicate(list.id,inputHash))throw new AppError("This thing is already on the list.",409);
        send({stage:url?"Reading the link…":"Checking whether it belongs…"});
        const content=await extractContent(input,url);const contentHash=await hash(normalizeText(content.content));
        if(await duplicate(list.id,inputHash,contentHash))throw new AppError("We’ve already seen this content on this list, even if the link is different.",409);
        send({stage:"Asking Jev if it belongs…"});
        const state:ItemValidationState={list:{name:list.name,description:list.description,allowUrls:list.allowUrls},submission:{input,kind:url?"url":"text",url:url?.toString()??null},item:content};
        const approved=await approveItem(state);
        send({stage:"It belongs. Jev is giving it a score…"});
        const scored=await scoreItem(state);const id=crypto.randomUUID();const createdAt=Date.now();
        try{await database().prepare("INSERT INTO list_items(id,list_id,submission_hash,content_hash,title,content,source_url,source_host,author,score,raw_score,approval_id,score_id,model,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,list.id,inputHash,contentHash,content.title,content.content,content.sourceUrl,content.sourceHost,content.author,scored.score,String(scored.rawScore),approved.id,scored.id,scored.model,createdAt).run();}
        catch(e){if(await duplicate(list.id,inputHash,contentHash))throw new AppError("Someone just added this same thing. Refresh to see its score.",409);throw e;}
        send({item:{id,...content,score:scored.score,createdAt}});
      }catch(e){const error=publicError(e);send({error:error.message,status:error.status});}
      finally{await unlock().catch(()=>{});try{controller.close();}catch{}}
    }});
    return new Response(stream,{headers:{"Content-Type":"application/x-ndjson; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }catch(e){if(release)await release().catch(()=>{});return errorResponse(e);}
}
