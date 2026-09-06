import { useState } from "react";
import { SearchResult, SearchStatus } from "@/types/osint";

export function useOsintSearch() {
  const [results, setResults] = useState<SearchResult | null>(null);
  const [status, setStatus] = useState<SearchStatus>("pending");
  const [error, setError] = useState<string | null>(null);

  const search = async (query: string) => {
    setStatus("running");
    setError(null);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Erreur lors de la recherche");
      const data: SearchResult = await response.json();
      setResults(data);
      setStatus("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setStatus("error");
    }
  };

  return { search, results, status, error };
}
