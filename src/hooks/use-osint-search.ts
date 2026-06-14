import { useState, useRef, useCallback } from "react";
import type { SearchResult, WsMessage, SearchStrategy, ToolError } from "@/types/osint";

const BACKEND_URL = (import.meta.env.VITE_OSINT_BACKEND_URL as string) || "";
const WS_URL = BACKEND_URL
  ? BACKEND_URL.replace(/^https?/, (p: string) => (p === "https" ? "wss" : "ws"))
  : "";

export interface SearchState {
  inProgress: boolean;
  progress: number;
  progressLabel: string;
  toolChips: Record<string, "running" | "done" | "error">;
  result: SearchResult | null;
  errors: ToolError[];
  fromCache: boolean;
}

export interface UseSearchReturn extends SearchState {
  startSearch: (query: string, strategy: SearchStrategy) => void;
  cancelSearch: () => void;
  reset: () => void;
}

const INITIAL: SearchState = {
  inProgress: false,
  progress: 0,
  progressLabel: "",
  toolChips: {},
  result: null,
  errors: [],
  fromCache: false,
};

function normalizeName(tool: string): string {
  return tool.replace(/_tool$/i, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function useSearch(): UseSearchReturn {
  const [state, setState] = useState<SearchState>(INITIAL);
  const wsRef = useRef<WebSocket | null>(null);
  const jobsDone = useRef(0);
  const jobsTotal = useRef(0);

  const setProgress = useCallback((pct: number | null, label?: string) => {
    setState((prev) => ({
      ...prev,
      ...(pct !== null ? { progress: pct } : {}),
      ...(label !== undefined ? { progressLabel: label } : {}),
    }));
  }, []);

  const cancelSearch = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* ignore */ }
      wsRef.current = null;
    }
    setState((prev) => ({ ...prev, inProgress: false }));
  }, []);

  const reset = useCallback(() => {
    cancelSearch();
    setState(INITIAL);
  }, [cancelSearch]);

  const startSearch = useCallback(
    (query: string, strategy: SearchStrategy) => {
      if (!query.trim()) return;
      cancelSearch();
      jobsDone.current = 0;
      jobsTotal.current = 0;

      // Demo mode when no backend configured
      if (!WS_URL) {
        setState({
          inProgress: true, progress: 0, progressLabel: "Mode démo…",
          toolChips: {}, result: null, errors: [], fromCache: false,
        });
        const steps = [
          [300, 15, "Détection du type de cible…"],
          [600, 30, "Lancement — 8 modules"],
          [900, 55, "Sherlock — 4 rés."],
          [1100, 70, "Whois — 2 rés."],
          [1400, 85, "HaveIBeenPwned — 1 rés."],
          [1700, 95, "Consolidation…"],
        ] as [number, number, string][];
        steps.forEach(([delay, pct, label]) => {
          setTimeout(() => setProgress(pct, label), delay);
        });
        setTimeout(() => {
          setState({
            inProgress: false, progress: 100, progressLabel: "Mode démo",
            toolChips: {
              sherlock_tool: "done", whois_tool: "done",
              hibp_tool: "done", github_tool: "error",
            },
            fromCache: false,
            errors: [{ tool: "github_tool", message: "API key manquante", status: "no_api_key" }],
            result: {
              query,
              input_type: "username",
              identity_card: {
                name: query,
                confidence_summary: { verified: 2, probable: 3, candidate: 5 },
              },
              sections: [
                {
                  label: "Profils sociaux", icon: "👤",
                  items: [
                    { platform: "Twitter", username: query, url: `https://twitter.com/${query}`, trust_level: "VERIFIED" },
                    { platform: "Instagram", username: query, url: `https://instagram.com/${query}`, trust_level: "PROBABLE" },
                    { platform: "GitHub", username: query, url: `https://github.com/${query}`, trust_level: "CANDIDATE" },
                  ],
                },
                {
                  label: "Domaines associés", icon: "🌐",
                  items: [
                    { platform: "WHOIS", subdomain: `${query}.com`, url: `https://${query}.com`, trust_level: "CANDIDATE" },
                  ],
                },
              ],
              total_results: 4,
            },
          });
        }, 1900);
        return;
      }

      setState({
        inProgress: true, progress: 0, progressLabel: "Connexion…",
        toolChips: {}, result: null, errors: [], fromCache: false,
      });

      const ws = new WebSocket(`${WS_URL}/ws/search`);
      wsRef.current = ws;

      ws.onopen = () => ws.send(JSON.stringify({ query, strategy, chain: true, max_parallel: 20 }));

      ws.onmessage = (evt) => {
        let msg: WsMessage;
        try { msg = JSON.parse(evt.data as string); } catch { return; }

        switch (msg.type) {
          case "detected":
            setProgress(2, `Types : ${(msg.targets ?? []).map((t) => t.detected_type).join(", ")}`);
            break;
          case "start":
            jobsTotal.current = msg.total_jobs ?? 0;
            setProgress(5, `Lancement — ${jobsTotal.current} modules`);
            break;
          case "wave_start":
            setProgress(10, `Vague ${msg.priority} — ${msg.jobs} modules`);
            break;
          case "progress": {
            jobsDone.current++;
            const pct = jobsTotal.current > 0
              ? Math.min(95, Math.round((jobsDone.current / jobsTotal.current) * 100))
              : 50;
            const toolStatus =
              msg.status === "done" ? "done"
              : ["error", "not_installed", "no_api_key"].includes(msg.status ?? "") ? "error"
              : "running";
            setState((prev) => {
              const errors = [...prev.errors];
              if (toolStatus === "error" && msg.tool) {
                errors.push({ tool: msg.tool, message: msg.error ?? msg.message ?? msg.status ?? "error", status: (msg.status as ToolError["status"]) ?? "error" });
              }
              return {
                ...prev, progress: pct,
                progressLabel: `${normalizeName(msg.tool ?? "")} — ${msg.status === "done" ? `${msg.count} rés.` : msg.status}`,
                toolChips: msg.tool ? { ...prev.toolChips, [msg.tool]: toolStatus } : prev.toolChips,
                errors,
              };
            });
            break;
          }
          case "chain":
            setProgress(null, `Chaînage — profondeur ${msg.depth}`);
            break;
          case "cache_hit":
            setState((prev) => ({ ...prev, fromCache: true }));
            setProgress(100, "⚡ Cache");
            break;
          case "consolidated": {
            const sections = Array.isArray(msg.sections) ? msg.sections : Object.values(msg.sections ?? {});
            setState((prev) => ({
              ...prev,
              result: {
                query: msg.query ?? query,
                input_type: "email",
                identity_card: msg.identity_card,
                sections,
                total_results: msg.total_results ?? 0,
              },
            }));
            break;
          }
          case "done":
            setProgress(100, "Analyse terminée");
            setState((prev) => ({ ...prev, inProgress: false }));
            ws.close();
            break;
          case "error":
            setState((prev) => ({
              ...prev, inProgress: false,
              errors: [...prev.errors, { tool: "system", message: msg.message ?? "Erreur inconnue", status: "error" }],
            }));
            ws.close();
            break;
        }
      };

      ws.onerror = () => {
        setState((prev) => ({
          ...prev, inProgress: false,
          errors: [...prev.errors, { tool: "websocket", message: "Erreur de connexion WebSocket", status: "error" }],
        }));
      };

      ws.onclose = () => setState((prev) => ({ ...prev, inProgress: false }));
    },
    [cancelSearch, setProgress]
  );

  return { ...state, startSearch, cancelSearch, reset };
}
