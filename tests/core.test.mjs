// Real route handlers + SQLite, with controlled upstream Decisions responses.
// No external API calls, fake scores, or test records reach production.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(realpathSync(new URL('../node_modules/drizzle-kit/package.json',import.meta.url)));
const { build } = require('esbuild');
await mkdir('.sites-runtime',{recursive:true});
await build({ entryPoints:['tests/entry.ts'],outfile:'.sites-runtime/test-app.mjs',bundle:true,platform:'node',format:'esm',packages:'external',external:[resolve('tests/runtime.mjs')],plugins:[{name:'test-worker',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'worker',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export {env} from ${JSON.stringify(resolve('tests/runtime.mjs'))}`,loader:'js'}));}}]});
// runtime.mjs uses import.meta.url, so keep it external and shared.

const app = await import('../.sites-runtime/test-app.mjs');
const {env,sqlite} = await import('./runtime.mjs');
const request = (path,data,ip='198.41.0.1',extra={}) => new Request(`https://jev.test${path}`,{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':ip,...extra},body:JSON.stringify(data)});
const context={params:Promise.resolve({slug:'favorite-words'})};
let upstream=[];let calls=[];
globalThis.fetch=async (url,options={})=>{calls.push({url:String(url),body:options.body?JSON.parse(options.body):null,headers:options.headers});const next=upstream.shift();assert.ok(next,'Unexpected upstream call');if(typeof next==='function')return next(url,options);return Response.json(next);};
const choice=(value='yes')=>({id:'approval-test',model:'typesafe/jev-test',answers:{decision:{type:'choice',choice:value}}});
const score=value=>({id:'score-test',model:'typesafe/jev-test',answers:{decision:{type:'score',score:value}}});
let count=0;const test=async(name,fn)=>{upstream=[];calls=[];await fn();assert.equal(upstream.length,0,'Unused upstream response');console.log(`PASS ${name}`);count++;};
const events=async response=>(await response.text()).trim().split('\n').filter(Boolean).map(JSON.parse);
const countItems=()=>sqlite.prepare('SELECT COUNT(*) n FROM list_items').get().n;
await test('slugification and canonical X / tracking link duplicates',async()=>{
 assert.equal(app.slugify('Jév’s Favorite Words!'),'jevs-favorite-words');
 assert.equal(await app.submissionHash('',new URL('https://twitter.com/alex/status/12345?s=20')),await app.submissionHash('',new URL('https://x.com/someone/status/12345/photo/1')));
 assert.equal(await app.submissionHash('',new URL('https://www.openrouter.ai/models/?utm_source=x')),await app.submissionHash('',new URL('http://openrouter.ai/models')));
 assert.equal(app.normalizeText('  HELLO  world  '),'hello world');
});
await test('private and unsafe URL forms are rejected',async()=>{for(const url of ['http://127.0.0.1','http://2130706433','http://[::1]/','http://10.0.0.1','file:///etc/passwd','https://user:pass@site.com','https://metadata.google.internal/'])assert.throws(()=>app.inputUrl(url));});
await test('missing key never creates a list',async()=>{env.OPENROUTER_API_KEY='';const r=await app.createList(request('/api/lists',{name:'Favorite Words',description:'English words with beautiful sounds.'}));assert.equal(r.status,503);assert.equal(calls.length,0);env.OPENROUTER_API_KEY='test-only-placeholder';});
await test('rejected list is never persisted',async()=>{upstream=[choice('needs_a_better_definition')];const r=await app.createList(request('/api/lists',{name:'Vague Things',description:'There are some things in here.'}));assert.equal(r.status,422);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM lists').get().n,0);});
await test('approved list persists and slug availability changes',async()=>{upstream=[choice()];const r=await app.createList(request('/api/lists',{name:'Favorite Words',description:'English words with beautiful sounds.',creatorHandle:'@alex'}));assert.equal(r.status,201);assert.equal(Object.hasOwn((await r.json()).list,'creatorHandle'),false);assert.equal(sqlite.prepare('SELECT creator_handle FROM lists WHERE slug=?').get('favorite-words').creator_handle,'alex');const detail=await app.readList(new Request('https://jev.test/api/lists/favorite-words'),context);assert.equal(Object.hasOwn((await detail.json()).list,'creatorHandle'),false);const check=await app.checkSlug(new Request('https://jev.test/api/lists/check?slug=favorite-words'));assert.equal((await check.json()).available,false);});
await test('duplicate slug is rejected without an AI call',async()=>{const r=await app.createList(request('/api/lists',{name:'Favorite Words!',description:'English words with beautiful sounds.'}));assert.equal(r.status,409);assert.equal(calls.length,0);});
await test('rejected item makes no scoring call and leaves no item',async()=>{upstream=[choice('irrelevant_for_this_category')];const result=await events(await app.submitItem(request('/api/lists/favorite-words/items',{item:'a car'}),context));assert.equal(result.at(-1).status,422);assert.equal(calls.length,1);assert.equal(countItems(),0);});
await test('approved item gets a separate score and is persisted',async()=>{upstream=[choice(),score(.824)];const result=await events(await app.submitItem(request('/api/lists/favorite-words/items',{item:'Serendipity'}),context));assert.equal(result.at(-1).item.score,824);assert.equal(calls.length,2);assert.equal(calls[0].body.questions.decision.type,'choice');assert.equal(calls[1].body.questions.decision.type,'score');assert.equal(calls[1].body.state.list.description,'English words with beautiful sounds.');});
await test('normalized duplicate text is rejected before calling Jev',async()=>{const r=await app.submitItem(request('/api/lists/favorite-words/items',{item:'  SERENDIPITY  '}),context);assert.equal(r.status,409);assert.equal(calls.length,0);});
await test('score of 0 and 1000 are valid; ordering is descending',async()=>{for(const [word,n]of [['Dull',0],['Luminous',1]]){upstream.push(choice(),score(n));const rows=await events(await app.submitItem(request('/api/lists/favorite-words/items',{item:word}),context));assert.equal(rows.at(-1).item.score,n*1000);}const r=await app.readList(new Request('https://jev.test/api/lists/favorite-words'),context);assert.deepEqual((await r.json()).items.map(i=>i.score),[1000,824,0]);});
await test('invalid AI score fails closed, with no persistence',async()=>{const before=countItems();upstream=[choice(),score(1.2)];const result=await events(await app.submitItem(request('/api/lists/favorite-words/items',{item:'Petrichor'}),context));assert.equal(result.at(-1).status,502);assert.equal(countItems(),before);});
await test('malformed choice fails closed',async()=>{upstream=[choice('maybe')];const result=await events(await app.submitItem(request('/api/lists/favorite-words/items',{item:'Petrichor'}),context));assert.equal(result.at(-1).status,502);assert.equal(calls.length,1);});
await test('simultaneous identical items make only one pair of AI calls',async()=>{upstream=[choice(),score(.71)];const results=await Promise.all([app.submitItem(request('/api/lists/favorite-words/items',{item:'Mellifluous'}),context),app.submitItem(request('/api/lists/favorite-words/items',{item:'Mellifluous'}),context)]);assert.equal(results.filter(r=>r.status===409).length,1);await Promise.all(results.map(r=>r.text()));assert.equal(calls.length,2);});
await test('private DNS answer and redirect are rejected before content fetch',async()=>{upstream=[{Answer:[{type:1,data:'127.0.0.1'}]},{Answer:[]}];await assert.rejects(()=>app.extractContent('https://public-looking.com',new URL('https://public-looking.com')),/public page/);assert.equal(calls.length,2);});
await test('redirect targets are revalidated',async()=>{upstream=[{Answer:[{type:1,data:'104.18.1.1'}]},{Answer:[]},()=>new Response(null,{status:302,headers:{location:'http://169.254.169.254/latest/meta-data/'}})];await assert.rejects(()=>app.extractContent('https://public-looking.com',new URL('https://public-looking.com')),/public HTTP/);assert.equal(calls.length,3);});
await test('cross-site requests and malformed handles rejected before inference',async()=>{assert.equal((await app.createList(request('/api/lists',{name:'Favorite Games',description:'Favorite video games.',creatorHandle:'../../admin'}))).status,400);assert.equal((await app.createList(request('/api/lists',{name:'Favorite Games',description:'Favorite video games.'},'198.41.0.1',{Origin:'https://evil.test'}))).status,403);assert.equal(calls.length,0);});
await test('hourly anonymous rate limit blocks further inference',async()=>{sqlite.prepare("INSERT INTO rate_limits(key,count,expires_at) SELECT 'all:never',1001,? ").run(Date.now()+1000);for(let i=0;i<8;i++){upstream.push(choice('nonsense'));await app.createList(request('/api/lists',{name:`Bad List ${i}`,description:'A collection of random content.'},'198.41.0.88'));}const r=await app.createList(request('/api/lists',{name:'Blocked List',description:'A collection of random content.'},'198.41.0.88'));assert.equal(r.status,429);assert.equal(calls.length,8);});
await test('lists sort by item count with stable pagination through ties',async()=>{
 for(let i=0;i<50;i++)sqlite.prepare('INSERT INTO lists(id,slug,name,description,approval_id,model,created_at) VALUES(?,?,?,?,?,?,?)').run(`page-${i}`,`page-${i}`,`List ${i}`,'Test category','test','test',2000000000000);
 const first=await(await app.lists(new Request('https://jev.test/api/lists'))).json();
 assert.equal(first.lists[0].slug,'favorite-words');assert.ok(first.lists[0].itemCount>0);assert.equal(first.lists.length,48);assert.ok(first.nextCursor);
 const second=await(await app.lists(new Request('https://jev.test/api/lists?cursor='+encodeURIComponent(first.nextCursor)))).json();
 const actual=[...first.lists,...second.lists].map(b=>b.id);
 const expected=sqlite.prepare('SELECT b.id FROM lists b ORDER BY (SELECT COUNT(*) FROM list_items i WHERE i.list_id=b.id) DESC,b.created_at DESC,b.id DESC').all().map(b=>b.id);
 assert.deepEqual(actual,expected);assert.equal(second.nextCursor,null);
});
console.log(`\n${count} tests passed. No live model calls were made.`);
