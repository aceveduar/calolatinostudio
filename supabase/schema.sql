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
  mensajes jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists sedes (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  nombre text not null,
  color text not null default '#6e6a7c',
  activo boolean not null default true,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
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
  rol text not null,
  maestro_id uuid,
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

create table if not exists productos (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  nombre text not null,
  precio int not null,
  emoji text not null default '🛍️',
  foto text,
  categoria text not null default 'consumo' check (categoria in ('consumo','articulo')),
  descripcion text not null default '',
  inventario int,
  inventario_at bigint,
  alerta int not null default 5,
  activo boolean not null default true,
  en_linea boolean not null default false,
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

create table if not exists gastos_fijos (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  sede_id uuid,
  concepto text not null,
  categoria text not null default 'otro',
  monto int not null,
  dia int not null default 1,
  activo boolean not null default true,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists gastos (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  sede_id uuid,
  concepto text not null,
  categoria text not null default 'otro',
  monto int not null,
  fecha date not null,
  fijo_id uuid,
  metodo text not null default 'efectivo',
  notas text not null default '',
  usuario_id uuid not null,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists rentas (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  sede_id uuid,
  nombre text not null,
  telefono text not null default '',
  tipo text not null default 'mensual' check (tipo in ('mensual','evento')),
  dias int[] not null default '{}',
  hora_inicio text not null,
  duracion_min int not null default 60,
  desde date not null,
  hasta date,
  monto int not null default 0,
  notas text not null default '',
  activo boolean not null default true,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists pedidos (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  alumno_id uuid not null,
  producto_id uuid not null,
  opcion text,
  cantidad int not null default 1 check (cantidad between 1 and 20),
  precio int not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','entregado','cancelado')),
  pago_id uuid,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists eventos (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  sede_id uuid,
  salon_id uuid,
  nombre text not null,
  fecha date not null,
  hora_inicio text not null,
  duracion_min int not null default 180,
  cupo int,
  precio int not null default 0,
  descripcion text not null default '',
  activo boolean not null default true,
  renta_id uuid,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists boletos (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  evento_id uuid not null,
  nombre text not null,
  telefono text not null default '',
  alumno_id uuid,
  pago_id uuid,
  codigo text not null,
  usado_at bigint,
  anulado_at bigint,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists interesados (
  id uuid primary key,
  academia_id uuid not null references academias(id),
  nombre text not null,
  telefono text not null,
  clase_id uuid,
  mensaje text not null default '',
  estado text not null default 'nuevo' check (estado in ('nuevo','contactado','inscrito','descartado')),
  contactado_at bigint,
  alumno_id uuid,
  created_at bigint not null, updated_at bigint not null, deleted_at bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- Migraciones (seguras de re-ejecutar)
alter table academias add column if not exists color text;
alter table academias add column if not exists logo text;
alter table academias add column if not exists mensajes jsonb;
alter table pagos add column if not exists producto_id uuid;
alter table pagos add column if not exists cantidad int;
alter table academias add column if not exists sede_principal text;
alter table clases add column if not exists sede_id uuid;
alter table planes add column if not exists sede_id uuid;
alter table membresias add column if not exists sede_id uuid;
alter table pagos add column if not exists sede_id uuid;
alter table cortes add column if not exists sede_id uuid;
alter table usuarios add column if not exists maestro_id uuid;
alter table usuarios drop constraint if exists usuarios_rol_check;
alter table usuarios add constraint usuarios_rol_check check (rol in ('dueno','recepcion','maestro'));
alter table clases add column if not exists maestro_id uuid;
alter table alumnos add column if not exists portal text;
alter table pagos add column if not exists renta_id uuid;
alter table pagos add column if not exists periodo text;
alter table productos add column if not exists opciones text[];
alter table clases add column if not exists precio_suelta int;
alter table planes add column if not exists grupos int;
alter table membresias add column if not exists clase_ids uuid[];
alter table asistencias add column if not exists debe boolean;
alter table academias add column if not exists recargo_diario int;
alter table academias add column if not exists meta_diaria int;
alter table rentas add column if not exists cobro text;
alter table rentas add column if not exists tarifa int;
alter table rentas add column if not exists maestro_id uuid;
alter table academias add column if not exists salones jsonb;
alter table clases add column if not exists salon_id uuid;
alter table rentas add column if not exists salon_id uuid;
alter table pagos add column if not exists evento_id uuid;
alter table gastos add column if not exists evento_id uuid;
alter table rentas add column if not exists evento_id uuid;
alter table productos add column if not exists codigo text;
alter table productos add column if not exists sobre_pedido boolean;
alter table productos add column if not exists dias_entrega int;
alter table pedidos add column if not exists nota text;
alter table pedidos add column if not exists anticipo int;
alter table pedidos add column if not exists anticipo_pago_id uuid;
alter table pedidos drop constraint if exists pedidos_estado_check;
alter table pedidos add constraint pedidos_estado_check check (estado in ('pendiente','pedido','llego','entregado','cancelado'));
alter table academias add column if not exists slug text;
alter table academias add column if not exists whatsapp text;
alter table productos add column if not exists costo int;
alter table pagos add column if not exists costo int;
alter table alumnos add column if not exists foto text;
create unique index if not exists academias_slug_idx on academias (lower(slug)) where slug is not null;
create unique index if not exists alumnos_portal_idx on alumnos (portal) where portal is not null;

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
  foreach t in array array['academias','sedes','usuarios','disciplinas','maestros','clases','planes','productos','alumnos','membresias','pagos','asistencias','cortes','gastos_fijos','gastos','rentas','pedidos','eventos','boletos','interesados'] loop
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
  foreach t in array array['sedes','usuarios','disciplinas','maestros','clases','planes','productos','alumnos','membresias','pagos','asistencias','cortes','gastos_fijos','gastos','rentas','pedidos','eventos','boletos','interesados'] loop
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
  foreach t in array array['academias','sedes','usuarios','disciplinas','maestros','clases','planes','productos','alumnos','membresias','pagos','asistencias','cortes','gastos_fijos','gastos','rentas','pedidos','eventos','boletos','interesados'] loop
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

-- Piezas que se pueden apartar/vender: lo contado menos lo vendido después, menos lo apartado. null = sin control.
create or replace function disponibles_producto(p productos) returns int
language sql stable security definer set search_path = public as $$
  select case when p.inventario is null or coalesce(p.sobre_pedido, false) then null else (
    p.inventario
    - coalesce((select sum(coalesce(v.cantidad, 1)) from pagos v
                where v.producto_id = p.id and v.anulado_at is null and v.deleted_at is null and v.created_at >= coalesce(p.inventario_at, 0)), 0)
    - coalesce((select sum(d.cantidad) from pedidos d where d.producto_id = p.id and d.estado = 'pendiente' and d.deleted_at is null), 0)
  )::int end;
$$;
revoke execute on function disponibles_producto(productos) from public, anon, authenticated;

-- ---------- portal del alumno (enlace personal, sin cuenta) ----------
-- Lo único que puede llamar alguien sin sesión. Recibe el token secreto del enlace (≥ 128 bits, no adivinable)
-- y devuelve SOLO los datos de ese alumno: nombre, código de su QR, planes recientes, últimas clases
-- y los productos que la academia marcó "en línea". Nunca teléfono, notas, pagos ni datos de otros.
create or replace function portal_alumno(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a alumnos;
  hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select * into a from alumnos where portal = p_token and deleted_at is null and activo;
  if not found then return null; end if;
  return jsonb_build_object(
    'hoy', hoy,
    'alumno', jsonb_build_object('nombre', a.nombre, 'codigo', a.codigo, 'foto', a.foto),
    'academia', (select jsonb_build_object('nombre', x.nombre, 'color', x.color, 'logo', x.logo) from academias x where x.id = a.academia_id),
    'planes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'plan', p.nombre, 'tipo', p.tipo, 'beca', (p.precio = 0 and p.tipo <> 'suelta'),
        'inicio', m.inicio, 'fin', m.fin, 'clases', m.clases_total,
        'usadas', (select count(*) from asistencias s where s.membresia_id = m.id and s.anulada_at is null and s.deleted_at is null)
      ) order by m.fin desc)
      from membresias m join planes p on p.id = m.plan_id
      where m.alumno_id = a.id and m.anulada_at is null and m.deleted_at is null and m.fin >= hoy - 60
    ), '[]'::jsonb),
    'clases', coalesce((
      select jsonb_agg(c order by c->>'fecha' desc) from (
        select jsonb_build_object('fecha', s.fecha, 'clase', trim(coalesce(d.nombre, 'Clase') || ' ' || coalesce(k.nivel, '')), 'color', d.color) c
        from asistencias s left join clases k on k.id = s.clase_id left join disciplinas d on d.id = k.disciplina_id
        where s.alumno_id = a.id and s.anulada_at is null and s.deleted_at is null
        order by s.fecha desc, s.created_at desc limit 8
      ) t
    ), '[]'::jsonb),
    'tienda', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'precio', p.precio, 'emoji', p.emoji, 'foto', p.foto, 'descripcion', p.descripcion,
                                          'opciones', coalesce(to_jsonb(p.opciones), '[]'::jsonb), 'disponibles', disponibles_producto(p),
                                          'sobre_pedido', coalesce(p.sobre_pedido, false), 'dias_entrega', p.dias_entrega) order by p.categoria, p.nombre)
      from productos p where p.academia_id = a.academia_id and p.en_linea and p.activo and p.deleted_at is null
    ), '[]'::jsonb),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object('producto', p.nombre, 'emoji', p.emoji, 'opcion', d.opcion, 'nota', d.nota, 'cantidad', d.cantidad, 'precio', d.precio,
                                          'anticipo', coalesce(d.anticipo, 0), 'estado', d.estado, 'creado', d.created_at) order by d.created_at desc)
      from pedidos d join productos p on p.id = d.producto_id
      where d.alumno_id = a.id and d.deleted_at is null
        and (d.estado in ('pendiente', 'pedido', 'llego') or d.updated_at > (extract(epoch from now()) * 1000)::bigint - 30::bigint * 86400000)
    ), '[]'::jsonb)
  );
end $$;

revoke execute on function portal_alumno(text) from public;
grant execute on function portal_alumno(text) to anon, authenticated;

-- Apartar un producto desde el portal. Valida el enlace, que el producto esté en línea, la talla/color,
-- existencias y un máximo de 5 apartados pendientes por alumno (para que nadie llene la lista).
drop function if exists portal_pedir(text, uuid, text, int);
create or replace function portal_pedir(p_token text, p_producto uuid, p_opcion text, p_cantidad int, p_nota text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a alumnos;
  p productos;
  ahora bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  disp int;
  tiene_opciones boolean;
begin
  if p_token is null or length(p_token) < 20 then return jsonb_build_object('error', 'enlace'); end if;
  select * into a from alumnos where portal = p_token and deleted_at is null and activo;
  if not found then return jsonb_build_object('error', 'enlace'); end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 5 then return jsonb_build_object('error', 'cantidad'); end if;
  -- "for update": dos apartados al mismo tiempo no pueden llevarse la última pieza
  select * into p from productos where id = p_producto and academia_id = a.academia_id and en_linea and activo and deleted_at is null for update;
  if not found then return jsonb_build_object('error', 'producto'); end if;
  tiene_opciones := coalesce(array_length(p.opciones, 1), 0) > 0;
  if tiene_opciones and (p_opcion is null or not (p_opcion = any (p.opciones))) then return jsonb_build_object('error', 'opcion'); end if;
  if (select count(*) from pedidos where alumno_id = a.id and estado in ('pendiente', 'pedido', 'llego') and deleted_at is null) >= 5 then
    return jsonb_build_object('error', 'muchos');
  end if;
  disp := disponibles_producto(p);
  if disp is not null and disp < p_cantidad then return jsonb_build_object('error', 'agotado', 'disponibles', greatest(disp, 0)); end if;
  insert into pedidos (id, academia_id, alumno_id, producto_id, opcion, nota, cantidad, precio, estado, created_at, updated_at)
  values (gen_random_uuid(), a.academia_id, a.id, p.id, case when tiene_opciones then p_opcion end, nullif(left(trim(coalesce(p_nota, '')), 200), ''),
          p_cantidad, p.precio, 'pendiente', ahora, ahora);
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function portal_pedir(text, uuid, text, int, text) from public;
grant execute on function portal_pedir(text, uuid, text, int, text) to anon, authenticated;

-- ---------- página pública del estudio (/a/<slug>) ----------
-- Para compartir en Facebook: clases con horario, sede y precios, planes, próximos eventos y la tienda.
-- Nunca nombres de maestros, alumnos ni teléfonos (salvo el WhatsApp de contacto que la academia decida mostrar).
create or replace function pagina_publica(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  ac academias;
  hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  if p_slug is null or length(p_slug) < 3 then return null; end if;
  select * into ac from academias where lower(slug) = lower(p_slug) and deleted_at is null;
  if not found then return null; end if;
  return jsonb_build_object(
    'academia', jsonb_build_object('nombre', ac.nombre, 'color', ac.color, 'logo', ac.logo, 'whatsapp', ac.whatsapp, 'sede_principal', coalesce(ac.sede_principal, 'Sede principal')),
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre, 'color', s.color) order by s.nombre)
                       from sedes s where s.academia_id = ac.id and s.activo and s.deleted_at is null), '[]'::jsonb),
    'clases', coalesce((
      select jsonb_agg(jsonb_build_object('id', k.id, 'clase', trim(coalesce(d.nombre, 'Clase') || ' ' || k.nivel), 'color', d.color, 'dias', k.dias,
                                          'hora', k.hora_inicio, 'duracion', k.duracion_min, 'sede_id', k.sede_id, 'precio', k.precio_suelta) order by k.hora_inicio)
      from clases k left join disciplinas d on d.id = k.disciplina_id
      where k.academia_id = ac.id and k.activo and k.deleted_at is null
    ), '[]'::jsonb),
    'planes', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', p.nombre, 'tipo', p.tipo, 'precio', p.precio, 'clases', p.clases, 'vigencia', p.vigencia_dias,
                                          'grupos', p.grupos, 'sede_id', p.sede_id) order by p.tipo, p.precio)
      from planes p where p.academia_id = ac.id and p.activo and p.deleted_at is null and p.precio > 0
    ), '[]'::jsonb),
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', e.nombre, 'fecha', e.fecha, 'hora', e.hora_inicio, 'precio', e.precio, 'descripcion', e.descripcion,
                                          'quedan', case when e.cupo is null then null else greatest(0, e.cupo - (select count(*) from boletos b where b.evento_id = e.id and b.anulado_at is null and b.deleted_at is null)) end) order by e.fecha)
      from eventos e where e.academia_id = ac.id and e.activo and e.deleted_at is null and e.fecha >= hoy
    ), '[]'::jsonb),
    'tienda', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', p.nombre, 'precio', p.precio, 'emoji', p.emoji, 'foto', p.foto, 'descripcion', p.descripcion,
                                          'opciones', coalesce(to_jsonb(p.opciones), '[]'::jsonb), 'sobre_pedido', coalesce(p.sobre_pedido, false)) order by p.nombre)
      from productos p where p.academia_id = ac.id and p.en_linea and p.activo and p.deleted_at is null
    ), '[]'::jsonb)
  );
end $$;

revoke execute on function pagina_publica(text) from public;
grant execute on function pagina_publica(text) to anon, authenticated;

-- Inscripción desde la página pública: queda en "interesados" para que la academia le escriba.
-- Límites para que nadie la llene: teléfono de 10 dígitos, 3 por teléfono al día, 200 por academia al día.
create or replace function inscribir_interesado(p_slug text, p_nombre text, p_telefono text, p_clase uuid, p_mensaje text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  ac academias;
  tel text := right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 10);
  nom text := left(trim(coalesce(p_nombre, '')), 80);
  ahora bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  hace_un_dia bigint := ahora - 86400000;
begin
  select * into ac from academias where lower(slug) = lower(p_slug) and deleted_at is null;
  if not found then return jsonb_build_object('error', 'academia'); end if;
  if length(nom) < 2 then return jsonb_build_object('error', 'nombre'); end if;
  if length(tel) <> 10 then return jsonb_build_object('error', 'telefono'); end if;
  if p_clase is not null and not exists (select 1 from clases where id = p_clase and academia_id = ac.id and activo and deleted_at is null) then
    return jsonb_build_object('error', 'clase');
  end if;
  if (select count(*) from interesados where academia_id = ac.id and telefono = tel and created_at > hace_un_dia) >= 3 then
    return jsonb_build_object('error', 'muchos');
  end if;
  if (select count(*) from interesados where academia_id = ac.id and created_at > hace_un_dia) >= 200 then
    return jsonb_build_object('error', 'cupo');
  end if;
  insert into interesados (id, academia_id, nombre, telefono, clase_id, mensaje, estado, created_at, updated_at)
  values (gen_random_uuid(), ac.id, nom, tel, p_clase, left(trim(coalesce(p_mensaje, '')), 300), 'nuevo', ahora, ahora);
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function inscribir_interesado(text, text, text, uuid, text) from public;
grant execute on function inscribir_interesado(text, text, text, uuid, text) to anon, authenticated;

-- El alumno pone (o quita) su foto desde su portal, para que en recepción lo reconozcan.
-- Solo una imagen JPEG pequeña (la app la reduce a ~200 px); nada más se puede cambiar por aquí.
create or replace function portal_foto(p_token text, p_foto text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a alumnos;
  ahora bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if p_token is null or length(p_token) < 20 then return jsonb_build_object('error', 'enlace'); end if;
  select * into a from alumnos where portal = p_token and deleted_at is null and activo;
  if not found then return jsonb_build_object('error', 'enlace'); end if;
  if p_foto is not null and (p_foto not like 'data:image/jpeg;base64,%' or length(p_foto) > 80000) then
    return jsonb_build_object('error', 'foto');
  end if;
  update alumnos set foto = p_foto, updated_at = ahora where id = a.id;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function portal_foto(text, text) from public;
grant execute on function portal_foto(text, text) to anon, authenticated;
