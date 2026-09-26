// projects/staff/src/app/layout/topbar/topbar.component.ts
import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IconArrowRight,
  IconArrowUpRight,
  IconArrowsDiagonal,
  IconBell,
  IconBellCheck,
  IconChecks,
  IconCrown,
  IconEraser,
  IconPower,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { Subscription } from 'rxjs';
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
const MS_HOLD = 900;

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
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './topbar.component.html',
})
export class TopbarComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificacionService = inject(NotificacionService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly pista = inject(PistaService);

  protected readonly i = {
    campana: IconBell,
    marcarTodas: IconChecks,
    expandir: IconArrowsDiagonal,
    flecha: IconArrowRight,
    flechaDiag: IconArrowUpRight,
    limpiar: IconEraser,
    vacio: IconBellCheck,
    corona: IconCrown,
    apagar: IconPower,
  };

  protected readonly currentUser = this.authService.currentUser;

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
  protected readonly opciones = [
    { texto: 'Mi perfil', seccion: 'perfil', destino: 'Settings · Perfil' },
    { texto: 'Configuración', seccion: 'seguridad', destino: 'Settings · Seguridad' },
  ];

  private notifSub: Subscription | undefined;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
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
    this.hold.set(false);
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

  protected empezarHold(e?: Event): void {
    if (e instanceof MouseEvent && e.button > 0) return;
    if (e instanceof KeyboardEvent) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
    }
    if (this.hold()) return;
    this.hold.set('manteniendo');
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => {
      this.hold.set('listo');
      this.pista.hecho('Cerrando sesión…');
      setTimeout(() => this.logout(), 500);
    }, MS_HOLD);
  }

  protected cancelarHold(): void {
    if (this.hold() !== 'manteniendo') return;
    clearTimeout(this.holdTimer);
    this.hold.set(false);
  }

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
}
