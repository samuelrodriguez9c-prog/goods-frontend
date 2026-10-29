import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, reduce } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../usuarios/models/usuario.model';
import { Cliente, FichaCliente, FiltroClientes, GuardarClientePayload } from './models/cliente.model';

/** Cliente de `ClienteController` (módulo `customers`, permisos `clientes.*`). */
@Injectable({ providedIn: 'root' })
export class ClienteService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/clientes`;

  listar(filtro: FiltroClientes = {}): Observable<RespuestaPaginada<Cliente>> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filtro)) if (v !== undefined && v !== '' && v !== null) params = params.set(k, String(v));
    return this.http.get<RespuestaPaginada<Cliente>>(this.base, { params });
  }

  /**
   * Todos los clientes del filtro, página por página (100 por pedido, el
   * máximo del backend). La lista de Clientes busca, agrupa y cuenta en el
   * navegador, así que necesita el conjunto completo y no solo la primera
   * página.
   */
  todos(filtro: Omit<FiltroClientes, 'page' | 'pageSize'> = {}): Observable<Cliente[]> {
    const pagina = (page: number) => this.listar({ ...filtro, page, pageSize: 100 });
    return pagina(1).pipe(
      expand((r) => (r.page < r.totalPaginas ? pagina(r.page + 1) : EMPTY)),
      reduce((xs, r) => [...xs, ...r.data], [] as Cliente[]),
    );
  }

  ficha(id: number): Observable<FichaCliente> {
    return this.http.get<FichaCliente>(`${this.base}/${id}`);
  }

  /** El cliente de un contacto de la bandeja de WhatsApp (null si todavía no es cliente). */
  porWhatsapp(contactoId: number): Observable<FichaCliente | null> {
    return this.http.get<FichaCliente | null>(`${this.base}/por-whatsapp/${contactoId}`);
  }

  crear(payload: GuardarClientePayload): Observable<FichaCliente> {
    return this.http.post<FichaCliente>(this.base, payload);
  }

  actualizar(id: number, payload: Partial<GuardarClientePayload>): Observable<FichaCliente> {
    return this.http.patch<FichaCliente>(`${this.base}/${id}`, payload);
  }

  archivar(id: number, archivado: boolean): Observable<FichaCliente> {
    return this.http.patch<FichaCliente>(`${this.base}/${id}/archivar`, { archivado });
  }
}
