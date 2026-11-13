-- =============================================================
-- Compás · Esquema Supabase (Postgres)
-- Ejecutar completo en: Supabase > SQL Editor > New query
-- Multi-academia: cada fila lleva academia_id y RLS limita el acceso
-- a los miembros de esa academia.
-- Timestamps de negocio en ms (bigint) generados en el teléfono.
-- server_updated_at lo pone el servidor y es el cursor de sincronización.
-- =============================================================

create table if not exists academias (
  id uuid primary key,
  nombre text not null,
  moneda text not null default 'MXN',
  color text,
  logo text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists miembros (
  user_id uuid not null references auth.users(id) on delete cascade,
  academia_id uuid not null references academias(id) on delete cascade,
  rol text not null default 'dueno',
  primary key (user_id, academia_id)
);

create table if not exists usuarios (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  nombre text not null,
  rol text not null check (rol in ('dueno','recepcion')),
  pin_hash text not null,
  activo boolean not null default true,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists disciplinas (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  nombre text not null,
  color text not null,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists maestros (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  nombre text not null,
  telefono text not null default '',
  notas text not null default '',
  activo boolean not null default true,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists clases (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  disciplina_id uuid not null,
  nivel text not null,
  maestro text not null default '',  -- obsoleto (v1), se conserva por compatibilidad
  maestro_id uuid,
  dias int[] not null default '{}',
  hora_inicio text not null,
  duracion_min int not null default 60,
  activo boolean not null default true,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists planes (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  nombre text not null,
  tipo text not null check (tipo in ('suelta','mensual','paquete')),
  precio int not null,
  clases int,
  vigencia_dias int,
  disciplina_id uuid,
  activo boolean not null default true,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists alumnos (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  nombre text not null,
  telefono text not null default '',
  notas text not null default '',
  codigo text not null,
  activo boolean not null default true,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists membresias (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  alumno_id uuid not null,
  plan_id uuid not null,
  pago_id uuid not null,
  disciplina_id uuid,
  inicio date not null,
  fin date not null,
  clases_total int,
  anulada_at bigint,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists pagos (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  alumno_id uuid,
  plan_id uuid,
  concepto text not null,
  monto int not null,
  metodo text not null check (metodo in ('efectivo','transferencia','tarjeta')),
  usuario_id uuid not null,
  fecha date not null,
  anulado_at bigint,
  anulado_motivo text,
  anulado_por uuid,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists asistencias (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  alumno_id uuid,
  nombre_visitante text,
  clase_id uuid not null,
  fecha date not null,
  membresia_id uuid,
  pago_id uuid,
  usuario_id uuid not null,
  anulada_at bigint,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists cortes (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  fecha date not null,
  esperado_efectivo int not null,
  contado_efectivo int not null,
  diferencia int not null,
  total_otros int not null,
  usuario_id uuid not null,
  notas text not null default '',
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- Migraciones (seguras de re-ejecutar)
alter table academias add column if not exists color text;
alter table academias add column if not exists logo text;
alter table clases add column if not exists maestro_id uuid;

-- ---------- cursor de sincronización ----------
create or replace function tocar_server_updated_at() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();  -- distinto por fila, evita empates en el cursor
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['academias','usuarios','disciplinas','maestros','clases','planes','alumnos','membresias','pagos','asistencias','cortes'] loop
    execute format('drop trigger if exists trg_touch on %I', t);
    execute format('create trigger trg_touch before insert or update on %I for each row execute function tocar_server_updated_at()', t);
    execute format('create index if not exists %I on %I (%s, server_updated_at)', t || '_sync_idx', t,
                   case when t = 'academias' then 'id' else 'academia_id' end);
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------- seguridad (RLS) ----------
create or replace function es_miembro(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros where user_id = auth.uid() and academia_id = a);
$$;

alter table miembros enable row level security;
drop policy if exists miembros_propios on miembros;
create policy miembros_propios on miembros for select using (user_id = auth.uid());

drop policy if exists academia_miembros on academias;
create policy academia_miembros on academias for all
  using (es_miembro(id)) with check (es_miembro(id));

do $$
declare t text;
begin
  foreach t in array array['usuarios','disciplinas','maestros','clases','planes','alumnos','membresias','pagos','asistencias','cortes'] loop
    execute format('drop policy if exists acceso_miembros on %I', t);
    execute format('create policy acceso_miembros on %I for all using (es_miembro(academia_id)) with check (es_miembro(academia_id))', t);
  end loop;
end $$;

-- ---------- alta de academia desde el teléfono ----------
create or replace function vincular_academia(p_id uuid, p_nombre text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if exists (select 1 from academias where id = p_id) then
    if not es_miembro(p_id) then raise exception 'Esta academia ya está vinculada a otra cuenta'; end if;
    return;
  end if;
  insert into academias (id, nombre, created_at, updated_at)
    values (p_id, p_nombre, (extract(epoch from now())*1000)::bigint, (extract(epoch from now())*1000)::bigint);
  insert into miembros (user_id, academia_id, rol) values (auth.uid(), p_id, 'dueno');
end $$;

grant execute on function vincular_academia(uuid, text) to authenticated;

-- ---------- permisos explícitos ----------
-- El proyecto se crea con "Automatically expose new tables" DESACTIVADO,
-- así que nada queda expuesto salvo lo que se otorga aquí:
--  · anon (sin sesión): nada.
--  · authenticated: leer/crear/actualizar. Sin DELETE: la app nunca borra, anula (auditoría).
--  · RLS (arriba) limita además cada fila a los miembros de su academia.
do $$
declare t text;
begin
  foreach t in array array['academias','usuarios','disciplinas','maestros','clases','planes','alumnos','membresias','pagos','asistencias','cortes'] loop
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update on %I to authenticated', t);
  end loop;
end $$;

revoke all on miembros from anon;
grant select on miembros to authenticated;

revoke execute on function es_miembro(uuid) from public, anon;
grant execute on function es_miembro(uuid) to authenticated;
revoke execute on function vincular_academia(uuid, text) from public, anon;
grant execute on function vincular_academia(uuid, text) to authenticated;
