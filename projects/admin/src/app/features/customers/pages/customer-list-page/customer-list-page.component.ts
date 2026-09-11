import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-customer-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Customers</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: listado real de clientes (ver ADMIN_DISENO.md &gt; "Clientes / Usuarios").
      </p>
    </div>
  `,
})
export class CustomerListPageComponent {}
