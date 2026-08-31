import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  isOperationDeploymentDomainsModuleEnabled,
  isOperationExecutionModuleEnabled,
} from "@/lib/operacao/feature";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/cron(.*)",
  "/api/webhooks(.*)",
  "/api/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;
  const transversalModuleDisabled =
    (pathname === "/sistemas/execucao" && !isOperationExecutionModuleEnabled) ||
    (pathname === "/sistemas/publicacao" && !isOperationDeploymentDomainsModuleEnabled);

  if (transversalModuleDisabled) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)((?!/cron|/webhooks).*)",
  ],
};
