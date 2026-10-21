import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type TablerIcon, TablerIconComponent } from '@tabler/icons-angular';
import { BurbujaDirective } from '../../../core/movimiento';

/** Sello verde con burbujas de los pasos «¿Ya lo enviaste?» y «Enviado». */
@Component({
  selector: 'app-sello',
  imports: [TablerIconComponent, BurbujaDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <span class="relative grid aspect-square w-[min(220px,22vh)] shrink-0 place-items-center">
      <span burbuja="0.04,14,0.18" class="absolute inset-0 bg-[rgba(37,211,102,.14)] [animation:morph_10s_ease-in-out_infinite]"></span>
      <span class="forma-0 absolute inset-[14%] bg-[rgba(37,211,102,.18)]"></span>
      <span class="forma-1 absolute right-[2%] top-[6%] aspect-square w-[16%] bg-wa"></span>
      <span class="absolute bottom-[10%] left-[4%] aspect-square w-[10%] rounded-full bg-hoja opacity-50"></span>
      <span class="forma-1 relative grid aspect-square w-[54%] place-items-center bg-wa text-noche shadow-[0_12px_30px_-10px_rgba(37,211,102,.6)]"><tabler-icon [icon]="icono()" [size]="56" [stroke]="1.75" /></span>
    </span>
  `,
})
export class SelloComponent {
  readonly icono = input.required<TablerIcon>();
}
