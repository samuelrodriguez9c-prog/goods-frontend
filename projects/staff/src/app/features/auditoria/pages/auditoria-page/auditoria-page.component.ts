import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { DataTableComponent, StatusBadgeComponent, StatusBadgeTone, dataTablePt } from 'shared-ui';
import { AuditoriaService } from '../../../../core/auditoria/auditoria.service';
import { AuditoriaAccion } from '../../../../core/auditoria/models/auditoria-accion.model';

/**
 * Historial de acciones (§7.5a, PIVOTE_SAAS_MULTITENANT.md) — pantalla
 * "Auditoría" del sidebar de staff. Solo lectura a propósito: lo llena
 * únicamente `AuditoriaAccionInterceptor` del backend en cada acción de
 * escritura, nadie escribe acá a mano (ver `AuditoriaAccion.entity.ts`)
 * — por eso no hay botón "nuevo" ni acciones de editar/eliminar, solo
 * listado + filtros, a diferencia de Planes/Usuarios/Roles.
 */
@Component({
  selector: 'app-auditoria-page',
  standalone: true,
  imports: [TableModule, DataTableComponent, StatusBadgeComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auditoria-page.component.html',
})
export class AuditoriaPageComponent {
  private readonly auditoriaService = inject(AuditoriaService);

  protected readonly tablePt = dataTablePt();

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly acciones = signal<AuditoriaAccion[]>([]);
  protected readonly total = signal(0);

  // Filtros — mismo patrón simple que el resto del panel (sin Angular
  // Forms): se aplican al tocar "Filtrar", no en cada tecla, porque acá
  // sí es una llamada al servidor (a diferencia de un filtro en memoria).
  protected readonly filtroEntidad = signal('');
  protected readonly filtroDesde = signal('');
  protected readonly filtroHasta = signal('');

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.auditoriaService
      .listar({
        entidad: this.filtroEntidad().trim() || undefined,
        desde: this.filtroDesde() || undefined,
        hasta: this.filtroHasta() || undefined,
        pageSize: 50,
      })
      .subscribe({
        next: (respuesta) => {
          this.acciones.set(respuesta.data);
          this.total.set(respuesta.total);
          this.cargando.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar el historial de auditoría. Intenta de nuevo.');
          this.cargando.set(false);
        },
      });
  }

  protected limpiarFiltros(): void {
    this.filtroEntidad.set('');
    this.filtroDesde.set('');
    this.filtroHasta.set('');
    this.cargar();
  }

  protected tonoExito(exitoso: boolean): StatusBadgeTone {
    return exitoso ? 'success' : 'critical';
  }
}
