"use client";
// Browser helper for calling our own API routes. Copies the pattern the Tide pack documents:
// IAMService.secureFetch attaches `Authorization: DPoP <token>` + a DPoP proof ITSELF when the caller
// sets no Authorization header. The API (withAuth) rejects anything else.
import { useCallback, useRef } from "react";
import { useTideCloak } from "@tidecloak/nextjs";
import { ownApiUrl } from "./apiUrl";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export type ApiFn = <T = any>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;

/** Stable function (identity never changes), safe to use in effect dependency lists. */
export function useApi(): ApiFn {
  const { secureFetch } = useTideCloak();
  const ref = useRef(secureFetch);
  ref.current = secureFetch;
  return useCallback(async (path, init) => {
    const method = init?.method ?? "GET";
    const res = await ref.current(ownApiUrl(path, window.location.origin), {
      method,
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    let data: any = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text.slice(0, 300) };
    }
    if (!res.ok) {
      const msg = (data && typeof data.error === "string" && data.error) || `${res.status} ${res.statusText}`;
      throw new ApiError(res.status, msg, data);
    }
    return data;
  }, []) as ApiFn;
}
