import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — el contenido real (tarjetas de KPI + sparkline, ver
 * ADMIN_DISENO.md > "Dashboard / Analítica") todavía no está construido.
 */
@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Dashboard</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: tarjetas de KPI + sparkline (ver ADMIN_DISENO.md &gt; "Dashboard / Analítica").
      </p>
    </div>
  `,
})
export class DashboardPageComponent {}
