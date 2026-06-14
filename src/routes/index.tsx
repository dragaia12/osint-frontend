import { createFileRoute } from "@tanstack/react-router";
import { OsintApp } from "@/components/osint-app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OSINT HUB — Plateforme d’investigation" },
      { name: "description", content: "Analysez identités, emails, domaines, IP et empreintes numériques depuis une interface OSINT unifiée." },
      { property: "og:title", content: "OSINT HUB — Plateforme d’investigation" },
      { property: "og:description", content: "Une interface unifiée pour transformer chaque signal numérique en piste exploitable." },
    ],
  }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return <OsintApp />;
}
