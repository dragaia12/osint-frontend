import { useState } from "react";
import {
  ChevronDown, Database, KeyRound, Mail, Globe, User, MapPin, Hash,
  Phone, Cake, VenusAndMars, IdCard, Users, Landmark, Copy, ShieldAlert, Check,
} from "lucide-react";

interface LogAccordionListProps {
  title: string;
  items: any[];
}

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

const HIDDEN_KEYS = new Set(["source_data", "raw_json", "debug", "traceback", "stack", "__typename"]);

function normKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s-]+/g, "_").trim();
}
function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function humanizeKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());
}
function isHiddenKey(key: string): boolean {
  return HIDDEN_KEYS.has(normKey(key));
}

/** Parse les chaînes JSON et extrait les enveloppes { value: ... } lorsqu'elles ne contiennent que des métadonnées. */
function unwrap(input: any, depth = 0): any {
  if (depth > 8 || input == null) return input;
  if (typeof input === "string") {
    const s = input.trim();
    if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
      try { return unwrap(JSON.parse(s), depth + 1); } catch { return input; }
    }
    return input;
  }
  if (Array.isArray(input)) return input.map(v => unwrap(v, depth + 1));
  if (isObject(input)) {
    if (Object.prototype.hasOwnProperty.call(input, "value")) {
      const allowed = new Set(["value", "type", "label", "source", "confidence"]);
      if (Object.keys(input).every(k => allowed.has(normKey(k)))) return unwrap(input.value, depth + 1);
    }
    return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, unwrap(v, depth + 1)]));
  }
  return input;
}

/** Transforme les objets/tableaux en texte lisible au lieu d'afficher les accolades JSON. */
function formatValue(input: any, depth = 0): string {
  const value = unwrap(input);
  if (value == null || value === "") return "—";
  if (depth > 5) return "[données imbriquées]";
  if (Array.isArray(value)) {
    const parts = value.map(v => formatValue(v, depth + 1)).filter(v => v !== "—");
    return parts.join(" · ") || "—";
  }
  if (isObject(value)) {
    const parts = Object.entries(value)
      .filter(([k, v]) => !isHiddenKey(k) && v != null && v !== "")
      .map(([k, v]) => `${humanizeKey(k)} : ${formatValue(v, depth + 1)}`);
    return parts.join(" · ") || "—";
  }
  return String(value).trim() || "—";
}

/** Récupère les objets imbriqués utiles pour chercher les champs d'identité. */
function getSources(item: any): any[] {
  const result: any[] = [];
  const seen = new Set<any>();
  const add = (input: any, depth = 0) => {
    if (depth > 5 || input == null) return;
    const value = unwrap(input);
    if (typeof value === "string") return;
    if (Array.isArray(value)) { value.forEach(v => add(v, depth + 1)); return; }
    if (!isObject(value) || seen.has(value)) return;
    seen.add(value);
    result.push(value);
    ["data", "raw", "value", "result", "record", "fields", "identity"].forEach(k => {
      if (value[k] !== undefined) add(value[k], depth + 1);
    });
  };
  add(item);
  if (typeof item?.source_data === "string") {
    try { add(JSON.parse(item.source_data)); } catch { /* source_data non JSON */ }
  } else if (item?.source_data && typeof item.source_data === "object") add(item.source_data);
  return result;
}
function scalarText(value: any): string | undefined {
  const v = unwrap(value);
  if (v == null) return undefined;
  const s = typeof v === "object" ? formatValue(v) : String(v).trim();
  return s && s !== "—" ? s : undefined;
}
function pick(item: any, keys: string[]): string | undefined {
  const sources = getSources(item);
  for (const key of keys) {
    const wanted = normKey(key);
    for (const obj of sources) {
      const actual = Object.keys(obj).find(k => normKey(k) === wanted);
      if (actual) {
        const value = scalarText(obj[actual]);
        if (value) return value;
      }
    }
  }
  return undefined;
}

interface ResolvedIdentity {
  nom?: string; prenom?: string; email?: string; telephone?: string; naissance?: string;
  genre?: string; adresse?: string; ville?: string; code_postal?: string; qualite?: string;
  nom_parent?: string; prenom_parent?: string; organisme?: string; nom_complet?: string; filledCount: number;
}
function resolveIdentity(item: any): ResolvedIdentity {
  const resolved: Record<string, string | undefined> = {};
  for (const [slot, aliases] of Object.entries(FIELD_ALIASES)) resolved[slot] = pick(item, aliases);
  const fullName = pick(item, ["name", "full_name", "nom_complet", "display_name"]);
  const username = pick(item, ["username", "user_name", "pseudo"]);
  const nom_complet = [resolved.prenom, resolved.nom].filter(Boolean).join(" ") || fullName || username;
  return { ...resolved, nom_complet, filledCount: Object.values(resolved).filter(Boolean).length };
}

const IDENTITY_FIELD_SLOTS: { key: string; label: string; icon: any }[] = [
  { key: "nom", label: "Nom", icon: User }, { key: "prenom", label: "Prénom", icon: User },
  { key: "nom_complet", label: "Nom complet", icon: IdCard }, { key: "email", label: "Email", icon: Mail },
  { key: "telephone", label: "Téléphone", icon: Phone }, { key: "naissance", label: "Naissance", icon: Cake },
  { key: "genre", label: "Genre", icon: VenusAndMars }, { key: "adresse", label: "Adresse", icon: MapPin },
  { key: "ville", label: "Ville", icon: Globe }, { key: "code_postal", label: "Code postal", icon: Hash },
  { key: "qualite", label: "Qualité", icon: IdCard }, { key: "nom_parent", label: "Nom (parent)", icon: Users },
  { key: "prenom_parent", label: "Prénom (parent)", icon: Users }, { key: "organisme", label: "Organisme", icon: Landmark },
];
const RISK_LABELS: Record<string, { label: string; className: string }> = {
  VERIFIED: { label: "Élevé", className: "risk-high" },
  PROBABLE: { label: "Moyen", className: "risk-medium" },
  CANDIDATE: { label: "Faible", className: "risk-low" },
};

function copyIdentityToClipboard(identity: ReturnType<typeof resolveIdentity>) {
  const lines = IDENTITY_FIELD_SLOTS
    .map(slot => [slot.label, (identity as any)[slot.key]])
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label} : ${value}`);
  navigator.clipboard?.writeText(lines.join("\n") || "Aucune donnée disponible").catch(() => {});
}

/** Aplatit les objets imbriqués en champs séparés. */
function flattenFields(input: any, prefix = "", depth = 0): [string, string][] {
  if (depth > 5 || input == null) return [];
  const value = unwrap(input);
  if (Array.isArray(value)) {
    if (value.every(v => v == null || ["string", "number", "boolean"].includes(typeof unwrap(v)))) {
      const text = value.map(v => formatValue(v)).filter(v => v !== "—").join(" · ");
      return text ? [[prefix || "Valeur", text]] : [];
    }
    return value.flatMap((entry, i) => flattenFields(entry, `${prefix || "Élément"} ${i + 1}`, depth + 1));
  }
  if (isObject(value)) {
    return Object.entries(value).flatMap(([key, child]) => {
      if (isHiddenKey(key) || child == null || child === "" || child === false) return [];
      return flattenFields(child, prefix ? `${prefix} / ${humanizeKey(key)}` : humanizeKey(key), depth + 1);
    });
  }
  const text = String(value).trim();
  return text ? [[prefix || "Valeur", text]] : [];
}

function ExtraIdentityFields({ item }: { item: any }) {
  const knownKeys = new Set([
    ...Object.values(FIELD_ALIASES).flat(), ...IDENTITY_FIELD_SLOTS.map(s => s.key),
    "nom_complet", "filledCount", "sources", "source", "source_data", "platform",
    "trust_level", "category", "data", "raw", "value",
  ].map(normKey));
  const entries = Object.entries(item || {}).flatMap(([key, value]) => {
    if (knownKeys.has(normKey(key)) || isHiddenKey(key) || value == null || value === "" || value === false) return [];
    return flattenFields(value, humanizeKey(key));
  });
  const unique = Array.from(new Map(entries.map(([k, v]) => [`${normKey(k)}:${v}`, [k, v] as [string, string])).values());
  if (!unique.length) return null;
  return (
    <div style={{ padding: "0 1rem 1rem" }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: 8, color: "var(--gold)" }}>AUTRES CHAMPS DISPONIBLES</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {unique.map(([key, value], i) => (
          <div className="identity-field" key={`${key}-${i}`}>
            <span className="identity-field-label">{key}</span>
            <span className="identity-field-value" style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IdentityCard({ item, index }: { item: any; index: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const identity = resolveIdentity(item);
  const risk = RISK_LABELS[String(item?.trust_level || "").toUpperCase()] || RISK_LABELS.CANDIDATE;
  const sources = unwrap(item?.sources);
  const sourcesCount = Array.isArray(sources) ? sources.length : 0;
  const hasPII = Boolean(identity.nom || identity.prenom || identity.email || identity.telephone || identity.adresse);
  const hasFamily = Boolean(identity.nom_parent || identity.prenom_parent);
  const totalSlots = IDENTITY_FIELD_SLOTS.length - 1;
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation(); copyIdentityToClipboard(identity); setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="identity-card">
      <button type="button" className="identity-card-header" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="identity-chip identity-chip-index">#{index + 1}</span>
        <span className="identity-chip identity-chip-criteria">Champs : {identity.filledCount}/{totalSlots}</span>
        <span className="identity-card-name">{identity.nom_complet || "Identité non résolue"}</span>
        <span className="identity-header-spacer" />
        {sourcesCount > 1 && <span className="identity-chip identity-chip-sources"><Users size={13} /> ×{sourcesCount}</span>}
        <span className={`identity-chip identity-chip-risk ${risk.className}`}><span className="risk-dot" /> {risk.label}</span>
        {hasPII && <span className="identity-chip identity-chip-rgpd"><ShieldAlert size={13} /> RGPD</span>}
        {hasFamily && <span className="identity-chip identity-chip-family"><Users size={13} /> Liens famille</span>}
        <span className="identity-chip identity-chip-copy" onClick={handleCopy} role="button" tabIndex={0}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copié" : "Copier"}
        </span>
        <ChevronDown size={16} className={open ? "" : "collapsed"} />
      </button>
      {open && (
        <>
          <div className="identity-card-grid">
            {IDENTITY_FIELD_SLOTS.map(slot => {
              const Icon = slot.icon;
              const value = (identity as any)[slot.key];
              return <div className="identity-field" key={slot.key}>
                <span className="identity-field-label"><Icon size={12} /> {slot.label}</span>
                <span className={`identity-field-value ${value ? "" : "empty"}`} style={{ overflowWrap: "anywhere" }}>{value || "—"}</span>
              </div>;
            })}
          </div>
          <ExtraIdentityFields item={item} />
        </>
      )}
    </div>
  );
}

function getPrimaryValue(item: any): string {
  const identity = resolveIdentity(item);
  return identity.nom_complet
    || pick(item, FIELD_ALIASES.email)
    || pick(item, FIELD_ALIASES.telephone)
    || pick(item, ["username", "user_name", "pseudo"])
    || pick(item, ["ip", "ip_address", "address_ip"])
    || pick(item, ["domain", "domain_name", "subdomain"])
    || pick(item, ["url", "link"])
    || pick(item, ["note", "description", "title"])
    || pick(item, ["value", "result", "identifier"])
    || "Signal";
}
function getSourceLabel(item: any): string {
  const value = item?.platform ?? item?.source ?? item?.table ?? item?.database ?? item?.source_data;
  return (scalarText(value) || "base_locale").replace(/[\[\]{}'"]/g, "").trim().slice(0, 100);
}
function getPassword(item: any): string | undefined {
  const direct = pick(item, ["password", "pass", "pwd", "mot_de_passe"]);
  if (direct) return direct;
  const raw = item?.raw;
  if (typeof raw === "string" && raw.includes(":")) {
    const last = raw.split(":").pop()?.trim();
    if (last) return last.replace(/^["']|["',\s]+$/g, "");
  }
  return undefined;
}

function GenericResultCard({ item, isOpen, onToggle }: { item: any; isOpen: boolean; onToggle: () => void }) {
  const password = getPassword(item);
  const source = getSourceLabel(item);
  const primary = getPrimaryValue(item);
  const fields = flattenFields(item).filter(([key]) =>
    !["sources", "source data", "platform", "trust level", "raw", "data", "value"].includes(normKey(key))
  );

  return (
    <div style={{ background: "var(--glass)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", transition: "border-color 0.2s" }}>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "10px 14px", background: "transparent", border: "none", color: "inherit", cursor: "pointer", textAlign: "left",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
          <span className="source-badge" style={{ fontSize: "0.75rem", padding: "2px 8px", background: "var(--border)", borderRadius: 4, color: "var(--gold)", textTransform: "uppercase", flexShrink: 0 }}>{source}</span>
          <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{primary}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {password && <span style={{ fontSize: "0.75rem", background: "rgba(234,179,8,0.15)", color: "var(--gold)", padding: "2px 6px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}><KeyRound size={12} /> MDP TROUVÉ</span>}
          {item?.trust_level && <span className={`trust-badge trust-${String(item.trust_level).toLowerCase()}`} style={{ fontSize: "0.7rem" }}>{String(item.trust_level)}</span>}
          <ChevronDown size={16} style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
        </div>
      </button>
      {isOpen && <div style={{ padding: 14, borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.25)", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: 12 }}>
        {password && <div style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", padding: "10px 12px", borderRadius: 6 }}>
          <span style={{ color: "var(--gold)", display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", marginBottom: 4, fontWeight: 700 }}><KeyRound size={14} /> MOT DE PASSE EXPOSÉ (EXTRAIT)</span>
          <strong style={{ color: "var(--gold)", fontFamily: "monospace", fontSize: "1rem", wordBreak: "break-all" }}>{password}</strong>
        </div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {fields.length === 0 ? <p style={{ color: "var(--muted-foreground)" }}>Aucun champ détaillé disponible.</p> :
            fields.map(([key, value], i) => <div key={`${key}-${i}`} style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 6, minWidth: 0, overflow: "hidden", overflowWrap: "anywhere" }}>
              <span style={{ color: "var(--gold)", display: "flex", alignItems: "center", gap: 4, fontSize: "0.7rem", marginBottom: 3, fontWeight: 700 }}><Database size={12} /> {key}</span>
              <span style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{value}</span>
            </div>)
          }
        </div>
      </div>}
    </div>
  );
}

export default function LogAccordionList({ title, items }: LogAccordionListProps) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());
  const toggle = (index: number) => setOpenIndices(previous => {
    const next = new Set(previous);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });

  return <div className="result-window" style={{ padding: "1rem" }}>
    <div className="window-header" style={{ marginBottom: "1rem", cursor: "default" }}>
      <div className="module-icon">📂</div><div><h2>{title}</h2><p>{items.length} signal(aux) trouvé(s)</p></div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {!items.length ? <p style={{ color: "var(--muted-foreground)", padding: "1rem", textAlign: "center" }}>Aucun résultat à afficher.</p> :
        items.map((item, index) => {
          const identity = resolveIdentity(item);
          return identity.filledCount >= 2
            ? <IdentityCard key={item?.id ?? index} item={item} index={index} />
            : <GenericResultCard key={item?.id ?? index} item={item} isOpen={openIndices.has(index)} onToggle={() => toggle(index)} />;
        })
      }
    </div>
  </div>;
}
