import { Pipe, PipeTransform, SecurityContext, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';

// `breaks: true`: el modelo separa ítems con un solo \n; sin esto, Markdown
// exige una línea en blanco para cortar y el texto se vería pegado.
marked.setOptions({ breaks: true, gfm: true });

/**
 * Convierte a HTML el Markdown que responde el Asistente de IA, para usarlo
 * con `[innerHTML]` en la burbuja del asistente. Nunca en la del usuario:
 * lo que escribe el staff se muestra como texto plano.
 *
 * @remarks
 * `marked.parse` no sanitiza, así que el resultado pasa por
 * `DomSanitizer.sanitize(SecurityContext.HTML, …)` antes de devolverlo.
 */
@Pipe({ name: 'markdownLigero', standalone: true, pure: true })
export class MarkdownLigeroPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(texto: string | null | undefined): string {
    if (!texto) {
      return '';
    }
    const html = marked.parse(texto, { async: false }) as string;
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }
}
