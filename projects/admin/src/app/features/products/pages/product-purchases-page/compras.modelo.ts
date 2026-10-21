import { CatalogoStore } from '../../shared/catalogo.store';
import { cop } from '../../shared/formato';
import { CompraV5, EstadoCompra, LineaCompra, ProductoV5, ProveedorV5 } from '../../shared/modelos';
import { variacion } from '../../shared/proveedores.util';

// Tipos de la pantalla
export type Periodo = 'hoy' | '7' | '30';
export type Agrupacion = 'estado' | 'proveedor' | 'mes';
export type Orden = 'fecha' | 'edad' | 'total' | 'proveedor';
export type Metrica = 'pendiente' | 'valor' | 'tarde' | 'recibida' | 'cancelada';
export type PestanaCompra = 'lineas' | 'datos' | 'actividad';
export type MenuCompras = 'orden' | 'filtros' | 'agrupar' | 'acciones' | null;
export type RangoFecha = 'todo' | '7' | '30' | '90';
export type FiltroDocumento = 'todos' | 'con' | 'sin';

/** Línea del formulario: los números como texto (lo que se escribe). */
export interface LineaBorrador {
  productoId: number | null;
  /** Texto del buscador de producto. */
  busqueda: string;
  cantidad: string;
  precioUnitario: string;
  /** La llenó el Asistente (lectura de factura). */
  ia: boolean;
  /** Texto de la factura cuando no se reconoció el producto. */
  textoFactura: string;
}
export interface Borrador {
  proveedorId: number | null;
  /** Texto del buscador de proveedor. */
  busquedaProveedor: string;
  fecha: string;
  numeroFactura: string;
  archivo: { name: string; url: string | null } | null;
  notas: string;
  items: LineaBorrador[];
  /** Campos que llenó el Asistente (editar un campo apaga su marca). */
  ia: Partial<Record<'proveedor' | 'fecha' | 'numeroFactura' | 'notas' | 'archivo', boolean>>;
}
export type ModalCompras =
  | { tipo: 'recibir'; id: number }
  | { tipo: 'cancelar'; id: number }
  | { tipo: 'ia' }
  | { tipo: 'factura'; id: number | null }
  | null;

/** Lo que muestra la hoja: del borrador (formulario) o de la compra guardada. */
export interface FichaCompra {
  esNueva: boolean;
  compra: CompraV5 | null;
  borrador: Borrador | null;
  /** Se edita (nueva o pendiente con permiso). */
  formulario: boolean;
  estado: EstadoCompra;
  /** Líneas con producto. */
  items: LineaCompra[];
  proveedor: ProveedorV5 | null;
  dias: number;
  atrasada: boolean;
  total: number;
  unidades: number;
  fecha: string;
  numero: string;
  notas: string;
}

export type Miniatura =
  | { tipo: 'imagen'; url: string }
  | { tipo: 'icono'; icono: string; fondo: string; tinta: string }
  | { tipo: 'inicial'; letra: string };

export interface VariacionPrecio {
  texto: string;
  /** Más caro que la compra anterior. */
  sube: boolean;
  detalle: string;
}

// Constantes
export const ORDENES: { k: Orden; titulo: string; icono: string }[] = [
  { k: 'fecha', titulo: 'Más recientes', icono: 'calendar-down' },
  { k: 'edad', titulo: 'Más antiguas', icono: 'calendar-up' },
  { k: 'total', titulo: 'Mayor total', icono: 'sort-descending-numbers' },
  { k: 'proveedor', titulo: 'Proveedor A→Z', icono: 'sort-ascending-letters' },
];
export const AGRUPACIONES: { k: Agrupacion; titulo: string; detalle: string; icono: string }[] = [
  { k: 'estado', titulo: 'Estado', detalle: 'Atrasadas, pendientes, recibidas y canceladas', icono: 'progress-check' },
  { k: 'proveedor', titulo: 'Proveedor', detalle: 'Todas las compras de cada proveedor', icono: 'truck' },
  { k: 'mes', titulo: 'Mes', detalle: 'Para cuadrar con la contabilidad', icono: 'calendar' },
];
export const RANGOS: { k: RangoFecha; label: string }[] = [
  { k: 'todo', label: 'Todo' },
  { k: '7', label: '7 d' },
  { k: '30', label: '30 d' },
  { k: '90', label: '90 d' },
];
export const DOCUMENTOS: { k: FiltroDocumento; label: string }[] = [
  { k: 'todos', label: 'Todas' },
  { k: 'con', label: 'Con factura' },
  { k: 'sin', label: 'Sin factura' },
];
/** Texto del chip de la métrica que filtra la lista. */
export const FILTRO_METRICA: Record<Metrica, string> = {
  pendiente: 'Pendientes', valor: 'Pendientes', tarde: 'Atrasadas', recibida: 'Recibidas en 30 días', cancelada: 'Canceladas',
};
/** Nombres de los campos para la alerta "Cambios sin guardar". */
export const ETIQUETAS: Partial<Record<keyof Borrador, string>> = {
  proveedorId: 'Proveedor', fecha: 'Fecha', numeroFactura: 'N° de factura', archivo: 'Factura', notas: 'Notas', items: 'Líneas',
};
/** Barra de color de la fila según el estado. */
export const BARRA_ESTADO: Record<EstadoCompra, string> = {
  pendiente: 'bg-[#ffb904]', recibida: 'bg-[#29845a]', cancelada: 'bg-[#c4c4c4]',
};
/** Pastilla de estado de la hoja. */
export const CHIP_ESTADO: Record<EstadoCompra, string> = {
  pendiente: 'bg-[#ffeb79] text-[#8a5a00]', recibida: 'bg-[#a4ffb6] text-[#0b5c3f]', cancelada: 'bg-[#e3e3e3] text-[#4b5563]',
};
/** Avatar del proveedor de una compra cancelada (gris en vez del tono del proveedor). */
export const AVATAR_CANCELADA = 'bg-[#f1f1f1] text-[#9ca3af]';

// Utilidades
export const soloDigitos = (v: unknown) => String(v ?? '').replace(/[^\d]/g, '');
export const clonar = <T>(o: T): T => JSON.parse(JSON.stringify(o));
export const iguales = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** AAAA-MM-DD en la hora local (toISOString da el día UTC). */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Momento en que se considera creada una compra del día `f` (9:00). */
export const inicioDia = (f: string) => new Date(f + 'T09:00:00').getTime();
export const lineaVacia = (): LineaBorrador => ({ productoId: null, busqueda: '', cantidad: '1', precioUnitario: '', ia: false, textoFactura: '' });
/** Costo unitario con separador de miles (como se muestra en el campo). */
export const conMiles = (raw: string) => (raw === '' ? '' : Number(soloDigitos(raw)).toLocaleString('es-CO'));

/** Miniatura del producto: foto, ícono de su categoría o la inicial (sin producto: «?»). */
export function miniaturaDe(p: ProductoV5 | undefined, catalogo: CatalogoStore): Miniatura {
  if (!p) return { tipo: 'inicial', letra: '?' };
  const imagen = [...p.imagenes].sort((a, b) => a.orden - b.orden)[0];
  if (imagen?.url) return { tipo: 'imagen', url: imagen.url };
  if (imagen) {
    const [fondo, tinta, icono] = catalogo.tono(catalogo.raiz(catalogo.categoria(p.categoriaId))?.id);
    return { tipo: 'icono', icono, fondo, tinta };
  }
  return { tipo: 'inicial', letra: ((p.nombre || '?').trim()[0] || '?').toUpperCase() };
}

/** Cambio de precio frente a la compra anterior del mismo producto. */
export function variacionPrecio(catalogo: CatalogoStore, productoId: number, precio: number, fecha: string, excluirId?: number): VariacionPrecio | null {
  const x = variacion(catalogo, productoId, precio, fecha, excluirId);
  return x ? { texto: x.texto, sube: precio > x.anterior.precio, detalle: 'Frente a ' + cop(x.anterior.precio) + ' en ' + x.anterior.codigo } : null;
}
export const CHIP_VARIACION = { sube: 'bg-[#fff1f0] text-[#b42318]', baja: 'bg-[#e6f6ec] text-[#087b5d]' };
