import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/** Enfoca y selecciona el input apenas aparece (edición en línea de precio/stock). */
@Directive({ selector: 'input[appAutofoco]', standalone: true })
export class AutofocoDirective {
  constructor() {
    const el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      el.focus();
      el.select();
    });
  }
}
