/**
 * Formato de moneda simple ($X.XX) usado en los composites de la
 * librería interna (ej. `OrderLineItemComponent`). Vive en `shared/utils`
 * porque no es específico de ninguna feature — cualquier página que
 * necesite mostrar un monto puede reusarlo.
 *
 * Deliberadamente simple (sin `Intl.NumberFormat`/locale) porque hoy el
 * admin es mono-moneda (USD, calcado de las capturas de Shopify). El día
 * que haga falta soportar más de una moneda o locale, este es el punto
 * único a reemplazar.
 */
export function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}
