import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const token = (await cookies()).get("brugali_session")?.value;
  if (!token) return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  const { path } = await context.params;
  const target = new URL(`${process.env.API_BASE_URL ?? "http://localhost:8000"}/${path.join("/")}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  const requestHeaders = new Headers();
  requestHeaders.set("Authorization", `Bearer ${token}`);
  const contentType = request.headers.get("content-type");
  if (contentType) requestHeaders.set("Content-Type", contentType);
  const init: RequestInit = { method: request.method, headers: requestHeaders, cache: "no-store" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.arrayBuffer();
  const response = await fetch(target, init);
  const responseHeaders = new Headers();
  const disposition = response.headers.get("content-disposition");
  const responseType = response.headers.get("content-type");
  if (disposition) responseHeaders.set("Content-Disposition", disposition);
  if (responseType) responseHeaders.set("Content-Type", responseType);
  return new NextResponse(response.body, { status: response.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;

