import { useState, useRef, useCallback } from 'react';
import type { SearchResult, WsMessage, SearchStrategy, ToolError } from '../types/osint';

const BACKEND_URL = import.meta.env.VITE_OSINT_BACKEND_URL || '';
const WS_URL = BACKEND_URL
  ? BACKEND_URL.replace(/^https?/, (protocol: string) => (protocol === 'https' ? 'wss' : 'ws'))
  : '';

export interface SearchState {
  inProgress: boolean;
  progress: number;
  progressLabel: string;
  toolChips: Record<string, 'running' | 'done' | 'error'>;
  result: SearchResult | null;
  errors: ToolError[];
  fromCache: boolean;
}

interface UseSearchReturn extends SearchState {
  startSearch: (query: string, strategy: SearchStrategy) => void;
  cancelSearch: () => void;
  reset: () => void;
}

const INITIAL_STATE: SearchState = {
  inProgress: false,
  progress: 0,
  progressLabel: '',
  toolChips: {},
  result: null,
  errors: [],
  fromCache: false,
};

function normalizeName(tool: string): string {
  return tool.replace(/_tool$/i, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function useSearch(): UseSearchReturn {
  const [state, setState] = useState<SearchState>(INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);
  const jobsDoneRef = useRef(0);
  const jobsTotalRef = useRef(0);

  const setProgress = useCallback((pct: number | null, label?: string) => {
    setState(prev => ({
      ...prev,
      ...(pct !== null ? { progress: pct } : {}),
      ...(label !== undefined ? { progressLabel: label } : {}),
    }));
  }, []);

  const cancelSearch = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    setState(prev => ({ ...prev, inProgress: false }));
  }, []);

  const reset = useCallback(() => {
    cancelSearch();
    setState(INITIAL_STATE);
  }, [cancelSearch]);

  const startSearch = useCallback((query: string, strategy: SearchStrategy) => {
    if (!query.trim()) return;

    cancelSearch();
    jobsDoneRef.current = 0;
    jobsTotalRef.current = 0;

    // Mode démo sans backend
    if (!WS_URL) {
      setState({
        inProgress: true, progress: 0, progressLabel: 'Mode démo…',
        toolChips: {}, result: null, errors: [], fromCache: false,
      });
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          inProgress: false,
          progress: 100,
          progressLabel: 'Mode démo',
          result: {
            query,
            input_type: 'username',
            identity_card: { name: query, confidence_summary: { verified: 2, probable: 3, candidate: 5 } },
            sections: [
              { label: 'Profils sociaux', icon: '👤', items: [
                { platform: 'Twitter', username: query, url: `https://twitter.com/${query}`, trust_level: 'VERIFIED' },
                { platform: 'Instagram', username: query, url: `https://instagram.com/${query}`, trust_level: 'PROBABLE' },
                { platform: 'GitHub', username: query, url: `https://github.com/${query}`, trust_level: 'CANDIDATE' },
              ]},
              { label: 'Domaines associés', icon: '🌐', items: [
                { platform: 'WHOIS', subdomain: `${query}.com`, url: `https://${query}.com`, trust_level: 'CANDIDATE' },
              ]},
            ],
            total_results: 4,
          },
        }));
      }, 1800);
      return;
    }

    setState({
      inProgress: true, progress: 0, progressLabel: 'Connexion…',
      toolChips: {}, result: null, errors: [], fromCache: false,
    });

    const ws = new WebSocket(`${WS_URL}/ws/search`);
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ query, strategy, chain: true, max_parallel: 20 }));

    ws.onmessage = (evt) => {
      let msg: WsMessage;
      try { msg = JSON.parse(evt.data); } catch { return; }

      switch (msg.type) {
        case 'detected':
          setProgress(2, `Types : ${(msg.targets || []).map(t => t.detected_type).join(', ')}`);
          break;
        case 'start':
          jobsTotalRef.current = msg.total_jobs || 0;
          setProgress(5, `Lancement — ${jobsTotalRef.current} modules`);
          break;
        case 'wave_start':
          setProgress(10, `Vague ${msg.priority} — ${msg.jobs} modules`);
          break;
        case 'progress': {
          jobsDoneRef.current++;
          const pct = jobsTotalRef.current > 0
            ? Math.min(95, Math.round((jobsDoneRef.current / jobsTotalRef.current) * 100))
            : 50;
          const toolStatus = msg.status === 'done' ? 'done'
            : ['error', 'not_installed', 'no_api_key'].includes(msg.status || '') ? 'error'
            : 'running';

          setState(prev => {
            const errors = [...prev.errors];
            if (toolStatus === 'error' && msg.tool) {
              errors.push({
                tool: msg.tool,
                message: msg.error || msg.message || msg.status || 'Tool error',
                status: (msg.status as any) || 'error',
              });
            }
            return {
              ...prev,
              progress: pct,
              progressLabel: `${normalizeName(msg.tool || '')} — ${msg.status === 'done' ? `${msg.count} rés.` : msg.status}`,
              toolChips: msg.tool ? { ...prev.toolChips, [msg.tool]: toolStatus } : prev.toolChips,
              errors,
            };
          });
          break;
        }
        case 'chain':
          setProgress(null, `Chaînage — profondeur ${msg.depth}`);
          break;
        case 'cache_hit':
          setState(prev => ({ ...prev, fromCache: true }));
          setProgress(100, '⚡ Cache');
          break;
        case 'consolidated': {
          const sections = Array.isArray(msg.sections) ? msg.sections : Object.values(msg.sections || {});
          setState(prev => ({
            ...prev,
            result: {
              query: msg.query || query,
              input_type: 'email',
              identity_card: msg.identity_card,
              sections,
              total_results: msg.total_results || 0,
            },
          }));
          break;
        }
        case 'done':
          setProgress(100, 'Analyse terminée');
          setState(prev => ({ ...prev, inProgress: false }));
          ws.close();
          break;
        case 'error':
          setState(prev => ({
            ...prev,
            inProgress: false,
            errors: [...prev.errors, { tool: 'system', message: msg.message || 'Erreur inconnue', status: 'error' }],
          }));
          ws.close();
          break;
      }
    };

    ws.onerror = () => {
      setState(prev => ({
        ...prev,
        inProgress: false,
        errors: [...prev.errors, { tool: 'websocket', message: 'Erreur de connexion WebSocket', status: 'error' }],
      }));
    };

    ws.onclose = () => setState(prev => ({ ...prev, inProgress: false }));
  }, [cancelSearch, setProgress]);

  return { ...state, startSearch, cancelSearch, reset };
}
