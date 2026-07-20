import { useState } from "react";
import { ChevronDown, KeyRound, Mail, Globe, Database } from "lucide-react";

interface LogAccordionListProps {
  title: string;
  items: any[];
  fieldLabels?: Record<string, string>;
}

export default function LogAccordionList({ title, items }: LogAccordionListProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
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
            const isOpen = openIndex === idx;
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
                        <KeyRound size={12} /> Mot de passe trouvé
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
                    
                    {/* Bloc principal des identifiants / credentials */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                      {item.email && (
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: "6px" }}>
                          <span style={{ color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", marginBottom: "2px" }}>
                            <Mail size={12} /> EMAIL / IDENTIFIANT
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

                      {item.domain && (
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: "6px" }}>
                          <span style={{ color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", marginBottom: "2px" }}>
                            <Globe size={12} /> DOMAINE
                          </span>
                          <span>{item.domain}</span>
                        </div>
                      )}

                      <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: "6px" }}>
                        <span style={{ color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", marginBottom: "2px" }}>
                          <Database size={12} /> SOURCE / ORIGINE
                        </span>
                        <span>{sourceDb}</span>
                      </div>
                    </div>

                    {/* Ligne brute d'origine si présente */}
                    {item.raw && (
                      <div>
                        <strong style={{ color: "var(--muted-foreground)", display: "block", fontSize: "0.7rem", marginBottom: "4px" }}>LIGNE BRUTE (RAW)</strong>
                        <div style={{ background: "rgba(0,0,0,0.5)", padding: "8px 10px", borderRadius: "6px", fontFamily: "monospace", wordBreak: "break-all", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          {item.raw}
                        </div>
                      </div>
                    )}

                    {/* Autres métadonnées éventuelles */}
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "2px" }}>
                      {item.password_set !== undefined && <span>Password set: <b>{String(item.password_set)}</b></span>}
                      {item.trust_level && <span>Confiance: <b>{item.trust_level}</b></span>}
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