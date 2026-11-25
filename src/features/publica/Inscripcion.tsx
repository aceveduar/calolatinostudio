import { useState } from 'react';
import { Check, Sparkle } from 'lucide-react';
import { nubePublica as supabase } from '../../app/rpcPublica';
import { cx } from '../../components/ui';
import { AvisoPrivacidad } from './AvisoPrivacidad';
import { DIAS_CORTOS } from '../../domain/fechas';
import { consultaTelefono } from '../../domain/telefono';
import { ERRORES_INSCRIPCION, type DatosPublica } from '../../domain/publica';
import { type Estados } from './comun';

/** `de`: huella de quien lo invitó (enlace de invitación de un alumno); se manda solo si existe. */
export function Inscripcion({ academia, slug, clases, primera, estados, claseId, onClase, de = null, origen = null, privacidad }: { academia: string; slug: string; clases: DatosPublica['clases']; primera: string | null; estados: Estados; claseId: string; onClase: (id: string) => void; de?: string | null; origen?: string | null; privacidad: string }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'enviado'>('listo');
  const [error, setError] = useState<string | null>(null);
  const tel = consultaTelefono(telefono.trim());
  // errores junto a cada campo (no un botón apagado sin explicación)
  const errNombre = nombre.trim().length < 2 ? 'Escribe tu nombre' : null;
  const errTel = tel.length === 10 ? null : telefono.trim() ? 'Escribe un número mexicano de 10 dígitos' : 'Escribe tu WhatsApp';
  const valido = !errNombre && !errTel;
  const [intento, setIntento] = useState(false);
  const [tocado, setTocado] = useState({ nombre: false, tel: false });
  const verNombre = (intento || tocado.nombre) && errNombre;
  const verTel = (intento || tocado.tel) && errTel;
  // clase a medio curso: se anota igual, como lista de espera para el siguiente grupo
  const espera = claseId && estados.get(claseId)?.aceptaNuevos === false ? clases.find((c) => c.id === claseId) : null;
  const [esperaEnviada, setEsperaEnviada] = useState<string | null>(null);
  const campo = 'h-12 w-full rounded-xl bg-ink-50 px-4 ring-1 ring-ink-100 outline-none placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500';

  if (estado === 'enviado')
    return (
      <section className="rounded-3xl bg-superficie p-8 text-center shadow-2xl" role="status">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-ok-600 text-white">
          <Check size={30} />
        </span>
        <h2 className="text-2xl font-extrabold">Solicitud recibida</h2>
        <p className="mt-1 text-ink-700">
          {esperaEnviada
            ? `Ese grupo ya va avanzado: te escribimos por WhatsApp en cuanto abra el siguiente grupo de ${esperaEnviada}. 💃🕺`
            : 'Te escribiremos por WhatsApp para confirmar la clase y tu lugar.'}
        </p>
      </section>
    );

  return (
    <section className="rounded-3xl bg-superficie p-6 shadow-2xl">
      <h2 className="text-2xl font-extrabold tracking-tight">Agenda tu primera clase</h2>
      {primera && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-600">
          <Sparkle size={14} /> {primera}
        </p>
      )}
      <p className="mt-2 text-sm text-ink-500">Te confirmaremos tu lugar por WhatsApp.</p>
      <form
        className="mt-5 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valido) {
            setIntento(true);
            document.getElementById(errNombre ? 'pp-nombre' : 'pp-tel')?.focus();
            return;
          }
          if (!supabase) return;
          setEstado('enviando');
          setError(null);
          const { data, error: err } = await supabase.rpc('inscribir_interesado', { p_slug: slug, p_nombre: nombre.trim(), p_telefono: tel, p_clase: claseId || null, p_mensaje: mensaje.trim(), ...(de ? { p_de: de } : {}), ...(origen ? { p_origen: origen } : {}) });
          if (err || data?.error) {
            setError(err ? 'Sin conexión. Inténtalo otra vez.' : (ERRORES_INSCRIPCION[data.error] ?? 'No se pudo enviar.'));
            setEstado('listo');
            return;
          }
          setEsperaEnviada(espera ? espera.clase : null);
          setEstado('enviado');
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-700">Nombre</span>
          <input
            id="pp-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => setTocado((t) => ({ ...t, nombre: true }))}
            autoComplete="name"
            aria-invalid={!!verNombre}
            aria-describedby={verNombre ? 'pp-nombre-error' : undefined}
            className={cx(campo, verNombre && 'ring-2 ring-bad-600')}
          />
          {verNombre && (
            <span id="pp-nombre-error" className="mt-1 block text-sm font-semibold text-bad-600">
              {errNombre}
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-700">WhatsApp (10 dígitos)</span>
          <input
            id="pp-tel"
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            onBlur={() => setTocado((t) => ({ ...t, tel: true }))}
            inputMode="numeric"
            autoComplete="tel"
            aria-invalid={!!verTel}
            aria-describedby={verTel ? 'pp-tel-error' : undefined}
            className={cx(campo, verTel && 'ring-2 ring-bad-600')}
          />
          {verTel && (
            <span id="pp-tel-error" className="mt-1 block text-sm font-semibold text-bad-600">
              {errTel}
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-700">¿Qué clase te interesa?</span>
          <select value={claseId} onChange={(e) => onClase(e.target.value)} className={cx(campo, 'px-3', claseId && 'ring-2 ring-brand-500')}>
            <option value="">Todavía no sé</option>
            {clases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.clase} · {c.dias.map((x) => DIAS_CORTOS[x]).join(' ')} {c.hora}
                {estados.get(c.id)?.aceptaNuevos === false ? ' · próximo grupo' : estados.get(c.id)?.tipo === 'pronto' ? ' · grupo nuevo' : ''}
              </option>
            ))}
          </select>
        </label>
        {espera && <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">{espera.clase} ya va a medio curso. Déjanos tus datos y te avisamos cuando abra el siguiente grupo.</p>}
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-700">Algo que quieras decirnos (opcional)</span>
          <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={300} placeholder="Ej. nunca he bailado, voy en pareja…" className={campo} />
        </label>
        {error && <p role="alert" className="rounded-xl bg-bad-50 px-3 py-2 text-sm font-medium text-bad-600">{error}</p>}
        <button type="submit" disabled={estado === 'enviando'} className="h-14 w-full rounded-2xl bg-brand-500 text-lg font-bold text-white shadow-lg shadow-brand-500/30 active:scale-[0.98] disabled:opacity-60">
          {estado === 'enviando' ? 'Enviando…' : espera ? 'Avísenme del siguiente grupo' : 'Solicitar lugar'}
        </button>
        <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-center text-xs text-ink-500">
          Solo usamos tu número para contactarte sobre las clases.{' '}
          <AvisoPrivacidad texto={privacidad} academia={academia} className="font-semibold text-ink-700 underline underline-offset-2" />
        </p>
      </form>
    </section>
  );
}
