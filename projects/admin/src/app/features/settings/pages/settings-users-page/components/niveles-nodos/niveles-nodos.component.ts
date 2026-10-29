import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Nivel } from '../../../../../../core/roles/niveles';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { NIVELES } from '../../../../shared/permisos';

/**
 * Nivel de un módulo en Usuarios, de solo lectura: tres nodos (Ver · Editar ·
 * Todo) sobre una línea. Con un rol propuesto, en verde lo que gana y con
 * borde rojo y una X lo que pierde.
 */
@Component({
  selector: 'app-niveles-nodos',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative grid h-[22px] grid-cols-3 items-center' },
  template: `
    <span
      class="absolute top-1/2 right-[16.66%] left-[16.66%] -mt-px h-0.5 rounded-sm bg-[#ececec]"
    ></span>
    <span
      class="absolute top-1/2 left-[16.66%] -mt-px h-0.5 rounded-sm transition-[width,background-color] duration-500 ease-[cubic-bezier(.3,1.2,.5,1)]"
      [style.width.%]="(Math.max(0, despues() - 1) / 2) * 66.68"
      [style.background]="despues() > antes() ? '#29845a' : '#303030'"
    ></span>
    @for (n of nodos(); track $index) {
      <span
        [title]="n.titulo"
        class="relative flex size-3.5 items-center justify-center justify-self-center rounded-full transition-[background-color,box-shadow,transform] duration-[350ms] ease-[cubic-bezier(.3,1.6,.5,1)]"
        [style.background]="n.bg"
        [style.box-shadow]="n.sombra"
        [style.transform]="n.esc"
      >
        @if (n.x) {
          <app-ic nombre="x" [size]="8" class="text-[#e11d48]" />
        }
      </span>
    }
  `,
})
export class NivelesNodosComponent {
  readonly antes = input<Nivel>(0);
  readonly despues = input<Nivel>(0);
  protected readonly Math = Math;

  protected readonly nodos = computed(() => {
    const a = this.antes();
    const b = this.despues();
    return ([1, 2, 3] as const).map((n) => {
      const t = NIVELES[n];
      if (n <= Math.min(a, b))
        return { bg: '#303030', sombra: 'none', esc: 'none', x: false, titulo: t };
      if (n <= b)
        return {
          bg: '#29845a',
          sombra: '0 0 0 3px rgba(41,132,90,.16)',
          esc: 'scale(1.1)',
          x: false,
          titulo: `${t} · gana`,
        };
      if (n <= a)
        return {
          bg: '#fff',
          sombra: 'inset 0 0 0 1.5px #f19aa7',
          esc: 'none',
          x: true,
          titulo: `${t} · pierde`,
        };
      return { bg: '#fff', sombra: 'inset 0 0 0 1.5px #d9d9d9', esc: 'none', x: false, titulo: t };
    });
  });
}
