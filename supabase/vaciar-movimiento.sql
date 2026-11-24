-- Quitar la DEMO de movimiento para empezar con datos reales.
-- Borra alumnos y todo lo que hicieron: planes vendidos, cobros, asistencias, cortes de caja, ventas y apartados
-- de la tienda, boletos, interesados y testimonios del portal.
-- También: productos, gastos fijos, eventos, el plan "Beca" de ejemplo y los maestros de prueba (nota PRUEBA,
-- con sus usuarios; sus clases vuelven con Alberto).
-- SE QUEDA la configuración real: Alberto y Monse, sedes, disciplinas, clases, planes y precios, y la página.
-- (La Mensualidad y el Paquete de ejemplo también se quedan: Alberto les pone su precio real o los borra.)
--
-- ORDEN: 1) en cada teléfono/PC: "¿Olvidaste tu PIN o es otra academia?" → "Es otra academia" → Quitar academia
--        2) correr esto en Supabase → SQL Editor
--        3) volver a conectar cada aparato con "Conectar a mi academia"

do $$
declare a uuid;
begin
  select id into a from academias where slug = 'calo-latino';
  if a is null then raise exception 'No encontré la academia calo-latino: no se borró nada'; end if;

  delete from asistencias where academia_id = a;
  delete from pagos       where academia_id = a;
  delete from membresias  where academia_id = a;
  delete from cortes      where academia_id = a;
  delete from gastos      where academia_id = a;
  delete from rentas      where academia_id = a;
  delete from pedidos     where academia_id = a;
  delete from boletos     where academia_id = a;
  delete from interesados where academia_id = a;
  delete from testimonios where academia_id = a;
  delete from alumnos     where academia_id = a;
  -- productos de ejemplo de la tienda demo (si para entonces ya hay productos reales, quitar esta línea)
  delete from productos   where academia_id = a;
  -- lo demás de la demo: gastos fijos, eventos, plan de beca de ejemplo y meta diaria
  delete from gastos_fijos where academia_id = a;
  delete from eventos      where academia_id = a;
  delete from planes       where academia_id = a and nombre = 'Beca' and precio = 0;
  update academias set meta_diaria = null where id = a;
  -- maestros de prueba (nota PRUEBA): sus clases vuelven con Alberto y se borran sus usuarios
  update clases set maestro_id = (select id from maestros where academia_id = a and nombre = 'Alberto' and deleted_at is null limit 1)
   where academia_id = a and maestro_id in (select id from maestros where academia_id = a and notas = 'PRUEBA');
  delete from usuarios where academia_id = a and rol = 'maestro'
   and maestro_id in (select id from maestros where academia_id = a and notas = 'PRUEBA');
  delete from maestros where academia_id = a and notas = 'PRUEBA';
end $$;

-- Para revisar: todo en 0
select 'alumnos' as tabla, count(*) from alumnos where academia_id = (select id from academias where slug = 'calo-latino')
union all select 'pagos',       count(*) from pagos       where academia_id = (select id from academias where slug = 'calo-latino')
union all select 'asistencias', count(*) from asistencias where academia_id = (select id from academias where slug = 'calo-latino')
union all select 'cortes',      count(*) from cortes      where academia_id = (select id from academias where slug = 'calo-latino');
