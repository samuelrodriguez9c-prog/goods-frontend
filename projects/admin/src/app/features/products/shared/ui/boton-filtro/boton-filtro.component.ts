import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal } from '@angular/core';
import { PopoverDirective } from '../../../../../shared/ui/popover.directive';
import { IcComponent } from '../ic/ic.component';

/**
 * Botón redondo de la barra de la lista (Filtros · Ordenar · Agrupar) con su
 * popover. El contenido va proyectado; un clic en un elemento con
 * `data-cierra` (las opciones de `app-opciones-popover`) lo cierra, igual
 * que un clic afuera o Esc.
 */
@Component({
  selector: 'app-boton-filtro',
  standalone: true,
  imports: [IcComponent, PopoverDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block',
    '(document:click)': 'fuera($event)',
    '(document:keydown.escape)': 'abierto.set(false)',
  },
  template: `
    <button type="button" (click)="abierto.set(!abierto())" [title]="titulo()"
      class="relative flex size-8.5 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#4b5563] transition-[background-color] duration-200 ease-[ease] hover:bg-[#e6e6e6]!"
      [class]="abierto() || activo() ? 'bg-[#e3e3e3]' : 'bg-transparent'">
      <app-ic [nombre]="icono()" [size]="16" />
      @if (activo()) {
        <span class="absolute top-1 right-1 size-[7px] rounded-full bg-[#2be0d5] shadow-[0_0_0_2px_#f1f1f1]"></span>
      }
    </button>
    <div [appPopover]="abierto()" (click)="clicDentro($event)" [style.width.px]="ancho()"
      class="absolute top-10.5 right-0 z-40 origin-top-right rounded-2xl bg-white p-3.5 shadow-[0_0_0_1px_rgba(0,0,0,.06),0_24px_48px_-20px_rgba(0,0,0,.35)] [transition:opacity_.18s_ease,_transform_.26s_cubic-bezier(.2,.8,.2,1)]">
      <ng-content />
    </div>
  `,
})
export class BotonFiltroComponent {
  private readonly el = inject(ElementRef<HTMLElement>);
  readonly icono = input.required<string>();
  readonly titulo = input('');
  /** Punto turquesa: hay algo distinto del valor por defecto. */
  readonly activo = input(false);
  readonly ancho = input(300);
  protected readonly abierto = signal(false);

  protected fuera(e: MouseEvent): void {
    if (this.abierto() && !this.el.nativeElement.contains(e.target as Node)) this.abierto.set(false);
  }

  protected clicDentro(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('[data-cierra]')) this.abierto.set(false);
  }
}
