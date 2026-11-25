-- Ejecutar sobre el esquema de Comp?s actual. Migraci?n repetible.

begin;

alter table public.clases add column if not exists excepciones jsonb;

create or replace function public.excepciones_horario(p_cambios jsonb, p_academia uuid)
returns jsonb language sql stable set search_path = ''
as $$
  select coalesce(jsonb_object_agg(e.key, case when e.value->'cancelada' = 'true'::jsonb
    then jsonb_build_object('cancelada', true)
    else jsonb_build_object('hora', e.value->>'hora', 'sede_id', s.id, 'nombre_sede', coalesce(
      s.nombre, nullif(a.sede_principal, ''), 'Sede principal')) end), '{}'::jsonb)
  from public.academias a
  cross join lateral jsonb_each(case when jsonb_typeof(p_cambios) = 'object' then p_cambios else '{}'::jsonb end) e
  left join public.sedes s on s.academia_id = a.id and s.id::text = e.value->>'sede' and s.deleted_at is null
  where a.id = p_academia
    and e.key between ((now() at time zone 'America/Mexico_City')::date - 1)::text
                  and ((now() at time zone 'America/Mexico_City')::date + 7)::text
    and (e.value->'cancelada' = 'true'::jsonb or e.value->>'hora' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
$$;
revoke all on function public.excepciones_horario(jsonb, uuid) from public, anon, authenticated;

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
                                          'hora', k.hora_inicio, 'duracion', k.duracion_min,
                                          'excepciones', public.excepciones_horario(k.excepciones, a.academia_id)) order by k.hora_inicio)
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

create or replace function pagina_publica(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  ac academias;
  hoy date := (now() at time zone 'America/Mexico_City')::date;
  base text := '/img/' || lower(p_slug) || '/';
  pag jsonb;
begin
  if p_slug is null or length(p_slug) < 3 then return null; end if;
  select * into ac from academias where lower(slug) = lower(p_slug) and deleted_at is null;
  if not found then return null; end if;
  pag := coalesce(ac.pagina, '{}'::jsonb);
  if jsonb_typeof(pag->'portada') = 'string' then
    pag := jsonb_set(pag, '{portada}', to_jsonb(img_publica(base, 'portada', pag->>'portada')));
  end if;
  if jsonb_typeof(pag->'galeria') = 'array' then
    pag := jsonb_set(pag, '{galeria}', coalesce((
      select jsonb_agg(to_jsonb(img_publica(base, 'g' || (n - 1), g)) order by n)
      from jsonb_array_elements_text(pag->'galeria') with ordinality t(g, n)), '[]'::jsonb));
  end if;
  return jsonb_build_object(
    'academia', jsonb_build_object('nombre', ac.nombre, 'color', ac.color, 'logo', img_publica(base, 'logo', ac.logo), 'whatsapp', ac.whatsapp, 'sede_principal', coalesce(ac.sede_principal, 'Sede principal')),
    -- portada, frase, ubicación, preguntas y redes que la academia escribió para su página
    'pagina', pag,
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre, 'color', s.color) order by s.nombre)
                       from sedes s where s.academia_id = ac.id and s.activo and s.deleted_at is null), '[]'::jsonb),
    'clases', coalesce((
      select jsonb_agg(jsonb_build_object('id', k.id, 'clase', trim(coalesce(d.nombre, 'Clase') || ' ' || k.nivel), 'color', d.color, 'dias', k.dias,
                                          'hora', k.hora_inicio, 'duracion', k.duracion_min, 'sede_id', k.sede_id, 'precio', k.precio_suelta, 'curso', k.curso, 'disciplina', d.nombre,
                                          'excepciones', public.excepciones_horario(k.excepciones, ac.id)) order by k.hora_inicio)
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
                                          'vestimenta', coalesce(e.vestimenta, ''), 'otro_lugar', coalesce(e.lugar, '') <> '',
                                  'lugar', coalesce(nullif(e.lugar, ''), (select s.nombre from sedes s where s.id = e.sede_id), (select coalesce(nullif(x.sede_principal, ''), x.nombre) from academias x where x.id = e.academia_id), ''),
                                  'direccion', coalesce(nullif(e.direccion, ''), (select x.pagina->'ubicaciones'->coalesce(e.sede_id::text, 'principal')->>'direccion' from academias x where x.id = e.academia_id), ''),
                                  'foto', img_publica(base, 'e_' || e.id, e.foto),
                                  'quedan', case when e.cupo is null then null else greatest(0, e.cupo - (select count(*) from boletos b where b.evento_id = e.id and b.anulado_at is null and b.deleted_at is null)) end) order by e.fecha)
      from eventos e where e.academia_id = ac.id and e.activo and e.deleted_at is null and coalesce(e.en_pagina, true) and e.fecha >= hoy
    ), '[]'::jsonb),
    'tienda', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', p.nombre, 'precio', p.precio, 'emoji', p.emoji, 'foto', img_publica(base, 'p_' || p.id, p.foto), 'descripcion', p.descripcion,
                                          'opciones', coalesce(to_jsonb(p.opciones), '[]'::jsonb), 'sobre_pedido', coalesce(p.sobre_pedido, false)) order by p.nombre)
      from productos p where p.academia_id = ac.id and p.en_linea and p.activo and p.deleted_at is null
    ), '[]'::jsonb)
  );
end $$;
revoke execute on function pagina_publica(text) from public;
grant execute on function pagina_publica(text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
