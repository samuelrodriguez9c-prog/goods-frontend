// projects/staff/src/app/features/soporte/pages/soporte-page/soporte-page.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconArrowBackUp,
  IconArrowUpRight,
  IconCheck,
  IconChevronDown,
  IconCircleCheck,
  IconClock,
  IconCornerDownLeft,
  IconCornerUpLeft,
  IconHandGrab,
  IconHeadset,
  IconHourglass,
  IconInbox,
  IconInfoCircle,
  IconLock,
  IconMessageCircle2,
  IconMoodEmpty,
  IconSearch,
  IconUser,
  IconUserCheck,
  IconUserQuestion,
  IconUsers,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { Subscription, finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { RealtimeService } from '../../../../core/realtime/realtime.service';
import { ChatService } from '../../../../core/chat/chat.service';
import {
  ChatUsuario,
  Conversacion,
  EventoConversacionAsignada,
  EventoMensajeNuevo,
  Mensaje,
} from '../../../../core/chat/models/conversacion.model';
import { UsuarioService } from '../../../../core/usuarios/usuario.service';
import { UsuarioGoods } from '../../../../core/usuarios/models/usuario.model';
import {
  CabeceraModuloComponent,
  MetricaCabecera,
  serieConteo,
} from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';

const MS_MINUTO = 60_000;
const MS_HORA = 3_600_000;
/** Desde 2 h la espera se marca más oscura (sin rojo, ver LEEME §15). */
const ESPERA_LARGA_MIN = 120;
/** Ventana en la que una fila/mensaje "recién llegado" anima su entrada. */
const MS_ANIMACION = 1_500;

type GrupoId = 'sin_asignar' | 'mias' | 'equipo' | 'cerradas';

/** Avatares con iniciales: 6 pares fondo/tinta tomados de la paleta de badges. */
const PALETA: readonly (readonly [string, string])[] = [
  ['#e0f0ff', '#075985'],
  ['#fff1e3', '#9a3412'],
  ['#eaf4ec', '#0c5132'],
  ['#f3ecff', '#5b21b6'],
  ['#fde8ec', '#9f1239'],
  ['#fef6d8', '#854d0e'],
];

/**
 * `ultimoMensaje` es OPCIONAL: hoy `GET /chat/conversaciones` no lo trae.
 * Con él la lista muestra la vista previa y "Te toca responder"; sin él
 * cae al correo del cliente y a "Asignada a vos". Ver LEEME §15.
 */
type ConversacionBandeja = Conversacion & {
  ultimoMensaje?: { autorId: number | null; cuerpo: string; esSistema: boolean; creadoEn: string } | null;
};

interface Chip {
  texto: string;
  icono: typeof IconClock;
  fondo: string;
  tinta: string;
}

/**
 * Bandeja de soporte (§7.2/§8 de `PIVOTE_SAAS_MULTITENANT.md`) — rediseño
 * de LEEME §15. El backend (`modules/chat/`) sigue igual (conversaciones
 * tipo ticket, bandeja compartida con auto-asignación al primero que
 * responde, tiempo real vía `RealtimeGateway`) — ver `ChatService`
 * (frontend) y la migración `AjustarPermisosDeConversacionesPorRol`
 * (2026-09-23), que le dio `conversaciones.ver`/`conversaciones.gestionar`
 * a los roles de staff reales (antes solo los tenía el rol `admin` viejo).
 *
 * El widget del lado del cliente (`admin`, para que una Empresa pueda
 * ABRIR una conversación) todavía no existe — pendiente explícito,
 * decidido junto con el usuario el 2026-09-23: por ahora nadie puede
 * escribir del lado del cliente salvo por API directa. Esta pantalla no
 * depende de eso: lee/responde lo que ya haya en la bandeja.
 *
 * Misma lógica de permisos y de asignación que la versión anterior
 * (`puedeEscribir`, `puedeAsignarme`, `puedeDevolver`, `reasignarA`,
 * refrescos silenciosos): lo nuevo acá es la lista agrupada y plegable
 * (Sin asignar / Mías / Con el equipo / Resueltas), la búsqueda, el
 * control único de asignación (reemplaza Asignarme/Devolver/Asignar a
 * otro de tres botones sueltos), los atajos de teclado (J/K, R, A, /), el
 * aviso de mensaje entrante de otra conversación, y animaciones
 * selectivas: solo lo que llega EN VIVO anima (mensajes/filas nuevos),
 * no cada carga de hilo.
 *
 * `ultimoMensaje` en `ConversacionBandeja` es OPCIONAL y hoy el backend
 * (`GET /chat/conversaciones`) no lo manda — se deja pendiente a
 * propósito (LEEME §15, "A revisar al integrar", punto 1: requeriría una
 * subconsulta del último mensaje en `ChatService.listarBandeja`). Sin él
 * la vista previa de cada fila cae al correo del cliente y el chip de
 * "Mías" muestra "Asignada a vos" en vez de "Te toca responder"/
 * "Esperando al cliente" — degradación explícitamente contemplada en el
 * handoff, no un bug. La UI ya queda lista para consumirlo el día que se
 * agregue esa subconsulta.
 */
@Component({
  selector: 'app-soporte-page',
  standalone: true,
  imports: [FormsModule, TablerIconComponent, CabeceraModuloComponent, PantallaEstadoComponent],
  templateUrl: './soporte-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoportePageComponent implements OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly usuarioService = inject(UsuarioService);

  protected readonly i = {
    modulo: IconHeadset,
    buscar: IconSearch,
    x: IconX,
    chevron: IconChevronDown,
    reloj: IconClock,
    abrir: IconArrowUpRight,
    ok: IconCircleCheck,
    check: IconCheck,
    asignarme: IconUserCheck,
    devolver: IconArrowBackUp,
    tomar: IconHandGrab,
    candado: IconLock,
    citar: IconCornerUpLeft,
    enviar: IconCornerDownLeft,
    toast: IconMessageCircle2,
    vacio: IconMoodEmpty,
    sinAgente: IconUserQuestion,
    info: IconInfoCircle,
  };
  private readonly iconosGrupo: Record<GrupoId, typeof IconInbox> = {
    sin_asignar: IconInbox,
    mias: IconUserCheck,
    equipo: IconUsers,
    cerradas: IconCircleCheck,
  };
  private readonly iconosSistema = { asignada: IconUserCheck, tomada: IconHandGrab, devuelta: IconArrowBackUp, cerrada: IconCircleCheck };

  // ── Permisos (idénticos a la versión anterior) ──────────────────────────
  protected readonly miId = computed(() => this.authService.currentUser()?.id ?? null);
  protected readonly puedeGestionar = computed(() =>
    (this.authService.currentUser()?.permisos ?? []).includes('conversaciones.gestionar'),
  );
  protected readonly esAdminOAdminGoods = computed(() =>
    ['admin', 'admin_goods'].includes(this.authService.currentUser()?.rol?.nombre ?? ''),
  );
  protected readonly puedeEscribir = computed(() => {
    const c = this.seleccionada();
    if (!c || c.estado === 'cerrada') {
      return false;
    }
    return !c.agenteAsignadoId || c.agenteAsignadoId === this.miId();
  });
  protected readonly puedeAsignarme = computed(() => {
    const c = this.seleccionada();
    if (!c || c.estado === 'cerrada' || !this.esAdminOAdminGoods()) {
      return false;
    }
    return c.agenteAsignadoId !== this.miId();
  });
  protected readonly puedeDevolver = computed(() => {
    const c = this.seleccionada();
    if (!c || !this.esAdminOAdminGoods()) {
      return false;
    }
    return c.agenteAsignadoId === this.miId() && c.agenteAnteriorId !== null;
  });
  /** El control de asignación solo abre menú para admin/admin_goods; para
   * el resto del staff es una etiqueta de solo lectura. */
  protected readonly menuHabilitado = computed(
    () => this.esAdminOAdminGoods() && this.puedeGestionar() && this.seleccionada()?.estado === 'abierta',
  );

  // ── Estado ──────────────────────────────────────────────────────────────
  protected readonly conversaciones = signal<ConversacionBandeja[]>([]);
  protected readonly seleccionadaId = signal<number | null>(null);
  protected readonly mensajes = signal<Mensaje[]>([]);
  protected readonly filtro = signal<GrupoId | null>(null);
  protected readonly busqueda = signal('');
  protected readonly plegados = signal<Record<GrupoId, boolean>>({ sin_asignar: false, mias: false, equipo: false, cerradas: true });
  protected readonly mensajeNuevo = signal('');
  protected readonly respondiendoA = signal<Mensaje | null>(null);
  /** Última cita mostrada — se conserva mientras la barra se pliega, para
   * que el texto no desaparezca antes que la animación. */
  protected readonly citaVisible = signal<Mensaje | null>(null);
  protected readonly composerConFoco = signal(false);

  protected readonly staffAsignable = signal<UsuarioGoods[]>([]);
  protected readonly cargandoStaffAsignable = signal(false);
  protected readonly menuAbierto = signal(false);

  /** Conversaciones con actividad que todavía no abriste (punto azul). */
  protected readonly nuevas = signal<ReadonlySet<number>>(new Set());
  /** ids de mensajes/filas que llegaron en vivo — son los únicos que animan. */
  private readonly recientes = signal<ReadonlySet<number>>(new Set());
  private readonly filasRecientes = signal<ReadonlySet<number>>(new Set());
  protected readonly toast = signal<{ id: number; cliente: string; texto: string } | null>(null);
  protected readonly ultimoToast = signal<{ id: number; cliente: string; texto: string } | null>(null);
  /** Reloj para los tiempos relativos ("38 min") — se refresca cada 30 s. */
  private readonly ahora = signal(Date.now());

  protected readonly cargando = signal(true);
  protected readonly cargandoHilo = signal(false);
  protected readonly enviando = signal(false);
  protected readonly asignando = signal(false);
  protected readonly cerrando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  private mensajeSub: Subscription | undefined;
  private asignadaSub: Subscription | undefined;
  private reloj: ReturnType<typeof setInterval> | undefined;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private primeraCargaHilo = true;

  @ViewChild('inputMensaje') private readonly inputMensajeRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('hiloScroll') private readonly hiloScrollRef?: ElementRef<HTMLDivElement>;
  @ViewChild('buscador') private readonly buscadorRef?: ElementRef<HTMLInputElement>;

  // ── Derivados ───────────────────────────────────────────────────────────
  protected readonly abiertas = computed(() => this.conversaciones().filter((c) => c.estado === 'abierta'));
  protected readonly sinAsignar = computed(() =>
    this.abiertas()
      .filter((c) => c.agenteAsignadoId === null)
      .sort((a, b) => Date.parse(a.creadoEn) - Date.parse(b.creadoEn)),
  );
  protected readonly mias = computed(() => this.abiertas().filter((c) => c.agenteAsignadoId === this.miId()));
  protected readonly conEquipo = computed(() =>
    this.abiertas().filter((c) => c.agenteAsignadoId !== null && c.agenteAsignadoId !== this.miId()),
  );
  protected readonly cerradas = computed(() => this.conversaciones().filter((c) => c.estado === 'cerrada'));
  private readonly teToca = computed(() => this.mias().filter((c) => this.clienteHabloUltimo(c)));

  protected readonly masVieja = computed(() => {
    const c = this.sinAsignar()[0];
    if (!c) {
      return null;
    }
    const min = this.minutosDesde(c.creadoEn);
    const [fondo, tinta] = this.paleta(c.id);
    return {
      id: c.id,
      cliente: this.nombreCliente(c),
      iniciales: this.iniciales(this.nombreCliente(c)),
      fondo,
      tinta,
      espera: this.duracion(min),
      larga: min >= ESPERA_LARGA_MIN,
    };
  });

  /** Cabecera compartida (LEEME.md §14). Migrada a v2 (badge "En vivo" +
   *  serie) por LEEME.md §16, 2026-09-24 — series por `creadoEn`
   *  (`serieConteo(…, 8, 3)`, 8 cubos de 3 h = últimas 24 h) para las tres
   *  colas activas, y por `cerradaEn` (`serieConteo(…, 8, 24)`) para
   *  Resueltas, tal como lo pide la tabla del handoff. */
  protected readonly metricasCabecera = computed<MetricaCabecera[]>(() => {
    const vieja = this.masVieja();
    const hoy = new Date().toDateString();
    const cerradasConFecha = this.cerradas().filter((c): c is typeof c & { cerradaEn: string } => !!c.cerradaEn);
    const resueltasHoy = cerradasConFecha.filter((c) => new Date(c.cerradaEn).toDateString() === hoy).length;
    const agentes = new Set(this.conEquipo().map((c) => c.agenteAsignadoId)).size;
    return [
      {
        id: 'sin_asignar',
        etiqueta: 'Sin asignar',
        titulo: 'Abiertas que nadie tomó todavía',
        valor: this.sinAsignar().length,
        tono: this.sinAsignar().length ? 'aviso' : 'neutro',
        delta: vieja ? `la más vieja ${vieja.espera}` : 'bandeja al día',
        deltaTono: vieja ? 'aviso' : 'exito',
        serie: serieConteo(this.sinAsignar().map((c) => c.creadoEn), 8, 3),
      },
      {
        id: 'mias',
        etiqueta: 'Mías',
        titulo: 'Asignadas a vos',
        valor: this.mias().length,
        delta: this.teToca().length ? `${this.teToca().length} te toca responder` : null,
        deltaTono: 'info',
        serie: serieConteo(this.mias().map((c) => c.creadoEn), 8, 3),
      },
      {
        id: 'equipo',
        etiqueta: 'Con el equipo',
        titulo: 'Asignadas a otros agentes',
        valor: this.conEquipo().length,
        delta: agentes ? `${agentes} ${agentes === 1 ? 'agente' : 'agentes'}` : null,
        deltaTono: 'apagado',
        serie: serieConteo(this.conEquipo().map((c) => c.creadoEn), 8, 3),
      },
      {
        id: 'cerradas',
        etiqueta: 'Resueltas',
        titulo: 'Conversaciones cerradas',
        valor: this.cerradas().length,
        tono: 'apagado',
        delta: resueltasHoy ? `+${resueltasHoy} hoy` : null,
        serie: serieConteo(cerradasConFecha.map((c) => c.cerradaEn), 8, 24),
      },
    ];
  });

  protected readonly grupos = computed(() => {
    this.ahora();
    const q = this.busqueda().trim().toLowerCase();
    const coincide = (c: ConversacionBandeja) =>
      !q ||
      this.nombreCliente(c).toLowerCase().includes(q) ||
      (c.usuario?.correo ?? '').toLowerCase().includes(q) ||
      (c.ultimoMensaje?.cuerpo ?? '').toLowerCase().includes(q);
    const porActividad = (l: ConversacionBandeja[]) =>
      [...l].sort((a, b) => Date.parse(b.actualizadoEn) - Date.parse(a.actualizadoEn));
    const plegados = this.plegados();

    const def: { id: GrupoId; titulo: string; lista: ConversacionBandeja[]; iconoFondo: string; iconoTinta: string; cuentaFondo: string; cuentaTinta: string; meta: string }[] = [
      {
        id: 'sin_asignar',
        titulo: 'Sin asignar',
        lista: this.sinAsignar().filter(coincide),
        iconoFondo: '#fff1e3', iconoTinta: '#9a3412', cuentaFondo: '#fff1e3', cuentaTinta: '#9a3412',
        meta: this.masVieja() ? `la más vieja espera ${this.masVieja()!.espera}` : '',
      },
      {
        id: 'mias',
        titulo: 'Mías',
        lista: porActividad(this.mias().filter(coincide)),
        iconoFondo: '#303030', iconoTinta: '#fff', cuentaFondo: '#ebebeb', cuentaTinta: '#303030',
        meta: this.teToca().length ? `${this.teToca().length} esperan tu respuesta` : 'todas respondidas',
      },
      {
        id: 'equipo',
        titulo: 'Con el equipo',
        lista: porActividad(this.conEquipo().filter(coincide)),
        iconoFondo: '#e0f0ff', iconoTinta: '#075985', cuentaFondo: '#ebebeb', cuentaTinta: '#303030',
        meta: [...new Set(this.conEquipo().map((c) => c.agenteAsignado?.nombres).filter(Boolean))].join(', '),
      },
      {
        id: 'cerradas',
        titulo: 'Resueltas',
        lista: porActividad(this.cerradas().filter(coincide)),
        iconoFondo: '#eaf4ec', iconoTinta: '#0c5132', cuentaFondo: '#f1f1f1', cuentaTinta: '#616161',
        meta: 'solo lectura',
      },
    ];

    return def
      .filter((g) => (!this.filtro() || g.id === this.filtro()) && g.lista.length)
      .map((g) => ({
        ...g,
        icono: this.iconosGrupo[g.id],
        abierto: q ? true : !plegados[g.id],
        items: g.lista.map((c) => this.fila(c)),
      }));
  });

  /** Orden visible (solo grupos desplegados) — para J/K. */
  private readonly ordenVisible = computed(() =>
    this.grupos().flatMap((g) => (g.abierto ? g.items.map((f) => f.id) : [])),
  );

  protected readonly seleccionada = computed(
    () => this.conversaciones().find((c) => c.id === this.seleccionadaId()) ?? null,
  );

  protected readonly cabeceraHilo = computed(() => {
    const c = this.seleccionada();
    if (!c) {
      return null;
    }
    this.ahora();
    const [fondo, tinta] = this.paleta(c.id);
    const agente = this.nombreAgente(c);
    const esMia = c.agenteAsignadoId === this.miId();
    return {
      cliente: this.nombreCliente(c),
      correo: c.usuario?.correo ?? `Usuario #${c.usuarioId}`,
      iniciales: this.iniciales(this.nombreCliente(c)),
      fondo,
      tinta,
      desde: this.relativo(c.creadoEn, true),
      agente,
      agenteIniciales: agente ? this.iniciales(agente) : '',
      agenteTexto: agente ? (esMia ? 'Vos' : agente) : 'Sin asignar',
      esMia,
    };
  });

  protected readonly hilo = computed(() => {
    const lista = this.mensajes();
    const c = this.seleccionada();
    const recientes = this.recientes();
    return lista.map((m, idx) => {
      const prev = lista[idx - 1];
      const mio = !!c && m.autorId !== c.usuarioId;
      const agrupado =
        !!prev &&
        !prev.esSistema &&
        !m.esSistema &&
        prev.autorId === m.autorId &&
        Date.parse(m.creadoEn) - Date.parse(prev.creadoEn) < 10 * MS_MINUTO;
      return {
        m,
        mio,
        propio: m.autorId === this.miId(),
        agrupado,
        autor: this.nombreDeAutor(m.autor, m.autorId),
        hora: this.horaCorta(m.creadoEn),
        icono: m.esSistema ? this.iconoSistema(m.cuerpo) : null,
        animar: recientes.has(m.id),
      };
    });
  });

  protected readonly staffConCarga = computed(() =>
    this.staffAsignable().map((u) => ({
      ...u,
      iniciales: this.iniciales(`${u.nombres} ${u.apellidos}`),
      carga: this.abiertas().filter((c) => c.agenteAsignadoId === u.id).length,
      esYo: u.id === this.miId(),
    })),
  );

  protected readonly notaComposer = computed(() =>
    this.seleccionada()?.agenteAsignadoId ? 'Enter envía · Shift+Enter salto de línea' : 'Al responder, la conversación queda asignada a vos.',
  );

  constructor() {
    this.cargarBandeja();
    this.escucharTiempoReal();
    this.reloj = setInterval(() => this.ahora.set(Date.now()), 30_000);
    // Primera carga del hilo: salto instantáneo al final. Mensajes nuevos:
    // scroll suave, así la burbuja se ve entrar.
    effect(() => {
      this.mensajes();
      const suave = !this.primeraCargaHilo;
      this.primeraCargaHilo = false;
      setTimeout(() => this.scrollAlFinal(suave), 30);
    });
  }

  ngOnDestroy(): void {
    this.mensajeSub?.unsubscribe();
    this.asignadaSub?.unsubscribe();
    clearInterval(this.reloj);
    clearTimeout(this.toastTimer);
  }

  // ── Teclado y clic afuera ───────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  protected atajo(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement).tagName;
    if (e.key === 'Escape') {
      this.menuAbierto.set(false);
      this.cancelarRespuesta();
      (e.target as HTMLElement).blur?.();
      return;
    }
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }
    const ids = this.ordenVisible();
    const pos = ids.indexOf(this.seleccionadaId() ?? -1);
    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (ids[pos + 1] !== undefined) this.seleccionar(ids[pos + 1]);
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (pos > 0) this.seleccionar(ids[pos - 1]);
    } else if (e.key === 'r') {
      e.preventDefault();
      this.inputMensajeRef?.nativeElement.focus();
    } else if (e.key === 'a' && this.puedeAsignarme()) {
      e.preventDefault();
      this.asignarme();
    } else if (e.key === '/') {
      e.preventDefault();
      this.buscadorRef?.nativeElement.focus();
    }
  }

  @HostListener('document:mousedown', ['$event'])
  protected clicAfuera(e: MouseEvent): void {
    if (this.menuAbierto() && !(e.target as HTMLElement).closest('[data-menu-asignar]')) {
      this.menuAbierto.set(false);
    }
  }

  // ── Carga ───────────────────────────────────────────────────────────────
  protected cargarBandeja(mostrarCargando = true): void {
    if (mostrarCargando) {
      this.cargando.set(true);
      this.error.set(null);
    }
    this.chatService.listarBandeja().subscribe({
      next: (respuesta) => {
        const previas = new Set(this.conversaciones().map((c) => c.id));
        const llegadas = respuesta.data.filter((c) => !previas.has(c.id)).map((c) => c.id);
        this.conversaciones.set(respuesta.data);
        this.cargando.set(false);
        // Filas nuevas que entran en vivo (no en la primera carga) animan.
        if (!mostrarCargando && llegadas.length) {
          this.marcar(this.filasRecientes, llegadas);
        }
        if (this.seleccionadaId() === null) {
          const primera = this.sinAsignar()[0] ?? respuesta.data[0];
          if (primera) this.seleccionar(primera.id);
        }
      },
      error: () => {
        if (mostrarCargando) {
          this.error.set('No se pudo cargar la bandeja de soporte. Intentá de nuevo.');
        }
        this.cargando.set(false);
      },
    });
  }

  // ── Interacción ─────────────────────────────────────────────────────────
  protected seleccionarMetrica(id: string): void {
    const g = id as GrupoId;
    this.filtro.set(this.filtro() === g ? null : g);
    this.plegados.update((p) => ({ ...p, [g]: false }));
  }

  protected alternarGrupo(id: GrupoId): void {
    this.plegados.update((p) => ({ ...p, [id]: !p[id] }));
  }

  protected abrirMasVieja(): void {
    const v = this.masVieja();
    if (!v) return;
    this.plegados.update((p) => ({ ...p, sin_asignar: false }));
    this.seleccionar(v.id);
  }

  protected seleccionar(id: number): void {
    if (id === this.seleccionadaId()) return;
    this.seleccionadaId.set(id);
    this.menuAbierto.set(false);
    this.respondiendoA.set(null);
    this.nuevas.update((s) => this.sin(s, id));
    if (this.toast()?.id === id) this.toast.set(null);
    this.primeraCargaHilo = true;
    this.cargandoHilo.set(true);
    this.chatService
      .listarMensajes(id)
      .pipe(finalize(() => this.cargandoHilo.set(false)))
      .subscribe({
        next: (r) => this.mensajes.set(r.data),
        error: () => this.mensajes.set([]),
      });
  }

  protected limpiarBusqueda(): void {
    this.busqueda.set('');
    this.buscadorRef?.nativeElement.focus();
  }

  protected enterEnBuscador(): void {
    const id = this.ordenVisible()[0];
    if (id !== undefined) {
      this.seleccionar(id);
      this.buscadorRef?.nativeElement.blur();
    }
  }

  protected responderA(m: Mensaje): void {
    this.respondiendoA.set(m);
    this.citaVisible.set(m);
    this.inputMensajeRef?.nativeElement.focus();
  }

  protected cancelarRespuesta(): void {
    this.respondiendoA.set(null);
  }

  protected teclaComposer(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.enviar();
    }
  }

  protected autoAltura(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 132) + 'px';
  }

  protected enviar(): void {
    const conversacion = this.seleccionada();
    const cuerpo = this.mensajeNuevo().trim();
    if (!conversacion || !cuerpo || this.enviando() || !this.puedeEscribir()) {
      return;
    }
    this.enviando.set(true);
    const citado = this.respondiendoA();
    this.chatService
      .enviarMensaje(conversacion.id, cuerpo, citado?.id)
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: (mensaje) => {
          const conCita: Mensaje = citado
            ? { ...mensaje, respondeA: { id: citado.id, autorId: citado.autorId, autor: citado.autor, cuerpo: citado.cuerpo, creadoEn: citado.creadoEn } }
            : mensaje;
          this.marcar(this.recientes, [conCita.id]);
          this.mensajes.update((a) => [...a, conCita]);
          this.mensajeNuevo.set('');
          this.respondiendoA.set(null);
          const el = this.inputMensajeRef?.nativeElement;
          if (el) {
            el.style.height = 'auto';
            el.focus();
          }
          this.cargarBandeja(false);
          // El backend agrega el mensaje de sistema "X tomó la conversación"
          // si estaba libre: se trae el hilo de nuevo para mostrarlo.
          if (!conversacion.agenteAsignadoId) this.refrescarHilo(conversacion.id);
        },
      });
  }

  protected alternarMenu(): void {
    if (!this.menuHabilitado()) return;
    const abrir = !this.menuAbierto();
    this.menuAbierto.set(abrir);
    if (abrir && !this.staffAsignable().length && !this.cargandoStaffAsignable()) {
      this.cargandoStaffAsignable.set(true);
      this.usuarioService
        .listar()
        .pipe(finalize(() => this.cargandoStaffAsignable.set(false)))
        .subscribe({
          next: (r) => this.staffAsignable.set(r.data.filter((u) => u.activo)),
          error: () => this.staffAsignable.set([]),
        });
    }
  }

  protected asignarme(): void {
    const yo = this.miId();
    if (yo !== null) this.reasignarA(yo);
  }

  protected devolver(): void {
    const c = this.seleccionada();
    if (c?.agenteAnteriorId) this.reasignarA(c.agenteAnteriorId);
  }

  protected reasignarA(usuarioId: number): void {
    const c = this.seleccionada();
    if (!c || this.asignando()) return;
    if (usuarioId === c.agenteAsignadoId) {
      this.menuAbierto.set(false);
      return;
    }
    this.asignando.set(true);
    this.chatService
      .asignar(c.id, usuarioId)
      .pipe(finalize(() => this.asignando.set(false)))
      .subscribe({
        next: () => {
          this.menuAbierto.set(false);
          this.cargarBandeja(false);
          this.refrescarHilo(c.id);
          if (usuarioId === this.miId()) setTimeout(() => this.inputMensajeRef?.nativeElement.focus(), 60);
        },
      });
  }

  protected cerrarConversacion(): void {
    const c = this.seleccionada();
    if (!c || c.estado === 'cerrada' || this.cerrando()) return;
    this.cerrando.set(true);
    this.chatService
      .cerrar(c.id)
      .pipe(finalize(() => this.cerrando.set(false)))
      .subscribe({
        next: () => {
          this.cargarBandeja(false);
          this.refrescarHilo(c.id);
        },
      });
  }

  protected abrirToast(): void {
    const t = this.toast();
    if (t) this.seleccionar(t.id);
  }

  // ── Tiempo real ─────────────────────────────────────────────────────────
  private escucharTiempoReal(): void {
    this.mensajeSub = this.realtimeService.escuchar<EventoMensajeNuevo>('mensaje:nuevo').subscribe((evento) => {
      const existia = this.conversaciones().some((c) => c.id === evento.conversacionId);
      this.cargarBandeja(false);
      if (evento.conversacionId === this.seleccionadaId()) {
        this.refrescarHilo(evento.conversacionId);
        return;
      }
      // Mensaje de un cliente en otra conversación → punto azul + aviso.
      if (!evento.esSistema && evento.autorId !== this.miId()) {
        this.nuevas.update((s) => new Set(s).add(evento.conversacionId));
        setTimeout(() => {
          const c = this.conversaciones().find((x) => x.id === evento.conversacionId);
          if (c) this.avisar(c.id, this.nombreCliente(c), existia ? 'escribió' : 'abrió una conversación');
        }, 250);
      }
    });
    this.asignadaSub = this.realtimeService
      .escuchar<EventoConversacionAsignada>('conversacion:asignada')
      .subscribe((e) => {
        this.cargarBandeja(false);
        if (e.conversacionId === this.seleccionadaId()) this.refrescarHilo(e.conversacionId);
      });
  }

  /** Trae el hilo de nuevo y marca como "recientes" solo los mensajes que
   * no estaban — son los que animan su entrada. */
  private refrescarHilo(id: number): void {
    const antes = new Set(this.mensajes().map((m) => m.id));
    this.chatService.listarMensajes(id).subscribe((r) => {
      if (this.seleccionadaId() !== id) return;
      this.marcar(this.recientes, r.data.filter((m) => !antes.has(m.id)).map((m) => m.id));
      this.mensajes.set(r.data);
    });
  }

  private avisar(id: number, cliente: string, texto: string): void {
    const t = { id, cliente, texto };
    this.toast.set(t);
    this.ultimoToast.set(t);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 6000);
  }

  // ── Helpers de presentación ─────────────────────────────────────────────
  private fila(c: ConversacionBandeja) {
    const [fondo, tinta] = this.paleta(c.id);
    const nombre = this.nombreCliente(c);
    const u = c.ultimoMensaje;
    let preview = c.usuario?.correo ?? '';
    if (u && !u.esSistema) {
      const quien = u.autorId === c.usuarioId ? '' : u.autorId === this.miId() ? 'Vos: ' : `${c.agenteAsignado?.nombres ?? 'Equipo'}: `;
      preview = quien + u.cuerpo;
    }
    return {
      id: c.id,
      cliente: nombre,
      iniciales: this.iniciales(nombre),
      fondo,
      tinta,
      cuando: this.relativo(c.actualizadoEn),
      preview,
      nueva: this.nuevas().has(c.id),
      animar: this.filasRecientes().has(c.id),
      chip: this.chip(c),
    };
  }

  private chip(c: ConversacionBandeja): Chip {
    if (c.estado === 'cerrada') {
      return { texto: 'Resuelta', icono: IconCheck, fondo: '#f1f1f1', tinta: '#616161' };
    }
    if (!c.agenteAsignadoId) {
      const min = this.minutosDesde(c.creadoEn);
      const larga = min >= ESPERA_LARGA_MIN;
      return { texto: `Espera ${this.duracion(min)}`, icono: IconClock, fondo: larga ? '#fde7d3' : '#fff1e3', tinta: larga ? '#7c2d12' : '#9a3412' };
    }
    if (c.agenteAsignadoId === this.miId()) {
      if (c.ultimoMensaje === undefined) {
        return { texto: 'Asignada a vos', icono: IconUserCheck, fondo: '#f1f1f1', tinta: '#616161' };
      }
      return this.clienteHabloUltimo(c)
        ? { texto: 'Te toca responder', icono: IconArrowBackUp, fondo: '#e0f0ff', tinta: '#075985' }
        : { texto: 'Esperando al cliente', icono: IconHourglass, fondo: '#f1f1f1', tinta: '#616161' };
    }
    return { texto: this.nombreAgente(c) ?? 'Equipo', icono: IconUser, fondo: '#f1f1f1', tinta: '#4b5563' };
  }

  private clienteHabloUltimo(c: ConversacionBandeja): boolean {
    const u = c.ultimoMensaje;
    return !!u && !u.esSistema && u.autorId === c.usuarioId;
  }

  /** El backend no tipa el motivo del mensaje de sistema: se infiere del
   * texto para elegir el ícono. Si agregan un campo `tipo`, usalo acá. */
  private iconoSistema(cuerpo: string) {
    const t = cuerpo.toLowerCase();
    if (t.includes('cerr')) return this.iconosSistema.cerrada;
    if (t.includes('devol')) return this.iconosSistema.devuelta;
    if (t.includes('tom')) return this.iconosSistema.tomada;
    if (t.includes('asign')) return this.iconosSistema.asignada;
    return this.i.info;
  }

  private marcar(sig: WritableSignal<ReadonlySet<number>>, ids: number[]): void {
    if (!ids.length) return;
    sig.update((s) => {
      const n = new Set(s);
      ids.forEach((id) => n.add(id));
      return n;
    });
    setTimeout(() => sig.update((s) => ids.reduce((acc, id) => this.sin(acc, id), s)), MS_ANIMACION);
  }

  private sin(s: ReadonlySet<number>, id: number): ReadonlySet<number> {
    if (!s.has(id)) return s;
    const n = new Set(s);
    n.delete(id);
    return n;
  }

  private scrollAlFinal(suave: boolean): void {
    const el = this.hiloScrollRef?.nativeElement;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
  }

  protected paleta(id: number): readonly [string, string] {
    return PALETA[id % PALETA.length];
  }

  protected iniciales(nombre: string): string {
    return nombre
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  protected nombreCliente(c: Conversacion): string {
    return c.usuario ? `${c.usuario.nombres} ${c.usuario.apellidos}`.trim() : `Usuario #${c.usuarioId}`;
  }

  protected nombreAgente(c: Conversacion): string | null {
    return c.agenteAsignado ? `${c.agenteAsignado.nombres} ${c.agenteAsignado.apellidos}`.trim() : null;
  }

  protected nombreAgenteAnterior(c: Conversacion): string | null {
    return c.agenteAnterior ? `${c.agenteAnterior.nombres} ${c.agenteAnterior.apellidos}`.trim() : null;
  }

  protected nombreDeAutor(autor: ChatUsuario | null, autorId: number | null): string {
    if (autorId !== null && autorId === this.miId()) return 'Vos';
    if (autor) return `${autor.nombres} ${autor.apellidos}`.trim();
    return autorId === null ? 'Sistema' : `Usuario #${autorId}`;
  }

  private minutosDesde(iso: string): number {
    return Math.max(0, Math.floor((this.ahora() - Date.parse(iso)) / MS_MINUTO));
  }

  private duracion(min: number): string {
    if (min < 60) return `${Math.max(1, min)} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
    const d = Math.floor(h / 24);
    return d === 1 ? '1 día' : `${d} días`;
  }

  protected relativo(iso: string, conHace = false): string {
    const diff = this.ahora() - Date.parse(iso);
    if (diff < MS_MINUTO) return 'ahora';
    const pre = conHace ? 'hace ' : '';
    if (diff < MS_HORA) return `${pre}${Math.floor(diff / MS_MINUTO)} min`;
    if (diff < MS_HORA * 24) return `${pre}${Math.floor(diff / MS_HORA)} h`;
    const dias = Math.floor(diff / (MS_HORA * 24));
    return dias === 1 ? 'ayer' : `${pre}${dias} d`;
  }

  protected horaCorta(iso: string): string {
    const d = new Date(iso);
    const hh = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString() ? hh : `${d.toLocaleDateString('es-CO', { weekday: 'short' })} ${hh}`;
  }
}
