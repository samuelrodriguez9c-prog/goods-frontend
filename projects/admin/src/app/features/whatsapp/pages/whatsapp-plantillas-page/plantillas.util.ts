import { EstadoPlantilla, NuevaPlantilla, Plantilla } from '../../../../core/whatsapp/whatsapp.model';
import { COSTO_PLANTILLA } from '../../shared/secciones';

/** Estado de una plantilla: texto, punto, fondo y tinta de la pastilla. */
export const ESTADO_PLANTILLA: Record<EstadoPlantilla, { texto: string; punto: string; bg: string; fg: string }> = {
  aprobada: { texto: 'Aprobada', punto: '#1d8a4b', bg: '#e7f6ec', fg: '#166d3b' },
  pendiente: { texto: 'En revisión', punto: '#f59e0b', bg: '#fffbeb', fg: '#92400e' },
  rechazada: { texto: 'Rechazada', punto: '#ef4444', bg: '#fef3f2', fg: '#b42318' },
  pausada: { texto: 'Pausada', punto: '#9ca3af', bg: '#f3f3f3', fg: '#4b5563' },
  deshabilitada: { texto: 'Deshabilitada', punto: '#c4c4c4', bg: '#f3f3f3', fg: '#6b7280' },
};

/** Motivos de rechazo que manda Meta, en palabras del negocio. */
const MOTIVOS: Record<string, string> = {
  INVALID_FORMAT: 'Meta no la aprobó: el formato no es válido. Revisa las variables y los ejemplos.',
  PROMOTIONAL: 'Meta no la aprobó: el texto parece de promoción. Créala como tipo "Promoción".',
  INCORRECT_CATEGORY: 'Meta no la aprobó: el tipo elegido no corresponde al texto.',
  TAG_CONTENT_MISMATCH: 'Meta no la aprobó: el tipo elegido no corresponde al texto.',
  ABUSIVE_CONTENT: 'Meta no la aprobó: considera que el contenido no cumple sus políticas.',
  SCAM: 'Meta no la aprobó: el texto puede confundirse con un engaño. Bórrala y crea otra con un mensaje más concreto.',
};

/** Texto del recuadro de rechazo (el motivo de Meta traducido, o el código tal cual si no lo conocemos). */
export function motivoRechazo(m: string | null): string {
  if (!m || m.toUpperCase() === 'NONE') return 'Meta no la aprobó. Puedes corregirla y enviarla otra vez.';
  return MOTIVOS[m.toUpperCase()] ?? `Meta no la aprobó: ${m}.`;
}

export const PLANTILLA_VACIA: NuevaPlantilla = { nombre: '', categoria: 'UTILITY', idioma: 'es', cuerpo: '', ejemplos: [] };

/** Costo aproximado por envío de una categoría (COP). */
export const costoDe = (categoria: string) => COSTO_PLANTILLA[categoria] ?? COSTO_PLANTILLA['UTILITY'];

/** Promoción o servicio (Autenticación se cobra y se agrupa como servicio). */
export const esPromo = (p: Pick<Plantilla, 'categoria'>) => p.categoria === 'MARKETING';

const RANGO: Record<EstadoPlantilla, number> = { aprobada: 0, pendiente: 1, rechazada: 2, pausada: 3, deshabilitada: 4 };

/**
 * Orden de la lista: Servicio antes que Promoción; dentro de cada tipo, las
 * aprobadas primero, después las más enviadas y, a igual uso, la más antigua.
 */
export function ordenar(l: Plantilla[]): Plantilla[] {
  return [...l].sort(
    (a, b) =>
      Number(esPromo(a)) - Number(esPromo(b)) ||
      RANGO[a.estado] - RANGO[b.estado] ||
      (b.uso?.enviados ?? 0) - (a.uso?.enviados ?? 0) ||
      a.id - b.id,
  );
}

/** Porcentaje leído ("94%") o null si no se ha enviado. */
export function pctLeida(p: Plantilla): string | null {
  return p.uso?.enviados ? `${Math.round((p.uso.leidos / p.uso.enviados) * 100)}%` : null;
}

/** `{{n}}` para mostrar (las llaves dobles chocan con la interpolación de Angular). */
export const marcaVariable = (n: number) => `{{${n}}}`;

export interface Parte {
  t: string;
  variable: boolean;
}

/** Parte un cuerpo en texto y variables (las variables muestran su ejemplo). */
export function partes(cuerpo: string, ejemplos: string[]): Parte[] {
  return cuerpo
    .split(/(\{\{\d+\}\})/)
    .filter(Boolean)
    .map((t) => {
      const m = t.match(/^\{\{(\d+)\}\}$/);
      return m ? { t: ejemplos[+m[1] - 1]?.trim() || t, variable: true } : { t, variable: false };
    });
}

/** Minúsculas y sin tildes, para buscar y para el nombre interno. */
export function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
