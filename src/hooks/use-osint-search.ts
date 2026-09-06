import { useState, useCallback, useRef } from "react";
import type { SearchResult, EntityType, SearchStrategy, WsMessage } from "@/types/osint";

export function useOsintSearch() {
  const [inProgress, setInProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [errors, setErrors] = useState<Array<{ tool: string; message: string }>>([]);
  
  const wsRef = useRef<WebSocket | null>(null);

  const startSearch = useCallback((query: string, strategy: SearchStrategy = "deep", inputType: EntityType = "username") => {
    setInProgress(true);
    setProgress(10);
    setProgressLabel("Connexion au cluster DuckDB...");
    setErrors([]);
    setResult(null);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws/search`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setProgress(30);
      setProgressLabel("Exécution de la requête multi-tables...");
      ws.send(JSON.stringify({ query, strategy, input_type: inputType }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        if (msg.type === "progress") {
          setProgress(msg.jobs || 50);
          setProgressLabel(msg.message || "Traitement en cours...");
        } else if (msg.type === "done" || msg.type === "consolidated") {
          setResult({
            query: msg.query || query,
            input_type: msg.input_type || inputType,
            strategy: strategy,
            status: "done",
            elapsed_ms: 0,
            total_results: msg.total_results || 0,
            has_more: false,
            identity_card: msg.identity_card,
            sections: (msg.sections as any) || [],
            graph: msg.graph
          });
          setProgress(100);
          setInProgress(false);
          ws.close();
        } else if (msg.type === "error") {
          setErrors(prev => [...prev, { tool: msg.tool || "backend", message: msg.error || "Erreur inconnue" }]);
          setInProgress(false);
        }
      } catch (e) {
        console.error("Erreur parsing WS:", e);
      }
    };

    ws.onerror = () => {
      setErrors([{ tool: "websocket", message: "Impossible de joindre le serveur de recherche." }]);
      setInProgress(false);
    };

    ws.onclose = () => {
      setInProgress(false);
    };
  }, []);

  const cancelSearch = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setInProgress(false);
    setProgressLabel("Recherche annulée.");
  }, []);

  return {
    inProgress,
    progress,
    progressLabel,
    result,
    errors,
    startSearch,
    cancelSearch,
  };
}
