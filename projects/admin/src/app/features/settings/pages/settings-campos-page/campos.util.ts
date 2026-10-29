import {
  CampoPersonalizado,
  CrearCampoPayload,
  DetalleCampoPayload,
  ENTIDADES,
  EditanCampo,
  EntidadCampo,
  FormatoTexto,
  LugarVisible,
  ReglasCampo,
  TIPOS,
  TipoCampo,
  ValorCampo,
  Visibilidad,
} from '../../../../core/campos/campo-personalizado.model';
import { normalizar } from '../../../../shared/ui/persona';

/** Presentación, borrador y plantillas de los campos propios. */

export const ICONO_TIPO: Record<TipoCampo, string> = {
  texto: 'letter-case',
  numero: '123',
  fecha: 'calendar',
  lista: 'list',
  si_no: 'toggle-left',
};
export const ICONO_ENTIDAD: Record<EntidadCampo, string> = {
  producto: 'tag',
  cliente: 'user',
  pedido: 'shopping-bag',
  proveedor: 'truck',
};
/** Singular, para «Ningún producto tiene este dato». */
export const SINGULAR_ENTIDAD: Record<EntidadCampo, string> = {
  producto: 'producto',
  cliente: 'cliente',
  pedido: 'pedido',
  proveedor: 'proveedor',
};

/** Colores de las opciones de una lista; el primero es el de por defecto (no se guarda). */
export const COLORES = [
  '#6b7280',
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#9333ea',
  '#0891b2',
  '#db2777',
];
const COLOR_DEFECTO = COLORES[0];

export const FORMATOS: { k: FormatoTexto; t: string; d: string }[] = [
  { k: 'libre', t: 'Libre', d: 'Acepta cualquier texto.' },
  { k: 'numeros', t: 'Solo números', d: 'Solo dígitos, sin puntos, guiones ni espacios.' },
  { k: 'correo', t: 'Correo', d: 'Debe tener forma de correo: nombre@dominio.com' },
  { k: 'mayusculas', t: 'Mayúsculas', d: 'Todo en mayúsculas, como un lote o una placa.' },
];

/** «Dónde aparece»: el formulario es fijo; la tienda solo aplica a productos y pedidos. */
export const LUGARES: { k: LugarVisible | 'formulario'; t: string; d: string; icono: string }[] = [
  {
    k: 'formulario',
    t: 'Formulario',
    d: 'Donde tu equipo llena el dato. Siempre, si el campo está activo.',
    icono: 'forms',
  },
  {
    k: 'listado',
    t: 'Columna en el listado',
    d: 'Se puede mostrar como columna en la tabla de {ent}.',
    icono: 'table',
  },
  { k: 'filtros', t: 'Filtros', d: 'Permite filtrar {ent} por este dato.', icono: 'filter' },
  {
    k: 'exportacion',
    t: 'Exportación',
    d: 'Sale como columna al exportar a Excel o CSV.',
    icono: 'file-export',
  },
  {
    k: 'importacion',
    t: 'Importación',
    d: 'Se puede cargar en la importación masiva.',
    icono: 'file-import',
  },
  {
    k: 'tienda',
    t: 'Tienda en línea',
    d: 'Lo ve el cliente en la tienda y en el resumen del pedido.',
    icono: 'building-store',
  },
];
/** La del backend para un campo nuevo. */
export const VISIBILIDAD_DEFECTO: Visibilidad = {
  listado: false,
  filtros: true,
  exportacion: true,
  importacion: true,
  tienda: false,
};

/** Reglas como se editan en la hoja: los números como texto («» = sin límite). */
export interface ReglasBorrador {
  min: string;
  max: string;
  formato: FormatoTexto;
  unico: boolean;
  decimales: number;
  unidad: string;
  unidadPos: 'antes' | 'despues';
  noPasadas: boolean;
  /** Días de aviso; 0 = sin aviso. */
  aviso: number;
  multiple: boolean;
}

/** Lo que se edita en la hoja. `id: null` es un campo que todavía no existe. */
export interface BorradorCampo {
  id: number | null;
  entidad: EntidadCampo;
  etiqueta: string;
  tipo: TipoCampo;
  opciones: string[];
  /** Color de cada opción (todas tienen uno en el borrador). */
  colores: Record<string, string>;
  obligatorio: boolean;
  activo: boolean;
  ayuda: string;
  placeholder: string;
  /** Texto, número o fecha tal cual; una opción de la lista; `si` / `no` en sí/no; `''` sin valor. */
  defecto: string;
  reglas: ReglasBorrador;
  visibilidad: Visibilidad;
  editan: EditanCampo;
}

const REGLAS_VACIAS: ReglasBorrador = {
  min: '',
  max: '',
  formato: 'libre',
  unico: false,
  decimales: 0,
  unidad: '',
  unidadPos: 'despues',
  noPasadas: false,
  aviso: 0,
  multiple: false,
};

export function borradorVacio(entidad: EntidadCampo, activo: boolean): BorradorCampo {
  return {
    id: null,
    entidad,
    etiqueta: '',
    tipo: 'texto',
    opciones: [],
    colores: {},
    obligatorio: false,
    activo,
    ayuda: '',
    placeholder: '',
    defecto: '',
    reglas: { ...REGLAS_VACIAS },
    visibilidad: { ...VISIBILIDAD_DEFECTO },
    editan: 'todos',
  };
}

export function borradorDe(c: CampoPersonalizado): BorradorCampo {
  const r: ReglasCampo = c.reglas ?? {};
  const opciones = [...(c.opciones ?? [])];
  return {
    id: c.id,
    entidad: c.entidad,
    etiqueta: c.etiqueta,
    tipo: c.tipo,
    opciones,
    colores: Object.fromEntries(opciones.map((o) => [o, c.colores?.[o] ?? COLOR_DEFECTO])),
    obligatorio: c.obligatorio,
    activo: c.activo,
    ayuda: c.ayuda ?? '',
    placeholder: c.placeholder ?? '',
    defecto: defectoTexto(c.defecto),
    reglas: {
      min: r.min != null ? String(r.min) : '',
      max: r.max != null ? String(r.max) : '',
      formato: r.formato ?? 'libre',
      unico: !!r.unico,
      decimales: r.decimales ?? 0,
      unidad: r.unidad ?? '',
      unidadPos: r.unidadPos ?? 'despues',
      noPasadas: !!r.noPasadas,
      aviso: r.avisoDias ?? 0,
      multiple: !!r.multiple,
    },
    visibilidad: { ...VISIBILIDAD_DEFECTO, ...(c.visibilidad ?? {}) },
    editan: c.editan ?? 'todos',
  };
}

function defectoTexto(v: ValorCampo | null | undefined): string {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'si' : 'no';
  if (Array.isArray(v)) return v[0] ?? '';
  return String(v);
}

/** Para saber si hay cambios: el borrador normalizado, sin espacios en los bordes. */
export function firmaBorrador(b: BorradorCampo): string {
  return JSON.stringify({
    ...b,
    etiqueta: b.etiqueta.trim(),
    ayuda: b.ayuda.trim(),
    placeholder: b.placeholder.trim(),
  });
}

/** El texto de ejemplo y el valor por defecto aplican a texto y número; fechas no llevan valor por defecto. */
export function llevaDefecto(b: Pick<BorradorCampo, 'tipo' | 'reglas'>): boolean {
  return b.tipo !== 'fecha' && !b.reglas.unico;
}

/** Solo las reglas que aplican al tipo (el backend rechaza las demás). */
export function reglasDe(b: BorradorCampo): ReglasCampo {
  const r = b.reglas;
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const limpio = (o: ReglasCampo) =>
    Object.fromEntries(
      Object.entries(o).filter(([, v]) => v !== undefined && v !== false && v !== ''),
    ) as ReglasCampo;
  switch (b.tipo) {
    case 'texto':
      return limpio({
        min: num(r.min),
        max: num(r.max),
        formato: r.formato === 'libre' ? undefined : r.formato,
        unico: r.unico,
      });
    case 'numero':
      return limpio({
        min: num(r.min),
        max: num(r.max),
        decimales: r.decimales || undefined,
        unidad: r.unidad.trim() || undefined,
        unidadPos: r.unidad.trim() ? r.unidadPos : undefined,
        unico: r.unico,
      });
    case 'fecha':
      return limpio({ noPasadas: r.noPasadas, avisoDias: r.aviso || undefined });
    case 'lista':
      return limpio({ multiple: r.multiple });
    default:
      return {};
  }
}

function defectoDe(b: BorradorCampo): ValorCampo | null {
  const v = b.defecto.trim();
  if (!v || !llevaDefecto(b)) return null;
  if (b.tipo === 'numero') return Number(v.replace(',', '.'));
  if (b.tipo === 'si_no') return v === 'si';
  if (b.tipo === 'lista') return b.reglas.multiple ? [v] : v;
  if (b.reglas.formato === 'mayusculas') return v.toUpperCase();
  return v;
}

/** Los colores que no son el de por defecto. */
function coloresDe(b: BorradorCampo): Record<string, string> | null {
  const xs = b.opciones.filter((o) => b.colores[o] && b.colores[o] !== COLOR_DEFECTO);
  return xs.length ? Object.fromEntries(xs.map((o) => [o, b.colores[o]])) : null;
}

/** Ayuda, ejemplo, valor por defecto, reglas, visibilidad, colores y quién edita, como los pide el backend. */
export function detalleDe(b: BorradorCampo): DetalleCampoPayload {
  const conEjemplo = b.tipo === 'texto' || b.tipo === 'numero';
  return {
    ayuda: b.ayuda.trim() || null,
    placeholder: conEjemplo ? b.placeholder.trim() || null : null,
    reglas: reglasDe(b),
    // Las reglas van antes en el backend: el valor por defecto se valida contra ellas.
    defecto: defectoDe(b),
    visibilidad: { ...b.visibilidad, tienda: aplicaTienda(b.entidad) && b.visibilidad.tienda },
    colores: b.tipo === 'lista' ? coloresDe(b) : null,
    editan: b.editan,
  };
}

export function crearDe(b: BorradorCampo): CrearCampoPayload {
  return {
    entidad: b.entidad,
    etiqueta: b.etiqueta.trim(),
    tipo: b.tipo,
    opciones: b.tipo === 'lista' ? b.opciones : undefined,
    obligatorio: b.obligatorio,
    ...detalleDe(b),
  };
}

/** «Tienda en línea» solo existe para productos y pedidos. */
export function aplicaTienda(e: EntidadCampo): boolean {
  return e === 'producto' || e === 'pedido';
}

/** El campo como se vería guardado, para la vista previa (con la clave y el orden reales si ya existe). */
export function campoDe(b: BorradorCampo, clave: string, orden: number): CampoPersonalizado {
  return {
    id: b.id ?? -1,
    entidad: b.entidad,
    clave,
    etiqueta: b.etiqueta.trim() || 'Sin nombre',
    tipo: b.tipo,
    opciones: b.opciones,
    obligatorio: b.obligatorio,
    orden,
    activo: b.activo,
    ayuda: b.ayuda.trim() || null,
    placeholder: b.placeholder.trim() || null,
    defecto: defectoDe(b),
    reglas: reglasDe(b),
    colores: b.colores,
    visibilidad: b.visibilidad,
    editan: b.editan,
  };
}

export function nombreTipo(k: TipoCampo): string {
  return TIPOS.find((t) => t.k === k)?.t ?? k;
}

export function nombreEntidad(k: EntidadCampo): string {
  return ENTIDADES.find((e) => e.k === k)?.t ?? k;
}

/** Clave que se muestra mientras el campo no existe («Días de crédito» → `dias_de_credito`); la definitiva la devuelve el backend. */
export function claveDe(etiqueta: string): string {
  return (
    normalizar(etiqueta)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'nuevo_campo'
  );
}

/** Lo principal de un campo para la fila: «XS · S · M · L +2 · varias», «mayúsculas · máx. 20». */
export function resumenCampo(c: CampoPersonalizado): string {
  const r = c.reglas ?? {};
  const p: string[] = [];
  if (c.tipo === 'lista') {
    const o = c.opciones ?? [];
    return (
      o.slice(0, 4).join(' · ') +
      (o.length > 4 ? ` +${o.length - 4}` : '') +
      (r.multiple ? ' · varias' : '')
    );
  }
  if (c.tipo === 'texto') {
    if (r.formato && r.formato !== 'libre')
      p.push(FORMATOS.find((f) => f.k === r.formato)!.t.toLowerCase());
    if (r.max != null) p.push(`máx. ${r.max}`);
    if (r.unico) p.push('sin repetir');
  }
  if (c.tipo === 'numero') {
    if (r.min != null || r.max != null) p.push(`${r.min ?? '…'} – ${r.max ?? '…'}`);
    if (r.unidad) p.push(r.unidad);
  }
  if (c.tipo === 'fecha') {
    if (r.noPasadas) p.push('sin fechas pasadas');
    if (r.avisoDias) p.push(`aviso ${r.avisoDias} días antes`);
  }
  if (c.tipo === 'si_no' && typeof c.defecto === 'boolean')
    p.push(`por defecto ${c.defecto ? 'sí' : 'no'}`);
  return p.join(' · ') || TIPOS.find((t) => t.k === c.tipo)!.d;
}

/** «Lista · XS · S · M» */
export function subCampo(c: CampoPersonalizado): string {
  return `${nombreTipo(c.tipo)} · ${resumenCampo(c)}`;
}

/** Cuántas reglas tiene el borrador (el número de la pestaña Validación). */
export function cuentaReglas(b: BorradorCampo): number {
  const r = b.reglas;
  return [
    b.obligatorio,
    r.min !== '' && (b.tipo === 'texto' || b.tipo === 'numero'),
    r.max !== '' && (b.tipo === 'texto' || b.tipo === 'numero'),
    r.formato !== 'libre' && b.tipo === 'texto',
    r.unico && (b.tipo === 'texto' || b.tipo === 'numero'),
    !!r.unidad && b.tipo === 'numero',
    r.noPasadas && b.tipo === 'fecha',
    r.aviso > 0 && b.tipo === 'fecha',
    r.multiple && b.tipo === 'lista',
  ].filter(Boolean).length;
}

/** Posición del campo en su sección (para «Orden en el formulario»). */
export interface LugarCampo {
  i: number;
  n: number;
  primero: boolean;
  ultimo: boolean;
}

/** Plantilla del modal «Nuevo campo»: lo que se precarga y una nota corta. */
export interface PlantillaCampo {
  etiqueta: string;
  tipo: TipoCampo;
  nota: string;
  opciones?: string[];
  reglas?: Partial<ReglasBorrador>;
  tienda?: boolean;
}

export const PLANTILLAS: Record<EntidadCampo, PlantillaCampo[]> = {
  producto: [
    {
      etiqueta: 'Talla',
      tipo: 'lista',
      opciones: ['XS', 'S', 'M', 'L', 'XL'],
      nota: 'XS · S · M · L · XL',
      tienda: true,
    },
    {
      etiqueta: 'Color',
      tipo: 'lista',
      opciones: ['Negro', 'Blanco', 'Azul'],
      reglas: { multiple: true },
      nota: 'Varias opciones',
      tienda: true,
    },
    { etiqueta: 'Material', tipo: 'texto', nota: 'Algodón, cuero, acero…' },
    {
      etiqueta: 'Lote',
      tipo: 'texto',
      reglas: { formato: 'mayusculas', max: '20' },
      nota: 'En mayúsculas, máx. 20',
    },
    {
      etiqueta: 'Fecha de vencimiento',
      tipo: 'fecha',
      reglas: { noPasadas: true, aviso: 30 },
      nota: 'Aviso 30 días antes',
    },
    {
      etiqueta: 'Peso',
      tipo: 'numero',
      reglas: { decimales: 2, unidad: 'kg', min: '0' },
      nota: 'En kg, 2 decimales',
    },
    {
      etiqueta: 'Garantía',
      tipo: 'numero',
      reglas: { unidad: 'meses', min: '0' },
      nota: 'En meses',
    },
    { etiqueta: 'Importado', tipo: 'si_no', nota: 'Sí / no' },
  ],
  cliente: [
    {
      etiqueta: 'NIT',
      tipo: 'texto',
      reglas: { formato: 'numeros', unico: true },
      nota: 'Solo números, sin repetir',
    },
    { etiqueta: 'Fecha de cumpleaños', tipo: 'fecha', nota: 'Para campañas de cumpleaños' },
    { etiqueta: 'Barrio', tipo: 'texto', nota: 'Texto libre' },
    {
      etiqueta: 'Cómo nos conoció',
      tipo: 'lista',
      opciones: ['Instagram', 'Recomendación', 'Pasaba por aquí', 'Google'],
      nota: 'Instagram · Recomendación…',
    },
    { etiqueta: 'Acepta publicidad', tipo: 'si_no', nota: 'Sí / no' },
  ],
  pedido: [
    { etiqueta: 'Número de mesa', tipo: 'numero', reglas: { min: '1' }, nota: 'Desde 1' },
    {
      etiqueta: 'Atendido por',
      tipo: 'lista',
      opciones: ['Caja', 'Mesero', 'Domicilio'],
      nota: 'Caja · Mesero · Domicilio',
    },
    {
      etiqueta: 'Dedicatoria',
      tipo: 'texto',
      reglas: { max: '140' },
      nota: 'Para regalos, máx. 140',
      tienda: true,
    },
    { etiqueta: 'Requiere factura', tipo: 'si_no', nota: 'Sí / no' },
  ],
  proveedor: [
    {
      etiqueta: 'Días de crédito',
      tipo: 'numero',
      reglas: { unidad: 'días', min: '0' },
      nota: 'En días',
    },
    {
      etiqueta: 'Cuenta bancaria',
      tipo: 'texto',
      reglas: { formato: 'numeros' },
      nota: 'Solo números',
    },
    {
      etiqueta: 'Tipo de proveedor',
      tipo: 'lista',
      opciones: ['Fabricante', 'Distribuidor', 'Servicios'],
      nota: 'Fabricante · Distribuidor…',
    },
  ],
};

/** El borrador de una plantilla: sus opciones con colores en orden y sus reglas. */
export function borradorDePlantilla(
  entidad: EntidadCampo,
  p: PlantillaCampo,
  activo: boolean,
): BorradorCampo {
  const b = borradorVacio(entidad, activo);
  const opciones = p.opciones ?? [];
  return {
    ...b,
    etiqueta: p.etiqueta,
    tipo: p.tipo,
    opciones,
    colores: Object.fromEntries(opciones.map((o, i) => [o, COLORES[i % COLORES.length]])),
    reglas: { ...b.reglas, ...p.reglas },
    visibilidad: { ...b.visibilidad, tienda: !!p.tienda },
  };
}
