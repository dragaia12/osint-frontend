import React, { useState, useMemo, useCallback } from "react";
import { useOsintSearch } from "@/hooks/use-osint-search";
import type { EntityType, SearchStrategy } from "@/types/osint";
import { 
  Search, 
  Loader2, 
  Database, 
  Layers, 
  Building2, 
  Camera, 
  AlertTriangle, 
  ShieldCheck, 
  FileText,
  Network,
  LayoutDashboard,
  FolderOpen
} from "lucide-react";

export function OsintApp() {
  const {
    inProgress,
    progress,
    progressLabel,
    result,
    errors,
    startSearch,
    cancelSearch,
  } = useOsintSearch();

  const [queryInput, setQueryInput] = useState("");
  const [selectedType, setSelectedType] = useState<EntityType>("username");
  const [activeTab, setActiveTab] = useState<string>("Tous les résultats");
  const [activeView, setActiveView] = useState<"search" | "graph" | "dashboard" | "dossiers">("search");
  const [localFilter, setLocalFilter] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState<number>(50);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim() || inProgress) return;
    setVisibleCount(50);
    startSearch(queryInput, "deep" as SearchStrategy, selectedType);
  };

  const activeItems = useMemo(() => {
    if (!result || !result.sections) return [];
    const section = result.sections.find((s) => s.label === activeTab) || result.sections[0];
    return section ? section.items : [];
  }, [result, activeTab]);

  const filteredItems = useMemo(() => {
    if (!localFilter.trim()) return activeItems;
    const term = localFilter.toLowerCase();
    return activeItems.filter((item) => {
      return Object.entries(item).some(([key, val]) => {
        if (key === "source_data" || typeof val === "object") return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [activeItems, localFilter]);

  const paginatedItems = useMemo(() => {
    return filteredItems.slice(0, visibleCount);
  }, [filteredItems, visibleCount]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + 50);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                DataLyra Hub <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">v3.0</span>
              </h1>
              <p className="text-xs text-slate-400">Moteur d'investigation unifié DuckDB</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveView("search")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${activeView === "search" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              <Search className="w-3.5 h-3.5" />
              Recherche
            </button>
            <button
              onClick={() => setActiveView("graph")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${activeView === "graph" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              <Network className="w-3.5 h-3.5" />
              Graphe
            </button>
            <button
              onClick={() => setActiveView("dashboard")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${activeView === "dashboard" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveView("dossiers")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${activeView === "dossiers" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Dossiers
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {activeView === "search" && (
          <>
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-2 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as EntityType)}
                aria-label="Type d'entité"
                className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
              >
                <option value="username">Username / Nom</option>
                <option value="email">E-mail</option>
                <option value="phone">Téléphone</option>
                <option value="ip">Adresse IP</option>
                <option value="domain">Domaine</option>
                <option value="hash">Hash</option>
              </select>

              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Rechercher un identifiant, nom, e-mail, téléphone, dossier CAF..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={inProgress || queryInput.trim().length < 2}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 flex-1 sm:flex-initial"
                >
                  {inProgress && <Loader2 className="w-4 h-4 animate-spin" />}
                  Rechercher
                </button>

                {inProgress && (
                  <button
                    type="button"
                    onClick={cancelSearch}
                    className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 px-3 py-2.5 rounded-xl text-sm transition"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>

            {inProgress && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>{progressLabel}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {errors.length > 0 && (
              <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 flex items-center gap-3 text-rose-300 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{errors[0].message}</span>
              </div>
            )}

            {!result && !inProgress && errors.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-24 text-slate-500">
                <Database className="w-16 h-16 mb-4 stroke-1 text-slate-700" />
                <h2 className="text-lg font-medium text-slate-300">Prêt pour l'investigation</h2>
                <p className="text-sm max-w-md mt-1">Interrogez instantanément les millions d'enregistrements indexés (CAF, État Civil, Snapchat, leaks globaux).</p>
              </div>
            )}

            {result && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Requête évaluée</p>
                      <p className="text-sm font-semibold text-white mt-0.5 truncate max-w-[200px]">{result.query}</p>
                    </div>
                    <ShieldCheck className="w-8 h-8 text-indigo-500/40" />
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Total correspondances</p>
                      <p className="text-xl font-bold text-white mt-0.5">{result.total_results}</p>
                    </div>
                    <Layers className="w-8 h-8 text-emerald-500/40" />
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Type d'entité</p>
                      <p className="text-sm font-semibold text-indigo-400 uppercase mt-0.5">{result.input_type}</p>
                    </div>
                    <FileText className="w-8 h-8 text-indigo-500/40" />
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {result.sections.map((sec) => {
                        const isActive = activeTab === sec.label;
                        return (
                          <button
                            key={sec.label}
                            onClick={() => {
                              setActiveTab(sec.label);
                              setVisibleCount(50);
                            }}
                            className={`px-4 py-2 rounded-xl text-xs font-medium transition flex items-center gap-2 ${
                              isActive 
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                                : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800"
                            }`}
                          >
                            {sec.label.toLowerCase().includes("caf") ? <Building2 className="w-3.5 h-3.5" /> : 
                             sec.label.toLowerCase().includes("snapchat") ? <Camera className="w-3.5 h-3.5" /> : 
                             <Database className="w-3.5 h-3.5" />}
                            {sec.label}
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? "bg-indigo-700 text-white" : "bg-slate-800 text-slate-400"}`}>
                              {sec.items.length}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="text"
                      value={localFilter}
                      onChange={(e) => setLocalFilter(e.target.value)}
                      placeholder="Filtrer ces résultats..."
                      className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-64"
                    />
                  </div>

                  {paginatedItems.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      Aucun résultat ne correspond au filtre local.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {paginatedItems.map((item, index) => (
                        <div 
                          key={index}
                          className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col gap-3 transition"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {String(item.source || item.platform || "Dataset")}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ID: #{index + 1}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(item)
                              .filter(([k]) => !["platform", "category", "source", "sources", "trust_level", "source_data"].includes(k))
                              .slice(0, 8)
                              .map(([key, val]) => (
                                <div key={key} className="flex flex-col bg-slate-950/40 p-2 rounded-xl border border-slate-800/50">
                                  <span className="text-slate-500 text-[10px] uppercase truncate">{key.replace(/_/g, " ")}</span>
                                  <span className="text-slate-200 font-medium truncate mt-0.5" title={String(val)}>
                                    {val !== null && val !== undefined && String(val).trim() !== "" ? String(val) : "—"}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {visibleCount < filteredItems.length && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={handleLoadMore}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-6 py-2.5 rounded-xl text-xs font-medium transition"
                      >
                        Afficher plus de résultats ({filteredItems.length - visibleCount} restants)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeView === "graph" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-24 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <Network className="w-16 h-16 mb-4 stroke-1 text-indigo-500/50" />
            <h2 className="text-lg font-medium text-slate-200">Visualisation Graphique</h2>
            <p className="text-sm text-slate-400 max-w-md mt-1">Le module de cartographie relationnelle des entités sera affiché ici pour connecter les correspondances trouvées.</p>
          </div>
        )}

        {activeView === "dashboard" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-24 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <LayoutDashboard className="w-16 h-16 mb-4 stroke-1 text-emerald-500/50" />
            <h2 className="text-lg font-medium text-slate-200">Tableau de Bord DuckDB</h2>
            <p className="text-sm text-slate-400 max-w-md mt-1">Métriques globales, volumes de données indexées et statistiques d'utilisation du cluster.</p>
          </div>
        )}

        {activeView === "dossiers" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-24 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <FolderOpen className="w-16 h-16 mb-4 stroke-1 text-amber-500/50" />
            <h2 className="text-lg font-medium text-slate-200">Gestion des Dossiers</h2>
            <p className="text-sm text-slate-400 max-w-md mt-1">Retrouvez l'ensemble de vos enquêtes enregistrées et l'historique des recherches sauvegardées.</p>
          </div>
        )}
      </main>
    </div>
  );
}
