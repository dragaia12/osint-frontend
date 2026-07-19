import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import {
  ChevronDown, CircleUserRound, Database, Download,
  FolderKanban, Gauge, HardDrive, LogOut, Menu, Plus, Search, Settings2,
  ShieldCheck, TriangleAlert, Trash2, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createDossier, ensureRole, getAdminData, getDashboardData,
  getDossiers, removeDossier, saveSearchResult, toggleDossier,
} from "@/lib/osint-data";
import { useSearch as useOsintSearch } from "@/hooks/use-osint-search";
import type { Dossier, Graph, GraphNode, GraphEdge, ResultItem, SearchResult, SearchStrategy, TrustLevel, UserRole } from "@/types/osint";

type View = "search" | "dashboard" | "dossiers" | "databases" | "admin";
type User = { id: string; email: string };

const strategyLabels: Record<SearchStrategy, string> = {
  balanced: "Équilibré", deep: "Profond", quick: "Rapide",
  social: "Social", infrastructure: "Infrastructure",
};

function detectType(value: string) {
  const q = value.trim();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(q)) return "IP";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) return "Email";
  if (/^https?:\/\//i.test(q)) return "URL";
  if (/^\+?[\d\s-]{6,15}$/.test(q)) return "Téléphone";
  if (/^[a-f\d]{32,64}$/i.test(q)) return "Hash";
  if (/^[\w-]+\.[a-z]{2,}$/i.test(q)) return "Domaine";
  return q.includes(" ") ? "Nom" : "Username";
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

/* ─── Search View ─────────────────────────────────────────────────────────── */
function SearchView({ strategy, setStrategy }: { strategy: SearchStrategy; setStrategy: (s: SearchStrategy) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TrustLevel | "ALL">("ALL");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const search = useOsintSearch();
  const detected = query.trim() ? detectType(query) : "";
  const hasActivity = search.inProgress || Boolean(search.result);
  const searchStartRef = useRef<number>(0);
  const savedRef = useRef<string>("");

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || search.inProgress) return;
    searchStartRef.current = Date.now();
    savedRef.current = "";
    search.startSearch(query.trim(), strategy);
    setCollapsed(new Set());
    setFilter("ALL");
  };

  // CORRIGÉ : persiste la recherche dans Supabase quand elle se termine
  // (alimente le dashboard + l'historique, qui restaient à 0 avant).
  useEffect(() => {
    if (!search.result || search.inProgress) return;
    if (savedRef.current === search.result.query) return; // déjà sauvegardé
    savedRef.current = search.result.query;
    const duration = Date.now() - searchStartRef.current;
    saveSearchResult(search.result as SearchResult, duration).catch(() => { /* silencieux */ });
  }, [search.result, search.inProgress]);

  return (
    <section className={`search-stage ${hasActivity ? "search-stage-active" : ""}`} aria-label="Recherche OSINT">
      <div className="search-intro">
        <span className="eyebrow"><span className="status-dot" /> Moteur d'investigation opérationnel</span>
        <h1>Révélez les connexions.<br /><span>Suivez chaque signal.</span></h1>
        <p>Un point d'entrée unique pour interroger emails, identités, domaines, adresses IP et empreintes numériques.</p>
      </div>

      <form className="search-shell" onSubmit={submit}>
        <Search aria-hidden="true" />
        <label className="sr-only" htmlFor="osint-query">Cible à analyser</label>
        <input
          id="osint-query" value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Email, username, IP, domaine, téléphone…"
          autoComplete="off"
        />
        {detected && <span className="detect-pill">{detected}</span>}
        <button type="submit" className="btn btn-gold btn-lg" disabled={!query.trim() || search.inProgress}>
          {search.inProgress ? "Analyse…" : "Rechercher"}
        </button>
      </form>

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
                <p>{search.errors.map((e) => `${normalizeName(e.tool)} : ${e.message}`).join(" · ")}</p>
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

          {search.result?.sections.map((section, idx) => {
            const items = section.items.filter((item) => filter === "ALL" || item.trust_level === filter);
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
                    {items.map((item, i) => <ResultRow key={`${section.label}-${i}`} item={item} />)}
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
  );
}


/* ─── Graph View ──────────────────────────────────────────────────────────── */

const NODE_COLORS: Record<GraphNode["type"], string> = {
  query:    "var(--gold)",
  email:    "oklch(0.72 0.17 145)",
  username: "oklch(0.72 0.18 250)",
  ip:       "oklch(0.72 0.18 30)",
  domain:   "oklch(0.72 0.15 310)",
  phone:    "oklch(0.72 0.17 190)",
  hash:     "oklch(0.65 0.12 60)",
  alert:    "oklch(0.65 0.22 15)",
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
      p.y = Math.max(40, Math.min(H - 40, p.y));
    });
  }

  const result: Record<string, { x: number; y: number }> = {};
  nodes.forEach(n => { result[n.id] = { x: pos[n.id].x, y: pos[n.id].y }; });
  return result;
}

function GraphView({ graph }: { graph: Graph }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const W = 900, H = 580;

  const visibleNodes = useMemo(() =>
    filter === "all" ? graph.nodes : graph.nodes.filter(n => n.type === filter || n.root),
  [graph.nodes, filter]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map(n => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(() =>
    graph.edges.filter(e => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)),
  [graph.edges, visibleNodeIds]);

  const positions = useMemo(() =>
    forceLayout(visibleNodes, visibleEdges, W, H),
  [visibleNodes, visibleEdges]);

  const selectedEdges = useMemo(() => {
    if (!selected) return new Set<number>();
    return new Set(visibleEdges.map((e, i) =>
      (e.from === selected || e.to === selected) ? i : -1
    ).filter(i => i >= 0));
  }, [selected, visibleEdges]);

  const types = useMemo(() => {
    const t = new Set(graph.nodes.map(n => n.type));
    t.delete("query");
    return Array.from(t);
  }, [graph.nodes]);

  if (!graph.nodes.length) return null;

  // CORRIGÉ : gestion du pinch/zoom tactile pour mobile
  const touchState = useRef<{ dist: number; zoom: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragging.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, panX: pan.x, panY: pan.y };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchState.current = { dist: Math.hypot(dx, dy), zoom };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && dragging.current) {
      setPan({
        x: dragging.current.panX + (e.touches[0].clientX - dragging.current.startX),
        y: dragging.current.panY + (e.touches[0].clientY - dragging.current.startY),
      });
    } else if (e.touches.length === 2 && touchState.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / touchState.current.dist;
      setZoom(Math.max(0.3, Math.min(3, touchState.current.zoom * ratio)));
    }
  };
  const onTouchEnd = () => {
    dragging.current = null;
    touchState.current = null;
  };

  return (
    <article className="result-window graph-window">
      <header style={{ cursor: "default" }}>
        <div className="module-icon">🕸️</div>
        <div>
          <h2>Arbre de connexions</h2>
          <p>{graph.nodes.length} nœuds · {graph.edges.length} liens</p>
        </div>
        <div className="graph-controls" style={{ marginLeft: "auto", display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button className="graph-btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>⌖ Reset</button>
          <button className="graph-btn" onClick={() => setZoom(z => Math.min(3, z + 0.2))}>＋</button>
          <button className="graph-btn" onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}>－</button>
          <select
            className="graph-btn"
            value={filter}
            onChange={e => { setFilter(e.target.value); setSelected(null); }}
            style={{ cursor: "pointer" }}
          >
            <option value="all">Tous les types</option>
            {types.map(t => (
              <option key={t} value={t}>{NODE_ICONS[t as GraphNode["type"]] || "●"} {t}</option>
            ))}
          </select>
        </div>
      </header>

      <div
        ref={containerRef}
        className="graph-stage"
        style={{ position: "relative", overflow: "hidden", cursor: dragging.current ? "grabbing" : "grab", touchAction: "none" }}
        onMouseDown={e => {
          dragging.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
        }}
        onMouseMove={e => {
          if (!dragging.current) return;
          setPan({
            x: dragging.current.panX + (e.clientX - dragging.current.startX),
            y: dragging.current.panY + (e.clientY - dragging.current.startY),
          });
        }}
        onMouseUp={() => { dragging.current = null; }}
        onMouseLeave={() => { dragging.current = null; }}
        onWheel={e => {
          e.preventDefault();
          setZoom(z => Math.max(0.2, Math.min(4, z - e.deltaY * 0.001)));
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{
            width: "100%", height: "100%",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: dragging.current ? "none" : "transform 0.1s",
          }}
        >
          <defs>
            <marker id="arrow" markerWidth="7" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 z" fill="var(--border)" opacity="0.6" />
            </marker>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Arêtes */}
          {visibleEdges.map((e, i) => {
            const f = positions[e.from], t = positions[e.to];
            if (!f || !t) return null;
            const isHighlighted = selectedEdges.has(i);
            const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2;
            const dx = t.x - f.x, dy = t.y - f.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nodeR = 20;
            const x1 = f.x + (dx / len) * nodeR;
            const y1 = f.y + (dy / len) * nodeR;
            const x2 = t.x - (dx / len) * (nodeR + 6);
            const y2 = t.y - (dy / len) * (nodeR + 6);
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isHighlighted ? "var(--gold)" : "var(--border)"}
                  strokeWidth={isHighlighted ? 2 : 1}
                  markerEnd="url(#arrow)"
                  opacity={selected && !isHighlighted ? 0.15 : 0.7}
                />
                {isHighlighted && (
                  <text x={mx} y={my - 5} textAnchor="middle"
                    fontSize="7" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nœuds */}
          {visibleNodes.map(node => {
            const p = positions[node.id];
            if (!p) return null;
            const isRoot   = node.root || node.type === "query";
            const isSel    = node.id === selected;
            const isDimmed = selected && !isSel && !selectedEdges.size;
            const r        = isRoot ? 30 : 20;
            const color    = NODE_COLORS[node.type] || "var(--muted-foreground)";
            const icon     = NODE_ICONS[node.type] || "●";
            const short    = node.label.length > 18 ? node.label.slice(0, 16) + "…" : node.label;

            return (
              <g key={node.id}
                style={{ cursor: "pointer" }}
                opacity={isDimmed ? 0.25 : 1}
                onClick={() => setSelected(isSel ? null : node.id)}
                onMouseEnter={() => setTooltip({ x: p.x, y: p.y, node })}
                onMouseLeave={() => setTooltip(null)}
                filter={isSel ? "url(#glow)" : undefined}
              >
                <circle cx={p.x} cy={p.y} r={r + (isSel ? 4 : 0)}
                  fill={`color-mix(in oklab, ${color} ${isRoot ? 25 : 15}%, #0d0e12)`}
                  stroke={color}
                  strokeWidth={isRoot ? 2.5 : isSel ? 2 : 1.5}
                />
                <text x={p.x} y={p.y - 3} textAnchor="middle"
                  fontSize={isRoot ? 14 : 11} fill={color}>
                  {icon}
                </text>
                <text x={p.x} y={p.y + r + 12} textAnchor="middle"
                  fontSize="7.5" fill={color} fontFamily="var(--font-mono)"
                  style={{ pointerEvents: "none" }}>
                  {short}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip flottant */}
        {tooltip && (
          <div style={{
            position: "absolute",
            left: "50%", top: "12px",
            transform: "translateX(-50%)",
            background: "var(--glass)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "8px 14px",
            fontSize: "12px",
            color: "var(--foreground)",
            pointerEvents: "none",
            backdropFilter: "blur(12px)",
            maxWidth: "420px",
            wordBreak: "break-all",
            zIndex: 10,
          }}>
            <span style={{ color: NODE_COLORS[tooltip.node.type] }}>
              {NODE_ICONS[tooltip.node.type]} {tooltip.node.type}
            </span>
            {" · "}
            <strong>{tooltip.node.label}</strong>
            {tooltip.node.source && (
              <span style={{ color: "var(--muted-foreground)", marginLeft: "8px" }}>
                ({tooltip.node.source})
              </span>
            )}
          </div>
        )}

        {/* Légende */}
        <div className="graph-legend">
          {Object.entries(NODE_COLORS).filter(([t]) => graph.nodes.some(n => n.type === t)).map(([type, color]) => (
            <span key={type} style={{ color, cursor: "pointer", opacity: filter === type || filter === "all" ? 1 : 0.4 }}
              onClick={() => setFilter(filter === type ? "all" : type)}>
              <span style={{ background: color }} />{NODE_ICONS[type as GraphNode["type"]]} {type}
            </span>
          ))}
        </div>
      </div>

      {/* Détail nœud sélectionné */}
      {selected && (() => {
        const node = visibleNodes.find(n => n.id === selected);
        if (!node) return null;
        const links = visibleEdges
          .filter(e => e.from === selected || e.to === selected)
          .map(e => {
            const otherId = e.from === selected ? e.to : e.from;
            const other   = visibleNodes.find(n => n.id === otherId);
            return { label: e.label, other };
          });
        return (
          <div style={{
            borderTop: "1px solid var(--border)", padding: "12px 16px",
            fontSize: "12px", color: "var(--muted-foreground)",
          }}>
            <strong style={{ color: NODE_COLORS[node.type] }}>
              {NODE_ICONS[node.type]} {node.label}
            </strong>
            {" — "}
            <span>{links.length} connexion(s)</span>
            <div style={{ marginTop: "6px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {links.slice(0, 12).map((l, i) => l.other && (
                <span key={i} style={{
                  background: "var(--glass)", border: "1px solid var(--border)",
                  borderRadius: "6px", padding: "2px 8px",
                  color: NODE_COLORS[l.other.type] || "var(--foreground)",
                }}>
                  {l.label} → {l.other.label.slice(0, 30)}
                </span>
              ))}
            </div>
          </div>
        );
      })()}
    </article>
  );
}

function ResultRow({ item }: { item: ResultItem }) {
  const identity = item.username || item.email || item.ip || item.subdomain || item.note || item.description || "Signal détecté";
  return (
    <div className="result-row">
      <div>
        <strong>{normalizeName(item.platform || item.category || "Source")}</strong>
        {item.url
          ? <a href={item.url} target="_blank" rel="noreferrer">{identity}</a>
          : <span>{identity}</span>
        }
      </div>
      <TrustBadge level={item.trust_level || "CANDIDATE"} />
    </div>
  );
}

/* ─── Dashboard ───────────────────────────────────────────────────────────── */
function DashboardView() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardData>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getDashboardData().then(setData).catch((e: Error) => setError(e.message));
  }, []);
  return (
    <Page title="Intelligence dashboard" subtitle="Vue synthétique de votre activité d'investigation.">
      {error && <InlineError text={error} />}
      {!data ? <Loading /> : (
        <>
          <div className="metrics">
            <Metric icon={<FolderKanban />} value={data.dossiers} label="Dossiers" />
            <Metric icon={<Search />} value={data.searches} label="Analyses" />
            <Metric icon={<Database />} value={data.entities} label="Entités" />
          </div>
          <div className="data-window">
            <h2>Analyses récentes</h2>
            {data.recent.length === 0 ? <Empty text="Aucune analyse enregistrée." /> : data.recent.map((item) => (
              <div className="history-row" key={item.id}>
                <span>{new Date(item.created_at).toLocaleDateString("fr-FR")}</span>
                <strong>{item.query}</strong>
                <em>{normalizeName(item.input_type as string)}</em>
                <b>{item.nb_resultats} rés.</b>
              </div>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

/* ─── Dossiers ────────────────────────────────────────────────────────────── */
function DossiersView() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getDossiers().then(setDossiers).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!titre.trim()) return;
    try {
      const d = await createDossier(titre, description);
      setDossiers((cur) => [d, ...cur]);
      setTitre(""); setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    }
  };

  return (
    <Page title="Dossiers d'investigation" subtitle="Organisez les recherches, preuves et pistes sans perdre le fil.">
      <form className="dossier-form" onSubmit={create}>
        <label><span>Titre</span><input value={titre} onChange={(e) => setTitre(e.target.value)} required maxLength={255} /></label>
        <label><span>Description</span><input value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <button type="submit" className="btn btn-gold">Créer le dossier</button>
      </form>
      {error && <InlineError text={error} />}
      {loading ? <Loading /> : dossiers.length === 0 ? <Empty text="Créez votre première investigation." /> : (
        <div className="dossier-list">
          {dossiers.map((d) => (
            <article key={d.id}>
              <div>
                <span className={`dossier-status status-${d.statut}`} />
                <h2>{d.titre}</h2>
                <p>{d.description || "Sans description"}</p>
              </div>
              <div>
                <span>{new Date(d.created_at).toLocaleDateString("fr-FR")}</span>
                <button className="btn btn-glass btn-sm" onClick={async () => {
                  const updated = await toggleDossier(d);
                  setDossiers((cur) => cur.map((x) => x.id === d.id ? updated : x));
                }}>
                  {d.statut === "actif" ? "Archiver" : "Réactiver"}
                </button>
                <button className="btn btn-glass btn-sm" onClick={async () => {
                  if (!window.confirm("Supprimer ce dossier et toutes ses données ?")) return;
                  await removeDossier(d.id);
                  setDossiers((cur) => cur.filter((x) => x.id !== d.id));
                }}>
                  Supprimer
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}

/* ─── Admin ───────────────────────────────────────────────────────────────── */
function AdminView() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminData>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getAdminData().then(setData).catch((e: Error) => setError(e.message));
  }, []);
  const stats = data?.stats as Record<string, number> | undefined;
  return (
    <Page title="Administration" subtitle="Utilisateurs, activité et santé globale de la plateforme.">
      {error && <InlineError text={error} />}
      {!data ? <Loading /> : (
        <>
          <div className="metrics">
            <Metric value={stats?.total_users ?? 0} label="Utilisateurs" />
            <Metric value={stats?.total_recherches ?? 0} label="Analyses" />
            <Metric value={stats?.total_entites ?? 0} label="Entités" />
          </div>
          <div className="data-window">
            <h2>Utilisateurs</h2>
            {(data.users as Array<{ id: string; email: string; role: string; nb_dossiers: number; nb_recherches: number }>).map((u) => (
              <div className="history-row" key={u.id}>
                <strong>{u.email}</strong>
                <em>{u.role}</em>
                <span>{u.nb_dossiers} dossiers</span>
                <b>{u.nb_recherches} analyses</b>
              </div>
            ))}
          </div>
          <div className="data-window">
            <h2>Journal d'activité</h2>
            {(data.logs as Array<{ id: string; user_email: string; action: string; resource?: string; created_at: string }>).slice(0, 20).map((log) => (
              <div className="history-row" key={log.id}>
                <span>{new Date(log.created_at).toLocaleString("fr-FR")}</span>
                <strong>{log.user_email}</strong>
                <em>{log.action}</em>
                <b>{log.resource || "—"}</b>
              </div>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

/* ─── Shared primitives ───────────────────────────────────────────────────── */
function Page({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="page-view">
      <header>
        <span className="eyebrow">OSINT HUB / v7.5</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
      {children}
    </section>
  );
}
function Metric({ icon, value, label }: { icon?: ReactNode; value: number; label: string }) {
  return <div className="metric">{icon}<strong>{value.toLocaleString("fr-FR")}</strong><span>{label}</span></div>;
}
function Loading() { return <div className="loading"><span className="spinner" /> Chargement des données…</div>; }
function Empty({ text }: { text: string }) { return <div className="empty"><Database /><p>{text}</p></div>; }
function InlineError({ text }: { text: string }) {
  return <div className="error-glass"><TriangleAlert /><span>{text}</span></div>;
}

/* ─── Auth screen ─────────────────────────────────────────────────────────── */
// ── DATABASES VIEW ────────────────────────────────────────────

interface DbEntry {
  id: string;
  name: string;
  path: string;
  size_mb: number;
  auto: boolean;
  active: boolean;
  exists: boolean;
}

interface DbStats {
  tables: { name: string; rows: number | null; columns: string[] }[];
}

const BACKEND_URL = (import.meta.env.VITE_OSINT_BACKEND_URL as string) || "";

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

function DatabasesView() {
  const [dbs, setDbs] = useState<DbEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addPath, setAddPath] = useState("");
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, DbStats>>({});
  const [statsLoading, setStatsLoading] = useState<string | null>(null);

  const loadDbs = async () => {
    if (!BACKEND_URL) { setLoading(false); setError("Backend non configuré (VITE_OSINT_BACKEND_URL manquant)."); return; }
    setLoading(true); setError("");
    try {
      const res = await apiFetch("/databases");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDbs(data.databases ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de connexion au backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDbs(); }, []);

  const handleAdd = async () => {
    if (!addPath.trim()) return;
    setAdding(true); setAddError("");
    try {
      const res = await apiFetch("/databases", {
        method: "POST",
        body: JSON.stringify({ path: addPath.trim(), name: addName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`);
      setAddPath(""); setAddName("");
      await loadDbs();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const res = await apiFetch(`/databases/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setDbs((prev) => prev.filter((d) => d.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erreur lors de la suppression.");
    }
  };

  const toggleStats = async (db: DbEntry) => {
    if (expandedId === db.id) { setExpandedId(null); return; }
    setExpandedId(db.id);
    if (stats[db.id]) return;
    setStatsLoading(db.id);
    try {
      const res = await apiFetch(`/databases/${db.id}/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats((prev) => ({ ...prev, [db.id]: { tables: data.tables ?? [] } }));
    } catch {
      setStats((prev) => ({ ...prev, [db.id]: { tables: [] } }));
    } finally {
      setStatsLoading(null);
    }
  };

  return (
    <Page title="Bases de données" subtitle="Gestion des bases DuckDB disponibles">
      {/* Add manually */}
      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Plus size={16} /> Ajouter une base manuellement
        </h3>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            className="search-input"
            style={{ flex: "2 1 260px" }}
            placeholder="Chemin absolu — ex: /data/breaches/leak2025.duckdb"
            value={addPath}
            onChange={(e) => setAddPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <input
            className="search-input"
            style={{ flex: "1 1 160px" }}
            placeholder="Nom affiché (optionnel)"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
          />
          <button className="btn btn-gold" onClick={handleAdd} disabled={adding || !addPath.trim()}>
            {adding ? "Ajout…" : "Ajouter"}
          </button>
          <button className="btn btn-glass" onClick={loadDbs} title="Rafraîchir la détection automatique">↻ Rafraîchir</button>
        </div>
        {addError && <p style={{ color: "var(--danger)", marginTop: "0.5rem", fontSize: "0.85rem" }}>{addError}</p>}
      </section>

      {/* Database list */}
      {loading && <Loading />}
      {error && <InlineError text={error} />}
      {!loading && !error && dbs.length === 0 && (
        <Empty text="Aucune base DuckDB détectée. Placez des fichiers .duckdb dans le dossier osint_data/ ou ajoutez-en un manuellement." />
      )}
      {!loading && dbs.map((db) => (
        <div key={db.id} className="card" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <HardDrive size={18} style={{ flexShrink: 0, color: db.active ? "var(--gold)" : db.exists ? "var(--text-secondary)" : "var(--danger)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "0.95rem" }}>{db.name}</strong>
                {db.active && <span style={{ fontSize: "0.7rem", background: "var(--gold)", color: "#000", borderRadius: "4px", padding: "1px 6px", fontWeight: 700 }}>ACTIVE</span>}
                {!db.auto && <span style={{ fontSize: "0.7rem", background: "var(--glass)", border: "1px solid var(--border)", borderRadius: "4px", padding: "1px 6px" }}>Manuelle</span>}
                {!db.exists && <span style={{ fontSize: "0.7rem", background: "rgba(255,60,60,0.2)", color: "var(--danger)", borderRadius: "4px", padding: "1px 6px" }}>Fichier introuvable</span>}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {db.path}
              </div>
            </div>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{db.size_mb} MB</span>
            <button className="btn btn-glass" style={{ fontSize: "0.8rem", padding: "4px 10px" }} onClick={() => toggleStats(db)}>
              {expandedId === db.id ? "Masquer" : "Inspecter"}
            </button>
            {!db.auto && (
              <button className="btn btn-glass btn-icon" title="Retirer de la liste" onClick={() => handleRemove(db.id)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {/* Stats panel */}
          {expandedId === db.id && (
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
              {statsLoading === db.id && <Loading />}
              {stats[db.id] && stats[db.id].tables.length === 0 && <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Aucune table trouvée.</p>}
              {stats[db.id]?.tables.map((t) => (
                <div key={t.name} style={{ marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "baseline" }}>
                    <strong style={{ fontSize: "0.88rem" }}>{t.name}</strong>
                    {t.rows !== null && <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{t.rows.toLocaleString()} lignes</span>}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                    Colonnes : {t.columns.join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </Page>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User, role: UserRole) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setInfo("");
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (result.error) setError(result.error.message);
    else if (result.data.user && result.data.session) {
      const role = await ensureRole(result.data.user.email ?? email);
      onAuthenticated({ id: result.data.user.id, email: result.data.user.email ?? email }, role);
    } else setInfo("Compte créé. Vérifiez votre email avant de vous connecter.");
    setLoading(false);
  };

  const submitForgot = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: window.location.origin,
    });
    if (resetError) setError(resetError.message);
    else setForgotSent(true);
    setLoading(false);
  };

  if (forgotMode) {
    return (
      <main className="auth-screen">
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <section className="auth-glass">
          <span className="brand-mark">OH</span>
          <div className="auth-copy">
            <span className="eyebrow">Plateforme de renseignement v7</span>
            <h1>OSINT <em>HUB</em></h1>
            <p>Recevez un lien pour réinitialiser votre mot de passe.</p>
          </div>
          {forgotSent ? (
            <>
              <p className="success-message">
                Si un compte existe pour {forgotEmail}, un email avec un lien de réinitialisation vient d'être envoyé. Vérifiez aussi vos spams.
              </p>
              <button
                type="button"
                className="btn btn-glass btn-lg"
                onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(""); }}
              >
                Retour à la connexion
              </button>
            </>
          ) : (
            <form onSubmit={submitForgot}>
              <label><span>Email</span><input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required /></label>
              {error && <InlineError text={error} />}
              <button type="submit" className="btn btn-gold btn-lg" disabled={loading}>
                {loading ? "Envoi…" : "Envoyer le lien"}
              </button>
              <button
                type="button"
                className="btn btn-glass btn-lg"
                style={{ marginTop: "0.5rem" }}
                onClick={() => { setForgotMode(false); setError(""); }}
              >
                Retour à la connexion
              </button>
            </form>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="auth-screen">
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <section className="auth-glass">
        <span className="brand-mark">OH</span>
        <div className="auth-copy">
          <span className="eyebrow">Plateforme de renseignement v7</span>
          <h1>OSINT <em>HUB</em></h1>
          <p>Transformez un signal isolé en piste exploitable.</p>
        </div>
        <form onSubmit={submit}>
          <div className="auth-tabs">
            <button type="button" className={`btn ${mode === "login" ? "btn-gold" : "btn-glass"}`} onClick={() => setMode("login")}>Connexion</button>
            <button type="button" className={`btn ${mode === "register" ? "btn-gold" : "btn-glass"}`} onClick={() => setMode("register")}>Inscription</button>
          </div>
          <label><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label><span>Mot de passe</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === "register" ? 8 : 1} required /></label>
          {error && <InlineError text={error} />}
          {info && <p className="success-message">{info}</p>}
          <button type="submit" className="btn btn-gold btn-lg" disabled={loading}>
            {loading ? "Vérification…" : mode === "login" ? "Accéder à la plateforme" : "Créer mon accès"}
          </button>
          {mode === "login" && (
            <button
              type="button"
              className="btn-link"
              style={{ marginTop: "0.75rem", background: "none", border: "none", color: "var(--text-secondary)", textDecoration: "underline", cursor: "pointer", fontSize: "0.85rem" }}
              onClick={() => setForgotMode(true)}
            >
              Mot de passe oublié ?
            </button>
          )}
        </form>
      </section>
    </main>
  );
}

function ResetPasswordScreen({ onDone }: { onDone: (user: User, role: UserRole) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("8 caractères minimum."); return; }
    if (password !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const { data, error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setLoading(false); return; }
    const email = data.user?.email ?? "";
    const role = await ensureRole(email);
    onDone({ id: data.user!.id, email }, role);
    setLoading(false);
  };

  return (
    <main className="auth-screen">
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <section className="auth-glass">
        <span className="brand-mark">OH</span>
        <div className="auth-copy">
          <span className="eyebrow">Plateforme de renseignement v7</span>
          <h1>OSINT <em>HUB</em></h1>
          <p>Choisissez votre nouveau mot de passe.</p>
        </div>
        <form onSubmit={submit}>
          <label><span>Nouveau mot de passe</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
          <label><span>Confirmer le mot de passe</span><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required /></label>
          {error && <InlineError text={error} />}
          <button type="submit" className="btn btn-gold btn-lg" disabled={loading}>
            {loading ? "Mise à jour…" : "Définir le mot de passe"}
          </button>
        </form>
      </section>
    </main>
  );
}

/* ─── App root ────────────────────────────────────────────────────────────── */
export function OsintApp() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>("utilisateur");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("search");
  const [strategy, setStrategy] = useState<SearchStrategy>("balanced");
  const [menuOpen, setMenuOpen] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const email = data.session.user.email ?? "analyste";
        setUser({ id: data.session.user.id, email });
        setRole(await ensureRole(email));
      }
    }).finally(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      } else if (!session) {
        setUser(null); setRole("utilisateur");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const nav = useMemo(() => [
    { id: "search" as const, label: "Recherche", icon: <Search /> },
    { id: "dashboard" as const, label: "Tableau de bord", icon: <Gauge /> },
    { id: "dossiers" as const, label: "Dossiers", icon: <FolderKanban /> },
    { id: "databases" as const, label: "Bases de données", icon: <HardDrive /> },
    ...(role === "administrateur" ? [{ id: "admin" as const, label: "Admin", icon: <ShieldCheck /> }] : []),
  ], [role]);

  if (loading) return <main className="auth-screen"><Loading /></main>;
  if (recoveryMode) {
    return (
      <ResetPasswordScreen
        onDone={(u, r) => { setUser(u); setRole(r); setRecoveryMode(false); }}
      />
    );
  }
  if (!user) return <AuthScreen onAuthenticated={(u, r) => { setUser(u); setRole(r); }} />;

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Ouvrir la navigation">
          <Menu />
        </button>
        <button className="brand-button" onClick={() => setView("search")}>
          <span>OSINT HUB</span><small>v7.5</small>
        </button>
        <nav aria-label="Navigation principale">
          {nav.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="account">
          <div className="status-label"><span className="status-dot" /> Système nominal</div>
          <span className="avatar">{user.email.charAt(0).toUpperCase()}</span>
          <button className="btn btn-glass btn-icon" aria-label="Se déconnecter" onClick={() => supabase.auth.signOut()}>
            <LogOut />
          </button>
        </div>
      </header>

      <main>
        {view === "search" && <SearchView strategy={strategy} setStrategy={setStrategy} />}
        {view === "dashboard" && <DashboardView />}
        {view === "dossiers" && <DossiersView />}
        {view === "databases" && <DatabasesView />}
        {view === "admin" && role === "administrateur" && <AdminView />}
      </main>

      <footer className="statusbar">
        <span>Session sécurisée</span>
        <span><span className="status-dot" /> Base de données connectée</span>
        <span>Stratégie : <b>{strategyLabels[strategy]}</b></span>
      </footer>

      {menuOpen && (
        <div className="mobile-drawer">
          <button className="drawer-backdrop" onClick={() => setMenuOpen(false)} aria-label="Fermer la navigation" />
          <aside>
            <button className="btn btn-glass btn-icon" aria-label="Fermer" onClick={() => setMenuOpen(false)}><X /></button>
            <CircleUserRound />
            <strong>{user.email}</strong>
            {nav.map((item) => (
              <button key={item.id} className={`btn ${view === item.id ? "btn-gold" : "btn-glass"}`} onClick={() => { setView(item.id); setMenuOpen(false); }}>
                {item.icon}{item.label}
              </button>
            ))}
          </aside>
        </div>
      )}
    </div>
  );
}
