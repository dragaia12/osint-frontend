
// src/hooks/use-osint-search.ts
import { useState } from 'react';

export const useOsintSearch = (backendUrl: string) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async (query: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/search?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      setResults(data.results);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setLoading(false);
    }
  };

  return { search, results, loading };
};
