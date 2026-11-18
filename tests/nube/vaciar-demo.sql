-- Vacía los datos de prueba de la academia DEMO (y solo de ella) para volver a llenarla.
-- Se corre en Supabase → SQL Editor. Conserva: la academia (nombre, logo, color, página pública),
-- la cuenta (miembros) y los usuarios de dirección y recepción (sus PIN).
-- La app nunca borra (solo marca); por eso el borrado real se hace aquí, a mano.
do $$
declare
  demo uuid := 'b3e980e0-34a7-49a1-968d-fcc962e8325a';
  t text;
begin
  if not exists (select 1 from academias where id = demo and nombre ilike '%calo%') then
    raise exception 'No encontré la academia demo; no se borró nada';
  end if;
  foreach t in array array['boletos','eventos','pedidos','interesados','asistencias','membresias','pagos','cortes','alumnos',
                           'gastos','gastos_fijos','rentas','productos','planes','clases','maestros','disciplinas','sedes'] loop
    execute format('delete from %I where academia_id = $1', t) using demo;
  end loop;
  delete from usuarios where academia_id = demo and rol not in ('dueno', 'recepcion');
  raise notice 'Demo vaciada';
end $$;

-- Para revisar que quedó vacía:
select 'alumnos' tabla, count(*) from alumnos where academia_id = 'b3e980e0-34a7-49a1-968d-fcc962e8325a'
union all select 'asistencias', count(*) from asistencias where academia_id = 'b3e980e0-34a7-49a1-968d-fcc962e8325a'
union all select 'pagos', count(*) from pagos where academia_id = 'b3e980e0-34a7-49a1-968d-fcc962e8325a'
union all select 'usuarios', count(*) from usuarios where academia_id = 'b3e980e0-34a7-49a1-968d-fcc962e8325a';
