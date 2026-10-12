import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Medidas del glifo por tamaño (px): grosor del anillo (a → b), punto turquesa y su corrimiento. */
const GEOMETRIA = {
  7: { a: 1.8, b: 1.3, punto: 2.5, corrimiento: 0.5 },
  9: { a: 2, b: 1.5, punto: 3, corrimiento: 0.5 },
  11: { a: 2.3, b: 1.8, punto: 3.5, corrimiento: 0.5 },
  22: { a: 4, b: 3.4, punto: 7, corrimiento: 1 },
} as const;
export type TamanoGlifo = keyof typeof GEOMETRIA;

/** Glifo del Asistente de IA: anillo blanco abierto con un punto turquesa (va sobre un círculo negro). */
@Component({
  selector: 'app-glifo-asistente',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block', '[style.width.px]': 'tamano()', '[style.height.px]': 'tamano()' },
  template: `
    <span class="absolute inset-0 rounded-full [background:conic-gradient(from_85deg,#fff_0deg_280deg,transparent_280deg)]"
      [style.-webkit-mask]="mascara()" [style.mask]="mascara()"></span>
    <span class="absolute rounded-full bg-[#2be0d5]"
      [style.right.px]="-g().corrimiento" [style.top.px]="g().corrimiento" [style.width.px]="g().punto" [style.height.px]="g().punto"></span>
  `,
})
export class GlifoAsistenteComponent {
  readonly tamano = input<TamanoGlifo>(11);
  protected readonly g = computed(() => GEOMETRIA[this.tamano()]);
  protected readonly mascara = computed(
    () => `radial-gradient(farthest-side,transparent calc(100% - ${this.g().a}px),#000 calc(100% - ${this.g().b}px))`,
  );
}

/** Marca "Asistente" junto a un campo que llenó la lectura de la factura. */
@Component({
  selector: 'app-chip-asistente',
  standalone: true,
  imports: [GlifoAsistenteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    title: 'Lo completó el Asistente',
    class: 'inline-flex items-center gap-[5px] rounded-full bg-[#f4f4f4] py-[1px] pr-[7px] pl-0.5 text-[10.5px] leading-[16px] font-medium text-[#303030] shadow-[inset_0_0_0_1px_#ececec]',
  },
  template: `
    <span class="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a]"><app-glifo-asistente [tamano]="7" /></span>
    Asistente
  `,
})
export class ChipAsistenteComponent {}
