import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ChatService } from '../../core/chat/chat.service';
import {
  Adjunto,
  CaraSoporte,
  ChatUsuario,
  Conversacion,
  EstadoSoporte,
  EventoMensajeNuevo,
  EventoMensajesLeidos,
  Mensaje,
} from '../../core/chat/models/conversacion.model';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { mensajeDeError } from '../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../core/ui/alerta.service';
import { IcComponent } from '../../features/products/shared/ui/ic/ic.component';
import { iniciales, tonoPersona } from '../../shared/ui/persona';

const CLAVE = 'goods.soporte.dock';
/** Lo que acepta `POST …/mensajes/adjuntos`. */
const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGENES = 4;
const MAX_BYTES = 5 * 1024 * 1024;
/** Alto del botón. */
const B = 44;
/** Margen contra los bordes de la ventana. */
const M = 12;
const OCULTAR_MS = 4000;
/** Ancho de la etiqueta del hover mientras no se ha medido. */
const ETIQUETA_W = 150;
const TEMAS = [
  { t: 'Tengo un problema con un pedido', icono: 'shopping-bag' },
  { t: 'Pagos, facturación o mi plan', icono: 'receipt-2' },
  { t: 'WhatsApp o la tienda en línea', icono: 'brand-whatsapp' },
  { t: 'Otra cosa', icono: 'help-circle' },
];

type Vista = 'lista' | 'hilo' | 'nueva';

interface ItemDia {
  k: 'dia';
  t: string;
}
interface ItemSistema {
  k: 'sis';
  m: Mensaje;
  icono: string;
}
interface ItemMensaje {
  k: 'msg';
  m: Mensaje;
  mio: boolean;
  /** Primer mensaje de un grupo del mismo autor (lleva más aire arriba). */
  primero: boolean;
  /** Último del grupo: lleva avatar, hora y la esquina «de cola». */
  ultimo: boolean;
  radio: string;
}
type ItemHilo = ItemDia | ItemSistema | ItemMensaje;

/**
 * SoporteDock: botón negro pegado al borde derecho que abre un mini chat con
 * soporte de Goods. Va una sola vez en el shell, junto a `app-asistente-dock`.
 *
 * @remarks
 * - El botón es una píldora que asoma 22 px desde el borde con una cara (dos
 *   «ojos» que siguen al mouse y una diadema turquesa). Se arrastra en vertical
 *   y guarda la posición en `localStorage` (fracción `t` del alto); con el
 *   teclado, ↑ ↓ lo mueven 5 %.
 * - Tras 4 s sin uso se esconde más (asoma 7 px) y vuelve al acercar el mouse.
 * - Hover: se estira, los ojos sonríen y aparece «Soporte · Escríbenos, estamos
 *   aquí». Si un agente respondió y no lo has visto, dice «Laura te respondió»
 *   con su avatar y el botón se asoma cada pocos segundos.
 * - Panel 380 × 580 a la izquierda del botón, creciendo desde él. Vistas: lista
 *   de conversaciones, hilo y conversación nueva (con temas rápidos).
 * - En vivo: `mensaje:nuevo` llega a la sala personal del dueño de la
 *   conversación; con cada evento se recargan la lista y ese hilo.
 * - No leídos, tema y último mensaje vienen en `GET /chat/conversaciones/mias`.
 *   Al abrir un hilo (o recibir un mensaje con él a la vista) se llama
 *   `POST …/leida`; `mensajes:leidos` pone las ✓✓ cuando soporte lee.
 * - La cabecera y la conversación nueva usan `GET /chat/soporte/estado`
 *   (horario, tiempo de respuesta y caras del equipo); se pide al abrir.
 * - Imágenes: clip o pegar (Ctrl + V), hasta 4 de 5 MB. Son privadas, así que
 *   se descargan con la sesión y se muestran como `blob:`.
 * - TODO(backend): el diseño muestra «escribiendo…» del agente; no hay evento.
 */
@Component({
  selector: 'app-soporte-dock',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './soporte-dock.component.html',
  host: { '(document:keydown.escape)': 'abierto() && cerrar()' },
})
export class SoporteDockComponent {
  private readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly alertas = inject(AlertaService);

  protected readonly temas = TEMAS;
  protected readonly tiposImagen = TIPOS_IMAGEN.join(',');

  // Ventana y botón
  protected readonly vw = signal(innerWidth);
  protected readonly vh = signal(innerHeight);
  /** Posición vertical del botón: fracción 0–1 del alto de la ventana. */
  private readonly t = signal(leer());
  /** `top` del botón mientras se arrastra. */
  protected readonly drag = signal<number | null>(null);
  protected readonly hover = signal(false);
  private readonly oculto = signal(false);
  private readonly mouse = signal<{ x: number; y: number } | null>(null);
  private readonly etiquetaW = signal(ETIQUETA_W);

  // Panel
  protected readonly abierto = signal(false);
  private readonly cerrando = signal(false);
  protected readonly vista = signal<Vista>('lista');
  protected readonly convs = signal<Conversacion[]>([]);
  protected readonly convId = signal<number | null>(null);
  /** Mensajes por conversación abierta alguna vez (ya ordenados). */
  private readonly hilos = signal<Record<number, Mensaje[]>>({});
  /** No leídos por conversación: los del backend, más los que llegan en vivo. */
  private readonly noLeidos = signal<Record<number, number>>({});
  protected readonly estado = signal<EstadoSoporte | null>(null);
  protected readonly texto = signal('');
  /** Imágenes elegidas para el próximo mensaje, con su vista previa local. */
  protected readonly archivos = signal<{ f: File; url: string }[]>([]);
  /** `blob:` de cada imagen ya descargada, por id de adjunto. */
  protected readonly imgs = signal<Record<number, string>>({});
  private readonly pedidas = new Set<number>();
  protected readonly respondiendo = signal<Mensaje | null>(null);
  protected readonly enviando = signal(false);
  protected readonly foco = signal(false);
  protected readonly hoverMsg = signal<number | null>(null);

  private readonly refHilo = viewChild<ElementRef<HTMLElement>>('hilo');
  private readonly refTexto = viewChild<ElementRef<HTMLTextAreaElement>>('composer');
  private readonly refEtiqueta = viewChild<ElementRef<HTMLElement>>('etiqueta');
  private readonly refArchivo = viewChild<ElementRef<HTMLInputElement>>('archivo');
  private ultimoUso = Date.now();

  protected readonly yoId = computed(() => this.auth.currentUser()?.id ?? -1);

  /** `top` del botón. */
  protected readonly y = computed(
    () => this.drag() ?? clamp(this.t() * this.vh() - B / 2, M, this.vh() - B - M),
  );

  protected readonly conv = computed(() =>
    this.vista() === 'hilo' ? (this.convs().find((c) => c.id === this.convId()) ?? null) : null,
  );
  protected readonly mensajes = computed(() => {
    const id = this.convId();
    return id ? (this.hilos()[id] ?? []) : [];
  });
  protected readonly cerrada = computed(() => this.conv()?.estado === 'cerrada');
  private readonly pendientes = computed(() =>
    Object.values(this.noLeidos()).reduce((n, x) => n + x, 0),
  );

  /** Botón: forma, cara, etiqueta y diadema según reposo, hover, arrastre o panel abierto. */
  protected readonly lanz = computed(() => {
    const exp = this.hover() && this.drag() === null && !this.abierto();
    const arrastrando = this.drag() !== null;
    const oculto = this.oculto() && !exp && !arrastrando && !this.abierto();
    const right = exp ? -10 : arrastrando ? -12 : oculto ? -37 : -22;
    const cn = this.convs().find((c) => (this.noLeidos()[c.id] ?? 0) > 0);
    const agente = cn?.agenteAsignado ?? null;
    const avisa = !!agente && !exp && !this.abierto() && !arrastrando;
    return {
      right,
      hsRight: right - 6,
      hsOp: this.abierto() || oculto ? 0 : 1,
      faceR: exp ? 10 : arrastrando ? 12 : 19,
      w: exp ? 66 + 20 + this.etiquetaW() : B,
      exp,
      labT: exp ? 'none' : 'translateX(14px)',
      ojosOp: this.abierto() ? 0 : 1,
      ojosT: this.abierto() ? 'rotate(90deg) scale(.3)' : exp ? 'none' : this.mirada(),
      diademaT: this.abierto() ? 'scale(.4)' : exp ? 'rotate(-8deg)' : 'none',
      agente,
      sub: agente ? `${agente.nombres} te respondió` : 'Escríbenos, estamos aquí',
      subColor: agente ? '#2be0d5' : '#a3a3a3',
      anim: avisa ? 'sp-asomar-x 3.2s ease-in-out 1s infinite' : 'none',
      transicion: arrastrando ? 'none' : 'top 520ms cubic-bezier(.3,1.35,.5,1)',
      cursor: arrastrando ? 'grabbing' : 'grab',
      sombra: arrastrando
        ? '0 24px 44px -14px rgba(0,0,0,.55)'
        : exp
          ? '0 18px 36px -14px rgba(0,0,0,.5)'
          : '0 8px 20px -10px rgba(0,0,0,.4)',
    };
  });
  protected readonly etiquetaTitulo = computed(() =>
    this.pendientes() ? `Soporte · ${this.pendientes()} sin leer` : 'Abrir soporte de Goods',
  );

  /** Panel a la izquierda del botón, con el `transform-origin` en el centro del botón. */
  protected readonly panel = computed(() => {
    const vw = this.vw();
    const vh = this.vh();
    const w = Math.min(380, vw - 2 * M - 30);
    const h = Math.min(580, vh - 2 * M);
    const cx = vw - B / 2;
    const cy = this.y() + B / 2;
    const left = clamp(vw - 22 - M - w, M, vw - w - M);
    const top = clamp(cy + B / 2 + 60 - h, M, vh - h - M);
    return {
      left,
      top,
      w,
      h,
      origen: `${cx - left}px ${cy - top}px`,
      transicion:
        this.drag() !== null
          ? 'opacity 180ms, transform 200ms'
          : 'left 420ms cubic-bezier(.22,1,.36,1), top 420ms cubic-bezier(.22,1,.36,1), opacity 180ms, transform 200ms',
      op: this.cerrando() ? 0 : 1,
      escala: this.cerrando() ? 'scale(.92)' : 'none',
    };
  });

  /** Cabecera del panel según la vista y el estado de la conversación. */
  protected readonly cab = computed(() => {
    const c = this.conv();
    const ag = c?.agenteAsignado ?? null;
    if (!c) {
      return {
        titulo: 'Soporte de Goods',
        sub: 'Una persona del equipo te responde aquí',
        ini: '',
        foto: null,
        tono: OSCURO,
        enLinea: false,
        ping: true,
      };
    }
    const tema = this.temaDe(c);
    // En línea solo si el backend lo dice (está entre las caras del equipo y conectado).
    const cara = ag ? this.estado()?.equipo.find((e) => e.id === ag.id) : undefined;
    return {
      titulo: ag ? `${ag.nombres} de Goods` : 'Soporte de Goods',
      sub:
        c.estado === 'cerrada'
          ? `Cerrada · ${tema}`
          : ag
            ? `Te está atendiendo · ${tema}`
            : 'Buscando a alguien del equipo…',
      ini: ag ? iniciales(nombre(ag)) : '',
      foto: ag?.imagenPerfil ?? null,
      tono: ag ? tonoPersona(nombre(ag)) : OSCURO,
      enLinea: !!cara?.enLinea && c.estado === 'abierta',
      ping: c.estado === 'abierta' && !ag,
    };
  });

  /** Cabecera de la lista: «Respondemos en unos 12 min · L a S, 7 a. m. – 9 p. m.» */
  protected readonly subLista = computed(() => {
    const e = this.estado();
    if (!e) return 'Una persona del equipo te responde aquí';
    const antes = !e.dentroDeHorario
      ? 'Fuera de horario'
      : e.tiempoRespuestaMin
        ? `Respondemos en unos ${minutos(e.tiempoRespuestaMin)}`
        : 'Una persona del equipo te responde';
    return `${antes} · ${e.horario.texto}`;
  });

  /** Conversación nueva: caras del equipo y cuánto suelen tardar. */
  protected readonly bienvenida = computed(() => {
    const e = this.estado();
    const base = 'Una persona del equipo de Goods te responde aquí.';
    let extra = '';
    if (e && !e.dentroDeHorario)
      extra = ` Ahora estamos fuera de horario (${e.horario.texto}): te respondemos apenas volvamos.`;
    else if (e?.tiempoRespuestaMin)
      extra = ` Solemos tardar unos ${minutos(e.tiempoRespuestaMin)}.`;
    return { texto: base + extra, equipo: e?.equipo ?? [] };
  });

  protected readonly lista = computed(() =>
    this.convs().map((c) => {
      const ag = c.agenteAsignado;
      // Lo último: lo del backend, o lo del hilo si es más nuevo (acabas de escribir).
      const ms = (this.hilos()[c.id] ?? []).filter((m) => !m.esSistema);
      const h = ms[ms.length - 1];
      const s = c.ultimoMensaje ?? null;
      const u =
        h && (!s || h.creadoEn > s.creadoEn)
          ? {
              autorId: h.autorId,
              cuerpo: h.cuerpo,
              creadoEn: h.creadoEn,
              adjuntos: h.adjuntos?.length ?? 0,
            }
          : s;
      return {
        c,
        tema: this.temaDe(c),
        ultimo: u
          ? (u.autorId === this.yoId() ? 'Tú: ' : '') + resumen(u.cuerpo, u.adjuntos)
          : c.estado === 'abierta'
            ? 'En curso'
            : 'Resuelta',
        cuando: relativo(u?.creadoEn ?? c.actualizadoEn),
        noLeidos: this.noLeidos()[c.id] ?? 0,
        ini: ag ? iniciales(nombre(ag)) : 'G',
        foto: ag?.imagenPerfil ?? null,
        tono: ag ? tonoPersona(nombre(ag)) : OSCURO,
      };
    }),
  );

  /** El hilo con separadores por día, avisos de sistema y mensajes agrupados por autor. */
  protected readonly items = computed<ItemHilo[]>(() => {
    const out: ItemHilo[] = [];
    const ms = this.mensajes();
    let prevAutor: number | null | undefined;
    ms.forEach((m, i) => {
      const d = dia(m.creadoEn);
      if (i === 0 || dia(ms[i - 1].creadoEn) !== d) {
        out.push({ k: 'dia', t: d });
        prevAutor = undefined;
      }
      if (m.esSistema) {
        out.push({
          k: 'sis',
          m,
          icono: /cerr/i.test(m.cuerpo)
            ? 'lock'
            : /asign|tom[oó]/i.test(m.cuerpo)
              ? 'user-check'
              : 'clock',
        });
        prevAutor = undefined;
        return;
      }
      const mio = m.autorId === this.yoId();
      const sig = ms[i + 1];
      const ultimo = !sig || sig.esSistema || sig.autorId !== m.autorId || dia(sig.creadoEn) !== d;
      const primero = prevAutor !== m.autorId;
      prevAutor = m.autorId;
      const radio = mio
        ? ultimo
          ? '18px 18px 6px 18px'
          : '18px 6px 6px 18px'
        : ultimo
          ? '18px 18px 18px 6px'
          : '6px 18px 18px 6px';
      out.push({ k: 'msg', m, mio, primero, ultimo, radio });
    });
    return out;
  });

  /** Con texto, o solo imágenes dentro de un hilo (para abrir una conversación el backend pide texto). */
  protected readonly puedeEnviar = computed(
    () =>
      !this.enviando() &&
      (!!this.texto().trim() || (this.archivos().length > 0 && this.vista() === 'hilo')),
  );

  constructor() {
    const rs = () => {
      this.vw.set(innerWidth);
      this.vh.set(innerHeight);
    };
    let raf = 0;
    const mira = (e: PointerEvent) => {
      const cerca = e.clientX > this.vw() - 90 && Math.abs(e.clientY - (this.y() + B / 2)) < 110;
      if (cerca) {
        this.ultimoUso = Date.now();
        if (this.oculto()) this.oculto.set(false);
      }
      if (raf) return;
      const p = { x: e.clientX, y: e.clientY };
      raf = requestAnimationFrame(() => {
        raf = 0;
        this.mouse.set(p);
      });
    };
    addEventListener('resize', rs);
    addEventListener('pointermove', mira, { passive: true });
    const idle = setInterval(() => {
      if (
        !this.oculto() &&
        !this.hover() &&
        !this.abierto() &&
        this.drag() === null &&
        Date.now() - this.ultimoUso > OCULTAR_MS
      )
        this.oculto.set(true);
    }, 800);

    // El ancho del hover depende de la etiqueta («Laura te respondió» es más larga).
    let ro: ResizeObserver | undefined;
    afterNextRender(() => {
      const el = this.refEtiqueta()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;
      ro = new ResizeObserver(() => el.offsetWidth && this.etiquetaW.set(el.offsetWidth));
      ro.observe(el);
    });

    const vivo = this.realtime
      .escuchar<EventoMensajeNuevo>('mensaje:nuevo')
      .subscribe((e) => this.alLlegar(e));
    // Al entrar, para que el botón avise lo que quedó sin leer antes de recargar.
    this.cargarConversaciones();
    const leidos = this.realtime
      .escuchar<EventoMensajesLeidos>('mensajes:leidos')
      .subscribe((e) => this.alLeer(e));

    inject(DestroyRef).onDestroy(() => {
      removeEventListener('resize', rs);
      removeEventListener('pointermove', mira);
      cancelAnimationFrame(raf);
      clearInterval(idle);
      ro?.disconnect();
      vivo.unsubscribe();
      leidos.unsubscribe();
      Object.values(this.imgs()).forEach((u) => URL.revokeObjectURL(u));
      this.archivos().forEach((a) => URL.revokeObjectURL(a.url));
    });

    // Descarga las imágenes del hilo a la vista (una vez cada una).
    effect(() => {
      const id = this.convId();
      if (!id || this.vista() !== 'hilo') return;
      for (const m of this.mensajes())
        for (const a of m.adjuntos ?? []) untracked(() => this.pedirImagen(id, a));
    });

    // Al llegar mensajes o cambiar de vista, baja al final del hilo.
    effect(() => {
      void this.items().length;
      void this.vista();
      void this.abierto();
      untracked(() =>
        requestAnimationFrame(() => {
          const el = this.refHilo()?.nativeElement;
          if (el) el.scrollTop = el.scrollHeight;
        }),
      );
    });
  }

  // Presentación

  protected nombre(u: ChatUsuario | null): string {
    return u ? nombre(u) : 'Soporte';
  }

  protected iniDe(u: ChatUsuario | null): string {
    return u ? iniciales(nombre(u)) : 'G';
  }

  protected tonoDe(u: ChatUsuario | null): [string, string] {
    return u ? tonoPersona(nombre(u)) : OSCURO;
  }

  protected tonoCara(e: CaraSoporte): [string, string] {
    return tonoPersona(e.nombres);
  }

  protected iniCara(e: CaraSoporte): string {
    return iniciales(e.nombres);
  }

  /** Texto de una cita o de «Respondiendo a»: una imagen sola no trae texto. */
  protected textoDe(m: { cuerpo: string; adjuntos?: Adjunto[] }): string {
    return resumen(m.cuerpo, m.adjuntos?.length ?? (m.cuerpo ? 0 : 1));
  }

  protected hora(f: string): string {
    return new Date(f).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  }

  /** El primer mensaje de la persona (`tema` del backend o del hilo), recortado; si no hay, el número. */
  private temaDe(c: Conversacion): string {
    const t =
      c.tema ||
      (this.hilos()[c.id] ?? []).find((m) => !m.esSistema && m.autorId === c.usuarioId && m.cuerpo)
        ?.cuerpo;
    if (!t) return `Conversación #${c.id}`;
    return t.length > 46 ? t.slice(0, 45) + '…' : t;
  }

  /** Los ojos miran hacia el mouse, hasta 3.5 px, con menos fuerza cuanto más cerca. */
  private mirada(): string {
    const mo = this.mouse();
    if (!mo) return 'none';
    const dx = mo.x - (this.vw() - 11);
    const dy = mo.y - (this.y() + B / 2);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 160);
    return `translate(${((dx / d) * 3.5 * k).toFixed(1)}px,${((dy / d) * 3 * k).toFixed(1)}px)`;
  }

  // Botón (se arrastra en vertical)

  protected entrar(): void {
    this.ultimoUso = Date.now();
    this.hover.set(true);
    this.oculto.set(false);
  }

  protected salir(): void {
    this.ultimoUso = Date.now();
    if (this.drag() === null) this.hover.set(false);
  }

  protected bajar(e: PointerEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    const y0 = e.clientY;
    const oy = e.clientY - this.y();
    let movido = false;
    const mover = (ev: PointerEvent) => {
      if (!movido && Math.abs(ev.clientY - y0) < 5) return;
      movido = true;
      this.drag.set(clamp(ev.clientY - oy, M + 10, this.vh() - B - M - 10));
    };
    const soltar = () => {
      removeEventListener('pointermove', mover);
      const d = this.drag();
      if (!movido || d === null) return this.alternar();
      const t = (d + B / 2) / this.vh();
      this.t.set(t);
      guardar(t);
      this.drag.set(null);
      this.hover.set(false);
    };
    addEventListener('pointermove', mover);
    addEventListener('pointerup', soltar, { once: true });
  }

  protected teclaBoton(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.alternar();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const t = clamp(this.t() + (e.key === 'ArrowUp' ? -0.05 : 0.05), 0.05, 0.95);
      this.t.set(t);
      guardar(t);
    }
  }

  // Panel

  protected alternar(): void {
    if (this.abierto()) this.cerrar();
    else this.abrir();
  }

  /** Abre en la conversación en curso; si no hay, en la lista (o en una nueva si nunca escribió). */
  protected abrir(): void {
    this.abierto.set(true);
    this.cerrando.set(false);
    this.oculto.set(false);
    this.ultimoUso = Date.now();
    this.cargarConversaciones(true);
    this.chat
      .estadoSoporte()
      .subscribe({ next: (e) => this.estado.set(e), error: () => undefined });
  }

  /** Se desvanece 200 ms antes de desmontarse. */
  protected cerrar(): void {
    if (!this.abierto() || this.cerrando()) return;
    this.cerrando.set(true);
    this.respondiendo.set(null);
    this.ultimoUso = Date.now();
    setTimeout(() => {
      this.abierto.set(false);
      this.cerrando.set(false);
    }, 200);
  }

  protected verLista(): void {
    this.vista.set('lista');
    this.respondiendo.set(null);
  }

  protected verHilo(id: number): void {
    this.convId.set(id);
    this.vista.set('hilo');
    this.respondiendo.set(null);
    this.cargarHilo(id);
    this.leer(id);
    this.enfocar(140);
  }

  protected nueva(): void {
    this.convId.set(null);
    this.vista.set('nueva');
    this.respondiendo.set(null);
    this.texto.set('');
    this.quitarArchivos();
    this.enfocar(60);
  }

  protected elegirTema(t: string): void {
    this.texto.set(t === 'Otra cosa' ? '' : `${t}: `);
    this.enfocar(0);
  }

  protected responder(m: Mensaje): void {
    this.respondiendo.set(m);
    this.enfocar(0);
  }

  protected tecla(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.enviar();
    }
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) return;
    const t = this.texto().trim();
    const imagenes = this.archivos().map((a) => a.f);
    this.enviando.set(true);
    const id = this.vista() === 'hilo' ? this.convId() : null;
    const fallo = (e: unknown) => {
      this.enviando.set(false);
      this.alertas.mostrar({
        estado: 'error',
        titulo: 'No se pudo enviar',
        texto: mensajeDeError(e, 'Revisa tu conexión e intenta de nuevo.'),
      });
    };
    const listo = (convId: number, m: Mensaje | null) => {
      this.enviando.set(false);
      this.texto.set('');
      this.respondiendo.set(null);
      this.quitarArchivos();
      if (m) this.hilos.update((h) => ({ ...h, [convId]: agregar(h[convId] ?? [], m) }));
    };
    if (!id) {
      // El backend abre la conversación con texto; las imágenes van en un segundo mensaje.
      this.chat.crear(t).subscribe({
        next: (c) => {
          this.convs.update((cs) => [c, ...cs.filter((x) => x.id !== c.id)]);
          const abrir = () => {
            listo(c.id, null);
            this.verHilo(c.id);
          };
          if (!imagenes.length) return abrir();
          this.chat.enviarConImagenes(c.id, '', imagenes).subscribe({
            next: abrir,
            error: (e) => {
              abrir();
              fallo(e);
            },
          });
        },
        error: fallo,
      });
      return;
    }
    const r = this.respondiendo()?.id;
    (imagenes.length
      ? this.chat.enviarConImagenes(id, t, imagenes, r)
      : this.chat.enviarMensaje(id, t, r)
    ).subscribe({ next: (m) => listo(id, m), error: fallo });
  }

  // Imágenes

  protected elegirArchivos(): void {
    this.refArchivo()?.nativeElement.click();
  }

  protected alElegir(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.agregarArchivos([...(input.files ?? [])]);
    input.value = '';
  }

  /** Pegar una captura en el campo la adjunta. */
  protected alPegar(e: ClipboardEvent): void {
    const fs = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (!fs.length) return;
    e.preventDefault();
    this.agregarArchivos(fs);
  }

  protected quitarArchivo(i: number): void {
    const a = this.archivos()[i];
    if (a) URL.revokeObjectURL(a.url);
    this.archivos.update((xs) => xs.filter((_, k) => k !== i));
  }

  private agregarArchivos(fs: File[]): void {
    const malos = fs.filter((f) => !TIPOS_IMAGEN.includes(f.type));
    const pesados = fs.filter((f) => TIPOS_IMAGEN.includes(f.type) && f.size > MAX_BYTES);
    const buenos = fs.filter((f) => TIPOS_IMAGEN.includes(f.type) && f.size <= MAX_BYTES);
    const cupo = MAX_IMAGENES - this.archivos().length;
    if (malos.length) {
      this.alertas.mostrar({
        estado: 'warning',
        titulo: 'Solo imágenes',
        texto: 'Adjunta PNG, JPG, WebP o GIF.',
      });
    } else if (pesados.length) {
      this.alertas.mostrar({
        estado: 'warning',
        titulo: 'La imagen pesa más de 5 MB',
        texto: 'Prueba con una más liviana.',
      });
    }
    if (buenos.length > cupo) {
      this.alertas.mostrar({
        estado: 'warning',
        titulo: `Hasta ${MAX_IMAGENES} imágenes por mensaje`,
      });
    }
    const nuevos = buenos
      .slice(0, Math.max(0, cupo))
      .map((f) => ({ f, url: URL.createObjectURL(f) }));
    if (nuevos.length) this.archivos.update((xs) => [...xs, ...nuevos]);
    this.enfocar(0);
  }

  private quitarArchivos(): void {
    this.archivos().forEach((a) => URL.revokeObjectURL(a.url));
    this.archivos.set([]);
  }

  private pedirImagen(convId: number, a: Adjunto): void {
    if (this.pedidas.has(a.id)) return;
    this.pedidas.add(a.id);
    this.chat.imagen(convId, a.id).subscribe({
      next: (b) => this.imgs.update((x) => ({ ...x, [a.id]: URL.createObjectURL(b) })),
      // Sin la imagen, la burbuja muestra un marcador; se reintenta al volver a abrir el hilo.
      error: () => this.pedidas.delete(a.id),
    });
  }

  // Datos

  private cargarConversaciones(alAbrir = false): void {
    this.chat.listarMias().subscribe({
      next: (r) => {
        const convs = [...r.data].sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
        this.convs.set(convs);
        // El hilo a la vista ya se marcó leído aunque la respuesta llegue antes.
        const aLaVista = this.abierto() && this.vista() === 'hilo' ? this.convId() : null;
        this.noLeidos.set(
          Object.fromEntries(convs.map((c) => [c.id, c.id === aLaVista ? 0 : (c.noLeidos ?? 0)])),
        );
        if (!alAbrir) return;
        const enCurso = convs.find((c) => c.estado === 'abierta');
        if (enCurso) this.verHilo(enCurso.id);
        else if (convs.length) this.verLista();
        else this.nueva();
      },
      error: () => alAbrir && this.nueva(),
    });
  }

  private cargarHilo(id: number): void {
    this.chat
      .listarMensajes(id)
      .subscribe((r) => this.hilos.update((h) => ({ ...h, [id]: ordenar(r.data) })));
  }

  /** Marca leído lo de soporte en ese hilo (backend y contador). */
  private leer(id: number): void {
    this.noLeidos.update((n) => ({ ...n, [id]: 0 }));
    this.chat.marcarLeida(id).subscribe({ error: () => undefined });
  }

  /** Mensaje en vivo: recarga la lista (estado y agente) y ese hilo; a la vista, se marca leído; si no, cuenta. */
  private alLlegar(e: EventoMensajeNuevo): void {
    const id = e.conversacionId;
    const aLaVista = this.abierto() && this.vista() === 'hilo' && this.convId() === id;
    const deSoporte = !e.esSistema && e.autorId !== this.yoId();
    if (deSoporte && aLaVista) this.leer(id);
    if (deSoporte && !aLaVista) {
      this.noLeidos.update((n) => ({ ...n, [id]: (n[id] ?? 0) + 1 }));
      this.ultimoUso = Date.now();
      this.oculto.set(false);
    }
    this.cargarHilo(id);
    this.cargarConversaciones();
  }

  /** `mensajes:leidos`: si leyó soporte, ✓✓ en lo tuyo; si fuiste tú (otra pestaña), sin no leídos. */
  private alLeer(e: EventoMensajesLeidos): void {
    const id = e.conversacionId;
    if (e.lado === 'cliente') {
      this.noLeidos.update((n) => ({ ...n, [id]: 0 }));
      return;
    }
    const yo = this.yoId();
    this.hilos.update((h) =>
      h[id]
        ? {
            ...h,
            [id]: h[id].map((m) =>
              m.autorId === yo && !m.leidoEn && m.creadoEn <= e.leidoEn
                ? { ...m, leidoEn: e.leidoEn }
                : m,
            ),
          }
        : h,
    );
  }

  private enfocar(ms: number): void {
    setTimeout(() => this.refTexto()?.nativeElement.focus(), ms);
  }
}

/** «📷 Foto» cuando el mensaje es solo una imagen. */
function resumen(cuerpo: string, adjuntos: number): string {
  if (cuerpo) return cuerpo;
  if (!adjuntos) return '';
  return adjuntos === 1 ? '📷 Foto' : `📷 ${adjuntos} fotos`;
}

/** 12 → «12 min»; 90 → «2 h». */
function minutos(n: number): string {
  return n < 60 ? `${n} min` : `${Math.round(n / 60)} h`;
}

/** Avatar de Goods (sin agente asignado): negro con letra blanca. */
const OSCURO: [string, string] = ['#303030', '#fff'];

function nombre(u: ChatUsuario): string {
  return `${u.nombres} ${u.apellidos}`.trim();
}

function ordenar(ms: Mensaje[]): Mensaje[] {
  return [...ms].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
}

/** Agrega sin duplicar: el socket puede traer el mismo mensaje que acabamos de enviar. */
function agregar(ms: Mensaje[], m: Mensaje): Mensaje[] {
  return ms.some((x) => x.id === m.id) ? ms : [...ms, m];
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** Posición guardada del botón (fracción del alto); sin nada guardado, abajo a la derecha. */
function leer(): number {
  try {
    const t = JSON.parse(localStorage.getItem(CLAVE) ?? 'null')?.t;
    return typeof t === 'number' ? t : 0.72;
  } catch {
    return 0.72;
  }
}

function guardar(t: number): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ t }));
  } catch {
    // Sin almacenamiento (modo privado): la posición dura solo esta visita.
  }
}

/** «Ahora», «5 min», «3 h», «Ayer» o «14 oct»: hora de la lista de conversaciones. */
function relativo(f: string): string {
  const m = Math.round((Date.now() - new Date(f).getTime()) / 60000);
  if (m < 1) return 'Ahora';
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  if (m < 2880) return 'Ayer';
  return new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

/** «Hoy», «Ayer» o «martes, 14 de octubre»: separador de días del hilo. */
function dia(f: string): string {
  const d = new Date(f);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}
