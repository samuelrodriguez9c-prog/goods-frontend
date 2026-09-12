import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — todavía no se ha definido qué configuración necesita
 * Goods (Shopify tiene decenas de subsecciones: General, Plan, Billing,
 * Users, etc.). Existe como ruta/ítem de sidebar porque Settings está
 * fijo abajo en el layout de referencia (ver ADMIN_DISENO.md >
 * "Sidebar"), no porque el contenido ya esté especificado.
 */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Settings</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: todavía no se definió qué configuración necesita Goods (ver ADMIN_DISENO.md &gt;
        "Sidebar").
      </p>
    </div>
  `,
})
export class SettingsPageComponent {}
