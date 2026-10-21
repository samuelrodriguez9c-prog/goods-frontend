import { Pipe, PipeTransform, SecurityContext, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';

// `breaks`: un solo salto de línea ya es `<br>`; el modelo separa ítems con un
// solo \n y sin esto se vería todo pegado.
marked.setOptions({ breaks: true, gfm: true });

/**
 * Convierte el Markdown de las respuestas del asistente a HTML para
 * `[innerHTML]`. Solo para la burbuja del asistente: lo que escribe el
 * usuario se muestra como texto plano.
 *
 * @remarks
 * `marked` no sanitiza, así que el resultado pasa por `DomSanitizer` antes de
 * devolverlo.
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
