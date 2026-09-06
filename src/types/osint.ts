// ============================================================================
// TYPES OSINT — DataLyra
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
  | "certificate";

export type TrustLevel =
  | "VERIFIED"
  | "PROBABLE"
  | "CANDIDATE";

export type SearchStatus =
  | "pending"
  | "running"
  | "done"
  | "error";

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
// RESULTATS
// ============================================================================
//
// IMPORTANT :
// Le backend peut renvoyer des colonnes supplémentaires provenant directement
// des bases de données. L'index signature permet donc de conserver TOUTES les
// données reçues sans erreur TypeScript.
//
// Exemples possibles :
// email, username, phone, ip, address, city, country, password,
// password_hash, dataset, row_idx, source, source_file, etc.
// ============================================================================

export interface ResultItem {
  // Champs standards
  platform?: string;
  category?: string;

  // Identité
  username?: string;
  email?: string;
  phone?: string;
  name?: string;

  // Réseau
  ip?: string;
  ipv4?: string;
  ipv6?: string;
  domain?: string;
  subdomain?: string;
  hostname?: string;
  host?: string;
  url?: string;

  // Sécurité / credentials
  password?: string;
  pass?: string;
  pwd?: string;
  password_hash?: string;
  hash?: string;
  hash_val?: string;
  hash_value?: string;
  md5?: string;
  sha1?: string;
  sha256?: string;
  sha512?: string;

  // Localisation
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  region?: string;
  country?: string;
  zipcode?: string;
  postal_code?: string;
  latitude?: string | number;
  longitude?: string | number;

  // Réseaux sociaux
  facebook?: string;
  instagram?: string;
  twitter?: string;
  x?: string;
  discord?: string;
  telegram?: string;
  snapchat?: string;
  tiktok?: string;
  steam?: string;
  roblox?: string;

  // Informations diverses
  note?: string;
  description?: string;
  raw?: string;
  source?: string;
  source_file?: string;
  source_data?: string;
  dataset?: string;
  database?: string;
  table?: string;
  filename?: string;
  file?: string;
  origin?: string;
  row_idx?: number | string;
  record_index?: number | string;

  // Métadonnées
  trust_level: TrustLevel;
  sources?: string[];

  // --------------------------------------------------------------------------
  // Autorise toutes les colonnes supplémentaires du backend
  // --------------------------------------------------------------------------

  [key: string]: unknown;
}

// ============================================================================
// SECTIONS DE RESULTATS
// ============================================================================

export interface ResultSection {
  label: string;
  icon?: string;
  items: ResultItem[];
}

// ============================================================================
// IDENTITE
// ============================================================================

export interface IdentityCard {
  name?: string;

  confidence_summary?: {
    verified: number;
    probable: number;
    candidate: number;
  };
}

// ============================================================================
// GRAPHE
// ============================================================================

export interface GraphNode {
  id: string;
  label: string;

  type:
    | "query"
    | "email"
    | "username"
    | "ip"
    | "domain"
    | "phone"
    | "hash"
    | "alert";

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
// RESULTAT DE RECHERCHE
// ============================================================================

export interface SearchResult {
  query: string;
  input_type: EntityType;

  identity_card?: IdentityCard;

  sections: ResultSection[];

  total_results: number;

  graph?: Graph;
}

// ============================================================================
// ERREURS OUTILS
// ============================================================================

export interface ToolError {
  tool: string;
  message: string;

  status:
    | "error"
    | "not_installed"
    | "no_api_key";
}

// ============================================================================
// ADMINISTRATION
// ============================================================================

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

// ============================================================================
// LOGS D'ACTIVITE
// ============================================================================

export interface ActivityLog {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource?: string;
  created_at: string;
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

  sections?:
    | ResultSection[]
    | Record<string, ResultSection>;

  total_results?: number;

  results?: Array<Record<string, unknown>>;

  graph?: Graph;
}
