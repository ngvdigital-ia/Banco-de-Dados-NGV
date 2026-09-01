import { NextResponse } from "next/server";
import { isAuthorizedBearer } from "@/lib/auth-bearer.mjs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!isAuthorizedBearer(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    success: false,
    code: "UTMIFY_CRON_DISABLED",
    message: "Automatic UTMify sync is disabled.",
    importer: {
      path: "/api/admin/sync-utmify-daily",
      method: "POST",
    },
  }, { status: 410 });
}
