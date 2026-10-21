import { ProductoCatalogo } from '../../../core/producto/models/producto.model';
import { MonedaTienda } from '../../../core/tienda/tienda.service';

export type Pais = 'CO' | 'US' | 'otro';
/** `sin-verificar`: no se pudo preguntar al servidor; no se muestra como libre (el PATCH igual valida). */
export type SlugEstado = 'actual' | 'comprobando' | 'libre' | 'ocupado' | 'reservado' | 'invalido' | 'sin-verificar';
export type EstadoEnTienda = 'visible' | 'agotado' | 'oculto';
export type SecFiltro = 'estado' | 'categoria' | 'foto' | 'agrupar';
export type Foto = 'todas' | 'con' | 'sin';
export type Grupo = 'estado' | 'categoria' | 'ninguno';

export type Red = 'instagram' | 'facebook' | 'tiktok';
/** Fila del horario mientras se edita: `cerrado` deja las horas vacías. */
export interface FilaHorarioEdit { dias: string; horas: string; cerrado: boolean }

/** Lo que se edita en la página; se compara campo a campo con lo guardado. */
export interface Borrador {
  slug: string; pais: Pais; numero: string; frase: string;
  logoUrl: string | null; logoNombre: string; moneda: MonedaTienda; agotados: boolean;
  ciudad: string; direccionTienda: string;
  instagram: string; facebook: string; tiktok: string;
  horario: FilaHorarioEdit[];
}
export interface FilaProducto { p: ProductoCatalogo; estado: EstadoEnTienda; cat: string; stock: number | null; foto: string | null }

export const INDICATIVO: Record<Exclude<Pais, 'otro'>, string> = { CO: '57', US: '1' };
export const NOMBRES: Record<keyof Borrador, string> = {
  slug: 'la dirección', pais: 'el país', numero: 'el WhatsApp', frase: 'la frase', logoUrl: 'el logo', logoNombre: 'el logo', moneda: 'la moneda', agotados: 'los agotados',
  ciudad: 'la ciudad', direccionTienda: 'la dirección del local', instagram: 'las redes', facebook: 'las redes', tiktok: 'las redes', horario: 'el horario',
};
export const CAMPOS: (keyof Borrador)[] = ['slug', 'pais', 'numero', 'frase', 'logoUrl', 'moneda', 'agotados', 'ciudad', 'direccionTienda', 'instagram', 'facebook', 'tiktok', 'horario'];
export const BORRADOR_VACIO: Borrador = {
  slug: '', pais: 'CO', numero: '', frase: '', logoUrl: null, logoNombre: '', moneda: 'COP', agotados: true,
  ciudad: '', direccionTienda: '', instagram: '', facebook: '', tiktok: '', horario: [],
};
/** Igualdad para «Cambios sin guardar» (el horario es una lista). */
export function igual(a: unknown, b: unknown): boolean { return a === b || JSON.stringify(a) === JSON.stringify(b); }

export const REDES: { k: Red; nombre: string; prefijo: string; ejemplo: string }[] = [
  { k: 'instagram', nombre: 'Instagram', prefijo: 'instagram.com/', ejemplo: 'ferreteriaeltornillo' },
  { k: 'facebook', nombre: 'Facebook', prefijo: 'facebook.com/', ejemplo: 'ferreteriaeltornillo' },
  { k: 'tiktok', nombre: 'TikTok', prefijo: 'tiktok.com/@', ejemplo: 'eltornillo' },
];
/** Lo mismo que valida el backend (`redes.util.ts`). */
const USUARIO_RED: Record<Red, RegExp> = { instagram: /^[A-Za-z0-9._]{1,30}$/, facebook: /^[A-Za-z0-9.-]{1,80}$/, tiktok: /^[A-Za-z0-9._]{2,24}$/ };
const DOMINIO_RED: Record<Red, RegExp> = {
  instagram: /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#]+)/i,
  facebook: /^(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook|fb)\.com\/([^/?#]+)/i,
  tiktok: /^(?:https?:\/\/)?(?:www\.|m\.)?tiktok\.com\/@?([^/?#]+)/i,
};
/** «@ferre.tornillo» o el enlace del perfil → «ferre.tornillo». */
export function usuarioDeRed(red: Red, valor: string): string {
  const v = valor.trim();
  if (!v) return '';
  const m = v.match(DOMINIO_RED[red]);
  return (m ? m[1] : v).replace(/^@/, '').replace(/\/+$/, '');
}
export function redValida(red: Red, valor: string): boolean { const u = usuarioDeRed(red, valor); return !u || USUARIO_RED[red].test(u); }

export const MAX_HORARIO = 7;
export const SUGERENCIAS_HORARIO: FilaHorarioEdit[] = [
  { dias: 'Lunes a viernes', horas: '8:00 a. m. – 6:00 p. m.', cerrado: false },
  { dias: 'Sábados', horas: '8:00 a. m. – 1:00 p. m.', cerrado: false },
  { dias: 'Domingos y festivos', horas: '', cerrado: true },
];
/** Una fila sin días ni horas no cuenta (se descarta al guardar). */
export function filaVacia(h: FilaHorarioEdit): boolean { return !h.dias.trim() && !h.horas.trim() && !h.cerrado; }
export function filaValida(h: FilaHorarioEdit): boolean { return filaVacia(h) || (!!h.dias.trim() && (h.cerrado || !!h.horas.trim())); }
export const ESTADOS_TIENDA: Record<EstadoEnTienda, { t: string; d: string; dot: string }> = {
  visible: { t: 'Visible', d: 'Se ve y se puede pedir', dot: '#2fa65a' },
  agotado: { t: 'Agotado', d: 'Se ve con la etiqueta, no se puede pedir', dot: '#ffb904' },
  oculto: { t: 'Oculto', d: 'Agotado y escondido de la tienda', dot: '#a3a3a3' },
};
export const FOTOS: Record<Foto, [string, string]> = { todas: ['Todas', 'Con y sin foto'], con: ['Con foto', 'Se ven con su imagen'], sin: ['Sin foto', 'Se ven con la inicial'] };
export const GRUPOS: Record<Grupo, [string, string]> = { estado: ['Estado en la tienda', 'Visibles, agotados y ocultos'], categoria: ['Categoría', 'Las de Productos'], ninguno: ['Sin agrupar', 'Una sola lista'] };
export const SUGERENCIAS_FRASE = ['Entregas el mismo día', 'Pagos por Nequi', 'Lunes a sábado'];
export const MAX_LOGO = 4e6;
export const SIN_CATEGORIA = 'Sin categoría';

/** Sombras de los campos: reposo, error y «libre». */
export const SH_IN = '0 0 0 1px #e5e5e5';
export const SH_ERR = '0 0 0 1px #e0605a,0 0 0 4px rgba(224,96,90,.1)';
export const SH_OK = '0 0 0 1px #7cc49b,0 0 0 4px rgba(47,166,90,.08)';

export function normalizar(t: string): string { return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
export function alternar<T>(xs: T[], v: T): T[] { return xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]; }
/** El contenedor que scrollea en el Shell (o el documento). */
export function padreConScroll(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement as HTMLElement;
}
