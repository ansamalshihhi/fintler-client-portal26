// ═══════════════════════════════════════════════════════
// FINTLER PORTAL — SUPABASE CONNECTION
// ═══════════════════════════════════════════════════════

const SUPABASE_URL = 'https://hhxdosdevqmfgdofxxxc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_PcXOAhifyP-4tROoAIapZQ_nUcAtUd-';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
