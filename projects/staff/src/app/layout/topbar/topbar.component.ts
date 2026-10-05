// projects/staff/src/app/layout/topbar/topbar.component.ts
import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowUpRight,
  IconArrowsDiagonal,
  IconBell,
  IconBellCheck,
  IconChecks,
  IconCrown,
  IconEraser,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { Subscription, filter, map } from 'rxjs';
import { AsistenteStaffService } from '../../core/asistente-staff/asistente-staff.service';
import { BreadcrumbTrailComponent } from '../../shared/ui/breadcrumb-trail/breadcrumb-trail.component';
import { IaMarcaComponent } from '../../shared/ui/ia-marca/ia-marca.component';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacion } from '../../core/notificaciones/models/notificacion.model';
import { NotificacionService } from '../../core/notificaciones/notificacion.service';
import {
  CATEGORIAS,
  CategoriaNotificacion,
  agruparPorDia,
  defTipo,
  filaNotificacion,
} from '../../core/notificaciones/notificacion-catalogo';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { PistaService } from '../../core/ui/pista.service';

type Pestana = 'todas' | Exclude<CategoriaNotificacion, 'otras'>;
const MS_HOLD = 1100;
/** Al soltar antes de tiempo, la barra vuelve en este tiempo (desde llena). */
const MS_VUELTA = 320;
/** Lo que dura la despedida ("Hasta luego, …") antes de cerrar la sesión. */
const MS_DESPEDIDA = 1100;

/**
 * Topbar de staff — rediseño (LEEME §17, 2026-09-24): campanita con
 * pestañas por categoría, agrupación por día y acción directa; menú de
 * cuenta en el avatar/nombre (Mi perfil · Configuración · Cerrar sesión
 * manteniendo). El botón "Salir" suelto desaparece.
 *
 * Misma lógica de datos que antes: `GET /notificaciones/staff` + socket
 * `notificacion:nueva`, `marcarLeida`, `marcarTodasLeidas`, `ocultarTodas`.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [TablerIconComponent, IaMarcaComponent, BreadcrumbTrailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './topbar.component.html',
})
export class TopbarComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificacionService = inject(NotificacionService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly pista = inject(PistaService);
  protected readonly asistenteService = inject(AsistenteStaffService);

  protected readonly i = {
    campana: IconBell,
    marcarTodas: IconChecks,
    expandir: IconArrowsDiagonal,
    flecha: IconArrowRight,
    flechaDiag: IconArrowUpRight,
    limpiar: IconEraser,
    vacio: IconBellCheck,
    corona: IconCrown,
    volver: IconArrowLeft,
  };

  protected readonly currentUser = this.authService.currentUser;

  /** Ícono del Asistente de IA para staff (§5.4 de
   *  `PROPUESTA_ASISTENTE_IA_RAG.md`) — gateado por el permiso
   *  `asistente_staff.usar`, mismo criterio de `permisos.includes(...)`
   *  que ya usa `SidebarComponent.navItems` (no por `modulosDisponibles`,
   *  que es para features de plan de una Empresa — esto no lo es). */
  protected readonly tieneAsistenteIa = computed(() =>
    (this.currentUser()?.permisos ?? []).includes('asistente_staff.usar'),
  );

  /** Breadcrumb + "Volver al panel" del topbar compartido, SOLO en la
   *  pantalla completa del asistente (`/asistente`, fuera del Shell —
   *  rediseño 2026-10-01, ver `PROPUESTA_ASISTENTE_IA_RAG.md` §5.4.4).
   *  Mismo patrón `toSignal` que `SettingsPageComponent.seccionUrl`. */
  protected readonly enAsistente = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.startsWith('/asistente')),
    ),
    { initialValue: this.router.url.startsWith('/asistente') },
  );

  // ── Notificaciones ──────────────────────────────────────────────────────
  protected readonly notificaciones = signal<Notificacion[]>([]);
  private readonly idsOcultos = signal<Set<number>>(new Set());
  protected readonly visibles = computed(() => this.notificaciones().filter((n) => !this.idsOcultos().has(n.id)));
  protected readonly noLeidas = computed(() => this.visibles().filter((n) => !n.leidaEn).length);
  protected readonly panelAbierto = signal(false);
  protected readonly pestana = signal<Pestana>('todas');
  /** Sube con cada notificación en vivo: re-dispara la sacudida y el pop. */
  protected readonly timbre = signal(0);
  /** ids que llegaron en vivo — animan su entrada 1,6 s. */
  private readonly recientes = signal<ReadonlySet<number>>(new Set());

  protected readonly pestanas = computed(() => {
    const nl = this.visibles().filter((n) => !n.leidaEn);
    const def: { id: Pestana; texto: string }[] = [
      { id: 'todas', texto: 'Todas' },
      { id: 'soporte', texto: CATEGORIAS.soporte.texto },
      { id: 'empresas', texto: CATEGORIAS.empresas.texto },
      { id: 'suscripciones', texto: CATEGORIAS.suscripciones.texto },
    ];
    return def.map((p) => ({
      ...p,
      cuenta: nl.filter((n) => p.id === 'todas' || defTipo(n.tipo).cat === p.id).length,
    }));
  });

  protected readonly grupos = computed(() => {
    const p = this.pestana();
    const rec = this.recientes();
    const filas = this.visibles()
      .filter((n) => p === 'todas' || defTipo(n.tipo).cat === p)
      .slice(0, 12)
      .map((n) => ({ ...filaNotificacion(n), nueva: rec.has(n.id) }));
    return agruparPorDia(filas);
  });

  // ── Menú de cuenta ──────────────────────────────────────────────────────
  protected readonly menuAbierto = signal(false);
  protected readonly hoverCuenta = signal(false);
  /** Índice resaltado en el menú (-1 = ninguno) — mueve la píldora gris. */
  protected readonly resaltado = signal(-1);
  /** `false` | `'manteniendo'` | `'listo'` — "Cerrar sesión" se mantiene. */
  protected readonly hold = signal<false | 'manteniendo' | 'listo'>(false);
  protected readonly progreso = signal(0);
  protected readonly opciones = [
    { texto: 'Mi perfil', seccion: 'perfil', destino: 'Settings · Perfil' },
    { texto: 'Configuración', seccion: 'seguridad', destino: 'Settings · Seguridad' },
  ];

  private notifSub: Subscription | undefined;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  private holdRaf = 0;

  constructor() {
    // Carga el perfil (`GET /auth/me`) si todavía no está en memoria —
    // `currentUser` no se persiste, solo el `accessToken` (ver
    // `AuthService`), así que tras un F5 hace falta volver a pedirlo antes
    // de que el topbar tenga algo real que mostrar (nombre/iniciales en
    // vez de "…"). Esto antes solo vivía en `ShellComponent.ngOnInit` (el
    // layout raíz), pero `/asistente` (§5.4.4, 2026-10-01) es una ruta de
    // nivel superior FUERA del Shell que también monta este mismo
    // `TopbarComponent` — al recargar directo ahí, `ShellComponent` nunca
    // se instanciaba y el perfil quedaba sin pedirse nunca (bug: el "…"
    // quedaba fijo en vez de mostrar el nombre real). Centralizado acá,
    // con un solo punto de verdad, cubre los dos casos.
    if (this.authService.isAuthenticated() && !this.authService.currentUser()) {
      this.authService.cargarPerfil().subscribe({ error: () => undefined });
    }
    if (this.authService.isAuthenticated()) {
      this.cargar();
    }
    this.notifSub = this.realtimeService.escuchar<Notificacion>('notificacion:nueva').subscribe((n) => {
      this.cargar(n?.id);
      this.timbre.update((v) => v + 1);
    });
  }

  ngOnDestroy(): void {
    this.notifSub?.unsubscribe();
    clearTimeout(this.holdTimer);
    cancelAnimationFrame(this.holdRaf);
  }

  @HostListener('document:mousedown', ['$event'])
  protected clicAfuera(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (this.panelAbierto() && !t.closest('[data-panel="campana"]')) this.panelAbierto.set(false);
    if (this.menuAbierto() && !t.closest('[data-panel="cuenta"]')) this.cerrarMenu();
  }

  @HostListener('document:keydown', ['$event'])
  protected teclado(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.panelAbierto.set(false);
      this.cerrarMenu();
      return;
    }
    const tag = (e.target as HTMLElement).tagName;
    if (this.menuAbierto() && /^[1-9]$/.test(e.key) && tag !== 'INPUT' && tag !== 'TEXTAREA') {
      const o = this.opciones[+e.key - 1];
      if (o) this.irA(o);
    }
  }

  private cargar(nuevaId?: number): void {
    this.notificacionService.listar().subscribe({
      next: (r) => {
        this.notificaciones.set(r.data);
        if (nuevaId) {
          this.recientes.update((s) => new Set(s).add(nuevaId));
          setTimeout(() => this.recientes.update((s) => { const x = new Set(s); x.delete(nuevaId); return x; }), 1_600);
        }
      },
      error: () => undefined,
    });
  }

  // ── Campanita ───────────────────────────────────────────────────────────
  protected togglePanel(): void {
    this.panelAbierto.update((v) => !v);
    this.cerrarMenu();
  }

  protected abrir(f: ReturnType<typeof filaNotificacion>): void {
    this.marcar(f.n, true);
    this.panelAbierto.set(false);
    this.pista.navegar(f.destino.destino);
    this.router.navigate([f.destino.url], { queryParams: f.destino.query });
  }

  /** El punto de la derecha: alterna leída ↔ no leída. */
  protected alternar(n: Notificacion): void {
    this.marcar(n, !n.leidaEn);
  }

  private marcar(n: Notificacion, leida: boolean): void {
    if (!!n.leidaEn === leida) return;
    const antes = n.leidaEn;
    this.notificaciones.update((a) => a.map((x) => (x.id === n.id ? { ...x, leidaEn: leida ? new Date().toISOString() : null } : x)));
    const req = leida ? this.notificacionService.marcarLeida(n.id) : this.notificacionService.marcarNoLeida(n.id);
    req.subscribe({ error: () => this.notificaciones.update((a) => a.map((x) => (x.id === n.id ? { ...x, leidaEn: antes } : x))) });
  }

  protected marcarTodasLeidas(): void {
    const n = this.noLeidas();
    if (!n) return;
    const antes = this.notificaciones();
    const ahora = new Date().toISOString();
    this.notificaciones.update((a) => a.map((x) => (x.leidaEn ? x : { ...x, leidaEn: ahora })));
    this.notificacionService.marcarTodasLeidas().subscribe({ error: () => this.notificaciones.set(antes) });
    this.pista.hecho(`${n} ${n === 1 ? 'marcada' : 'marcadas'} como ${n === 1 ? 'leída' : 'leídas'}`);
  }

  protected limpiar(): void {
    if (!this.visibles().length) return;
    this.idsOcultos.update((s) => {
      const x = new Set(s);
      this.notificaciones().forEach((n) => x.add(n.id));
      return x;
    });
    this.notificacionService.ocultarTodas().subscribe({ error: () => undefined });
    this.pista.hecho('Campanita limpia · siguen en Notificaciones');
  }

  protected verTodas(): void {
    this.panelAbierto.set(false);
    this.pista.navegar('Notificaciones');
    this.router.navigateByUrl('/notificaciones');
  }

  protected tiempoCorto(iso: string): string {
    const m = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
    if (m < 1) return 'ahora';
    if (m < 60) return `${m} min`;
    if (m < 1440) return `${Math.floor(m / 60)} h`;
    const d = Math.floor(m / 1440);
    return d === 1 ? 'ayer' : `${d} d`;
  }

  // ── Menú de cuenta ──────────────────────────────────────────────────────
  protected toggleMenu(): void {
    this.menuAbierto.update((v) => !v);
    this.panelAbierto.set(false);
    this.resaltado.set(-1);
    if (this.hold() !== 'listo') {
      cancelAnimationFrame(this.holdRaf);
      this.hold.set(false);
      this.progreso.set(0);
    }
  }

  private cerrarMenu(): void {
    this.menuAbierto.set(false);
    this.resaltado.set(-1);
    if (this.hold() === 'manteniendo') this.cancelarHold();
  }

  protected irA(o: { seccion: string; destino: string }): void {
    this.cerrarMenu();
    this.pista.navegar(o.destino);
    this.router.navigate(['/settings'], { queryParams: { seccion: o.seccion } });
  }

  /** Cerrar sesión "puerta" (2026-10-05): mientras se mantiene, la barra se
   *  llena, la puerta del ícono se abre y sale la flecha; al completar, la
   *  puerta se cierra con un rebote y el texto se despide letra por letra.
   *  `progreso` (0–1) se mueve cuadro a cuadro para que soltar a mitad de
   *  camino haga retroceder todo desde donde estaba. */
  protected empezarHold(e?: Event): void {
    if (e instanceof MouseEvent && e.button > 0) return;
    if (e instanceof KeyboardEvent) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (e.repeat) return;
    }
    if (this.hold() === 'listo' || this.hold() === 'manteniendo') return;
    this.hold.set('manteniendo');
    this.animarProgreso(1);
  }

  protected cancelarHold(): void {
    if (this.hold() !== 'manteniendo') return;
    this.hold.set(false);
    this.animarProgreso(-1);
  }

  private animarProgreso(sentido: 1 | -1): void {
    cancelAnimationFrame(this.holdRaf);
    let antes = performance.now();
    const paso = (ahora: number) => {
      const dt = ahora - antes;
      antes = ahora;
      const p = Math.min(1, Math.max(0, this.progreso() + (sentido > 0 ? dt / MS_HOLD : -dt / MS_VUELTA)));
      this.progreso.set(p);
      if (sentido > 0 && p >= 1) {
        this.completarHold();
        return;
      }
      if ((sentido > 0 && this.hold() === 'manteniendo') || (sentido < 0 && p > 0)) {
        this.holdRaf = requestAnimationFrame(paso);
      }
    };
    this.holdRaf = requestAnimationFrame(paso);
  }

  private completarHold(): void {
    this.hold.set('listo');
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => this.logout(), MS_DESPEDIDA);
  }

  /** Texto del botón, letra por letra (la despedida entra en ola). */
  protected readonly letrasSalir = computed(() => {
    const texto = this.hold() === 'listo' ? `Hasta luego, ${this.currentUser()?.nombres ?? ''}`.trim() : 'Cerrar sesión';
    return [...texto].map((c, i) => ({ c, retraso: i * 28 }));
  });

  protected readonly puntosSalir = [0, 1, 2];

  protected readonly initials = computed(() => {
    const u = this.currentUser();
    if (!u) return '…';
    const ini = (t: string) => t.trim().charAt(0).toUpperCase();
    return `${ini(u.nombres)}${ini(u.apellidos)}` || '?';
  });
  protected readonly displayName = computed(() => this.currentUser()?.nombres ?? '…');
  protected readonly nombreCompleto = computed(() => {
    const u = this.currentUser();
    return u ? `${u.nombres} ${u.apellidos}`.trim() : '…';
  });
  protected readonly correo = computed(() => this.currentUser()?.correo ?? '');
  protected readonly esCrossPanelStaff = computed(() => this.currentUser()?.esSesionCrossPanelStaff ?? false);
  /** Corona junto al nombre en el menú. El handoff proponía
   *  `['superadmin', 'admin'].includes(rol.nombre)`, pero este proyecto no
   *  tiene ningún rol llamado así (ver `ROL_*` en
   *  `modules/rol/rol.service.ts` del backend): el rol más alto DENTRO del
   *  panel de staff es `admin_goods`. El acceso especial de superadmin
   *  (`esSesionCrossPanelStaff`) ya se cubre aparte. */
  protected readonly esSuperadmin = computed(
    () => this.esCrossPanelStaff() || this.currentUser()?.rol?.nombre === 'admin_goods',
  );

  protected logout(): void {
    this.menuAbierto.set(false);
    this.hold.set(false);
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  protected abrirAsistenteIa(): void {
    this.asistenteService.abrirPanel();
  }

  /** Mismo criterio que `AsistentePageComponent.volver()` (ese método
   *  se mantiene ahí, propio, para el atajo Esc de esa página — acá es
   *  solo para el click del botón "Volver al panel" visible en este
   *  topbar compartido cuando `enAsistente()`). */
  protected volver(): void {
    history.length > 1 ? history.back() : this.router.navigate(['/']);
  }
}
