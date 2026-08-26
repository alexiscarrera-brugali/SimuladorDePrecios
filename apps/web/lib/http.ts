// Helpers de respuesta JSON y manejo de errores para Route Handlers.
import { NextResponse } from "next/server";

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ detail: message }, { status });
}

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/** Envuelve un handler para traducir HttpError y errores inesperados a JSON. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) return fail(error.message, error.status);
      console.error("Unhandled route error:", error);
      return fail("Error interno del servidor", 500);
    }
  };
}
