import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import {
  IconAlertCircle,
  IconBan,
  IconBrandPaypal,
  IconBuildingBank,
  IconCalendar,
  IconCalendarEvent,
  IconCash,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconDots,
  IconExternalLink,
  IconHash,
  IconHistory,
  IconPlus,
  IconReceipt2,
  IconSortDescending,
  IconSortDescending2,
  IconUser,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { FacturacionService, mensajeDeError } from '../../../../core/facturacion/facturacion.service';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PistaService } from '../../../../core/ui/pista.service';
import { CambiosEnVivoService } from '../../../../core/realtime/cambios-en-vivo.service';
import { Empresa } from '../../../../core/catalog/models/empresa.model';
import { EstadoCuenta, METODOS_PAGO, MetodoPago, PagoDetalle, PagoResumen, ResumenFacturacion } from '../../../../core/facturacion/models/facturacion.model';
import { CabeceraModuloComponent, MetricaCabecera, serieConteo } from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { ListaHojaComponent } from '../../../../shared/ui/lista-hoja/lista-hoja.component';
import { HojaPestanasComponent } from '../../../../shared/ui/lista-hoja/hoja-pestanas.component';
import { FilaLista, GrupoLista, PestanaHoja } from '../../../../shared/ui/lista-hoja/lista-hoja.model';
import { MES_LARGO, corto, dias, fmt, fmtY, pl, plata } from '../../../../shared/ui/lista-hoja/formato';
import { filasCambiadas } from '../../../../shared/ui/filas-cambiadas';
import { TAMANO_PAGINA, traerTodo } from '../../../../shared/ui/lista-hoja/traer-todo';

type Grupo = 'actual' | 'anterior' | 'antes' | 'anulados';
type Filtro = 'cob' | 'deuda' | 'parc' | 'anul';
type Pestana = 'cuenta' | 'pagos' | 'comp';

export const ICONO_METODO: Record<MetodoPago, typeof IconCash> = {
  transferencia: IconBuildingBank, deposito: IconBuildingBank, efectivo: IconCash, paypal: IconBrandPaypal, otro: IconDots,
};
const TEXTO_METODO = Object.fromEntries(METODOS_PAGO.map((m) => [m.valor, m.texto])) as Record<MetodoPago, string>;

/** `fecha` + `n` meses con `setMonth`, igual que `sumarUnMes` del backend (fechas.util.ts). */
const sumarMeses = (fecha: Date, n: number) => {
  const r = new Date(fecha);
  r.setMonth(r.getMonth() + n);
  return r;
};

/**
 * Meses que cubre un pago según su período (los pagos viejos sin período:
 * null). Cuenta meses de calendario, como avanza el período el backend:
 * dividir los días por 30,4 marcaba como "parcial" (92 %) un mes completo
 * de febrero.
 */
const mesesDe = (p: PagoResumen) => {
  if (!p.periodoDesde || !p.periodoHasta) return null;
  const a = new Date(p.periodoDesde);
  const b = new Date(p.periodoHasta).getTime();
  let m = 0;
  while (m < 120 && sumarMeses(a, m + 1).getTime() <= b) m++;
  const ini = sumarMeses(a, m).getTime();
  const resto = (b - ini) / (sumarMeses(a, m + 1).getTime() - ini);
  return Math.max(0.05, m + resto);
};
const mesesTxt = (m: number | null) => (m === null ? '—' : m >= 0.95 ? `${pl(Math.round(m * 10) / 10, 'mes', 'meses')}`.replace('.', ',') : `${Math.round(m * 100)}%`);

/**
 * Facturación — pagos + cuenta (diseño `Facturación - Pagos y cuenta`).
 *
 * Lista: `listar({ pageSize: 100 })`, agrupada por mes de `fechaPago`.
 * Hoja: `obtener(id)` (detalle + `anulable`) y `estadoCuenta(empresaId)`
 * (saldo, cuota, cargos, cobros, pagos de la Empresa).
 * "Registrar pago" reemplaza la hoja (sin modal) → `registrar()`.
 */
@Component({
  selector: 'app-facturacion-page',
  standalone: true,
  imports: [DatePipe, TablerIconComponent, CabeceraModuloComponent, PantallaEstadoComponent, ListaHojaComponent, HojaPestanasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './facturacion-page.component.html',
  host: { class: 'flex h-full flex-col overflow-hidden px-6 pt-6' },
})
export class FacturacionPageComponent {
  private readonly facturacion = inject(FacturacionService);
  private readonly empresaService = inject(EmpresaService);
  private readonly alertas = inject(AlertaService);
  private readonly pista = inject(PistaService);
  private readonly router = inject(Router);

  protected readonly lista = viewChild(ListaHojaComponent);
  protected readonly hoy = new Date();
  protected readonly plata = plata;
  protected readonly metodos = METODOS_PAGO;
  protected readonly iconoMetodo = ICONO_METODO;
  protected readonly textoMetodo = TEXTO_METODO;
  protected readonly i = {
    modulo: IconReceipt2, arriba: IconChevronUp, abajo: IconChevronDown, mas: IconPlus, hash: IconHash, check: IconCheck, usuario: IconUser,
    alerta: IconAlertCircle, ok: IconCircleCheck, ban: IconBan, x: IconX, externo: IconExternalLink,
  };

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed(() => (this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo'));

  protected readonly pagos = signal<PagoResumen[]>([]);
  protected readonly resumen = signal<ResumenFacturacion | null>(null);
  protected readonly empresas = signal<Empresa[]>([]);
  protected readonly buscar = signal('');
  protected readonly filtro = signal<Filtro | null>(null);
  protected readonly orden = signal<'fecha' | 'monto'>('fecha');
  protected readonly colapsados = signal<ReadonlySet<string>>(new Set(['antes']));
  protected readonly seleccionadaId = signal<number | null>(null);
  protected readonly cambiosEnVivo = signal(0);
  protected readonly resaltadas = signal<ReadonlySet<number>>(new Set());
  private compararAlCargar = false;

  // Hoja
  protected readonly modo = signal<'pago' | 'nuevo'>('pago');
  protected readonly pestana = signal<Pestana>('cuenta');
  protected readonly detalle = signal<PagoDetalle | null>(null);
  protected readonly cuenta = signal<EstadoCuenta | null>(null);
  protected readonly pop = signal(false);
  protected readonly motivo = signal('');
  protected readonly copiado = signal(false);
  protected readonly formExtra = signal<{ concepto: string; monto: string } | null>(null);
  protected readonly bajaCargo = signal<{ id: number; motivo: string } | null>(null);
  protected readonly nuevo = signal<{ empresaId: number; metodo: MetodoPago; ref: string; monto: string; fecha: string } | null>(null);
  protected readonly cuentaNuevo = signal<EstadoCuenta | null>(null);

  /**
   * Más de 100 pagos (2026-10-07): los dos meses recientes se traen
   * completos; "Anteriores" de a 100 con "Cargar más" (crece sin tope con
   * el tiempo). Buscar con 2 letras o más consulta al servidor, así
   * encuentra también pagos viejos que no están cargados.
   */
  private readonly desdeRecientes = (() => {
    const h = new Date();
    const d = new Date(h.getFullYear(), h.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();
  private readonly hastaAnteriores = (() => {
    const d = new Date(`${this.desdeRecientes}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  protected readonly anterioresTotal = signal(0);
  private anterioresPagina = 1;
  protected readonly cargandoAnteriores = signal(false);
  /** Resultado de buscar en el servidor (`null` = sin búsqueda). */
  protected readonly busqueda = signal<PagoResumen[] | null>(null);
  private busquedaTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly sel = computed(
    () => [...(this.busqueda() ?? []), ...this.pagos()].find((p) => p.id === this.seleccionadaId()) ?? null,
  );

  private readonly mesActual = computed(() => this.resumen()?.mesActual.desde.slice(0, 7) ?? new Date().toISOString().slice(0, 7));
  private readonly mesAnterior = computed(() => this.resumen()?.mesAnterior.desde.slice(0, 7) ?? '');
  private readonly deudoras = computed(() => new Set(this.empresas().filter((e) => e.acceso?.estado !== 'ok' && e.estado === 'activa').map((e) => e.id)));

  private grupoDe(p: PagoResumen): Grupo {
    if (p.estado === 'anulado') return 'anulados';
    const m = p.fechaPago.slice(0, 7);
    return m === this.mesActual() ? 'actual' : m === this.mesAnterior() ? 'anterior' : 'antes';
  }
  private esParcial = (p: PagoResumen) => { const m = mesesDe(p); return m !== null && m < 0.95; };

  private readonly filtrados = computed(() => {
    const term = this.buscar().trim().toLowerCase();
    const F: Record<Filtro, (p: PagoResumen) => boolean> = {
      cob: (p) => p.estado === 'valido' && p.fechaPago.startsWith(this.mesActual()),
      deuda: (p) => this.deudoras().has(p.empresaId),
      parc: (p) => p.estado === 'valido' && this.esParcial(p),
      anul: (p) => p.estado === 'anulado',
    };
    const f = this.filtro();
    const enServidor = this.busqueda();
    if (enServidor) return enServidor.filter((p) => !f || F[f](p));
    return this.pagos().filter((p) => (!f || F[f](p)) && (!term || `${p.referencia ?? ''} ${p.empresaNombre} ${p.id}`.toLowerCase().includes(term)));
  });

  protected readonly grupos = computed<GrupoLista[]>(() => {
    const nombreMes = (m: string) => (m ? MES_LARGO[+m.slice(5) - 1].replace(/^./, (c) => c.toUpperCase()) : '');
    const META: Record<Grupo, Omit<GrupoLista, 'clave' | 'sub' | 'filas'>> = {
      actual: { titulo: nombreMes(this.mesActual()), icono: IconCalendarEvent, color: '#087b5d', fondo: '#d5f5e3' },
      anterior: { titulo: nombreMes(this.mesAnterior()), icono: IconCalendar, color: '#4b5563', fondo: '#e3e3e3' },
      antes: { titulo: 'Anteriores', icono: IconHistory, color: '#6b7280', fondo: '#e3e3e3' },
      anulados: { titulo: 'Anulados', icono: IconBan, color: '#b42318', fondo: '#fde2dd' },
    };
    const ord = (a: PagoResumen, b: PagoResumen) => (this.orden() === 'monto' ? b.monto - a.monto : 0) || (a.fechaPago < b.fechaPago ? 1 : a.fechaPago > b.fechaPago ? -1 : b.id - a.id);
    return (['actual', 'anterior', 'antes', 'anulados'] as Grupo[])
      .map((k) => {
        const l = [...this.filtrados().filter((p) => this.grupoDe(p) === k)].sort(ord);
        const t = l.reduce((s, p) => s + p.monto, 0);
        const parc = l.filter(this.esParcial).length;
        const sub = k === 'anulados' ? `${plata(t)} devueltos al saldo` : `${plata(t)} cobrados${parc ? ` · ${pl(parc, 'parcial', 'parciales')}` : ''}`;
        const cargados = this.pagos().filter((p) => p.fechaPago.slice(0, 10) < this.desdeRecientes).length;
        const faltan = k === 'antes' && !this.busqueda() ? this.anterioresTotal() - cargados : 0;
        const mas = faltan > 0 ? `Cargar ${Math.min(TAMANO_PAGINA, faltan)} más · ${pl(faltan, 'pago sin cargar', 'pagos sin cargar')}` : null;
        return { clave: k, ...META[k], sub, filas: l.map((p) => this.fila(p)), mas, cargandoMas: k === 'antes' && this.cargandoAnteriores() };
      })
      .filter((g) => g.filas.length || g.mas);
  });

  private fila(p: PagoResumen): FilaLista {
    const m = mesesDe(p);
    const an = p.estado === 'anulado';
    const parc = this.esParcial(p);
    return {
      id: p.id, nombre: p.empresaNombre, sub: `${plata(p.monto)} · ${TEXTO_METODO[p.metodo]} · ${fmt(p.fechaPago)}`,
      punto: an ? '#8a8a8a' : parc ? '#b07400' : '#087b5d',
      gauge: an ? { texto: 'Anulado', ancho: null, color: '', tinta: '#9ca3af' } : { texto: mesesTxt(m), ancho: m === null ? null : Math.min(100, m * 50), color: parc ? '#b07400' : '#303030', tinta: parc ? '#b45309' : '#374151' },
    };
  }

  protected readonly cobradoMes = computed(() => this.resumen()?.mesActual.cobrado.COP ?? 0);
  protected readonly badge = computed(() => `${plata(this.cobradoMes())} en ${MES_LARGO[+this.mesActual().slice(5) - 1].slice(0, 3)}`);
  protected readonly lectura = computed(() => {
    const r = this.resumen();
    if (!r) return '';
    const mes = MES_LARGO[+this.mesActual().slice(5) - 1];
    return `En ${mes} entraron ${plata(r.mesActual.cobrado.COP)} en ${pl(r.mesActual.pagos, 'pago', 'pagos')}. ` +
      (r.porCobrar.cobros ? `Quedan ${pl(r.porCobrar.cobros, 'cobro', 'cobros')} por ${plata(r.porCobrar.monto)}${r.porCobrar.atrasados ? `, ${r.porCobrar.atrasados} ya atrasados` : ''}.` : 'No hay nada por cobrar.') +
      (r.cartera.porVencer7Dias ? ` ${pl(r.cartera.porVencer7Dias, 'vence', 'vencen')} en los próximos 7 días.` : '');
  });

  protected readonly metricas = computed<MetricaCabecera[]>(() => {
    const r = this.resumen();
    const validos = this.pagos().filter((p) => p.estado === 'valido');
    const delta = r && r.mesAnterior.cobrado.COP ? Math.round(((r.mesActual.cobrado.COP - r.mesAnterior.cobrado.COP) / r.mesAnterior.cobrado.COP) * 100) : null;
    return [
      { id: 'cob', etiqueta: 'Cobrado en el mes', valor: corto(this.cobradoMes()), tono: 'exito', trazo: '#064e3b', serie: serieConteo(validos.map((p) => p.fechaPago), 8, 24 * 7), delta: delta !== null ? `${delta >= 0 ? '+' : ''}${delta}% vs. mes anterior` : null },
      { id: 'deuda', etiqueta: 'Por cobrar', valor: corto(r?.porCobrar.monto ?? 0), tono: r?.porCobrar.atrasados ? 'peligro' : 'neutro', delta: r ? pl(r.porCobrar.cobros, 'cobro', 'cobros') : null },
      { id: 'parc', etiqueta: 'Pagos parciales', valor: validos.filter(this.esParcial).length, tono: 'aviso', trazo: '#b07400' },
      { id: 'anul', etiqueta: 'Anulados', valor: this.pagos().filter((p) => p.estado === 'anulado').length, tono: 'apagado' },
    ];
  });

  protected readonly resultados = computed(() => pl(this.filtrados().length, 'pago', 'pagos'));
  protected readonly filtroTexto = computed(() => (this.filtro() ? { cob: 'Cobrado en el mes', deuda: 'Empresas que deben', parc: 'Parciales', anul: 'Anulados' }[this.filtro()!] : null));
  protected readonly ordenIcono = computed(() => (this.orden() === 'fecha' ? IconSortDescending : IconSortDescending2));
  protected readonly ordenTitulo = computed(() => (this.orden() === 'fecha' ? 'Ordenado por fecha · ordenar por monto' : 'Ordenado por monto · ordenar por fecha'));

  constructor() {
    this.cargar();
    inject(CambiosEnVivoService)
      .huboCambio(['facturacion', 'suscripcion'])
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cambiosEnVivo.update((n) => n + 1));
    effect(() => {
      const p = this.sel();
      untracked(() => this.cargarHoja(p));
    });
  }

  protected cargar(): void {
    this.cargando.set(this.pagos().length === 0);
    this.error.set(null);
    forkJoin({
      recientes: traerTodo((page, pageSize) => this.facturacion.listar({ desde: this.desdeRecientes, page, pageSize })),
      antes: this.facturacion.listar({ hasta: this.hastaAnteriores, page: 1, pageSize: TAMANO_PAGINA }),
      resumen: this.facturacion.resumen(),
      empresas: traerTodo((page) => this.empresaService.listar({ estado: 'activa', page })),
    }).subscribe({
      next: ({ recientes, antes, resumen, empresas }) => {
        const pagos = { data: [...recientes.data, ...antes.data.filter((a) => !recientes.data.some((r) => r.id === a.id))] };
        this.anterioresTotal.set(antes.total);
        this.anterioresPagina = 1;
        if (this.compararAlCargar) {
          this.compararAlCargar = false;
          this.resaltadas.set(filasCambiadas(this.pagos(), pagos.data, (p) => p.id));
          setTimeout(() => this.resaltadas.set(new Set()), 2000);
        }
        this.pagos.set(pagos.data);
        this.resumen.set(resumen);
        this.empresas.set(empresas.data);
        if (!this.sel()) this.seleccionadaId.set(this.grupos()[0]?.filas[0]?.id ?? null);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los pagos.');
        this.cargando.set(false);
      },
    });
  }

  /** "Cargar más" de Anteriores: la página siguiente, de la más reciente a la más vieja. */
  protected cargarMas(clave: string): void {
    if (clave !== 'antes' || this.cargandoAnteriores()) return;
    this.cargandoAnteriores.set(true);
    this.facturacion.listar({ hasta: this.hastaAnteriores, page: this.anterioresPagina + 1, pageSize: TAMANO_PAGINA }).subscribe({
      next: (r) => {
        this.anterioresPagina++;
        this.anterioresTotal.set(r.total);
        this.pagos.update((xs) => [...xs, ...r.data.filter((p) => !xs.some((x) => x.id === p.id))]);
        this.cargandoAnteriores.set(false);
      },
      error: () => {
        this.cargandoAnteriores.set(false);
        this.alertas.mostrar({ estado: 'error', titulo: 'No se pudieron cargar más pagos', texto: 'Intentá de nuevo.' });
      },
    });
  }

  /** Buscar (2+ letras) en el servidor, con una pausa corta mientras se escribe. */
  protected cambiarBusqueda(texto: string): void {
    this.buscar.set(texto);
    clearTimeout(this.busquedaTimer);
    const term = texto.trim();
    if (term.length < 2) {
      this.busqueda.set(null);
      return;
    }
    this.busquedaTimer = setTimeout(() => {
      traerTodo((page, pageSize) => this.facturacion.listar({ buscar: term, page, pageSize }), 1000).subscribe({
        next: (r) => {
          if (this.buscar().trim() === term) this.busqueda.set(r.data);
        },
        error: () => this.busqueda.set(null),
      });
    }, 300);
  }

  private cargarHoja(p: PagoResumen | null): void {
    this.pop.set(false);
    this.motivo.set('');
    this.formExtra.set(null);
    this.bajaCargo.set(null);
    if (!p) return;
    if (this.detalle()?.id !== p.id) this.detalle.set(null);
    const mismaEmpresa = this.cuenta()?.empresa.id === p.empresaId;
    forkJoin({
      detalle: this.facturacion.obtener(p.id),
      cuenta: mismaEmpresa ? of(this.cuenta()) : this.facturacion.estadoCuenta(p.empresaId).pipe(catchError(() => of(null))),
    }).subscribe(({ detalle, cuenta }) => {
      if (this.seleccionadaId() !== p.id) return;
      this.detalle.set(detalle);
      this.cuenta.set(cuenta);
    });
  }

  private recargarCuenta(empresaId: number): void {
    this.facturacion.estadoCuenta(empresaId).subscribe((c) => this.cuenta.set(c));
  }

  protected actualizar(): void {
    this.cambiosEnVivo.set(0);
    this.compararAlCargar = true;
    this.cargar();
  }
  protected seleccionar(id: number): void {
    this.modo.set('pago');
    this.seleccionadaId.set(id);
  }
  protected alternarMetrica(id: string): void {
    this.filtro.update((f) => (f === id ? null : (id as Filtro)));
  }
  protected alternarGrupo(c: string): void {
    this.colapsados.update((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  }
  protected alternarOrden(): void {
    this.orden.update((o) => (o === 'fecha' ? 'monto' : 'fecha'));
  }
  protected limpiar(): void {
    this.filtro.set(null);
    this.cambiarBusqueda('');
  }

  // ── Hoja del pago ─────────────────────────────────────────────────────

  protected readonly anulado = computed(() => this.sel()?.estado === 'anulado');
  protected readonly meses = computed(() => (this.sel() ? mesesDe(this.sel()!) : null));
  protected readonly parcial = computed(() => !!this.sel() && this.esParcial(this.sel()!));
  protected readonly estadoTexto = computed(() => (this.anulado() ? 'Anulado' : this.parcial() ? 'Parcial' : 'Conciliado'));
  protected readonly estadoPunto = computed(() => (this.anulado() ? '#8a8a8a' : this.parcial() ? '#b07400' : '#087b5d'));

  protected copiarRef(): void {
    const ref = this.sel()?.referencia;
    if (!ref) return;
    navigator.clipboard?.writeText(ref).catch(() => undefined);
    this.copiado.set(true);
    setTimeout(() => this.copiado.set(false), 1400);
  }

  /** Franja "Cubre": riel de 7 meses alrededor del pago con el período y la marca de hoy. */
  protected readonly cubre = computed(() => {
    const p = this.sel();
    if (!p) return null;
    const base = new Date(p.fechaPago);
    const w0 = new Date(base.getFullYear(), base.getMonth() - 3, 1).getTime();
    const w1 = new Date(base.getFullYear(), base.getMonth() + 4, 0).getTime();
    const pos = (iso: string | Date) => Math.max(0, Math.min(100, ((new Date(iso).getTime() - w0) / (w1 - w0)) * 100));
    const a = p.periodoDesde ? pos(p.periodoDesde) : null;
    const b = p.periodoHasta ? pos(p.periodoHasta) : null;
    const cuota = this.cuenta()?.cuotaMensual?.total ?? null;
    return {
      texto: this.anulado() ? 'nada' : mesesTxt(this.meses()),
      nota: this.anulado() ? 'anulado' : this.parcial() && cuota ? `faltan ${plata(Math.max(0, cuota - p.monto))}` : p.periodoHasta ? `hasta el ${fmt(p.periodoHasta)}` : 'sin período',
      notaTinta: this.parcial() ? '#b45309' : '#6b7280',
      left: a ?? 0, ancho: a !== null && b !== null && !this.anulado() ? Math.max(1.5, b - a) : 0,
      color: this.parcial() ? '#f0b429' : '#303030',
      hoy: pos(new Date()),
      desde: fmt(new Date(w0).toISOString()), hasta: fmt(new Date(w1).toISOString()),
      titulo: p.periodoDesde && p.periodoHasta ? `${fmt(p.periodoDesde)} → ${fmt(p.periodoHasta)}` : '',
    };
  });

  protected anular(): void {
    const p = this.detalle();
    const motivo = this.motivo().trim();
    if (!p || !motivo) return;
    this.pop.set(false);
    this.alertas
      .seguir(this.facturacion.anular(p.id, motivo), {
        titulo: 'Anulando el pago', texto: `#${p.id} · ${p.empresaNombre}`,
        exito: { titulo: 'Pago anulado', texto: `${plata(p.monto)} vuelven al saldo de ${p.empresaNombre}.` },
        error: { titulo: 'No se pudo anular', texto: 'Intentá de nuevo.' },
      })
      .subscribe({
        next: (d) => {
          this.detalle.set(d);
          this.pagos.update((xs) => xs.map((x) => (x.id === d.id ? { ...x, estado: d.estado } : x)));
          this.recargarCuenta(p.empresaId);
        },
        error: () => undefined,
      });
  }

  protected readonly pestanas = computed<PestanaHoja[]>(() => [
    { clave: 'cuenta', texto: 'Cuenta', cuenta: this.cuenta()?.saldoPendiente ? '!' : null, alerta: true },
    { clave: 'pagos', texto: 'Pagos', cuenta: this.cuenta()?.pagos.length ?? null },
    { clave: 'comp', texto: 'Comprobante' },
  ]);
  protected elegirPestana(c: string): void {
    this.pestana.set(c as Pestana);
  }

  protected readonly saldo = computed(() => {
    const c = this.cuenta();
    if (!c) return null;
    const cuota = c.cuotaMensual?.total ?? 0;
    const venc = c.suscripcion?.fechaProximoVencimiento;
    if (c.saldoPendiente > 0) {
      const atrasado = c.cobros.find((x) => x.estado === 'pendiente' && x.atrasado);
      return {
        icono: IconAlertCircle, tinta: '#d82c0d', titulo: `Debe ${plata(c.saldoPendiente)}`,
        texto: (cuota && c.saldoPendiente >= 2 * cuota ? `Acumula ${Math.floor(c.saldoPendiente / cuota)} cuotas. ` : '') +
          (atrasado ? `La última venció el ${fmt(atrasado.fechaLimite)}, hace ${-dias(atrasado.fechaLimite)} días.` : ''),
      };
    }
    return { icono: IconCircleCheck, tinta: '#087b5d', titulo: 'Al día', texto: venc ? `Próximo cobro de ${plata(cuota)} el ${fmt(venc)}.` : 'Sin cobros pendientes.' };
  });

  protected abrirExtra(): void {
    this.formExtra.set({ concepto: '', monto: '' });
  }
  protected agregarExtra(): void {
    const f = this.formExtra();
    const c = this.cuenta();
    const monto = parseInt((f?.monto ?? '').replace(/\D/g, ''), 10) || 0;
    if (!f || !c || !f.concepto.trim() || !monto) return;
    this.formExtra.set(null);
    this.alertas
      .seguir(this.facturacion.crearCargo(c.empresa.id, f.concepto.trim(), monto), {
        titulo: 'Agregando extra mensual', texto: f.concepto.trim(),
        exito: { titulo: 'Extra mensual agregado', texto: `${f.concepto.trim()} · ${plata(monto)} desde el próximo cobro.` },
        error: { titulo: 'No se pudo agregar', texto: 'Intentá de nuevo.' },
      })
      .subscribe({ next: (x) => this.cuenta.set(x), error: () => this.formExtra.set(f) });
  }
  protected quitarCargo(): void {
    const b = this.bajaCargo();
    if (!b || !b.motivo.trim()) return;
    this.bajaCargo.set(null);
    this.alertas
      .seguir(this.facturacion.darDeBajaCargo(b.id, b.motivo.trim()), {
        titulo: 'Quitando extra', texto: '',
        exito: { titulo: 'Extra quitado', texto: 'Deja de cobrarse desde el próximo período.' },
        error: { titulo: 'No se pudo quitar', texto: 'Intentá de nuevo.' },
      })
      .subscribe({ next: (x) => this.cuenta.set(x), error: () => undefined });
  }

  /** Últimos 6 cobros: barritas + lista de los 4 más nuevos. */
  protected readonly cobros = computed(() => {
    const c = this.cuenta();
    if (!c) return { barras: [], lista: [] };
    const cuota = c.cuotaMensual?.total || 1;
    const orden = [...c.cobros].sort((a, b) => (a.periodoDesde < b.periodoDesde ? -1 : 1)).slice(-6);
    const chip = (x: (typeof orden)[number]) =>
      x.estado === 'pagado' ? ['Pagado', 'bg-[#d5f5e3] text-[#0c5132]', '#303030']
      : x.estado === 'anulado' ? ['Anulado', 'bg-[#ececec] text-gray-600', '#e3e3e3']
      : x.atrasado ? ['Sin pago', 'bg-[#fde2dd] text-[#b42318]', '#f3c2b8']
      : ['En curso', 'bg-[#ececec] text-gray-600', '#e6e6e6'];
    return {
      barras: orden.map((x) => ({ titulo: `${MES_LARGO[new Date(x.periodoDesde).getMonth()]}: ${plata(x.monto)}`, alto: Math.max(3, Math.min(30, (x.monto / cuota) * 22)), color: chip(x)[2] })),
      lista: [...orden].reverse().slice(0, 4).map((x) => ({
        periodo: MES_LARGO[new Date(x.periodoDesde).getMonth()].replace(/^./, (s) => s.toUpperCase()),
        nota: x.estado === 'pendiente' ? `vence el ${fmt(x.fechaLimite)}` : x.pagoId ? `pago #${x.pagoId}` : '',
        chip: chip(x)[0], chipClase: chip(x)[1], monto: plata(x.monto),
      })),
    };
  });

  protected readonly pagosEmpresa = computed(() => {
    const c = this.cuenta();
    const cuota = c?.cuotaMensual?.total ?? null;
    return [...(c?.pagos ?? [])].sort((a, b) => (a.fechaPago < b.fechaPago ? 1 : -1)).map((x) => {
      const m = mesesDe(x);
      const an = x.estado === 'anulado';
      return {
        id: x.id, dia: new Date(x.fechaPago).getDate(), mes: fmt(x.fechaPago).split(' ')[1],
        titulo: an ? 'Anulado' : m !== null ? mesesTxt(m) + (m < 0.95 ? ' de la cuota' : '') : cuota ? mesesTxt(x.monto / cuota) : plata(x.monto),
        detalle: `${TEXTO_METODO[x.metodo]} · ${x.referencia ?? 'sin ref.'} · ${x.registradoPor?.nombre ?? '—'}${an && x.motivoAnulacion ? ' · ' + x.motivoAnulacion : ''}`,
        monto: plata(x.monto), anulado: an, actual: x.id === this.seleccionadaId(),
      };
    });
  });

  protected readonly datosComprobante = computed(() => {
    const p = this.detalle();
    if (!p) return [];
    return [
      { k: 'Registrado por', v: p.registradoPor?.nombre ?? '—' },
      { k: 'Fecha', v: fmtY(p.fechaPago) },
      { k: 'Método', v: `${TEXTO_METODO[p.metodo]}${p.referencia ? ' · ' + p.referencia : ''}${p.entidadBancaria ? ' · ' + p.entidadBancaria : ''}` },
      { k: 'Aplicado a', v: p.estado === 'anulado' ? '—' : p.periodoDesde && p.periodoHasta ? `${fmt(p.periodoDesde)} → ${fmt(p.periodoHasta)}` : '—' },
      ...(p.notas ? [{ k: 'Notas', v: p.notas }] : []),
    ];
  });

  // ── Registrar pago (reemplaza la hoja) ────────────────────────────────

  protected abrirNuevo(): void {
    const empresaId = this.sel()?.empresaId ?? this.empresas()[0]?.id;
    if (!empresaId) return;
    this.modo.set('nuevo');
    this.elegirEmpresaNuevo(empresaId);
  }

  protected elegirEmpresaNuevo(empresaId: number): void {
    const ultimo = this.pagos().find((p) => p.empresaId === empresaId);
    this.nuevo.set({ empresaId, metodo: ultimo?.metodo ?? 'transferencia', ref: '', monto: '', fecha: new Date().toISOString().slice(0, 10) });
    this.cuentaNuevo.set(null);
    this.facturacion.estadoCuenta(empresaId).pipe(catchError(() => of(null))).subscribe((c) => {
      if (this.nuevo()?.empresaId !== empresaId) return;
      this.cuentaNuevo.set(c);
      this.nuevo.update((n) => (n && !n.monto ? { ...n, monto: String(c?.saldoPendiente || c?.cuotaMensual?.total || '') } : n));
    });
  }

  protected parcheNuevo(c: Partial<{ metodo: MetodoPago; ref: string; monto: string; fecha: string }>): void {
    this.nuevo.update((n) => (n ? { ...n, ...c } : n));
  }

  protected readonly montoNuevo = computed(() => parseInt((this.nuevo()?.monto ?? '').replace(/\D/g, ''), 10) || 0);
  protected readonly notaNuevo = computed(() => {
    const c = this.cuentaNuevo();
    const m = this.montoNuevo();
    if (!c) return '';
    if (c.saldoPendiente) return m >= c.saldoPendiente ? `Salda la deuda de ${plata(c.saldoPendiente)}` : `Pago parcial · quedan ${plata(c.saldoPendiente - m)} de deuda`;
    const cuota = c.cuotaMensual?.total;
    return cuota ? `Cuota de ${plata(cuota)} · cubre ${mesesTxt(m / cuota)}` : '';
  });
  protected readonly empresasNuevo = computed(() =>
    [...this.empresas()].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((e) => ({ id: e.id, nombre: e.nombre, debe: e.acceso?.estado !== 'ok' })),
  );
  protected readonly efectoNuevo = computed(() => {
    const c = this.cuentaNuevo();
    const m = this.montoNuevo();
    const nombre = this.empresas().find((e) => e.id === this.nuevo()?.empresaId)?.nombre ?? '';
    return [
      c?.saldoPendiente ? `Baja la deuda de ${nombre} a ${plata(Math.max(0, c.saldoPendiente - m))}.` : `Queda como adelanto${c?.suscripcion?.fechaProximoVencimiento ? ` para el cobro del ${fmt(c.suscripcion.fechaProximoVencimiento)}` : ''}.`,
      'Renueva la suscripción y queda conciliado a tu nombre en el historial de la Empresa.',
    ];
  });

  protected registrar(): void {
    const n = this.nuevo();
    const monto = this.montoNuevo();
    if (!n || !monto) return;
    const nombre = this.empresas().find((e) => e.id === n.empresaId)?.nombre ?? '';
    const id = this.alertas.mostrar({ titulo: 'Registrando el pago', texto: `${nombre} · ${plata(monto)}` });
    this.facturacion
      .registrar({ empresaId: n.empresaId, monto, fechaPago: new Date(n.fecha + 'T12:00:00').toISOString(), metodo: n.metodo, referencia: n.ref.trim() || undefined })
      .subscribe({
        next: (p) => {
          this.alertas.resolver(id, {
            estado: p.diferenciaConPlan ? 'warning' : 'success',
            titulo: 'Pago registrado',
            texto: p.diferenciaConPlan ? `No coincide con el plan (${plata(p.diferenciaConPlan.precioPlan)}): diferencia ${plata(p.diferenciaConPlan.diferencia)}.` : `${nombre} · ${plata(monto)}`,
          });
          this.pagos.update((xs) => [p, ...xs]);
          this.resaltadas.set(new Set([p.id]));
          setTimeout(() => this.resaltadas.set(new Set()), 2000);
          this.modo.set('pago');
          this.nuevo.set(null);
          this.seleccionadaId.set(p.id);
          this.facturacion.resumen().subscribe((r) => this.resumen.set(r));
        },
        error: (err) =>
          this.alertas.resolver(id, { estado: 'error', titulo: 'No se pudo registrar el pago', texto: mensajeDeError(err), accion: { label: 'Reintentar', ejecutar: () => { this.alertas.cerrar(id); this.registrar(); } } }),
      });
  }

  protected exportar(): void {
    const id = this.alertas.mostrar({ titulo: 'Preparando exportación', texto: 'goods-pagos.csv' });
    this.facturacion.exportar({}).subscribe({
      next: (r) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(r.body!);
        a.download = 'goods-pagos.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        this.alertas.resolver(id, { estado: 'success', titulo: 'Exportación lista', texto: 'goods-pagos.csv' });
      },
      error: () => this.alertas.resolver(id, { estado: 'error', titulo: 'No se pudo exportar' }),
    });
  }

  protected volver(): void {
    this.router.navigateByUrl('/facturacion');
  }
}
