-- ladder-lab · una estampa es activa en un solo juego: el suyo actual.
-- Corrige el bug de docs/backlog/FASE_7_ESTAMPA_ACTIVA.md «Pendientes (a)»: tras
-- cambiar juego.nombre con corregir_estampa y marcar la versión nueva, la fila del
-- nombre viejo seguía apuntando a la misma estampa (activa en dos juegos).
-- Depende de 20261114120000_estampa_activa.sql. Aplicarla a la base lo hace Freddy.

-- La RPC borra las filas de esa estampa con otro juego antes de escribir la nueva.
-- service_role no tiene DELETE sobre estampas_activas (decisión de la migración
-- anterior) y no se le concede: la función pasa a `security definer`, así el
-- borrado queda acotado a esta regla y service_role sigue sin poder borrar a mano.
-- Seguro porque search_path está fijado y el execute sigue limitado a service_role.
create or replace function public.marcar_estampa_activa(p_id uuid, p_numero_version integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_archivada timestamptz;
  v_numero integer;
  v_juego text;
  v_anterior jsonb;
begin
  select archivada_en into v_archivada from public.estampas where id = p_id for update;
  if not found then
    raise exception 'no existe la estampa %', p_id using errcode = 'LL001';
  end if;
  if v_archivada is not null then
    raise exception 'la estampa % está archivada: no se puede marcar como activa', p_id
      using errcode = 'LL005';
  end if;

  v_numero := coalesce(
    p_numero_version,
    (select max(numero_version) from public.estampa_versiones where estampa_id = p_id)
  );
  select juego into v_juego
    from public.estampa_versiones
   where estampa_id = p_id and numero_version = v_numero;
  if not found then
    raise exception 'la estampa % no tiene la versión %', p_id, v_numero
      using errcode = 'LL006';
  end if;

  select jsonb_build_object('id', a.estampa_id, 'numeroVersion', a.numero_version)
    into v_anterior
    from public.estampas_activas a
    join public.estampas e on e.id = a.estampa_id
   where lower(a.juego) = lower(v_juego) and e.archivada_en is null;

  delete from public.estampas_activas
   where estampa_id = p_id and lower(juego) <> lower(v_juego);

  insert into public.estampas_activas (juego, estampa_id, numero_version)
  values (v_juego, p_id, v_numero)
  on conflict ((lower(juego))) do update
    set juego = excluded.juego,
        estampa_id = excluded.estampa_id,
        numero_version = excluded.numero_version,
        elegida_en = now();

  return jsonb_build_object(
    'juego', v_juego,
    'id', p_id,
    'numeroVersion', v_numero,
    'anterior', v_anterior
  );
end;
$$;

-- create or replace conserva los grants; se repiten por si la función se recrea.
revoke execute on function public.marcar_estampa_activa(uuid, integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.marcar_estampa_activa(uuid, integer) to service_role;
  end if;
end;
$$;
