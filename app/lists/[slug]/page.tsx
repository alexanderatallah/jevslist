import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FavoriteThings } from "@/components/favorite-things";
import { getList, listItems } from "@/db/queries";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const list = await getList(slug);
  if (!list) return { title: "List not found · Jevslist", robots: { index: false } };
  return { title: `${list.name} · Jevslist`, description: list.description };
}
export default async function ListPage({ params }: Props) {
  const { slug } = await params;
  const list = await getList(slug);
  if (!list) notFound();
  return <FavoriteThings slug={slug} initialData={{ list, ...await listItems(list.id, null) }} />;
}
