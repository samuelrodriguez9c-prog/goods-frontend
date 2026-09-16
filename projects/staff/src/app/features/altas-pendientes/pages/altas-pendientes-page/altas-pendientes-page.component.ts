import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { DataTableComponent, StatusBadgeComponent, dataTablePt } from 'shared-ui';
import { forkJoin } from 'rxjs';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { construirMapaPlanPorEmpresa } from '../../../../core/catalog/plan-lookup.util';
import { Empresa } from '../../../../core/catalog/models/empresa.model';
import { ActivarEmpresaWizardComponent } from '../activar-empresa-wizard/activar-empresa-wizard.component';

interface FilaPendiente extends Empresa {
  /** Suscripcion.estado === 'pendiente' recién se crea en
   * `EmpresaService.registrarPublico` del backend, así que toda fila acá
   * SIEMPRE debería tener un plan solicitado — a diferencia del listado
   * general de Empresas, acá `null` sería un dato raro, no un caso normal
   * (ver comentario de `EmpresasPageComponent.FilaEmpresa.planNombre`). */
  planNombre: string | null;
}

/**
 * Cola de altas pendientes (§7.2, PIVOTE_SAAS_MULTITENANT.md) — el paso 2
 * del flujo de alta asistida (§5): un negocio se registró desde la
 * página pública de checkout y quedó `pendiente` con una Suscripción
 * `pendiente` al plan que eligió.
 *
 * §11 Paso 3 (PROPUESTA_FLUJO_ALTA_ASISTIDA.md): el botón "Activar" ya no
 * llama a `EmpresaService.activar()` de un tirón — abre
 * `ActivarEmpresaWizardComponent`, el asistente de 2 pasos. Esta pantalla
 * ahora también pide `informacion_corroborada` además de `pendiente`
 * (antes solo pedía `pendiente`): una Empresa en ese estado ya pasó el
 * paso 1 del asistente (la llamada) y está esperando que el cliente
 * confirme desde el enlace — se queda visible acá con la etiqueta
 * "Esperando confirmación del cliente" en vez de desaparecer, para que
 * el staff pueda retomarla (reabrir el wizard directo en el paso 2, o
 * rechazarla) sin perder el hilo. La Suscripción de esas filas sigue
 * `pendiente` hasta que el cliente confirma (ver
 * `EmpresaService.activarPorConfirmacionCliente` del backend), así que
 * el mismo cruce de `suscripcionService.listar('pendiente')` de siempre
 * también resuelve el plan de estas filas nuevas.
 */
@Component({
  selector: 'app-altas-pendientes-page',
  standalone: true,
  imports: [TableModule, DataTableComponent, DatePipe, StatusBadgeComponent, ActivarEmpresaWizardComponent],
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

  // Wizard de activación (§11 Paso 3) — `null` significa cerrado.
  protected readonly empresaSeleccionadaWizard = signal<number | null>(null);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      pendientes: this.empresaService.listar({ estado: 'pendiente' }),
      esperandoConfirmacion: this.empresaService.listar({ estado: 'informacion_corroborada' }),
      suscripcionesPendientes: this.suscripcionService.listar('pendiente'),
      planes: this.planService.listarTodos(),
    }).subscribe({
      next: ({ pendientes, esperandoConfirmacion, suscripcionesPendientes, planes }) => {
        const mapaPlan = construirMapaPlanPorEmpresa(suscripcionesPendientes.data, planes.data);
        const todas = [...pendientes.data, ...esperandoConfirmacion.data];
        this.filas.set(
          todas.map((empresa) => ({
            ...empresa,
            planNombre: mapaPlan.get(empresa.id) ?? null,
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

  protected abrirWizard(empresa: FilaPendiente): void {
    this.empresaSeleccionadaWizard.set(empresa.id);
  }

  protected cerrarWizard(): void {
    this.empresaSeleccionadaWizard.set(null);
  }

  /** Cualquier cambio del wizard (datos editados, llamada finalizada,
   * activada, rechazada) recarga la cola entera — ver el comentario de
   * `ActivarEmpresaWizardComponent.actualizada`. */
  protected onWizardActualizada(): void {
    this.cargar();
  }
}
