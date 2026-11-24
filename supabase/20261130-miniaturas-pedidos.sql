-- Compás 20261130. Miniaturas en Tus apartados y encargos.
-- Copia el archivo completo en Supabase SQL Editor y ejecútalo.
-- Actualización incremental para el esquema 20261129. Se puede repetir en 20261130.

begin;

do $comprobar_version$
declare
  actual int := public.esquema_version();
begin
  if actual is distinct from 20261129 and actual is distinct from 20261130 then
    raise exception 'Versión del esquema %: esta actualización requiere 20261129 o 20261130.', actual;
  end if;
end;
$comprobar_version$;

set local search_path = public;

create or replace function portal_alumno(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a alumnos;
  hoy date := (now() at time zone 'America/Mexico_City')::date;
  base text;
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select * into a from alumnos where portal = p_token and deleted_at is null and activo;
  if not found then return null; end if;
  -- logo y fotos de la tienda como enlaces /img (ligeros y en caché) si la academia tiene página pública;
  -- si no, van incrustadas como antes. La foto del alumno siempre va incrustada: es pequeña y solo suya.
  select '/img/' || lower(x.slug) || '/' into base from academias x where x.id = a.academia_id and x.slug is not null;
  return jsonb_build_object(
    'hoy', hoy,
    'alumno', jsonb_build_object('nombre', a.nombre, 'codigo', a.codigo, 'foto', a.foto),
    'academia', (select jsonb_build_object('nombre', x.nombre, 'color', x.color, 'logo', case when base is null then x.logo else img_publica(base, 'logo', x.logo) end,
                                           'whatsapp', x.whatsapp, 'slug', x.slug) from academias x where x.id = a.academia_id),
    -- su horario: las clases a las que ha ido en las últimas semanas y las de su plan (para "tu próxima clase")
    'horario', coalesce((
      select jsonb_agg(jsonb_build_object('clase', trim(coalesce(d.nombre, 'Clase') || ' ' || k.nivel), 'color', d.color, 'dias', k.dias,
                                          'hora', k.hora_inicio, 'duracion', k.duracion_min) order by k.hora_inicio)
      from clases k left join disciplinas d on d.id = k.disciplina_id
      where k.academia_id = a.academia_id and k.activo and k.deleted_at is null and (
        k.id in (select s.clase_id from asistencias s where s.alumno_id = a.id and s.anulada_at is null and s.deleted_at is null and s.fecha >= hoy - 45)
        or k.id in (select unnest(m.clase_ids) from membresias m where m.alumno_id = a.id and m.anulada_at is null and m.deleted_at is null and m.fin >= hoy))
    ), '[]'::jsonb),
    -- sus logros: cuántas clases lleva y en qué semanas vino (para la racha)
    'logros', (
      select jsonb_build_object('total', count(*), 'desde', min(s.fecha),
        'semanas', coalesce((select jsonb_agg(w order by w desc) from (
          select distinct date_trunc('week', s2.fecha)::date w from asistencias s2
          where s2.alumno_id = a.id and s2.anulada_at is null and s2.deleted_at is null and s2.fecha >= hoy - 210) t), '[]'::jsonb))
      from asistencias s where s.alumno_id = a.id and s.anulada_at is null and s.deleted_at is null),
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
      select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'precio', p.precio, 'emoji', p.emoji,
                                          'foto', case when base is null then p.foto else img_publica(base, 'p_' || p.id, p.foto) end, 'descripcion', p.descripcion,
                                          'opciones', coalesce(to_jsonb(p.opciones), '[]'::jsonb), 'disponibles', disponibles_producto(p),
                                          'sobre_pedido', coalesce(p.sobre_pedido, false), 'dias_entrega', p.dias_entrega) order by p.categoria, p.nombre)
      from productos p where p.academia_id = a.academia_id and p.en_linea and p.activo and p.deleted_at is null
    ), '[]'::jsonb),
    -- próximos eventos de la academia (socials, talleres): los mismos que muestra la página pública
    'eventos', coalesce((
      select jsonb_agg(ev order by ev->>'fecha', ev->>'hora') from (
        select jsonb_build_object('nombre', e.nombre, 'fecha', e.fecha, 'hora', e.hora_inicio, 'precio', e.precio, 'descripcion', e.descripcion,
                                  'vestimenta', coalesce(e.vestimenta, ''), 'otro_lugar', coalesce(e.lugar, '') <> '',
                                  'lugar', coalesce(nullif(e.lugar, ''), (select s.nombre from sedes s where s.id = e.sede_id), (select coalesce(nullif(x.sede_principal, ''), x.nombre) from academias x where x.id = e.academia_id), ''),
                                  'direccion', coalesce(nullif(e.direccion, ''), (select x.pagina->'ubicaciones'->coalesce(e.sede_id::text, 'principal')->>'direccion' from academias x where x.id = e.academia_id), ''),
                                  'foto', case when base is null then e.foto else img_publica(base, 'e_' || e.id, e.foto) end,
                                  'quedan', case when e.cupo is null then null else greatest(0, e.cupo - (select count(*) from boletos b where b.evento_id = e.id and b.anulado_at is null and b.deleted_at is null)) end) ev
        from eventos e where e.academia_id = a.academia_id and e.activo and e.deleted_at is null and coalesce(e.en_portal, true) and e.fecha >= hoy and e.fecha <= hoy + 90
        order by e.fecha, e.hora_inicio limit 6
      ) t
    ), '[]'::jsonb),
    -- invitar a un amigo: su huella y cuántos ha invitado / ya se inscribieron
    'invita', jsonb_build_object('de', huella_invita(a.id),
      'invitados', (select count(*) from interesados i where i.invito_alumno_id = a.id and i.deleted_at is null),
      'inscritos', (select count(*) from interesados i where i.invito_alumno_id = a.id and i.deleted_at is null and i.estado = 'inscrito')),
    -- su último testimonio (para que vea si ya lo publicaron)
    'testimonio', (select jsonb_build_object('texto', t.texto, 'estado', t.estado) from testimonios t
                   where t.alumno_id = a.id and t.deleted_at is null order by t.created_at desc limit 1),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object('producto', p.nombre, 'emoji', p.emoji, 'opcion', d.opcion, 'nota', d.nota, 'cantidad', d.cantidad, 'precio', d.precio,
                                          'foto', case when p.en_linea and p.activo and p.deleted_at is null then
                                            case when base is null then p.foto else img_publica(base, 'p_' || p.id, p.foto) end
                                          end,
                                          'anticipo', coalesce(d.anticipo, 0), 'estado', d.estado, 'creado', d.created_at) order by d.created_at desc)
      from pedidos d join productos p on p.id = d.producto_id and p.academia_id = a.academia_id
      where d.alumno_id = a.id and d.deleted_at is null
        and (d.estado in ('pendiente', 'pedido', 'llego') or d.updated_at > (extract(epoch from now()) * 1000)::bigint - 30::bigint * 86400000)
    ), '[]'::jsonb)
  );
end $$;

revoke execute on function portal_alumno(text) from public;
grant execute on function portal_alumno(text) to anon, authenticated;

create or replace function esquema_version() returns int
language sql immutable as $$ select 20261130 $$;

revoke execute on function esquema_version() from public;
grant execute on function esquema_version() to anon, authenticated;


commit;

select public.esquema_version() as version_instalada;
