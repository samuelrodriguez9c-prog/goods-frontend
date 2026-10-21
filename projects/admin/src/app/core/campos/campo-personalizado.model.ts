export type EntidadCampo = 'producto' | 'cliente' | 'pedido' | 'proveedor';
export type TipoCampo = 'texto' | 'numero' | 'fecha' | 'lista' | 'si_no';

/** Valores de los campos propios de un registro, por clave (columna `atributos`). */
export type Atributos = Record<string, string | number | boolean>;

/** Espejo de `CampoPersonalizado` del backend. */
export interface CampoPersonalizado {
  id: number;
  entidad: EntidadCampo;
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  opciones: string[] | null;
  obligatorio: boolean;
  orden: number;
  activo: boolean;
}

export interface CrearCampoPayload {
  entidad: EntidadCampo;
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: string[];
  obligatorio?: boolean;
}

export type ActualizarCampoPayload = Partial<Pick<CampoPersonalizado, 'etiqueta' | 'opciones' | 'obligatorio' | 'activo'>>;

export const TOPE_CAMPOS = 15;

export const ENTIDADES: { k: EntidadCampo; t: string; d: string }[] = [
  { k: 'producto', t: 'Productos', d: 'Talla, color, lote, código de barras…' },
  { k: 'cliente', t: 'Clientes', d: 'NIT, barrio, fecha de cumpleaños…' },
  { k: 'pedido', t: 'Pedidos', d: 'Número de mesa, quién lo atendió…' },
  { k: 'proveedor', t: 'Proveedores', d: 'Días de crédito, cuenta bancaria…' },
];

export const TIPOS: { k: TipoCampo; t: string; d: string }[] = [
  { k: 'texto', t: 'Texto', d: 'Lote, referencia, una nota corta' },
  { k: 'numero', t: 'Número', d: 'Peso, días de crédito, mesa' },
  { k: 'fecha', t: 'Fecha', d: 'Vencimiento, cumpleaños' },
  { k: 'lista', t: 'Lista', d: 'Una opción entre varias: talla, color' },
  { k: 'si_no', t: 'Sí / no', d: 'Importado, requiere factura' },
];

/**
 * En los formularios cada campo se edita como texto (para comparar con lo
 * guardado): `si_no` es `'true'`, `'false'` o `''`.
 */
export type ValoresCampos = Record<string, string>;

/**
 * De `atributos` a los valores del formulario: todo lo guardado (aunque los
 * campos todavía no hayan cargado, para no perderlo al guardar) más una
 * entrada vacía por cada campo activo.
 */
export function valoresDe(atributos: Atributos | null | undefined, campos: CampoPersonalizado[]): ValoresCampos {
  const v: ValoresCampos = Object.fromEntries(Object.entries(atributos ?? {}).map(([k, x]) => [k, String(x)]));
  for (const c of campos) v[c.clave] ??= '';
  return v;
}

/** Para comparar dos formularios: sin vacíos y con las claves ordenadas. */
export function firmaValores(v: ValoresCampos): string {
  return JSON.stringify(Object.entries(v).filter(([, x]) => x.trim() !== '').sort(([a], [b]) => a.localeCompare(b)));
}

/** Del formulario al payload: vacío = `null` (el backend lo quita). */
export function atributosDe(valores: ValoresCampos, campos: CampoPersonalizado[]): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    campos.map((c) => {
      const v = (valores[c.clave] ?? '').trim();
      if (!v) return [c.clave, null];
      if (c.tipo === 'numero') return [c.clave, Number(v.replace(',', '.'))];
      if (c.tipo === 'si_no') return [c.clave, v === 'true'];
      return [c.clave, v];
    }),
  );
}

/** Los mismos errores que daría el backend, para marcarlos antes de guardar. */
export function erroresCampos(valores: ValoresCampos, campos: CampoPersonalizado[]): Record<string, string> {
  const e: Record<string, string> = {};
  for (const c of campos) {
    const v = (valores[c.clave] ?? '').trim();
    if (!v) {
      if (c.obligatorio) e[c.clave] = 'Este campo es obligatorio.';
    } else if (c.tipo === 'numero' && !Number.isFinite(Number(v.replace(',', '.')))) {
      e[c.clave] = 'Escribe solo el número.';
    } else if (c.tipo === 'texto' && v.length > 500) {
      e[c.clave] = 'Hasta 500 caracteres.';
    }
  }
  return e;
}

/** Cómo se muestra un valor guardado (lista, exportación). */
export function textoValor(c: CampoPersonalizado, v: unknown): string {
  if (v == null || v === '') return '';
  if (c.tipo === 'si_no') return v === true || v === 'true' ? 'Sí' : 'No';
  if (c.tipo === 'fecha') {
    const [a, m, d] = String(v).split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (c.tipo === 'numero') return Number(v).toLocaleString('es-CO');
  return String(v);
}
