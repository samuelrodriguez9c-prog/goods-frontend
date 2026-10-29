export type EntidadCampo = 'producto' | 'cliente' | 'pedido' | 'proveedor';
export type TipoCampo = 'texto' | 'numero' | 'fecha' | 'lista' | 'si_no';

/** Valor de un campo propio; una lista con `reglas.multiple` guarda varias opciones. */
export type ValorCampo = string | number | boolean | string[];

/** Valores de los campos propios de un registro, por clave (columna `atributos`). */
export type Atributos = Record<string, ValorCampo>;

export type FormatoTexto = 'libre' | 'numeros' | 'correo' | 'mayusculas';

/** Reglas según el tipo; el backend rechaza (400) la que no aplica. */
export interface ReglasCampo {
  /** Texto: largo mínimo. Número: valor mínimo. */
  min?: number;
  /** Texto: largo máximo. Número: valor máximo. */
  max?: number;
  formato?: FormatoTexto;
  /** Texto o número: «No repetir» entre registros. */
  unico?: boolean;
  decimales?: number;
  /** «kg», «$», «días»: solo para mostrar. */
  unidad?: string;
  unidadPos?: 'antes' | 'despues';
  /** Fecha: no se aceptan fechas anteriores a hoy. */
  noPasadas?: boolean;
  /** Fecha: aviso en el panel N días antes (1 a 365). */
  avisoDias?: number;
  /** Lista: varias opciones; el valor se guarda como arreglo. */
  multiple?: boolean;
}

export type LugarVisible = 'listado' | 'filtros' | 'exportacion' | 'importacion' | 'tienda';
/** Dónde aparece además del formulario (que es siempre, si está activo). */
export type Visibilidad = Record<LugarVisible, boolean>;
/** `admin`: solo quien tiene `campos.gestionar` cambia el valor en un registro. */
export type EditanCampo = 'todos' | 'admin';

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
  /** Una línea bajo el campo en el formulario. */
  ayuda?: string | null;
  /** Texto de ejemplo dentro del campo vacío. */
  placeholder?: string | null;
  /** Se pone solo al crear un registro sin este dato. */
  defecto?: ValorCampo | null;
  reglas?: ReglasCampo;
  /** `{ opción: '#rrggbb' }`, solo listas. */
  colores?: Record<string, string> | null;
  visibilidad?: Visibilidad;
  editan?: EditanCampo;
}

/** Lo que se define al crear y se cambia después (todo opcional; lo que no va queda igual). */
export interface DetalleCampoPayload {
  ayuda?: string | null;
  placeholder?: string | null;
  /** `null` lo quita. Las fechas y los campos «No repetir» no llevan. */
  defecto?: ValorCampo | null;
  /** Reemplaza todas las reglas. */
  reglas?: ReglasCampo;
  /** Parcial: lo que no viene queda como estaba. */
  visibilidad?: Partial<Visibilidad>;
  colores?: Record<string, string> | null;
  editan?: EditanCampo;
}

export interface CrearCampoPayload extends DetalleCampoPayload {
  entidad: EntidadCampo;
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: string[];
  obligatorio?: boolean;
}

export interface ActualizarCampoPayload extends DetalleCampoPayload {
  etiqueta?: string;
  opciones?: string[];
  obligatorio?: boolean;
  activo?: boolean;
}

/** `GET /campos-personalizados/:id/uso`. `porOpcion` solo en listas (por opción) y sí/no (`true`, `false`). */
export interface UsoCampo {
  conDato: number;
  total: number;
  porOpcion: { valor: string | boolean; n: number }[] | null;
}

/** `GET /campos-personalizados/:id/historial`, del más reciente al más viejo. */
export interface CambioHistorialCampo {
  /** «Agregó la opción «XXL»», «Lo marcó obligatorio». */
  texto: string;
  usuario: { id: number; nombre: string } | null;
  creadoEn: string;
}

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
  { k: 'lista', t: 'Lista', d: 'Una o varias opciones: talla, color' },
  { k: 'si_no', t: 'Sí / no', d: 'Importado, requiere factura' },
];

/**
 * En los formularios cada campo se edita como texto (para comparar con lo
 * guardado): `si_no` es `'true'`, `'false'` o `''`, y una lista de varias
 * opciones va separada por comas (las opciones no llevan comas).
 */
export type ValoresCampos = Record<string, string>;

/**
 * De `atributos` a los valores del formulario: todo lo guardado (aunque los
 * campos todavía no hayan cargado, para no perderlo al guardar) más una
 * entrada vacía por cada campo activo.
 */
export function valoresDe(atributos: Atributos | null | undefined, campos: CampoPersonalizado[]): ValoresCampos {
  const v: ValoresCampos = Object.fromEntries(
    Object.entries(atributos ?? {}).map(([k, x]) => [k, Array.isArray(x) ? x.join(', ') : String(x)]),
  );
  for (const c of campos) v[c.clave] ??= '';
  return v;
}

/** Para comparar dos formularios: sin vacíos y con las claves ordenadas. */
export function firmaValores(v: ValoresCampos): string {
  return JSON.stringify(Object.entries(v).filter(([, x]) => x.trim() !== '').sort(([a], [b]) => a.localeCompare(b)));
}

/** Del formulario al payload: vacío = `null` (el backend lo quita). */
export function atributosDe(valores: ValoresCampos, campos: CampoPersonalizado[]): Record<string, ValorCampo | null> {
  return Object.fromEntries(
    campos.map((c) => {
      const v = (valores[c.clave] ?? '').trim();
      if (!v) return [c.clave, null];
      if (c.tipo === 'numero') return [c.clave, Number(v.replace(',', '.'))];
      if (c.tipo === 'si_no') return [c.clave, v === 'true'];
      if (c.tipo === 'lista' && c.reglas?.multiple) return [c.clave, partirOpciones(v)];
      // `mayusculas` lo convierte el backend; se manda ya convertido para que el formulario no quede «sucio».
      if (c.tipo === 'texto' && c.reglas?.formato === 'mayusculas') return [c.clave, v.toUpperCase()];
      return [c.clave, v];
    }),
  );
}

/** «Negro, Azul» → `['Negro', 'Azul']`. */
export function partirOpciones(v: string): string[] {
  return v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Hoy en AAAA-MM-DD, en la hora local (para «No permitir fechas pasadas»). */
function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * El error de un valor según las reglas del campo, o `''`. Los textos son los
 * del diseño; el backend valida lo mismo al guardar (salvo «No repetir», que
 * necesita los demás registros).
 */
export function errorValor(c: CampoPersonalizado, valor: string): string {
  const v = valor.trim();
  if (!v) return c.obligatorio ? 'Este dato es obligatorio.' : '';
  const r = c.reglas ?? {};
  if (c.tipo === 'texto') {
    if (r.min != null && v.length < r.min) return `Mínimo ${r.min} caracteres.`;
    if (r.max != null && v.length > r.max) return `Máximo ${r.max} caracteres.`;
    if (v.length > 500) return 'Hasta 500 caracteres.';
    if (r.formato === 'numeros' && !/^\d+$/.test(v)) return 'Solo números, sin puntos ni guiones.';
    if (r.formato === 'correo' && !/^\S+@\S+\.\S+$/.test(v)) return 'Escribe un correo válido.';
  }
  if (c.tipo === 'numero') {
    const n = Number(v.replace(',', '.'));
    if (!Number.isFinite(n)) return 'Escribe un número.';
    if (r.min != null && n < r.min) return `Debe ser ${r.min} o más.`;
    if (r.max != null && n > r.max) return `Debe ser ${r.max} o menos.`;
    const dec = (v.replace(',', '.').split('.')[1] ?? '').length;
    const max = r.decimales ?? 0;
    if (dec > max) return max ? `Máximo ${max} decimales.` : 'Sin decimales.';
  }
  if (c.tipo === 'fecha' && r.noPasadas && v < hoyIso()) return 'No puede ser una fecha pasada.';
  return '';
}

/** Los mismos errores que daría el backend, para marcarlos antes de guardar. */
export function erroresCampos(valores: ValoresCampos, campos: CampoPersonalizado[]): Record<string, string> {
  const e: Record<string, string> = {};
  for (const c of campos) {
    const m = errorValor(c, valores[c.clave] ?? '');
    if (m) e[c.clave] = m;
  }
  return e;
}

/** Cómo se muestra un valor guardado (lista, exportación). */
export function textoValor(c: CampoPersonalizado, v: unknown): string {
  if (v == null || v === '') return '';
  if (Array.isArray(v)) return v.join(', ');
  if (c.tipo === 'si_no') return v === true || v === 'true' ? 'Sí' : 'No';
  if (c.tipo === 'fecha') {
    const [a, m, d] = String(v).split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (c.tipo === 'numero') {
    const r = c.reglas ?? {};
    const n = Number(v).toLocaleString('es-CO', { maximumFractionDigits: r.decimales ?? 2 });
    if (!r.unidad) return n;
    return r.unidadPos === 'antes' ? `${r.unidad} ${n}` : `${n} ${r.unidad}`;
  }
  return String(v);
}
