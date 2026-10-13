/**
 * El formato de texto de WhatsApp (*negrita*, _cursiva_, ~tachado~,
 * ```monoespaciado```) convertido a HTML para la bandeja, como lo ve el
 * cliente en su celular. El texto se escapa primero: lo único que queda
 * como HTML son estas cuatro marcas (y Angular igual sanitiza el resultado).
 */
export function formatoWhatsapp(texto: string): string {
  const seguro = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return seguro
    .replace(/```([\s\S]+?)```/g, '<code>$1</code>')
    .replace(marca('\\*'), '$1<strong>$2</strong>')
    .replace(marca('_'), '$1<em>$2</em>')
    .replace(marca('~'), '$1<s>$2</s>');
}

/**
 * Como en WhatsApp: la marca abre al inicio o después de un espacio o
 * signo, el contenido no empieza ni termina en espacio y no cruza líneas.
 */
function marca(m: string): RegExp {
  return new RegExp(`(^|[\\s(¡¿"'*_~>])${m}(?!\\s)([^\\n]*?[^\\s])${m}(?=$|[\\s.,;:!?)"'*_~<])`, 'g');
}
