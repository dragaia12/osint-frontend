import { useState } from "react";
import { ChevronDown, Database, KeyRound, Mail, Globe, User, MapPin, Building, Hash } from "lucide-react";

interface LogAccordionListProps {
  title: string;
  items: any[];
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
            const isOpen = openIndices.has(idx);
            const primaryVal = item.email || item.username || item.ip || item.subdomain || item.domain || item.note || item.raw || "Signal";
            
            // Récupère une vraie source propre (priorité au nom du fichier/table s'il existe, sinon on nettoie)
            const rawSource = item.sources?.[0] || item.source || item.source_data || item.platform || "base_locale";
            const sourceDb = String(rawSource).replace(/['"[\]]/g, "").trim();

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
                    
                    {/* Grille intelligente des données */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                      {Object.entries(item).map(([key, value]) => {
                        // On cache les champs techniques redondants ou vides
                        if (["sources", "source_data", "platform"].includes(key)) return null;
                        if (value === null || value === undefined || value === "" || value === false) return null;
                        
                        let displayVal = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);

                        return (
                          <div key={key} style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: "6px", wordBreak: "break-all" }}>
                            <span style={{ color: "var(--gold)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", marginBottom: "3px", fontWeight: 700 }}>
                              <Database size={12} /> {key.toUpperCase()}
                            </span>
                            <span style={{ fontFamily: key.includes("raw") || key.includes("password") || key.includes("note") ? "monospace" : "inherit", whiteSpace: "pre-wrap" }}>
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