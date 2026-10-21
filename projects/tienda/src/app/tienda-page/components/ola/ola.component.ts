import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Ola blanca de burbujas que separa la parte verde de la blanca en los pasos de la isla. */
@Component({
  selector: 'app-ola',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
      <div class="forma-0 absolute left-[-8%] top-0 aspect-square w-[46%] bg-white"></div>
      <div class="forma-1 absolute left-[28%] top-[22px] aspect-square w-[34%] bg-white"></div>
      <div class="forma-2 absolute left-[54%] top-1.5 aspect-square w-[42%] bg-white"></div>
      <div class="forma-3 absolute right-[-10%] top-[30px] aspect-square w-[30%] bg-white"></div>
      <div class="absolute inset-x-0 bottom-0 top-14 bg-white"></div>
    </div>
  `,
})
export class OlaComponent {}
