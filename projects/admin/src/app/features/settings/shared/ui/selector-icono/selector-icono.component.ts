import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';

export const ICONOS_ROL: { nombre: string; etiqueta: string }[] = [
  ['user-star', 'Persona'],
  ['user-shield', 'Supervisor'],
  ['users', 'Equipo'],
  ['crown', 'Dueño'],
  ['briefcase', 'Gerencia'],
  ['id-badge-2', 'Credencial'],
  ['headset', 'Atención'],
  ['message-circle', 'Chat'],
  ['brand-whatsapp', 'WhatsApp'],
  ['mail', 'Correo'],
  ['phone', 'Teléfono'],
  ['shopping-cart', 'Ventas'],
  ['shopping-bag', 'Pedidos'],
  ['cash-register', 'Caja'],
  ['receipt', 'Facturas'],
  ['calculator', 'Cuentas'],
  ['coin', 'Cobros'],
  ['credit-card', 'Pagos'],
  ['chart-bar', 'Reportes'],
  ['chart-pie', 'Análisis'],
  ['truck-delivery', 'Envíos'],
  ['packages', 'Bodega'],
  ['box', 'Inventario'],
  ['forklift', 'Logística'],
  ['map-pin', 'Sucursal'],
  ['building-store', 'Tienda'],
  ['tag', 'Productos'],
  ['discount', 'Promociones'],
  ['gift', 'Regalos'],
  ['camera', 'Fotos'],
  ['photo', 'Imágenes'],
  ['palette', 'Diseño'],
  ['brush', 'Contenido'],
  ['speakerphone', 'Marketing'],
  ['ad-2', 'Anuncios'],
  ['world', 'Web'],
  ['code', 'Desarrollo'],
  ['tools', 'Soporte'],
  ['settings', 'Ajustes'],
  ['shield-lock', 'Seguridad'],
  ['key', 'Accesos'],
  ['clipboard-list', 'Tareas'],
  ['calendar', 'Agenda'],
  ['star', 'Destacado'],
  ['heart', 'Fidelización'],
  ['rocket', 'Crecimiento'],
  ['school', 'Formación'],
  ['eye', 'Auditoría'],
].map(([nombre, etiqueta]) => ({ nombre, etiqueta }));

/**
 * Cuadrícula de íconos sin borde: hover = círculo #efefef (300 ms, scale 1.05);
 * elegido = capa #303030 aparte (opacity + scale .6→1) para que el hover no la
 * tape. Ocupa el alto disponible (`flex-1 min-h-0`) y hace scroll adentro.
 */
@Component({
  selector: 'app-selector-icono',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      '-mx-1 grid min-h-0 flex-1 auto-rows-[36px] grid-cols-[repeat(auto-fill,minmax(36px,1fr))] content-start gap-0.5 overflow-y-auto px-1 pb-3.5 pt-0.5 [scrollbar-width:thin]',
  },
  template: `
    @for (i of iconos(); track i.nombre) {
      @let on = valor() === i.nombre;
      <button
        type="button"
        [title]="i.etiqueta"
        [attr.aria-pressed]="on"
        (click)="valor.set(i.nombre)"
        class="relative flex size-9 items-center justify-center justify-self-center rounded-full text-[#4b5563] transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] hover:scale-105 hover:bg-[#efefef] hover:text-[#111827]"
      >
        <span
          class="absolute inset-0 rounded-full bg-[#303030] transition-[opacity,transform] duration-300 ease-[cubic-bezier(.3,1.5,.5,1)]"
          [style.opacity]="on ? 1 : 0"
          [style.transform]="on ? 'scale(1)' : 'scale(.6)'"
        ></span>
        <app-ic
          class="relative transition-colors duration-200"
          [class.text-white]="on"
          [nombre]="i.nombre"
          [size]="18"
        />
      </button>
    }
  `,
})
export class SelectorIconoComponent {
  readonly iconos = input(ICONOS_ROL);
  readonly valor = model('user-star');
}
