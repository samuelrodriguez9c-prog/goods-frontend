/** Utilidades de personas y listas: Settings (Roles, Usuarios, Actividad) y el SoporteDock. */

const TONOS_PERSONA: [string, string][] = [
  ['#fde2e4', '#9f1239'],
  ['#fff1d6', '#8a5a00'],
  ['#e7f6ec', '#1f6b43'],
  ['#eef2ff', '#3730a3'],
  ['#f3e8ff', '#6b21a8'],
  ['#e0f2fe', '#075985'],
  ['#fce7f3', '#9d174d'],
];

/** Tono estable por nombre (hash): `[fondo, texto]`. */
export function tonoPersona(clave: string | number): [string, string] {
  let h = 0;
  for (const ch of String(clave)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONOS_PERSONA[h % TONOS_PERSONA.length];
}

export function iniciales(nombre: string): string {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || '·'
  );
}

const DIA_MIN = 1440;

/** «Ahora», «Hace 5 min», «Hace 3 h», «Ayer», «Hace 4 días», «Hace 2 meses». */
export function haceCuanto(fecha: string | Date | null | undefined): string {
  if (!fecha) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 60000));
  if (m < 1) return 'Ahora';
  if (m < 60) return `Hace ${m} min`;
  if (m < DIA_MIN) return `Hace ${Math.round(m / 60)} h`;
  if (m < 2 * DIA_MIN) return 'Ayer';
  if (m < 30 * DIA_MIN) return `Hace ${Math.round(m / DIA_MIN)} días`;
  if (m < 365 * DIA_MIN) {
    const n = Math.round(m / (30 * DIA_MIN));
    return n === 1 ? 'Hace 1 mes' : `Hace ${n} meses`;
  }
  return 'Hace más de un año';
}

/** «Hoy», «Ayer» o «Martes 14 oct». */
export function diaTexto(fecha: string): string {
  const d = new Date(fecha);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dif = Math.round(
    (hoy.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5,
  );
  if (dif === 0) return 'Hoy';
  if (dif === 1) return 'Ayer';
  const t = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Sin tildes y en minúsculas, para buscar. */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Atajo de las listas: ignora lo que se escribe en un campo y las teclas con modificadores. */
export function esTeclaDeLista(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !(t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) && !e.metaKey && !e.ctrlKey && !e.altKey;
}
