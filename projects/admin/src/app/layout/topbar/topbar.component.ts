// projects/admin/src/app/layout/topbar/topbar.component.ts
import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, computed, inject, output, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import {
  IconArrowRight, IconArrowUpRight, IconArrowsDiagonal, IconBell, IconBellCheck, IconCategory, IconChecks, IconChevronRight,
  IconArrowLeft, IconCrown, IconEraser, IconKeyboard, IconSearch, IconX, TablerIconComponent,
} from '@tabler/icons-angular';
import { Subscription } from 'rxjs';
import { AsistenteService } from '../../core/asistente/asistente.service';
import { AuthService } from '../../core/auth/auth.service';
import { AccesoEmpresa } from '../../core/auth/models/current-user.model';
import { Notificacion } from '../../core/notificaciones/models/notificacion.model';
import { NotificacionService } from '../../core/notificaciones/notificacion.service';
import { agruparPorDia, defTipo, filaNotificacion } from '../../core/notificaciones/notificacion-catalogo';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { AtajosService } from '../../core/ui/atajos.service';
import { WhatsappService } from '../../core/whatsapp/whatsapp.service';
import { IaMarcaComponent } from '../../shared/ui/ia-marca/ia-marca.component';

type Pestana = 'todas' | 'soporte' | 'tienda' | 'cuenta';
type EstadoPlan = 'al dia' | 'por vencer' | 'en mora';
const MS_HOLD = 1100;

/** Lo que el topbar lee de la sesión (`/auth/me`: usuario, `empresa` y `accesoEmpresa`). */
interface CuentaTopbar {
  nombre: string; apellido: string; correo: string; rol: 'Dueño' | 'Empleado';
  empresa: string; logoEmpresa: string | null;
  plan: string; estadoPlan: EstadoPlan; diasParaVencer: number; montoPlan: string; venceTexto: string;
}

/** Íconos de ruta (`data.icon`) que no son un nombre registrado en `provideTablerIcons`. */
/** `ia` no se traduce: se pinta con la marca del asistente (`app-ia-marca`). */
const ICONO_RUTA: Record<string, string> = {};
const DIA_MS = 864e5;
const cop = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

/**
 * Topbar del admin (Productos Goods v5).
 * - Marca: logo Goods + al pasar el cursor se despliega "× [logo de la empresa]" (550 ms).
 * - Migas: Products › módulo actual (ícono turquesa), desde la URL.
 * - Buscador central ⌘K · Atajos (Ctrl + .) · Asistente de IA (aro con punto turquesa).
 * - Campanita: pestañas Todas/Soporte/Tienda/Cuenta, agrupada por día, acción directa, punto leída/no leída.
 * - Cuenta compacta: solo avatar; al abrir se despliega nombre + línea que alterna
 *   "Empresa" ↔ "Plan Pro · vence en 3 días" (cada 3 s). Menú: tarjeta de cobro (si vence o está en mora),
 *   01–04 con píldora deslizante y teclas 1–4, "Cerrar sesión" manteniendo 1,1 s (puerta que se cierra).
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [IaMarcaComponent, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './topbar.component.html',
})
export class TopbarComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificacionService = inject(NotificacionService);
  private readonly realtime = inject(RealtimeService);
  private readonly asistente = inject(AsistenteService);
  private readonly atajos = inject(AtajosService);
  private readonly whatsapp = inject(WhatsappService);

  /** Se emiten además de la acción propia (atajos / panel del asistente), por si el host quiere reaccionar. */
  readonly abrirAtajos = output<void>();
  readonly abrirAsistente = output<void>();
  readonly buscar = output<string>();

  protected readonly i = {
    campana: IconBell, marcarTodas: IconChecks, expandir: IconArrowsDiagonal, flecha: IconArrowRight, flechaDiag: IconArrowUpRight,
    limpiar: IconEraser, vacio: IconBellCheck, corona: IconCrown, chevron: IconChevronRight, buscar: IconSearch, teclado: IconKeyboard, x: IconX,
    volver: IconArrowLeft,
  };

  // ── Cuenta ──────────────────────────────────────────────────────────────
  protected readonly cuenta = computed<CuentaTopbar>(() => {
    const u = this.auth.currentUser();
    const e = u?.empresa ?? null;
    const a = u?.accesoEmpresa ?? null;
    const plan = this.estadoPlan(a);
    const monto = a?.proximoCobro?.monto ?? e?.plan?.precioMensual ?? null;
    return {
      nombre: u?.nombres ?? '…',
      apellido: u?.apellidos ?? '',
      correo: u?.correo ?? '',
      rol: u?.rol.nombre === 'dueno_empresa' ? 'Dueño' : 'Empleado',
      empresa: e?.nombre ?? 'Mi empresa',
      logoEmpresa: e?.logoUrl ?? null,
      plan: a?.estado === 'en_prueba' ? 'de prueba' : (e?.plan?.nombre ?? 'sin plan'),
      ...plan,
      montoPlan: monto != null ? cop(monto) : '',
    };
  });

  /** Al día · por vencer (7 días o menos, o fin de la prueba) · en mora. */
  private estadoPlan(a: AccesoEmpresa | null): Pick<CuentaTopbar, 'estadoPlan' | 'diasParaVencer' | 'venceTexto'> {
    const limite = a?.estado === 'en_prueba' ? a.pruebaHasta : a?.proximoCobro?.fechaLimite ?? a?.fechaProximoVencimiento;
    if (!a || !limite) return { estadoPlan: 'al dia', diasParaVencer: 0, venceTexto: '' };
    const dias = Math.ceil((Date.parse(limite) - Date.now()) / DIA_MS);
    if (a.estado === 'en_mora') return { estadoPlan: 'en mora', diasParaVencer: Math.max(1, -dias), venceTexto: 'el ' + fechaCorta(limite) };
    if (dias <= 7) return { estadoPlan: 'por vencer', diasParaVencer: Math.max(1, dias), venceTexto: dias <= 1 ? 'mañana' : 'el ' + fechaCorta(limite) };
    return { estadoPlan: 'al dia', diasParaVencer: dias, venceTexto: 'el ' + fechaCorta(limite) };
  }

  /** El ícono del Asistente solo si el plan incluye el módulo (el backend lo exige con `ModuloGuard`). */
  protected readonly tieneAsistenteIa = computed(() => (this.auth.currentUser()?.modulosDisponibles ?? []).includes('asistente_ia'));
  protected readonly iniciales = computed(() => {
    const c = this.cuenta();
    return (c.nombre.charAt(0) + c.apellido.charAt(0)).toUpperCase() || '?';
  });
  protected readonly primerNombre = computed(() => this.cuenta().nombre.split(' ')[0]);
  protected readonly alertaPlan = computed(() => {
    const c = this.cuenta();
    if (c.estadoPlan === 'al dia') return null;
    const mora = c.estadoPlan === 'en mora', n = Math.min(7, Math.max(1, c.diasParaVencer || 1));
    const acento = mora ? '#b42318' : '#b7791f';
    return {
      mora, acento, n, rotulo: mora ? 'de mora' : n === 1 ? 'día' : 'días',
      titulo: mora ? 'Pago vencido' : `Tu plan ${c.plan} vence`, sub: mora ? `Venció ${c.venceTexto} · Plan ${c.plan}` : c.venceTexto,
      punto: mora ? '#ff8f7a' : '#ffb904', halo: mora ? 'rgba(255,143,122,.22)' : 'rgba(255,185,4,.22)',
      // 7 segmentos: los últimos n encendidos, el borde en el color de acento.
      segmentos: Array.from({ length: 7 }, (_, k) => {
        const on = k >= 7 - n, borde = on && k === (mora ? 6 : 7 - n);
        return { bg: borde ? acento : on ? '#303030' : '#e6e6e6', demora: k * 40 };
      }),
    };
  });
  protected readonly estadoPlanLinea = computed(() => {
    const c = this.cuenta();
    const vence = c.diasParaVencer === 1 ? 'vence mañana' : `vence en ${c.diasParaVencer} días`;
    return ({ 'al dia': ['#5fe39b', c.venceTexto ? 'renueva ' + c.venceTexto : 'al día'], 'por vencer': ['#ffd24a', vence], 'en mora': ['#ff8f7a', 'en mora'] } as const)[c.estadoPlan];
  });

  protected readonly menuAbierto = signal(false);
  protected readonly hoverCuenta = signal(false);
  protected readonly hoverMarca = signal(false);
  /** Línea secundaria: false = empresa, true = plan. Alterna mientras el menú está abierto o hay alerta de cobro. */
  protected readonly volteo = signal(false);
  protected readonly resaltado = signal(-1);
  protected readonly hold = signal<false | 'manteniendo' | 'listo'>(false);
  protected readonly opciones: { texto: string; seccion: string; ruta?: string }[] = [
    { texto: 'Mi perfil', seccion: 'perfil' },
    { texto: 'Seguridad', seccion: 'seguridad' },
    { texto: 'Correos', seccion: 'correos' },
    { texto: 'Ayuda y soporte', seccion: 'soporte', ruta: '/messages' },
  ];
  private ivVolteo?: ReturnType<typeof setInterval>;
  private tVolteo?: ReturnType<typeof setTimeout>;
  private holdTimer?: ReturnType<typeof setTimeout>;

  // ── Migas ───────────────────────────────────────────────────────────────
  private readonly url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)), { initialValue: this.router.url });
  /** Pantalla completa del asistente (fuera del Shell): "Volver al panel". */
  protected readonly enAsistente = computed(() => this.url().startsWith('/asistente'));
  /** Atajos: el diálogo vive en la lista de Products. */
  protected readonly conAtajos = computed(() => this.url().split(/[?#]/)[0] === '/products');
  /**
   * Migas desde `data.breadcrumb`/`data.icon` de la ruta activa. En Products
   * va "Products › módulo" (handoff v5); en el resto, solo la pantalla.
   */
  protected readonly migas = computed(() => {
    this.url();
    let r: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let hoja: ActivatedRouteSnapshot | null = null;
    while (r) {
      if (r.data?.['breadcrumb']) hoja = r;
      r = r.firstChild;
    }
    if (!hoja) return [];
    const icono = (d: ActivatedRouteSnapshot['data']) => ICONO_RUTA[d['icon']] ?? d['icon'] ?? 'category';
    const ruta = '/' + this.url().split(/[?#]/)[0].split('/').filter(Boolean).join('/');
    const seg = ruta.split('/').filter(Boolean);
    // WhatsApp (rediseño 2026-10-13): "WhatsApp › sección", también en la Bandeja.
    if (seg[0] === 'whatsapp') {
      // Sin número conectado (pantalla "Conectar número") no hay sección.
      if (this.whatsapp.sinNumero()) return [{ texto: 'WhatsApp', icono: 'brand-whatsapp', ruta: '/whatsapp', actual: true }];
      return [
        { texto: 'WhatsApp', icono: 'brand-whatsapp', ruta: '/whatsapp', actual: false },
        { texto: hoja.data['breadcrumb'] as string, icono: icono(hoja.data), ruta, actual: true },
      ];
    }
    if (seg[0] === 'products' && seg.length > 1) {
      return [
        { texto: 'Products', icono: 'tag', ruta: '/products', actual: false },
        { texto: hoja.data['breadcrumb'] as string, icono: icono(hoja.data), ruta, actual: true },
      ];
    }
    return [{ texto: hoja.data['breadcrumb'] as string, icono: icono(hoja.data), ruta, actual: true }];
  });

  // ── Notificaciones ──────────────────────────────────────────────────────
  protected readonly notificaciones = signal<Notificacion[]>([]);
  private readonly ocultas = signal<Set<number>>(new Set());
  protected readonly visibles = computed(() => this.notificaciones().filter((n) => !this.ocultas().has(n.id)));
  protected readonly noLeidas = computed(() => this.visibles().filter((n) => !n.leidaEn).length);
  protected readonly panelAbierto = signal(false);
  protected readonly pestana = signal<Pestana>('todas');
  protected readonly timbre = signal(0);
  /** TODO: ajustar a las categorías reales del catálogo de admin. */
  private cat = (n: Notificacion): Pestana => {
    const c = defTipo(n.tipo).cat as string;
    return c === 'soporte' ? 'soporte' : ['inventario', 'compras', 'pedidos', 'tienda'].includes(c) ? 'tienda' : 'cuenta';
  };
  protected readonly pestanas = computed(() => {
    const nl = this.visibles().filter((n) => !n.leidaEn);
    return ([['todas', 'Todas'], ['soporte', 'Soporte'], ['tienda', 'Tienda'], ['cuenta', 'Cuenta']] as [Pestana, string][]).map(([id, texto]) => ({
      id, texto, cuenta: nl.filter((n) => id === 'todas' || this.cat(n) === id).length,
    }));
  });
  protected readonly grupos = computed(() => {
    const p = this.pestana();
    return agruparPorDia(this.visibles().filter((n) => p === 'todas' || this.cat(n) === p).slice(0, 12).map((n) => filaNotificacion(n)));
  });

  private sub?: Subscription;

  constructor() {
    if (this.auth.isAuthenticated()) {
      // El perfil (permisos, módulos, Empresa) lo pide el topbar: es lo
      // único que montan las tres pantallas (Shell, asistente, documentos),
      // y al recargar en /asistente el Shell no existe.
      this.auth.cargarPerfil().subscribe({ error: () => undefined });
      this.cargar();
    }
    this.sub = this.realtime.escuchar<Notificacion>('notificacion:nueva').subscribe(() => {
      this.cargar();
      this.timbre.update((v) => v + 1);
    });
    // Con alerta de cobro, la línea alterna sola cada 3,6 s aunque el menú esté cerrado.
    this.ivVolteo = setInterval(() => { if (this.alertaPlan() && !this.menuAbierto()) this.volteo.update((v) => !v); }, 3600);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearInterval(this.ivVolteo);
    clearTimeout(this.tVolteo);
    clearTimeout(this.holdTimer);
  }

  private cargar(): void {
    this.notificacionService.listar().subscribe({ next: (r) => this.notificaciones.set(r.data), error: () => undefined });
  }

  @HostListener('document:mousedown', ['$event'])
  protected clicAfuera(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (this.panelAbierto() && !t.closest('[data-panel="campana"]')) this.panelAbierto.set(false);
    if (this.menuAbierto() && !t.closest('[data-panel="cuenta"]')) this.cerrarMenu();
  }

  @HostListener('document:keydown', ['$event'])
  protected teclado(e: KeyboardEvent): void {
    if (e.key === 'Escape') { this.panelAbierto.set(false); this.cerrarMenu(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector<HTMLInputElement>('[data-atajo="global"]')?.focus(); return; }
    const tag = (e.target as HTMLElement).tagName;
    if (this.menuAbierto() && /^[1-9]$/.test(e.key) && tag !== 'INPUT' && tag !== 'TEXTAREA') {
      const o = this.opciones[+e.key - 1];
      if (o) this.irA(o.seccion);
    }
  }

  // ── Campanita ───────────────────────────────────────────────────────────
  protected togglePanel(): void {
    this.panelAbierto.update((v) => !v);
    this.cerrarMenu();
  }
  protected abrir(f: ReturnType<typeof filaNotificacion>): void {
    this.marcar(f.n, true);
    this.panelAbierto.set(false);
    this.router.navigate([f.destino.url], { queryParams: f.destino.query });
  }
  protected alternar(n: Notificacion): void {
    this.marcar(n, !n.leidaEn);
  }
  private marcar(n: Notificacion, leida: boolean): void {
    if (!!n.leidaEn === leida) return;
    const antes = n.leidaEn;
    this.notificaciones.update((a) => a.map((x) => (x.id === n.id ? { ...x, leidaEn: leida ? new Date().toISOString() : null } : x)));
    (leida ? this.notificacionService.marcarLeida(n.id) : this.notificacionService.marcarNoLeida(n.id))
      .subscribe({ error: () => this.notificaciones.update((a) => a.map((x) => (x.id === n.id ? { ...x, leidaEn: antes } : x))) });
  }
  protected marcarTodasLeidas(): void {
    if (!this.noLeidas()) return;
    const antes = this.notificaciones(), ahora = new Date().toISOString();
    this.notificaciones.update((a) => a.map((x) => (x.leidaEn ? x : { ...x, leidaEn: ahora })));
    this.notificacionService.marcarTodasLeidas().subscribe({ error: () => this.notificaciones.set(antes) });
  }
  protected limpiar(): void {
    if (!this.visibles().length) return;
    this.ocultas.set(new Set(this.notificaciones().map((n) => n.id)));
    this.notificacionService.ocultarTodas().subscribe({ error: () => undefined });
  }
  protected verTodas(): void {
    this.panelAbierto.set(false);
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
    const abrir = !this.menuAbierto();
    this.menuAbierto.set(abrir);
    this.panelAbierto.set(false);
    this.resaltado.set(-1);
    if (this.hold() !== 'listo') this.hold.set(false);
    clearTimeout(this.tVolteo);
    this.volteo.set(false);
    if (abrir) {
      // A los 1,4 s muestra el plan y luego alterna cada 3 s mientras siga abierto.
      this.tVolteo = setTimeout(() => {
        if (!this.menuAbierto()) return;
        this.volteo.set(true);
        const iv = setInterval(() => (this.menuAbierto() ? this.volteo.update((v) => !v) : clearInterval(iv)), 3000);
      }, 1400);
    }
  }
  private cerrarMenu(): void {
    this.menuAbierto.set(false);
    this.resaltado.set(-1);
    if (this.hold() === 'manteniendo') this.cancelarHold();
  }
  protected irA(seccion: string): void {
    this.cerrarMenu();
    const o = this.opciones.find((x) => x.seccion === seccion);
    if (o?.ruta) this.router.navigateByUrl(o.ruta);
    else this.router.navigate(['/settings'], { queryParams: { seccion } });
  }
  /** El plan y los cobros están en Settings › Cuenta. */
  protected pagar(): void {
    this.cerrarMenu();
    this.router.navigate(['/settings'], { queryParams: { seccion: 'cuenta' } });
  }
  protected atajosClick(): void {
    this.atajos.guia.set(true);
    this.abrirAtajos.emit();
  }
  protected asistenteClick(): void {
    this.asistente.abrirPanel();
    this.abrirAsistente.emit();
  }
  /** Igual que `AsistentePageComponent.volver()`. */
  protected volver(): void {
    if (history.length > 1) history.back();
    else this.router.navigate(['/']);
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
      setTimeout(() => this.salir(), 700);
    }, MS_HOLD);
  }
  protected cancelarHold(): void {
    if (this.hold() !== 'manteniendo') return;
    clearTimeout(this.holdTimer);
    this.hold.set(false);
  }
  private salir(): void {
    this.menuAbierto.set(false);
    this.hold.set(false);
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  protected irMiga(ruta: string): void {
    this.router.navigateByUrl(ruta);
  }
}
