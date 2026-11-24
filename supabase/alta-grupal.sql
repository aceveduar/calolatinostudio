-- Ejecutar después del esquema de Compás. Se puede volver a ejecutar.
begin;

create table if not exists public.campanas_alta (
  token uuid primary key default gen_random_uuid(),
  academia_id uuid not null references public.academias(id) on delete cascade,
  vence timestamptz not null,
  cerrada boolean not null default false,
  altas integer not null default 0
);
create unique index if not exists campanas_alta_abierta_idx
  on public.campanas_alta (academia_id) where not cerrada;

create table if not exists public.registros_alta (
  campana uuid not null references public.campanas_alta(token) on delete cascade,
  solicitud uuid not null,
  alumno_id uuid not null references public.alumnos(id) on delete cascade,
  portal_emitido text not null,
  primary key (campana, solicitud)
);

alter table public.campanas_alta enable row level security;
alter table public.registros_alta enable row level security;
revoke all on public.campanas_alta, public.registros_alta from public, anon, authenticated;

create or replace function public.gestionar_alta_grupal(p_academia uuid, p_accion text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare c public.campanas_alta%rowtype;
begin
  if not exists (select 1 from public.miembros m where m.academia_id = p_academia
                 and m.user_id = auth.uid() and m.rol in ('dueno', 'recepcion')) then
    raise exception 'Sin acceso a la academia' using errcode = '42501';
  end if;

  perform 1 from public.academias where id = p_academia and deleted_at is null for update;
  if not found then return null; end if;
  select * into c from public.campanas_alta where academia_id = p_academia and not cerrada for update;

  if p_accion = 'cerrar' or (p_accion = 'abrir' and c.vence <= clock_timestamp()) then
    update public.campanas_alta set cerrada = true where token = c.token returning * into c;
  end if;
  if p_accion = 'abrir' and (c.token is null or c.cerrada) then
    insert into public.campanas_alta (academia_id, vence) values (p_academia, clock_timestamp() + interval '168 hours')
    returning * into c;
  end if;
  if c.token is null then return null; end if;
  return jsonb_build_object('token', c.token, 'vence', c.vence, 'altas', c.altas,
                            'abierta', not c.cerrada and c.vence > clock_timestamp());
end;
$$;

create or replace function public.estado_alta_grupal(p_token uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('nombre', a.nombre, 'abierta', not c.cerrada and c.vence > now() and c.altas < 1000)
  from public.campanas_alta c join public.academias a on a.id = c.academia_id
  where c.token = p_token and a.deleted_at is null
$$;

create or replace function public.normalizar_telefono_alta(p_telefono text)
returns text language sql immutable set search_path = ''
as $$
  select case when d ~ '^52[0-9]{10}$' or d ~ '^521[0-9]{10}$' then right(d, 10) else d end
  from (select regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g') d) n
$$;

create or replace function public.registrar_alta_grupal(p_token uuid, p_solicitud uuid, p_nombre text, p_telefono text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  c public.campanas_alta%rowtype;
  ficha public.alumnos%rowtype;
  telefono_limpio text;
  nombre_limpio text;
  codigo_pase text;
  portal_nuevo text;
  alumno_nuevo uuid := gen_random_uuid();
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  ahora bigint;
begin
  if p_solicitud is null or p_nombre is null or p_telefono is null
    or length(p_nombre) > 120 or length(p_telefono) > 32 then
    return jsonb_build_object('estado', 'datos');
  end if;
  nombre_limpio := trim(regexp_replace(p_nombre, '[[:space:]]+', ' ', 'g'));
  telefono_limpio := public.normalizar_telefono_alta(p_telefono);
  if nombre_limpio !~ '[[:alpha:]]' or length(nombre_limpio) < 3
    or telefono_limpio !~ '^[0-9]{10}$' or p_telefono !~ '^[+0-9 ().-]+$' then
    return jsonb_build_object('estado', 'datos');
  end if;

  -- Serializa registros y cierre de esta campaña, también en envíos concurrentes.
  select * into c from public.campanas_alta where token = p_token for update;
  if c.token is null or not exists (
    select 1 from public.academias a where a.id = c.academia_id and a.deleted_at is null
  ) then return jsonb_build_object('estado', 'cerrada'); end if;

  select a.* into ficha
    from public.registros_alta r join public.alumnos a on a.id = r.alumno_id
    where r.campana = p_token and r.solicitud = p_solicitud and a.academia_id = c.academia_id
      and a.portal = r.portal_emitido and a.activo and a.deleted_at is null;
  if found and ficha.nombre = nombre_limpio and ficha.telefono = telefono_limpio then
    return jsonb_build_object('estado', 'lista', 'portal', ficha.portal);
  end if;
  if c.cerrada or c.vence <= clock_timestamp() or c.altas >= 1000 then
    return jsonb_build_object('estado', 'cerrada');
  end if;
  if exists (select 1 from public.registros_alta where campana = p_token and solicitud = p_solicitud)
    or exists (select 1 from public.alumnos a where a.academia_id = c.academia_id and a.deleted_at is null
               and public.normalizar_telefono_alta(a.telefono) = telefono_limpio) then
    return jsonb_build_object('estado', 'recepcion');
  end if;

  loop
    select string_agg(substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1), '' order by n)
      into codigo_pase from generate_series(1, 6) n;
    exit when not exists (select 1 from public.alumnos a where a.academia_id = c.academia_id and a.codigo = codigo_pase);
  end loop;
  portal_nuevo := replace(gen_random_uuid()::text, '-', '');
  ahora := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  insert into public.alumnos (id, academia_id, nombre, telefono, codigo, portal, created_at, updated_at)
    values (alumno_nuevo, c.academia_id, nombre_limpio, telefono_limpio, codigo_pase, portal_nuevo, ahora, ahora);
  insert into public.registros_alta (campana, solicitud, alumno_id, portal_emitido)
    values (c.token, p_solicitud, alumno_nuevo, portal_nuevo);
  update public.campanas_alta set altas = altas + 1 where token = c.token;
  return jsonb_build_object('estado', 'lista', 'portal', portal_nuevo);
end;
$$;

revoke all on function public.normalizar_telefono_alta(text) from public, anon, authenticated;
revoke all on function public.gestionar_alta_grupal(uuid, text) from public, anon, authenticated;
revoke all on function public.estado_alta_grupal(uuid) from public, anon, authenticated;
revoke all on function public.registrar_alta_grupal(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.gestionar_alta_grupal(uuid, text) to authenticated;
grant execute on function public.estado_alta_grupal(uuid), public.registrar_alta_grupal(uuid, uuid, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
