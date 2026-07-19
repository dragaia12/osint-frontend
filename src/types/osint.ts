export type EntityType =
  | "email" | "phone" | "ip" | "domain" | "username" | "url"
  | "hash" | "crypto" | "name" | "organization" | "social_profile"
  | "location" | "document" | "certificate";

export type TrustLevel = "VERIFIED" | "PROBABLE" | "CANDIDATE";
export type SearchStatus = "pending" | "running" | "done" | "error";
export type SearchStrategy = "balanced" | "deep" | "quick" | "social" | "infrastructure";
export type UserRole = "utilisateur" | "administrateur";

export interface Dossier {
  id: string;
  user_id: string;
  titre: string;
  description?: string;
  tags: string[];
  statut: "actif" | "archivé" | "clos";
  created_at: string;
  updated_at: string;
}

export interface ResultItem {
  platform?: string;
  category?: string;
  username?: string;
  email?: string;
  ip?: string;
  subdomain?: string;
  url?: string;
  note?: string;
  description?: string;
  trust_level: TrustLevel;
  sources?: string[];
}

export interface ResultSection {
  label: string;
  icon?: string;
  items: ResultItem[];
}

export interface IdentityCard {
  name?: string;
  confidence_summary?: { verified: number; probable: number; candidate: number };
}

// ── Graphe (CORRIGÉ : type Graph ajouté, plus besoin de `as any`) ──────────
export interface GraphNode {
  id: string;
  label: string;
  type: "query" | "email" | "username" | "ip" | "domain" | "phone" | "hash" | "alert";
  root?: boolean;
  source?: string;
  full?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  weight?: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SearchResult {
  query: string;
  input_type: EntityType;
  identity_card?: IdentityCard;
  sections: ResultSection[];
  total_results: number;
  graph?: Graph; // CORRIGÉ : champ officiellement typé
}

export interface ToolError {
  tool: string;
  message: string;
  status: "error" | "not_installed" | "no_api_key";
}

export interface AdminStats {
  total_users: number;
  total_dossiers: number;
  total_recherches: number;
  total_entites: number;
  users_by_role: Record<string, number>;
  recherches_today: number;
  active_users_7d: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  nb_dossiers: number;
  nb_recherches: number;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource?: string;
  created_at: string;
}

export type WsMessageType =
  | "detected" | "start" | "wave_start" | "progress"
  | "chain" | "cache_hit" | "consolidated" | "results" | "done" | "ping" | "error";

export interface WsMessage {
  type: WsMessageType;
  targets?: Array<{ value: string; detected_type: EntityType }>;
  total_jobs?: number;
  priority?: number;
  jobs?: number;
  tool?: string;
  status?: string;
  count?: number;
  error?: string;
  message?: string;
  depth?: number;
  query?: string;
  input_type?: EntityType; // CORRIGÉ : on utilise bien le input_type du backend
  identity_card?: IdentityCard;
  sections?: ResultSection[] | Record<string, ResultSection>;
  total_results?: number;
  results?: Array<Record<string, unknown>>;
  graph?: Graph; // CORRIGÉ : graphe reçu depuis le backend
}
