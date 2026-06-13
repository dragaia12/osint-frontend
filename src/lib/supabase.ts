import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// createClient crash avec une URL vide — on utilise des valeurs placeholder
// qui permettent au client de s'instancier sans lever d'exception.
// Les appels réseau échoueront proprement (erreur catchée) plutôt que de crasher.
const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const isConfigured = !!(supabaseUrl && supabaseAnonKey);

export default supabase;
