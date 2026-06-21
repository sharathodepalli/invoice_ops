import { GET_READY } from "@/app/api/exports/route";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return GET_READY(req);
}
