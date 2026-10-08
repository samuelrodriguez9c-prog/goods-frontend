import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../usuarios/models/usuario.model';
import { Producto } from './models/producto.model';

/**
 * Cliente mínimo de `ProductoController` (backend) — igual criterio que
 * `ProveedorService`: se agrega para el modo documento del Asistente de
 * IA (§5.5), no porque ya exista una pantalla de catálogo construida.
 *
 * `GET /productos` SÍ pagina (`RespuestaPaginada`, a diferencia de
 * `/proveedores`) y acepta `OptionalJwtAuthGuard` — logueado como acá,
 * el backend ya filtra por la Empresa del token solo (no hace falta
 * mandar `empresaId`, ver `ProductoController.findAll`). Se pide con un
 * `pageSize` generoso en vez de armar una búsqueda incremental por
 * teclado — alcanza para el tamaño de catálogo actual (Proveedores/
 * Productos son ambos todavía catálogos chicos, sin ninguna pantalla de
 * gestión propia construida aún).
 */
@Injectable({ providedIn: 'root' })
export class ProductoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/productos`;

  listar(buscar?: string): Observable<RespuestaPaginada<Producto>> {
    return this.http.get<RespuestaPaginada<Producto>>(this.base, {
      params: {
        // 100 = tope de PaginationQueryDto (con 200 el backend respondía 400
        // y el selector de productos del asistente quedaba vacío).
        pageSize: 100,
        ...(buscar ? { buscar } : {}),
      },
    });
  }
}
