import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  IconAlertTriangle,
  IconBolt,
  IconBuilding,
  IconCheck,
  IconMoon,
  IconPlus,
  IconSortAscending,
  IconSortDescending,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { construirMapaPlanPorEmpresa } from '../../../../core/catalog/plan-lookup.util';
import { Empresa, EstadoEmpresa } from '../../../../core/catalog/models/empresa.model';
import { Plan } from '../../../../core/catalog/models/plan.model';
import { CambiosEnVivoService } from '../../../../core/realtime/cambios-en-vivo.service';
import { descargarCsv } from '../../../../core/http/descarga';
import { environment } from '../../../../../environments/environment';
import { CabeceraModuloComponent, MetricaCabecera, recientes, serieAcumulada } from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { ListaHojaComponent } from '../../../../shared/ui/lista-hoja/lista-hoja.component';
import { GrupoLista, FilaLista } from '../../../../shared/ui/lista-hoja/lista-hoja.model';
import { dias, fmt, pl } from '../../../../shared/ui/lista-hoja/formato';
import { filasCambiadas } from '../../../../shared/ui/filas-cambiadas';
import { EmpresaFichaComponent } from '../../components/empresa-ficha/empresa-ficha.component';
import { traerTodo } from '../../../../shared/ui/lista-hoja/traer-todo';

export const EN_ALTA: EstadoEmpresa[] = ['solicitud_recibida', 'pendiente', 'informacion_corroborada'];
export const INACTIVAS: EstadoEmpresa[] = ['suspendida', 'rechazada', 'cancelada'];

/** Texto + color del punto por estado (diseño `Empresas - Lista y ficha v2`). */
export const ESTADO_EMPRESA: Record<EstadoEmpresa, { texto: string; punto: string }> = {
  solicitud_recibida: { texto: 'Solicitud recibida', punto: '#8a8a8a' },
  pendiente: { texto: 'Pendiente', punto: '#b07400' },
  informacion_corroborada: { texto: 'Info. corroborada', punto: '#0094d5' },
  activa: { texto: 'Activa', punto: '#087b5d' },
  rechazada: { texto: 'Rechazada', punto: '#d82c0d' },
  suspendida: { texto: 'Suspendida', punto: '#d82c0d' },
  cancelada: { texto: 'Cancelada', punto: '#8a8a8a' },
};

const UMBRAL_ESPERA_DIAS = 10;

export interface FilaEmpresa extends Empresa {
  planNombre: string | null;
}

type Grupo = 'accion' | 'aldia' | 'inactivas';
type Orden = 'urgencia' | 'desc' | 'asc';
type FiltroMetrica = EstadoEmpresa | 'inactivas';

/**
 * Empresas — lista + ficha (diseño `Empresas - Lista y ficha v2.dc.html`).
 *
 * Reemplaza la tabla paginada + el side panel por el esqueleto lista/hoja.
 * Mismos datos que antes (`forkJoin` empresas + suscripciones activas +
 * planes); la ficha de la derecha (`EmpresaFichaComponent`) carga el resto.
 *
 * Grupos:
 * - Para hoy: en alta, o activas con acceso en mora/bloqueado o que vencen en ≤3 días.
 * - Al día: activas sin nada pendiente.
 * - Inactivas: suspendida / rechazada / cancelada (arranca plegado).
 */
@Component({
  selector: 'app-empresas-page',
  standalone: true,
  imports: [
    DatePipe,
    TablerIconComponent,
    CabeceraModuloComponent,
    PantallaEstadoComponent,
    ListaHojaComponent,
    EmpresaFichaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empresas-page.component.html',
  host: { class: 'flex h-full flex-col overflow-hidden px-6 pt-6' },
})
export class EmpresasPageComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly planService = inject(PlanService);
  private readonly router = inject(Router);

  protected readonly lista = viewChild(ListaHojaComponent);
  protected readonly hoy = new Date();
  protected readonly iconEmpresas = IconBuilding;
  protected readonly iconAgregar = IconPlus;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed(() => (this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo'));

  protected readonly filas = signal<FilaEmpresa[]>([]);
  protected readonly planes = signal<Plan[]>([]);
  protected readonly buscar = signal('');
  protected readonly filtro = signal<FiltroMetrica | null>(null);
  protected readonly orden = signal<Orden>('urgencia');
  protected readonly colapsados = signal<ReadonlySet<string>>(new Set(['inactivas']));
  protected readonly seleccionadaId = signal<number | null>(null);

  protected readonly cambiosEnVivo = signal(0);
  protected readonly resaltadas = signal<ReadonlySet<number>>(new Set());
  private compararAlCargar = false;

  protected readonly seleccionada = computed(() => this.filas().find((f) => f.id === this.seleccionadaId()) ?? null);

  private readonly enAlta = computed(() => this.filas().filter((f) => EN_ALTA.includes(f.estado)));
  private readonly esperaMax = computed(() => Math.max(0, ...this.enAlta().map((f) => -dias(f.creadoEn))));

  protected readonly badge = computed(() => `${this.filas().length} clientes`);

  protected readonly lectura = computed(() => {
    const todas = this.filas();
    const n = (e: EstadoEmpresa[]) => todas.filter((f) => e.includes(f.estado)).length;
    return (
      `${todas.length} empresas registradas: ${n(['activa'])} activas, ${this.enAlta().length} en proceso de alta y ${n(INACTIVAS)} inactivas.` +
      (this.enAlta().length ? ` La más vieja en alta lleva ${this.esperaMax()} días esperando.` : ' Ninguna está esperando el alta.')
    );
  });

  protected readonly metricas = computed<MetricaCabecera[]>(() => {
    const todas = this.filas();
    const tile = (id: FiltroMetrica, etiqueta: string, tono: MetricaCabecera['tono'], estados: EstadoEmpresa[], trazo?: string): MetricaCabecera => {
      const fechas = todas.filter((f) => estados.includes(f.estado)).map((f) => f.creadoEn);
      const r = recientes(fechas);
      return { id, etiqueta, valor: fechas.length, tono, trazo, serie: serieAcumulada(fechas), delta: r ? `+${r} esta semana` : null };
    };
    return [
      tile('solicitud_recibida', 'Solicitudes', 'neutro', ['solicitud_recibida'], '#78350f'),
      tile('pendiente', 'Pendientes', 'aviso', ['pendiente'], '#b07400'),
      tile('informacion_corroborada', 'Corroboradas', 'info', ['informacion_corroborada'], '#0094d5'),
      tile('activa', 'Activas', 'exito', ['activa'], '#064e3b'),
      tile('inactivas', 'Inactivas', 'apagado', INACTIVAS),
    ];
  });

  private grupoDe(f: FilaEmpresa): Grupo {
    if (EN_ALTA.includes(f.estado)) return 'accion';
    if (f.estado === 'activa') {
      const venc = f.acceso?.fechaProximoVencimiento;
      return f.acceso?.estado !== 'ok' || (venc && dias(venc) <= 3) ? 'accion' : 'aldia';
    }
    return 'inactivas';
  }

  private readonly filtradas = computed(() => {
    const term = this.buscar().trim().toLowerCase();
    const filtro = this.filtro();
    return this.filas().filter((e) => {
      if (filtro === 'inactivas' && !INACTIVAS.includes(e.estado)) return false;
      if (filtro && filtro !== 'inactivas' && e.estado !== filtro) return false;
      if (!term) return true;
      return `${e.nombre} ${e.correoContacto} ${e.rubro ?? ''} ${e.duenoNombres ?? ''} ${e.duenoApellidos ?? ''} ${e.id}`.toLowerCase().includes(term);
    });
  });

  protected readonly grupos = computed<GrupoLista[]>(() => {
    const base = this.filtradas();
    const orden = this.orden();
    const porFecha = (a: FilaEmpresa, b: FilaEmpresa) => (orden === 'asc' ? 1 : -1) * (new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime());
    // Urgencia: en alta primero (más vieja arriba), después lo que vence antes.
    const urg = (x: FilaEmpresa) => (EN_ALTA.includes(x.estado) ? -1000 + dias(x.creadoEn) : dias(x.acceso?.fechaProximoVencimiento));
    const META: Record<Grupo, Omit<GrupoLista, 'filas' | 'sub' | 'clave'>> = {
      accion: { titulo: 'Para hoy', icono: IconBolt, color: '#b45309', fondo: '#fbe7c6' },
      aldia: { titulo: 'Al día', icono: IconCheck, color: '#087b5d', fondo: '#d5f5e3' },
      inactivas: { titulo: 'Inactivas', icono: IconMoon, color: '#6b7280', fondo: '#e3e3e3' },
    };
    return (['accion', 'aldia', 'inactivas'] as Grupo[])
      .map((k) => {
        let l = base.filter((f) => this.grupoDe(f) === k);
        l = [...l].sort(orden === 'urgencia' && k === 'accion' ? (a, b) => urg(a) - urg(b) : porFecha);
        return { clave: k, ...META[k], sub: this.subGrupo(k, l), filas: l.map((f) => this.fila(f)) };
      })
      .filter((g) => g.filas.length);
  });

  private subGrupo(k: Grupo, l: FilaEmpresa[]): string {
    if (k === 'accion') {
      const alta = l.filter((f) => EN_ALTA.includes(f.estado)).length;
      const pago = l.length - alta;
      return [alta && pl(alta, 'en alta', 'en alta'), pago && pl(pago, 'con el pago encima', 'con el pago encima')].filter(Boolean).join(' · ');
    }
    if (k === 'aldia') {
      const planes = new Map<string, number>();
      l.forEach((f) => f.planNombre && planes.set(f.planNombre, (planes.get(f.planNombre) ?? 0) + 1));
      return [...planes].map(([p, n]) => `${n} ${p}`).join(' · ') || 'sin plan';
    }
    return INACTIVAS.map((e) => [e, l.filter((f) => f.estado === e).length] as const)
      .filter(([, n]) => n)
      .map(([e, n]) => `${n} ${ESTADO_EMPRESA[e].texto.toLowerCase()}`)
      .join(' · ');
  }

  private fila(f: FilaEmpresa): FilaLista {
    let gauge: FilaLista['gauge'];
    if (EN_ALTA.includes(f.estado)) {
      const d = -dias(f.creadoEn);
      const tarde = d >= UMBRAL_ESPERA_DIAS;
      gauge = { texto: d <= 0 ? 'hoy' : `${d} d`, ancho: Math.min(100, Math.max(6, (d / 14) * 100)), color: tarde ? '#d82c0d' : d >= 5 ? '#b07400' : '#303030', tinta: tarde ? '#d82c0d' : d >= 5 ? '#b45309' : '#374151' };
    } else if (f.estado === 'activa' && f.acceso?.fechaProximoVencimiento) {
      const d = dias(f.acceso.fechaProximoVencimiento);
      const mora = f.acceso.estado !== 'ok';
      gauge = { texto: mora ? 'en mora' : d === 0 ? 'vence hoy' : d < 0 ? `venció hace ${-d} d` : `en ${d} d`, ancho: mora ? 100 : Math.max(6, 100 - (d / 30) * 100), color: mora ? '#d82c0d' : d <= 3 ? '#b07400' : '#303030', tinta: mora ? '#d82c0d' : d <= 3 ? '#b45309' : '#374151' };
    } else {
      gauge = { texto: f.estadoCambiadoEn ? fmt(f.estadoCambiadoEn) : '—', ancho: null, color: '', tinta: '#9ca3af' };
    }
    return { id: f.id, nombre: f.nombre, sub: `${f.rubro ?? 'Sin rubro'} · ${f.planNombre ?? ESTADO_EMPRESA[f.estado].texto}`, punto: ESTADO_EMPRESA[f.estado].punto, gauge };
  }

  protected readonly resultados = computed(() => pl(this.filtradas().length, 'empresa', 'empresas'));
  protected readonly filtroTexto = computed(() => {
    const f = this.filtro();
    return !f ? null : f === 'inactivas' ? 'Inactivas' : ESTADO_EMPRESA[f].texto;
  });
  protected readonly ordenIcono = computed(() => (this.orden() === 'urgencia' ? IconAlertTriangle : this.orden() === 'desc' ? IconSortDescending : IconSortAscending));
  protected readonly ordenTitulo = computed(() =>
    this.orden() === 'urgencia' ? 'Por urgencia · cambiar a más recientes' : this.orden() === 'desc' ? 'Más recientes · cambiar a más antiguas' : 'Más antiguas · cambiar a urgencia',
  );

  constructor() {
    this.cargar();
    // Enlace de una notificación (`/empresas?empresa=N`, ver notificacion-catalogo).
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((q) => this.abrirDesdeEnlace(Number(q.get('empresa'))));
    inject(CambiosEnVivoService)
      .huboCambio(['empresa', 'suscripcion', 'facturacion'])
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cambiosEnVivo.update((n) => n + 1));
  }

  /** Id pedido por enlace, hasta que la lista llega y se puede ubicar. */
  private enlaceId: number | null = null;

  private abrirDesdeEnlace(id: number): void {
    if (!id) return;
    this.enlaceId = id;
    this.resolverEnlace();
    void this.router.navigate([], { queryParams: { empresa: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Elige la Empresa del enlace y despliega su grupo (Inactivas arranca plegado). */
  private resolverEnlace(): void {
    const id = this.enlaceId;
    if (!id || !this.filas().some((f) => f.id === id)) return;
    this.enlaceId = null;
    this.seleccionadaId.set(id);
    const g = this.grupos().find((x) => x.filas.some((f) => f.id === id));
    if (g) this.colapsados.update((c) => { const n = new Set(c); n.delete(g.clave); return n; });
  }

  protected cargar(): void {
    this.cargando.set(this.filas().length === 0);
    this.error.set(null);
    forkJoin({
      // Todas las páginas (2026-10-07): antes se cortaba en 100.
      empresas: traerTodo((page) => this.empresaService.listar({ page })),
      activas: traerTodo((page) => this.suscripcionService.listar('activa', undefined, page)),
      planes: this.planService.listarTodos(),
    }).subscribe({
      next: ({ empresas, activas, planes }) => {
        const mapa = construirMapaPlanPorEmpresa(activas.data, planes.data);
        const nuevas = empresas.data.map((e) => ({ ...e, planNombre: mapa.get(e.id) ?? null }));
        if (this.compararAlCargar) {
          this.compararAlCargar = false;
          this.resaltadas.set(filasCambiadas(this.filas(), nuevas, (e) => e.id));
          setTimeout(() => this.resaltadas.set(new Set()), 2000);
        }
        this.filas.set(nuevas);
        this.planes.set(planes.data.filter((p) => p.activo));
        this.resolverEnlace();
        if (!this.seleccionadaId() || !nuevas.some((e) => e.id === this.seleccionadaId())) {
          this.seleccionadaId.set(this.grupos()[0]?.filas[0]?.id ?? null);
        }
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el listado de Empresas.');
        this.cargando.set(false);
      },
    });
  }

  protected actualizar(): void {
    this.cambiosEnVivo.set(0);
    this.compararAlCargar = true;
    this.cargar();
  }

  protected alternarMetrica(id: string): void {
    this.filtro.update((f) => (f === id ? null : (id as FiltroMetrica)));
  }

  protected alternarGrupo(clave: string): void {
    this.colapsados.update((s) => {
      const n = new Set(s);
      n.has(clave) ? n.delete(clave) : n.add(clave);
      return n;
    });
  }

  protected alternarOrden(): void {
    this.orden.update((o) => (o === 'urgencia' ? 'desc' : o === 'desc' ? 'asc' : 'urgencia'));
  }

  protected limpiar(): void {
    this.filtro.set(null);
    this.buscar.set('');
  }

  /** La ficha guardó algo: se refleja en la fila sin releer todo. */
  protected onActualizada(e: Partial<Empresa> & { id: number }): void {
    this.filas.update((xs) => xs.map((f) => (f.id === e.id ? { ...f, ...e } : f)));
  }

  protected abrirNuevaEmpresa(): void {
    window.open(environment.registroPublicoUrl, '_blank', 'noopener');
  }

  protected volver(): void {
    this.router.navigateByUrl('/empresas');
  }

  protected exportar(): void {
    descargarCsv(
      'goods-empresas',
      ['Id', 'Empresa', 'Rubro', 'Estado', 'Plan', 'Próximo vencimiento', 'Correo', 'Teléfono', 'Registrada el'],
      this.filtradas().map((e) => [
        e.id, e.nombre, e.rubro, ESTADO_EMPRESA[e.estado].texto, e.planNombre,
        e.acceso?.fechaProximoVencimiento?.slice(0, 10), e.correoContacto, e.telefonoContacto, e.creadoEn?.slice(0, 10),
      ]),
    );
  }
}
