import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconBan,
  IconCopy,
  IconExternalLink,
  IconFileText,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import {
  FacturacionService,
  formatFecha,
  formatMonto,
  formatPeriodo,
  mensajeDeError,
} from '../../../../core/facturacion/facturacion.service';
import { METODOS_PAGO, PagoDetalle } from '../../../../core/facturacion/models/facturacion.model';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PistaService } from '../../../../core/ui/pista.service';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { environment } from '../../../../../environments/environment';

/**
 * Detalle de un pago + anulación (Facturación, 2026-10-02). Carga el pago
 * por su cuenta (`GET /facturacion/pagos/:id`); el botón "Anular" solo
 * aparece si el backend dice `anulable` (último pago válido de la Empresa
 * y con la suscripción sin cambios desde entonces). Si no, explica por qué.
 */
@Component({
  selector: 'app-pago-detalle-panel',
  standalone: true,
  imports: [FormsModule, TablerIconComponent, PantallaEstadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pago-detalle-panel.component.html',
})
export class PagoDetallePanelComponent {
  private readonly facturacion = inject(FacturacionService);
  private readonly alertas = inject(AlertaService);
  private readonly pista = inject(PistaService);

  readonly pagoId = input.required<number>();
  readonly puedeGestionar = input(false);
  readonly cerrar = output<void>();
  readonly verEmpresa = output<number>();
  readonly anulado = output<void>();
  /** Justo antes de mandar la anulación (ver `RegistrarPagoPanelComponent.enviando`). */
  readonly enviando = output<void>();

  protected readonly i = { cerrar: IconX, copiar: IconCopy, anular: IconBan, archivo: IconFileText, abrir: IconExternalLink };
  protected readonly formatMonto = formatMonto;
  protected readonly formatFecha = formatFecha;

  protected readonly pago = signal<PagoDetalle | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.pago() ? 'listo' : 'cargando',
  );

  protected readonly anulando = signal(false);
  protected readonly motivo = signal('');
  protected readonly guardando = signal(false);
  protected readonly errorAnular = signal<string | null>(null);

  protected readonly celdas = computed(() => {
    const p = this.pago();
    if (!p) return [];
    return [
      { etiqueta: 'Fecha de pago', valor: formatFecha(p.fechaPago) },
      { etiqueta: 'Cubre', valor: formatPeriodo(p.periodoDesde, p.periodoHasta) },
      { etiqueta: 'Método', valor: METODOS_PAGO.find((m) => m.valor === p.metodo)?.texto ?? p.metodo },
    ];
  });

  protected readonly datos = computed(() => {
    const p = this.pago();
    if (!p) return [];
    return [
      { etiqueta: 'Referencia', valor: p.referencia ?? '—' },
      { etiqueta: 'Entidad bancaria', valor: p.entidadBancaria ?? '—' },
      { etiqueta: 'Moneda', valor: p.moneda },
      { etiqueta: 'Plan al momento del pago', valor: p.planNombre ?? '—' },
      { etiqueta: 'Registrado por', valor: `${p.registradoPor?.nombre ?? '—'} · ${formatFecha(p.creadoEn)}` },
    ];
  });

  /** Ruta absoluta del comprobante (el backend guarda `/uploads/...`). */
  protected readonly urlArchivo = computed(() => {
    const url = this.pago()?.archivoUrl;
    if (!url) return null;
    return /^https?:/.test(url) ? url : environment.apiUrl.replace(/\/api\/?$/, '') + url;
  });

  protected readonly puedeConfirmar = computed(() => this.motivo().trim().length >= 5 && !this.guardando());

  constructor() {
    queueMicrotask(() => this.cargar());
  }

  protected cargar(): void {
    this.error.set(null);
    this.facturacion.obtener(this.pagoId()).subscribe({
      next: (p) => this.pago.set(p),
      error: (err) => this.error.set(mensajeDeError(err, 'No se pudo cargar el pago.')),
    });
  }

  protected copiarId(): void {
    navigator.clipboard?.writeText(String(this.pagoId()));
    this.pista.hecho(`Pago #${this.pagoId()} copiado`);
  }

  protected confirmarAnulacion(): void {
    const p = this.pago();
    if (!p || !this.puedeConfirmar()) return;
    this.guardando.set(true);
    this.errorAnular.set(null);
    this.enviando.emit();
    this.alertas
      .seguir(this.facturacion.anular(p.id, this.motivo().trim()), {
        titulo: 'Anulando el pago',
        texto: `${p.empresaNombre} · ${formatMonto(p.monto, p.moneda)}`,
        exito: { titulo: 'Pago anulado', texto: 'El vencimiento volvió a donde estaba antes de este pago.' },
        error: { titulo: 'No se pudo anular', texto: 'Revisa el detalle en el panel.' },
      })
      .subscribe({
        next: (actualizado) => {
          this.guardando.set(false);
          this.anulando.set(false);
          this.pago.set(actualizado);
          this.anulado.emit();
        },
        error: (err) => {
          this.guardando.set(false);
          this.errorAnular.set(mensajeDeError(err));
        },
      });
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cerrar.emit();
  }
}
