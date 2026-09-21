import { FavoriteThings } from "@/components/favorite-things";
import { listLists } from "@/db/queries";
export const dynamic = "force-dynamic";
export default async function Home() { return <FavoriteThings initialData={await listLists(null)} />; }
