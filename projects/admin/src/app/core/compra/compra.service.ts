import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Compra, CrearCompraPayload } from './models/compra.model';

/**
 * Cliente mínimo de `CompraController` (backend) — por ahora solo
 * `crear`, que es lo único que necesita el paso "Confirmar y guardar"
 * del modo documento del Asistente de IA (§5.5). El resto de
 * `CompraModule` (listar, cambiar estado a 'recibida' y disparar
 * inventario, etc.) queda para cuando se construya la pantalla real de
 * Compras (`ProductPurchasesPageComponent`, hoy un placeholder).
 */
@Injectable({ providedIn: 'root' })
export class CompraService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/compras`;

  crear(payload: CrearCompraPayload): Observable<Compra> {
    return this.http.post<Compra>(this.base, payload);
  }
}
