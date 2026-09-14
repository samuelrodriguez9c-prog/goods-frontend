import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — historial de pagos/facturación (§7.2, PIVOTE_SAAS_MULTITENANT.md)
 * todavía no está construido.
 */
@Component({
  selector: 'app-facturacion-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Facturación</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: historial de pagos/facturación por Empresa (ver PIVOTE_SAAS_MULTITENANT.md &gt; §7.2).
      </p>
    </div>
  `,
})
export class FacturacionPageComponent {}
