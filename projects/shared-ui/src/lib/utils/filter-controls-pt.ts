/**
 * Estilo (`pt`) compartido para los controles que viven DENTRO del
 * popover "Filtros" de una pantalla con listado (ver
 * `SearchToolbarComponent` y ADMIN_DISENO.md > "Barra de búsqueda y
 * filtros"). Antes estos campos eran un `<select>`/`<input type="date">`
 * nativo con `bg-canvas-bg rounded-lg px-3 py-2 text-sm` a mano en cada
 * página — mismo lenguaje visual de siempre (gris claro, esquinas
 * redondeadas, foco con anillo), la única razón para pasar a `p-select`/
 * `p-date-picker` es que el control nativo del navegador (el `<select>`
 * del sistema operativo, el calendario nativo de `type="date"`) no se
 * puede vestir con CSS y no se parece en nada al overlay real de
 * Shopify — con `providePrimeNG({ theme: 'none' })` ya configurado (ver
 * `app.config.ts`), estos componentes no traen NINGÚN estilo propio, así
 * que hay que declarar cada superficie que usan.
 *
 * Mismo criterio que `dataTablePt()`/`StatusBadgeComponent`: funciones
 * que devuelven el objeto `pt`, no un componente wrapper — `p-select` y
 * `p-date-picker` se usan tal cual en cada página, con su API nativa
 * completa (navegación de mes/año, teclado, etc.) intacta.
 */

/** Nombres de sección confirmados leyendo el paquete instalado
 * (`primeng@21.1.10`, `node_modules/primeng/fesm2022/primeng-select.mjs`
 * y `-datepicker.mjs`) — la documentación pública no siempre lista todas,
 * así que se confirmó contra el código real en vez de adivinar. */
export function filterSelectPt() {
  return {
    root: 'flex min-w-40 items-center justify-between gap-2 rounded-lg bg-canvas-bg px-3 py-2 text-sm text-gray-900 ring-1 ring-transparent transition-colors duration-200 has-[[data-p-focused=true]]:ring-2 has-[[data-p-focused=true]]:ring-gray-400',
    label: 'truncate leading-none',
    dropdown: 'flex items-center text-gray-500',
    dropdownIcon: 'transition-transform duration-200',
    overlay:
      'mt-1 overflow-hidden rounded-lg border border-gray-200 bg-card-bg shadow-lg ' +
      'animate-[fade-in-up_0.15s_ease-out]',
    list: 'py-1',
    option:
      'cursor-pointer px-3 py-2 text-sm text-gray-700 transition-colors duration-150 ' +
      'hover:bg-canvas-bg aria-selected:bg-canvas-bg aria-selected:font-medium aria-selected:text-gray-900',
    emptyMessage: 'px-3 py-2 text-sm text-gray-500',
  };
}

export function filterDatePickerPt() {
  return {
    root: 'block w-full',
    pcInputText: {
      root: 'w-full rounded-lg bg-canvas-bg px-3 py-2 text-sm text-gray-900 outline-none ring-1 ring-transparent transition-colors duration-200 focus:ring-2 focus:ring-gray-400',
    },
    panel:
      'mt-1 overflow-hidden rounded-lg border border-gray-200 bg-card-bg p-3 shadow-lg ' +
      'animate-[fade-in-up_0.15s_ease-out]',
    header: 'mb-2 flex items-center justify-between gap-2',
    title: 'flex items-center gap-1 text-sm font-medium text-gray-900',
    selectMonth: 'rounded-md px-1.5 py-1 text-sm transition-colors duration-150 hover:bg-canvas-bg',
    selectYear: 'rounded-md px-1.5 py-1 text-sm transition-colors duration-150 hover:bg-canvas-bg',
    pcPrevButton: {
      root: 'flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors duration-150 hover:bg-canvas-bg hover:text-gray-900',
    },
    pcNextButton: {
      root: 'flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors duration-150 hover:bg-canvas-bg hover:text-gray-900',
    },
    pcTodayButton: {
      root: 'mt-2 w-full rounded-lg bg-canvas-bg px-3 py-1.5 text-center text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-badge-neutral-bg',
    },
    table: 'w-full border-collapse',
    weekDay: 'pb-1 text-center text-xs font-medium uppercase tracking-wide text-gray-400',
    day: 'text-center text-sm',
    dayCell:
      'h-8 w-8 cursor-pointer rounded-md text-center text-sm text-gray-700 transition-colors duration-150 ' +
      'hover:bg-canvas-bg aria-selected:bg-primary-button aria-selected:font-medium aria-selected:text-white',
  };
}
