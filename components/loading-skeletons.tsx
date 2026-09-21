import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { List } from "@/lib/shared";

type ListPreview = Pick<List, "name" | "description" | "itemCount">;

export function ListCardsSkeleton({ count = 3 }: { count?: number }) {
  return <div className="list-grid skeleton-grid" role="status" aria-label="Loading lists">
    {Array.from({ length: count }, (_, i) => <div className="list-card skeleton-surface skeleton-card" key={i} aria-hidden="true">
      <div className="card-top"><Skeleton className="sk-index" /><Skeleton className="sk-icon-small" /></div>
      <Skeleton className={`sk-card-title sk-title-${i % 2}`} />
      <Skeleton className="sk-description" />
      <div className="card-favorite"><Skeleton className="sk-caption" /><div><Skeleton className="sk-pick" /><Skeleton className="sk-score-small" /></div></div>
      <div className="card-footer"><Skeleton className="sk-count" /><Skeleton className="sk-icon-small" /></div>
    </div>)}
  </div>;
}

export function RankingSkeleton({ count = 3, favorite = false }: { count?: number; favorite?: boolean }) {
  return <div className="skeleton-ranking" role="status" aria-label="Loading rankings">
    {Array.from({ length: count }, (_, i) => <div className={`rank-row skeleton-surface skeleton-row ${favorite && i === 0 ? "first-place" : ""}`} key={i} aria-hidden="true">
      <div className="rank-number"><Skeleton className="sk-rank" /></div>
      <div className="item-body">
        {favorite && i === 0 && <Skeleton className="sk-caption sk-favorite" />}
        <Skeleton className={`sk-item-title sk-title-${i % 2}`} /><Skeleton className={`sk-item-line sk-line-${i % 2}`} />
        <Skeleton className="sk-source" />
      </div>
      <div className="score-cell"><Skeleton className="sk-score" /><Skeleton className="sk-score-track" /></div>
    </div>)}
  </div>;
}

export function ListDetailSkeleton({ list }: { list?: ListPreview }) {
  return <div className="list-detail-skeleton" role="status" aria-label="Loading list">
    <section className="list-heading">
      <Skeleton className="sk-category" aria-hidden="true" />
      <div className="list-title">
        {list ? <><h1>{list.name}</h1><p>{list.description}</p><div className="list-byline">{list.itemCount} {list.itemCount === 1 ? "thing" : "things"}</div></> : <div className="skeleton-surface sk-heading-lines" aria-hidden="true"><Skeleton className="sk-page-title" /><Skeleton className="sk-description" /><Skeleton className="sk-count" /></div>}
      </div>
    </section>
    <div className="submission-section skeleton-surface skeleton-submission" aria-hidden="true"><Skeleton className="sk-form-label" /><div className="sk-input"><Skeleton className="sk-input-text" /><Skeleton className="sk-submit" /></div><Skeleton className="sk-help" /></div>
    <div className="section-heading ranking-heading"><h2>The ranking</h2><span className="score-heading">JEV’S SCORE <span>/ 1,000</span></span></div>
    <RankingSkeleton favorite />
  </div>;
}

export function PageSkeleton({ kind, list }: { kind: "home" | "list"; list?: ListPreview }) {
  if (kind === "list") return <><a className="back-link" href="/"><ArrowLeft size={16} /> All lists</a><ListDetailSkeleton list={list} /></>;
  return <>
    <section className="page-heading"><div><h1>Jevslist<span className="title-dot">.</span></h1><p><a className="jev-link" href="https://typesafe.ai/blog/introducing-system-one-models-and-jev" target="_blank" rel="noopener noreferrer">Jev</a>'s favorite things, submitted by you</p></div><Skeleton className="sk-new-list" aria-hidden="true" /></section>
    <div className="section-heading"><h2>All lists <Skeleton className="sk-index" aria-hidden="true" /></h2></div>
    <ListCardsSkeleton />
  </>;
}

export function LoadingPage({ kind }: { kind: "home" | "list" }) {
  return <div className="site-shell"><main className={`main-container ${kind === "list" ? "list-view" : "home-view"}`} aria-busy="true"><PageSkeleton kind={kind} /></main></div>;
}
