/**
 * Estilo (`pt`) para `p-paginator` bajo `theme: 'none'` — mismo enfoque
 * que `filterSelectPt()`/`filterDatePickerPt()` (ver ese archivo):
 * `p-paginator` no trae ningún estilo propio, así que el look final es
 * 100% el que se define acá. Nombres de sección confirmados grepeando
 * `ptm('...'` directo en `node_modules/primeng/fesm2022/primeng-paginator.mjs`
 * de la versión instalada (21.1.10) — no hay sección `root` propia en el
 * template (el host del componente ES la raíz), pero `pt.root` igual
 * aplica ahí como en el resto de los componentes de PrimeNG.
 *
 * El botón de página seleccionada no se distingue por una clase propia
 * en `pt` — PrimeNG agrega la clase `p-paginator-page-selected` al lado
 * de la que pongamos acá (con `theme: 'none'` esa clase no trae ningún
 * estilo de PrimeNG, solo existe como marcador), así que el estado
 * activo se resuelve con el selector `[&.p-paginator-page-selected]:...`
 * de Tailwind, mismo patrón que `[&_tr:hover]` en `dataTablePt()`.
 */
export function paginatorPt() {
  return {
    root: 'flex items-center gap-1',
    prev:
      'flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors duration-150 hover:bg-canvas-bg disabled:pointer-events-none disabled:opacity-40',
    next:
      'flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors duration-150 hover:bg-canvas-bg disabled:pointer-events-none disabled:opacity-40',
    prevIcon: 'h-4 w-4',
    nextIcon: 'h-4 w-4',
    pages: 'flex items-center gap-0.5',
    page:
      'flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-sm font-medium text-gray-600 transition-colors duration-150 hover:bg-canvas-bg ' +
      '[&.p-paginator-page-selected]:bg-primary-button [&.p-paginator-page-selected]:text-white [&.p-paginator-page-selected]:hover:bg-primary-button',
  };
}
