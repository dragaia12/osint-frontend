/**
 * use-osint-search.ts — OSINT HUB (Option A : Backend FastAPI)
 * ======================================================================
 * Remplace la recherche DuckDB-Wasm locale par des requêtes HTTP vers le backend FastAPI.
 */

import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  SearchResult, SearchStrategy, ToolError, EntityType,
} from "@/types/osint";

const BACKEND_URL: string =
  (import.meta as unknown as { env: Record<string, string> }).env?.VITE_OSINT_BACKEND_URL
  ?? "";

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

  const seen = {
    email: new Set<string>(),
    username: new Set<string>(),
    ip: new Set<string>(),
    domain: new Set<string>(),
    phone: new Set<string>(),
    hash: new Set<string>(),
  };

  for (const row of rows) {
    const src = (row.source_data || row.source || row.src || "DB").trim();
    const email = (row.email || "").trim();
    const username = (row.username || "").trim();
    const domain = (row.domain || (email.includes("@") ? email.split("@")[1] : "")).trim();
    const ip = (row.ip || "").trim();
    const phone = (row.phone || "").trim();
    const hash = (row.hash_val || row.hash || "").trim();
    const password_set = !!(row.password_set || row.has_password);

    if (email && !seen.email.has(email)) {
      seen.email.add(email);
      emails.push({ email, platform: src, trust_level: "VERIFIED", sources: [src], source_data: src });
    }
    if (username && !seen.username.has(username)) {
      seen.username.add(username);
      usernames.push({ username, platform: src, trust_level: "VERIFIED", sources: [src], source_data: src });
    }
    if (ip && !seen.ip.has(ip)) {
      seen.ip.add(ip);
      ips.push({ ip, platform: src, trust_level: "VERIFIED", sources: [src], source_data: src });
    }
    if (domain && !seen.domain.has(domain)) {
      seen.domain.add(domain);
      domains.push({ subdomain: domain, platform: src, trust_level: "PROBABLE", sources: [src], source_data: src });
    }
    if (phone && !seen.phone.has(phone)) {
      seen.phone.add(phone);
      phones.push({ note: phone, platform: src, trust_level: "PROBABLE", sources: [src], source_data: src });
    }
    if (hash && !seen.hash.has(hash)) {
      seen.hash.add(hash);
      const short = hash.length > 20 ? hash.slice(0, 20) + "…" : hash;
      hashes.push({ note: short, platform: src, trust_level: "PROBABLE", sources: [src], source_data: src, hash_val: hash });
    }
    if (email && password_set) {
      alerts.push({
        email,
        username: username || null,
        note: "Mot de passe exposé (non affiché)",
        platform: src,
        trust_level: "VERIFIED",
        sources: [src],
        source_data: src,
      });
    }
  }

  const sections = [];
  if (alerts.length)    sections.push({ label: "Données sensibles détectées", icon: "🚨", items: alerts.slice(0, 500) });
  if (emails.length)    sections.push({ label: "Adresses email",              icon: "📧", items: emails.slice(0, 500) });
  if (usernames.length) sections.push({ label: "Identifiants",               icon: "🏷️", items: usernames.slice(0, 300) });
  if (ips.length)       sections.push({ label: "Adresses IP",                icon: "🌍", items: ips.slice(0, 200) });
  if (domains.length)   sections.push({ label: "Domaines associés",          icon: "🌐", items: domains.slice(0, 200) });
  if (phones.length)    sections.push({ label: "Numéros de téléphone",       icon: "📞", items: phones.slice(0, 100) });
  if (hashes.length)    sections.push({ label: "Empreintes / hashs",         icon: "🔑", items: hashes.slice(0, 100) });

  const v = sections.flatMap(s => s.items).filter(i => i.trust_level === "VERIFIED").length;
  const p = sections.flatMap(s => s.items).filter(i => i.trust_level === "PROBABLE").length;

  // ── Graphe ──────────────────────────────────────────────────────────────────
  const nodes: Array<Record<string, unknown>> = [];
  const edges: Array<Record<string, unknown>> = [];
  const nodeMap = new Map<string, string>();
  const edgeSet = new Set<string>();

  const nodeId = (val: string) => {
    if (!nodeMap.has(val)) nodeMap.set(val, `n${nodeMap.size}`);
    return nodeMap.get(val)!;
  };
  const addNode = (val: string, ntype: string, meta: Record<string, unknown> = {}) => {
    const id = nodeId(val);
    if (!nodes.find(n => n.id === id)) nodes.push({ id, label: val, type: ntype, ...meta });
    return id;
  };
  const addEdge = (from: string, to: string, label: string, weight = 1) => {
    const key = `${from}→${to}→${label}`;
    if (!edgeSet.has(key)) { edgeSet.add(key); edges.push({ from, to, label, weight }); }
  };

  const root = addNode(query, type, { root: true });
  for (const row of rows.slice(0, 200)) {
    const src = (row.source_data || row.source || row.src || "DB").trim();
    const e = (row.email || "").trim();
    const u = (row.username || "").trim();
    const ip = (row.ip || "").trim();
    const dom = (row.domain || (e.includes("@") ? e.split("@")[1] : "")).trim();
    const ph = (row.phone || "").trim();
    const h = (row.hash_val || row.hash || "").trim();
    const password_set = !!(row.password_set || row.has_password);
    const ents: string[] = [];

    if (e) { const id = addNode(e, "email", { source: src }); addEdge(root, id, "email trouvé", 3); ents.push(id); }
    if (u) { const id = addNode(u, "username", { source: src }); addEdge(root, id, "identifiant", 2); ents.push(id); }
    if (ip) { const id = addNode(ip, "ip", { source: src }); addEdge(root, id, "IP associée", 2); ents.push(id); }
    if (dom && dom !== (e.includes("@") ? e.split("@")[1] : "")) {
      const id = addNode(dom, "domain", { source: src }); addEdge(root, id, "domaine associé", 1); ents.push(id);
      ents.push(id);
    }
    if (ph) { const id = addNode(ph, "phone", { source: src }); addEdge(root, id, "téléphone", 2); ents.push(id); }
    if (h) { const short = h.length > 20 ? h.slice(0, 20) + "…" : h; const id = addNode(short, "hash", { full: h, source: src }); ents.push(id); }
    if (password_set) {
      const aid = addNode(`[mot de passe @ ${src}]`, "alert", { source: src });
      if (ents[0]) addEdge(ents[0], aid, "mot de passe trouvé", 3);
    }
    for (let i = 0; i < ents.length; i++)
      for (let j = i + 1; j < ents.length; j++)
        addEdge(ents[i], ents[j], "même enregistrement", 2);
  }

  return {
    query,
    input_type: type,
    identity_card: {
      name: query,
      confidence_summary: { verified: v, probable: p, candidate: 0 },
    },
    sections: sections as unknown as SearchResult["sections"],
    total_results: rows.length,
    graph: { nodes, edges } as unknown as SearchResult["graph"],
  };
}

// ── Hook principal ─────────────────────────────────────────────────────────────

const TOOLS = [
  ["duckdb_local",     "Base de données locale"],
  ["email_reputation", "Réputation email"],
  ["domain_lookup",    "Domaines associés"],
  ["ip_intel",         "Renseignement IP"],
  ["phone_lookup",     "Téléphones"],
  ["hash_check",       "Empreintes / hashs"],
] as const;

export function useSearch(): UseSearchReturn {
  const [state, setState] = useState<SearchState>(INITIAL);
  const cancelRef = useRef(false);

  const cancelSearch = useCallback(() => {
    cancelRef.current = true;
    setState(prev => ({ ...prev, inProgress: false }));
  }, []);

  const reset = useCallback(() => {
    cancelRef.current = true;
    setState(INITIAL);
  }, []);

  const startSearch = useCallback((query: string, _strategy: SearchStrategy) => {
    if (query.trim().length < 3) return;
    cancelRef.current = false;

    setState({
      inProgress: true, progress: 10, progressLabel: "Démarrage de la recherche fédérée...",
      toolChips: {}, result: null, errors: [], fromCache: false,
    });

    (async () => {
      try {
        setState(prev => ({
          ...prev, progress: 30,
          progressLabel: `Interrogation des modules du backend...`,
          toolChips: Object.fromEntries(TOOLS.map(([k]) => [k, "running"])),
        }));

        const t0 = performance.now();
        let res: Response;
        
        try {
          res = await apiFetch(`/api/search?query=${encodeURIComponent(query.trim())}`);
          if (!res.ok) {
            res = await apiFetch(`/search?q=${encodeURIComponent(query.trim())}`);
          }
        } catch {
          res = await apiFetch(`/search?q=${encodeURIComponent(query.trim())}`);
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        const tookMs = Math.round(performance.now() - t0);
        if (cancelRef.current) return;

        const rawResults = data.results || data.results_raw || [];
        const result = buildSearchResult(query.trim(), rawResults);

        setState({
          inProgress: false, progress: 100,
          progressLabel: `${rawResults.length} résultat(s) en ${tookMs} ms`,
          toolChips: Object.fromEntries(TOOLS.map(([k]) => [k, "done"])),
          result,
          errors: [],
          fromCache: false,
        });

      } catch (err: unknown) {
        if (cancelRef.current) return;
        const message = err instanceof Error ? err.message : "Erreur de connexion au serveur FastAPI";
        setState(prev => ({
          ...prev, inProgress: false, progress: 0,
          errors: [{ tool: "duckdb_local", message, status: "error" }],
          toolChips: Object.fromEntries(TOOLS.map(([k]) => [k, "error"])),
        }));
      }
    })();
  }, []);

  return { ...state, startSearch, cancelSearch, reset };
}
