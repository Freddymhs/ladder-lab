-- ladder-lab · F3: archivar e importar. Depende de 20261105120000_crear_estampas.sql.
-- Aplicar esta migración a un proyecto lo hace Freddy (supabase db push).

-- Archivar no borra: solo marca archivada_en (el trigger de la migración anterior
-- ya impide tocar cualquier otra columna de estampas). Es idempotente.
create function public.archivar_estampa(p_id uuid)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.estampas
     set archivada_en = coalesce(archivada_en, now())
   where id = p_id;
  if not found then
    raise exception 'no existe la estampa %', p_id using errcode = 'LL001';
  end if;
  return jsonb_build_object('id', p_id, 'archivada', true);
end;
$$;

-- Importación atómica: o entra todo o no entra nada. Las estampas cuyo id ya
-- existe se omiten (las versiones son inmutables: nunca se pisa nada).
-- Con p_dry_run = true se ejecuta TODO, con todas las comprobaciones reales, y
-- se deshace al final: la simulación no puede aprobar algo que la real rechazaría.
--
-- p_plan: { "estampas": [ { "id": uuid, "archivada": bool,
--                           "versiones": [ { "numero": 1, "datos": {...} }, ... ] } ] }
create function public.importar_estampas(
  p_plan jsonb,
  p_dry_run boolean,
  p_version_formato integer
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_estampa jsonb;
  v_version jsonb;
  v_id uuid;
  v_esperada integer;
  v_nuevas integer := 0;
  v_versiones integer := 0;
  v_omitidas jsonb := '[]'::jsonb;
  v_ids_nuevos uuid[] := '{}';
begin
  if jsonb_typeof(p_plan -> 'estampas') is distinct from 'array' then
    raise exception 'plan de importación inválido: falta el arreglo estampas'
      using errcode = 'LL004';
  end if;

  begin -- subtransacción: la simulación la deshace entera
    -- 1) identidades primero, para que derivadaDe pueda apuntar a otra del mismo lote
    for v_estampa in select * from jsonb_array_elements(p_plan -> 'estampas') loop
      v_id := (v_estampa ->> 'id')::uuid;
      if exists (select 1 from public.estampas where id = v_id) then
        v_omitidas := v_omitidas || to_jsonb(v_id::text);
      else
        insert into public.estampas (id, archivada_en)
        values (v_id, case when coalesce((v_estampa ->> 'archivada')::boolean, false) then now() end);
        v_nuevas := v_nuevas + 1;
        v_ids_nuevos := v_ids_nuevos || v_id;
      end if;
    end loop;

    -- 2) versiones, de la 1 en adelante y sin saltos
    for v_estampa in select * from jsonb_array_elements(p_plan -> 'estampas') loop
      v_id := (v_estampa ->> 'id')::uuid;
      continue when not (v_id = any (v_ids_nuevos));

      v_esperada := 1;
      for v_version in select * from jsonb_array_elements(v_estampa -> 'versiones') loop
        if (v_version ->> 'numero')::integer is distinct from v_esperada then
          raise exception 'la estampa % tiene versiones incompletas o repetidas (se esperaba la %)', v_id, v_esperada
            using errcode = 'LL004';
        end if;
        insert into public.estampa_versiones (estampa_id, numero_version, version_formato, datos)
        values (v_id, v_esperada, p_version_formato, v_version -> 'datos');
        v_esperada := v_esperada + 1;
        v_versiones := v_versiones + 1;
      end loop;

      if v_esperada = 1 then
        raise exception 'la estampa % no trae ninguna versión', v_id using errcode = 'LL004';
      end if;
    end loop;

    if p_dry_run then
      raise exception 'simulación' using errcode = 'LL099';
    end if;
  exception
    when sqlstate 'LL099' then
      null; -- deshace lo hecho en el bloque; los contadores se conservan
  end;

  return jsonb_build_object(
    'estampasNuevas', v_nuevas,
    'versionesNuevas', v_versiones,
    'omitidas', v_omitidas,
    'aplicada', not p_dry_run
  );
end;
$$;

-- Permisos explícitos, igual que en la migración anterior.
revoke execute on function public.archivar_estampa(uuid) from public;
revoke execute on function public.importar_estampas(jsonb, boolean, integer) from public;

do $$
declare
  v_rol text;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = v_rol) then
      execute format('revoke execute on function public.archivar_estampa(uuid) from %I', v_rol);
      execute format('revoke execute on function public.importar_estampas(jsonb, boolean, integer) from %I', v_rol);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.archivar_estampa(uuid) to service_role;
    grant execute on function public.importar_estampas(jsonb, boolean, integer) to service_role;
  end if;
end;
$$;
