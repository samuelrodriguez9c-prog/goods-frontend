import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IconBuildingBank,
  IconCash,
  IconChevronLeft,
  IconChevronRight,
  IconBrandPaypal,
  IconCreditCard,
  IconDownload,
  IconPlus,
  IconReceipt2,
  IconSearch,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { Subject, debounceTime, forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { descargarRespuesta } from '../../../../core/http/descarga';
import { CambiosEnVivoService } from '../../../../core/realtime/cambios-en-vivo.service';
import {
  FacturacionService,
  fechaIso,
  formatFecha,
  formatMonto,
  formatPeriodo,
  mesCorto,
} from '../../../../core/facturacion/facturacion.service';
import {
  EstadoPago,
  ListadoPagos,
  METODOS_PAGO,
  MetodoPago,
  PagoResumen,
  ResumenFacturacion,
  TotalesPorMoneda,
} from '../../../../core/facturacion/models/facturacion.model';
import { AvisoDatosNuevosComponent } from '../../../../shared/ui/aviso-datos-nuevos/aviso-datos-nuevos.component';
import {
  CabeceraModuloComponent,
  MetricaCabecera,
} from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { filasCambiadas } from '../../../../shared/ui/filas-cambiadas';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { EstadoCuentaPanelComponent } from '../estado-cuenta-panel/estado-cuenta-panel.component';
import { PagoDetallePanelComponent } from '../pago-detalle-panel/pago-detalle-panel.component';
import { RegistrarPagoPanelComponent } from '../registrar-pago-panel/registrar-pago-panel.component';

type Periodo = 'mes' | 'anterior' | '90' | 'todo';
type FiltroEstado = EstadoPago | 'todos';

const PERIODOS: { clave: Periodo; texto: string }[] = [
  { clave: 'mes', texto: 'Este mes' },
  { clave: 'anterior', texto: 'Mes anterior' },
  { clave: '90', texto: 'Últimos 90 días' },
  { clave: 'todo', texto: 'Todo' },
];

const ICONO_METODO: Record<MetodoPago, typeof IconCash> = {
  transferencia: IconBuildingBank,
  deposito: IconBuildingBank,
  efectivo: IconCash,
  paypal: IconBrandPaypal,
  otro: IconCreditCard,
};

const PAGE_SIZE = 20;

/**
 * Facturación — historial de pagos de las Empresas a Goods (§7.2 de
 * PIVOTE_SAAS_MULTITENANT.md, 2026-10-02). Contraparte de `FacturacionModule`
 * del backend.
 *
 * - **Cabecera**: cobranza del mes (vs. el anterior) y cartera (por vencer,
 *   en mora, vencidas) desde `GET /facturacion/resumen`. Las de cartera son
 *   suscripciones, no pagos: al tocarlas se va a Suscripciones.
 * - **Listado**: una fila por pago, filtros server-side (período, estado,
 *   método, búsqueda por referencia o Empresa) y totales del filtro.
 * - **Tres paneles laterales**, cada uno su componente (mismo criterio que
 *   Suscripciones/Empresas): detalle del pago (con anular), estado de cuenta
 *   de una Empresa y registrar un pago.
 */
@Component({
  selector: 'app-facturacion-page',
  standalone: true,
  imports: [
    FormsModule,
    TablerIconComponent,
    CabeceraModuloComponent,
    PantallaEstadoComponent,
    AvisoDatosNuevosComponent,
    PagoDetallePanelComponent,
    EstadoCuentaPanelComponent,
    RegistrarPagoPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './facturacion-page.component.html',
})
export class FacturacionPageComponent {
  private readonly facturacion = inject(FacturacionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cambiosEnVivoService = inject(CambiosEnVivoService);

  protected readonly i = {
    modulo: IconReceipt2, nuevo: IconPlus, buscar: IconSearch, limpiar: IconX,
    anterior: IconChevronLeft, siguiente: IconChevronRight, descargar: IconDownload,
  };
  protected readonly periodos = PERIODOS;
  protected readonly estados: { valor: FiltroEstado; texto: string }[] = [
    { valor: 'valido', texto: 'Válidos' },
    { valor: 'anulado', texto: 'Anulados' },
    { valor: 'todos', texto: 'Todos' },
  ];
  protected readonly metodos = METODOS_PAGO;
  protected readonly skeletons = [0, 1, 2, 3, 4, 5];
  protected readonly formatMonto = formatMonto;
  protected readonly formatFecha = formatFecha;
  protected readonly formatPeriodo = formatPeriodo;

  protected readonly puedeGestionar = computed(() =>
    (this.auth.currentUser()?.permisos ?? []).includes('facturacion.gestionar'),
  );

  // ── Estado ─────────────────────────────────────────────────────────────
  protected readonly cargando = signal(true);
  protected readonly cargandoLista = signal(false);
  protected readonly exportando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  protected readonly resumen = signal<ResumenFacturacion | null>(null);
  protected readonly listado = signal<ListadoPagos | null>(null);

  protected readonly periodo = signal<Periodo>('mes');
  protected readonly estado = signal<FiltroEstado>('valido');
  protected readonly metodo = signal<MetodoPago | ''>('');
  protected readonly buscar = signal('');
  protected readonly pagina = signal(1);
  private readonly buscar$ = new Subject<string>();

  /** Paneles: uno a la vez. */
  protected readonly pagoAbiertoId = signal<number | null>(null);
  protected readonly empresaAbiertaId = signal<number | null>(null);
  protected readonly registrando = signal(false);

  protected readonly cambiosEnVivo = signal(0);
  protected readonly resaltadas = signal<ReadonlySet<number>>(new Set());
  private compararAlCargar = false;
  /** Después de una escritura propia (registrar/anular) la pantalla ya se
   *  recargó sola: el `datos:cambio` que llega por el socket es el eco de
   *  esa misma acción y no merece la píldora "1 cambio nuevo". */
  private ignorarCambiosHasta = 0;

  // ── Derivados ──────────────────────────────────────────────────────────
  protected readonly filas = computed(() =>
    (this.listado()?.data ?? []).map((p) => ({
      ...p,
      dia: new Date(p.fechaPago).getDate(),
      mes: mesCorto(p.fechaPago),
      icono: ICONO_METODO[p.metodo],
      metodoTexto: METODOS_PAGO.find((m) => m.valor === p.metodo)?.texto ?? p.metodo,
      origen: [p.referencia ? `Ref. ${p.referencia}` : null, p.entidadBancaria].filter(Boolean).join(' · '),
    })),
  );

  protected readonly rango = computed(() => {
    const l = this.listado();
    if (!l || !l.total) return '';
    const desde = (l.page - 1) * l.pageSize + 1;
    return `${desde}–${Math.min(l.page * l.pageSize, l.total)} de ${l.total}`;
  });

  protected readonly totalesTexto = computed(() => {
    const t = this.listado()?.totales;
    if (!t || !t.pagos) return 'Sin pagos válidos en este filtro';
    return `${t.pagos} ${t.pagos === 1 ? 'pago válido' : 'pagos válidos'} · ${this.montos(t.monto)}`;
  });

  protected readonly hayFiltros = computed(
    () => this.periodo() !== 'mes' || this.estado() !== 'valido' || !!this.metodo() || !!this.buscar().trim(),
  );

  protected readonly metricas = computed<MetricaCabecera[]>(() => {
    const r = this.resumen();
    if (!r) return [];
    const actual = r.mesActual.cobrado.COP;
    const anterior = r.mesAnterior.cobrado.COP;
    const variacion = anterior ? Math.round(((actual - anterior) / anterior) * 100) : null;
    return [
      {
        id: 'cobrado',
        etiqueta: 'Cobrado este mes',
        valor: formatMonto(actual),
        tono: 'exito',
        delta:
          variacion === null
            ? r.mesActual.cobrado.USD ? `+ ${formatMonto(r.mesActual.cobrado.USD, 'USD')}` : 'sin cobros el mes anterior'
            : `${variacion >= 0 ? '+' : ''}${variacion}% vs. ${formatMonto(anterior)}`,
        deltaTono: variacion !== null && variacion < 0 ? 'peligro' : undefined,
        titulo: 'Pagos válidos en COP con fecha de pago en este mes',
      },
      {
        id: 'porCobrar',
        etiqueta: 'Por cobrar',
        valor: formatMonto(r.porCobrar.monto),
        tono: r.porCobrar.atrasados ? 'peligro' : r.porCobrar.cobros ? 'aviso' : 'apagado',
        delta: r.porCobrar.cobros
          ? `${r.porCobrar.cobros} ${r.porCobrar.cobros === 1 ? 'cobro' : 'cobros'}${r.porCobrar.atrasados ? ` · ${r.porCobrar.atrasados} atrasado${r.porCobrar.atrasados === 1 ? '' : 's'}` : ''}`
          : 'nada pendiente',
        deltaTono: r.porCobrar.atrasados ? 'peligro' : undefined,
        titulo: 'Cobros generados automáticamente 7 días antes de cada renovación que todavía no tienen pago',
      },
      {
        id: 'porVencer',
        etiqueta: 'Por vencer · 7 días',
        valor: r.cartera.porVencer7Dias,
        tono: r.cartera.porVencer7Dias ? 'aviso' : 'apagado',
        delta: r.cartera.porVencer7Dias ? 'a cobrar esta semana' : null,
        deltaTono: 'aviso',
        titulo: 'Suscripciones activas que vencen en los próximos 7 días',
      },
      {
        id: 'mora',
        etiqueta: 'En mora',
        valor: r.cartera.enMora,
        tono: r.cartera.enMora ? 'peligro' : 'apagado',
        delta: r.cartera.enMora ? 'activas con el vencimiento pasado' : null,
        deltaTono: 'peligro',
        titulo: 'Suscripciones activas cuyo vencimiento ya pasó: siguen con acceso',
      },
      {
        id: 'vencidas',
        etiqueta: 'Vencidas',
        valor: r.cartera.vencidas,
        tono: r.cartera.vencidas ? 'peligro' : 'apagado',
        delta: r.cartera.vencidas ? 'sin acceso' : null,
        deltaTono: 'peligro',
      },
    ];
  });

  protected readonly badge = computed(() => {
    const r = this.resumen();
    return r ? `${r.mesActual.pagos} ${r.mesActual.pagos === 1 ? 'pago' : 'pagos'} este mes` : '';
  });

  protected readonly lectura = computed(() => {
    const r = this.resumen();
    if (!r) return '';
    const { porVencer7Dias, enMora, vencidas } = r.cartera;
    const cobrado = r.mesActual.pagos
      ? `Este mes se cobraron ${this.montos(r.mesActual.cobrado)} en ${r.mesActual.pagos} ${r.mesActual.pagos === 1 ? 'pago' : 'pagos'}.`
      : 'Todavía no hay pagos registrados este mes.';
    const atencion: string[] = [];
    if (enMora) atencion.push(`${enMora} ${enMora === 1 ? 'Empresa está' : 'Empresas están'} en mora`);
    if (porVencer7Dias) atencion.push(`${porVencer7Dias} ${porVencer7Dias === 1 ? 'vence' : 'vencen'} esta semana`);
    if (vencidas) atencion.push(`${vencidas} ${vencidas === 1 ? 'está vencida' : 'están vencidas'}`);
    return `${cobrado} ${atencion.length ? atencion.join(', ') + '.' : 'Ninguna Empresa en mora ni por vencer esta semana.'}`;
  });

  constructor() {
    this.cargar();
    this.buscar$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.irAPagina(1));
    this.cambiosEnVivoService
      .huboCambio(['facturacion', 'suscripcion'])
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (Date.now() > this.ignorarCambiosHasta) this.cambiosEnVivo.update((n) => n + 1);
      });
  }

  // ── Carga ──────────────────────────────────────────────────────────────
  protected cargar(): void {
    this.cargando.set(!this.listado());
    this.error.set(null);
    forkJoin({ resumen: this.facturacion.resumen(), listado: this.facturacion.listar(this.filtro()) }).subscribe({
      next: ({ resumen, listado }) => {
        this.resaltarCambios(listado);
        this.resumen.set(resumen);
        this.listado.set(listado);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la facturación. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  /** Solo la lista (cambio de filtro o de página): la cabecera no cambia. */
  private cargarLista(): void {
    this.cargandoLista.set(true);
    this.facturacion.listar(this.filtro()).subscribe({
      next: (listado) => {
        this.listado.set(listado);
        this.cargandoLista.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la facturación. Intenta de nuevo.');
        this.cargandoLista.set(false);
      },
    });
  }

  private filtro() {
    const hoy = new Date();
    const rango: Record<Periodo, { desde?: string; hasta?: string }> = {
      mes: { desde: fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)) },
      anterior: {
        desde: fechaIso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
        hasta: fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
      },
      '90': { desde: fechaIso(new Date(hoy.getTime() - 90 * 86_400_000)) },
      todo: {},
    };
    return {
      page: this.pagina(),
      pageSize: PAGE_SIZE,
      ...rango[this.periodo()],
      estado: this.estado() === 'todos' ? undefined : (this.estado() as EstadoPago),
      metodo: this.metodo() || undefined,
      buscar: this.buscar().trim() || undefined,
    };
  }

  /** Los pagos del filtro actual, todas las páginas, en CSV. */
  protected exportar(): void {
    this.exportando.set(true);
    this.facturacion.exportar(this.filtro()).subscribe({
      next: (res) => {
        descargarRespuesta(res, 'goods-pagos.csv');
        this.exportando.set(false);
      },
      error: () => this.exportando.set(false),
    });
  }

  // ── Filtros ────────────────────────────────────────────────────────────
  protected elegirPeriodo(p: Periodo): void {
    this.periodo.set(p);
    this.irAPagina(1);
  }

  protected elegirEstado(e: FiltroEstado): void {
    this.estado.set(e);
    this.irAPagina(1);
  }

  protected elegirMetodo(m: MetodoPago | ''): void {
    this.metodo.set(m);
    this.irAPagina(1);
  }

  protected escribirBusqueda(texto: string): void {
    this.buscar.set(texto);
    this.buscar$.next(texto);
  }

  protected limpiarFiltros(): void {
    this.periodo.set('mes');
    this.estado.set('valido');
    this.metodo.set('');
    this.buscar.set('');
    this.irAPagina(1);
  }

  protected irAPagina(n: number): void {
    this.pagina.set(n);
    this.cargarLista();
  }

  protected metricaClick(id: string): void {
    if (id === 'cobrado') {
      this.periodo.set('mes');
      this.estado.set('valido');
      this.irAPagina(1);
    } else {
      this.router.navigateByUrl('/suscripciones');
    }
  }

  // ── Paneles ────────────────────────────────────────────────────────────
  protected abrirPago(id: number): void {
    this.empresaAbiertaId.set(null);
    this.pagoAbiertoId.set(id);
  }

  protected abrirEmpresa(id: number, evento?: Event): void {
    evento?.stopPropagation();
    this.pagoAbiertoId.set(null);
    this.empresaAbiertaId.set(id);
  }

  /** Una escritura propia está en camino: silenciar su eco en vivo. */
  protected silenciarEco(): void {
    this.ignorarCambiosHasta = Date.now() + 15_000;
  }

  /** Registrar/anular cambia cabecera y lista: se recarga todo. */
  protected onCambio(): void {
    this.ignorarCambiosHasta = Date.now() + 3000;
    this.cargar();
  }

  protected onRegistrado(pagoId: number): void {
    this.registrando.set(false);
    this.ignorarCambiosHasta = Date.now() + 3000;
    this.compararAlCargar = true;
    this.cargar();
    this.pagoAbiertoId.set(pagoId);
  }

  // ── Cambios en vivo ────────────────────────────────────────────────────
  protected actualizarPorCambioEnVivo(): void {
    this.cambiosEnVivo.set(0);
    this.compararAlCargar = true;
    this.cargar();
  }

  private resaltarCambios(nuevo: ListadoPagos): void {
    if (!this.compararAlCargar) return;
    this.compararAlCargar = false;
    this.resaltadas.set(filasCambiadas<PagoResumen, number>(this.listado()?.data ?? [], nuevo.data, (p) => p.id));
    setTimeout(() => this.resaltadas.set(new Set()), 2000);
  }

  // ── Pantalla de estado ─────────────────────────────────────────────────
  protected reintentar(): void {
    this.cargar();
  }

  protected volver(): void {
    this.router.navigateByUrl('/');
  }

  private montos(t: TotalesPorMoneda): string {
    const partes = [];
    if (t.COP || !t.USD) partes.push(formatMonto(t.COP));
    if (t.USD) partes.push(formatMonto(t.USD, 'USD'));
    return partes.join(' + ');
  }
}
