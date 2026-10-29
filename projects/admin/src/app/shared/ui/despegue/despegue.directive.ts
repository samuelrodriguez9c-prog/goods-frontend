import { DestroyRef, Directive, ElementRef, effect, inject, input, output, signal } from '@angular/core';

/**
 * Despega la fila seleccionada del panel cuando pasa bajo la cabecera sticky
 * del grupo o sale por abajo, y la vuelve a pegar cuando vuelve a la vista.
 *
 * Uso, en el contenedor con scroll de la lista:
 *   `<div appDespegue [cabecera]="48" [seleccion]="sel()" #d="despegue">`
 * y `data-sel="1"` en la fila seleccionada. En la fila:
 *   `resaltada = (sel && !d.despegada()) || hover` (despegada sigue blanca y en 600).
 *
 * `cabecera`: alto de la cabecera sticky del grupo (lista-modulo 48 · Settings 32 · sin grupos 0).
 */
@Directive({ selector: '[appDespegue]', standalone: true, exportAs: 'despegue' })
export class DespegueDirective {
  readonly cabecera = input(48);
  /** Id seleccionado: al cambiar se vuelve a medir (la fila recién tocada siempre está a la vista). */
  readonly seleccion = input<unknown>(null);
  readonly despegadaChange = output<boolean>();
  readonly despegada = signal(false);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    const medir = () => this.medir();
    this.el.addEventListener('scroll', medir, { passive: true });
    inject(DestroyRef).onDestroy(() => this.el.removeEventListener('scroll', medir));
    effect(() => {
      this.seleccion();
      queueMicrotask(() => this.medir());
    });
  }

  medir(): void {
    const fila = this.el.querySelector<HTMLElement>('[data-sel="1"]');
    let d = false;
    if (fila) {
      const a = this.el.getBoundingClientRect();
      const b = fila.getBoundingClientRect();
      d = b.top < a.top + this.cabecera() || b.bottom > a.bottom;
    }
    if (d !== this.despegada()) {
      this.despegada.set(d);
      this.despegadaChange.emit(d);
    }
  }
}

/** Emite el ancho del elemento (ResizeObserver). Para el ancho de la grilla lista + hoja. */
@Directive({ selector: '[appAncho]', standalone: true })
export class AnchoDirective {
  readonly appAncho = output<number>();

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => this.appAncho.emit(Math.round(e.contentRect.width)));
    ro.observe(el);
    inject(DestroyRef).onDestroy(() => ro.disconnect());
  }
}
