import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  IconCheck,
  IconFileUpload,
  IconInfoCircle,
  IconSearch,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { Observable, Subject, debounceTime, of, switchMap } from 'rxjs';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { Empresa } from '../../../../core/catalog/models/empresa.model';
import {
  FacturacionService,
  fechaIso,
  formatFecha,
  formatMonto,
  formatPeriodo,
  mensajeDeError,
} from '../../../../core/facturacion/facturacion.service';
import {
  EstadoCuenta,
  METODOS_PAGO,
  MetodoPago,
  MonedaPago,
  PagoRegistrado,
} from '../../../../core/facturacion/models/facturacion.model';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { UploadService } from '../../../../core/upload/upload.service';

/** Mismo cálculo que `SuscripcionService.periodoRenovacion` del backend —
 *  solo para la vista previa; el período real lo decide el backend. */
function periodoEstimado(cuenta: EstadoCuenta, fechaPago: Date): { desde: Date; hasta: Date } | null {
  const s = cuenta.suscripcion;
  if (!s || !['activa', 'vencida'].includes(s.estado)) return null;
  const vence = s.fechaProximoVencimiento ? new Date(s.fechaProximoVencimiento) : null;
  const desde = s.estado === 'activa' && vence && vence > fechaPago ? vence : fechaPago;
  const hasta = new Date(desde);
  hasta.setMonth(hasta.getMonth() + 1);
  return { desde, hasta };
}

/**
 * Registrar un pago a mano (Facturación, 2026-10-02) — el mismo
 * `POST /facturacion/pagos` que usa el asistente al confirmar un
 * comprobante, pero sin pasar por la lectura con IA. Al elegir la Empresa
 * trae su estado de cuenta para prellenar el monto con el precio del plan
 * y mostrar qué mes va a cubrir el pago antes de guardar.
 */
@Component({
  selector: 'app-registrar-pago-panel',
  standalone: true,
  imports: [FormsModule, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './registrar-pago-panel.component.html',
})
export class RegistrarPagoPanelComponent {
  private readonly facturacion = inject(FacturacionService);
  private readonly empresas = inject(EmpresaService);
  private readonly upload = inject(UploadService);
  private readonly alertas = inject(AlertaService);

  readonly cerrar = output<void>();
  /** Id del pago creado. */
  readonly registrado = output<number>();
  /** Justo antes de mandar el POST — la página silencia el eco en vivo de
   *  esta misma escritura (el socket puede llegar antes que la respuesta). */
  readonly enviando = output<void>();

  protected readonly i = { cerrar: IconX, buscar: IconSearch, ok: IconCheck, archivo: IconFileUpload, info: IconInfoCircle };
  protected readonly metodos = METODOS_PAGO;
  protected readonly formatMonto = formatMonto;
  protected readonly formatFecha = formatFecha;
  protected readonly hoy = fechaIso(new Date());

  // Empresa
  protected readonly busqueda = signal('');
  protected readonly resultados = signal<Empresa[]>([]);
  protected readonly buscando = signal(false);
  protected readonly empresa = signal<Empresa | null>(null);
  protected readonly cuenta = signal<EstadoCuenta | null>(null);
  private readonly buscar$ = new Subject<string>();

  // Pago
  protected readonly monto = signal<number | null>(null);
  protected readonly moneda = signal<MonedaPago>('COP');
  protected readonly fecha = signal(this.hoy);
  protected readonly metodo = signal<MetodoPago>('transferencia');
  protected readonly referencia = signal('');
  protected readonly entidad = signal('');
  protected readonly notas = signal('');
  protected readonly archivo = signal<File | null>(null);

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Una Empresa solo recibe pagos con suscripción activa o vencida. */
  protected readonly bloqueo = computed(() => {
    const c = this.cuenta();
    if (!c) return null;
    const s = c.suscripcion;
    if (!s) return 'Esta Empresa no tiene suscripción: primero hay que activar su alta.';
    if (s.estado === 'pendiente') return 'El alta de esta Empresa todavía no se activó.';
    if (s.estado === 'cancelada') return 'La suscripción está cancelada: se reabre con un cambio de plan desde Suscripciones.';
    return null;
  });

  protected readonly vistaPrevia = computed(() => {
    const c = this.cuenta();
    if (!c || this.bloqueo()) return null;
    const p = periodoEstimado(c, this.fechaPago());
    if (!p) return null;
    // Lo que debe por mes: plan + extras (cargos recurrentes).
    const cuota = c.cuotaMensual?.total ?? c.suscripcion?.plan?.precioMensual ?? null;
    const monto = this.monto();
    const diferencia = cuota != null && this.moneda() === 'COP' && monto != null && monto !== cuota ? monto - cuota : null;
    const vence = c.suscripcion?.fechaProximoVencimiento ?? null;
    return {
      periodo: formatPeriodo(p.desde.toISOString(), p.hasta.toISOString()),
      reactiva: c.suscripcion?.estado === 'vencida',
      // Activa pero con el vencimiento ya pasado: el mes nuevo arranca en la
      // fecha del pago, no donde venció (los días en mora no se cobran).
      enMoraDesde: c.suscripcion?.estado === 'activa' && vence && new Date(vence) <= this.fechaPago() ? formatFecha(vence) : null,
      // El pago liquida el cobro pendiente más viejo (o crea uno ya pagado).
      cobro: c.cobros.filter((x) => x.estado === 'pendiente').at(-1) ?? null,
      diferencia,
      precioPlan: cuota,
      conExtras: (c.cuotaMensual?.detalle.length ?? 0) > 1,
    };
  });

  protected readonly puedeGuardar = computed(
    () =>
      !!this.empresa() &&
      !!this.cuenta() &&
      !this.bloqueo() &&
      (this.monto() ?? 0) > 0 &&
      !!this.fecha() &&
      this.fecha() <= this.hoy &&
      !this.guardando(),
  );

  constructor() {
    this.buscar$
      .pipe(
        debounceTime(250),
        switchMap((texto) => {
          if (!texto.trim()) return of(null);
          this.buscando.set(true);
          return this.empresas.listar({ buscar: texto.trim() });
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (r) => {
          this.resultados.set(r ? r.data.slice(0, 6) : []);
          this.buscando.set(false);
        },
        error: () => this.buscando.set(false),
      });
  }

  protected escribir(texto: string): void {
    this.busqueda.set(texto);
    this.buscar$.next(texto);
  }

  protected elegir(e: Empresa): void {
    this.empresa.set(e);
    this.resultados.set([]);
    this.cuenta.set(null);
    this.error.set(null);
    this.facturacion.estadoCuenta(e.id).subscribe({
      next: (c) => {
        this.cuenta.set(c);
        const cuota = c.cuotaMensual?.total ?? c.suscripcion?.plan?.precioMensual;
        if (this.monto() === null && cuota != null && cuota > 0) this.monto.set(cuota);
      },
      error: (err) => this.error.set(mensajeDeError(err, 'No se pudo cargar el estado de cuenta de la Empresa.')),
    });
  }

  protected cambiarEmpresa(): void {
    this.empresa.set(null);
    this.cuenta.set(null);
    this.monto.set(null);
    this.busqueda.set('');
  }

  protected elegirArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.archivo.set(input.files?.[0] ?? null);
    input.value = '';
  }

  protected guardar(): void {
    const empresa = this.empresa();
    if (!empresa || !this.puedeGuardar()) return;
    this.guardando.set(true);
    this.error.set(null);
    this.enviando.emit();

    const subir$: Observable<{ url: string } | null> = this.archivo() ? this.upload.subir(this.archivo()!) : of(null);
    const registro$ = subir$.pipe(
      switchMap((subido) =>
        this.facturacion.registrar({
          empresaId: empresa.id,
          monto: this.monto()!,
          moneda: this.moneda(),
          fechaPago: this.fechaPago().toISOString(),
          metodo: this.metodo(),
          referencia: this.referencia().trim() || undefined,
          entidadBancaria: this.entidad().trim() || undefined,
          notas: this.notas().trim() || undefined,
          archivoUrl: subido?.url,
        }),
      ),
    );

    this.alertas
      .seguir(registro$, {
        titulo: 'Registrando el pago',
        texto: `${empresa.nombre} · ${formatMonto(this.monto()!, this.moneda())}`,
        exito: { titulo: 'Pago registrado', texto: `${empresa.nombre} · la suscripción se renovó un mes` },
        error: { titulo: 'No se pudo registrar', texto: 'Revisa el detalle en el panel.' },
      })
      .subscribe({
        next: (pago: PagoRegistrado) => {
          this.guardando.set(false);
          if (pago.diferenciaConPlan) {
            const d = pago.diferenciaConPlan;
            this.alertas.mostrar({
              estado: 'warning',
              titulo: 'El monto no coincide con la cuota',
              texto: `Se registró ${formatMonto(pago.monto)} y la cuota del mes (plan + extras) es ${formatMonto(d.precioPlan)} (${d.diferencia > 0 ? '+' : ''}${formatMonto(d.diferencia)}).`,
            });
          }
          this.registrado.emit(pago.id);
        },
        error: (err) => {
          this.guardando.set(false);
          this.error.set(mensajeDeError(err));
        },
      });
  }

  /** Hoy → el momento actual; otra fecha → mediodía local (sin corrimiento por huso). */
  private fechaPago(): Date {
    return this.fecha() === this.hoy ? new Date() : new Date(`${this.fecha()}T12:00:00`);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cerrar.emit();
  }
}
