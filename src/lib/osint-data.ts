import { supabase } from "@/integrations/supabase/client";
import type { Dossier, UserRole } from "@/types/osint";

export async function ensureRole(email: string): Promise<UserRole> {
  const { data, error } = await supabase.rpc("ensure_user_role", { p_email: email });
  if (error) throw error;
  return (data ?? "utilisateur") as UserRole;
}

export async function getDossiers(): Promise<Dossier[]> {
  const { data, error } = await supabase
    .from("dossiers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Dossier[];
}

export async function createDossier(titre: string, description?: string): Promise<Dossier> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentification requise");
  const { data, error } = await supabase
    .from("dossiers")
    .insert({ user_id: auth.user.id, titre: titre.trim(), description: description?.trim() || null })
    .select()
    .single();
  if (error) throw error;
  return data as Dossier;
}

export async function toggleDossier(dossier: Dossier): Promise<Dossier> {
  const statut = dossier.statut === "actif" ? "archivé" : "actif";
  const { data, error } = await supabase
    .from("dossiers")
    .update({ statut })
    .eq("id", dossier.id)
    .select()
    .single();
  if (error) throw error;
  return data as Dossier;
}

export async function removeDossier(id: string): Promise<void> {
  const { error } = await supabase.from("dossiers").delete().eq("id", id);
  if (error) throw error;
}

export async function getDashboardData() {
  const [dossiers, searches, entities, recent] = await Promise.all([
    supabase.from("dossiers").select("id", { count: "exact", head: true }),
    supabase.from("recherches").select("id", { count: "exact", head: true }),
    supabase.from("entites_trouvees").select("id", { count: "exact", head: true }),
    supabase
      .from("recherches")
      .select("id,query,input_type,nb_resultats,duree_ms,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  return {
    dossiers: dossiers.count ?? 0,
    searches: searches.count ?? 0,
    entities: entities.count ?? 0,
    recent: recent.data ?? [],
  };
}

export async function getAdminData() {
  const [stats, users, logs] = await Promise.all([
    supabase.rpc("get_admin_stats"),
    supabase.rpc("get_all_users"),
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200),
  ]);
  if (stats.error) throw stats.error;
  if (users.error) throw users.error;
  if (logs.error) throw logs.error;
  return { stats: stats.data, users: users.data ?? [], logs: logs.data ?? [] };
}
