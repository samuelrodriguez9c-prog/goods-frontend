import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, defer, expand, finalize, reduce } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../usuarios/models/usuario.model';

/** Espejo de `Inventario` (saldo actual por producto). */
export interface Inventario {
  id: number;
  productoId: number;
  cantidadDisponible: number;
  cantidadReservada: number;
  stockMinimo: number;
  actualizadoEn: string;
}

export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste';

export interface MovimientoInventario {
  id: number;
  productoId: number;
  tipo: TipoMovimiento;
  /** Con signo para ajustes; positiva para entrada/salida (el tipo da el sentido). */
  cantidad: number;
  motivo: string | null;
  referenciaTipo: string | null;
  referenciaId: number | null;
  creadoEn: string;
}

/** Línea del plan de reposición (`GET /inventario/reposicion`). */
export interface LineaReposicionApi {
  productoId: number;
  nombre: string;
  /** Disponible menos lo reservado por pedidos. */
  libre: number;
  minimo: number;
  enCamino: number;
  ventaDiaria: number;
  diasCobertura: number | null;
  tiempoEntregaDias: number;
  sugerido: number;
  urgencia: 'agotado' | 'urgente' | 'pronto';
  /** Por qué, en una frase. */
  motivo: string;
  /** Solo con permiso de costos. */
  costoUnitario?: number | null;
}

/**
 * Qué pedir, cuánto y a quién, según el ritmo de venta y lo que tarda cada
 * proveedor. Lo calcula el backend (`ReposicionService`), el mismo plan que
 * lee el asistente.
 */
export interface PlanReposicionApi {
  grupos: {
    proveedor: { id: number; nombre: string; activo: boolean } | null;
    tiempoEntregaDias: number;
    tiempoEntregaFuente: string;
    lineas: LineaReposicionApi[];
  }[];
  cubiertosPorCompras: { productoId: number; nombre: string; enCamino: number; compras: string[] }[];
  resumen: { productos: number; agotados: number; urgentes: number };
  /** Si las ventas vienen subiendo o bajando y las cantidades ya lo tienen en cuenta. */
  tendencia: { cambioMensual: number; texto: string } | null;
}

/** `InventarioController` — todo con permiso `inventario.ver` / `inventario.editar`. */
@Injectable({ providedIn: 'root' })
export class InventarioService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/inventario`;

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

  todo(): Observable<Inventario[]> {
    const pagina = (page: number) =>
      this.http.get<RespuestaPaginada<Inventario>>(this.base, { params: { page, pageSize: 100 } });
    return pagina(1).pipe(
      expand((r) => (r.page < r.totalPaginas ? pagina(r.page + 1) : EMPTY)),
      reduce((xs, r) => [...xs, ...r.data], [] as Inventario[]),
    );
  }

  movimientos(productoId: number, pageSize = 14): Observable<RespuestaPaginada<MovimientoInventario>> {
    return this.http.get<RespuestaPaginada<MovimientoInventario>>(`${this.base}/${productoId}/movimientos`, {
      params: { pageSize },
    });
  }

  /** `cantidad` es un delta (puede ser negativa). */
  ajustar(productoId: number, cantidad: number, motivo: string): Observable<Inventario> {
    return this.propia(this.http.patch<Inventario>(`${this.base}/${productoId}/ajuste`, { cantidad, motivo }));
  }

  reposicion(): Observable<PlanReposicionApi> {
    return this.http.get<PlanReposicionApi>(`${this.base}/reposicion`);
  }

  stockMinimo(productoId: number, stockMinimo: number): Observable<Inventario> {
    return this.propia(this.http.patch<Inventario>(`${this.base}/${productoId}/stock-minimo`, { stockMinimo }));
  }
}
