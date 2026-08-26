import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/contracts";

export async function POST(request: Request) {
  const payload = loginSchema.safeParse(await request.json());
  if (!payload.success) return NextResponse.json({ detail: payload.error.issues[0]?.message }, { status: 422 });
  const response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:8000"}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload.data),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) return NextResponse.json(data, { status: response.status });
  const nextResponse = NextResponse.json({ user: data.user });
  nextResponse.cookies.set("brugali_session", data.access_token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return nextResponse;
}

