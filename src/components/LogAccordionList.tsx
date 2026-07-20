import { useState } from "react";
import { ChevronDown, KeyRound, Mail, Globe, Database, User, MapPin, Building, Hash } from "lucide-react";

interface LogAccordionListProps {
  title: string;
  items: any[];
}

export default function LogAccordionList({ title, items }: LogAccordionListProps) {
  // Utilisation d'un Set pour permettre l'ouverture de plusieurs accordéons en même temps
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
            const isOpen = openIndices.has(idx);
            const primaryVal = item.email || item.username || item.ip || item.subdomain || item.domain || item.note || item.raw || "Signal";
            const sourceDb = item.source || item.source_data || item.platform || "Base locale";

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
                    <span className="source-badge" style={{ fontSize: "0.75rem", padding: "2px 8px", background: "var(--border)", borderRadius: "4px", color: "var(--gold)" }}>
                      {sourceDb}
                    </span>
                    <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {primaryVal}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    {item.password && (
                      <span style={{ fontSize: "0.75rem", background: "rgba(234, 179, 8, 0.15)", color: "var(--gold)", padding: "2px 6px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <KeyRound size={12} /> MDP
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
                  <div style={{ padding: "14px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "12px" }}>
                    
                    {/* Bloc mis en avant pour les identifiants clés */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                      {item.email && (
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: "6px" }}>
                          <span style={{ color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", marginBottom: "2px" }}>
                            <Mail size={12} /> EMAIL
                          </span>
                          <strong style={{ wordBreak: "break-all" }}>{item.email}</strong>
                        </div>
                      )}

                      {item.password && (
                        <div style={{ background: "rgba(234, 179, 8, 0.08)", border: "1px solid rgba(234, 179, 8, 0.2)", padding: "8px 10px", borderRadius: "6px" }}>
                          <span style={{ color: "var(--gold)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", marginBottom: "2px" }}>
                            <KeyRound size={12} /> MOT DE PASSE (CLAIR)
                          </span>
                          <strong style={{ wordBreak: "break-all", color: "var(--gold)" }}>{item.password}</strong>
                        </div>
                      )}

                      {item.firstname && (
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: "6px" }}>
                          <span style={{ color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", marginBottom: "2px" }}>
                            <User size={12} /> PRÉNOM
                          </span>
                          <span>{item.firstname}</span>
                        </div>
                      )}

                      {item.lastname && (
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: "6px" }}>
                          <span style={{ color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", marginBottom: "2px" -->
                            <User size={12} /> NOM
                          </span>
                          <span>{item.lastname}</span>
                        </div>
                      )}

                      {item.phone && (
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: "6px" }}>
                          <span style={{ color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", marginBottom: "2px" }}>
                            <Hash size={12} /> TÉLÉPHONE
                          </span>
                          <span>{item.phone}</span>
                        </div>
                      )}

                      {item.address && (
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: "6px" }}>
                          <span style={{ color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", marginBottom: "2px" }}>
                            <MapPin size={12} /> ADRESSE
                          </span>
                          <span>{item.address}</span>
                        </div>
                      )}

                      {item.siret && (
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: "6px" }}>
                          <span style={{ color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", marginBottom: "2px" }}>
                            <Building size={12} /> SIRET
                          </span>
                          <span>{item.siret}</span>
                        </div>
                      )}

                      {item.domain && (
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: "6px" }}>
                          <span style={{ color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", marginBottom: "2px" }}>
                            <Globe size={12} /> DOMAINE
                          </span>
                          <span>{item.domain}</span>
                        </div>
                      )}
                    </div>

                    {/* Affichage automatique et dynamique de TOUTES les autres propriétés présentes dans l'objet */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", marginTop: "4px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "8px" }}>
                      {Object.entries(item).map(([key, value]) => {
                        // On exclut les clés déjà affichées au-dessus ou techniques pour éviter les doublons
                        if (["email", "password", "firstname", "lastname", "phone", "address", "siret", "domain", "source", "source_data", "platform", "raw", "trust_level"].includes(key)) return null;
                        if (value === null || value === undefined || value === "" || value === false) return null;
                        
                        return (
                          <div key={key} style={{ wordBreak: "break-all" }}>
                            <strong style={{ color: "var(--muted-foreground)", display: "block", fontSize: "0.7rem" }}>{key.toUpperCase()}</strong>
                            <span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Ligne brute (raw) */}
                    {item.raw && (
                      <div>
                        <strong style={{ color: "var(--muted-foreground)", display: "block", fontSize: "0.7rem", marginBottom: "4px" }}>LIGNE BRUTE (RAW)</strong>
                        <div style={{ background: "rgba(0,0,0,0.5)", padding: "8px 10px", borderRadius: "6px", fontFamily: "monospace", wordBreak: "break-all", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          {item.raw}
                        </div>
                      </div>
                    )}

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