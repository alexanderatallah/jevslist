import { FavoriteThings } from "@/components/favorite-things";
export default async function ListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <FavoriteThings slug={slug} />;
}
