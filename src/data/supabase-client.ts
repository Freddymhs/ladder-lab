import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ConfiguracionSupabase {
  readonly url: string | undefined;
  readonly serviceKey: string | undefined;
}

/** El servidor es el único que habla con Supabase, con la clave de servicio. */
export function crearClienteSupabase(
  config: ConfiguracionSupabase,
): SupabaseClient {
  const { url, serviceKey } = config;
  if (!url || !serviceKey) {
    throw new Error(
      'Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY para conectar con la base',
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
