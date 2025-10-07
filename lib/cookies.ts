import { NextResponse } from "next/server";

const ACCESS_COOKIE = "sb:token";
const REFRESH_COOKIE = "sb:refresh-token";
const REDIRECT_COOKIE = "redirect_escrow";

function cookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  // sameSite must be a string literal compatible with Next's ResponseCookie type
  return { path: "/", httpOnly: true, sameSite: "lax" as const, secure };
}

export function setAuthCookies(
  resp: NextResponse,
  accessToken?: string | null,
  refreshToken?: string | null,
  maxAgeSeconds?: number,
) {
  const opts: any = { ...cookieOptions() };
  if (typeof maxAgeSeconds === "number") opts.maxAge = maxAgeSeconds;
  if (accessToken) resp.cookies.set(ACCESS_COOKIE, accessToken, opts);
  if (refreshToken) resp.cookies.set(REFRESH_COOKIE, refreshToken, opts);
}

export function clearAuthCookies(resp: NextResponse) {
  const opts: any = { ...cookieOptions(), expires: new Date(0) };
  resp.cookies.set(ACCESS_COOKIE, "", opts);
  resp.cookies.set(REFRESH_COOKIE, "", opts);
}

export function setRedirectCookie(
  resp: NextResponse,
  value: string,
  expiresDate?: Date,
) {
  const opts: any = { ...cookieOptions() };
  if (expiresDate) opts.expires = expiresDate;
  resp.cookies.set(REDIRECT_COOKIE, value, opts);
}

export function clearRedirectCookie(resp: NextResponse) {
  resp.cookies.set(REDIRECT_COOKIE, "", {
    ...cookieOptions(),
    expires: new Date(0),
  });
}

const cookiesApi = {
  setAuthCookies,
  clearAuthCookies,
  setRedirectCookie,
  clearRedirectCookie,
};
export default cookiesApi;
