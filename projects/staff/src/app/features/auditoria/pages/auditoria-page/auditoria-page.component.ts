import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { Popover } from 'primeng/popover';
import { DatePicker } from 'primeng/datepicker';
import { IconAdjustmentsHorizontal, TablerIconComponent } from '@tabler/icons-angular';
import {
  AppliedFilterChip,
  DataTableComponent,
  SearchToolbarComponent,
  StatusBadgeComponent,
  StatusBadgeTone,
  dataTablePt,
  filterDatePickerPt,
  formatDateInput,
  parseDateInput,
} from 'shared-ui';
import { AuditoriaService } from '../../../../core/auditoria/auditoria.service';
import { AuditoriaAccion } from '../../../../core/auditoria/models/auditoria-accion.model';

/**
 * Historial de acciones (§7.5a, PIVOTE_SAAS_MULTITENANT.md) — pantalla
 * "Auditoría" del sidebar de staff. Solo lectura a propósito: lo llena
 * únicamente `AuditoriaAccionInterceptor` del backend en cada acción de
 * escritura, nadie escribe acá a mano (ver `AuditoriaAccion.entity.ts`)
 * — por eso no hay botón "nuevo" ni acciones de editar/eliminar, solo
 * listado + filtros, a diferencia de Planes/Usuarios/Roles.
 *
 * Filtros rehechos sobre `SearchToolbarComponent` (ver ese componente y
 * ADMIN_DISENO.md > "Barra de búsqueda y filtros") — antes eran 3
 * `<input>` nativos con label arriba, que no se parecían en nada a la
 * barra "Search and filter" de Shopify. "Entidad" pasó a ser el campo
 * de búsqueda principal (es, en los hechos, el único filtro de texto
 * libre de esta pantalla); Desde/Hasta viven en el popover "Filtros"
 * como `p-date-picker` (antes `<input type="date">` nativo — un
 * calendario de sistema operativo no se puede vestir para que se vea
 * como el de Shopify).
 */
@Component({
  selector: 'app-auditoria-page',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    DataTableComponent,
    StatusBadgeComponent,
    SearchToolbarComponent,
    Popover,
    DatePicker,
    TablerIconComponent,
    DatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auditoria-page.component.html',
})
export class AuditoriaPageComponent {
  private readonly auditoriaService = inject(AuditoriaService);

  protected readonly tablePt = dataTablePt();
  protected readonly datePickerPt = filterDatePickerPt();
  protected readonly iconFiltros = IconAdjustmentsHorizontal;

  // Mismo estilo de superficie que `QuickAdjustPopoverComponent` (ver
  // ese componente) — tarjeta blanca redondeada con sombra, `content`
  // sin padding propio porque el `<div class="p-4">` de adentro ya lo
  // resuelve (evita padding doble).
  protected readonly popoverPt = {
    root: 'rounded-lg border border-gray-200 bg-card-bg shadow-lg',
    content: 'p-0',
  };

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly acciones = signal<AuditoriaAccion[]>([]);
  protected readonly total = signal(0);

  // Filtros — mismo patrón simple que el resto del panel (sin Angular
  // Forms): se aplican al tocar "Filtrar" (Enter en el buscador o el
  // botón del popover), no en cada tecla, porque acá sí es una llamada
  // al servidor (a diferencia de un filtro en memoria).
  protected readonly filtroEntidad = signal('');
  protected readonly filtroDesde = signal('');
  protected readonly filtroHasta = signal('');

  private readonly popoverFiltros = viewChild.required(Popover);

  protected readonly filtroDesdeFecha = computed(() => parseDateInput(this.filtroDesde()));
  protected readonly filtroHastaFecha = computed(() => parseDateInput(this.filtroHasta()));

  protected readonly cantidadFiltrosActivos = computed(
    () => (this.filtroDesde() ? 1 : 0) + (this.filtroHasta() ? 1 : 0),
  );

  protected readonly filtrosAplicados = computed<AppliedFilterChip[]>(() => {
    const chips: AppliedFilterChip[] = [];
    if (this.filtroDesde()) {
      chips.push({ key: 'desde', label: `Desde: ${this.formatearFecha(this.filtroDesde())}` });
    }
    if (this.filtroHasta()) {
      chips.push({ key: 'hasta', label: `Hasta: ${this.formatearFecha(this.filtroHasta())}` });
    }
    return chips;
  });

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

  protected onBuscarChange(valor: string): void {
    this.filtroEntidad.set(valor);
  }

  protected onDesdeChange(fecha: Date | null): void {
    this.filtroDesde.set(formatDateInput(fecha));
  }

  protected onHastaChange(fecha: Date | null): void {
    this.filtroHasta.set(formatDateInput(fecha));
  }

  protected abrirFiltros(event: Event): void {
    this.popoverFiltros().toggle(event);
  }

  protected aplicarFiltros(): void {
    this.popoverFiltros().hide();
    this.cargar();
  }

  protected quitarFiltro(clave: string): void {
    if (clave === 'desde') {
      this.filtroDesde.set('');
    } else if (clave === 'hasta') {
      this.filtroHasta.set('');
    }
    this.cargar();
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

  private formatearFecha(valor: string): string {
    const fecha = parseDateInput(valor);
    return fecha ? fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : valor;
  }
}
