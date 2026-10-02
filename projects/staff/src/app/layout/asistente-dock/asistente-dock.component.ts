import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IconArrowUp,
  IconArrowsDiagonal,
  IconBuildingStore,
  IconCalendarDue,
  IconChartLine,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconDatabase,
  IconEdit,
  IconHandMove,
  IconPaperclip,
  IconPlayerStopFilled,
  IconPlus,
  IconReceipt2,
  IconUserPlus,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { AuthService } from '../../core/auth/auth.service';
import { AsistenteChatStore } from '../../core/asistente-staff/asistente-chat.store';
import { AsistenteStaffService } from '../../core/asistente-staff/asistente-staff.service';
import { AsistenteStaffMensaje } from '../../core/asistente-staff/models/asistente-staff.model';
import { IaMarcaComponent } from '../../shared/ui/ia-marca/ia-marca.component';
import { IaSaludoComponent } from '../../shared/ui/ia-saludo/ia-saludo.component';
import { MarkdownLigeroPipe } from '../../shared/ui/markdown-ligero/markdown-ligero.pipe';

type Lado = 'right' | 'left' | 'top' | 'bottom';
interface Dock { lado: Lado; t: number }
/** Estilo de la etiqueta hover (`etiqueta()`, más abajo): `left`/`right`/
 * `top`/`bottom` se acceden dinámicamente por nombre de lado (bracket
 * notation en el template), mientras que `transform`/`opacidad` son
 * siempre las mismas dos propiedades — declaradas explícitas para poder
 * leerlas con notación de punto pese al índice (`noPropertyAccessFromIndexSignature`). */
interface EtiquetaEstilo {
  [lado: string]: string | number | undefined;
  transform: string;
  opacidad: number;
}

const B = 52; // diámetro del botón
const OCULTO = 26; // px escondidos tras el borde en reposo
const ASOMA = 18; // px escondidos en hover (crece pegado al borde)
const M = 12; // margen con los bordes de la ventana
const KEY_DOCK = 'goods-ia-dock';
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

const SUGERENCIAS = [
  { icono: IconBuildingStore, texto: '¿Cuántas Empresas están activas hoy?' },
  { icono: IconUserPlus, texto: '¿Qué altas llevan más de 3 días esperando?' },
  { icono: IconCalendarDue, texto: '¿Qué suscripciones vencen esta semana?' },
  { icono: IconChartLine, texto: '¿Cuánto facturamos en septiembre?' },
];

/**
 * Botón del Asistente pegado a un borde de la ventana + mini chat.
 * Reemplaza a `AsistenteStaffPanelComponent` en `ShellComponent`.
 *
 * - En reposo: círculo negro de 52 px, medio escondido tras el borde.
 * - Hover: crece (scale 1.2) desde el borde sin despegarse, la marca gira
 *   más rápido y hace un "saludo", aparece la etiqueta.
 * - Arrastre: se mueve libre por la pantalla; al soltar se pega al borde
 *   más cercano (cualquiera de los 4) con rebote. La posición se guarda
 *   en localStorage (`goods-ia-dock`).
 * - Clic (sin arrastrar): abre/cierra el mini chat junto al botón.
 * - Maximizar: el panel se expande a pantalla completa y navega a
 *   `/asistente` (misma conversación, vía `AsistenteChatStore`).
 */
@Component({
  selector: 'app-asistente-dock',
  standalone: true,
  imports: [FormsModule, TablerIconComponent, IaMarcaComponent, IaSaludoComponent, MarkdownLigeroPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asistente-dock.component.html',
})
export class AsistenteDockComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly servicio = inject(AsistenteStaffService);
  protected readonly store = inject(AsistenteChatStore);

  protected readonly i = {
    maximizar: IconArrowsDiagonal, cerrar: IconX, nueva: IconEdit, chevron: IconChevronDown,
    mas: IconPlus, clip: IconPaperclip, pago: IconReceipt2, enviar: IconArrowUp, detener: IconPlayerStopFilled,
    copiar: IconCopy, copiado: IconCheck, fuentes: IconDatabase, mover: IconHandMove,
  };
  protected readonly sugerencias = SUGERENCIAS;
  protected readonly accept = ACCEPT;

  protected readonly visible = computed(() =>
    (this.auth.currentUser()?.permisos ?? []).includes('asistente_staff.usar'),
  );
  protected readonly nombre = computed(() => this.auth.currentUser()?.nombres?.split(' ')[0] ?? '');

  // ── Posición ───────────────────────────────────────────────
  private readonly vw = signal(window.innerWidth);
  private readonly vh = signal(window.innerHeight);
  protected readonly dock = signal<Dock>(this.leerDock());
  protected readonly hover = signal(false);
  protected readonly drag = signal<{ x: number; y: number } | null>(null);
  protected readonly abierto = this.servicio.abierto;
  protected readonly cerrando = signal(false);
  protected readonly maximizando = signal(false);
  protected readonly pendiente = signal(false);

  private readonly base = computed(() => {
    const d = this.drag();
    if (d) return d;
    const { lado, t } = this.dock();
    const vw = this.vw(), vh = this.vh();
    const along = (len: number) => Math.max(M, Math.min(len - B - M, t * len - B / 2));
    if (lado === 'right') return { x: vw - B, y: along(vh) };
    if (lado === 'left') return { x: 0, y: along(vh) };
    if (lado === 'top') return { x: along(vw), y: 0 };
    return { x: along(vw), y: vh - B };
  });
  protected readonly lado = computed<Lado>(() => (this.drag() ? this.masCercano(this.base().x, this.base().y) : this.dock().lado));

  protected readonly boton = computed(() => {
    const { x, y } = this.base();
    const lado = this.lado();
    const pegado = !this.abierto() && !this.drag();
    const off = pegado ? (this.hover() ? ASOMA : OCULTO) : 0;
    const desliz = { right: `translateX(${off}px)`, left: `translateX(${-off}px)`, top: `translateY(${-off}px)`, bottom: `translateY(${off}px)` }[lado];
    const escala = this.drag() ? ' scale(1.08)' : this.hover() && pegado ? ' scale(1.2)' : '';
    return {
      left: x, top: y,
      transform: desliz + escala,
      origen: this.drag() ? 'center' : { right: 'right center', left: 'left center', top: 'center top', bottom: 'center bottom' }[lado],
      transicion: this.drag() ? 'opacity 200ms' : 'left 520ms cubic-bezier(0.3,1.35,0.5,1), top 520ms cubic-bezier(0.3,1.35,0.5,1), opacity 200ms',
      sombra: this.drag()
        ? '0 0 0 1px rgba(255,255,255,0.1), 0 22px 40px -12px rgba(0,0,0,0.6)'
        : this.hover() || this.abierto()
          ? '0 0 0 1px rgba(255,255,255,0.1), 0 14px 30px -12px rgba(0,0,0,0.55)'
          : '0 0 0 1px rgba(255,255,255,0.08), 0 8px 20px -10px rgba(0,0,0,0.5)',
    };
  });

  protected readonly etiqueta = computed(() => {
    const g = !this.abierto() ? '54px' : B + 10 + 'px';
    const ver = this.hover() && !this.drag() && !this.abierto();
    const pos = {
      right: { right: g, top: '50%', on: 'translateY(-50%)', off: 'translate(8px,-50%)' },
      left: { left: g, top: '50%', on: 'translateY(-50%)', off: 'translate(-8px,-50%)' },
      top: { top: g, left: '50%', on: 'translateX(-50%)', off: 'translate(-50%,-8px)' },
      bottom: { bottom: g, left: '50%', on: 'translateX(-50%)', off: 'translate(-50%,8px)' },
    }[this.lado()] as Record<string, string>;
    return { ...pos, transform: ver ? pos['on'] : pos['off'], opacidad: ver ? 1 : 0 } as EtiquetaEstilo;
  });

  protected readonly panel = computed(() => {
    const vw = this.vw(), vh = this.vh(), lado = this.lado();
    if (this.maximizando()) return { left: 0, top: 0, width: vw, height: vh, radio: 0, origen: 'center', transicion: 'all 460ms cubic-bezier(0.22,1,0.36,1)' };
    const vert = lado === 'top' || lado === 'bottom';
    const W = Math.min(392, vert ? vw - 2 * M : vw - B - 3 * M);
    const H = Math.min(600, vert ? vh - B - 3 * M : vh - 2 * M);
    const { x, y } = this.base();
    const cx = x + B / 2, cy = y + B / 2;
    let L: number, T: number;
    if (lado === 'right') { L = vw - B - M - W; T = cy - H + 120; }
    else if (lado === 'left') { L = B + M; T = cy - H + 120; }
    else if (lado === 'top') { T = B + M; L = cx - W / 2; }
    else { T = vh - B - M - H; L = cx - W / 2; }
    L = Math.max(M, Math.min(vw - W - M, L));
    T = Math.max(M, Math.min(vh - H - M, T));
    const curva = 'cubic-bezier(0.22,1,0.36,1)';
    return {
      left: L, top: T, width: W, height: H, radio: 20,
      origen: `${cx - L}px ${cy - T}px`,
      transicion: this.drag() ? 'opacity 180ms, transform 200ms' : `left 420ms ${curva}, top 420ms ${curva}, opacity 180ms, transform 200ms`,
    };
  });

  // ── Chat ────────────────────────────────────────────────────
  protected readonly texto = signal('');
  protected readonly enfocado = signal(false);
  protected readonly masAbierto = signal(false);
  protected readonly copiado = signal<number | null>(null);
  protected readonly vacio = computed(() => !this.store.mensajes().length);
  protected readonly puedeEnviar = computed(() => !!this.texto().trim());

  @ViewChild('hilo') private hiloRef?: ElementRef<HTMLDivElement>;
  @ViewChild('composer') private composerRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('archivo') private archivoRef?: ElementRef<HTMLInputElement>;

  private p0: { x: number; y: number; ox: number; oy: number; movido: boolean } | null = null;

  constructor() {
    effect(() => {
      if (this.abierto()) this.store.cargar();
    });
    effect(() => {
      this.store.mensajes();
      this.store.visible();
      requestAnimationFrame(() => {
        const el = this.hiloRef?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
    // Punto turquesa si una respuesta termina con el chat cerrado.
    let previa = false;
    effect(() => {
      const g = this.store.generando();
      if (previa && !g && !this.abierto()) this.pendiente.set(true);
      previa = g;
    });
    effect(() => {
      const b = this.store.borradorDevuelto();
      if (b) {
        this.texto.set(b);
        this.store.borradorDevuelto.set(null);
      }
    });
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.vw.set(window.innerWidth);
    this.vh.set(window.innerHeight);
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (this.masAbierto()) return this.masAbierto.set(false);
    if (this.abierto()) this.cerrar();
  }

  // ── Arrastre ────────────────────────────────────────────────
  protected onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 || this.maximizando()) return;
    e.preventDefault();
    const b = this.base();
    this.p0 = { x: e.clientX, y: e.clientY, ox: e.clientX - b.x, oy: e.clientY - b.y, movido: false };
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp, { once: true });
  }

  private readonly onMove = (e: PointerEvent) => {
    const p = this.p0;
    if (!p) return;
    if (!p.movido && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return;
    p.movido = true;
    this.drag.set({
      x: Math.max(0, Math.min(this.vw() - B, e.clientX - p.ox)),
      y: Math.max(0, Math.min(this.vh() - B, e.clientY - p.oy)),
    });
  };

  private readonly onUp = () => {
    window.removeEventListener('pointermove', this.onMove);
    const p = this.p0;
    this.p0 = null;
    const d = this.drag();
    if (!p) return;
    if (!p.movido || !d) return this.toggle();
    const lado = this.masCercano(d.x, d.y);
    const t = lado === 'left' || lado === 'right' ? (d.y + B / 2) / this.vh() : (d.x + B / 2) / this.vw();
    this.dock.set({ lado, t });
    try {
      localStorage.setItem(KEY_DOCK, JSON.stringify({ lado, t }));
    } catch {
      /* sin storage */
    }
    this.drag.set(null);
    this.hover.set(false);
  };

  protected onBotonKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.toggle();
    }
  }

  protected onLeave(): void {
    if (!this.p0) this.hover.set(false);
  }

  // ── Abrir / cerrar / maximizar ──────────────────────────────
  protected toggle(): void {
    this.abierto() ? this.cerrar() : this.abrir();
  }

  protected abrir(): void {
    this.cerrando.set(false);
    this.pendiente.set(false);
    this.servicio.abrirPanel();
    setTimeout(() => this.composerRef?.nativeElement.focus(), 120);
  }

  protected cerrar(): void {
    if (!this.abierto()) return;
    this.cerrando.set(true);
    setTimeout(() => {
      this.servicio.cerrarPanel();
      this.cerrando.set(false);
    }, 200);
  }

  protected maximizar(): void {
    this.masAbierto.set(false);
    this.maximizando.set(true);
    setTimeout(() => {
      this.router.navigate(['/asistente']).then(() => {
        this.servicio.cerrarPanel();
        this.maximizando.set(false);
      });
    }, 480);
  }

  // ── Chat ────────────────────────────────────────────────────
  protected enviar(t?: string): void {
    const cuerpo = (t ?? this.texto()).trim();
    if (!cuerpo) return;
    if (/registr\w*\s+(un\s+)?pago|comprobante/i.test(cuerpo)) {
      // El flujo de pago necesita espacio: se continúa en pantalla completa.
      this.texto.set('');
      this.router.navigate(['/asistente'], { queryParams: { pago: 1 } });
      this.servicio.cerrarPanel();
      return;
    }
    if (this.store.enviar(cuerpo)) this.texto.set('');
  }

  protected accionBoton(): void {
    this.store.generando() ? this.store.detener() : this.enviar();
  }

  protected onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.enviar();
    }
  }

  protected adjuntar(): void {
    this.masAbierto.set(false);
    this.archivoRef?.nativeElement.click();
  }

  /** Un comprobante adjunto en el mini chat se continúa en pantalla completa. */
  protected onArchivo(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    this.store.archivoPendiente.set(f);
    this.maximizar();
  }

  protected registrarPago(): void {
    this.masAbierto.set(false);
    this.router.navigate(['/asistente'], { queryParams: { pago: 1 } });
    this.servicio.cerrarPanel();
  }

  protected copiar(m: AsistenteStaffMensaje): void {
    navigator.clipboard?.writeText(m.cuerpo).catch(() => undefined);
    this.copiado.set(m.id);
    setTimeout(() => this.copiado.set(null), 1400);
  }

  ngOnDestroy(): void {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
  }

  private masCercano(x: number, y: number): Lado {
    const d: Record<Lado, number> = { left: x, right: this.vw() - x - B, top: y, bottom: this.vh() - y - B };
    return (Object.keys(d) as Lado[]).reduce((a, b) => (d[a] <= d[b] ? a : b));
  }

  private leerDock(): Dock {
    try {
      const d = JSON.parse(localStorage.getItem(KEY_DOCK) ?? 'null');
      if (d?.lado) return d;
    } catch {
      /* sin storage */
    }
    return { lado: 'right', t: 0.62 };
  }
}
