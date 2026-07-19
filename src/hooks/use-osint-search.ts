/**
 * use-osint-search.ts — OSINT HUB (Option A : Backend FastAPI)
 * ======================================================================
 * Correction de la récupération des données pour compatibilité backend
 */

import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  SearchResult, SearchStrategy, ToolError, EntityType,
} from "@/types/osint";

const BACKEND_URL: string =
  (import.meta as unknown as { env: Record<string, string> }).env?.VITE_OSINT_BACKEND_URL
  ?? "http://127.0.0.1:8765"; // Par défaut vers ton serveur local

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
}

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Détection du type ──────────────────────────────────────────────────────────

function detectEntityType(q: string): EntityType {
  const t = q.trim();
  if (/^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(t)) return "email";
  if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(t)) return "ip";
  if (/^[0-9a-fA-F]{32,64}$/.test(t)) return "hash";
  if (/^(?:\+|00)[\d\s\-]{6,15}$/.test(t)) return "phone";
  if (/^[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(t) && !t.includes("@")) return "domain";
  return "username";
}

// ── Construction du payload SearchResult ──────────────────────────────────────

function buildSearchResult(query: string, rows: any[]): SearchResult {
  const type = detectEntityType(query);
  const emails: Array<Record<string, unknown>> = [];
  const usernames: Array<Record<string, unknown>> = [];
  const ips: Array<Record<string, unknown>> = [];
  const domains: Array<Record<string, unknown>> = [];
  const phones: Array<Record<string, unknown>> = [];
  const hashes: Array<Record<string, unknown>> = [];
  const alerts: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const src = (row.source_data || row.source || row.src || "DB").trim();
    const email = (row.email || "").trim();
    const username = (row.username || "").trim();
    const domain = (row.domain || (email.includes("@") ? email.split("@")[1] : "")).trim();
    const ip = (row.ip || "").trim();
    const phone = (row.phone || "").trim();
    const hash = (row.hash_val || row.hash || "").trim();
    const password_set = !!(row.password_set || row.has_password);

    if (email) emails.push({ email, platform: src, trust_level: "VERIFIED", sources: [src], source_data: src });
    if (username) usernames.push({ username, platform: src, trust_level: "VERIFIED", sources: [src], source_data: src });
    if (ip) ips.push({ ip, platform: src, trust_level: "VERIFIED", sources: [src], source_data: src });
    if (domain) domains.push({ subdomain: domain, platform: src, trust_level: "PROBABLE", sources: [src], source_data: src });
    if (phone) phones.push({ note: phone, platform: src, trust_level: "PROBABLE", sources: [src], source_data: src });
    if (hash) hashes.push({ note: hash.slice(0, 20) + "…", platform: src, trust_level: "PROBABLE", sources: [src], source_data: src, hash_val: hash });
    if (email && password_set) alerts.push({ email, note: "Mot de passe exposé", platform: src, trust_level: "VERIFIED", sources: [src], source_data: src });
  }

  return {
    query,
    input_type: type,
    identity_card: { name: query, confidence_summary: { verified: emails.length, probable: domains.length, candidate: 0 } },
    sections: [
      { label: "Données exposées", icon: "🚨", items: alerts },
      { label: "Emails", icon: "📧", items: emails },
      { label: "Identifiants", icon: "🏷️", items: usernames }
    ] as any,
    total_results: rows.length,
    graph: { nodes: [], edges: [] } as any,
  };
}

// ── Hook principal ─────────────────────────────────────────────────────────────

export function useSearch(): UseSearchReturn {
  const [state, setState] = useState<SearchState>(INITIAL);
  const cancelRef = useRef(false);

  const startSearch = useCallback((query: string, _strategy: SearchStrategy) => {
    if (query.trim().length < 3) return;
    cancelRef.current = false;
    setState(prev => ({ ...prev, inProgress: true, progress: 20 }));

    (async () => {
      try {
        const res = await apiFetch(`/search?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        
        // Logique de détection flexible ajoutée ici
        const rawResults = data.results || data.data || (Array.isArray(data) ? data : []);
        
        const result = buildSearchResult(query.trim(), rawResults);

        setState(prev => ({
          ...prev, inProgress: false, progress: 100,
          progressLabel: `${rawResults.length} résultat(s) trouvés`,
          result,
        }));
      } catch (err) {
        setState(prev => ({ ...prev, inProgress: false, errors: [{ tool: "local", message: "Erreur API", status: "error" }] }));
      }
    })();
  }, []);

  return { ...state, startSearch, cancelSearch: () => {}, reset: () => {} };
}