import { IconCurrencyDollar, IconMessageCircle, IconPackage, IconPencil, IconReceipt } from '@tabler/icons-angular';
import { TipoVariable } from '../../../core/whatsapp/whatsapp.model';

/**
 * De dónde sale cada variable de una plantilla (2026-10-13): lo que se ve en
 * "De dónde sale cada dato" y en el selector de tipo. `auto` = se llena sola
 * al enviar (en turquesa); `texto` lo escribe quien envía.
 */
export const VARIABLES: Record<TipoVariable, { label: string; fuente: string; icono: typeof IconPencil; auto: boolean }> = {
  nombre: { label: 'Nombre del cliente', fuente: 'Del chat', icono: IconMessageCircle, auto: true },
  pedido: { label: 'Número de pedido', fuente: 'Del pedido', icono: IconReceipt, auto: true },
  total: { label: 'Total del pedido', fuente: 'Del pedido', icono: IconCurrencyDollar, auto: true },
  producto: { label: 'Producto', fuente: 'Del catálogo', icono: IconPackage, auto: true },
  texto: { label: 'Dato variable', fuente: 'Lo escribes al enviar', icono: IconPencil, auto: false },
};

export const OPCIONES_VARIABLE: { k: TipoVariable; l: string }[] = [
  { k: 'nombre', l: 'Nombre del cliente' },
  { k: 'pedido', l: 'Número de pedido' },
  { k: 'total', l: 'Total del pedido' },
  { k: 'producto', l: 'Producto' },
  { k: 'texto', l: 'Texto que escribes' },
];

/** Lo que se sabe del chat abierto para llenar solas las variables de una plantilla. */
export interface DatosPlantilla {
  nombre: string;
  pedido?: string;
  total?: string;
  producto?: string;
}

/** Valor propuesto para cada variable según su tipo (vacío si no hay dato). */
export function llenarVariables(tipos: readonly TipoVariable[] | undefined, n: number, datos: DatosPlantilla): string[] {
  return Array.from({ length: n }, (_, k) => {
    const t = tipoVariable(tipos, k);
    return t === 'texto' ? '' : (datos[t] ?? '');
  });
}

/** Tipo de la variable `k` (0 = `{{1}}`); sin dato, `{{1}}` es el nombre y el resto texto. */
export function tipoVariable(tipos: readonly TipoVariable[] | undefined, k: number): TipoVariable {
  return tipos?.[k] ?? (k === 0 ? 'nombre' : 'texto');
}
