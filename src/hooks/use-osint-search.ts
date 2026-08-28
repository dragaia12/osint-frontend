import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
SearchResult,
SearchStrategy,
ToolError,
EntityType,
} from "@/types/osint";

// ============================================================================
// CONFIG
// ============================================================================

const BACKEND_URL =
(
import.meta as unknown as {
env?: Record<string, string | undefined>;
}
).env?.VITE_OSINT_BACKEND_URL ||
"https://strengthen-citation-scripts-informal.trycloudflare.com";

const REQUEST_TIMEOUT = 30000;

// ============================================================================
// TYPES
// ============================================================================

type Row = Record<string, unknown>;

interface Section {
label: string;
icon: string;
items: Row[];
}

// ============================================================================
// STATE
// ============================================================================

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
startSearch: (
query: string,
strategy: SearchStrategy
) => void;
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
return (
typeof value === "object" &&
value !== null &&
!Array.isArray(value)
);
}

function text(value: unknown): string {
if (
value === null ||
value === undefined
) {
return "";
}

if (
typeof value === "string" ||
typeof value === "number" ||
typeof value === "boolean"
) {
return String(value).trim();
}

return "";
}

function detectEntityType(
query: string
): EntityType {
const value = query.trim();

if (
/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$/.test(
value
)
) {
return "email";
}

if (
/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d).){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(
value
)
) {
return "ip";
}

if (
/^[0-9a-fA-F]{32,128}$/.test(value)
) {
return "hash";
}

if (
/^+?[0-9\s().-]{7,20}$/.test(value)
) {
return "phone";
}

if (
/^(?:[a-zA-Z0-9-]+.)+[a-zA-Z]{2,}$/.test(
value
) &&
!value.includes("@")
) {
return "domain";
}

return "username";
}

// ============================================================================
// EXTRACTION DES ROWS
// ============================================================================

function extractRows(
data: unknown
): Row[] {
// Backend -> tableau direct
if (Array.isArray(data)) {
return data.filter(isRecord);
}

if (!isRecord(data)) {
return [];
}

// Formats classiques
const possibleKeys = [
"results",
"data",
"records",
"rows",
"items",
"matches",
"hits",
];

for (const key of possibleKeys) {
const value = data[key];

```
if (Array.isArray(value)) {
  return value.filter(isRecord);
}
```

}

// Résultat unique directement retourné
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

function normalizeRow(
row: Row
): Row {
const result: Row = {};

// IMPORTANT :
// On copie absolument TOUTES les colonnes.
for (const [key, value] of Object.entries(row)) {
result[key] = value;
}

return result;
}

// ============================================================================
// FIELD HELPERS
// ============================================================================

function getField(
row: Row,
names: string[]
): string {
for (const name of names) {
const exact = row[name];

```
const exactText = text(exact);

if (exactText) {
  return exactText;
}

const matchingKey = Object.keys(row).find(
  (key) =>
    key.toLowerCase() ===
    name.toLowerCase()
);

if (matchingKey) {
  const value = text(
    row[matchingKey]
  );

  if (value) {
    return value;
  }
}
```

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
]) ||
"Database"
);
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

function deduplicate(
rows: Row[]
): Row[] {
const seen = new Set<string>();

return rows.filter((row) => {
try {
const key = JSON.stringify(row);

```
  if (seen.has(key)) {
    return false;
  }

  seen.add(key);
  return true;
} catch {
  return true;
}
```

});
}

// ============================================================================
// BUILD ITEM
// ============================================================================

function createItem(
row: Row,
source: string
): Row {
return {
// TOUTES LES DONNÉES DU BACKEND
...row,

```
// Métadonnées supplémentaires pour l'interface
platform:
  text(row.platform) || source,

source:
  text(row.source) || source,

sources:
  Array.isArray(row.sources)
    ? row.sources
    : [source],

trust_level:
  text(row.trust_level) ||
  "VERIFIED",
```

};
}

// ============================================================================
// BUILD SEARCH RESULT
// ============================================================================

function buildSearchResult(
query: string,
rows: Row[]
): SearchResult {
const type =
detectEntityType(query);

const emails: Row[] = [];
const usernames: Row[] = [];
const ips: Row[] = [];
const phones: Row[] = [];
const domains: Row[] = [];
const hashes: Row[] = [];
const exposed: Row[] = [];
const others: Row[] = [];

let verified = 0;
let probable = 0;
let candidate = 0;

for (const originalRow of rows) {
const row =
normalizeRow(originalRow);

```
const source =
  getSource(row);

const item =
  createItem(row, source);

const email =
  getField(row, [
    "email",
    "email_address",
    "mail",
    "e_mail",
  ]);

const username =
  getField(row, [
    "username",
    "user_name",
    "user",
    "login",
    "nickname",
    "nick",
    "pseudo",
    "handle",
    "screen_name",
  ]);

const ip =
  getField(row, [
    "ip",
    "ip_address",
    "ipv4",
  ]);

const phone =
  getField(row, [
    "phone",
    "phone_number",
    "telephone",
    "tel",
    "mobile",
  ]);

const domain =
  getField(row, [
    "domain",
    "hostname",
    "host",
    "website",
  ]) ||
  (
    email.includes("@")
      ? email.split("@")[1] || ""
      : ""
  );

const hash =
  getField(row, [
    "hash",
    "hash_val",
    "hash_value",
    "md5",
    "sha1",
    "sha256",
    "sha512",
    "password_hash",
  ]);

let categorized = false;

// ------------------------------------------------------------------------
// EMAIL
// ------------------------------------------------------------------------

if (email) {
  emails.push({
    ...item,
    email,
  });

  verified++;
  categorized = true;
}

// ------------------------------------------------------------------------
// USERNAME
// ------------------------------------------------------------------------

if (username) {
  usernames.push({
    ...item,
    username,
  });

  verified++;
  categorized = true;
}

// ------------------------------------------------------------------------
// IP
// ------------------------------------------------------------------------

if (ip) {
  ips.push({
    ...item,
    ip,
  });

  verified++;
  categorized = true;
}

// ------------------------------------------------------------------------
// PHONE
// ------------------------------------------------------------------------

if (phone) {
  phones.push({
    ...item,
    phone,
    note: phone,
  });

  probable++;
  categorized = true;
}

// ------------------------------------------------------------------------
// DOMAIN
// ------------------------------------------------------------------------

if (domain) {
  domains.push({
    ...item,
    domain,
    subdomain:
      text(row.subdomain) ||
      domain,
  });

  probable++;
  categorized = true;
}

// ------------------------------------------------------------------------
// HASH
// ------------------------------------------------------------------------

if (hash) {
  hashes.push({
    ...item,
    hash,
    hash_val: hash,
  });

  candidate++;
  categorized = true;
}

// ------------------------------------------------------------------------
// DONNÉES D'AUTHENTIFICATION
// ------------------------------------------------------------------------

const hasPassword =
  Boolean(
    row.password ||
    row.password_hash ||
    row.password_set ||
    row.has_password
  );

if (
  email &&
  hasPassword
) {
  exposed.push({
    ...item,
    email,
    alert_type:
      "credential_exposure",
    note:
      "Donnée d'authentification détectée",
  });
}

// ------------------------------------------------------------------------
// AUTRES
// ------------------------------------------------------------------------

if (!categorized) {
  others.push({
    ...item,
  });

  candidate++;
}
```

}

// --------------------------------------------------------------------------
// SECTIONS
// --------------------------------------------------------------------------

const sections: Section[] = [
{
label: "Données exposées",
icon: "🚨",
items: deduplicate(exposed),
},
{
label: "Emails",
icon: "📧",
items: deduplicate(emails),
},
{
label: "Identifiants",
icon: "👤",
items: deduplicate(usernames),
},
{
label: "Adresses IP",
icon: "🌐",
items: deduplicate(ips),
},
{
label: "Téléphones",
icon: "📱",
items: deduplicate(phones),
},
{
label: "Domaines",
icon: "🔗",
items: deduplicate(domains),
},
{
label: "Hashes",
icon: "🔐",
items: deduplicate(hashes),
},
{
label: "Autres données",
icon: "📂",
items: deduplicate(others),
},
].filter(
(section) =>
section.items.length > 0
);

return {
query,

```
input_type: type,

identity_card: {
  name: query,

  confidence_summary: {
    verified,
    probable,
    candidate,
  },
},

sections: sections as any,

total_results:
  rows.length,

graph: {
  nodes: [],
  edges: [],
} as any,
```

};
}

// ============================================================================
// API FETCH
// ============================================================================

async function apiFetch(
path: string,
signal: AbortSignal
): Promise<Response> {
const timeoutController =
new AbortController();

const timeoutId =
window.setTimeout(() => {
timeoutController.abort();
}, REQUEST_TIMEOUT);

const abortHandler = () => {
timeoutController.abort();
};

signal.addEventListener(
"abort",
abortHandler,
{ once: true }
);

try {
const { data } =
await supabase.auth.getSession();

```
const token =
  data.session?.access_token || "";

return await fetch(
  `${BACKEND_URL}${path}`,
  {
    method: "GET",

    signal:
      timeoutController.signal,

    headers: {
      Accept:
        "application/json",

      ...(token
        ? {
            Authorization:
              `Bearer ${token}`,
          }
        : {}),
    },
  }
);
```

} finally {
window.clearTimeout(
timeoutId
);

```
signal.removeEventListener(
  "abort",
  abortHandler
);
```

}
}

// ============================================================================
// HOOK
// ============================================================================

export function useSearch():
UseSearchReturn {
const [state, setState] =
useState<SearchState>(
INITIAL
);

const cancelled =
useRef(false);

const controllerRef =
useRef<AbortController | null>(
null
);

// --------------------------------------------------------------------------
// CANCEL
// --------------------------------------------------------------------------

const cancelSearch =
useCallback(() => {
cancelled.current = true;

```
  controllerRef.current?.abort();

  setState((previous) => ({
    ...previous,
    inProgress: false,
    progressLabel:
      "Recherche annulée",
  }));
}, []);
```

// --------------------------------------------------------------------------
// RESET
// --------------------------------------------------------------------------

const reset =
useCallback(() => {
cancelled.current = true;

```
  controllerRef.current?.abort();

  setState(INITIAL);
}, []);
```

// --------------------------------------------------------------------------
// SEARCH
// --------------------------------------------------------------------------

const startSearch =
useCallback(
(
query: string,
_strategy: SearchStrategy
) => {
const cleanQuery =
query.trim();

```
    if (!cleanQuery) {
      return;
    }

    // Annule la recherche précédente
    controllerRef.current?.abort();

    cancelled.current = false;

    const controller =
      new AbortController();

    controllerRef.current =
      controller;

    setState({
      inProgress: true,

      progress: 10,

      progressLabel:
        "Recherche en cours...",

      toolChips: {
        local: "running",
      },

      result: null,

      errors: [],

      fromCache: false,
    });

    void (async () => {
      try {
        const encoded =
          encodeURIComponent(
            cleanQuery
          );

        // ----------------------------------------------------------------
        // ENDPOINT PRINCIPAL
        // ----------------------------------------------------------------

        let response =
          await apiFetch(
            `/search?q=${encoded}`,
            controller.signal
          );

        // ----------------------------------------------------------------
        // FALLBACK API
        // ----------------------------------------------------------------

        if (
          response.status === 404
        ) {
          response =
            await apiFetch(
              `/api/search?query=${encoded}`,
              controller.signal
            );
        }

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        // ----------------------------------------------------------------
        // JSON
        // ----------------------------------------------------------------

        const data:
          unknown =
          await response.json();

        if (
          cancelled.current
        ) {
          return;
        }

        // ----------------------------------------------------------------
        // EXTRACTION
        // ----------------------------------------------------------------

        const rows =
          extractRows(data);

        // ----------------------------------------------------------------
        // PROGRESSION
        // ----------------------------------------------------------------

        setState(
          (previous) => ({
            ...previous,

            progress: 60,

            progressLabel:
              "Organisation des résultats...",
          })
        );

        // ----------------------------------------------------------------
        // RESULTAT
        // ----------------------------------------------------------------

        const result =
          buildSearchResult(
            cleanQuery,
            rows
          );

        if (
          cancelled.current
        ) {
          return;
        }

        // ----------------------------------------------------------------
        // FIN
        // ----------------------------------------------------------------

        setState(
          (previous) => ({
            ...previous,

            inProgress: false,

            progress: 100,

            progressLabel:
              rows.length > 0
                ? `${rows.length} résultat(s) trouvé(s)`
                : "Aucun résultat trouvé",

            toolChips: {
              ...previous.toolChips,

              local: "done",
            },

            result,

            fromCache:
              isRecord(data)
                ? Boolean(
                    data.cached ||
                    data.from_cache
                  )
                : false,
          })
        );
      } catch (
        error: unknown
      ) {
        if (
          cancelled.current ||
          controller.signal.aborted
        ) {
          return;
        }

        const message =
          error instanceof Error
            ? error.name ===
              "AbortError"
              ? "La requête a expiré"
              : error.message
            : "Erreur de liaison avec le backend";

        console.error(
          "[OSINT] Erreur:",
          message
        );

        setState(
          (previous) => ({
            ...previous,

            inProgress: false,

            progress: 0,

            progressLabel:
              "Erreur de recherche",

            toolChips: {
              ...previous.toolChips,

              local: "error",
            },

            errors: [
              {
                tool: "local",
                message,
                status: "error",
              },
            ],
          })
        );
      } finally {
        if (
          controllerRef.current ===
          controller
        ) {
          controllerRef.current =
            null;
        }
      }
    })();
  },
  []
);
```

return {
...state,
startSearch,
cancelSearch,
reset,
};
}

// ============================================================================
// ALIAS
// ============================================================================

export {
useSearch as useOsintSearch,
};
