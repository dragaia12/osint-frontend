// ============================================================================
// TYPES OSINT — DataLyra (Optimisé & Structuré v3.2)
// ============================================================================

export type EntityType =
  | "email"
  | "phone"
  | "ip"
  | "domain"
  | "username"
  | "url"
  | "hash"
  | "crypto"
  | "name"
  | "organization"
  | "social_profile"
  | "location"
  | "document"
  | "certificate"
  | "mac"
  | "iban"
  | "credit_card"
  | "ssn"
  | "breach"
  | "alert";

export type TrustLevel =
  | "VERIFIED"
  | "PROBABLE"
  | "CANDIDATE";

export type SearchStatus =
  | "pending"
  | "running"
  | "done"
  | "error"
  | "timeout"
  | "rate_limited";

export type SearchStrategy =
  | "balanced"
  | "deep"
  | "quick"
  | "social"
  | "infrastructure";

export type UserRole =
  | "utilisateur"
  | "administrateur";

// ============================================================================
// DOSSIERS
// ============================================================================

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

// ============================================================================
// RESULTATS (Structuré & Typé pour affichage propre)
// ============================================================================

export interface ResultItem {
  // Core identity
  username?: string;
  email?: string;
  phone?: string;
  name?: string;
  platform?: string;
  category?: string;

  // Network container
  network?: {
    ipv4?: string;
    ipv6?: string;
    domain?: string;
    subdomain?: string;
    hostname?: string;
    url?: string;
  };

  // Credentials container
  credentials?: {
    password?: string;
    hash?: string;
    algorithm?: "md5" | "sha1" | "sha256" | "sha512" | "bcrypt" | "plaintext";
  };

  // Location container (Ville, département, adresse, etc.)
  location?: {
    address?: string;
    street?: string;
    city?: string;
    department?: string;
    state?: string;
    region?: string;
    country?: string;
    zipcode?: string;
    lat?: number;
    lng?: number;
  };

  // Social profiles container
  social?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    discord?: string;
    telegram?: string;
    snapchat?: string;
    tiktok?: string;
    steam?: string;
    roblox?: string;
  };

  // Provenance & Source tracking
  provenance: {
    table: string;
    dataset: string;
    row_idx?: number | string;
    sources: string[];
  };

  // Trust & Metadata brutes optionnelles restantes
  trust_level: TrustLevel;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// SECTIONS DE RESULTATS & PAGINATION
// ============================================================================

export interface ResultSection {
  label: string;
  icon?: string;
  items: ResultItem[];
}

export interface IdentityCard {
  name?: string;
  total_entries?: number;
  confidence_summary?: {
    verified: number;
    probable: number;
    candidate: number;
  };
}

export interface SearchResult {
  query: string;
  input_type: EntityType;
  strategy: SearchStrategy;
  status: SearchStatus;
  elapsed_ms: number;
  total_results: number;
  offset: number;
  limit: number;
  has_more: boolean;
  identity_card?: IdentityCard;
  sections: ResultSection[];
  graph?: Graph;
}

// ============================================================================
// GRAPHE
// ============================================================================

export interface GraphNode {
  id: string;
  label: string;
  type: EntityType;
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

// ============================================================================
// ERREURS OUTILS & SYSTEME
// ============================================================================

export type ToolErrorCode =
  | "timeout"
  | "rate_limited"
  | "invalid_response"
  | "internal"
  | "not_installed"
  | "no_api_key";

export interface ToolError {
  tool: string;
  message: string;
  status: ToolErrorCode;
}

// ============================================================================
// ADMINISTRATION & AUDIT
// ============================================================================

export interface AdminStats {
  total_users: number;
  total_dossiers: number;
  total_recherches: number;
  total_entites: number;
  users_by_role: Record<string, number>;
  recherches_today: number;
  active_users_7d: number;
  db_size_gb: number;
  cache_hit_rate: number;
  avg_response_ms: number;
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
  client_ip?: string;
  user_agent?: string;
  session_id?: string;
}

// ============================================================================
// WEBSOCKET
// ============================================================================

export type WsMessageType =
  | "detected"
  | "start"
  | "wave_start"
  | "progress"
  | "chain"
  | "cache_hit"
  | "consolidated"
  | "results"
  | "done"
  | "ping"
  | "error";

export interface WsMessage {
  type: WsMessageType;
  targets?: Array<{
    value: string;
    detected_type: EntityType;
  }>;
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
  input_type?: EntityType;
  identity_card?: IdentityCard;
  sections?: ResultSection[];
  total_results?: number;
  results?: Array<Record<string, unknown>>;
  graph?: Graph;
}
