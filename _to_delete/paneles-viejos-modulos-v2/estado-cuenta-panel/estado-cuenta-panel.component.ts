import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconAlertTriangle, IconChevronRight, IconCircleCheck, IconClock, IconPlus, IconX, TablerIconComponent } from '@tabler/icons-angular';
import {
  FacturacionService,
  formatFecha,
  formatMonto,
  formatPeriodo,
  mensajeDeError,
} from '../../../../core/facturacion/facturacion.service';
import { EstadoCuenta } from '../../../../core/facturacion/models/facturacion.model';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';

/**
 * Estado de cuenta de una Empresa (Facturación, 2026-10-02): todo lo que
 * hace falta para resolver una consulta o disputa sin ir a la pasarela —
 * plan y vencimiento actuales, mora, total pagado y el historial completo
 * de pagos (incluye anulados). `GET /facturacion/empresas/:id/estado-cuenta`.
 */
@Component({
  selector: 'app-estado-cuenta-panel',
  standalone: true,
  imports: [FormsModule, TablerIconComponent, PantallaEstadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './estado-cuenta-panel.component.html',
})
export class EstadoCuentaPanelComponent {
  private readonly facturacion = inject(FacturacionService);

  readonly empresaId = input.required<number>();
  /** Con `facturacion.gestionar`: agregar / quitar extras. */
  readonly puedeGestionar = input(false);
  /** Se agregó o quitó un extra (la pantalla de atrás se recarga). */
  readonly cambio = output<void>();
  readonly cerrar = output<void>();
  readonly verPago = output<number>();

  protected readonly i = { cerrar: IconX, ir: IconChevronRight, agregar: IconPlus };
  protected readonly formatMonto = formatMonto;
  protected readonly formatFecha = formatFecha;
  protected readonly formatPeriodo = formatPeriodo;

  protected readonly cuenta = signal<EstadoCuenta | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cuenta() ? 'listo' : 'cargando',
  );

  /** La situación en una línea, con su tono: lo primero que se lee. */
  protected readonly situacion = computed(() => {
    const s = this.cuenta()?.suscripcion;
    if (!s) {
      return { icono: IconClock, titulo: 'Sin suscripción', nota: 'Esta Empresa todavía no tiene un plan asignado.', caja: 'border-gray-200 bg-neutral-50', tinta: 'text-gray-500' };
    }
    if (s.estado === 'vencida' || s.estado === 'cancelada') {
      return {
        icono: IconAlertTriangle,
        titulo: s.estado === 'vencida' ? 'Suscripción vencida' : 'Suscripción cancelada',
        nota: s.estado === 'vencida' ? 'Sin acceso. Un pago la reactiva desde la fecha del pago.' : 'Dada de baja: se reabre con un cambio de plan desde Suscripciones.',
        caja: 'border-[#f0d8d2] bg-[#fdf6f4]',
        tinta: 'text-badge-error-solid',
      };
    }
    if (s.estado === 'pendiente') {
      return { icono: IconClock, titulo: 'Alta pendiente', nota: 'Todavía no se activó: no se le pueden registrar pagos.', caja: 'border-gray-200 bg-neutral-50', tinta: 'text-amber-700' };
    }
    if (s.diasMora > 0) {
      return {
        icono: IconAlertTriangle,
        titulo: `En mora hace ${s.diasMora} ${s.diasMora === 1 ? 'día' : 'días'}`,
        nota: `Venció el ${formatFecha(s.fechaProximoVencimiento)} y sigue con acceso.`,
        caja: 'border-[#f0d8d2] bg-[#fdf6f4]',
        tinta: 'text-badge-error-solid',
      };
    }
    const dias = s.diasParaVencer ?? 0;
    return {
      icono: dias <= 7 ? IconClock : IconCircleCheck,
      titulo: dias <= 7 ? `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}` : 'Al día',
      nota: `Pagado hasta el ${formatFecha(s.fechaProximoVencimiento)}.`,
      caja: dias <= 7 ? 'border-[#f5e2b8] bg-[#fffbeb]' : 'border-[#cdebdc] bg-[#f1faf5]',
      tinta: dias <= 7 ? 'text-amber-700' : 'text-success-solid',
    };
  });

  protected readonly celdas = computed(() => {
    const c = this.cuenta();
    if (!c) return [];
    const plan = c.suscripcion?.plan;
    const pagado = [c.totales.pagado.COP ? formatMonto(c.totales.pagado.COP) : null, c.totales.pagado.USD ? formatMonto(c.totales.pagado.USD, 'USD') : null]
      .filter(Boolean)
      .join(' + ');
    return [
      {
        etiqueta: 'Cuota mensual',
        // El desglose (plan + extras) está en "Cuota del mes", más abajo.
        valor: c.cuotaMensual ? formatMonto(c.cuotaMensual.total) : plan ? plan.nombre : '—',
      },
      { etiqueta: 'Saldo pendiente', valor: c.saldoPendiente ? formatMonto(c.saldoPendiente) : 'Al día' },
      { etiqueta: 'Total pagado', valor: pagado || '$0' },
    ];
  });

  /** Estado de cada cobro en castellano, con su tono. */
  protected chipCobro(c: EstadoCuenta['cobros'][number]): { texto: string; clase: string } {
    if (c.estado === 'pagado') return { texto: 'Pagado', clase: 'bg-badge-success-bg text-success-solid' };
    if (c.estado === 'anulado') return { texto: 'Anulado', clase: 'bg-badge-neutral-bg text-gray-600' };
    return c.atrasado
      ? { texto: 'Atrasado', clase: 'bg-field-error-bg text-badge-error-solid' }
      : { texto: 'Pendiente', clase: 'bg-badge-warning-bg text-amber-800' };
  }

  // Extras (cargos recurrentes, 2026-10-04): se suman al cobro del mes.
  protected readonly agregando = signal(false);
  protected readonly concepto = signal('');
  protected readonly montoExtra = signal<number | null>(null);
  protected readonly quitandoId = signal<number | null>(null);
  protected readonly motivoBaja = signal('');
  protected readonly guardandoExtra = signal(false);
  protected readonly errorExtra = signal<string | null>(null);
  protected readonly cargosActivos = computed(() => (this.cuenta()?.cargos ?? []).filter((c) => c.activo));
  protected readonly cargosTerminados = computed(() => (this.cuenta()?.cargos ?? []).filter((c) => !c.activo));
  protected readonly puedeAgregar = computed(
    () => this.concepto().trim().length >= 3 && (this.montoExtra() ?? 0) >= 1 && !this.guardandoExtra(),
  );

  constructor() {
    queueMicrotask(() => this.cargar());
  }

  /** "Plan Base + Reservas" — de qué se compone un cobro. */
  protected composicion(c: EstadoCuenta['cobros'][number]): string {
    return c.detalle && c.detalle.length > 1 ? c.detalle.map((l) => l.concepto).join(' + ') : '';
  }

  protected agregarExtra(): void {
    if (!this.puedeAgregar()) return;
    this.guardandoExtra.set(true);
    this.errorExtra.set(null);
    this.facturacion.crearCargo(this.empresaId(), this.concepto().trim(), this.montoExtra()!).subscribe({
      next: (c) => {
        this.cuenta.set(c);
        this.guardandoExtra.set(false);
        this.agregando.set(false);
        this.concepto.set('');
        this.montoExtra.set(null);
        this.cambio.emit();
      },
      error: (err) => {
        this.guardandoExtra.set(false);
        this.errorExtra.set(mensajeDeError(err));
      },
    });
  }

  protected quitarExtra(id: number): void {
    if (this.motivoBaja().trim().length < 5) return;
    this.guardandoExtra.set(true);
    this.errorExtra.set(null);
    this.facturacion.darDeBajaCargo(id, this.motivoBaja().trim()).subscribe({
      next: (c) => {
        this.cuenta.set(c);
        this.guardandoExtra.set(false);
        this.quitandoId.set(null);
        this.motivoBaja.set('');
        this.cambio.emit();
      },
      error: (err) => {
        this.guardandoExtra.set(false);
        this.errorExtra.set(mensajeDeError(err));
      },
    });
  }

  protected cargar(): void {
    this.error.set(null);
    this.facturacion.estadoCuenta(this.empresaId()).subscribe({
      next: (c) => this.cuenta.set(c),
      error: (err) => this.error.set(mensajeDeError(err, 'No se pudo cargar el estado de cuenta.')),
    });
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cerrar.emit();
  }
}
