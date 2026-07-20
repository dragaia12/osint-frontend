import { useState } from "react";
import { ChevronDown } from "lucide-react";

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
            
            // Récupération propre de la source / base de données
            const sourceDb = item.source_data || item.platform || (Array.isArray(item.sources) ? item.sources.join(", ") : item.sources) || "Base locale";
            const leakDetails = item.note || item.description || item.raw || "Aucun détail supplémentaire";

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
                    {item.trust_level && (
                      <span className={`trust-badge trust-${item.trust_level.toLowerCase()}`} style={{ fontSize: "0.7rem" }}>
                        {item.trust_level}
                      </span>
                    )}
                    <ChevronDown size={16} style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                  </div>
                </button>

                {isOpen && (
                  <div style={{ padding: "14px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div>
                      <strong style={{ color: "var(--gold)", display: "block", fontSize: "0.75rem", marginBottom: "2px" }}>BASE DE DONNÉES / SOURCE</strong>
                      <span>{String(sourceDb)}</span>
                    </div>

                    <div>
                      <strong style={{ color: "var(--gold)", display: "block", fontSize: "0.75rem", marginBottom: "2px" }}>INFORMATIONS / LEAK</strong>
                      <div style={{ background: "rgba(0,0,0,0.4)", padding: "8px 10px", borderRadius: "6px", fontFamily: "monospace", wordBreak: "break-all" }}>
                        {String(leakDetails)}
                      </div>
                    </div>

                    {/* Affiche dynamiquement le reste des propriétés s'il y en a */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", marginTop: "4px" }}>
                      {Object.entries(item).map(([key, value]) => {
                        if (["source_data", "platform", "sources", "note", "description", "raw", "trust_level"].includes(key)) return null;
                        if (value === null || value === undefined || value === "") return null;
                        return (
                          <div key={key} style={{ wordBreak: "break-all" }}>
                            <strong style={{ color: "var(--muted-foreground)", display: "block", fontSize: "0.7rem" }}>{key.toUpperCase()}</strong>
                            <span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
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