import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Proveedor } from './models/proveedor.model';

export interface CrearProveedorPayload {
  nombre: string;
}

/**
 * Cliente mínimo de `ProveedorController` (backend) — se agrega recién
 * ahora (§5.5 de `PROPUESTA_ASISTENTE_IA_RAG.md`, "extracción de
 * documentos") porque el modo documento del Asistente de IA necesita
 * listar proveedores existentes (para cruzar contra `proveedorIdSugerido`)
 * y poder dar de alta uno nuevo al vuelo si la factura es de un
 * proveedor que todavía no está cargado — no porque exista ya una
 * pantalla de gestión de proveedores (no existe, ver el docblock de
 * `Proveedor` en `models/`).
 *
 * `GET /proveedores` no pagina (`ProveedorController.findAll` devuelve
 * un array plano, no `RespuestaPaginada`) — se trae la lista completa,
 * consistente con lo chico que es hoy un catálogo de proveedores.
 */
@Injectable({ providedIn: 'root' })
export class ProveedorService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/proveedores`;

  listar(): Observable<Proveedor[]> {
    return this.http.get<Proveedor[]>(this.base);
  }

  crear(payload: CrearProveedorPayload): Observable<Proveedor> {
    return this.http.post<Proveedor>(this.base, payload);
  }
}
