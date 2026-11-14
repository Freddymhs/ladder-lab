-- ladder-lab · la estampa activa de cada juego. Depende de las dos migraciones anteriores.
-- Decisión: docs/decisions/DECISION_MODELO_DATOS.md, sección «Estampa activa».
-- Aplicar esta migración a la base lo hace Freddy (docs/runbooks/PUESTA_EN_MARCHA.md).

-- Las versiones son inmutables: la elección vive aparte, una fila por juego,
-- fijada a una versión concreta. Elegir otra del mismo juego reemplaza la fila.
create table public.estampas_activas (
  juego text primary key,
  estampa_id uuid not null,
  numero_version integer not null,
  elegida_en timestamptz not null default now(),
  foreign key (estampa_id, numero_version)
    references public.estampa_versiones (estampa_id, numero_version)
);

-- Un juego es el mismo sin distinguir mayúsculas («StarCraft II» = «starcraft ii»),
-- igual que el filtro por juego de listar_estampas y mejor_por_juego.
create unique index estampas_activas_juego_sin_mayusculas
  on public.estampas_activas (lower(juego));

-- Garantía para cualquier escritura, no solo la RPC: la versión existe, su
-- estampa no está archivada y `juego` es el de esa versión.
create function public.validar_estampa_activa() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_juego text;
  v_archivada timestamptz;
begin
  select v.juego, e.archivada_en into v_juego, v_archivada
    from public.estampa_versiones v
    join public.estampas e on e.id = v.estampa_id
   where v.estampa_id = new.estampa_id and v.numero_version = new.numero_version;
  if not found then
    raise exception 'la estampa % no tiene la versión %', new.estampa_id, new.numero_version
      using errcode = 'LL006';
  end if;
  if v_archivada is not null then
    raise exception 'la estampa % está archivada: no se puede marcar como activa', new.estampa_id
      using errcode = 'LL005';
  end if;
  if new.juego is distinct from v_juego then
    raise exception 'el juego % no es el de la versión % de la estampa % (%)',
      new.juego, new.numero_version, new.estampa_id, v_juego
      using errcode = 'LL007';
  end if;
  return new;
end;
$$;

create trigger estampas_activas_validar
  before insert or update on public.estampas_activas
  for each row execute function public.validar_estampa_activa();

-- Lectura: la versión fijada, con los mismos campos que estampas_historial.
-- Archivar la activa deja el juego sin activa: la fila queda, pero no se lee.
create view public.estampas_activas_detalle with (security_invoker = true) as
select h.*, a.elegida_en
from public.estampas_activas a
join public.estampas_historial h
  on h.id = a.estampa_id and h.numero_version = a.numero_version
where not h.archivada;

-- Nombres de juego en uso, para sugerir el correcto cuando se escribe uno parecido.
create view public.juegos_registrados with (security_invoker = true) as
select distinct juego from public.estampas_vigentes where not archivada;

-- Marcar es atómico: lee la anterior y reemplaza en una sola llamada.
-- Sin p_numero_version fija la última versión que la estampa tenga ahora.
create function public.marcar_estampa_activa(p_id uuid, p_numero_version integer default null)
returns jsonb
language plpgsql
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

-- ------------------------------------------------------------- seguridad

alter table public.estampas_activas enable row level security;
-- Sin políticas, igual que las demás tablas: solo la clave de servicio accede.

revoke execute on function public.marcar_estampa_activa(uuid, integer) from public;

-- Permisos explícitos. service_role reemplaza la elección (UPDATE) pero no la
-- borra: sin DELETE ni TRUNCATE.
do $$
declare
  v_rol text;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = v_rol) then
      execute format('revoke all on public.estampas_activas, public.estampas_activas_detalle, public.juegos_registrados from %I', v_rol);
      execute format('revoke execute on function public.marcar_estampa_activa(uuid, integer) from %I', v_rol);
    end if;
  end loop;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on public.estampas_activas to service_role;
    grant select on public.estampas_activas_detalle, public.juegos_registrados to service_role;
    grant execute on function public.marcar_estampa_activa(uuid, integer) to service_role;
  end if;
end;
$$;
