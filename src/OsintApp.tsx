import React, { useState } from "react";
import { useOsintSearch } from "@/hooks/use-osint-search";
import { ResultItem, ResultSection } from "@/types/osint";

export function OsintApp() {
  const { startSearch, result, inProgress, errors } = useOsintSearch();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"table" | "grouped" | "accordion">("accordion");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !inProgress) {
      startSearch(query, "deep", "username");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">DataLyra OSINT</h1>
        <p className="text-sm text-neutral-400">Investigation & Data Analysis Hub</p>
      </header>

      <form onSubmit={handleSearch} className="flex gap-4 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Entrer une cible (email, nom, IP, téléphone...)"
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={inProgress}
          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-neutral-950 font-semibold px-6 py-2 rounded-lg text-sm transition-colors"
        >
          {inProgress ? "Recherche..." : "Analyser"}
        </button>
      </form>

      {inProgress && (
        <div className="text-amber-500 text-sm mb-4">Recherche en cours...</div>
      )}

      {errors.length > 0 && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-lg mb-4 text-sm">
          {errors[0].message}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-2">Cible analysée</h2>
            <p className="text-2xl font-bold text-amber-400">{result.query}</p>
          </div>

          <div className="flex gap-2 border-b border-neutral-800 pb-2">
            {(["table", "grouped", "accordion"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-amber-500 text-neutral-950"
                    : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Vue {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {result.sections.map((sec: ResultSection, secIndex: number) => (
              <div key={secIndex} className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                <h3 className="text-md font-semibold text-amber-400 mb-4">{sec.label}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sec.items.map((item: ResultItem, index: number) => (
                    <div key={index} className="bg-neutral-950 border border-neutral-800/80 rounded-lg p-4 space-y-2">
                      {item.name && <div className="text-sm font-bold text-neutral-200">{item.name}</div>}
                      {item.email && <div className="text-xs text-neutral-400">Email: {item.email}</div>}
                      {item.phone && <div className="text-xs text-neutral-400">Téléphone: {item.phone}</div>}
                      {typeof item.city === "string" && (
                        <div className="text-xs text-neutral-400">Ville: {item.city}</div>
                      )}
                      {typeof item.zipcode === "string" && (
                        <div className="text-xs text-neutral-400">Code postal: {item.zipcode}</div>
                      )}
                      <div className="text-[10px] text-neutral-500 uppercase tracking-wider pt-2 border-t border-neutral-900">
                        Source: {String(item.dataset || item.source || "Inconnu")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
