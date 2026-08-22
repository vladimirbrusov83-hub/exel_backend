import { NextResponse, type NextRequest } from "next/server";
import { COACH_COOKIE, isCoachToken } from "./lib/auth";

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/coach/login") return NextResponse.next();
  if (await isCoachToken(req.cookies.get(COACH_COOKIE)?.value)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/coach/login";
  url.search = "";
  return NextResponse.redirect(url);
}

// Both entries on purpose: "/coach/:path*" is not guaranteed to match "/coach"
// itself, and /coach unguarded would render the whole calendar to anyone.
export const config = { matcher: ["/coach", "/coach/:path*"] };
