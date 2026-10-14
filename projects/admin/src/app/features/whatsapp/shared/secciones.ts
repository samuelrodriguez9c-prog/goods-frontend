import { IconMessages, IconSparkles, IconSpeakerphone, IconTemplate } from '@tabler/icons-angular';

export type ClaveSeccion = 'bandeja' | 'plantillas' | 'automatico' | 'campanas';

export interface SeccionWhatsapp {
  k: ClaveSeccion;
  label: string;
  icono: typeof IconMessages;
  /** Ruta dentro de /whatsapp. */
  ruta: string;
  /** G + esta letra salta a la sección. */
  tecla: string;
}

/** Las cuatro secciones del módulo, en el orden del tambor de la cabecera. */
export const SECCIONES: SeccionWhatsapp[] = [
  { k: 'bandeja', label: 'Bandeja', icono: IconMessages, ruta: '/whatsapp', tecla: 'B' },
  { k: 'plantillas', label: 'Plantillas', icono: IconTemplate, ruta: '/whatsapp/plantillas', tecla: 'P' },
  { k: 'automatico', label: 'Automático', icono: IconSparkles, ruta: '/whatsapp/automatizaciones', tecla: 'A' },
  { k: 'campanas', label: 'Campañas', icono: IconSpeakerphone, ruta: '/whatsapp/campanas', tecla: 'C' },
];

/** Sección de una URL de /whatsapp. */
export function seccionDeUrl(url: string): ClaveSeccion {
  const ruta = url.split(/[?#]/)[0];
  if (ruta.startsWith('/whatsapp/plantillas')) return 'plantillas';
  if (ruta.startsWith('/whatsapp/automatizaciones')) return 'automatico';
  if (ruta.startsWith('/whatsapp/campanas')) return 'campanas';
  return 'bandeja';
}

/** Costo aproximado por mensaje de plantilla, en COP (lo cobra Meta). Igual que el backend. */
export const COSTO_PLANTILLA: Record<string, number> = { UTILITY: 4, MARKETING: 52, AUTHENTICATION: 4 };

/** "$38.000" */
export const cop = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
