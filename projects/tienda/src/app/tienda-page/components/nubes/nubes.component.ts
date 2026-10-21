import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Borde de nubes sobre un pie de la isla (del color de ese pie, `bg`). */
@Component({
  selector: 'app-nubes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-[-30px] h-8 overflow-hidden">
      <div class="absolute left-[-6%] top-1.5 h-20 w-[34%] rounded-[50%]" [style.background]="bg()"></div>
      <div class="absolute left-[22%] top-3.5 h-[70px] w-[30%] rounded-[50%]" [style.background]="bg()"></div>
      <div class="absolute left-[46%] top-0.5 h-20 w-[32%] rounded-[50%]" [style.background]="bg()"></div>
      <div class="absolute right-[-6%] top-3 h-[70px] w-[30%] rounded-[50%]" [style.background]="bg()"></div>
    </div>
  `,
})
export class NubesComponent {
  readonly bg = input.required<string>();
}
