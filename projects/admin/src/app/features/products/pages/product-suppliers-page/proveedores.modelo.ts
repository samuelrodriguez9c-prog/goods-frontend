import { CampoPersonalizado, ValoresCampos, firmaValores, valoresDe } from '../../../../core/campos/campo-personalizado.model';
import { CatalogoStore } from '../../shared/catalogo.store';
import { EstadoCompra, NivelStock, ProductoV5, ProveedorV5 } from '../../shared/modelos';
import { AccionProveedor, ClaveAccion, tonoProveedor } from '../../shared/proveedores.util';

export type Agrupacion = 'estado' | 'accion' | 'dia';
/** Métrica de la franja que filtra la lista. */
export type Metrica = 'activos' | 'inactivos' | 'pend' | 'mes';
export type PestanaProveedor = 'general' | 'compras' | 'productos';
export type FiltroCompras = 'todas' | EstadoCompra;
export type Vista = 'lista' | 'tarjetas';
/** Menús flotantes de la página (uno abierto a la vez). */
export type Menu = 'agrupar' | 'acciones' | 'estado';
/** Modal abierto sobre la página. */
export type Modal = { tipo: 'compra' | 'baja'; proveedorId: number } | null;
/** Campos de texto de la ficha. */
export type CampoTexto = 'nombre' | 'nit' | 'correo' | 'telefono' | 'direccion' | 'contactoNombre';
export type Errores = Partial<Record<keyof ProveedorV5, string>>;
/** La ficha en edición: los campos propios van como texto (ver `ValoresCampos`). */
export type BorradorProveedor = Omit<ProveedorV5, 'atributos'> & { atributos: ValoresCampos };

/** Fila de la lista (vista Lista y Tarjetas). */
export interface FilaProveedor {
  proveedor: ProveedorV5;
  /** Contacto · última compra. */
  detalle: string;
  /** «hace 3 d» / «sin compras» (derecha de la fila). */
  ultima: string;
  /** Total recibido (0 = sin compras recibidas). */
  total: number;
  /** Total frente al proveedor que más se le ha comprado, en %. */
  proporcion: number;
  accion: AccionProveedor;
  /** Próxima entrega (o por qué no hay). */
  proxima: string;
  /** La próxima entrega es mañana. */
  proximaPronto: boolean;
}

/** Grupo plegable de la lista. `fondo`/`tinta` = colores del ícono. */
export interface GrupoProveedores {
  clave: string;
  titulo: string;
  detalle: string;
  icono: string;
  fondo: string;
  tinta: string;
  filas: FilaProveedor[];
  abierto: boolean;
}

/** Miniatura de un producto: imagen, ícono con el tono de su categoría o la inicial. */
export type Miniatura =
  | { tipo: 'imagen'; url: string }
  | { tipo: 'icono'; icono: string; fondo: string; tinta: string }
  | { tipo: 'inicial'; letra: string };

export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Etiquetas de "Cambios sin guardar". */
export const ETIQUETAS_CAMPOS: Partial<Record<keyof ProveedorV5, string>> = {
  nombre: 'Nombre', nit: 'NIT', correo: 'Correo', telefono: 'Teléfono', direccion: 'Dirección', contactoNombre: 'Contacto',
  notas: 'Notas', activo: 'Estado', diasEntrega: 'Días de entrega', atributos: 'Campos propios',
};

/** Clases de la etiqueta "próxima acción" en la lista y las tarjetas. */
export const TONO_ACCION_FILA: Record<ClaveAccion, string> = {
  recibir: 'bg-[#fff6d1] text-[#8a5a00]',
  reponer: 'bg-[#ffe6e5] text-[#b42318]',
  frio: 'bg-[#f1f1f1] text-[#4b5563]',
  ok: 'bg-transparent text-[#9ca3af] shadow-[0_0_0_1px_#ececec]',
};
/** En la hoja, "Al día" va en verde. */
export const TONO_ACCION_HOJA: Record<ClaveAccion, string> = { ...TONO_ACCION_FILA, ok: 'bg-[#e6f6ec] text-[#087b5d]' };

export const NIVEL_STOCK: Record<NivelStock, { texto: string; clases: string }> = {
  sin: { texto: 'Sin stock', clases: 'bg-[#ffe6e5] text-[#b42318]' },
  bajo: { texto: 'Bajo el mínimo', clases: 'bg-[#fff6d1] text-[#8a5a00]' },
  ok: { texto: 'Al día', clases: 'bg-[#e6f6ec] text-[#087b5d]' },
};

export const ESTADO_COMPRA: Record<EstadoCompra, { texto: string; clases: string }> = {
  pendiente: { texto: 'Pendiente', clases: 'bg-[#ffeb79] text-[#8a5a00]' },
  recibida: { texto: 'Recibida', clases: 'bg-[#a4ffb6] text-[#0b5c3f]' },
  cancelada: { texto: 'Cancelada', clases: 'bg-[#e3e3e3] text-[#4b5563]' },
};

/** Avatar de un proveedor inactivo (o de uno nuevo sin nombre). */
const TONO_APAGADO: [string, string] = ['#f1f1f1', '#9ca3af'];
/** [fondo, tinta] del avatar: el tono del proveedor, gris si está inactivo. */
export const tonoAvatar = (id: number, activo: boolean): [string, string] => (activo ? tonoProveedor(id) : TONO_APAGADO);

export const soloDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** Copia editable del proveedor (textos vacíos en vez de null). */
export const borradorDe = (p: ProveedorV5, campos: CampoPersonalizado[]): BorradorProveedor => ({
  ...p,
  nit: p.nit ?? '', correo: p.correo ?? '', telefono: p.telefono ?? '', direccion: p.direccion ?? '', contactoNombre: p.contactoNombre ?? '',
  notas: p.notas ?? '', diasEntrega: [...(p.diasEntrega ?? [])], atributos: valoresDe(p.atributos, campos),
});
/** Borrador de "Nuevo proveedor" (id 0 = todavía no existe; el real llega al guardar). */
export const proveedorVacio = (campos: CampoPersonalizado[]): BorradorProveedor => ({
  id: 0, nombre: '', nit: '', correo: '', telefono: '', direccion: '', contactoNombre: '', notas: '', activo: true, diasEntrega: [2, 5],
  atributos: valoresDe({}, campos),
});
/** Para comparar borradores: los campos propios vacíos no cuentan como cambio. */
export const conFirma = (b: BorradorProveedor) => ({ ...b, atributos: firmaValores(b.atributos) });

/** Puntos del polyline de la sparkline (viewBox 64×22), con valores normalizados. */
export function puntosSpark(serie: number[]): string {
  const min = Math.min(...serie), max = Math.max(...serie);
  return serie.map((v, i) => (i * (62 / 11) + 1).toFixed(1) + ',' + (20 - (max === min ? 0.5 : (v - min) / (max - min)) * 18).toFixed(1)).join(' ');
}

export function miniaturaDe(p: ProductoV5, catalogo: CatalogoStore): Miniatura {
  const imagen = [...(p.imagenes || [])].sort((a, b) => a.orden - b.orden)[0];
  if (imagen?.url) return { tipo: 'imagen', url: imagen.url };
  if (imagen) {
    const raiz = catalogo.raiz(catalogo.categoria(p.categoriaId));
    const [fondo, tinta, icono] = raiz ? catalogo.tono(raiz.id) : ['#f1f1f1', '#6b7280', 'photo'];
    return { tipo: 'icono', icono, fondo, tinta };
  }
  return { tipo: 'inicial', letra: ((p.nombre || '?').trim()[0] || '?').toUpperCase() };
}
