import { Directive, ElementRef, HostListener, inject, input, output } from '@angular/core';

/**
 * Número arrastrable de la frase del escenario (Ingresos v2).
 * Arrastrar a los lados suma/resta `paso` cada `px` píxeles; ←/→ (o ↑/↓)
 * mueven un paso. Emite el valor ya acotado a [min, max] y redondeado.
 *
 * Ojo: en el prototipo, un `role="slider"` con `aria-valuenow` bindeado
 * dentro de la frase trababa el render. Acá se deja `aria-label` estático
 * en el template y `aria-valuetext` se actualiza a mano.
 */
@Directive({
  selector: '[appScrubValor]',
  standalone: true,
  host: {
    tabindex: '0',
    class: 'cursor-ew-resize select-none touch-none outline-none',
    '[class.scrub-activo]': 'activo',
  },
})
export class ScrubValorDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly valor = input.required<number>({ alias: 'appScrubValor' });
  readonly paso = input(1);
  readonly min = input(0);
  readonly max = input(100);
  /** Píxeles de arrastre por paso. */
  readonly px = input(8);
  readonly texto = input('');

  readonly cambio = output<number>();
  readonly arrastrando = output<boolean>();

  protected activo = false;

  private ajustar(v: number): number {
    const p = this.paso();
    return +(Math.round(Math.min(this.max(), Math.max(this.min(), v)) / p) * p).toFixed(2);
  }

  @HostListener('pointerdown', ['$event'])
  protected down(ev: PointerEvent): void {
    ev.preventDefault();
    const x0 = ev.clientX;
    const v0 = this.valor();
    this.activo = true;
    this.arrastrando.emit(true);
    const mover = (e: PointerEvent) => {
      const v = this.ajustar(v0 + Math.round((e.clientX - x0) / this.px()) * this.paso());
      if (v !== this.valor()) this.cambio.emit(v);
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      this.activo = false;
      this.arrastrando.emit(false);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  }

  @HostListener('keydown', ['$event'])
  protected tecla(ev: KeyboardEvent): void {
    const d = ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    ev.preventDefault();
    this.cambio.emit(this.ajustar(this.valor() + d * this.paso()));
    this.el.nativeElement.setAttribute('aria-valuetext', this.texto());
  }
}
