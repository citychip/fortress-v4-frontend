import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { getUserPrefs, upsertUserPrefs } from "./db";

const execFileAsync = promisify(execFile);

// ─── MCP helper ───────────────────────────────────────────────────────────────

async function mcpCall(toolName: string, server: string, input: Record<string, unknown>): Promise<unknown> {
  const { stdout, stderr } = await execFileAsync(
    "manus-mcp-cli",
    ["tool", "call", toolName, "--server", server, "--input", JSON.stringify(input)],
    { timeout: 30000 }
  );
  if (stderr && !stdout) throw new Error(stderr);
  // manus-mcp-cli returns JSON result in stdout
  try {
    return JSON.parse(stdout);
  } catch {
    return stdout;
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── User preferences (server-side persistence) ──────────────────────────

  prefs: router({
    /**
     * Load saved preferences for the current user.
     * Falls back to null if no prefs stored yet (client uses localStorage defaults).
     * Uses openId from JWT if authenticated; falls back to a stable anonymous key.
     */
    get: publicProcedure.query(async ({ ctx }) => {
      const openId = ctx.user?.openId ?? '__anon__';
      const prefs = await getUserPrefs(openId);
      return { prefs };
    }),

    /**
     * Save preferences for the current user.
     * Strips apiToken before persisting for security.
     */
    save: publicProcedure
      .input(z.object({
        prefs: z.record(z.string(), z.unknown()),
      }))
      .mutation(async ({ ctx, input }) => {
        const openId = ctx.user?.openId ?? '__anon__';
        // Never persist the API token server-side
        const { apiToken: _stripped, ...safePrefs } = input.prefs as Record<string, unknown> & { apiToken?: unknown };
        await upsertUserPrefs(openId, safePrefs);
        return { success: true };
      }),
  }),

  // ─── Fortress integrations ─────────────────────────────────────────────────

  fortress: router({

    /**
     * Push earnings events to Outlook Calendar.
     * Accepts an array of earnings items from /api/calendar and creates
     * all-day events for each earnings date + a roll-window reminder.
     */
    pushEarningsToCalendar: publicProcedure
      .input(z.object({
        earnings: z.array(z.object({
          ticker: z.string(),
          earnings_date: z.string(),
          dte_to_earnings: z.number().optional(),
          status: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const events: Array<{
          summary: string;
          description: string;
          start_time: string;
          end_time: string;
        }> = [];

        for (const item of input.earnings) {
          const dateStr = item.earnings_date; // e.g. "2025-07-22"
          // All-day earnings event
          events.push({
            summary: `📊 ${item.ticker} Earnings`,
            description: `Fortress: ${item.ticker} earnings report. Status: ${item.status ?? 'UNKNOWN'}. DTE: ${item.dte_to_earnings ?? '?'} days.`,
            start_time: dateStr,
            end_time: dateStr,
          });

          // Roll-window reminder: 21 days before earnings
          if (item.dte_to_earnings != null && item.dte_to_earnings > 21) {
            const earningsMs = new Date(dateStr).getTime();
            const rollDate = new Date(earningsMs - 21 * 24 * 60 * 60 * 1000);
            const rollStr = rollDate.toISOString().split('T')[0];
            events.push({
              summary: `⚠️ ${item.ticker} Roll Window Opens (21-DTE)`,
              description: `Fortress: ${item.ticker} roll window opens today — 21 days before earnings on ${dateStr}. Consider rolling or closing positions.`,
              start_time: rollStr,
              end_time: rollStr,
            });
          }
        }

        if (events.length === 0) {
          return { success: false, message: "No earnings events to push", created: 0 };
        }

        const result = await mcpCall("outlook_calendar_create_events", "outlook-calendar", { events });
        return { success: true, created: events.length, result };
      }),

    /**
     * Send morning trade briefing email via Gmail.
     * Accepts a pre-formatted summary string from the Trade Report.
     */
    sendMorningBriefing: publicProcedure
      .input(z.object({
        to: z.string().email(),
        subject: z.string().optional(),
        body: z.string(),
        date: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const today = input.date ?? new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const subject = input.subject ?? `Fortress Morning Briefing — ${today}`;

        const result = await mcpCall("gmail_send_messages", "gmail", {
          messages: [{
            to: [input.to],
            subject,
            content: input.body,
          }],
        });

        return { success: true, result };
      }),

    /**
     * Get user email for pre-filling the briefing form.
     * Searches Gmail for the most recent message to get the sender's email.
     */
    getUserEmail: publicProcedure
      .query(async () => {
        try {
          const result = await mcpCall("gmail_search_messages", "gmail", {
            q: "in:sent",
            max_results: 1,
          }) as { messages?: Array<{ from?: string }> };
          const firstMsg = result?.messages?.[0];
          return { email: firstMsg?.from ?? null };
        } catch {
          return { email: null };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
