import { HorarioSemanal } from '../../../../core/whatsapp/whatsapp.model';

/** Los cuatro pasos, en el orden en que Goods los revisa (igual que el backend). */
export type ClavePaso = 'palabras' | 'ia' | 'fuera' | 'bienvenida';

export interface PasoInfo {
  k: ClavePaso;
  titulo: string;
  desc: string;
}

export const PASOS: PasoInfo[] = [
  { k: 'palabras', titulo: 'Palabras clave', desc: 'Si el mensaje trae una palabra, responde con tu texto.' },
  { k: 'ia', titulo: 'Asistente de IA', desc: 'Responde con tu catálogo, precios y stock reales.' },
  { k: 'fuera', titulo: 'Fuera de horario', desc: 'Avisa cuando está cerrado. Máximo una vez cada 12 h por cliente.' },
  { k: 'bienvenida', titulo: 'Bienvenida', desc: 'Al primer mensaje de un cliente nuevo.' },
];

/** Lunes → domingo, con la clave que usa `HorarioSemanal` (0 = domingo). */
export const DIAS = [
  { k: '1', corto: 'Lun', letra: 'L', nombre: 'Lunes' },
  { k: '2', corto: 'Mar', letra: 'M', nombre: 'Martes' },
  { k: '3', corto: 'Mié', letra: 'X', nombre: 'Miércoles' },
  { k: '4', corto: 'Jue', letra: 'J', nombre: 'Jueves' },
  { k: '5', corto: 'Vie', letra: 'V', nombre: 'Viernes' },
  { k: '6', corto: 'Sáb', letra: 'S', nombre: 'Sábado' },
  { k: '0', corto: 'Dom', letra: 'D', nombre: 'Domingo' },
];

export const ZONAS = [
  { v: 'America/Bogota', ciudad: 'Bogotá' },
  { v: 'America/New_York', ciudad: 'Nueva York' },
  { v: 'America/Chicago', ciudad: 'Chicago' },
  { v: 'America/Denver', ciudad: 'Denver' },
  { v: 'America/Los_Angeles', ciudad: 'Los Ángeles' },
];

export const HORARIO_INICIAL: HorarioSemanal = {
  '1': { desde: '08:00', hasta: '18:00' },
  '2': { desde: '08:00', hasta: '18:00' },
  '3': { desde: '08:00', hasta: '18:00' },
  '4': { desde: '08:00', hasta: '18:00' },
  '5': { desde: '08:00', hasta: '18:00' },
  '6': { desde: '09:00', hasta: '13:00' },
  '0': null,
};

export const BIENVENIDA_INICIAL = 'Hola {nombre}, gracias por escribirnos. ¿En qué te podemos ayudar?';
export const FUERA_INICIAL =
  'Hola {nombre}, en este momento estamos cerrados. Te respondemos apenas abramos. Mientras tanto puedes ver nuestro catálogo: {tienda}';

/** "Bogotá (GMT−5)": la ciudad y el desfase de hoy (cambia con el horario de verano). */
export function etiquetaZona(zona: string): string {
  const ciudad = ZONAS.find((z) => z.v === zona)?.ciudad ?? zona;
  try {
    const gmt = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value;
    return gmt ? `${ciudad} (${gmt.replace('-', '−')})` : ciudad;
  } catch {
    return ciudad;
  }
}

/** "07:30" → 7.5 */
export function aHoras(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

/** "07:30" → "7:30" */
export function hora(hhmm: string): string {
  return hhmm.replace(/^0(\d)/, '$1');
}

/** "L–V 7:30–18:00 · Sáb 8:00–14:00": días seguidos con el mismo horario van juntos. */
export function resumenHorario(h: HorarioSemanal): string {
  const grupos: { dias: (typeof DIAS)[number][]; rango: string }[] = [];
  for (const d of DIAS) {
    const r = h[d.k];
    if (!r) continue;
    const rango = `${hora(r.desde)}–${hora(r.hasta)}`;
    const ultimo = grupos.at(-1);
    const anterior = DIAS[DIAS.indexOf(d) - 1];
    if (ultimo && ultimo.rango === rango && ultimo.dias.at(-1) === anterior) ultimo.dias.push(d);
    else grupos.push({ dias: [d], rango });
  }
  if (!grupos.length) return 'Cerrado toda la semana';
  return grupos
    .map((g) => `${g.dias.length > 1 ? `${g.dias[0].letra}–${g.dias.at(-1)!.letra}` : g.dias[0].corto} ${g.rango}`)
    .join(' · ');
}

/** Día (clave de `HorarioSemanal`) y hora decimal de este momento en la zona del negocio. */
export function ahoraEn(zona: string, cuando = new Date()): { dia: string; horas: number; hhmm: string } {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: zona, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(
    cuando,
  );
  const dia = String(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.find((x) => x.type === 'weekday')?.value ?? ''));
  const hhmm = `${p.find((x) => x.type === 'hour')?.value}:${p.find((x) => x.type === 'minute')?.value}`;
  return { dia, horas: aHoras(hhmm), hhmm };
}

/** Igual que `estaAbierto` del backend (whatsapp-automatizaciones.service.ts). */
export function estaAbierto(h: HorarioSemanal, zona: string, cuando = new Date()): boolean {
  const a = ahoraEn(zona, cuando);
  const r = h[a.dia];
  return !!r && a.hhmm >= r.desde && a.hhmm < r.hasta;
}

/** Igual que `normalizar` del backend: sin tildes, minúsculas, solo letras y números. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Igual que `contienePalabra` del backend: palabra completa, acepta plural. */
export function contienePalabra(texto: string, palabra: string): boolean {
  if (!palabra) return false;
  const escapada = palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^| )${escapada}(es|s)?( |$)`).test(texto);
}
