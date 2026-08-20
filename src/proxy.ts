import { auth } from "@/lib/auth";
import { isWithinAccessWindow } from "@/lib/accessWindow";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const user = req.auth.user;
  if (
    user.role === "Employee" &&
    !isWithinAccessWindow(user.accessStart, user.accessEnd)
  ) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("outsideHours", "1");
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("authjs.session-token");
    res.cookies.delete("__Secure-authjs.session-token");
    return res;
  }
});

export const config = {
  // api/webhooks/* is excluded — those routes are called by external
  // services (no session cookie) and verify requests via signature instead.
  matcher: ["/((?!api/auth|api/webhooks|login|_next/static|_next/image|favicon.ico|brand/).*)"],
};
