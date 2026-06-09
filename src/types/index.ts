// ─── Entity Types (ENUM) ─────────────────────────────────────────────────────
export type EntityType =
  | 'email' | 'phone' | 'ip' | 'domain' | 'username' | 'url'
  | 'hash' | 'crypto' | 'name' | 'organization' | 'social_profile'
  | 'location' | 'document' | 'certificate';

export type TrustLevel = 'VERIFIED' | 'PROBABLE' | 'CANDIDATE';
export type SearchStatus = 'pending' | 'running' | 'done' | 'error';
export type PivotType = 'leads_to' | 'related_to' | 'part_of' | 'same_as' | 'source_of';
export type ArtifactType = 'json' | 'csv' | 'markdown' | 'screenshot' | 'report';
export type SearchStrategy = 'balanced' | 'deep' | 'quick' | 'social' | 'infrastructure';

// ─── Rôles utilisateur ────────────────────────────────────────────────────────
export type UserRole = 'utilisateur' | 'administrateur';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Dossier {
  id: string;
  user_id: string;
  titre: string;
  description?: string;
  tags: string[];
  statut: 'actif' | 'archivé' | 'clos';
  created_at: string;
  updated_at: string;
}

export interface Recherche {
  id: string;
  dossier_id: string;
  user_id: string;
  query: string;
  input_type: EntityType;
  strategy: SearchStrategy;
  statut: SearchStatus;
  resultats_raw?: Record<string, unknown>;
  nb_resultats: number;
  duree_ms?: number;
  created_at: string;
}

export interface EntiteTrouvee {
  id: string;
  recherche_id: string;
  dossier_id: string;
  user_id: string;
  type_entite: EntityType;
  valeur: string;
  trust_level: TrustLevel;
  platform?: string;
  url?: string;
  note?: string;
  sources: string[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Pivot {
  id: string;
  dossier_id: string;
  user_id: string;
  entite_source_id: string;
  entite_cible_id: string;
  type_pivot: PivotType;
  confiance: number;
  note?: string;
  created_at: string;
}

export interface Note {
  id: string;
  dossier_id: string;
  user_id: string;
  recherche_id?: string;
  entite_id?: string;
  contenu: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Artefact {
  id: string;
  dossier_id: string;
  user_id: string;
  recherche_id?: string;
  nom: string;
  type_artefact: ArtifactType;
  contenu: string;
  taille_bytes: number;
  created_at: string;
}

export interface CacheModule {
  id: string;
  user_id: string;
  cache_key: string;
  query: string;
  input_type: EntityType;
  strategy: SearchStrategy;
  resultats: Record<string, unknown>;
  expires_at: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource?: string;
  resource_id?: string;
  metadata: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  nb_dossiers: number;
  nb_recherches: number;
}

export interface AdminStats {
  total_users: number;
  total_dossiers: number;
  total_recherches: number;
  total_entites: number;
  total_notes: number;
  total_artefacts: number;
  users_by_role: Record<string, number>;
  recherches_today: number;
  active_users_7d: number;
}

export interface SearchTarget {
  value: string;
  detected_type: EntityType;
}

export interface FieldItem {
  value: string;
  trust_level: TrustLevel;
  url?: string;
  note?: string;
  isp?: string;
  country?: string;
  city?: string;
  lat?: number;
  lon?: number;
}

export interface SocialProfile {
  platform: string;
  username?: string;
  url?: string;
  trust_level: TrustLevel;
}

export interface IdentityCard {
  name?: string;
  emails?: FieldItem[];
  phones?: FieldItem[];
  domains?: FieldItem[];
  ips?: FieldItem[];
  organizations?: FieldItem[];
  social_profiles?: SocialProfile[];
  usernames?: FieldItem[];
  confidence_summary?: { verified: number; probable: number; candidate: number };
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
  source?: string;
}

export interface ResultSection {
  label: string;
  icon?: string;
  items: ResultItem[];
}

export interface SearchResult {
  query: string;
  input_type: EntityType;
  identity_card?: IdentityCard;
  sections: ResultSection[];
  total_results: number;
  errors?: ToolError[];
  duration_ms?: number;
}

export interface ToolError {
  tool: string;
  message: string;
  status: 'error' | 'not_installed' | 'no_api_key';
}

export type WsMessageType =
  | 'detected' | 'start' | 'wave_start' | 'progress'
  | 'chain' | 'cache_hit' | 'consolidated' | 'done' | 'error';

export interface WsMessage {
  type: WsMessageType;
  targets?: SearchTarget[];
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
  identity_card?: IdentityCard;
  sections?: ResultSection[] | Record<string, ResultSection>;
  total_results?: number;
}

export interface DashboardStats {
  total_dossiers: number;
  total_recherches: number;
  total_entites: number;
  recent_recherches: RecentRecherche[];
}

export interface RecentRecherche {
  id: string;
  query: string;
  input_type: EntityType;
  nb_resultats: number;
  duree_ms?: number;
  created_at: string;
  dossier?: { titre: string };
}

export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  role?: UserRole;
}
