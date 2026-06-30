import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// The admin area, the developer /account page, and the /family hub are gated. The
// public coming-soon splash and the public /developers docs stay open and never
// boot Clerk JS (ClerkProvider is scoped to the (authed) route group, not the
// root layout — see app/(authed)/layout.tsx).
const isProtectedRoute = createRouteMatcher(["/admin(.*)", "/account(.*)", "/family(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    // Redirects unauthenticated visitors to the sign-in page.
    await auth.protect();
  }
  // Expose the request pathname to server components via a request header so the
  // (authed) layout can skip-gate the current route (Next layouts can't read the
  // pathname directly). Additive + harmless — when the FAMILY_FORCE_VERIFY flag
  // is off the layout never reads it. This is a REQUEST header (not sent to the
  // client), set on the forwarded request only.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, run on everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
