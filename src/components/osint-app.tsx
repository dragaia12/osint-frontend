import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, CircleUserRound, Database, Download, FolderKanban, Gauge, LogOut, Menu, Search, Settings2, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createDossier, ensureRole, getAdminData, getDashboardData, getDossiers, removeDossier, toggleDossier } from "@/lib/osint-data";
import { useSearch as useOsintSearch } from "@/hooks/use-osint-search";
import type { Dossier, ResultItem, SearchResult, SearchStrategy, TrustLevel, UserRole } from "@/types/osint";

type View = "search" | "dashboard" | "dossiers" | "admin";
type User = { id: string; email: string };

const strategyLabels: Record<SearchStrategy, string> = {
  balanced: "Équilibré", deep: "Profond", quick: "Rapide", social: "Social", infrastructure: "Infrastructure",
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
  return value.replace(/_tool$/i, "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function TrustBadge({ level }: { level: TrustLevel }) {
  const label = level === "VERIFIED" ? "Vérifié" : level === "PROBABLE" ? "Probable" : "Candidat";
  return <span className={`trust-badge trust-${level.toLowerCase()}`}>{level === "VERIFIED" && <ShieldCheck />} {label}</span>;
}

function exportResult(result: SearchResult, format: "csv" | "md") {
  const safe = result.query.replace(/[^a-z0-9@._+-]/gi, "_");
  const rows = result.sections.flatMap((section) => section.items.map((item) => ({ section: section.label, ...item })));
  const content = format === "csv"
    ? ["Groupe,Plateforme,Identifiant,URL,Confiance", ...rows.map((item) => [item.section, item.platform ?? item.category ?? "", item.username ?? item.email ?? item.ip ?? item.subdomain ?? "", item.url ?? "", item.trust_level].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n")
    : [`# Enquête OSINT — ${result.query}`, "", ...rows.map((item) => `- **${item.section} · ${item.platform ?? item.category ?? "Source"}** — ${item.username ?? item.email ?? item.ip ?? item.subdomain ?? ""}${item.url ? ` — [ouvrir](${item.url})` : ""} — ${item.trust_level}`)].join("\n");
  const blob = new Blob([format === "csv" ? `\uFEFF${content}` : content], { type: format === "csv" ? "text/csv;charset=utf-8" : "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `osint_${safe}.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}

function SearchView({ strategy, setStrategy }: { strategy: SearchStrategy; setStrategy: (strategy: SearchStrategy) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TrustLevel | "ALL">("ALL");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const search = useOsintSearch();
  const detected = query.trim() ? detectType(query) : "";
  const hasActivity = search.inProgress || Boolean(search.result);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!query.trim() || search.inProgress) return;
    search.startSearch(query.trim(), strategy);
    setCollapsed(new Set());
    setFilter("ALL");
  };

  return (
    <section className={`search-stage ${hasActivity ? "search-stage-active" : ""}`} aria-label="Recherche OSINT">
      <div className="search-intro">
        <span className="eyebrow"><span className="status-dot" /> Moteur d’investigation opérationnel</span>
        <h1>Révélez les connexions.<br /><span>Suivez chaque signal.</span></h1>
        <p>Un point d’entrée unique pour interroger emails, identités, domaines, adresses IP et empreintes numériques.</p>
      </div>

      <form className="search-shell" onSubmit={submit}>
        <Search aria-hidden="true" />
        <label className="sr-only" htmlFor="osint-query">Cible à analyser</label>
        <input id="osint-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Email, username, IP, domaine, téléphone…" autoComplete="off" />
        {detected && <span className="detect-pill">{detected}</span>}
        <Button type="submit" variant="gold" size="lg" disabled={!query.trim() || search.inProgress}>
          {search.inProgress ? "Analyse…" : "Rechercher"}
        </Button>
      </form>

      <div className="search-options">
        <label htmlFor="strategy"><Settings2 /> Stratégie</label>
        <select id="strategy" value={strategy} onChange={(event) => setStrategy(event.target.value as SearchStrategy)}>
          {Object.entries(strategyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {search.inProgress && <Button variant="glass" size="sm" onClick={search.cancelSearch}>Arrêter</Button>}
      </div>

      {hasActivity && (
        <div className="results-flow">
          <div className="progress-glass" aria-live="polite">
            <div><span>{search.progressLabel || "Initialisation des modules"}</span><strong>{search.progress}%</strong></div>
            <div className="progress-track"><span style={{ width: `${search.progress}%` }} /></div>
            {Object.keys(search.toolChips).length > 0 && <div className="tool-stream">{Object.entries(search.toolChips).map(([tool, status]) => <span key={tool} data-status={status}>{normalizeName(tool)}</span>)}</div>}
          </div>

          {search.errors.length > 0 && <div className="error-glass"><TriangleAlert /> <div><strong>{search.errors.length} module(s) indisponible(s)</strong><p>{search.errors.map((error) => `${normalizeName(error.tool)} : ${error.message}`).join(" · ")}</p></div></div>}

          {search.result?.identity_card && (
            <article className="result-window identity-window">
              <header><div className="module-icon">ID</div><div><h2>Identité numérique</h2><p>Profil consolidé à partir des sources corrélées</p></div><TrustBadge level={(search.result.identity_card.confidence_summary?.verified ?? 0) > 0 ? "VERIFIED" : "PROBABLE"} /></header>
              <div className="identity-content">
                <div><span>Cible analysée</span><strong>{search.result.identity_card.name || search.result.query}</strong></div>
                <div className="confidence-grid">
                  <span><b>{search.result.identity_card.confidence_summary?.verified ?? 0}</b> vérifiés</span>
                  <span><b>{search.result.identity_card.confidence_summary?.probable ?? 0}</b> probables</span>
                  <span><b>{search.result.identity_card.confidence_summary?.candidate ?? 0}</b> candidats</span>
                </div>
              </div>
            </article>
          )}

          {search.result?.sections.map((section, index) => {
            const items = section.items.filter((item) => filter === "ALL" || item.trust_level === filter);
            if (!items.length) return null;
            const isCollapsed = collapsed.has(section.label);
            return (
              <article className="result-window" key={section.label} style={{ animationDelay: `${120 + index * 90}ms` }}>
                <button className="window-header" onClick={() => setCollapsed((current) => { const next = new Set(current); next.has(section.label) ? next.delete(section.label) : next.add(section.label); return next; })} aria-expanded={!isCollapsed}>
                  <div className="module-icon">{section.icon || "◎"}</div><div><h2>{section.label}</h2><p>{items.length} signal{items.length > 1 ? "aux" : ""} corrélé{items.length > 1 ? "s" : ""}</p></div><ChevronDown className={isCollapsed ? "collapsed" : ""} />
                </button>
                {!isCollapsed && <div className="window-list">{items.map((item, itemIndex) => <ResultRow key={`${section.label}-${itemIndex}`} item={item} />)}</div>}
              </article>
            );
          })}

          {search.result && <div className="result-actions">
            <div className="filter-group">{(["ALL", "VERIFIED", "PROBABLE", "CANDIDATE"] as const).map((level) => <Button key={level} variant={filter === level ? "gold" : "glass"} size="sm" onClick={() => setFilter(level)}>{level === "ALL" ? "Tous" : level}</Button>)}</div>
            <div><Button variant="glass" onClick={() => exportResult(search.result as SearchResult, "csv")}><Download /> CSV</Button><Button variant="glass" onClick={() => exportResult(search.result as SearchResult, "md")}><Download /> Obsidian</Button></div>
          </div>}
        </div>
      )}
    </section>
  );
}

function ResultRow({ item }: { item: ResultItem }) {
  const identity = item.username || item.email || item.ip || item.subdomain || item.note || item.description || "Signal détecté";
  return <div className="result-row"><div><strong>{normalizeName(item.platform || item.category || "Source")}</strong>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{identity}</a> : <span>{identity}</span>}</div><TrustBadge level={item.trust_level || "CANDIDATE"} /></div>;
}

function DashboardView() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardData>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { getDashboardData().then(setData).catch((reason: Error) => setError(reason.message)); }, []);
  return <Page title="Intelligence dashboard" subtitle="Vue synthétique de votre activité d’investigation.">{error && <InlineError text={error} />}{!data ? <Loading /> : <><div className="metrics"><Metric icon={<FolderKanban />} value={data.dossiers} label="Dossiers" /><Metric icon={<Search />} value={data.searches} label="Analyses" /><Metric icon={<Database />} value={data.entities} label="Entités" /></div><div className="data-window"><h2>Analyses récentes</h2>{data.recent.length === 0 ? <Empty text="Aucune analyse enregistrée." /> : data.recent.map((item) => <div className="history-row" key={item.id}><span>{new Date(item.created_at).toLocaleDateString("fr-FR")}</span><strong>{item.query}</strong><em>{normalizeName(item.input_type)}</em><b>{item.nb_resultats} rés.</b></div>)}</div></>}</Page>;
}

function DossiersView() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { getDossiers().then(setDossiers).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false)); }, []);
  const create = async (event: FormEvent) => { event.preventDefault(); if (!titre.trim()) return; try { const dossier = await createDossier(titre, description); setDossiers((current) => [dossier, ...current]); setTitre(""); setDescription(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Création impossible"); } };
  return <Page title="Dossiers d’investigation" subtitle="Organisez les recherches, preuves et pistes sans perdre le fil."><form className="dossier-form" onSubmit={create}><label><span>Titre</span><input value={titre} onChange={(event) => setTitre(event.target.value)} required maxLength={255} /></label><label><span>Description</span><input value={description} onChange={(event) => setDescription(event.target.value)} /></label><Button variant="gold" type="submit">Créer le dossier</Button></form>{error && <InlineError text={error} />}{loading ? <Loading /> : dossiers.length === 0 ? <Empty text="Créez votre première investigation." /> : <div className="dossier-list">{dossiers.map((dossier) => <article key={dossier.id}><div><span className={`dossier-status status-${dossier.statut}`} /><h2>{dossier.titre}</h2><p>{dossier.description || "Sans description"}</p></div><div><span>{new Date(dossier.created_at).toLocaleDateString("fr-FR")}</span><Button variant="glass" size="sm" onClick={async () => { const updated = await toggleDossier(dossier); setDossiers((current) => current.map((item) => item.id === dossier.id ? updated : item)); }}>{dossier.statut === "actif" ? "Archiver" : "Réactiver"}</Button><Button variant="glass" size="sm" onClick={async () => { if (!window.confirm("Supprimer ce dossier et toutes ses données ?")) return; await removeDossier(dossier.id); setDossiers((current) => current.filter((item) => item.id !== dossier.id)); }}>Supprimer</Button></div></article>)}</div>}</Page>;
}

function AdminView() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminData>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { getAdminData().then(setData).catch((reason: Error) => setError(reason.message)); }, []);
  const stats = data?.stats as Record<string, number> | undefined;
  return <Page title="Administration" subtitle="Utilisateurs, activité et santé globale de la plateforme.">{error && <InlineError text={error} />}{!data ? <Loading /> : <><div className="metrics"><Metric value={stats?.total_users ?? 0} label="Utilisateurs" /><Metric value={stats?.total_recherches ?? 0} label="Analyses" /><Metric value={stats?.total_entites ?? 0} label="Entités" /></div><div className="data-window"><h2>Utilisateurs</h2>{data.users.map((user) => <div className="history-row" key={user.id}><strong>{user.email}</strong><em>{user.role}</em><span>{user.nb_dossiers} dossiers</span><b>{user.nb_recherches} analyses</b></div>)}</div><div className="data-window"><h2>Journal d’activité</h2>{data.logs.slice(0, 20).map((log) => <div className="history-row" key={log.id}><span>{new Date(log.created_at).toLocaleString("fr-FR")}</span><strong>{log.user_email}</strong><em>{log.action}</em><b>{log.resource || "—"}</b></div>)}</div></>}</Page>;
}

function Page({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) { return <section className="page-view"><header><span className="eyebrow">OSINT HUB / v7.4</span><h1>{title}</h1><p>{subtitle}</p></header>{children}</section>; }
function Metric({ icon, value, label }: { icon?: ReactNode; value: number; label: string }) { return <div className="metric">{icon}<strong>{value.toLocaleString("fr-FR")}</strong><span>{label}</span></div>; }
function Loading() { return <div className="loading"><span /> Chargement des données…</div>; }
function Empty({ text }: { text: string }) { return <div className="empty"><Database /><p>{text}</p></div>; }
function InlineError({ text }: { text: string }) { return <div className="error-glass"><TriangleAlert /><span>{text}</span></div>; }

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User, role: UserRole) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [info, setInfo] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setError(""); setInfo(""); const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password }); if (result.error) setError(result.error.message); else if (result.data.user && result.data.session) { const role = await ensureRole(result.data.user.email ?? email); onAuthenticated({ id: result.data.user.id, email: result.data.user.email ?? email }, role); } else setInfo("Compte créé. Vérifiez votre email avant de vous connecter."); setLoading(false); };
  return <main className="auth-screen"><div className="orb orb-one" /><div className="orb orb-two" /><section className="auth-glass"><span className="brand-mark">OH</span><div className="auth-copy"><span className="eyebrow">Plateforme de renseignement v7</span><h1>OSINT <em>HUB</em></h1><p>Transformez un signal isolé en piste exploitable.</p></div><form onSubmit={submit}><div className="auth-tabs"><Button type="button" variant={mode === "login" ? "gold" : "glass"} onClick={() => setMode("login")}>Connexion</Button><Button type="button" variant={mode === "register" ? "gold" : "glass"} onClick={() => setMode("register")}>Inscription</Button></div><label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label><span>Mot de passe</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === "register" ? 8 : 1} required /></label>{error && <InlineError text={error} />}{info && <p className="success-message">{info}</p>}<Button variant="gold" size="lg" disabled={loading}>{loading ? "Vérification…" : mode === "login" ? "Accéder à la plateforme" : "Créer mon accès"}</Button></form></section></main>;
}

export function OsintApp() {
  const [user, setUser] = useState<User | null>(null); const [role, setRole] = useState<UserRole>("utilisateur"); const [loading, setLoading] = useState(true); const [view, setView] = useState<View>("search"); const [strategy, setStrategy] = useState<SearchStrategy>("balanced"); const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(async ({ data }) => { if (data.session?.user) { const email = data.session.user.email ?? "analyste"; setUser({ id: data.session.user.id, email }); setRole(await ensureRole(email)); } }).finally(() => setLoading(false)); const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (!session) { setUser(null); setRole("utilisateur"); } }); return () => data.subscription.unsubscribe(); }, []);
  const nav = useMemo(() => [{ id: "search" as const, label: "Recherche", icon: <Search /> }, { id: "dashboard" as const, label: "Tableau de bord", icon: <Gauge /> }, { id: "dossiers" as const, label: "Dossiers", icon: <FolderKanban /> }, ...(role === "administrateur" ? [{ id: "admin" as const, label: "Admin", icon: <ShieldCheck /> }] : [])], [role]);
  if (loading) return <main className="auth-screen"><Loading /></main>;
  if (!user) return <AuthScreen onAuthenticated={(nextUser, nextRole) => { setUser(nextUser); setRole(nextRole); }} />;
  return <div className="app-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><header className="topbar"><button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Ouvrir la navigation"><Menu /></button><button className="brand-button" onClick={() => setView("search")}><span>OSINT HUB</span><small>v7.4</small></button><nav aria-label="Navigation principale">{nav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>{item.icon}<span>{item.label}</span></button>)}</nav><div className="account"><div><span className="status-dot" /> Système nominal</div><span className="avatar">{user.email.charAt(0).toUpperCase()}</span><Button variant="glass" size="icon" aria-label="Se déconnecter" onClick={() => supabase.auth.signOut()}><LogOut /></Button></div></header><main>{view === "search" && <SearchView strategy={strategy} setStrategy={setStrategy} />}{view === "dashboard" && <DashboardView />}{view === "dossiers" && <DossiersView />}{view === "admin" && role === "administrateur" && <AdminView />}</main><footer className="statusbar"><span>Session sécurisée</span><span><span className="status-dot" /> Base de données connectée</span><span>Stratégie : <b>{strategyLabels[strategy]}</b></span></footer>{menuOpen && <div className="mobile-drawer"><button className="drawer-backdrop" onClick={() => setMenuOpen(false)} aria-label="Fermer la navigation" /><aside><Button variant="glass" size="icon" aria-label="Fermer la navigation" onClick={() => setMenuOpen(false)}><X /></Button><CircleUserRound /><strong>{user.email}</strong>{nav.map((item) => <Button key={item.id} variant={view === item.id ? "gold" : "glass"} onClick={() => { setView(item.id); setMenuOpen(false); }}>{item.icon}{item.label}</Button>)}</aside></div>}</div>;
}