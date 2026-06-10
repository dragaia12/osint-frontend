import { supabase } from '../lib/supabase';
import type { EntiteTrouvee, SearchResult, EntityType } from '../types';

export async function saveEntitesFromResult(
  rechercheId: string,
  dossierId: string,
  result: SearchResult
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const entites: Omit<EntiteTrouvee, 'id' | 'created_at'>[] = [];

  const card = result.identity_card;
  if (card) {
    card.emails?.forEach(e => entites.push({
      recherche_id: rechercheId, dossier_id: dossierId, user_id: user.id,
      type_entite: 'email', valeur: e.value, trust_level: e.trust_level,
      sources: [], metadata: {},
    }));
    card.phones?.forEach(p => entites.push({
      recherche_id: rechercheId, dossier_id: dossierId, user_id: user.id,
      type_entite: 'phone', valeur: p.value, trust_level: p.trust_level,
      sources: [], metadata: {},
    }));
    card.domains?.forEach(d => entites.push({
      recherche_id: rechercheId, dossier_id: dossierId, user_id: user.id,
      type_entite: 'domain', valeur: d.value, trust_level: d.trust_level,
      sources: [], metadata: {},
    }));
    card.ips?.forEach(i => entites.push({
      recherche_id: rechercheId, dossier_id: dossierId, user_id: user.id,
      type_entite: 'ip', valeur: i.value, trust_level: i.trust_level,
      sources: [], metadata: { isp: i.isp, country: i.country, city: i.city },
    }));
    card.social_profiles?.forEach(s => entites.push({
      recherche_id: rechercheId, dossier_id: dossierId, user_id: user.id,
      type_entite: 'social_profile', valeur: s.username || s.url || s.platform,
      platform: s.platform, url: s.url, trust_level: s.trust_level,
      sources: [], metadata: {},
    }));
  }

  result.sections.forEach(section => {
    section.items.forEach(item => {
      const valeur = item.username || item.email || item.ip || item.subdomain || item.url || '';
      if (!valeur) return;
      entites.push({
        recherche_id: rechercheId, dossier_id: dossierId, user_id: user.id,
        type_entite: detectEntityType(item),
        valeur,
        platform: item.platform,
        url: item.url,
        note: item.note || item.description,
        trust_level: item.trust_level,
        sources: item.sources || (item.source ? [item.source] : []),
        metadata: {},
      });
    });
  });

  if (!entites.length) return;

  const batchSize = 100;
  for (let i = 0; i < entites.length; i += batchSize) {
    await supabase.from('entites_trouvees').upsert(entites.slice(i, i + batchSize), {
      onConflict: 'dossier_id,type_entite,valeur',
      ignoreDuplicates: true,
    });
  }
}

export async function getEntitesByDossier(dossierId: string): Promise<EntiteTrouvee[]> {
  const { data, error } = await supabase
    .from('entites_trouvees')
    .select('*')
    .eq('dossier_id', dossierId)
    .order('trust_level', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

function detectEntityType(item: any): EntityType {
  if (item.email) return 'email';
  if (item.ip) return 'ip';
  if (item.subdomain) return 'domain';
  if (item.username) return 'username';
  if (item.url) return 'url';
  const cat = (item.category || item.platform || '').toLowerCase();
  if (cat.includes('email')) return 'email';
  if (cat.includes('phone') || cat.includes('tel')) return 'phone';
  if (cat.includes('social') || cat.includes('twitter') || cat.includes('instagram')) return 'social_profile';
  return 'username';
}
