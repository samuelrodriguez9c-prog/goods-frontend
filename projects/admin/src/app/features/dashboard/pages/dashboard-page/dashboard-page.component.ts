import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Placeholder del Dashboard. */
// TODO(backend): módulo de analítica (ventas, pedidos, productos); después, las tarjetas de KPI acá.
@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Inicio</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: tarjetas de KPI + sparkline (ver ADMIN_DISENO.md &gt; "Dashboard / Analítica").
      </p>
    </div>
  `,
})
export class DashboardPageComponent {}
