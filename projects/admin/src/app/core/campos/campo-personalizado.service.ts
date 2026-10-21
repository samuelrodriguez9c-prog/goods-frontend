import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActualizarCampoPayload, CampoPersonalizado, CrearCampoPayload, EntidadCampo } from './campo-personalizado.model';

/**
 * Campos propios de la Empresa (`/campos-personalizados`). Guarda la lista
 * de cada entidad en memoria: los formularios y Settings → Campos propios
 * comparten la misma, así un cambio se ve en el acto.
 */
@Injectable({ providedIn: 'root' })
export class CampoPersonalizadoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/campos-personalizados`;
  private readonly cache = signal<Partial<Record<EntidadCampo, CampoPersonalizado[]>>>({});
  private readonly pedidos = new Set<EntidadCampo>();

  /** Todos los campos de la entidad (activos e inactivos), en orden. Vacío hasta que cargan. */
  todos(entidad: EntidadCampo): CampoPersonalizado[] {
    return this.cache()[entidad] ?? [];
  }

  /** Los que se muestran en formularios, lista y exportación. */
  activos(entidad: EntidadCampo): CampoPersonalizado[] {
    return this.todos(entidad).filter((c) => c.activo);
  }

  /** Carga la entidad una vez; si falla, los formularios siguen sin campos propios. */
  asegurar(entidad: EntidadCampo): void {
    if (this.pedidos.has(entidad)) return;
    this.pedidos.add(entidad);
    this.recargar(entidad).subscribe({ error: () => this.pedidos.delete(entidad) });
  }

  recargar(entidad: EntidadCampo): Observable<CampoPersonalizado[]> {
    return this.http
      .get<CampoPersonalizado[]>(this.base, { params: new HttpParams().set('entidad', entidad) })
      .pipe(tap((xs) => this.poner(entidad, xs)));
  }

  /** @remarks 409 si ya hay 15 activos o la etiqueta se repite; 400 si una lista no trae opciones. */
  crear(p: CrearCampoPayload): Observable<CampoPersonalizado> {
    return this.http.post<CampoPersonalizado>(this.base, p).pipe(tap((c) => this.poner(c.entidad, [...this.todos(c.entidad), c])));
  }

  actualizar(campo: CampoPersonalizado, p: ActualizarCampoPayload): Observable<CampoPersonalizado> {
    return this.http
      .patch<CampoPersonalizado>(`${this.base}/${campo.id}`, p)
      .pipe(tap((c) => this.poner(c.entidad, this.todos(c.entidad).map((x) => (x.id === c.id ? c : x)))));
  }

  /** @remarks 409 si algún registro ya tiene un valor: hay que desactivarlo. */
  eliminar(campo: CampoPersonalizado): Observable<void> {
    return this.http
      .delete<void>(`${this.base}/${campo.id}`)
      .pipe(tap(() => this.poner(campo.entidad, this.todos(campo.entidad).filter((x) => x.id !== campo.id))));
  }

  /** `ids`: todos los campos de la entidad en el orden nuevo. */
  ordenar(entidad: EntidadCampo, ids: number[]): Observable<CampoPersonalizado[]> {
    return this.http.put<CampoPersonalizado[]>(`${this.base}/orden`, { entidad, ids }).pipe(tap((xs) => this.poner(entidad, xs)));
  }

  private poner(entidad: EntidadCampo, xs: CampoPersonalizado[]): void {
    this.cache.update((c) => ({ ...c, [entidad]: [...xs].sort((a, b) => a.orden - b.orden || a.id - b.id) }));
  }
}
