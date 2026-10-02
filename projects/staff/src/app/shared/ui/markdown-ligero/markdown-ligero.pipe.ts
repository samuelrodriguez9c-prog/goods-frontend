// projects/staff/src/app/shared/ui/markdown-ligero/markdown-ligero.pipe.ts
//
// El Asistente de IA (staff) devuelve texto con formato Markdown (listas,
// **negritas**, etc. — el modelo lo arma así porque se le pide responder en
// Markdown) pero las dos pantallas que lo muestran (`AsistentePageComponent`
// a pantalla completa y `AsistenteDockComponent`, el mini chat flotante) lo
// venían interpolando como texto plano (`{{ m.cuerpo }}` + `whitespace-pre-wrap`),
// así que el usuario veía los asteriscos/guiones tal cual en vez de ver el
// formato. Este pipe convierte ese Markdown a HTML (vía `marked`, sin
// dependencias) para bindearlo con `[innerHTML]` en la burbuja del asistente
// — NUNCA en la del usuario, esa sigue siendo texto plano a propósito (lo
// que escribe el staff no debería interpretarse como Markdown).
//
// Seguridad: `marked.parse` no sanitiza — si el texto trajera HTML crudo
// (improbable viniendo del propio backend del asistente, pero no imposible
// si el modelo lo generara) lo dejaría pasar tal cual. Por eso el pipe
// sanitiza el resultado con `DomSanitizer.sanitize(SecurityContext.HTML, …)`
// ANTES de devolverlo — la cadena que entrega ya viene limpia (sin
// `<script>`, `onerror=`, etc.), así que el `[innerHTML]` del template
// sanitiza en el peor de los casos dos veces, nunca cero.
//
// `breaks: true`: un solo salto de línea ya corta a `<br>` (como GFM/como
// se veía con `whitespace-pre-wrap` antes) — sin esto, Markdown estándar
// exige una línea en blanco para cortar párrafo y el texto del modelo
// (que separa ítems con un solo \n) se vería todo pegado en un bloque.
import { Pipe, PipeTransform, SecurityContext, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

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
