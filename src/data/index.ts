export type {
  EstampaRepository,
  FiltroListado,
  OpcionesImportacion,
  OpcionesTodas,
  ResultadoImportacion,
} from './estampa.repository.js';
export { InMemoryEstampaRepository } from './in-memory-estampa.repository.js';
export { SupabaseEstampaRepository } from './supabase-estampa.repository.js';
export { crearClienteSupabase } from './supabase-client.js';
export type { ConfiguracionSupabase } from './supabase-client.js';
