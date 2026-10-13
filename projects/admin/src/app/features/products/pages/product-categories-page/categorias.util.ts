import { CatalogoStore } from '../../shared/catalogo.store';
import { Categoria, ProductoV5 } from '../../shared/modelos';

/** Cómo se dibuja una miniatura: la foto, un ícono sobre el tono de su principal o la inicial del nombre. */
export type Miniatura =
  | { tipo: 'imagen'; url: string }
  | { tipo: 'icono'; icono: string; fondo: string; tinta: string }
  | { tipo: 'inicial'; letra: string };

/** Colores e ícono de una categoría (los de su principal). */
export interface Tono {
  fondo: string;
  tinta: string;
  icono: string;
}

type ConPadre = Pick<Categoria, 'id' | 'categoriaPadreId'>;

/** Clase del punto de estado (verde = activa, gris = inactiva). */
export const puntoEstado = (activa: boolean) => (activa ? 'bg-[#087b5d]' : 'bg-[#9ca3af]');

export const nombreCategoria = (s: CatalogoStore, id: number | null) => s.categoria(id)?.nombre ?? 'Sin categoría';

/** Principales (en orden de creación), cada una seguida de sus subcategorías en orden alfabético. */
export function ordenarArbol(categorias: Categoria[]): Categoria[] {
  return categorias
    .filter((c) => !c.categoriaPadreId)
    .sort((a, b) => a.id - b.id)
    .flatMap((r) => [r, ...categorias.filter((c) => c.categoriaPadreId === r.id).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))]);
}

/** Tono de la principal; las subcategorías llevan carpeta en vez del ícono de la principal. */
export function tonoCategoria(s: CatalogoStore, c: ConPadre): Tono {
  const raiz = s.raiz(s.categoria(c.id) ?? (c as Categoria));
  const [fondo, tinta, icono] = raiz ? s.tono(raiz.id) : ['#f1f1f1', '#6b7280', 'folder'];
  return { fondo, tinta, icono: c.categoriaPadreId ? 'folder' : icono };
}

export function miniaturaCategoria(s: CatalogoStore, c: ConPadre & Pick<Categoria, 'imagen'>): Miniatura {
  return c.imagen ? { tipo: 'imagen', url: c.imagen } : { tipo: 'icono', ...tonoCategoria(s, c) };
}

/** Primera foto; si la foto no tiene URL, el tono de su categoría; sin fotos, la inicial. */
export function miniaturaProducto(s: CatalogoStore, p: ProductoV5): Miniatura {
  const foto = [...(p.imagenes || [])].sort((a, b) => a.orden - b.orden)[0];
  if (foto?.url) return { tipo: 'imagen', url: foto.url };
  if (foto) {
    const raiz = s.raiz(s.categoria(p.categoriaId));
    const [fondo, tinta, icono] = raiz ? s.tono(raiz.id) : ['#f1f1f1', '#6b7280', 'photo'];
    return { tipo: 'icono', fondo, tinta, icono };
  }
  return { tipo: 'inicial', letra: ((p.nombre || '?').trim()[0] || '?').toUpperCase() };
}

/** Borrador de la hoja (lo que se edita antes de guardar). */
export interface Borrador {
  nombre: string;
  descripcion: string;
  /** '' = principal. */
  categoriaPadreId: string;
  activo: boolean;
  imagen: string | null;
}

/** Cuántos productos tiene cada categoría (sin contar sus subcategorías). */
export function productosPorCategoria(productos: ProductoV5[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of productos) if (p.categoriaId != null) m.set(p.categoriaId, (m.get(p.categoriaId) ?? 0) + 1);
  return m;
}
