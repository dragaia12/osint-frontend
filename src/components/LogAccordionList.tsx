import { useState } from "react";
import {
  ChevronDown, Database, KeyRound, Mail, Globe, User, MapPin, Building, Hash,
  Phone, Cake, VenusAndMars, IdCard, Users, Landmark, Copy, ShieldAlert, Check,
} from "lucide-react";

interface LogAccordionListProps {
  title: string;
  items: any[];
}

// ============================================================================
// RÉSOLUTION DES CHAMPS D'IDENTITÉ
// ============================================================================
// Les colonnes brutes varient selon la base source (fr/en, snake_case…).
// On tente plusieurs alias connus pour chaque emplacement de la fiche.
// ============================================================================

const FIELD_ALIASES: Record<string, string[]> = {
  nom: ["nom", "last_name", "lastname", "surname", "nom_famille"],
  prenom: ["prenom", "first_name", "firstname", "given_name"],
  email: ["email", "mail", "e_mail"],
  telephone: ["telephone", "phone", "tel", "mobile", "numero", "num_tel"],
  naissance: ["naissance", "date_naissance", "birthdate", "dob", "date_of_birth"],
  genre: ["genre", "gender", "sexe", "sex"],
  adresse: ["adresse", "address", "street", "rue"],
  ville: ["ville", "city", "commune"],
  code_postal: ["code_postal", "zipcode", "postal_code", "cp"],
  qualite: ["qualite", "civilite", "title", "statut"],
  nom_parent: ["nom_parent", "parent_nom", "parent_lastname"],
  prenom_parent: ["prenom_parent", "parent_prenom", "parent_firstname"],
  organisme: ["organisme", "organization", "organisation", "source_org"],
};

function pick(item: any, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = item[key];
    if (val !== null && val !== undefined && String(val).trim() !== "") {
      return String(val).trim();
    }
  }
  return undefined;
}

interface ResolvedIdentity {
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  naissance?: string;
  genre?: string;
  adresse?: string;
  ville?: string;
  code_postal?: string;
  qualite?: string;
  nom_parent?: string;
  prenom_parent?: string;
  organisme?: string;
  nom_complet?: string;
  filledCount: number;
}

function resolveIdentity(item: any): ResolvedIdentity {
  const resolved: Record<string, string | undefined> = {};
  for (const [slot, aliases] of Object.entries(FIELD_ALIASES)) {
    resolved[slot] = pick(item, aliases);
  }
  const nomComplet =
    [resolved.prenom, resolved.nom].filter(Boolean).join(" ") ||
    (item.name ? String(item.name).trim() : undefined) ||
    (item.username ? String(item.username).trim() : undefined);

  const filledCount = Object.values(resolved).filter(Boolean).length;

  return { ...resolved, nom_complet: nomComplet, filledCount };
}

const IDENTITY_FIELD_SLOTS: { key: string; label: string; icon: any }[] = [
  { key: "nom", label: "Nom", icon: User },
  { key: "prenom", label: "Prénom", icon: User },
  { key: "nom_complet", label: "Nom complet", icon: IdCard },
  { key: "email", label: "Email", icon: Mail },
  { key: "telephone", label: "Téléphone", icon: Phone },
  { key: "naissance", label: "Naissance", icon: Cake },
  { key: "genre", label: "Genre", icon: VenusAndMars },
  { key: "adresse", label: "Adresse", icon: MapPin },
  { key: "ville", label: "Ville", icon: Globe },
  { key: "code_postal", label: "Code postal", icon: Hash },
  { key: "qualite", label: "Qualité", icon: IdCard },
  { key: "nom_parent", label: "Nom (parent)", icon: Users },
  { key: "prenom_parent", label: "Prénom (parent)", icon: Users },
  { key: "organisme", label: "Organisme", icon: Landmark },
];

const RISK_LABELS: Record<string, { label: string; className: string }> = {
  VERIFIED: { label: "Élevé", className: "risk-high" },
  PROBABLE: { label: "Moyen", className: "risk-medium" },
  CANDIDATE: { label: "Faible", className: "risk-low" },
};

function copyIdentityToClipboard(identity: ReturnType<typeof resolveIdentity>) {
  const lines = IDENTITY_FIELD_SLOTS
    .map((slot) => [slot.label, (identity as any)[slot.key]])
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label} : ${value}`);
  const text = lines.join("\n") || "Aucune donnée disponible";
  navigator.clipboard?.writeText(text).catch(() => {});
}

function IdentityCard({ item, index }: { item: any; index: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const identity = resolveIdentity(item);
  const risk = RISK_LABELS[String(item.trust_level).toUpperCase()] || RISK_LABELS.CANDIDATE;
  const sourcesCount = Array.isArray(item.sources) ? item.sources.length : 0;
  const hasPII = Boolean(identity.nom || identity.prenom || identity.email || identity.telephone || identity.adresse);
  const hasFamily = Boolean(identity.nom_parent || identity.prenom_parent);
  const totalSlots = IDENTITY_FIELD_SLOTS.length - 1; // nom_complet est dérivé, pas un critère saisi

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyIdentityToClipboard(identity);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="identity-card">
      <button type="button" className="identity-card-header" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="identity-chip identity-chip-index">#{index + 1}</span>
        <span className="identity-chip identity-chip-criteria">Champs : {identity.filledCount}/{totalSlots}</span>
        <span className="identity-card-name">{identity.nom_complet || "Identité non résolue"}</span>

        <span className="identity-header-spacer" />

        {sourcesCount > 1 && (
          <span className="identity-chip identity-chip-sources"><Users size={13} /> ×{sourcesCount}</span>
        )}
        <span className={`identity-chip identity-chip-risk ${risk.className}`}>
          <span className="risk-dot" /> {risk.label}
        </span>
        {hasPII && (
          <span className="identity-chip identity-chip-rgpd"><ShieldAlert size={13} /> RGPD</span>
        )}
        {hasFamily && (
          <span className="identity-chip identity-chip-family"><Users size={13} /> Liens famille</span>
        )}
        <span className="identity-chip identity-chip-copy" onClick={handleCopy} role="button" tabIndex={0}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copié" : "Copier"}
        </span>

        <ChevronDown size={16} className={open ? "" : "collapsed"} />
      </button>

      {open && (
        <div className="identity-card-grid">
          {IDENTITY_FIELD_SLOTS.map((slot) => {
            const Icon = slot.icon;
            const value = (identity as any)[slot.key];
            return (
              <div className="identity-field" key={slot.key}>
                <span className="identity-field-label"><Icon size={12} /> {slot.label}</span>
                <span className={`identity-field-value ${value ? "" : "empty"}`}>{value || "—"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LogAccordionList({ title, items }: LogAccordionListProps) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="result-window" style={{ padding: "1rem" }}>
      <div className="window-header" style={{ marginBottom: "1rem", cursor: "default" }}>
        <div className="module-icon">📂</div>
        <div>
          <h2>{title}</h2>
          <p>{items.length} signal(aux) trouvé(s)</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {items.length === 0 ? (
          <p style={{ color: "var(--muted-foreground)", padding: "1rem", textAlign: "center" }}>Aucun résultat à afficher.</p>
        ) : (
          items.map((item, idx) => {
            const identityPreview = resolveIdentity(item);
            if (identityPreview.filledCount >= 2) {
              return <IdentityCard key={idx} item={item} index={idx} />;
            }

            const isOpen = openIndices.has(idx);
            const primaryVal = item.email || item.username || item.ip || item.subdomain || item.domain || item.note || item.raw || "Signal";
            
            // Récupère une source propre (ex: le nom de la table ou du fichier brut)
            const rawSource = item.sources?.[0] || item.source || item.source_data || item.platform || "base_locale";
            const sourceDb = String(rawSource).replace(/['"[\]]/g, "").trim();

            // Détection intelligente du mot de passe (s'il est dans password, ou extrait du raw, ou de la note)
            let revealedPassword = item.password || item.pass || item.pwd;
            if (!revealedPassword && item.raw && typeof item.raw === "string" && item.raw.includes(":")) {
              const parts = item.raw.split(":");
              if (parts.length > 1) revealedPassword = parts[parts.length - 1].replace(/['",]/g, "").trim();
            }

            return (
              <div 
                key={idx} 
                style={{ 
                  background: "var(--glass)", 
                  border: "1px solid var(--border)", 
                  borderRadius: "8px", 
                  overflow: "hidden",
                  transition: "border-color 0.2s"
                }}
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <span className="source-badge" style={{ fontSize: "0.75rem", padding: "2px 8px", background: "var(--border)", borderRadius: "4px", color: "var(--gold)", textTransform: "uppercase" }}>
                      {sourceDb}
                    </span>
                    <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {primaryVal}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    {revealedPassword && (
                      <span style={{ fontSize: "0.75rem", background: "rgba(234, 179, 8, 0.15)", color: "var(--gold)", padding: "2px 6px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <KeyRound size={12} /> MDP TROUVÉ
                      </span>
                    )}
                    {item.trust_level && (
                      <span className={`trust-badge trust-${item.trust_level.toLowerCase()}`} style={{ fontSize: "0.7rem" }}>
                        {item.trust_level}
                      </span>
                    )}
                    <ChevronDown size={16} style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                  </div>
                </button>

                {isOpen && (
                  <div style={{ padding: "14px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.25)", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "12px" }}>
                    
                    {/* Mise en avant explicite du mot de passe s'il a pu être extrait */}
                    {revealedPassword && (
                      <div style={{ background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.3)", padding: "10px 12px", borderRadius: "6px" }}>
                        <span style={{ color: "var(--gold)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", marginBottom: "4px", fontWeight: 700 }}>
                          <KeyRound size={14} /> MOT DE PASSE EXPOSÉ (EXTRAIT)
                        </span>
                        <strong style={{ color: "var(--gold)", fontFamily: "monospace", fontSize: "1rem", wordBreak: "break-all" }}>
                          {revealedPassword}
                        </strong>
                      </div>
                    )}

                    {/* Grille dynamique pour toutes les propriétés restantes de l'objet */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                      {Object.entries(item).map(([key, value]) => {
                        if (["sources", "source_data", "platform"].includes(key)) return null;
                        if (value === null || value === undefined || value === "" || value === false) return null;
                        
                        let displayVal = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);

                        return (
                          <div key={key} style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: "6px", wordBreak: "break-all" }}>
                            <span style={{ color: "var(--gold)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", marginBottom: "3px", fontWeight: 700 }}>
                              <Database size={12} /> {key.toUpperCase()}
                            </span>
                            <span style={{ fontFamily: key.includes("raw") || key.includes("password") ? "monospace" : "inherit", whiteSpace: "pre-wrap" }}>
                              {displayVal}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
