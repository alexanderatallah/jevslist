import { listExists } from "@/db/queries";
import { slugify } from "@/lib/shared";
import { errorResponse, AppError } from "@/lib/errors";
import { json } from "@/lib/http";
export async function GET(request:Request) {try{const slug=new URL(request.url).searchParams.get("slug")||"";if(slug.length<3||slug.length>80||slugify(slug)!==slug)throw new AppError("Use a name with at least 3 English letters or numbers.");return json({slug,available:!await listExists(slug)});}catch(e){return errorResponse(e);}}
