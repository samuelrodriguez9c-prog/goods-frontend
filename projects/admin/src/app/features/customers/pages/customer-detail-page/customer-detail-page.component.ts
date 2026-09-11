import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-customer-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Customer detail</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: detalle real del cliente (ver ADMIN_DISENO.md &gt; "Detalle del cliente").
      </p>
    </div>
  `,
})
export class CustomerDetailPageComponent {}
