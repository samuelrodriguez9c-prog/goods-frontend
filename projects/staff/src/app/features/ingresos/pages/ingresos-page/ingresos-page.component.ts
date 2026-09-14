import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — vista ejecutiva de ingresos (§7.2, PIVOTE_SAAS_MULTITENANT.md)
 * todavía no está construida.
 */
@Component({
  selector: 'app-ingresos-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Ingresos</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: vista ejecutiva de ingresos (ver PIVOTE_SAAS_MULTITENANT.md &gt; §7.2).
      </p>
    </div>
  `,
})
export class IngresosPageComponent {}
