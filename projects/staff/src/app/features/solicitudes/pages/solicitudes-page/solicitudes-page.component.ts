import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  IconAdjustments,
  IconArchive,
  IconBan,
  IconBulb,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconCode,
  IconDots,
  IconForms,
  IconHandGrab,
  IconInbox,
  IconLock,
  IconMessage,
  IconPackage,
  IconProgress,
  IconPuzzle,
  IconSend,
  IconUserCheck,
  IconUserQuestion,
  IconUsers,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { SolicitudesService } from '../../../../core/solicitudes/solicitudes.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PistaService } from '../../../../core/ui/pista.service';
import { CambiosEnVivoService } from '../../../../core/realtime/cambios-en-vivo.service';
import {
  AlcanceSolicitud,
  CambioEstadoPayload,
  ESTADO_SOLICITUD,
  EstadoSolicitud,
  ResumenSolicitudes,
  SolicitudDetalle,
  SolicitudResumen,
  TIPO_SOLICITUD,
  TipoSolicitud,
} from '../../../../core/solicitudes/models/solicitud.model';
import { CabeceraModuloComponent, MetricaCabecera, recientes, serieAcumulada } from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { ListaHojaComponent } from '../../../../shared/ui/lista-hoja/lista-hoja.component';
import { HojaPestanasComponent } from '../../../../shared/ui/lista-hoja/hoja-pestanas.component';
import { FilaLista, GrupoLista, PestanaHoja } from '../../../../shared/ui/lista-hoja/lista-hoja.model';
import { dias, fmt, fmtY, hace, iniciales, pl, plata } from '../../../../shared/ui/lista-hoja/formato';
import { TAMANO_PAGINA, traerTodo } from '../../../../shared/ui/lista-hoja/traer-todo';
import { filasCambiadas } from '../../../../shared/ui/filas-cambiadas';

const ABIERTAS: EstadoSolicitud[] = ['recibida', 'en_evaluacion', 'aprobada', 'en_desarrollo'];
const PASOS: EstadoSolicitud[] = ['recibida', 'en_evaluacion', 'aprobada', 'en_desarrollo', 'entregada'];

/** Punto / chip fondo / chip texto por estado. */
const COLOR: Record<EstadoSolicitud, [string, string, string]> = {
  recibida: ['#b07400', '#fbe7c6', '#8a5300'],
  en_evaluacion: ['#00a19a', '#d9f7f5', '#00605b'],
  aprobada: ['#00a19a', '#d9f7f5', '#00605b'],
  en_desarrollo: ['#00a19a', '#d9f7f5', '#00605b'],
  entregada: ['#087b5d', '#d5f5e3', '#0c5132'],
  rechazada: ['#8a8a8a', '#ececec', '#4b5563'],
  cancelada: ['#8a8a8a', '#ececec', '#4b5563'],
};
const ICONO_TIPO: Record<TipoSolicitud, typeof IconPuzzle> = { modulo_nuevo: IconPuzzle, ajuste_modulo: IconAdjustments, campo_personalizado: IconForms, otro: IconDots };

/** Texto de cada transición. `motivo`: 'si' = el mensaje al cliente es obligatorio. */
const ACCION: Partial<Record<EstadoSolicitud, { texto: string; ayuda: string; motivo: 'si' | 'opcional'; icono: typeof IconPuzzle; peligro: boolean }>> = {
  en_evaluacion: { texto: 'Tomar y evaluar', ayuda: 'Quedás como responsable. El cliente ve que ya la están revisando.', motivo: 'opcional', icono: IconHandGrab, peligro: false },
  aprobada: { texto: 'Aprobar…', ayuda: 'Decidí si entra para todos o queda exclusiva (con costo) y contale al cliente qué se va a hacer.', motivo: 'si', icono: IconCircleCheck, peligro: false },
  rechazada: { texto: 'No aprobar…', ayuda: 'El cliente lee el motivo tal cual lo escribas.', motivo: 'si', icono: IconCircleX, peligro: true },
  en_desarrollo: { texto: 'Empezar desarrollo', ayuda: 'Desde acá el cliente ya no la puede retirar.', motivo: 'opcional', icono: IconCode, peligro: false },
  entregada: { texto: 'Marcar entregada…', ayuda: 'Si es un módulo, podés activárselo a la Empresa en el mismo paso.', motivo: 'opcional', icono: IconPackage, peligro: false },
  cancelada: { texto: 'Cancelar…', ayuda: 'Se cierra sin hacerse. El cliente lee el motivo.', motivo: 'si', icono: IconBan, peligro: true },
};

type Grupo = 'sin' | 'curso' | 'cerr';
type Filtro = 'abiertas' | 'sinasig' | 'mias' | 'espera';

/**
 * Solicitudes — cola + decisión (diseño `Solicitudes - Cola y decisión`).
 *
 * Lista: `listar({ pageSize: 100 })` + `resumen()`. Las agrupadas
 * (`agrupadaEn`) no aparecen: viven dentro de su principal.
 * Hoja: `obtener(id)` con `siguientes`, `agrupadas` y `eventos`.
 * Acciones: `cambiarEstado`, `asignar`, `agrupar`/`desagrupar`, `comentar`.
 */
@Component({
  selector: 'app-solicitudes-page',
  standalone: true,
  imports: [DatePipe, TablerIconComponent, CabeceraModuloComponent, PantallaEstadoComponent, ListaHojaComponent, HojaPestanasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitudes-page.component.html',
  host: { class: 'flex h-full flex-col overflow-hidden px-6 pt-6' },
})
export class SolicitudesPageComponent {
  private readonly servicio = inject(SolicitudesService);
  private readonly auth = inject(AuthService);
  private readonly alertas = inject(AlertaService);
  private readonly pista = inject(PistaService);
  private readonly router = inject(Router);

  protected readonly lista = viewChild(ListaHojaComponent);
  protected readonly hoy = new Date();
  protected readonly ESTADO = ESTADO_SOLICITUD;
  protected readonly TIPO = TIPO_SOLICITUD;
  protected readonly ACCION = ACCION;
  protected readonly COLOR = COLOR;
  protected readonly iconoTipo = ICONO_TIPO;
  protected readonly i = {
    modulo: IconBulb, arriba: IconChevronUp, abajo: IconChevronDown, tomar: IconHandGrab, mia: IconUserCheck, sinAsignar: IconUserQuestion,
    empresas: IconUsers, candado: IconLock, mensaje: IconMessage, enviar: IconSend, reloj: IconClock,
  };

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed(() => (this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo'));

  protected readonly todas = signal<SolicitudResumen[]>([]);
  protected readonly resumen = signal<ResumenSolicitudes | null>(null);
  protected readonly buscar = signal('');
  protected readonly filtro = signal<Filtro | null>(null);
  protected readonly orden = signal<'espera' | 'demanda'>('espera');
  protected readonly colapsados = signal<ReadonlySet<string>>(new Set(['cerr']));
  protected readonly seleccionadaId = signal<number | null>(null);
  protected readonly cerradasTotal = signal(0);
  private cerradasPagina = 1;
  protected readonly cargandoCerradas = signal(false);
  private busquedaTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly cambiosEnVivo = signal(0);
  protected readonly resaltadas = signal<ReadonlySet<number>>(new Set());
  private compararAlCargar = false;
  private readonly avisadas = new Set<number>();

  // Hoja
  protected readonly detalle = signal<SolicitudDetalle | null>(null);
  protected readonly pestana = signal<'conv' | 'det'>('conv');
  protected readonly pop = signal(false);
  protected readonly destino = signal<EstadoSolicitud | null>(null);
  protected readonly respuesta = signal('');
  protected readonly alcance = signal<AlcanceSolicitud>('para_todos');
  protected readonly costo = signal('');
  protected readonly fecha = signal('');
  protected readonly activarModulo = signal(true);
  protected readonly comentario = signal('');
  protected readonly modoComentario = signal<'visible' | 'interna'>('visible');

  private readonly yo = computed(() => this.auth.currentUser()?.id ?? null);
  private readonly visibles = computed(() => this.todas().filter((s) => !s.agrupadaEn));
  private readonly abiertas = computed(() => this.visibles().filter((s) => ABIERTAS.includes(s.estado)));
  protected readonly sel = computed(() => this.todas().find((s) => s.id === this.seleccionadaId()) ?? null);
  private espera = (s: SolicitudResumen) => -dias(s.creadoEn);

  private readonly filtradas = computed(() => {
    const term = this.buscar().trim().toLowerCase();
    const F: Record<Filtro, (s: SolicitudResumen) => boolean> = {
      abiertas: (s) => ABIERTAS.includes(s.estado),
      sinasig: (s) => ABIERTAS.includes(s.estado) && !s.asignadaA,
      mias: (s) => ABIERTAS.includes(s.estado) && s.asignadaA?.id === this.yo(),
      espera: (s) => s.estado === 'recibida' && this.espera(s) >= 7,
    };
    const f = this.filtro();
    return this.visibles().filter((s) => (!f || F[f](s)) && (!term || `${s.titulo} ${s.empresaNombre} ${s.id}`.toLowerCase().includes(term)));
  });

  protected readonly grupos = computed<GrupoLista[]>(() => {
    const grupoDe = (s: SolicitudResumen): Grupo => (s.estado === 'recibida' ? 'sin' : ABIERTAS.includes(s.estado) ? 'curso' : 'cerr');
    const META: Record<Grupo, Omit<GrupoLista, 'clave' | 'sub' | 'filas'>> = {
      sin: { titulo: 'Sin tomar', icono: IconInbox, color: '#b45309', fondo: '#fbe7c6' },
      curso: { titulo: 'En curso', icono: IconProgress, color: '#00605b', fondo: '#d9f7f5' },
      cerr: { titulo: 'Cerradas', icono: IconArchive, color: '#6b7280', fondo: '#e3e3e3' },
    };
    const ord = (k: Grupo) => (a: SolicitudResumen, b: SolicitudResumen) =>
      (this.orden() === 'demanda' ? b.interesadas - a.interesadas : 0) ||
      (k === 'curso' ? ABIERTAS.indexOf(b.estado) - ABIERTAS.indexOf(a.estado) : 0) ||
      (k === 'cerr' ? (a.actualizadoEn < b.actualizadoEn ? 1 : -1) : a.creadoEn < b.creadoEn ? -1 : 1);
    return (['sin', 'curso', 'cerr'] as Grupo[])
      .map((k): GrupoLista | null => {
        const l = [...this.filtradas().filter((s) => grupoDe(s) === k)].sort(ord(k));
        const faltan = k === 'cerr' ? this.cerradasTotal() - this.todas().filter((s) => !ABIERTAS.includes(s.estado) && !s.agrupadaEn).length : 0;
        const mas = faltan > 0 ? `Cargar ${Math.min(TAMANO_PAGINA, faltan)} más · ${pl(faltan, 'cerrada sin cargar', 'cerradas sin cargar')}` : null;
        return l.length || mas
          ? { clave: k, ...META[k], sub: l.length ? this.subGrupo(k, l) : '', filas: l.map((s) => this.fila(s, k)), mas, cargandoMas: k === 'cerr' && this.cargandoCerradas() }
          : null;
      })
      .filter((g) => g !== null);
  });

  private subGrupo(k: Grupo, l: SolicitudResumen[]): string {
    if (k === 'sin') {
      const max = Math.max(...l.map((s) => s.interesadas));
      return `la más vieja espera ${Math.max(...l.map(this.espera))} días${max > 1 ? ` · una la piden ${max} empresas` : ''}`;
    }
    if (k === 'curso') {
      const m = l.filter((s) => s.asignadaA?.id === this.yo()).length;
      return [m && pl(m, 'tuya', 'tuyas'), `${l.filter((s) => s.estado === 'en_desarrollo').length} en desarrollo`].filter(Boolean).join(' · ');
    }
    const e = l.filter((s) => s.estado === 'entregada').length;
    return `${pl(e, 'entregada', 'entregadas')} · ${l.length - e} sin hacerse`;
  }

  private fila(s: SolicitudResumen, k: Grupo): FilaLista {
    let gauge: FilaLista['gauge'];
    if (s.estado === 'en_desarrollo' && s.fechaCompromiso) {
      const d = dias(s.fechaCompromiso);
      gauge = { texto: d < 0 ? 'atrasada' : `en ${d} d`, ancho: Math.max(8, 100 - d * 7), color: d <= 3 ? '#b07400' : '#00a19a', tinta: d <= 3 ? '#b45309' : '#00605b' };
    } else if (k !== 'cerr') {
      const d = this.espera(s);
      gauge = { texto: d === 0 ? 'hoy' : `${d} d`, ancho: Math.min(100, Math.max(6, (d / 14) * 100)), color: d >= 10 ? '#d82c0d' : d >= 5 ? '#b07400' : '#303030', tinta: d >= 10 ? '#d82c0d' : d >= 5 ? '#b45309' : '#374151' };
    } else {
      gauge = { texto: fmt(s.actualizadoEn), ancho: null, color: '', tinta: '#9ca3af' };
    }
    const extra = s.interesadas > 1 ? ` + ${s.interesadas - 1}` : '';
    return { id: s.id, nombre: s.titulo, sub: `${s.empresaNombre}${extra} · ${k === 'curso' ? ESTADO_SOLICITUD[s.estado].texto : TIPO_SOLICITUD[s.tipo].texto}`, punto: COLOR[s.estado][0], gauge };
  }

  protected readonly badge = computed(() => pl(this.abiertas().length, 'abierta', 'abiertas'));
  protected readonly lectura = computed(() => {
    const ab = this.abiertas();
    const sinAsig = ab.filter((s) => !s.asignadaA).length;
    const vieja = [...ab].filter((s) => s.estado === 'recibida').sort((a, b) => (a.creadoEn < b.creadoEn ? -1 : 1))[0];
    const pedida = [...ab].sort((a, b) => b.interesadas - a.interesadas)[0];
    return `${pl(ab.length, 'solicitud abierta', 'solicitudes abiertas')}, ${sinAsig} sin asignar.` +
      (vieja ? ` La más vieja (${vieja.empresaNombre}) espera ${this.espera(vieja)} días.` : '') +
      (pedida && pedida.interesadas > 1 ? ` “${pedida.titulo}” la piden ${pedida.interesadas} empresas.` : '');
  });

  protected readonly metricas = computed<MetricaCabecera[]>(() => {
    const ab = this.abiertas();
    const r = this.resumen();
    const espMax = r?.esperaMaximaDias ?? Math.max(0, ...ab.filter((s) => s.estado === 'recibida').map(this.espera));
    const fechas = ab.map((s) => s.creadoEn);
    const nuevas = recientes(fechas);
    return [
      { id: 'abiertas', etiqueta: 'Abiertas', valor: ab.length, tono: 'neutro', serie: serieAcumulada(fechas), delta: nuevas ? `+${nuevas} esta semana` : null },
      { id: 'sinasig', etiqueta: 'Sin asignar', valor: ab.filter((s) => !s.asignadaA).length, tono: 'aviso', trazo: '#b07400' },
      { id: 'mias', etiqueta: 'Asignadas a mí', valor: ab.filter((s) => s.asignadaA?.id === this.yo()).length, tono: 'info', trazo: '#00a19a' },
      { id: 'espera', etiqueta: 'Espera máxima', valor: `${espMax} d`, tono: espMax >= 10 ? 'peligro' : 'neutro', delta: 'sin respuesta' },
    ];
  });

  protected readonly resultados = computed(() => pl(this.filtradas().length, 'solicitud', 'solicitudes'));
  protected readonly filtroTexto = computed(() => (this.filtro() ? { abiertas: 'Abiertas', sinasig: 'Sin asignar', mias: 'Asignadas a mí', espera: 'Esperan 7+ días' }[this.filtro()!] : null));
  protected readonly ordenIcono = computed(() => (this.orden() === 'espera' ? IconClock : IconUsers));
  protected readonly ordenTitulo = computed(() => (this.orden() === 'espera' ? 'Ordenado por espera · ordenar por demanda' : 'Ordenado por demanda · ordenar por espera'));

  constructor() {
    this.cargar();
    // Enlace de una notificación (`/solicitudes?id=N`, ver notificacion-catalogo).
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((q) => this.abrirDesdeEnlace(Number(q.get('id'))));
    inject(CambiosEnVivoService)
      .huboCambio(['solicitud'])
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cambiosEnVivo.update((n) => n + 1));
    effect(() => {
      const id = this.seleccionadaId();
      untracked(() => this.cargarDetalle(id));
    });
  }

  protected cargar(): void {
    this.cargando.set(this.todas().length === 0);
    this.error.set(null);
    // Más de 100 (2026-10-07): las abiertas completas (dependen de cuántos
    // clientes hay); las cerradas crecen sin tope: de a 100, las más recientes primero.
    forkJoin({
      abiertas: traerTodo((page, pageSize) => this.servicio.listar({ grupo: 'abiertas', page, pageSize })),
      cerradas: this.servicio.listar({ grupo: 'cerradas', page: 1, pageSize: TAMANO_PAGINA }),
      resumen: this.servicio.resumen(),
    }).subscribe({
      next: ({ abiertas, cerradas, resumen }) => {
        const lista = { data: [...abiertas.data, ...cerradas.data] };
        this.cerradasTotal.set(cerradas.total);
        this.cerradasPagina = 1;
        if (this.compararAlCargar) {
          this.compararAlCargar = false;
          this.resaltadas.set(filasCambiadas(this.todas(), lista.data, (s) => s.id));
          setTimeout(() => this.resaltadas.set(new Set()), 2000);
        }
        this.todas.set(lista.data);
        this.resumen.set(resumen);
        this.resolverEnlace();
        if (!this.sel()) this.seleccionadaId.set(this.grupos()[0]?.filas[0]?.id ?? null);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las solicitudes.');
        this.cargando.set(false);
      },
    });
  }

  /** Id pedido por enlace, hasta que la lista llega y se puede ubicar. */
  private enlaceId: number | null = null;

  private abrirDesdeEnlace(id: number): void {
    if (!id) return;
    this.enlaceId = id;
    this.resolverEnlace();
    void this.router.navigate([], { queryParams: { id: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /**
   * Elige la fila del enlace (o su principal, si está agrupada) y despliega
   * su grupo. Las agrupadas no vienen en el listado: se pide la solicitud
   * para saber en cuál quedó.
   */
  private resolverEnlace(): void {
    const pedido = this.enlaceId;
    if (!pedido || !this.todas().length) return;
    this.enlaceId = null;
    const s = this.todas().find((x) => x.id === pedido);
    if (s) return this.elegirEnlace(s.agrupadaEn?.id ?? s.id);
    this.servicio.obtener(pedido).subscribe({
      next: (d) => this.elegirEnlace(d.agrupadaEn?.id ?? d.id),
      error: () => this.alertas.mostrar({ estado: 'warning', titulo: `No se encontró la solicitud #${pedido}` }),
    });
  }

  private elegirEnlace(id: number): void {
    this.seleccionadaId.set(id);
    const g = this.grupos().find((x) => x.filas.some((f) => f.id === id));
    if (g) this.colapsados.update((c) => { const n = new Set(c); n.delete(g.clave); return n; });
  }

  private cargarDetalle(id: number | null): void {
    this.pop.set(false);
    this.destino.set(null);
    this.respuesta.set('');
    this.comentario.set('');
    if (this.detalle()?.id !== id) this.detalle.set(null);
    if (!id) return;
    this.servicio.obtener(id).subscribe((d) => {
      if (this.seleccionadaId() !== id) return;
      this.detalle.set(d);
      this.avisar(d);
    });
  }

  /** Una sola vez por solicitud: recibida que espera 10 días o más. */
  private avisar(d: SolicitudDetalle): void {
    const e = -dias(d.creadoEn);
    if (d.estado !== 'recibida' || e < 10 || this.avisadas.has(d.id)) return;
    this.avisadas.add(d.id);
    this.alertas.mostrar({ estado: 'warning', titulo: `Lleva ${e} días sin respuesta`, texto: `${d.empresaNombre}. Tomala o asignala.` });
  }

  private aplicarDetalle(d: SolicitudDetalle): void {
    this.detalle.set(d);
    this.todas.update((xs) => xs.map((s) => (s.id === d.id ? { ...s, ...d } : s)));
  }

  protected actualizar(): void {
    this.cambiosEnVivo.set(0);
    this.compararAlCargar = true;
    this.cargar();
    const id = this.seleccionadaId();
    if (id) this.cargarDetalle(id);
  }
  protected seleccionar(id: number): void {
    this.seleccionadaId.set(id);
  }
  protected alternarMetrica(id: string): void {
    this.filtro.update((f) => (f === id ? null : (id as Filtro)));
  }
  protected alternarGrupo(c: string): void {
    this.colapsados.update((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  }
  protected alternarOrden(): void {
    this.orden.update((o) => (o === 'espera' ? 'demanda' : 'espera'));
  }
  /** "Cargar más" de Cerradas. */
  protected cargarMas(clave: string): void {
    if (clave !== 'cerr' || this.cargandoCerradas()) return;
    this.cargandoCerradas.set(true);
    this.servicio.listar({ grupo: 'cerradas', page: this.cerradasPagina + 1, pageSize: TAMANO_PAGINA }).subscribe({
      next: (r) => {
        this.cerradasPagina++;
        this.cerradasTotal.set(r.total);
        this.sumar(r.data);
        this.cargandoCerradas.set(false);
      },
      error: () => {
        this.cargandoCerradas.set(false);
        this.alertas.mostrar({ estado: 'error', titulo: 'No se pudieron cargar más solicitudes', texto: 'Intentá de nuevo.' });
      },
    });
  }

  /**
   * Buscar también en las cerradas que no están cargadas: con 2 letras o
   * más se piden al servidor y se suman a la lista (el filtro de siempre
   * hace el resto).
   */
  protected cambiarBusqueda(texto: string): void {
    this.buscar.set(texto);
    clearTimeout(this.busquedaTimer);
    const term = texto.trim();
    if (term.length < 2) return;
    this.busquedaTimer = setTimeout(() => {
      traerTodo((page, pageSize) => this.servicio.listar({ grupo: 'cerradas', buscar: term, page, pageSize }), 500).subscribe({
        next: (r) => this.sumar(r.data),
        error: () => undefined,
      });
    }, 300);
  }

  private sumar(nuevas: SolicitudResumen[]): void {
    this.todas.update((xs) => [...xs, ...nuevas.filter((n) => !xs.some((x) => x.id === n.id))]);
  }

  protected limpiar(): void {
    this.filtro.set(null);
    this.buscar.set('');
  }

  /** La recibida sin asignar más vieja → en evaluación, asignada a mí. */
  protected tomarSiguiente(): void {
    const s = [...this.visibles()].filter((x) => x.estado === 'recibida' && !x.asignadaA).sort((a, b) => (a.creadoEn < b.creadoEn ? -1 : 1))[0];
    if (!s) {
      this.alertas.mostrar({ estado: 'info', titulo: 'No queda nada sin tomar' });
      return;
    }
    this.seleccionadaId.set(s.id);
    this.ejecutar(s.id, s.empresaNombre, { estado: 'en_evaluacion' });
  }

  // ── Hoja ──────────────────────────────────────────────────────────────

  protected readonly cerrada = computed(() => !!this.sel() && !ABIERTAS.includes(this.sel()!.estado));
  protected readonly esMia = computed(() => this.sel()?.asignadaA?.id === this.yo());

  protected readonly pasos = computed(() => {
    const d = this.detalle();
    const s = this.sel();
    if (!s) return [];
    const cerradaSin = this.cerrada() && s.estado !== 'entregada';
    const ultimo = d ? [...d.eventos].reverse().find((e) => e.tipo === 'estado' && e.estadoAnterior)?.estadoAnterior ?? 'recibida' : 'recibida';
    const hasta = cerradaSin ? PASOS.indexOf(ultimo) : PASOS.indexOf(s.estado);
    const lista = cerradaSin ? [...PASOS.slice(0, hasta + 1), s.estado] : PASOS;
    const fechaPaso = (p: EstadoSolicitud) => { const e = d?.eventos.find((x) => x.tipo === 'estado' && x.estadoNuevo === p); return e ? fmt(e.creadoEn) : ''; };
    return lista.map((p, k) => {
      const fin = k === lista.length - 1 && this.cerrada();
      const actual = !this.cerrada() && k === hasta;
      const hecho = k < hasta || (this.cerrada() && k <= hasta) || fin;
      const color = fin ? (s.estado === 'entregada' ? '#087b5d' : '#8a8a8a') : actual ? '#2be0d5' : hecho ? '#303030' : '#ececec';
      return { texto: ESTADO_SOLICITUD[p].texto, titulo: `${ESTADO_SOLICITUD[p].texto}${fechaPaso(p) ? ' · ' + fechaPaso(p) : ''}`, color, fuerte: actual || fin, hecho };
    });
  });

  protected readonly acciones = computed(() =>
    (this.detalle()?.siguientes ?? []).filter((e) => ACCION[e]).map((e) => ({ estado: e, ...ACCION[e]! })),
  );

  protected iniciar(e: EstadoSolicitud): void {
    const s = this.sel()!;
    this.destino.set(e);
    this.respuesta.set('');
    this.alcance.set(s.alcance ?? 'para_todos');
    this.costo.set(s.costoMensual ? String(s.costoMensual) : '');
    this.fecha.set(s.fechaCompromiso ?? '');
    this.activarModulo.set(true);
  }

  protected readonly valido = computed(() => {
    const d = this.destino();
    if (!d) return false;
    if (ACCION[d]?.motivo === 'si' && !this.respuesta().trim()) return false;
    if (d === 'aprobada' && this.alcance() === 'exclusiva' && !(parseInt(this.costo().replace(/\D/g, ''), 10) > 0)) return false;
    return true;
  });

  protected confirmar(): void {
    const s = this.sel();
    const d = this.destino();
    if (!s || !d || !this.valido()) return;
    const payload: CambioEstadoPayload = { estado: d, respuesta: this.respuesta().trim() || undefined };
    if (d === 'aprobada') {
      payload.alcance = this.alcance();
      if (this.alcance() === 'exclusiva') {
        payload.costoMensual = parseInt(this.costo().replace(/\D/g, ''), 10);
        payload.fechaCompromiso = this.fecha() || undefined;
      }
    }
    if (d === 'entregada' && s.modulo) payload.activarModulo = this.activarModulo();
    this.pop.set(false);
    this.destino.set(null);
    this.ejecutar(s.id, s.empresaNombre, payload);
  }

  private ejecutar(id: number, empresa: string, payload: CambioEstadoPayload): void {
    const T: Partial<Record<EstadoSolicitud, [string, string]>> = {
      en_evaluacion: ['Tomando la solicitud', 'Quedaste como responsable.'], aprobada: ['Aprobando', 'Solicitud aprobada'], rechazada: ['Cerrando la solicitud', 'Solicitud no aprobada'],
      en_desarrollo: ['Pasando a desarrollo', 'En desarrollo'], entregada: ['Marcando entregada', 'Solicitud entregada'], cancelada: ['Cancelando', 'Solicitud cancelada'],
    };
    const [cargando, listo] = T[payload.estado] ?? ['Guardando', 'Listo'];
    const alerta = this.alertas.mostrar({ titulo: cargando, texto: `#${id} · ${empresa}` });
    this.servicio.cambiarEstado(id, payload).subscribe({
      next: (d) => {
        this.aplicarDetalle(d);
        this.alertas.resolver(alerta, { estado: 'success', titulo: payload.estado === 'en_evaluacion' ? 'Solicitud tomada' : listo, texto: payload.estado === 'entregada' && payload.activarModulo ? `${d.modulo?.nombre} quedó activo en ${empresa}.` : empresa });
        // "Tomar y evaluar" asigna a quien la toma si no tenía responsable.
        if (payload.estado === 'en_evaluacion' && !d.asignadaA && this.yo()) this.servicio.asignar(id, this.yo()).subscribe((x) => this.aplicarDetalle(x));
      },
      error: () =>
        this.alertas.resolver(alerta, {
          estado: 'error', titulo: 'No se pudo cambiar el estado', texto: 'No se cambió nada.',
          accion: { label: 'Reintentar', ejecutar: () => { this.alertas.cerrar(alerta); this.ejecutar(id, empresa, payload); } },
        }),
    });
  }

  protected alternarAsignacion(): void {
    const s = this.sel();
    if (!s || this.cerrada()) return;
    const mia = this.esMia();
    this.servicio.asignar(s.id, mia ? null : this.yo()).subscribe({
      next: (d) => {
        this.aplicarDetalle(d);
        this.pista.hecho(mia ? `#${s.id} quedó sin asignar` : `#${s.id} ahora es tuya`);
      },
      error: () => this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo asignar' }),
    });
  }

  protected copiarId(): void {
    const id = this.sel()?.id;
    if (!id) return;
    navigator.clipboard?.writeText(String(id)).catch(() => undefined);
    this.pista.hecho(`Solicitud #${id} copiada`);
  }

  protected readonly pestanas = computed<PestanaHoja[]>(() => [
    { clave: 'conv', texto: 'Conversación', cuenta: this.detalle()?.eventos.length ?? null },
    { clave: 'det', texto: 'Detalle', cuenta: this.sel()?.interesadas ?? null },
  ]);
  protected elegirPestana(c: string): void {
    this.pestana.set(c as 'conv' | 'det');
  }

  protected readonly eventos = computed(() => {
    const d = this.detalle();
    if (!d) return [];
    return d.eventos.map((e, k) => {
      const creo = e.tipo === 'estado' && !e.estadoAnterior;
      const autor = e.autor?.id === this.yo() ? 'Vos' : (e.autor?.nombre ?? 'Sistema') + (e.deGoods ? '' : ` · ${d.empresaNombre}`);
      return {
        id: e.id, ini: iniciales(e.autor?.nombre ?? 'G O'), deGoods: e.deGoods, autor,
        accion: creo ? 'creó la solicitud' : e.tipo === 'estado' ? 'la pasó a' : e.visibleCliente ? (e.deGoods ? 'respondió' : 'escribió') : 'dejó una nota',
        estado: e.tipo === 'estado' && !creo && e.estadoNuevo ? e.estadoNuevo : null,
        interna: !e.visibleCliente, fecha: fmt(e.creadoEn),
        texto: creo ? d.descripcion : e.texto,
        burbuja: !e.visibleCliente ? 'bg-[#fff4dc]' : e.deGoods ? 'bg-[#e6fbf9]' : 'bg-[#f4f4f4]',
        nuevo: k === d.eventos.length - 1 && this.resaltadas().has(d.id),
      };
    });
  });

  protected comentar(): void {
    const s = this.sel();
    const texto = this.comentario().trim();
    if (!s || !texto) return;
    const visible = this.modoComentario() === 'visible';
    this.comentario.set('');
    this.alertas
      .seguir(this.servicio.comentar(s.id, texto, visible), {
        titulo: visible ? 'Enviando respuesta' : 'Guardando nota interna', texto: s.empresaNombre,
        exito: { titulo: visible ? 'Respuesta enviada' : 'Nota guardada', texto: visible ? 'La ven en Solicitudes a Goods.' : 'Solo la ve el equipo de Goods.' },
        error: { titulo: 'No se pudo enviar', texto: 'El texto quedó en la caja.' },
      })
      .subscribe({ next: (d) => this.aplicarDetalle(d), error: () => this.comentario.set(texto) });
  }

  protected readonly datos = computed(() => {
    const s = this.sel();
    if (!s) return [];
    return [
      { k: 'Tipo', v: TIPO_SOLICITUD[s.tipo].texto },
      { k: 'Módulo', v: s.modulo?.nombre ?? '—' },
      { k: 'Alcance', v: s.alcance ? (s.alcance === 'exclusiva' ? `Exclusiva · ${plata(s.costoMensual ?? 0)}/mes${s.fechaCompromiso ? ' · para el ' + fmt(s.fechaCompromiso) : ''}` : 'Para todos') : 'Se decide al aprobar' },
      { k: 'Responsable', v: this.esMia() ? 'Vos' : (s.asignadaA?.nombre ?? 'Nadie todavía') },
      { k: 'Creada', v: `${fmtY(s.creadoEn)} · ${s.creadaPor?.nombre ?? '—'}` },
    ];
  });

  /** Otras abiertas del mismo tipo y módulo, sin agrupar. */
  protected readonly parecidas = computed(() => {
    const s = this.sel();
    if (!s || this.cerrada() || !s.modulo) return [];
    return this.visibles().filter((x) => x.id !== s.id && ABIERTAS.includes(x.estado) && x.tipo === s.tipo && x.modulo?.id === s.modulo?.id);
  });

  protected agrupar(otra: SolicitudResumen): void {
    const s = this.sel()!;
    this.alertas
      .seguir(this.servicio.agrupar(otra.id, s.id), {
        titulo: 'Sumando solicitud', texto: `${otra.empresaNombre} → #${s.id}`,
        exito: { titulo: 'Solicitudes sumadas', texto: `${s.titulo} ahora la piden más empresas.` },
        error: { titulo: 'No se pudo sumar', texto: 'Intentá de nuevo.' },
      })
      .subscribe({ next: () => { this.cargar(); this.cargarDetalle(s.id); }, error: () => undefined });
  }

  protected separar(id: number, empresa: string): void {
    const s = this.sel()!;
    this.alertas
      .seguir(this.servicio.desagrupar(id), {
        titulo: 'Separando solicitud', texto: empresa,
        exito: { titulo: 'Solicitud separada', texto: `${empresa} vuelve a la cola por su cuenta.` },
        error: { titulo: 'No se pudo separar', texto: 'Intentá de nuevo.' },
      })
      .subscribe({ next: () => { this.cargar(); this.cargarDetalle(s.id); }, error: () => undefined });
  }

  protected readonly hace = hace;

  protected volver(): void {
    this.router.navigateByUrl('/solicitudes');
  }
}
