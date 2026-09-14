import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { DataTableComponent, dataTablePt } from 'shared-ui';
import { forkJoin } from 'rxjs';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { construirMapaPlanPorEmpresa } from '../../../../core/catalog/plan-lookup.util';
import { Empresa } from '../../../../core/catalog/models/empresa.model';

interface FilaPendiente extends Empresa {
  /** Suscripcion.estado === 'pendiente' recién se crea en
   * `EmpresaService.registrarPublico` del backend, así que toda fila acá
   * SIEMPRE debería tener un plan solicitado — a diferencia del listado
   * general de Empresas, acá `null` sería un dato raro, no un caso normal
   * (ver comentario de `EmpresasPageComponent.FilaEmpresa.planNombre`). */
  planNombre: string | null;
  activando: boolean;
  errorActivar: string | null;
}

/**
 * Cola de altas pendientes (§7.2, PIVOTE_SAAS_MULTITENANT.md) — el paso 2
 * del flujo de alta asistida (§5): un negocio se registró desde la
 * página pública de checkout (todavía sin construir, ver §8 paso 4) y
 * quedó en estado 'pendiente' con una Suscripción 'pendiente' al plan
 * que eligió; acá el staff revisa y aprueba con
 * `PATCH /empresas/:id/activar`, que activa la Empresa, crea el Usuario
 * dueño y le dispara el correo para definir contraseña (todo eso ya lo
 * hace `EmpresaService.activar` del backend en un solo paso).
 *
 * Sin la página pública de registro construida todavía, esta pantalla no
 * tiene cómo llenarse sola en un ambiente nuevo — para verla con datos
 * hace falta un registro creado a mano (`POST /empresas/registro-publico`)
 * o ya existente en la base.
 */
@Component({
  selector: 'app-altas-pendientes-page',
  standalone: true,
  imports: [TableModule, DataTableComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './altas-pendientes-page.component.html',
})
export class AltasPendientesPageComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly planService = inject(PlanService);

  // Mismo `pt` (pass-through) que EmpresasPageComponent — sin esto la
  // `<p-table>` queda sin el padding/bordes de celda de shared-ui (bug
  // real encontrado al verificar esta pantalla: encabezados y filas se
  // veían todos pegados, sin espacio entre columnas).
  protected readonly tablePt = dataTablePt();

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filas = signal<FilaPendiente[]>([]);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      empresas: this.empresaService.listar('pendiente'),
      suscripcionesPendientes: this.suscripcionService.listar('pendiente'),
      planes: this.planService.listarTodos(),
    }).subscribe({
      next: ({ empresas, suscripcionesPendientes, planes }) => {
        const mapaPlan = construirMapaPlanPorEmpresa(suscripcionesPendientes.data, planes.data);
        this.filas.set(
          empresas.data.map((empresa) => ({
            ...empresa,
            planNombre: mapaPlan.get(empresa.id) ?? null,
            activando: false,
            errorActivar: null,
          })),
        );
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la cola de altas pendientes. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  protected activar(fila: FilaPendiente): void {
    if (fila.activando) {
      return;
    }
    this.actualizarFila(fila.id, { activando: true, errorActivar: null });

    this.empresaService.activar(fila.id).subscribe({
      // Éxito: la fila ya no está 'pendiente', así que sale de esta
      // cola — no hace falta releer el listado completo del servidor.
      next: () => {
        this.filas.update((actuales) => actuales.filter((f) => f.id !== fila.id));
      },
      error: (err: unknown) => {
        this.actualizarFila(fila.id, {
          activando: false,
          errorActivar: this.mensajeDeError(err),
        });
      },
    });
  }

  private actualizarFila(id: number, cambios: Partial<FilaPendiente>): void {
    this.filas.update((actuales) =>
      actuales.map((f) => (f.id === id ? { ...f, ...cambios } : f)),
    );
  }

  private mensajeDeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const mensaje = (err.error as { message?: string } | null)?.message;
      if (mensaje) {
        return Array.isArray(mensaje) ? mensaje.join(' ') : mensaje;
      }
    }
    return 'No se pudo activar. Intenta de nuevo.';
  }
}
