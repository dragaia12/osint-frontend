export type EntityType =
  | "email" | "phone" | "ip" | "domain" | "username" | "url" | "hash" | "crypto"
  | "name" | "organization" | "social_profile" | "location" | "document" | "certificate" | "alert";

export type TrustLevel = "VERIFIED" | "PROBABLE" | "CANDIDATE";
export type SearchStatus = "pending" | "running" | "done" | "error";
export type SearchStrategy = "balanced" | "deep" | "quick" | "social" | "infrastructure";

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
  phone?: string;
  name?: string;
  ip?: string;
  domain?: string;
  url?: string;
  password?: string;
  hash?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
  trust_level: TrustLevel;
  sources?: string[];
  [key: string]: unknown;
}

export interface ResultSection {
  label: string;
  icon?: string;
  items: ResultItem[];
}

export interface IdentityCard {
  name?: string;
  confidence_summary?: {
    verified: number;
    probable: number;
    candidate: number;
  };
}

export interface GraphNode {
  id: string;
  label: string;
  type: EntityType | "query" | "alert";
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
  strategy?: SearchStrategy;
  status?: SearchStatus;
  elapsed_ms?: number;
  identity_card?: IdentityCard;
  sections: ResultSection[];
  total_results: number;
  graph?: Graph;
}

export interface ToolError {
  tool: string;
  message: string;
  status: "error" | "not_installed" | "no_api_key";
}

export interface WsMessage {
  type: string;
  query?: string;
  input_type?: EntityType;
  identity_card?: IdentityCard;
  sections?: ResultSection[] | Record<string, ResultSection>;
  total_results?: number;
  graph?: Graph;
  jobs?: number;
  message?: string;
  tool?: string;
  error?: string;
}
