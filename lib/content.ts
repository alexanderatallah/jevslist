import { AppError } from "./errors";
import { canonicalUrl, tweetId, validateUrl } from "./normalization";
export type Content = { title:string; content:string; sourceUrl:string|null; sourceHost:string|null; author:string|null };
const MAX_BYTES=1000000;
async function limitedText(response:Response, limit=MAX_BYTES) {
  if (Number(response.headers.get("content-length"))>limit) {await response.body?.cancel();throw new AppError("This page is too large. Please paste the relevant text instead.",422);}
  const reader=response.body?.getReader(); if(!reader) throw new AppError("That page has no readable content.",422);
  const decoder=new TextDecoder(); let length=0; let output="";
  try { while(true) {const {value,done}=await reader.read(); if(done) break;length+=value.byteLength;if(length>limit){await reader.cancel();throw new AppError("This page is too large. Please paste the relevant text instead.",422);}output+=decoder.decode(value,{stream:true});}return output+decoder.decode(); }finally{reader.releaseLock();}
}
function publicAddress(ip:string) {
  if(ip.includes(":")) {const v=ip.toLowerCase();return /^2[0-9a-f]{3}:|^3[0-9a-f]{3}:/.test(v) && !v.startsWith("2001:db8:") && !v.startsWith("2001:0:") && !v.startsWith("2002:");}
  const parts=ip.split(".").map(Number); if(parts.length!==4||parts.some(x=>!Number.isInteger(x)||x<0||x>255))return false;
  const [a,b]=parts;return a!==0&&a!==10&&a!==127&&a<224&&!(a===169&&b===254)&&!(a===172&&b>=16&&b<=31)&&!(a===192&&(b===168||b===0||b===2))&&!(a===100&&b>=64&&b<=127)&&!(a===198&&(b===18||b===19||b===51))&&!(a===203&&b===0);
}
async function assertPublicDns(url:URL) {
  validateUrl(url);
  // Check both address families before each redirect. Workers fetch cannot access
  // private networks; this is an additional fail-closed guard for untrusted URLs.
  const responses=await Promise.all(["A","AAAA"].map(async type=>{
    const r=await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(url.hostname)}&type=${type}`,{headers:{Accept:"application/dns-json"},signal:AbortSignal.timeout(7000)});
    if(!r.ok)throw new AppError("We couldn’t verify this link. Please try another public URL.",422);
    return r.json() as Promise<{Status?:number;Answer?:{type:number;data:string}[]}>;
  }));
  const addresses=responses.flatMap(r=>(r.Answer||[]).filter(a=>a.type===1||a.type===28).map(a=>a.data));
  if(!addresses.length||addresses.some(ip=>!publicAddress(ip)))throw new AppError("This link doesn’t point to an accessible public page.",422);
}
async function fetchPublic(initial:URL) {
  let url=initial;
  for(let i=0;i<5;i++) {
    await assertPublicDns(url);
    const response=await fetch(url.toString(),{redirect:"manual",headers:{Accept:"text/html, text/plain;q=0.9, application/json;q=0.8","User-Agent":"Jevslist/1.0 (public page reader)"},signal:AbortSignal.timeout(12000)});
    if([301,302,303,307,308].includes(response.status)) { const location=response.headers.get("location");await response.body?.cancel();if(!location)break;url=validateUrl(new URL(location,url));continue;}
    if(!response.ok){await response.body?.cancel();throw new AppError("We couldn’t read that page. It may be private, deleted, or blocking access. Try another link or paste the content.",422);}
    return {response,url};
  }
  throw new AppError("That link redirects too many times. Try the final page’s URL.",422);
}
const clean=(value:string)=>value.replace(/\s+/g," ").trim();
function decodeEntities(value:string) {
  const named:Record<string,string>={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",mdash:"—",ndash:"–",hellip:"…",lsquo:"‘",rsquo:"’",ldquo:"“",rdquo:"”"};
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|mdash|ndash|hellip|lsquo|rsquo|ldquo|rdquo);/gi,(all,key:string)=>{
    if(!key.startsWith("#"))return named[key.toLowerCase()]??all;
    const point=key.toLowerCase().startsWith("#x")?parseInt(key.slice(2),16):Number(key.slice(1));
    return point>0&&point<=0x10ffff?String.fromCodePoint(point):"";
  });
}
async function htmlText(html:string, selector="body") {
  const cleaned=await new HTMLRewriter().on("script,style,noscript,nav,header,footer,aside,form,svg,[hidden],[aria-hidden='true']",{element(e){e.remove();}}).on("p,div,li,br,h1,h2,h3,blockquote",{element(e){e.before(" ");e.after(" ");}}).transform(new Response(html)).text();
  let text="";
  await new HTMLRewriter().on(selector,{text(t){if(text.length<40000)text+=t.text;},element(e){if(["p","div","li","br","h1","h2","h3","blockquote"].includes(e.tagName))text+="\n";}}).transform(new Response(cleaned)).text();
  return clean(decodeEntities(text));
}
async function fetchTweetEmbed(id:string):Promise<Response> {
  let endpoint=new URL("https://publish.x.com/oembed");
  endpoint.search=new URLSearchParams({url:`https://twitter.com/i/status/${id}`,omit_script:"true",dnt:"true"}).toString();
  for(let attempt=0;attempt<3;attempt++) {
    const response=await fetch(endpoint.toString(),{headers:{Accept:"application/json"},redirect:"manual",signal:AbortSignal.timeout(12000)});
    if([301,302,303,307,308].includes(response.status)) {
      const location=response.headers.get("location");
      await response.body?.cancel();
      if(!location)break;
      const next=new URL(location,endpoint);
      // X moved its embed service from twitter.com to x.com. Follow only
      // known public embed hosts, never an arbitrary redirect destination.
      if(next.protocol!=="https:" || next.username || next.password || next.port || !["publish.x.com","publish.twitter.com"].includes(next.hostname) || next.pathname!=="/oembed")break;
      endpoint=next;
      continue;
    }
    if(response.ok)return response;
    await response.body?.cancel();
    break;
  }
  throw new AppError("We couldn’t read this post on X. It may be private or unavailable. Try another public post, or paste its text.",422);
}
async function readTweet(url:URL,id:string):Promise<Content> {
  const source=`https://x.com/i/status/${id}`;
  const response=await fetchTweetEmbed(id);
  const text=await limitedText(response,150000);
  let data:{html?:string;author_name?:string;author_url?:string};try{data=JSON.parse(text);}catch{throw new AppError("X didn’t return readable content for that post.",422);}
  if(typeof data.html!=="string")throw new AppError("X didn’t return the text of this post.",422);
  const content=await htmlText(data.html,"p");
  if(content.length<2)throw new AppError("This post has no readable text. Try a post with text.",422);
  const author=typeof data.author_name==="string"?data.author_name.slice(0,120):null;
  return {title:content.length<=180?content:content.slice(0,177)+"…",content:content.slice(0,12000),sourceUrl:source,sourceHost:"x.com",author};
}
export async function extractContent(input:string,url:URL|null):Promise<Content> {
  if(!url)return {title:input.length<=180?input:input.slice(0,177)+"…",content:input,sourceUrl:null,sourceHost:null,author:null};
  try {
    const id=tweetId(url);if(id)return await readTweet(url,id);
    const {response,url:finalUrl}=await fetchPublic(url);
    const finalTweet=tweetId(finalUrl);if(finalTweet){await response.body?.cancel();return await readTweet(finalUrl,finalTweet);}
    const type=response.headers.get("Content-Type")?.toLowerCase()||"";
    if(!type.includes("text/html")&&!type.includes("text/plain")&&!type.includes("application/json")){await response.body?.cancel();throw new AppError("Jev reads text and web pages. Please paste the text from this file instead.",422);}
    const source=await limitedText(response);let title="",description="",content="";
    if(type.includes("text/html")){
      await new HTMLRewriter().on("title",{text(t){title+=t.text;}}).on("meta[property='og:title']",{element(e){title=e.getAttribute("content")||title;}}).on("meta[name='description'],meta[property='og:description']",{element(e){description=e.getAttribute("content")||description;}}).transform(new Response(source)).text();
      const main=await htmlText(source,"article,main,[role='main']");
      content=main.length>=40?main:await htmlText(source);
      title=clean(decodeEntities(title));description=clean(decodeEntities(description));
      if(/^(just a moment|access denied|attention required|verify you are human|sign in|log in|page not found|404)/i.test(title)||content.length<30)throw new AppError("That page doesn’t expose enough readable text. Paste the relevant content instead.",422);
      content=clean([description,content].filter(Boolean).join("\n\n")).slice(0,12000);
    }else{content=clean(source).slice(0,12000);title=content.slice(0,120);}
    if(!content)throw new AppError("That page has no readable content.",422);
    return {title:(title||finalUrl.hostname).slice(0,250),content,sourceUrl:canonicalUrl(finalUrl),sourceHost:finalUrl.hostname.replace(/^www\./,""),author:null};
  }catch(error){if(error instanceof AppError)throw error;throw new AppError("We couldn’t read that link right now. Please try again or paste the item as text.",422);}
}
