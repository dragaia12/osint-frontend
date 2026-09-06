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
  startSearch: (query: string, strategy: SearchStrategy, manualType?: EntityType) => void;
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
    "row_idx" in data ||
    "_table" in data
  ) {
    return [data];
  }

  return [];
}

// ============================================================================
// NORMALISATION & GESTION DES OBJETS IMBRIQUÉS (CAF / JSON)
// ============================================================================

function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}_${key}` : key;
    if (isRecord(value)) {
      Object.assign(flattened, flattenObject(value, newKey));
    } else {
      flattened[newKey] = value;
    }
  }

  return flattened;
}

function normalizeRow(row: Row): Row {
  const normalized: Row = {};

  // Copie de base
  for (const [key, value] of Object.entries(row)) {
    if (isRecord(value)) {
      // Si la valeur est un objet (ex: objet allocataire CAF), on aplatit intelligemment
      const flattened = flattenObject(value, key);
      for (const [fKey, fVal] of Object.entries(flattened)) {
        normalized[fKey] = fVal;
      }
    } else {
      normalized[key] = value;
    }
  }

  // Gestion du cas où source_data contient une chaîne JSON brute
  const sourceData = row.source_data;
  if (typeof sourceData === "string") {
    try {
      const parsed: unknown = JSON.parse(sourceData);
      if (isRecord(parsed)) {
        const flattenedParsed = flattenObject(parsed);
        for (const [key, value] of Object.entries(flattenedParsed)) {
          if (!(key in normalized)) {
            normalized[key] = value;
          }
        }
      }
    } catch {
      // Ce n'est pas du JSON valide, on conserve tel quel
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
      "_table",
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
// CREATE ITEM
// ============================================================================

function createItem(row: Row, source: string): ResultItem {
  const item: ResultItem = {
    platform: toText(row.platform) || source,
    category: toText(row.category) || "backend",
    source: toText(row.source) || source,
    sources: Array.isArray(row.sources)
      ? row.sources.filter((value): value is string => typeof value === "string")
      : [source],
    trust_level: (toText(row.trust_level) as ResultItem["trust_level"]) || "VERIFIED",
  };

  for (const [key, value] of Object.entries(row)) {
    if (!(key in item)) {
      (item as Record<string, unknown>)[key] = value;
    }
  }

  return item;
}

// ============================================================================
// BUILD SEARCH RESULT AVEC REGROUPEMENT PAR DATASET / TABLE
// ============================================================================

function buildSearchResult(query: string, rows: Row[], manualType?: EntityType): SearchResult {
  const inputType = manualType ?? detectEntityType(query);

  const completeItems: ResultItem[] = rows.map((originalRow) => {
    const row = normalizeRow(originalRow);
    const source = getSource(row);
    return createItem(row, source);
  });

  // Déduplication optimisée via un Set de chaînes stables
  const seen = new Set<string>();
  const uniqueItems: ResultItem[] = [];

  for (const item of completeItems) {
    const key = stableStringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  // Statistiques de confiance
  let verified = 0;
  let probable = 0;
  let candidate = 0;

  for (const item of uniqueItems) {
    const trust = toText(item.trust_level).toUpperCase();
    if (trust === "VERIFIED") {
      verified++;
    } else if (trust === "PROBABLE") {
      probable++;
    } else {
      candidate++;
    }
  }

  // Regroupement dynamique par Source/Table (ex: caf_data, etat_civil, snapchat_users...)
  const groupedBySource: Record<string, ResultItem[]> = {};

  for (const item of uniqueItems) {
    const src = toText(item.source) || toText(item._table) || "Autres sources";
    if (!groupedBySource[src]) {
      groupedBySource[src] = [];
    }
    groupedBySource[src].push(item);
  }

  const sections: ResultSection[] = [];

  // Section globale unifiée
  if (uniqueItems.length > 0) {
    sections.push({
      label: "Tous les résultats",
      icon: "Layers",
      items: uniqueItems,
    });
  }

  // Sections spécifiques par dataset pour un affichage propre et cloisonné dans l'UI
  for (const [sourceName, sourceItems] => of Object.entries(groupedBySource)) {
    sections.push({
      label: sourceName.toUpperCase(),
      icon: sourceName.includes("caf") ? "Building2" : sourceName.includes("snapchat") ? "Camera" : "Database",
      items: sourceItems,
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
// API FETCH AVEC FALLBACKS ROBUSTES
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
// HOOK PRINCIPAL
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

  const startSearch = useCallback((query: string, _strategy: SearchStrategy, manualType?: EntityType) => {
    const cleanQuery = query.trim();

    if (cleanQuery.length < 2) {
      return;
    }

    controllerRef.current?.abort();
    cancelledRef.current = false;

    const controller = new AbortController();
    controllerRef.current = controller;

    setState({
      inProgress: true,
      progress: 15,
      progressLabel: "Connexion au cluster DuckDB...",
      toolChips: { backend: "running" },
      result: null,
      errors: [],
      fromCache: false,
    });

    void (async () => {
      try {
        const encodedQuery = encodeURIComponent(cleanQuery);
        const typeParam = manualType ? `&type=${encodeURIComponent(manualType)}` : "";

        setState((previous) => ({
          ...previous,
          progress: 35,
          progressLabel: "Interrogation des tables OSINT...",
        }));

        let response = await apiFetch(`/search?q=${encodedQuery}${typeParam}`, controller.signal);

        if (response.status === 404) {
          response = await apiFetch(`/api/search?query=${encodedQuery}${typeParam}`, controller.signal);
        }

        if (!response.ok) {
          throw new Error(`Erreur serveur HTTP ${response.status}`);
        }

        setState((previous) => ({
          ...previous,
          progress: 65,
          progressLabel: "Réception et structuration du flux...",
        }));

        const data: unknown = await response.json();

        if (cancelledRef.current) {
          return;
        }

        const rows = extractRows(data);

        setState((previous) => ({
          ...previous,
          progress: 85,
          progressLabel: `Traitement de ${rows.length} entrée(s)...`,
        }));

        const result = buildSearchResult(cleanQuery, rows, manualType);

        if (cancelledRef.current) {
          return;
        }

        const cached = isRecord(data) ? Boolean(data.cached || data.from_cache) : false;

        setState((previous) => ({
          ...previous,
          inProgress: false,
          progress: 100,
          progressLabel: rows.length > 0 ? `${rows.length} résultat(s) indexé(s)` : "Aucune correspondance trouvée",
          toolChips: { ...previous.toolChips, backend: "done" },
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
              ? "Délai d'attente dépassé (Timeout)"
              : error.message
            : "Erreur de communication avec l'API";

        setState((previous) => ({
          ...previous,
          inProgress: false,
          progress: 0,
          progressLabel: "Échec de la recherche",
          toolChips: { ...previous.toolChips, backend: "error" },
          errors: [
            {
              tool: "backend",
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
