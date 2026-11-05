-- ladder-lab · estampas versionadas e inmutables.
-- Decisión de diseño: docs/decisions/DECISION_MODELO_DATOS.md
-- Aplicar esta migración a un proyecto lo hace Freddy (supabase db push).

-- ---------------------------------------------------------------- tablas

create table public.estampas (
  id uuid primary key default gen_random_uuid(),
  creada_en timestamptz not null default now(),
  archivada_en timestamptz
);

-- El documento de la estampa (datos) es la fuente de verdad; las columnas
-- generadas solo existen para filtrar e indexar, nunca se escriben a mano.
create table public.estampa_versiones (
  estampa_id uuid not null references public.estampas (id),
  numero_version integer not null check (numero_version >= 1),
  version_formato integer not null check (version_formato >= 1),
  datos jsonb not null check (jsonb_typeof(datos) = 'object'),
  creada_en timestamptz not null default now(),
  juego text generated always as (datos #>> '{juego,nombre}') stored not null,
  genero text generated always as (datos #>> '{juego,genero}') stored not null,
  certeza text generated always as (datos #>> '{resultado,certeza}') stored not null,
  rango text generated always as (datos #>> '{resultado,rango}') stored not null,
  fecha text generated always as (
    case
      when (datos #>> '{juego,fecha}') ~ '^\d{4}-\d{2}-\d{2}$'
        then datos #>> '{juego,fecha}'
    end
  ) stored,
  match_perfecto boolean generated always as (
    coalesce((datos #> '{resultado,matchPerfecto}') = 'true'::jsonb, false)
  ) stored,
  primary key (estampa_id, numero_version),
  constraint estampa_versiones_genero_valido check (genero in ('FPS', 'RTS')),
  constraint estampa_versiones_certeza_valida
    check (certeza in ('medido', 'recordado', 'estimado'))
);

create index estampa_versiones_juego_idx on public.estampa_versiones (juego);

-- ------------------------------------------------- inmutabilidad (sin borrado)

create function public.bloquear_modificacion() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'las estampas y sus versiones no se modifican ni se borran (tabla %)', tg_table_name
    using errcode = 'LL010';
end;
$$;

create trigger estampa_versiones_inmutables
  before update or delete on public.estampa_versiones
  for each row execute function public.bloquear_modificacion();
create trigger estampa_versiones_sin_truncate
  before truncate on public.estampa_versiones
  for each statement execute function public.bloquear_modificacion();
create trigger estampas_sin_borrado
  before delete on public.estampas
  for each row execute function public.bloquear_modificacion();
create trigger estampas_sin_truncate
  before truncate on public.estampas
  for each statement execute function public.bloquear_modificacion();

-- De una estampa solo puede cambiar archivada_en (archivar, F3).
create function public.estampas_solo_archivar() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id or new.creada_en is distinct from old.creada_en then
    raise exception 'de una estampa solo puede cambiar archivada_en'
      using errcode = 'LL010';
  end if;
  return new;
end;
$$;

create trigger estampas_solo_archivar
  before update on public.estampas
  for each row execute function public.estampas_solo_archivar();

-- ------------------------------------------------------- derivadaDe válida

-- Rechaza la autorreferencia y la referencia a una estampa que no existe.
-- No recorre ciclos largos: en v1 nada recorre el árbol.
create function public.validar_derivada() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_derivada text := new.datos ->> 'derivadaDe';
begin
  if v_derivada is null then
    return new;
  end if;
  if v_derivada = new.estampa_id::text then
    raise exception 'una estampa no puede derivar de sí misma'
      using errcode = 'LL003';
  end if;
  if v_derivada !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or not exists (select 1 from public.estampas where id = v_derivada::uuid) then
    raise exception 'derivadaDe apunta a una estampa que no existe: %', v_derivada
      using errcode = 'LL003';
  end if;
  return new;
end;
$$;

create trigger estampa_versiones_validar_derivada
  before insert on public.estampa_versiones
  for each row execute function public.validar_derivada();

-- ------------------------------------------------------- vistas de lectura

-- security_invoker: la vista respeta RLS de quien consulta. Sin esta opción
-- correría con los permisos del dueño y expondría los datos a la clave anónima.
create view public.estampas_historial with (security_invoker = true) as
select
  v.estampa_id as id,
  v.numero_version,
  (count(*) over (partition by v.estampa_id))::integer as total_versiones,
  (e.archivada_en is not null) as archivada,
  e.creada_en,
  v.creada_en as version_creada_en,
  v.datos,
  v.juego,
  v.genero,
  v.fecha,
  v.match_perfecto
from public.estampa_versiones v
join public.estampas e on e.id = v.estampa_id;

create view public.estampas_vigentes with (security_invoker = true) as
select * from public.estampas_historial where numero_version = total_versiones;

-- ------------------------------------------------- escritura atómica (RPC)

-- supabase-js no abre transacciones de varias sentencias: crear y corregir
-- viven en la base para que nunca quede una estampa sin versión ni dos
-- versiones con el mismo número.

create function public.crear_estampa(p_datos jsonb, p_version_formato integer)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.estampas default values returning estampas.id into v_id;
  insert into public.estampa_versiones (estampa_id, numero_version, version_formato, datos)
  values (v_id, 1, p_version_formato, p_datos);
  return jsonb_build_object('id', v_id, 'numeroVersion', 1);
end;
$$;

create function public.corregir_estampa(
  p_id uuid,
  p_version_base integer,
  p_datos jsonb,
  p_version_formato integer
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_actual integer;
begin
  perform 1 from public.estampas where id = p_id for update;
  if not found then
    raise exception 'no existe la estampa %', p_id using errcode = 'LL001';
  end if;

  select max(numero_version) into v_actual
  from public.estampa_versiones where estampa_id = p_id;

  if v_actual is distinct from p_version_base then
    raise exception 'la estampa % ya no está en la versión %', p_id, p_version_base
      using errcode = 'LL002';
  end if;

  insert into public.estampa_versiones (estampa_id, numero_version, version_formato, datos)
  values (p_id, v_actual + 1, p_version_formato, p_datos);

  return jsonb_build_object('id', p_id, 'numeroVersion', v_actual + 1);
end;
$$;

-- ------------------------------------------------------------- seguridad

alter table public.estampas enable row level security;
alter table public.estampa_versiones enable row level security;
-- Sin políticas a propósito: solo el servidor, con la clave de servicio
-- (que ignora RLS), accede. anon y authenticated no ven ni escriben nada.

revoke execute on function public.crear_estampa(jsonb, integer) from public;
revoke execute on function public.corregir_estampa(uuid, integer, jsonb, integer) from public;

-- Los permisos se declaran de forma explícita: no se depende de los privilegios
-- por defecto de cada entorno. Mínimo privilegio: service_role lee y escribe lo
-- necesario pero NO tiene DELETE ni TRUNCATE (además de los triggers). Los roles
-- de Supabase no existen en un Postgres plano, de ahí las comprobaciones.
do $$
declare
  v_rol text;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = v_rol) then
      execute format('revoke all on public.estampas, public.estampa_versiones, public.estampas_historial, public.estampas_vigentes from %I', v_rol);
      execute format('revoke execute on function public.crear_estampa(jsonb, integer) from %I', v_rol);
      execute format('revoke execute on function public.corregir_estampa(uuid, integer, jsonb, integer) from %I', v_rol);
    end if;
  end loop;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema public to service_role;
    grant select, insert, update on public.estampas to service_role;
    grant select, insert on public.estampa_versiones to service_role;
    grant select on public.estampas_historial, public.estampas_vigentes to service_role;
    grant execute on function public.crear_estampa(jsonb, integer) to service_role;
    grant execute on function public.corregir_estampa(uuid, integer, jsonb, integer) to service_role;
  end if;
end;
$$;
