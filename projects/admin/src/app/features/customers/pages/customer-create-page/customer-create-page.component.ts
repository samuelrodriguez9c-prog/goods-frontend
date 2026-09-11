import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-customer-create-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Add customer</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: alta real de cliente (ver ADMIN_DISENO.md &gt; "Alta de cliente").
      </p>
    </div>
  `,
})
export class CustomerCreatePageComponent {}
