import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ChevronDown, CircleUserRound, Database, Download,
  FolderKanban, Gauge, HardDrive, LogOut, Menu, Plus, Search, Settings2,
  ShieldCheck, TriangleAlert, Trash2, X, Mail, MapPin, Globe, Gamepad2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createDossier, ensureRole, getAdminData, getDashboardData,
  getDossiers, removeDossier, saveSearchResult, toggleDossier,
} from "@/lib/osint-data";
import { useSearch as useOsintSearch } from "@/hooks/use-osint-search";
import LogAccordionList from "./components/LogAccordionList";
import type { Dossier, Graph, GraphNode, GraphEdge, ResultItem, SearchResult, SearchStrategy, TrustLevel, UserRole, EntityType } from "@/types/osint";

type View = "search" | "dashboard" | "dossiers" | "databases" | "admin";
type User = { id: string; email: string };

const strategyLabels: Record<SearchStrategy, string> = {
  balanced: "Équilibré", deep: "Profond", quick: "Rapide",
  social: "Social", infrastructure: "Infrastructure",
};

// ─── Sélecteur manuel de type de cible ──────────────────────────────────────
// L'utilisateur indique lui-même ce qu'il a en main plutôt que de laisser
// l'app deviner le type à partir du texte saisi.
const SEARCH_TYPE_OPTIONS: { value: EntityType; label: string; placeholder: string }[] = [
  { value: "email", label: "Email", placeholder: "ex: jean.dupont@email.com" },
  { value: "username", label: "Pseudo / Username", placeholder: "ex: jdupont92" },
  { value: "phone", label: "Téléphone", placeholder: "ex: +33 6 12 34 56 78" },
  { value: "ip", label: "Adresse IP", placeholder: "ex: 192.168.1.1" },
  { value: "domain", label: "Domaine", placeholder: "ex: exemple.com" },
  { value: "url", label: "URL", placeholder: "ex: https://exemple.com/page" },
  { value: "hash", label: "Hash", placeholder: "ex: 5f4dcc3b5aa765d61d8327deb882cf99" },
  { value: "name", label: "Nom complet", placeholder: "ex: Jean Dupont" },
  { value: "crypto", label: "Wallet crypto", placeholder: "ex: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" },
  { value: "social_profile", label: "Profil social", placeholder: "ex: instagram.com/jdupont" },
];

// ─── Recherche avancée par formulaire structuré ─────────────────────────────
// Sections accordéon type "état civil / coordonnées / réseaux…" : l'utilisateur
// remplit ce qu'il sait déjà, section par section, plutôt que de tout taper
// dans une seule barre.

interface AdvField {
  key: string;
  label: string;
  placeholder: string;
  type: EntityType;
}

interface AdvSection {
  id: string;
  label: string;
  icon: ReactNode;
  fields: AdvField[];
}

const ADV_SECTIONS: AdvSection[] = [
  {
    id: "identite",
    label: "État civil",
    icon: <CircleUserRound size={18} />,
    fields: [
      { key: "nom", label: "Nom", placeholder: "Dupont", type: "name" },
      { key: "prenom", label: "Prénom", placeholder: "Jean", type: "name" },
      { key: "pseudo", label: "Nom affiché / pseudo", placeholder: "Jean Dupont", type: "username" },
    ],
  },
  {
    id: "coordonnees",
    label: "Coordonnées",
    icon: <Mail size={18} />,
    fields: [
      { key: "email", label: "Email", placeholder: "jean.dupont@email.com", type: "email" },
      { key: "telephone", label: "Téléphone", placeholder: "+33 6 12 34 56 78", type: "phone" },
    ],
  },
  {
    id: "adresse",
    label: "Adresse",
    icon: <MapPin size={18} />,
    fields: [
      { key: "ville", label: "Ville", placeholder: "Paris", type: "location" },
      { key: "pays", label: "Pays", placeholder: "France", type: "location" },
    ],
  },
  {
    id: "reseaux",
    label: "Jeux & Réseaux",
    icon: <Gamepad2 size={18} />,
    fields: [
      { key: "username_reseau", label: "Nom d'utilisateur", placeholder: "jdupont92", type: "username" },
      { key: "url_profil", label: "URL du profil", placeholder: "instagram.com/jdupont", type: "url" },
    ],
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    icon: <Globe size={18} />,
    fields: [
      { key: "ip", label: "Adresse IP", placeholder: "192.168.1.1", type: "ip" },
      { key: "domaine", label: "Domaine", placeholder: "exemple.com", type: "domain" },
      { key: "hash", label: "Hash", placeholder: "5f4dcc3b5aa765d61d8327deb882cf99", type: "hash" },
    ],
  },
  {
    id: "autres",
    label: "Autres données",
    icon: <Plus size={18} />,
    fields: [
      { key: "crypto", label: "Wallet crypto", placeholder: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", type: "crypto" },
      { key: "note", label: "Note libre", placeholder: "Toute autre info utile...", type: "username" },
    ],
  },
];

// Ordre de priorité : si plusieurs champs sont remplis, on cherche d'abord sur
// l'identifiant le plus unique. Le backend actuel n'accepte encore qu'une
// seule requête + un seul type — cette fonction choisit donc le "meilleur"
// signal disponible parmi tout ce que l'utilisateur a saisi.
function computeAdvancedPrimary(fields: Record<string, string>): { query: string; type: EntityType } | null {
  const v = (key: string) => fields[key]?.trim() || "";

  const fullName = [v("prenom"), v("nom")].filter(Boolean).join(" ");
  const address = [v("ville"), v("pays")].filter(Boolean).join(", ");

  const candidates: { type: EntityType; value: string }[] = [
    { type: "email", value: v("email") },
    { type: "phone", value: v("telephone") },
    { type: "ip", value: v("ip") },
    { type: "domain", value: v("domaine") },
    { type: "hash", value: v("hash") },
    { type: "crypto", value: v("crypto") },
    { type: "url", value: v("url_profil") },
    { type: "username", value: v("username_reseau") },
    { type: "username", value: v("pseudo") },
    { type: "name", value: fullName },
    { type: "location", value: address },
    { type: "username", value: v("note") },
  ];

  const primary = candidates.find((c) => c.value.length >= 2);
  return primary ? { query: primary.value, type: primary.type } : null;
}

function normalizeName(value: string) {
  return value.replace(/_tool$/i, "").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function TrustBadge({ level }: { level: TrustLevel }) {
  const label = level === "VERIFIED" ? "Vérifié" : level === "PROBABLE" ? "Probable" : "Candidat";
  return (
    <span className={`trust-badge trust-${level.toLowerCase()}`}>
      {level === "VERIFIED" && <ShieldCheck />} {label}
    </span>
  );
}

function exportResult(result: SearchResult, format: "csv" | "md") {
  const safe = result.query.replace(/[^a-z0-9@._+-]/gi, "_");
  const rows = result.sections.flatMap((s) => s.items.map((item) => ({ section: s.label, ...item })));
  const content =
    format === "csv"
      ? [
          "Groupe,Plateforme,Identifiant,URL,Confiance",
          ...rows.map((item) =>
            [item.section, item.platform ?? item.category ?? "", item.username ?? item.email ?? item.ip ?? item.subdomain ?? "", item.url ?? "", item.trust_level]
              .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
              .join(",")
          ),
        ].join("\n")
      : [
          `# Enquête OSINT — ${result.query}`, "",
          ...rows.map(
            (item) =>
              `- **${item.section} · ${item.platform ?? item.category ?? "Source"}** — ${item.username ?? item.email ?? item.ip ?? item.subdomain ?? ""}${item.url ? ` — [ouvrir](${item.url})` : ""} — ${item.trust_level}`
          ),
        ].join("\n");
  const blob = new Blob([format === "csv" ? `\uFEFF${content}` : content], {
    type: format === "csv" ? "text/csv;charset=utf-8" : "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `osint_${safe}.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}

/* ─── Search View Helpers ─────────────────────────────────────────────────── */
function getSourceBadgeClass(source: string) {
  const s = source.toLowerCase();
  if (s.includes("leak") || s.includes("breach") || s.includes("db") || s.includes("comb") || s.includes("hacked")) {
    return "source-badge-leak";
  }
  if (s.includes("log") || s.includes("system") || s.includes("apache") || s.includes("nginx") || s.includes("audit") || s.includes("auth")) {
    return "source-badge-log";
  }
  return "source-badge-other";
}

function getRowType(item: any) {
  if (item.email) return "Email";
  if (item.username) return "Identifiant";
  if (item.ip) return "IP";
  if (item.subdomain || item.domain) return "Domaine";
  if (item.note && /^\+?[\d\s-]{6,15}$/.test(item.note)) return "Téléphone";
  if (item.hash_val || item.hash) return "Hash";
  return "Autre";
}

function getRowValue(item: any) {
  return item.email || item.username || item.ip || item.subdomain || item.domain || item.note || item.hash_val || item.hash || "—";
}

/* ─── Search View ─────────────────────────────────────────────────────────── */
function SearchView({ 
  strategy, 
  setStrategy,
  activeTables,
  tablesLoading,
  onRefreshTables
}: { 
  strategy: SearchStrategy; 
  setStrategy: (s: SearchStrategy) => void;
  activeTables: any[];
  tablesLoading: boolean;
  onRefreshTables: () => void;
}) {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<EntityType>("email");
  const [searchMode, setSearchMode] = useState<"quick" | "advanced">("quick");
  const [advFields, setAdvFields] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState<Set<string>>(new Set([ADV_SECTIONS[0].id]));
  const [filter, setFilter] = useState<TrustLevel | "ALL">("ALL");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [localFilter, setLocalFilter] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "sections" | "accordion">("accordion");
  
  const search = useOsintSearch();
  const activeTypeOption = SEARCH_TYPE_OPTIONS.find((opt) => opt.value === searchType) ?? SEARCH_TYPE_OPTIONS[0];
  const advPrimary = useMemo(() => computeAdvancedPrimary(advFields), [advFields]);
  const hasActivity = search.inProgress || Boolean(search.result);
  const searchStartRef = useRef<number>(0);
  const savedRef = useRef<string>("");

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (query.trim().length < 3 || search.inProgress) return;
    searchStartRef.current = Date.now();
    savedRef.current = "";
    search.startSearch(query.trim(), strategy, searchType);
    setCollapsed(new Set());
    setFilter("ALL");
    setLocalFilter("");
  };

  const submitAdvanced = (e?: FormEvent) => {
    e?.preventDefault();
    if (!advPrimary || search.inProgress) return;
    searchStartRef.current = Date.now();
    savedRef.current = "";
    search.startSearch(advPrimary.query, strategy, advPrimary.type);
    setCollapsed(new Set());
    setFilter("ALL");
    setLocalFilter("");
  };

  const updateAdvField = (key: string, value: string) => {
    setAdvFields((prev) => ({ ...prev, [key]: value }));
  };

  const clearAdvanced = () => setAdvFields({});

  const toggleSection = (id: string) => {
    setOpenSections((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!search.result || search.inProgress) return;
    if (savedRef.current === search.result.query) return;
    savedRef.current = search.result.query;
    const duration = Date.now() - searchStartRef.current;
    saveSearchResult(search.result as SearchResult, duration).catch(() => {});
  }, [search.result, search.inProgress]);

  const allItems = useMemo(() => {
    if (!search.result) return [];
    return search.result.sections.flatMap((s: any) => s.items);
  }, [search.result]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item: any) => {
      const matchTrust = filter === "ALL" || item.trust_level === filter;
      if (!matchTrust) return false;

      if (!localFilter.trim()) return true;
      const q = localFilter.toLowerCase().trim();
      const val = getRowValue(item).toLowerCase();
      const src = (item.source_data || item.platform || "").toLowerCase();
      const raw = (item.raw || "").toLowerCase();
      const type = getRowType(item).toLowerCase();
      return val.includes(q) || src.includes(q) || raw.includes(q) || type.includes(q);
    });
  }, [allItems, localFilter, filter]);

  return (
    <div className="search-page-container">
      <section className={`search-stage ${hasActivity ? "search-stage-active" : ""}`} aria-label="Recherche OSINT">
        <div className="search-intro">
          <span className="eyebrow"><span className="status-dot" /> Moteur d'investigation opérationnel</span>
          <h1>Révélez les connexions.<br /><span>Suivez chaque signal.</span></h1>
          <p>Un point d'entrée unique pour interroger emails, identités, domaines, adresses IP et empreintes numériques.</p>
        </div>

        <div className="mobile-active-tables">
          <details>
            <summary>
              <Database size={14} />
              <span>Bases chargées ({activeTables.length})</span>
            </summary>
            <div className="mobile-tables-list">
              {activeTables.map((t, idx) => {
                const name = t.name || t.path?.split(/[/\\]/).pop() || `Base ${idx + 1}`;
                return (
                  <div key={idx} className="mobile-table-item">
                    <span className="status-dot-active" />
                    <span>{name}</span>
                  </div>
                );
              })}
            </div>
          </details>
        </div>

        <div className="search-mode-tabs" role="tablist" aria-label="Mode de recherche">
          <button
            type="button" role="tab" aria-selected={searchMode === "quick"}
            className={`search-mode-tab ${searchMode === "quick" ? "active" : ""}`}
            onClick={() => setSearchMode("quick")}
          >
            Recherche rapide
          </button>
          <button
            type="button" role="tab" aria-selected={searchMode === "advanced"}
            className={`search-mode-tab ${searchMode === "advanced" ? "active" : ""}`}
            onClick={() => setSearchMode("advanced")}
          >
            Recherche avancée <span className="tab-badge">NOUVEAU</span>
          </button>
        </div>

        {searchMode === "quick" && (
        <form className="search-shell" onSubmit={submit}>
          <label className="sr-only" htmlFor="osint-type">Type de cible</label>
          <select
            id="osint-type"
            className="search-type-select"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as EntityType)}
            aria-label="Type de donnée recherchée"
          >
            {SEARCH_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor="osint-query">Cible à analyser</label>
          <input
            id="osint-query" value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={activeTypeOption.placeholder}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-gold btn-lg" disabled={query.trim().length < 3 || search.inProgress}>
            {search.inProgress ? "Analyse…" : "Rechercher"}
          </button>
        </form>
        )}

        {searchMode === "advanced" && (
        <form className="adv-search" onSubmit={submitAdvanced}>
          {ADV_SECTIONS.map((section) => {
            const isOpen = openSections.has(section.id);
            const filledCount = section.fields.filter((f) => advFields[f.key]?.trim()).length;
            return (
              <div className="result-window adv-search-section" key={section.id}>
                <button
                  type="button" className="window-header"
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="module-icon">{section.icon}</div>
                  <div>
                    <h2>{section.label}</h2>
                  </div>
                  {filledCount > 0 && <span className="adv-search-count">{filledCount}</span>}
                  <ChevronDown className={isOpen ? "" : "collapsed"} />
                </button>
                {isOpen && (
                  <div className="adv-search-body">
                    {section.fields.map((field) => (
                      <label className="adv-field" key={field.key}>
                        <span className="adv-field-label">{field.label}</span>
                        <span className="adv-field-input-wrap">
                          <input
                            value={advFields[field.key] || ""}
                            onChange={(e) => updateAdvField(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            autoComplete="off"
                          />
                          {advFields[field.key] && (
                            <button
                              type="button" className="adv-field-clear"
                              onClick={() => updateAdvField(field.key, "")}
                              aria-label={`Effacer ${field.label}`}
                            >
                              <X size={13} />
                            </button>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="adv-search-actions">
            <button type="button" className="btn btn-glass" onClick={clearAdvanced} disabled={Object.keys(advFields).length === 0}>
              Effacer
            </button>
            <button type="submit" className="btn btn-gold btn-lg" disabled={!advPrimary || search.inProgress}>
              <Search size={16} /> {search.inProgress ? "Analyse…" : "Rechercher"}
            </button>
          </div>
        </form>
        )}

        <div className="search-options">
          <label htmlFor="strategy"><Settings2 /> Stratégie</label>
          <select id="strategy" value={strategy} onChange={(e) => setStrategy(e.target.value as SearchStrategy)}>
            {Object.entries(strategyLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {search.inProgress && (
            <button className="btn btn-glass btn-sm" onClick={search.cancelSearch}>Arrêter</button>
          )}
        </div>

        {hasActivity && (
          <div className="results-flow">
            <div className="progress-glass" aria-live="polite">
              <div className="progress-header">
                <span>{search.progressLabel || "Initialisation des modules"}</span>
                <strong>{search.progress}%</strong>
              </div>
              <div className="progress-track"><span style={{ width: `${search.progress}%` }} /></div>
              {Object.keys(search.toolChips).length > 0 && (
                <div className="tool-stream">
                  {Object.entries(search.toolChips).map(([tool, status]) => (
                    <span key={tool} data-status={status}>{normalizeName(tool)}</span>
                  ))}
                </div>
              )}
            </div>

            {search.errors.length > 0 && (
              <div className="error-glass">
                <TriangleAlert />
                <div>
                  <strong>{search.errors.length} module(s) indisponible(s)</strong>
                  <p>{search.errors.map((e: any) => `${normalizeName(e.tool)} : ${e.message}`).join(" · ")}</p>
                </div>
              </div>
            )}

            {search.result?.identity_card && (
              <article className="result-window identity-window">
                <header>
                  <div className="module-icon">ID</div>
                  <div>
                    <h2>Identité numérique</h2>
                    <p>Profil consolidé à partir des sources corrélées</p>
                  </div>
                  <TrustBadge level={(search.result.identity_card.confidence_summary?.verified ?? 0) > 0 ? "VERIFIED" : "PROBABLE"} />
                </header>
                <div className="identity-content">
                  <div className="id-main">
                    <span className="id-label">Cible analysée</span>
                    <strong className="id-name">{search.result.identity_card.name || search.result.query}</strong>
                  </div>
                  <div className="confidence-grid">
                    <span><b>{search.result.identity_card.confidence_summary?.verified ?? 0}</b> vérifiés</span>
                    <span><b>{search.result.identity_card.confidence_summary?.probable ?? 0}</b> probables</span>
                    <span><b>{search.result.identity_card.confidence_summary?.candidate ?? 0}</b> candidats</span>
                  </div>
                </div>
              </article>
            )}

            {search.result && (
              <div className="result-controls-bar">
                <div className="view-mode-toggle">
                  <button 
                    type="button"
                    className={`btn btn-sm ${viewMode === "table" ? "btn-gold" : "btn-glass"}`} 
                    onClick={() => setViewMode("table")}
                  >
                    Vue Tableau
                  </button>
                  <button 
                    type="button"
                    className={`btn btn-sm ${viewMode === "sections" ? "btn-gold" : "btn-glass"}`} 
                    onClick={() => setViewMode("sections")}
                  >
                    Vue Groupée
                  </button>
                  <button 
                    type="button"
                    className={`btn btn-sm ${viewMode === "accordion" ? "btn-gold" : "btn-glass"}`} 
                    onClick={() => setViewMode("accordion")}
                  >
                    Vue Accordéon
                  </button>
                </div>
              </div>
            )}

            {search.result && viewMode === "table" && (
              <article className="result-window">
                <div className="window-header" style={{ borderBottom: "1px solid var(--border)", cursor: "default" }}>
                  <div className="module-icon">📋</div>
                  <div>
                    <h2>Tous les signaux</h2>
                    <p>{filteredItems.length} affiché(s) sur {allItems.length} signaux trouvés</p>
                  </div>
                </div>

                <div className="table-filter-bar">
                  <Search size={14} className="filter-icon" />
                  <input 
                    type="text" 
                    placeholder="Filtrer ces résultats localement (source, valeur, type...)" 
                    value={localFilter}
                    onChange={(e) => setLocalFilter(e.target.value)}
                    className="local-filter-input"
                  />
                  {localFilter && (
                    <button type="button" className="clear-filter-btn" onClick={() => setLocalFilter("")}>
                      ✕
                    </button>
                  )}
                </div>

                <div className="table-wrapper">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Type</th>
                        <th>Cible / Valeur</th>
                        <th>Confiance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="table-empty">
                            Aucun signal ne correspond aux critères de recherche locale.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item: any, idx: number) => {
                          const src = item.source_data || item.platform || "Inconnue";
                          const badgeClass = getSourceBadgeClass(src);
                          const typeLabel = getRowType(item);
                          const val = getRowValue(item);
                          return (
                            <tr key={idx}>
                              <td>
                                <span className={`source-badge ${badgeClass}`}>{src}</span>
                              </td>
                              <td className="cell-type">{typeLabel}</td>
                              <td className="cell-value">
                                {item.url ? (
                                  <a href={item.url} target="_blank" rel="noreferrer">{val}</a>
                                ) : (
                                  <span>{val}</span>
                                )}
                              </td>
                              <td>
                                <TrustBadge level={item.trust_level || "CANDIDATE"} />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {search.result && viewMode === "accordion" && (
              <div style={{ marginTop: "1rem" }}>
                <LogAccordionList
                  title="Résultats d'investigation détaillés"
                  items={filteredItems}
                />
              </div>
            )}

            {viewMode === "sections" && search.result?.sections.map((section: any, idx: number) => {
              const items = section.items.filter((item: any) => filter === "ALL" || item.trust_level === filter);
              if (!items.length) return null;
              const isCollapsed = collapsed.has(section.label);
              return (
                <article className="result-window" key={section.label} style={{ animationDelay: `${120 + idx * 90}ms` }}>
                  <button
                    className="window-header"
                    onClick={() => setCollapsed((cur) => { const n = new Set(cur); n.has(section.label) ? n.delete(section.label) : n.add(section.label); return n; })}
                    aria-expanded={!isCollapsed}
                  >
                    <div className="module-icon">{section.icon || "◎"}</div>
                    <div>
                      <h2>{section.label}</h2>
                      <p>{items.length} signal{items.length > 1 ? "aux" : ""} corrélé{items.length > 1 ? "s" : ""}</p>
                    </div>
                    <ChevronDown className={isCollapsed ? "collapsed" : ""} />
                  </button>
                  {!isCollapsed && (
                    <div className="window-list">
                      {items.map((item: any, i: number) => <ResultRow key={`${section.label}-${i}`} item={item} />)}
                    </div>
                  )}
                </article>
              );
            })}

            {search.result?.graph && <GraphView graph={search.result.graph} />}

            {search.result && (
              <div className="result-actions">
                <div className="filter-group">
                  {(["ALL", "VERIFIED", "PROBABLE", "CANDIDATE"] as const).map((level) => (
                    <button
                      key={level}
                      className={`btn btn-sm ${filter === level ? "btn-gold" : "btn-glass"}`}
                      onClick={() => setFilter(level)}
                    >
                      {level === "ALL" ? "Tous" : level}
                    </button>
                  ))}
                </div>
                <div>
                  <button className="btn btn-glass" onClick={() => exportResult(search.result as SearchResult, "csv")}>
                    <Download /> CSV
                  </button>
                  <button className="btn btn-glass" style={{ marginLeft: ".5rem" }} onClick={() => exportResult(search.result as SearchResult, "md")}>
                    <Download /> Obsidian
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── Graph View ──────────────────────────────────────────────────────────── */

const NODE_COLORS: Record<GraphNode["type"], string> = {
  query:    "var(--gold)",
  email:    "oklch(0.72 0.17 145)",
  username: "oklch(0.72 0.18 250)",
  ip:       "oklch(0.72 0.18 30)",
  domain:   "oklch(0.72 0.15 310)",
  phone:    "oklch(0.72 0.17 190)",
  hash:     "oklch(0.65 0.12 60)",
  alert:    "oklch(0.65 0.22 15)",
};

const NODE_ICONS: Record<GraphNode["type"], string> = {
  query: "🎯", email: "📧", username: "🏷️", ip: "🌍",
  domain: "🌐", phone: "📞", hash: "🔑", alert: "🚨",
};

function forceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  W: number, H: number,
  iterations = 120
): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
  const root = nodes.find(n => n.root || n.type === "query");

  const byType: Record<string, GraphNode[]> = {};
  nodes.forEach(n => { (byType[n.type] = byType[n.type] || []).push(n); });
  const types = Object.keys(byType);

  nodes.forEach(n => {
    if (root && n.id === root.id) {
      pos[n.id] = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
    } else {
      const ti = types.indexOf(n.type);
      const group = byType[n.type];
      const gi = group.indexOf(n);
      const baseAngle = (ti / types.length) * Math.PI * 2 - Math.PI / 2;
      const spread = group.length > 1 ? ((gi / (group.length - 1)) - 0.5) * 1.2 : 0;
      const radius = 120 + Math.min(group.length, 10) * 18;
      pos[n.id] = {
        x: W / 2 + Math.cos(baseAngle + spread) * radius + (Math.random() - 0.5) * 20,
        y: H / 2 + Math.sin(baseAngle + spread) * radius + (Math.random() - 0.5) * 20,
        vx: 0, vy: 0,
      };
    }
  });

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos[nodes[i].id], b = pos[nodes[j].id];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = (2500) / (dist * dist);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    edges.forEach(e => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const ideal = 160;
      const force = (dist - ideal) * 0.04 * (e.weight || 1);
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    });

    nodes.forEach(n => {
      const p = pos[n.id];
      p.vx += (W / 2 - p.x) * 0.01;
      p.vy += (H / 2 - p.y) * 0.01;
    });

    nodes.forEach(n => {
      const p = pos[n.id];
      if (root && n.id === root.id) { p.vx = 0; p.vy = 0; return; }
      p.x += p.vx * cooling;
      p.y += p.vy * cooling;
      p.vx *= 0.7;
      p.vy *= 0.7;
      p.x = Math.max(40, Math.min(W - 40, p.x));
      p.y = Math.max(40,
