import { DestroyRef, Directive, ElementRef, Injectable, NgZone, OnInit, inject, input } from '@angular/core';

/**
 * Movimiento de la tienda pública (prototipo `pintar()` / `tick()`):
 * - `[revelar]`: aparece al entrar en pantalla (900 ms, cubic-bezier(.2,.7,.2,1), `revelarDelay` ms).
 * - `[burbuja]="'profundidad,empuje,crecer'"`: sigue un poco al mouse y se aparta del cursor.
 *   `[parallax]="[x, y, rot]"` suma un desplazamiento por scroll (px por px de scroll).
 * Todo corre fuera de Angular (sin detección de cambios). Sin mouse fino o con
 * `prefers-reduced-motion` solo queda el parallax de scroll (o nada).
 */
@Injectable({ providedIn: 'root' })
export class MovimientoService {
  private readonly zone = inject(NgZone);
  private readonly burbujas = new Set<BurbujaDirective>();
  private loop = 0;
  readonly mouse = { on: false, x: 0, y: 0 };
  readonly reducido = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly fino = typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches;
  private iniciado = false;

  registrar(b: BurbujaDirective): void {
    this.burbujas.add(b);
    this.iniciar();
    this.pedir();
  }
  quitar(b: BurbujaDirective): void {
    this.burbujas.delete(b);
  }

  private iniciar(): void {
    if (this.iniciado || this.reducido) return;
    this.iniciado = true;
    this.zone.runOutsideAngular(() => {
      addEventListener('scroll', () => this.pedir(), { passive: true });
      if (!this.fino) return;
      addEventListener('mousemove', (e) => { Object.assign(this.mouse, { on: true, x: e.clientX, y: e.clientY }); this.pedir(); }, { passive: true });
      document.documentElement.addEventListener('mouseleave', () => { this.mouse.on = false; this.pedir(); });
    });
  }

  private pedir(): void {
    if (this.reducido || this.loop) return;
    this.loop = requestAnimationFrame(() => this.tick());
  }

  private tick(): void {
    this.loop = 0;
    let sigue = false;
    for (const b of this.burbujas) sigue = b.paso(this.mouse) || sigue;
    if (sigue || this.mouse.on) this.pedir();
  }
}

@Directive({ selector: '[burbuja]' })
export class BurbujaDirective implements OnInit {
  readonly burbuja = input<string>('0.03,40,0.06');
  readonly parallax = input<[number, number, number?] | null>(null);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly mov = inject(MovimientoService);
  private st = { x: 0, y: 0, s: 1 };

  constructor() {
    inject(DestroyRef).onDestroy(() => this.mov.quitar(this));
  }
  ngOnInit(): void {
    this.el.style.willChange = 'transform';
    this.mov.registrar(this);
  }

  /** Devuelve `true` mientras siga moviéndose. */
  paso(m: { on: boolean; x: number; y: number }): boolean {
    const [depth, push, grow] = this.burbuja().split(',').map(Number);
    const p = this.parallax();
    const y = scrollY;
    const base = p ? `translate3d(${(y * p[0]).toFixed(1)}px,${(y * p[1]).toFixed(1)}px,0) rotate(${(y * (p[2] ?? 0)).toFixed(2)}deg)` : '';
    let tx = 0, ty = 0, ts = 1;
    if (m.on) {
      const r = this.el.getBoundingClientRect();
      const vw = innerWidth, vh = innerHeight;
      if (r.bottom > -200 && r.top < vh + 200) {
        const R = r.width / 2;
        const cx = r.left + R - this.st.x, cy = r.top + r.height / 2 - this.st.y;
        const dx = cx - m.x, dy = cy - m.y, d = Math.hypot(dx, dy) || 1;
        tx = (m.x - vw / 2) * depth;
        ty = (m.y - vh / 2) * depth;
        const alcance = R + 140;
        if (d < alcance) { const f = 1 - d / alcance; tx += (dx / d) * f * push; ty += (dy / d) * f * push; ts = 1 + f * grow; }
      }
    }
    const s = this.st;
    s.x += (tx - s.x) * 0.07; s.y += (ty - s.y) * 0.07; s.s += (ts - s.s) * 0.09;
    this.el.style.transform = `${base} translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0) scale(${s.s.toFixed(3)})`;
    return Math.abs(tx - s.x) > 0.2 || Math.abs(ty - s.y) > 0.2 || Math.abs(ts - s.s) > 0.001;
  }
}

@Directive({ selector: '[revelar]' })
export class RevelarDirective implements OnInit {
  readonly revelarDelay = input(0);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);
  private readonly mov = inject(MovimientoService);

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined' || this.mov.reducido) {
      this.el.style.opacity = '1'; this.el.style.transform = 'none';
      return;
    }
    const io = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      io.disconnect();
      this.el.animate(
        [{ opacity: 0, transform: getComputedStyle(this.el).transform === 'none' ? 'translateY(32px)' : getComputedStyle(this.el).transform }, { opacity: 1, transform: 'none' }],
        { duration: 900, delay: this.revelarDelay(), easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' },
      );
    }, { rootMargin: '0px 0px -40px 0px' });
    io.observe(this.el);
    this.destroyRef.onDestroy(() => io.disconnect());
  }
}

/** Punto verde que vuela del botón + a la isla «Tu pedido» (700 ms) y la hace latir. */
export function volarAlPedido(e: MouseEvent | undefined, isla: HTMLElement | undefined, movil: boolean): void {
  if (!e || e.clientX == null || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dot = document.createElement('span');
  Object.assign(dot.style, {
    position: 'fixed', left: `${e.clientX - 9}px`, top: `${e.clientY - 9}px`, width: '18px', height: '18px',
    borderRadius: '99px', background: '#25d366', zIndex: '120', pointerEvents: 'none', boxShadow: '0 0 0 4px rgba(37,211,102,.25)',
  });
  document.body.appendChild(dot);
  const destinoX = movil ? innerWidth / 2 - 44 : innerWidth / 2;
  const tx = destinoX - e.clientX, ty = innerHeight - 50 - e.clientY;
  const a = dot.animate(
    [
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${tx * 0.5}px,${ty * 0.5 - 120}px) scale(1.1)`, offset: 0.45 },
      { transform: `translate(${tx}px,${ty}px) scale(.4)`, opacity: 0.4 },
    ],
    { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)' },
  );
  a.onfinish = () => {
    dot.remove();
    isla?.animate([{ scale: '1' }, { scale: '1.06' }, { scale: '1' }], { duration: 380, easing: 'cubic-bezier(.3,1.5,.5,1)' });
  };
}
