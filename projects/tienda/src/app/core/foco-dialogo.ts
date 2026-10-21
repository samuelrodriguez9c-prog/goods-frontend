import { DestroyRef, Directive, ElementRef, effect, inject, input, untracked } from '@angular/core';

const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Diálogo accesible: mientras `focoDialogo` es `true` lleva el foco adentro
 * (al propio diálogo, que lee su `aria-label`), mantiene Tab / Shift+Tab
 * dentro y, al cerrarse, devuelve el foco a lo que estaba enfocado antes
 * (el botón que lo abrió). Lo que está dentro de un `[inert]` no cuenta.
 */
@Directive({
  selector: '[focoDialogo]',
  host: { tabindex: '-1', '(keydown)': 'alTeclear($event)' },
})
export class FocoDialogoDirective {
  readonly focoDialogo = input(true, { transform: (v: boolean | string) => v !== false });
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private previo: HTMLElement | null = null;
  private activo = false;

  constructor() {
    effect(() => {
      const on = this.focoDialogo();
      untracked(() => (on ? this.tomar() : this.devolver()));
    });
    inject(DestroyRef).onDestroy(() => this.devolver());
  }

  private tomar(): void {
    if (this.activo) return;
    this.activo = true;
    this.previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Después de la animación de entrada, sin mover el scroll de la página.
    setTimeout(() => { if (this.activo) this.el.focus({ preventScroll: true }); }, 60);
  }

  private devolver(): void {
    if (!this.activo) return;
    this.activo = false;
    const p = this.previo;
    this.previo = null;
    if (p?.isConnected) p.focus({ preventScroll: true });
  }

  protected alTeclear(e: KeyboardEvent): void {
    if (!this.activo || e.key !== 'Tab') return;
    const lista = [...this.el.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((x) => !x.closest('[inert]') && x.getClientRects().length > 0);
    if (!lista.length) { e.preventDefault(); return; }
    const primero = lista[0], ultimo = lista[lista.length - 1], actual = document.activeElement;
    if (e.shiftKey && (actual === primero || actual === this.el)) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && actual === ultimo) { e.preventDefault(); primero.focus(); }
  }
}
