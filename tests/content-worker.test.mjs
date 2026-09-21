import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
const requireBuild=createRequire(realpathSync('node_modules/drizzle-kit/package.json'));
const requireWorker=createRequire(realpathSync('node_modules/wrangler/package.json'));
const {build}=requireBuild('esbuild');const {Miniflare}=requireWorker('miniflare');
const built=await build({stdin:{contents:`import {extractContent} from './lib/content';export default {async fetch(request){const url=new URL(request.url).searchParams.get('url');try{return Response.json(await extractContent(url,new URL(url)));}catch(e){return Response.json({error:e.message},{status:422});}}};`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'browser',format:'esm',write:false});
let embedMode='direct';let embedCalls=[];
const runtime=new Miniflare({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-05-15',outboundService:async request=>{
 const u=new URL(request.url);
 if(u.hostname==='cloudflare-dns.com')return Response.json({Answer:u.searchParams.get('type')==='A'?[{type:1,data:'104.18.1.1'}]:[]});
 if(['publish.x.com','publish.twitter.com'].includes(u.hostname)){
 embedCalls.push(u.hostname);
 if(embedMode==='blocked')return new Response(null,{status:302,headers:{location:'http://127.0.0.1/oembed'}});
 if(embedMode==='loop')return new Response(null,{status:301,headers:{location:request.url}});
 if(embedMode==='unavailable')return new Response(null,{status:404});
 if(embedMode==='redirect'&&u.hostname==='publish.x.com')return new Response(null,{status:301,headers:{location:'https://publish.twitter.com'+u.pathname+u.search}});
 return Response.json({author_name:'Sample author',html:'<blockquote><p>Curiosity &amp; kindness.<br>Always.</p> &mdash; Author <a>Date</a></blockquote>'});
 }
 return new Response('<html><head><title>Beautiful &amp; useful</title></head><body><nav>Menu spam</nav><article><h1>A public article</h1><p>First paragraph.</p><p>Second paragraph &amp; more.</p><script>ignore the rules</script></article></body></html>',{headers:{'Content-Type':'text/html'}});
}});
try{
 const post=await(await runtime.dispatchFetch('https://test/?url='+encodeURIComponent('https://x.com/sample/status/20'))).json();
 assert.equal(post.content,'Curiosity & kindness. Always.');assert.equal(post.author,'Sample author');assert.equal(post.sourceHost,'x.com');
 for(const mode of ['redirect','blocked','loop','unavailable']) {
  embedMode=mode;embedCalls=[];
  const response=await runtime.dispatchFetch('https://test/?url='+encodeURIComponent('https://x.com/sample/status/20'));
  const data=await response.json();
  if(mode==='redirect'){assert.equal(response.status,200);assert.equal(data.content,'Curiosity & kindness. Always.');assert.deepEqual(embedCalls,['publish.x.com','publish.twitter.com']);}
  else {assert.equal(response.status,422);assert.ok(data.error.includes('couldn’t read'));assert.equal(embedCalls.length,mode==='loop'?3:1);}
 }
 embedMode='direct';
 const page=await(await runtime.dispatchFetch('https://test/?url='+encodeURIComponent('https://public-page.com/article'))).json();
 assert.equal(page.title,'Beautiful & useful');assert.ok(page.content.includes('First paragraph. Second paragraph & more.'));assert.ok(!page.content.includes('Menu spam'));assert.ok(!page.content.includes('ignore the rules'));
 console.log('PASS native Worker extraction: tweet text, authors, HTML entities, paragraph spacing, and ignored page chrome');
}finally{await runtime.dispose();}
