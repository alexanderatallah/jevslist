import { getList, listItems } from "@/db/queries";
import { errorResponse, AppError } from "@/lib/errors";
import { json } from "@/lib/http";
export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){try{const {slug}=await params;const list=await getList(slug);if(!list)throw new AppError("This list doesn’t exist. Head back to all lists to start one.",404);return json({list,...await listItems(list.id,new URL(request.url).searchParams.get("cursor"))});}catch(e){return errorResponse(e);}}
