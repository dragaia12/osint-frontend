import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  SearchResult,
  SearchStrategy,
  ToolError,
  EntityType,
  ResultSection,
  ResultItem,
  Graph,
} from "@/types/osint";

const BACKEND_URL =
  (
    import.meta as unknown as {
      env?: Record<string, string | undefined>;
    }
  ).env?.VITE_OSINT_BACKEND_URL ||
  "https://strengthen-citation-scripts-informal.trycloudflare.com";

const REQUEST_TIMEOUT = 30000;

type Row = Record<string, unknown>;

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

// ============================================================================
// HELPERS
// ============================================================================

function isRecord(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  return "";
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ============================================================================
// ENTITY DETECTION
// ============================================================================

function detectEntityType(query: string): EntityType {
  const value = query.trim();

  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
    return "email";
  }

  if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(value)) {
    return "ip";
  }

  if (/^[0-9a-fA-F]{32,128}$/.test(value)) {
    return "hash";
  }

  if (/^\+?[0-9\s().-]{7,20}$/.test(value)) {
    return "phone";
  }

  if (/^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(value) && !value.includes("@")) {
    return "domain";
  }

  return "username";
}

// ============================================================================
// EXTRACTION DES LIGNES
// ============================================================================

function extractRows(data: unknown): Row[] {
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }

  if (!isRecord(data)) {
    return [];
  }

  const possibleKeys = ["results", "data", "records", "rows", "items", "matches", "hits"];

  for (const key of possibleKeys) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  if (
    "email" in data ||
    "username" in data ||
    "phone" in data ||
    "ip" in data ||
    "dataset" in data ||
    "row_idx" in data
  ) {
    return [data];
  }

  return [];
}

// ============================================================================
// NORMALISATION
// ============================================================================

function normalizeRow(row: Row): Row {
  const normalized: Row = {};

  for (const [key, value] of Object.entries(row)) {
    normalized[key] = value;
  }

  const sourceData = row.source_data;

  if (typeof sourceData === "string") {
    try {
      const parsed: unknown = JSON.parse(sourceData);
      if (isRecord(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          if (!(key in normalized)) {
            normalized[key] = value;
          }
        }
      }
    } catch {
      // Ce n'est pas du JSON : on conserve source_data tel quel.
    }
  }

  return normalized;
}

// ============================================================================
// FIELD HELPERS
// ============================================================================

function getField(row: Row, names: string[]): string {
  for (const name of names) {
    if (name in row) {
      const value = toText(row[name]);
      if (value) {
        return value;
      }
    }

    const matchingKey = Object.keys(row).find((key) => key.toLowerCase() === name.toLowerCase());

    if (matchingKey) {
      const value = toText(row[matchingKey]);
      if (value) {
        return value;
      }
    }
  }

  return "";
}

function getSource(row: Row): string {
  return (
    getField(row, [
      "source",
      "source_file",
      "filename",
      "file",
      "dataset",
      "table",
      "database",
      "origin",
    ]) || "Database"
  );
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

function deduplicate(rows: Row[]): Row[] {
  const seen = new Set<string>();
  const output: Row[] = [];

  for (const row of rows) {
    const key = stableStringify(row);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(row);
  }

  return output;
}

// ============================================================================
// CREATE ITEM
// ============================================================================

function createItem(row: Row, source: string): ResultItem {
  // Commencer avec toutes les propriétés de la ligne
  const item: Record<string, unknown> = { ...row };

  // Ajouter/mettre à jour les propriétés standard
  item.platform = toText(row.platform) || source;
  item.category = toText(row.category) || "backend";
  item.source = toText(row.source) || source;
  item.sources = Array.isArray(row.sources)
    ? row.sources.filter((value): value is string => typeof value === "string")
    : [source];
  item.trust_level = (toText(row.trust_level) as ResultItem["trust_level"]) || "VERIFIED";

  return item as ResultItem;
}

// ============================================================================
// BUILD SEARCH RESULT
// ============================================================================

function buildSearchResult(query: string, rows: Row[]): SearchResult {
  const inputType = detectEntityType(query);

  const completeItems: ResultItem[] = rows.map((originalRow) => {
    const row = normalizeRow(originalRow);
    const source = getSource(row);
    return createItem(row, source);
  });

  // Dédupliquer en utilisant la sérialisation
  const seen = new Set<string>();
  const uniqueItems: ResultItem[] = [];

  for (const item of completeItems) {
    const key = stableStringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  let verified = 0;
  let probable = 0;
  let candidate = 0;

  for (const row of uniqueItems) {
    const trust = toText(row.trust_level).toUpperCase();
    if (trust === "VERIFIED") {
      verified++;
    } else if (trust === "PROBABLE") {
      probable++;
    } else {
      candidate++;
    }
  }

  const sections: ResultSection[] = [];

  if (uniqueItems.length > 0) {
    sections.push({
      label: "Résultats complets",
      icon: "📂",
      items: uniqueItems,
    });
  }

  const graph: Graph = {
    nodes: [],
    edges: [],
  };

  return {
    query,
    input_type: inputType,
    identity_card: {
      name: query,
      confidence_summary: {
        verified,
        probable,
        candidate,
      },
    },
    sections,
    total_results: uniqueItems.length,
    graph,
  };
}

// ============================================================================
// API FETCH
// ============================================================================

async function apiFetch(path: string, signal: AbortSignal): Promise<Response> {
  const timeoutController = new AbortController();

  const timeoutId = window.setTimeout(() => {
    timeoutController.abort();
  }, REQUEST_TIMEOUT);

  const abortHandler = () => {
    timeoutController.abort();
  };

  signal.addEventListener("abort", abortHandler, { once: true });

  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";

    return await fetch(`${BACKEND_URL}${path}`, {
      method: "GET",
      signal: timeoutController.signal,
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } finally {
    window.clearTimeout(timeoutId);
    signal.removeEventListener("abort", abortHandler);
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useSearch(): UseSearchReturn {
  const [state, setState] = useState<SearchState>(INITIAL);
  const cancelledRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  const cancelSearch = useCallback(() => {
    cancelledRef.current = true;
    controllerRef.current?.abort();
    setState((previous) => ({
      ...previous,
      inProgress: false,
      progressLabel: "Recherche annulée",
    }));
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    controllerRef.current?.abort();
    setState(INITIAL);
  }, []);

  const startSearch = useCallback((query: string, _strategy: SearchStrategy) => {
    const cleanQuery = query.trim();

    if (cleanQuery.length < 3) {
      return;
    }

    controllerRef.current?.abort();
    cancelledRef.current = false;

    const controller = new AbortController();
    controllerRef.current = controller;

    setState({
      inProgress: true,
      progress: 10,
      progressLabel: "Connexion au moteur de recherche...",
      toolChips: { local: "running" },
      result: null,
      errors: [],
      fromCache: false,
    });

    void (async () => {
      try {
        const encodedQuery = encodeURIComponent(cleanQuery);

        setState((previous) => ({
          ...previous,
          progress: 25,
          progressLabel: "Interrogation du backend...",
        }));

        let response = await apiFetch(`/search?q=${encodedQuery}`, controller.signal);

        if (response.status === 404) {
          response = await apiFetch(`/api/search?query=${encodedQuery}`, controller.signal);
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        setState((previous) => ({
          ...previous,
          progress: 50,
          progressLabel: "Réception des données...",
        }));

        const data: unknown = await response.json();

        if (cancelledRef.current) {
          return;
        }

        const rows = extractRows(data);

        setState((previous) => ({
          ...previous,
          progress: 70,
          progressLabel: `Traitement de ${rows.length} résultat(s)...`,
        }));

        const result = buildSearchResult(cleanQuery, rows);

        if (cancelledRef.current) {
          return;
        }

        const cached = isRecord(data) ? Boolean(data.cached || data.from_cache) : false;

        if (import.meta.env.DEV) {
          console.log("[OSINT] Backend response:", data);
          console.log("[OSINT] Extracted rows:", rows);
          console.log("[OSINT] Number of columns:", rows.length > 0 ? Object.keys(rows[0]).length : 0);
          if (rows.length > 0) {
            console.log("[OSINT] First row columns:", Object.keys(rows[0]));
          }
        }

        setState((previous) => ({
          ...previous,
          inProgress: false,
          progress: 100,
          progressLabel: rows.length > 0 ? `${rows.length} résultat(s) trouvé(s)` : "Aucun résultat trouvé",
          toolChips: { ...previous.toolChips, local: "done" },
          result,
          fromCache: cached,
        }));
      } catch (error: unknown) {
        if (cancelledRef.current || controller.signal.aborted) {
          return;
        }

        const message =
          error instanceof Error
            ? error.name === "AbortError"
              ? "La requête a expiré"
              : error.message
            : "Erreur de liaison avec le backend";

        console.error("[OSINT] Erreur:", message);

        setState((previous) => ({
          ...previous,
          inProgress: false,
          progress: 0,
          progressLabel: "Erreur de recherche",
          toolChips: { ...previous.toolChips, local: "error" },
          errors: [
            {
              tool: "local",
              message,
              status: "error",
            },
          ],
        }));
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      }
    })();
  }, []);

  return {
    ...state,
    startSearch,
    cancelSearch,
    reset,
  };
}

export { useSearch as useOsintSearch };
