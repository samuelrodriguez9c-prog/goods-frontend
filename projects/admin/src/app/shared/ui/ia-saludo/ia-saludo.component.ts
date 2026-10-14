import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';

/**
 * Saludo del asistente (rediseño 2026-10-12, reemplaza al saludo de tres
 * líneas «Buenas noches, Laura · ¿Qué revisamos hoy en Goods?»).
 *
 * Una sola línea: «¿Empezamos por stock?». Solo gira la palabra final
 * (turquesa con subrayado punteado) y su ancho se acomoda.
 * - Familia por apertura: cada vez que el componente se monta (abrir el
 *   mini chat, abrir /asistente o "Nueva conversación") pasa a la
 *   siguiente familia: curiosear → recordar → qué hacer. El turno queda en
 *   localStorage y es compartido entre el mini chat y la pantalla completa.
 * - La palabra gira cada 2,3 s. Se pausa con el mouse encima, cuando hay
 *   texto en el composer y con prefers-reduced-motion.
 * - Si el usuario escribe algo que coincide con una palabra («stock»,
 *   «pagos»…), el giro salta a esa palabra.
 * - Solo la palabra visible lleva el subrayado: el de la palabra de arriba
 *   caía 3 px dentro de la ventana y se veía como una línea punteada encima
 *   (también pasa en el prototipo).
 * - Clic en la palabra → `elegir` emite la pregunta completa.
 * - `sugerencia` emite la pregunta de la palabra visible (para usarla de
 *   placeholder del composer).
 */

interface Palabra {
  t: string;
  /** Pregunta que se manda al composer. */
  q: string;
  /** Fragmentos (minúsculas) que, si aparecen en lo que se escribe, saltan a esta palabra. */
  k: string[];
}
interface Familia {
  id: 'curiosear' | 'recordar' | 'hacer';
  pre: string;
  palabras: Palabra[];
}

export const SALUDO_FAMILIAS: Familia[] = [
  {
    id: 'curiosear',
    pre: '¿Cómo van tus',
    palabras: [
      { t: 'ventas', q: '¿Cómo van mis ventas esta semana?', k: ['vent', 'vend'] },
      { t: 'clientes', q: '¿Quiénes son mis mejores clientes?', k: ['client'] },
      { t: 'productos', q: '¿Qué productos se venden más?', k: ['produc', 'más vend'] },
      { t: 'descuentos', q: '¿Qué descuentos están funcionando?', k: ['descuen', 'promo', 'cupon'] },
    ],
  },
  {
    id: 'recordar',
    pre: '¿Algo pendiente en',
    palabras: [
      { t: 'pedidos', q: '¿Qué pedidos están pendientes?', k: ['pedid', 'orden'] },
      { t: 'compras', q: '¿Qué compras faltan por recibir?', k: ['compr', 'recib', 'lleg'] },
      { t: 'pagos', q: '¿Qué pagos tengo pendientes?', k: ['pago', 'pagar', 'deud'] },
      { t: 'envíos', q: '¿Qué envíos están atrasados?', k: ['envi', 'envío', 'despach', 'atras'] },
    ],
  },
  {
    id: 'hacer',
    pre: '¿Empezamos por',
    palabras: [
      { t: 'stock', q: '¿Qué productos debo reponer hoy?', k: ['stock', 'repon', 'agot', 'inventar'] },
      { t: 'precios', q: '¿Qué precios debería ajustar?', k: ['precio', 'ajust', 'margen'] },
      { t: 'pedidos', q: '¿Qué pedido despacho primero?', k: ['pedid', 'despach', 'primero'] },
      { t: 'descuentos', q: '¿Qué descuento me conviene lanzar?', k: ['descuen', 'promo', 'lanzar'] },
    ],
  },
];

const CLAVE_FAMILIA = 'goods.ia.saludo.familia';
const MS_GIRO = 2300;

/** Avanza el turno guardado y devuelve la familia de esta apertura. */
function siguienteFamilia(): number {
  try {
    const previa = parseInt(localStorage.getItem(CLAVE_FAMILIA) ?? '-1', 10);
    const n = (Number.isNaN(previa) ? 0 : previa + 1) % SALUDO_FAMILIAS.length;
    localStorage.setItem(CLAVE_FAMILIA, String(n));
    return n;
  } catch {
    return 0;
  }
}

@Component({
  selector: 'app-ia-saludo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2
      (mouseenter)="pausa.set(true)"
      (mouseleave)="pausa.set(false)"
      class="ia-palabra m-0 flex max-w-full items-end gap-[0.26em] font-['Archivo',sans-serif] font-semibold leading-[1.15] tracking-[-0.03em] text-[#111827]"
      [class.justify-center]="!mini()"
      [class.px-2]="mini()"
      [style.font-size]="mini() ? '22px' : 'clamp(28px, 4.6vh, 40px)'"
    >
      <span class="whitespace-nowrap">{{ familia().pre }}</span>
      <button
        type="button"
        (click)="elegir.emit(actual().q)"
        [attr.aria-label]="'Preguntar: ' + actual().q"
        class="inline-block h-[1.15em] shrink-0 cursor-pointer overflow-hidden border-0 bg-transparent p-0 text-left [font:inherit] [letter-spacing:inherit] transition-[width] duration-[460ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        [style.width]="ancho()"
      >
        <span
          class="flex flex-col transition-transform duration-[560ms] ease-[cubic-bezier(0.3,1.35,0.5,1)]"
          [style.transform]="'translateY(' + -indice() * 1.15 + 'em)'"
        >
          @for (p of familia().palabras; track $index) {
            <span
              #palabra
              class="h-[1.15em] w-max self-start whitespace-nowrap text-[#00605b] underline decoration-[#2be0d5] decoration-dotted decoration-[3px] underline-offset-[0.16em] transition-[text-decoration-color] duration-300"
              [class.decoration-transparent]="$index !== indice()"
              [attr.aria-hidden]="$index !== indice()"
            >{{ p.t }}</span>
          }
        </span>
      </button>
      <span class="-ml-[0.22em]" aria-hidden="true">?</span>
    </h2>
  `,
})
export class IaSaludoComponent {
  /** `completo`: centrado (pantalla completa) · `mini`: alineado a la izquierda (dock). */
  readonly variante = input<'completo' | 'mini'>('completo');
  /** Texto actual del composer: pausa el giro y lo sincroniza con lo que se escribe. */
  readonly texto = input('');

  /** Clic en la palabra: pregunta completa para poner en el composer. */
  readonly elegir = output<string>();
  /** Pregunta de la palabra visible, cada vez que cambia (placeholder del composer). */
  readonly sugerencia = output<string>();
  /** Todas las preguntas de la familia de esta apertura (para que el host no las repita en sus sugerencias). */
  readonly preguntas = output<string[]>();

  protected readonly mini = computed(() => this.variante() === 'mini');
  protected readonly familia = signal(SALUDO_FAMILIAS[siguienteFamilia()]);
  protected readonly indice = signal(0);
  protected readonly actual = computed(() => this.familia().palabras[this.indice()]);
  protected readonly pausa = signal(false);

  private readonly palabraEls = viewChildren<ElementRef<HTMLElement>>('palabra');
  private readonly anchos = signal<number[]>([]);
  protected readonly ancho = computed(() => {
    const w = this.anchos()[this.indice()];
    return w ? `${w}px` : 'auto';
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      this.medir();
      document.fonts?.ready.then(() => this.medir());

      const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reducir) return;
      const id = setInterval(() => {
        if (this.pausa() || this.texto().trim()) return;
        this.indice.update((i) => (i + 1) % this.familia().palabras.length);
      }, MS_GIRO);
      destroyRef.onDestroy(() => clearInterval(id));
    });

    // La variante cambia el tamaño de letra: volver a medir.
    effect(() => {
      this.mini();
      requestAnimationFrame(() => this.medir());
    });

    // Lo que se escribe salta a la palabra que coincide.
    effect(() => {
      const l = this.texto().toLowerCase();
      if (!l) return;
      const i = untracked(this.familia).palabras.findIndex((p) => p.k.some((k) => l.includes(k)));
      if (i >= 0) this.indice.set(i);
    });

    effect(() => this.sugerencia.emit(this.actual().q));
    effect(() => this.preguntas.emit(this.familia().palabras.map((p) => p.q)));
  }

  private medir(): void {
    const a = this.palabraEls().map((e) => e.nativeElement.offsetWidth);
    if (a.length && a.every((x) => x > 0)) this.anchos.set(a);
  }
}
