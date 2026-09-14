/*
 * Public API Surface of shared-ui
 *
 * Composites propios del admin de Goods, promovidos de
 * `projects/admin/src/app/shared/ui/` a librería real del workspace
 * cuando se sumó el segundo proyecto Angular que los consume (panel de
 * staff, ver PIVOTE_SAAS_MULTITENANT.md §4/§8 punto 3). El criterio de
 * qué va en cada composite sigue documentado en ADMIN_DISENO.md > "Qué
 * construir como librería propia" — esto solo cambia DÓNDE vive el
 * código, no el diseño de cada uno.
 */

export * from './lib/status-badge/status-badge.component';
export * from './lib/data-table/data-table.component';
export * from './lib/data-table/selection-checkbox.component';
export * from './lib/order-line-item/order-line-item.component';
export * from './lib/quick-adjust-popover/quick-adjust-popover.component';
export * from './lib/utils/format-money';
