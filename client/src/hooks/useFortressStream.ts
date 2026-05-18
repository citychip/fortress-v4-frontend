/**
 * useFortressStream — SSE-based real-time data hook
 *
 * Opens a single EventSource connection to /api/stream and feeds incoming
 * events directly into the tRPC/React Query cache via queryClient.setQueryData().
 *
 * Replaces the setInterval-based polling for briefing, positions, and alerts.
 * Lower-priority endpoints (candidates, market-intel, pnl) remain on HTTP polls.
 *
 * Usage: call once at the top of DashboardLayout or App.tsx.
 * The hook manages its own connection lifecycle (connect on mount, close on unmount,
 * exponential backoff on error).
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const STREAM_URL = "/api/stream";
const INITIAL_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

export function useFortressStream(token: string | null | undefined) {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) return;

    function connect() {
      // Clean up any existing connection
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      const url = `${STREAM_URL}?token=${encodeURIComponent(token!)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("briefing", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          // Update the briefing query cache directly — no HTTP round-trip
          queryClient.setQueryData(["briefing"], data);
          backoffRef.current = INITIAL_BACKOFF_MS; // reset backoff on success
        } catch {
          // ignore parse errors
        }
      });

      es.addEventListener("positions", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          queryClient.setQueryData(["positions"], data);
          backoffRef.current = INITIAL_BACKOFF_MS;
        } catch {
          // ignore
        }
      });

      es.addEventListener("alerts", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          queryClient.setQueryData(["alerts"], data);
          backoffRef.current = INITIAL_BACKOFF_MS;
        } catch {
          // ignore
        }
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;

        // Exponential backoff reconnect
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);

        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    }

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [token, queryClient]);
}
