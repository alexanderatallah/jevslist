"use client";
import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Check, CircleAlert, Cpu, Heart, Layers3, Loader2, MessageSquare, Plus, Sparkle, Type } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ListCardsSkeleton, ListDetailSkeleton, PageSkeleton, RankingSkeleton } from "@/components/loading-skeletons";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { type List, type Item, slugify, suggestions } from "@/lib/shared";
import { flushSync } from "react-dom";
import { registerPageTool } from "@/lib/webmcp";

function CategoryIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = /tweet|post/i.test(name) ? MessageSquare : /model|AI\b/i.test(name) ? Cpu : /word|language/i.test(name) ? Type : Layers3;
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}
async function jsonResponse(response: Response) {
  const data = await response.json() as { error?: string; lists: List[]; list: List; items: Item[]; nextCursor: string | null; available: boolean };
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
export type InitialPageData = { lists?: List[]; list?: List; items?: Item[]; nextCursor: string | null };
export function FavoriteThings({ slug, initialData }: { slug?: string; initialData?: InitialPageData }) {
  const [navigation, setNavigation] = useState<{ kind: "home" | "list"; list?: List } | null>(null);
  useEffect(() => { const reset = () => setNavigation(null); window.addEventListener("pageshow", reset); return () => window.removeEventListener("pageshow", reset); }, []);
  function showNavigation(event: MouseEvent<HTMLAnchorElement>, kind: "home" | "list", list?: List) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    flushSync(() => setNavigation({ kind, list }));
  }
  const [lists, setLists] = useState<List[]>(initialData?.lists ?? []);
  const [list, setList] = useState<List | null>(initialData?.list ?? null);
  const [items, setItems] = useState<Item[]>(initialData?.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initialData?.nextCursor ?? null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState({ name: "", description: "" });
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await jsonResponse(await fetch(slug ? `/api/lists/${encodeURIComponent(slug)}` : "/api/lists", { signal, cache: "no-store" }));
      if (slug) { setList(data.list); setItems(data.items); } else setLists(data.lists);
      setNextCursor(data.nextCursor); setError("");
    } catch (e) { if ((e as Error).name !== "AbortError") setError((e as Error).message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [slug]);
  useEffect(() => { if (initialData) { setLists(initialData.lists ?? []); setList(initialData.list ?? null); setItems(initialData.items ?? []); setNextCursor(initialData.nextCursor); setLoading(false); setNewItemId(null); return; } const controller = new AbortController(); setLoading(true); setList(null); setNewItemId(null); void refresh(controller.signal); return () => controller.abort(); }, [refresh, initialData]);
  useEffect(() => { document.title = list ? `${list.name} · Jevslist` : "Jevslist"; }, [list]);
  function newList(name = "", description = "") { setPreset({ name, description }); setOpen(true); }
  useEffect(() => registerPageTool({
    name: "start_list_creation", title: "Start a new list", description: "Open the New List dialog and optionally fill its name and description. Does not publish a list; the visitor submits it for Jev’s approval.",
    inputSchema: { type: "object", properties: { name: { type: "string", maxLength: 80 }, description: { type: "string", maxLength: 1000 } }, additionalProperties: false },
    async execute(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected an object.");
      const data = input as Record<string, unknown>;
      if (Object.keys(data).some(k => !["name", "description"].includes(k)) || (data.name !== undefined && (typeof data.name !== "string" || data.name.length > 80)) || (data.description !== undefined && (typeof data.description !== "string" || data.description.length > 1000))) throw new Error("Use a name up to 80 characters and description up to 1,000 characters.");
      setPreset({ name: (data.name as string) || "", description: (data.description as string) || "" }); setOpen(true);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { status: "dialog_open", submitted: false };
    },
  }), []);
  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const base = slug ? `/api/lists/${encodeURIComponent(slug)}` : "/api/lists";
      const data = await jsonResponse(await fetch(`${base}?cursor=${encodeURIComponent(nextCursor)}`));
      if (slug) setItems(current => [...current, ...data.items.filter((x: Item) => !current.some(i => i.id === x.id))]);
      else setLists(current => [...current, ...data.lists.filter((x: List) => !current.some(b => b.id === x.id))]);
      setNextCursor(data.nextCursor);
    } catch (e) { toast.error((e as Error).message); } finally { setLoadingMore(false); }
  }
  return <div className="site-shell">

    <main className={`main-container ${(navigation ? navigation.kind === "list" : !!slug) ? "list-view" : "home-view"}`} aria-busy={!!navigation || loading}>
      {navigation ? <PageSkeleton kind={navigation.kind} list={navigation.list} /> : !slug ? <>
        <section className="page-heading"><div><h1>Jevslist<span className="title-dot">.</span></h1><p><a className="jev-link" href="https://typesafe.ai/blog/introducing-system-one-models-and-jev" target="_blank" rel="noopener noreferrer">Jev</a>'s favorite things, submitted by you</p></div><button className="button primary new-list-button" onClick={() => newList()}><span>New list</span><span className="button-key"><Plus size={19} strokeWidth={1.6} /></span></button></section>
        <div className="section-heading"><h2>All lists <span className="count-label">{loading ? "" : lists.length}{nextCursor ? "+" : ""}</span></h2></div>
        {error ? <ErrorState message={error} retry={() => { setLoading(true); void refresh(); }} /> : loading ? <ListCardsSkeleton /> : lists.length ? <div className="list-grid">{lists.map((b, i) => <a href={`/lists/${encodeURIComponent(b.slug)}`} onClick={event => showNavigation(event, "list", b)} className="list-card" key={b.id} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
          <div className="card-top"><span className="card-index">{String(i + 1).padStart(2, "0")}</span><CategoryIcon name={b.name} size={18} /></div><h3>{b.name}</h3><p className="card-description">{b.description}</p>
          {b.topTitle ? <div className="card-favorite"><span className="favorite-caption"><Heart size={12} /> Jev’s top pick</span><div><span>{b.topTitle}</span><strong>{b.topScore?.toLocaleString()}</strong></div></div> : <div className="card-favorite card-favorite-empty">No items yet</div>}
          <div className="card-footer"><span><strong>{b.itemCount}</strong> {b.itemCount === 1 ? "thing" : "things"}</span><ArrowUpRight className="card-arrow" size={18} /></div>
        </a>)}</div> : <><div className="empty-intro"><h3>Every good collection starts with one thing.</h3><p>Create a list of your own, or start with an idea below.</p></div><div className="list-grid">{suggestions.map((s, i) => <button className="list-card suggestion-card" key={s.name} onClick={() => newList(s.name, s.description)} style={{ animationDelay: `${i * 50}ms` }}><div className="card-top"><span className="category-icon"><CategoryIcon name={s.name} /></span><span className="idea-label">LIST IDEA</span></div><h3>{s.name}</h3><p className="card-description">{s.description}</p><div className="suggestion-footer">Start this list <Plus size={17} /></div></button>)}</div></>}
      </> : <>
        <a className="back-link" href="/" onClick={event => showNavigation(event, "home")}><ArrowLeft size={16} /> All lists</a>
        {error ? <ErrorState message={error} retry={() => { setLoading(true); void refresh(); }} /> : loading ? <ListDetailSkeleton /> : list && <>
          <section className="list-heading"><div className="category-icon large"><CategoryIcon name={list.name} size={27} /></div><div className="list-title"><h1>{list.name}</h1><p>{list.description}</p><div className="list-byline"><span>{list.itemCount} {list.itemCount === 1 ? "thing" : "things"}</span></div></div></section>
          <ItemForm list={list} onAdded={async item => { setNewItemId(item.id); await refresh(); }} />
          <div className="section-heading ranking-heading"><h2>The ranking</h2><span className="score-heading">JEV’S SCORE <span>/ 1,000</span></span></div>
          {items.length ? <ol className="ranking-list">{items.map((item, i) => <li key={item.id} className={`rank-row ${i === 0 ? "first-place" : ""} ${item.id === newItemId ? "just-added" : ""}`}><span className="rank-number">{String(i + 1).padStart(2, "0")}</span><div className="item-body">{i === 0 && <span className="top-pick"><Heart size={12} fill="currentColor" /> JEV’S FAVORITE</span>}<h3>{item.title}</h3>{item.content !== item.title && <ItemContent content={item.content} />}{(item.sourceUrl || item.id === newItemId) && <div className="item-meta">{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.author ? item.author + " · " : ""}{item.sourceHost}<ArrowUpRight size={13} /></a> : null}{item.id === newItemId && <span className="new-label">Just added</span>}</div>}</div><div className="score-cell"><strong>{item.score.toLocaleString()}</strong><div className="score-track" aria-hidden="true"><span style={{ width: `${item.score / 10}%` }} /></div></div></li>)}</ol> : <Empty className="ranking-empty"><EmptyHeader><span className="empty-heart"><Heart size={29} strokeWidth={1.25} /></span><EmptyTitle>Jev hasn’t picked a favorite. Yet.</EmptyTitle><EmptyDescription>Submit the first thing and give this list a beginning.</EmptyDescription></EmptyHeader></Empty>}
          <div className="ranking-footnote"><Sparkle size={15} /><p>Every score is Jev’s own opinion. <span>0 is the least favorite; 1,000 is the absolute favorite.</span></p></div>
        </>}
      </>}
      {!navigation && loadingMore && (slug ? <RankingSkeleton count={2} /> : <ListCardsSkeleton count={2} />)}
      {!navigation && nextCursor && !loading && !error && <div className="load-more"><button className="button secondary" disabled={loadingMore} onClick={loadMore}>Show more {slug ? "things" : "lists"}</button></div>}
    </main>
    <footer className="site-footer"><a className="powered-link" href="https://x.com/alexatallah" target="_blank" rel="noopener noreferrer">Made by Alex<ArrowUpRight size={14} aria-hidden="true" /></a><a className="powered-link" href="https://github.com/alexanderatallah/jevslist" target="_blank" rel="noopener noreferrer">Source code<ArrowUpRight size={14} aria-hidden="true" /></a><a className="powered-link" href="https://openrouter.ai/typesafe/jev-1.13" target="_blank" rel="noopener noreferrer">Powered by Jev on OpenRouter<ArrowUpRight size={14} aria-hidden="true" /></a></footer>
    <NewListModal open={open} onOpenChange={setOpen} preset={preset} /><Toaster theme="dark" position="bottom-right" />
  </div>;
}
function ItemContent({ content }: { content: string }) {
  if (content.length <= 320) return <p className="item-content">{content}</p>;
  return <details className="item-details"><summary>{content.slice(0, 240)}… <span>Read more</span></summary><p className="item-content">{content}</p></details>;
}
function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <Empty className="error-state"><EmptyHeader><CircleAlert size={24} /><EmptyTitle>We couldn’t load this collection</EmptyTitle><EmptyDescription>{message}</EmptyDescription></EmptyHeader><button className="button secondary" onClick={retry}>Try again</button></Empty>;
}
function NewListModal({ open, onOpenChange, preset }: { open: boolean; onOpenChange: (v: boolean) => void; preset: { name: string; description: string } }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [handle, setHandle] = useState("");
  const [availability, setAvailability] = useState<{ slug: string; status: "checking" | "available" | "taken" | "error" }>({ slug: "", status: "checking" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const slug = slugify(name);
  useEffect(() => { if (open) { setName(preset.name); setDescription(preset.description); setHandle(""); setError(""); setAvailability({ slug: "", status: "checking" }); } }, [open, preset]);
  useEffect(() => {
    if (!open || slug.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAvailability({ slug, status: "checking" });
      try { const data = await jsonResponse(await fetch(`/api/lists/check?slug=${encodeURIComponent(slug)}`, { signal: controller.signal, cache: "no-store" })); setAvailability({ slug, status: data.available ? "available" : "taken" }); }
      catch (e) { if ((e as Error).name !== "AbortError") setAvailability({ slug, status: "error" }); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [slug, open]);
  const available = availability.slug === slug && availability.status === "available";
  const status = availability.slug === slug ? availability.status : "checking";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!available || submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const data = await jsonResponse(await fetch("/api/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description, creatorHandle: handle }) }));
      onOpenChange(false); toast.success("Jev approved. Your list is ready."); window.location.assign(`/lists/${encodeURIComponent(data.list.slug)}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); submitting.current = false; }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}><DialogContent className="new-list-dialog" showCloseButton={!busy} onInteractOutside={event => { if (busy) event.preventDefault(); }}><DialogHeader><DialogTitle>New list<span className="title-dot">.</span></DialogTitle><DialogDescription>Start a public list. Jev will take care of the ranking.</DialogDescription></DialogHeader><form onSubmit={submit} className="list-form">
    <div className="form-field"><label htmlFor="list-name">List name</label><input id="list-name" value={name} onChange={e => { setName(e.target.value); setError(""); }} placeholder="e.g. Favorite Words" minLength={3} maxLength={80} required disabled={busy} autoComplete="off" /><div className={`slug-preview ${status === "taken" ? "has-error" : ""}`} aria-live="polite">{slug.length >= 3 ? <><span>/lists/{slug}</span>{status === "checking" ? <Loader2 size={13} className="spin" /> : status === "available" ? <Check size={14} /> : status === "taken" ? <span>Already taken</span> : <span>Couldn’t check. Try changing the name.</span>}</> : <span>A unique link, made from your list’s name.</span>}</div></div>
    <div className="form-field"><label htmlFor="list-description">What belongs here?</label><textarea id="list-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the collection so Jev knows what fits." minLength={12} maxLength={1000} rows={3} required disabled={busy} /><span className="field-hint">A clear definition helps Jev make better decisions.</span></div>
    <div className="form-field"><label htmlFor="creator-handle">Your X handle <span>optional</span></label><div className="handle-input"><span>@</span><input id="creator-handle" value={handle} onChange={e => setHandle(e.target.value.replace(/^@/, ""))} placeholder="yourhandle" maxLength={15} pattern="[A-Za-z0-9_]{1,15}" title="Use 1–15 letters, numbers, or underscores." disabled={busy} autoComplete="off" /></div><span className="field-hint">Stored privately; never shown publicly. No sign-in needed.</span></div>
    {error && <div role="alert" className="form-error"><CircleAlert size={17} /><span>{error}</span></div>}
    <div className="modal-submit"><span><Sparkle size={15} /> A quick approval from Jev before it goes live.</span><button className="button primary" type="submit" disabled={busy || !available || description.trim().length < 12}>{busy ? <><Loader2 className="spin" size={17} /> Asking Jev…</> : <>Create list <ArrowRight size={17} /></>}</button></div>
  </form></DialogContent></Dialog>;
}
function ItemForm({ list, onAdded }: { list: List; onAdded: (item: Item) => Promise<void> }) {
  const [value, setValue] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [stage, setStage] = useState("");
  const input = useRef<HTMLInputElement>(null); const submitting = useRef(false);
  useEffect(() => registerPageTool({
    name: "stage_item_submission", title: "Prepare a list item", description: "Fill the submission field on the current list. Does not send or score it; the visitor submits it to Jev.",
    inputSchema: { type: "object", properties: { item: { type: "string", minLength: 1, maxLength: 4000 } }, required: ["item"], additionalProperties: false },
    async execute(data) {
      if (submitting.current) throw new Error("A submission is already in progress.");
      if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).some(k => k !== "item")) throw new Error("Expected an item.");
      const item = (data as { item?: unknown }).item;
      if (typeof item !== "string" || !item.trim() || item.length > 4000) throw new Error("Use 1–4,000 characters.");
      setValue(item); setError("");
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      input.current?.focus(); return { status: "staged", list: list.slug, submitted: false };
    },
  }), [list.slug]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!value.trim() || submitting.current) return;
    submitting.current = true; setBusy(true); setError(""); setStage("Checking for duplicates…");
    let saved = false;
    try {
      const response = await fetch(`/api/lists/${encodeURIComponent(list.slug)}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: value }) });
      if (!response.ok) { await jsonResponse(response); return; }
      if (!response.body) throw new Error("The connection was interrupted. Please try again.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { value: bytes, done } = await reader.read(); buffer += decoder.decode(bytes, { stream: !done });
        const lines = buffer.split("\n"); buffer = lines.pop() || ""; if (done && buffer.trim()) lines.push(buffer);
        for (const line of lines) {
          if (!line.trim()) continue; const message = JSON.parse(line);
          if (message.error) throw new Error(message.error); if (message.stage) setStage(message.stage);
          if (message.item) { saved = true; setValue(""); await onAdded(message.item); toast.success(`Added to the list. Jev’s score: ${message.item.score.toLocaleString()} / 1,000.`); }
        }
        if (done) break;
      }
      if (!saved) throw new Error("The connection was interrupted. Please refresh the list before trying again.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); submitting.current = false; setTimeout(() => input.current?.focus(), 50); }
  }
  return <section className={`submission-section ${busy ? "is-thinking" : ""}`}><form onSubmit={submit}><label htmlFor="new-item">Have something Jev might love?</label><div className="submission-input"><input ref={input} id="new-item" value={value} onChange={e => { setValue(e.target.value); setError(""); }} placeholder="Paste a link or write your favorite thing…" maxLength={4000} required disabled={busy} autoComplete="off" /><button type="submit" className="submit-item-button" disabled={busy || !value.trim()} aria-label="Submit item for Jev to rank">{busy ? <Loader2 className="spin" size={19} /> : <ArrowUp size={20} />}</button></div><div className="submission-help" role="status">{busy ? <><Sparkle size={14} className="thinking-icon" />{stage}</> : <><span>Anyone can submit.</span> Jev checks the fit, then scores it from 0 to 1,000.</>}</div>{error && <div className="form-error" role="alert"><CircleAlert size={17} /><span>{error}</span></div>}</form></section>;
}
