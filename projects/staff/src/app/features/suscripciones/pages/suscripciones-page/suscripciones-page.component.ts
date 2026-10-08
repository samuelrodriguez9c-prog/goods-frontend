import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import {
  IconAlarm,
  IconArrowDown,
  IconArrowUp,
  IconBan,
  IconCalendarDollar,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconCircleDashed,
  IconClockX,
  IconMoon,
  IconPlayerPlay,
  IconPuzzle,
  IconRepeat,
  IconSortDescending,
  IconStack2,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { SuscripcionService, EstadoAsignableSuscripcion } from '../../../../core/catalog/suscripcion.service';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { ModuloService } from '../../../../core/catalog/modulo.service';
import { FacturacionService } from '../../../../core/facturacion/facturacion.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PistaService } from '../../../../core/ui/pista.service';
import { CambiosEnVivoService } from '../../../../core/realtime/cambios-en-vivo.service';
import { Empresa } from '../../../../core/catalog/models/empresa.model';
import { Plan } from '../../../../core/catalog/models/plan.model';
import { Suscripcion } from '../../../../core/catalog/models/suscripcion.model';
import { DesgloseModuloEmpresa } from '../../../../core/catalog/models/modulo.model';
import { EstadoCuenta } from '../../../../core/facturacion/models/facturacion.model';
import { CabeceraModuloComponent, MetricaCabecera, serieAcumulada } from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { ListaHojaComponent } from '../../../../shared/ui/lista-hoja/lista-hoja.component';
import { HojaPestanasComponent } from '../../../../shared/ui/lista-hoja/hoja-pestanas.component';
import { FilaLista, GrupoLista, PestanaHoja } from '../../../../shared/ui/lista-hoja/lista-hoja.model';
import { corto, dias, fmt, fmtY, pct, pl, plata, signo } from '../../../../shared/ui/lista-hoja/formato';
import { filasCambiadas } from '../../../../shared/ui/filas-cambiadas';
import { traerTodo } from '../../../../shared/ui/lista-hoja/traer-todo';

type Grupo = 'pronto' | 'aldia' | 'sin';
type Filtro = 'vig' | 'mrr' | 'pronto' | 'venc' | 'canc';
type Pestana = 'plan' | 'historial' | 'extras';

/** Una fila por Empresa: su suscripción vigente (o la última) + el historial. */
interface FilaSuscripcion {
  empresaId: number;
  empresa: Empresa;
  actual: Suscripcion;
  plan: Plan | null;
  historial: Suscripcion[];
  vigente: boolean;
  mora: boolean;
  venc: string | null;
}

const ESTADO_SUS: Record<string, { texto: string; punto: string }> = {
  activa: { texto: 'Activa', punto: '#087b5d' },
  pendiente: { texto: 'Pendiente', punto: '#b07400' },
  vencida: { texto: 'Vencida', punto: '#d82c0d' },
  cancelada: { texto: 'Cancelada', punto: '#8a8a8a' },
};

/**
 * Suscripciones — una fila por Empresa + hoja (diseño `Suscripciones - Por empresa`).
 *
 * Mismo `forkJoin` de antes (suscripciones + empresas + planes). La hoja
 * suma `estadoCuenta` (cuota con extras, último pago) y `listarDesglose`
 * (extras) de la Empresa elegida.
 *
 * Grupos: Cobran pronto (en mora o vencen en ≤7 días), Al día, Sin cobrar
 * (vencidas/canceladas/pendientes; arranca plegado).
 */
@Component({
  selector: 'app-suscripciones-page',
  standalone: true,
  imports: [DatePipe, TablerIconComponent, CabeceraModuloComponent, PantallaEstadoComponent, ListaHojaComponent, HojaPestanasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suscripciones-page.component.html',
  host: { class: 'flex h-full flex-col overflow-hidden px-6 pt-6' },
})
export class SuscripcionesPageComponent {
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly empresaService = inject(EmpresaService);
  private readonly planService = inject(PlanService);
  private readonly moduloService = inject(ModuloService);
  private readonly facturacion = inject(FacturacionService);
  private readonly alertas = inject(AlertaService);
  private readonly pista = inject(PistaService);
  private readonly router = inject(Router);

  protected readonly lista = viewChild(ListaHojaComponent);
  protected readonly hoy = new Date();
  protected readonly plata = plata;
  protected readonly i = {
    modulo: IconRepeat, arriba: IconChevronUp, abajo: IconChevronDown, derecha: IconChevronRight, plan: IconStack2, extra: IconPuzzle,
    cobro: IconCalendarDollar, check: IconCheck, sube: IconArrowUp, baja: IconArrowDown, play: IconPlayerPlay, ban: IconBan, vencida: IconClockX, vacio: IconCircleDashed,
  };

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed(() => (this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo'));

  protected readonly filas = signal<FilaSuscripcion[]>([]);
  protected readonly planes = signal<Plan[]>([]);
  protected readonly buscar = signal('');
  protected readonly filtro = signal<Filtro | null>(null);
  protected readonly colapsados = signal<ReadonlySet<string>>(new Set(['sin']));
  protected readonly seleccionadaId = signal<number | null>(null);
  protected readonly cambiosEnVivo = signal(0);
  protected readonly resaltadas = signal<ReadonlySet<number>>(new Set());
  private compararAlCargar = false;

  // Hoja
  protected readonly pestana = signal<Pestana>('plan');
  protected readonly pop = signal(false);
  protected readonly estadoDestino = signal<EstadoAsignableSuscripcion | null>(null);
  protected readonly planDestino = signal<number | null>(null);
  protected readonly cuenta = signal<EstadoCuenta | null>(null);
  protected readonly modulos = signal<DesgloseModuloEmpresa[]>([]);

  protected readonly sel = computed(() => this.filas().find((f) => f.empresaId === this.seleccionadaId()) ?? null);

  private grupoDe(f: FilaSuscripcion): Grupo {
    return !f.vigente ? 'sin' : f.mora || (f.venc !== null && dias(f.venc) <= 7) ? 'pronto' : 'aldia';
  }
  private precio = (f: FilaSuscripcion) => f.plan?.precioMensual ?? 0;

  private readonly vigentes = computed(() => this.filas().filter((f) => f.vigente));
  protected readonly mrr = computed(() => this.vigentes().reduce((t, f) => t + this.precio(f), 0));

  private readonly filtradas = computed(() => {
    const term = this.buscar().trim().toLowerCase();
    const F: Record<Filtro, (f: FilaSuscripcion) => boolean> = {
      vig: (f) => f.vigente, mrr: (f) => f.vigente, pronto: (f) => this.grupoDe(f) === 'pronto',
      venc: (f) => f.actual.estado === 'vencida', canc: (f) => f.actual.estado === 'cancelada',
    };
    const fil = this.filtro();
    return this.filas().filter((f) => (!fil || F[fil](f)) && (!term || `${f.empresa.nombre} ${f.plan?.nombre ?? ''} ${f.empresaId}`.toLowerCase().includes(term)));
  });

  protected readonly grupos = computed<GrupoLista[]>(() => {
    const META: Record<Grupo, Omit<GrupoLista, 'clave' | 'sub' | 'filas'>> = {
      pronto: { titulo: 'Cobran pronto', icono: IconAlarm, color: '#b45309', fondo: '#fbe7c6' },
      aldia: { titulo: 'Al día', icono: IconCheck, color: '#087b5d', fondo: '#d5f5e3' },
      sin: { titulo: 'Sin cobrar', icono: IconMoon, color: '#6b7280', fondo: '#e3e3e3' },
    };
    const ord: Record<Grupo, (a: FilaSuscripcion, b: FilaSuscripcion) => number> = {
      pronto: (a, b) => (a.venc ?? '') < (b.venc ?? '') ? -1 : 1,
      aldia: (a, b) => this.precio(b) - this.precio(a) || a.empresa.nombre.localeCompare(b.empresa.nombre),
      sin: (a, b) => ((a.actual.fechaFin ?? '') < (b.actual.fechaFin ?? '') ? 1 : -1),
    };
    return (['pronto', 'aldia', 'sin'] as Grupo[])
      .map((k) => {
        const l = [...this.filtradas().filter((f) => this.grupoDe(f) === k)].sort(ord[k]);
        const total = l.reduce((t, f) => t + this.precio(f), 0);
        const sub = k === 'sin' ? `${l.filter((f) => f.actual.estado === 'vencida').length} vencidas · ${l.filter((f) => f.actual.estado === 'cancelada').length} canceladas` : `${plata(total)} por mes${k === 'pronto' && l.some((f) => f.mora) ? ' · una en mora' : ''}`;
        return { clave: k, ...META[k], sub, filas: l.map((f) => this.fila(f, k)) };
      })
      .filter((g) => g.filas.length);
  });

  private fila(f: FilaSuscripcion, k: Grupo): FilaLista {
    let gauge: FilaLista['gauge'];
    if (k === 'sin') gauge = { texto: f.actual.fechaFin ? fmt(f.actual.fechaFin) : '—', ancho: null, color: '', tinta: '#9ca3af' };
    else if (f.mora) gauge = { texto: 'en mora', ancho: 100, color: '#d82c0d', tinta: '#d82c0d' };
    else {
      const d = dias(f.venc);
      gauge = { texto: d === 0 ? 'hoy' : d < 0 ? `venció hace ${-d} d` : `en ${d} d`, ancho: Math.max(6, 100 - (d / 30) * 100), color: d <= 7 ? '#b07400' : '#303030', tinta: d <= 7 ? '#b45309' : '#374151' };
    }
    return { id: f.empresaId, nombre: f.empresa.nombre, sub: `${f.plan?.nombre ?? '—'} · ${f.vigente ? plata(this.precio(f)) + '/mes' : ESTADO_SUS[f.actual.estado]?.texto}`, punto: ESTADO_SUS[f.actual.estado]?.punto ?? '#8a8a8a', gauge };
  }

  protected readonly badge = computed(() => `${plata(this.mrr())} MRR`);
  protected readonly lectura = computed(() => {
    const pronto = this.filas().filter((f) => this.grupoDe(f) === 'pronto');
    const sin = this.filas().filter((f) => !f.vigente).length;
    return `${pl(this.vigentes().length, 'suscripción vigente factura', 'suscripciones vigentes facturan')} ${plata(this.mrr())} por mes. ${pl(pronto.length, 'cobra', 'cobran')} en los próximos 7 días${pronto.some((f) => f.mora) ? ', una ya está en mora' : ''}. ${pl(sin, 'no factura', 'no facturan')}.`;
  });

  protected readonly metricas = computed<MetricaCabecera[]>(() => {
    const fechas = (p: (f: FilaSuscripcion) => boolean) => this.filas().filter(p).map((f) => f.actual.fechaInicio ?? f.actual.creadoEn);
    return [
      { id: 'vig', etiqueta: 'Vigentes', valor: this.vigentes().length, tono: 'exito', trazo: '#064e3b', serie: serieAcumulada(fechas((f) => f.vigente)) },
      { id: 'mrr', etiqueta: 'MRR', valor: corto(this.mrr()), tono: 'neutro' },
      { id: 'pronto', etiqueta: 'Cobran pronto', valor: this.filas().filter((f) => this.grupoDe(f) === 'pronto').length, tono: 'aviso', trazo: '#b07400' },
      { id: 'venc', etiqueta: 'Vencidas', valor: this.filas().filter((f) => f.actual.estado === 'vencida').length, tono: 'peligro' },
      { id: 'canc', etiqueta: 'Canceladas', valor: this.filas().filter((f) => f.actual.estado === 'cancelada').length, tono: 'apagado' },
    ];
  });

  protected readonly resultados = computed(() => pl(this.filtradas().length, 'empresa', 'empresas'));
  protected readonly filtroTexto = computed(() => (this.filtro() ? { vig: 'Vigentes', mrr: 'Vigentes', pronto: 'Cobran pronto', venc: 'Vencidas', canc: 'Canceladas' }[this.filtro()!] : null));
  protected readonly ordenIcono = IconSortDescending;

  constructor() {
    this.cargar();
    inject(CambiosEnVivoService)
      .huboCambio(['suscripcion', 'empresa', 'facturacion'])
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cambiosEnVivo.update((n) => n + 1));
    effect(() => {
      const id = this.seleccionadaId();
      untracked(() => this.cargarHoja(id));
    });
  }

  protected cargar(): void {
    this.cargando.set(this.filas().length === 0);
    this.error.set(null);
    forkJoin({ sus: traerTodo((page) => this.suscripcionService.listar(undefined, undefined, page)), empresas: traerTodo((page) => this.empresaService.listar({ page })), planes: this.planService.listarTodos() }).subscribe({
      next: ({ sus, empresas, planes }) => {
        const porEmpresa = new Map<number, Suscripcion[]>();
        sus.data.forEach((s) => porEmpresa.set(s.empresaId, [...(porEmpresa.get(s.empresaId) ?? []), s]));
        const nuevas: FilaSuscripcion[] = [];
        porEmpresa.forEach((hist, empresaId) => {
          const empresa = empresas.data.find((e) => e.id === empresaId);
          if (!empresa) return;
          const orden = [...hist].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
          const actual = orden.find((s) => s.estado === 'activa') ?? orden[0];
          nuevas.push({
            empresaId, empresa, actual, historial: orden, plan: planes.data.find((p) => p.id === actual.planId) ?? null,
            vigente: actual.estado === 'activa', mora: empresa.acceso?.estado === 'en_mora', venc: empresa.acceso?.fechaProximoVencimiento ?? null,
          });
        });
        if (this.compararAlCargar) {
          this.compararAlCargar = false;
          this.resaltadas.set(filasCambiadas(this.filas(), nuevas, (f) => f.empresaId));
          setTimeout(() => this.resaltadas.set(new Set()), 2000);
        }
        this.filas.set(nuevas);
        this.planes.set(planes.data.filter((p) => p.activo));
        if (!this.sel()) this.seleccionadaId.set(this.grupos()[0]?.filas[0]?.id ?? null);
        else this.cargarHoja(this.seleccionadaId());
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las suscripciones.');
        this.cargando.set(false);
      },
    });
  }

  private cargarHoja(id: number | null): void {
    this.pop.set(false);
    this.estadoDestino.set(null);
    this.planDestino.set(null);
    this.cuenta.set(null);
    this.modulos.set([]);
    if (!id) return;
    forkJoin({
      cuenta: this.facturacion.estadoCuenta(id).pipe(catchError(() => of(null))),
      modulos: this.moduloService.listarDesglose(id).pipe(catchError(() => of([]))),
    }).subscribe(({ cuenta, modulos }) => {
      if (this.seleccionadaId() !== id) return;
      this.cuenta.set(cuenta);
      this.modulos.set(modulos);
    });
  }

  protected actualizar(): void {
    this.cambiosEnVivo.set(0);
    this.compararAlCargar = true;
    this.cargar();
  }
  protected seleccionar(id: number): void {
    this.seleccionadaId.set(id);
    this.pestana.set('plan');
  }
  protected alternarMetrica(id: string): void {
    this.filtro.update((f) => (f === id ? null : (id as Filtro)));
  }
  protected alternarGrupo(c: string): void {
    this.colapsados.update((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  }
  protected limpiar(): void {
    this.filtro.set(null);
    this.buscar.set('');
  }

  // ── Hoja ──────────────────────────────────────────────────────────────

  protected readonly cuota = computed(() => this.cuenta()?.cuotaMensual?.total ?? (this.sel() ? this.precio(this.sel()!) : 0));
  protected readonly estado = computed(() => ESTADO_SUS[this.sel()?.actual.estado ?? 'activa']);

  protected readonly accionesEstado = computed(() => {
    const e = this.sel()?.actual.estado;
    const A = {
      activa: { texto: 'Reactivar…', sub: 'Vuelve a facturar con el mismo plan', icono: IconPlayerPlay, peligro: false, titulo: 'Reactivar la suscripción', ayuda: 'Recupera el acceso desde hoy y el ciclo vuelve a correr.' },
      vencida: { texto: 'Marcar vencida…', sub: 'Corta el acceso por falta de pago', icono: IconClockX, peligro: true, titulo: 'Marcar como vencida', ayuda: 'La Empresa pierde el acceso hasta que registre un pago.' },
      cancelada: { texto: 'Cancelar…', sub: 'Deja de facturar', icono: IconBan, peligro: true, titulo: 'Cancelar la suscripción', ayuda: 'No se cobra más. El historial se conserva.' },
    } satisfies Record<EstadoAsignableSuscripcion, unknown>;
    const lista: EstadoAsignableSuscripcion[] = e === 'activa' ? ['vencida', 'cancelada'] : e === 'vencida' ? ['activa', 'cancelada'] : e === 'cancelada' ? ['activa'] : [];
    return lista.map((k) => ({ k, ...A[k] }));
  });
  protected readonly destino = computed(() => this.accionesEstado().find((a) => a.k === this.estadoDestino()) ?? null);

  protected confirmarEstado(): void {
    const f = this.sel();
    const d = this.estadoDestino();
    if (!f || !d) return;
    this.pop.set(false);
    this.estadoDestino.set(null);
    this.alertas
      .seguir(this.suscripcionService.cambiarEstado(f.actual.id, d), {
        titulo: 'Cambiando el estado', texto: f.empresa.nombre,
        exito: { titulo: d === 'activa' ? 'Suscripción reactivada' : d === 'vencida' ? 'Marcada como vencida' : 'Suscripción cancelada', texto: f.empresa.nombre },
        error: { titulo: 'No se pudo cambiar el estado', texto: 'Intentá de nuevo.' },
      })
      .subscribe({ next: () => this.cargar(), error: () => undefined });
  }

  protected readonly cobroPill = computed(() => {
    const f = this.sel();
    if (!f?.vigente) return f?.actual.fechaFin ? `Sin acceso desde el ${fmt(f.actual.fechaFin)}` : 'No factura';
    return f.mora ? 'En mora' : f.venc ? `Cobra el ${fmt(f.venc)}` : '—';
  });

  /** Peso de esta Empresa sobre el MRR total: una barra apilada de todas las vigentes. */
  protected readonly peso = computed(() => {
    const f = this.sel();
    const total = this.mrr() || 1;
    const tramos = [...this.vigentes()].sort((a, b) => this.precio(b) - this.precio(a)).map((x) => ({ id: x.empresaId, nombre: x.empresa.nombre, grow: this.precio(x), actual: x.empresaId === f?.empresaId }));
    return { pct: f?.vigente ? pct(this.precio(f) / total) : '—', total: `de ${plata(this.mrr())}`, tramos };
  });

  protected readonly extrasCuenta = computed(() => this.modulos().filter((m) => m.override?.tipo === 'concedido').length);

  protected readonly pestanas = computed<PestanaHoja[]>(() => [
    { clave: 'plan', texto: 'Plan' },
    { clave: 'historial', texto: 'Historial', cuenta: this.sel()?.historial.length ?? null },
    { clave: 'extras', texto: 'Extras', cuenta: this.extrasCuenta() || null },
  ]);
  protected elegirPestana(c: string): void {
    this.pestana.set(c as Pestana);
  }

  protected readonly ciclo = computed(() => {
    const f = this.sel();
    if (!f?.vigente || !f.venc) {
      return { con: false, grande: f?.actual.estado === 'cancelada' ? 'Cancelada' : 'Sin ciclo', chico: f?.actual.fechaFin ? `desde el ${fmtY(f.actual.fechaFin)}` : 'No está facturando.', dias: [] as string[], inicio: '', fin: '' };
    }
    const d = dias(f.venc);
    const ini = new Date(f.venc);
    ini.setMonth(ini.getMonth() - 1);
    const largo = Math.round((new Date(f.venc).getTime() - ini.getTime()) / 86_400_000);
    const pasados = largo - Math.max(0, d);
    return {
      con: true, grande: f.mora ? 'En mora' : d === 0 ? 'Cobra hoy' : d < 0 ? `Venció hace ${pl(-d, 'día', 'días')}` : `Cobra en ${pl(d, 'día', 'días')}`, chico: `${plata(this.cuota())} el ${fmtY(f.venc)}`,
      dias: Array.from({ length: largo }, (_, k) => (k < pasados - 1 ? '#303030' : k === pasados - 1 ? '#2be0d5' : '#ececec')),
      inicio: fmt(ini.toISOString()), fin: fmt(f.venc),
    };
  });

  protected readonly mover = computed(() => {
    const f = this.sel();
    const actual = f?.plan;
    const destino = this.planDestino();
    return {
      titulo: f?.vigente ? 'Cambiar de plan' : 'Reactivar con un plan',
      planes: this.planes().map((p) => {
        const mods = p.modulos?.length ?? 0;
        return { id: p.id, nombre: p.nombre, precio: p.precioMensual ? plata(p.precioMensual) : '—', mods: pl(mods, 'módulo', 'módulos'), actual: p.id === actual?.id, elegido: (destino ?? actual?.id) === p.id };
      }),
    };
  });

  protected readonly delta = computed(() => {
    const f = this.sel();
    const p = this.planes().find((x) => x.id === this.planDestino());
    if (!f || !p || p.id === f.plan?.id) return null;
    const dif = (p.precioMensual ?? 0) - (f.plan?.precioMensual ?? 0);
    return {
      monto: signo(dif), sube: dif >= 0,
      nota: `${dif >= 0 ? 'Sube' : 'Baja'} de ${plata(f.plan?.precioMensual ?? 0)} a ${plata(p.precioMensual ?? 0)} por mes`,
      pasos: [
        `Se cierra la suscripción ${f.plan?.nombre ?? ''} de hoy y se abre una nueva con ${p.nombre}.`,
        'Las excepciones de módulos se reinician al plan nuevo.',
        f.venc ? `El próximo cobro (${fmt(f.venc)}) ya sale con el precio nuevo.` : 'El ciclo arranca hoy.',
      ],
      accion: f.vigente ? `Cambiar a ${p.nombre}` : `Reactivar con ${p.nombre}`,
    };
  });

  protected aplicarPlan(): void {
    const f = this.sel();
    const p = this.planes().find((x) => x.id === this.planDestino());
    if (!f || !p) return;
    // Vigente: cambio de plan. Vencida o cancelada: reactivar con este plan en un solo paso (atómico).
    const op = f.vigente ? this.suscripcionService.cambiarPlan(f.empresaId, p.id) : this.suscripcionService.reactivar(f.actual.id, p.id);
    this.alertas
      .seguir(op, {
        titulo: f.vigente ? 'Cambiando el plan' : 'Reactivando', texto: `${f.empresa.nombre} → ${p.nombre}`,
        exito: { titulo: f.vigente ? 'Plan cambiado' : 'Suscripción reactivada', texto: `${f.empresa.nombre} con ${p.nombre}.` },
        error: { titulo: 'No se pudo aplicar', texto: 'Intentá de nuevo.' },
      })
      .subscribe({ next: () => this.cargar(), error: () => undefined });
  }

  protected readonly cobro = computed(() => {
    const c = this.cuenta();
    return [
      { k: 'Cuota con extras', v: plata(this.cuota()) },
      { k: 'Último pago', v: c?.ultimoPago ? `${plata(c.ultimoPago.monto)} · ${fmt(c.ultimoPago.fechaPago)}` : '—' },
      { k: 'Pagos válidos', v: String(c?.totales.pagosValidos ?? 0) },
      { k: 'Saldo pendiente', v: c?.saldoPendiente ? plata(c.saldoPendiente) : 'Al día' },
    ];
  });

  protected readonly hist = computed(() => {
    const f = this.sel();
    if (!f) return { tramos: [], items: [], desde: '' };
    const orden = [...f.historial].sort((a, b) => (a.creadoEn < b.creadoEn ? -1 : 1));
    const ini = new Date(orden[0].fechaInicio ?? orden[0].creadoEn).getTime();
    const total = Math.max(1, Date.now() - ini);
    const tramos = orden.map((s) => {
      const a = new Date(s.fechaInicio ?? s.creadoEn).getTime();
      const b = s.fechaFin ? new Date(s.fechaFin).getTime() : Date.now();
      const plan = this.planes().find((p) => p.id === s.planId)?.nombre ?? '—';
      return { texto: plan, left: ((a - ini) / total) * 100, ancho: Math.max(2, ((b - a) / total) * 100), color: s.estado === 'activa' ? '#303030' : s.estado === 'vencida' ? '#f3c2b8' : '#d4d4d4' };
    });
    const items = [...orden].reverse().map((s, k, arr) => {
      const plan = this.planes().find((p) => p.id === s.planId);
      const previa = arr[k + 1] ? this.planes().find((p) => p.id === arr[k + 1].planId) : null;
      const dif = previa ? (plan?.precioMensual ?? 0) - (previa.precioMensual ?? 0) : 0;
      return {
        icono: !previa ? IconCheck : dif > 0 ? IconArrowUp : dif < 0 ? IconArrowDown : IconRepeat,
        titulo: !previa ? `Alta con ${plan?.nombre ?? '—'}` : `${previa.nombre} → ${plan?.nombre ?? '—'}`,
        detalle: `${fmtY(s.fechaInicio ?? s.creadoEn)}${s.fechaFin ? ` – ${fmtY(s.fechaFin)}` : ' – hoy'} · ${ESTADO_SUS[s.estado]?.texto ?? s.estado}`,
        monto: previa ? signo(dif) : plan?.precioMensual ? plata(plan.precioMensual) : '—',
        tinta: !previa ? '#111827' : dif >= 0 ? '#087b5d' : '#b42318',
      };
    });
    return { tramos, items, desde: fmtY(orden[0].fechaInicio ?? orden[0].creadoEn) };
  });

  protected readonly extras = computed(() => {
    const filas = this.modulos().filter((m) => !m.desdePlan);
    return {
      titulo: `${pl(this.extrasCuenta(), 'extra activo', 'extras activos')}`,
      nota: `Fuera del plan ${this.sel()?.plan?.nombre ?? ''}`,
      filas: filas.map((m) => ({ ...m, activo: m.efectivo })),
    };
  });

  protected alternarExtra(m: DesgloseModuloEmpresa): void {
    const f = this.sel()!;
    const op: Observable<unknown> = m.efectivo ? this.moduloService.quitar(f.empresaId, m.id) : this.moduloService.gestionar(f.empresaId, { moduloId: m.id, tipo: 'concedido', motivo: 'Extra desde Suscripciones' });
    op.subscribe({
      next: () => {
        this.moduloService.listarDesglose(f.empresaId).subscribe((xs) => this.modulos.set(xs));
        this.pista.hecho(`${m.nombre} ${m.efectivo ? 'quitado' : 'activado'} en ${f.empresa.nombre}`);
      },
      error: () => this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo cambiar el extra', texto: m.nombre }),
    });
  }

  protected volver(): void {
    this.router.navigateByUrl('/suscripciones');
  }
}
