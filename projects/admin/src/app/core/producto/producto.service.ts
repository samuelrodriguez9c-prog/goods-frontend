import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, defer, expand, finalize, map, reduce } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../usuarios/models/usuario.model';
import { Producto, ProductoCatalogo, ProductoImagen, ProductoPayload } from './models/producto.model';

/** `pageSize` máximo que acepta el backend. */
const TOPE = 100;
const DECIMALES = ['precio', 'precioComparacion', 'costo', 'altoCm', 'anchoCm', 'largoCm'] as const;

/**
 * Cliente de `ProductoController`. `listar()` lo usa el asistente; el resto,
 * la pantalla de Productos. El backend filtra por la Empresa del token.
 */
@Injectable({ providedIn: 'root' })
export class ProductoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/productos`;

  /**
   * Momento (ms) de la última escritura propia, al salir y al volver. Sirve
   * para no contar como «cambio nuevo en vivo» el eco de `datos:cambio` de
   * nuestra propia escritura.
   */
  ultimaEscritura = 0;

  private propia<T>(obs: Observable<T>): Observable<T> {
    return defer(() => {
      this.ultimaEscritura = Date.now();
      return obs;
    }).pipe(finalize(() => (this.ultimaEscritura = Date.now())));
  }

  listar(buscar?: string): Observable<RespuestaPaginada<Producto>> {
    return this.http.get<RespuestaPaginada<Producto>>(this.base, {
      params: { pageSize: TOPE, ...(buscar ? { buscar } : {}) },
    });
  }

  /**
   * Todo el catálogo, página por página. La pantalla filtra, agrupa y cuenta
   * en el cliente, que alcanza para catálogos de cientos.
   *
   * @remarks
   * Si un negocio pasa de ~2.000 productos, conviene filtrar en el backend
   * (`buscar`, `categoriaId`, `estado`, `precioMin/Max` ya existen).
   */
  catalogo(): Observable<ProductoCatalogo[]> {
    const pagina = (page: number) =>
      this.http.get<RespuestaPaginada<ProductoCatalogo>>(this.base, { params: { page, pageSize: TOPE } });
    return pagina(1).pipe(
      expand((r) => (r.page < r.totalPaginas ? pagina(r.page + 1) : EMPTY)),
      reduce((todos, r) => [...todos, ...r.data.map(normalizar)], [] as ProductoCatalogo[]),
    );
  }

  obtener(id: number): Observable<ProductoCatalogo> {
    return this.http.get<ProductoCatalogo>(`${this.base}/${id}`).pipe(map(normalizar));
  }

  crear(payload: ProductoPayload): Observable<ProductoCatalogo> {
    return this.propia(this.http.post<ProductoCatalogo>(this.base, payload).pipe(map(normalizar)));
  }

  actualizar(id: number, payload: ProductoPayload): Observable<ProductoCatalogo> {
    return this.propia(this.http.patch<ProductoCatalogo>(`${this.base}/${id}`, payload).pipe(map(normalizar)));
  }

  eliminar(id: number): Observable<void> {
    return this.propia(this.http.delete<void>(`${this.base}/${id}`));
  }

  /** `url` sale de `UploadService.subir(file)`. */
  agregarImagen(id: number, url: string, orden: number): Observable<ProductoImagen> {
    return this.propia(this.http.post<ProductoImagen>(`${this.base}/${id}/imagenes`, { url, orden }));
  }

  eliminarImagen(id: number, imagenId: number): Observable<void> {
    return this.propia(this.http.delete<void>(`${this.base}/${id}/imagenes/${imagenId}`));
  }
}

function normalizar(p: ProductoCatalogo): ProductoCatalogo {
  const out = { ...p, imagenes: [...(p.imagenes ?? [])].sort((a, b) => a.orden - b.orden) } as ProductoCatalogo;
  for (const k of DECIMALES) {
    const v = out[k] as unknown;
    (out as unknown as Record<string, number | null>)[k] = v == null || v === '' ? null : Number(v);
  }
  return out;
}
