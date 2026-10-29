import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/** Enfoca y selecciona el campo apenas aparece (edición en línea de precio/stock, recuerdos del asistente). */
@Directive({ selector: 'input[appAutofoco], textarea[appAutofoco]', standalone: true })
export class AutofocoDirective {
  constructor() {
    const el = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      el.focus();
      el.select();
    });
  }
}
