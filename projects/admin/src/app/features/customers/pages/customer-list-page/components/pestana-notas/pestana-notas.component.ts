import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { VentasStore } from '../../../../../orders/shared/ventas.store';
import { pnum, relativo } from '../../../../../orders/shared/ventas.formato';
import { Cliente } from '../../../../../orders/shared/ventas.modelos';

/** Papel rayado: amarillo #fffbea, margen rojo a 34 px, renglones #f1e6bd cada 28 px. */
const ATAJOS: [string, string][] = [['alert-triangle', 'Alergia'], ['clock', 'Horario'], ['heart', 'Le gusta'], ['map-pin', 'Entrega'], ['cash', 'Pago']];

/**
 * Pestaña «Notas» del cliente: la «Libreta del cliente».
 * Las notas se guardan en el cliente (`PATCH /clientes/:id`).
 * - Hoja amarilla rayada con margen rojo y un trozo de cinta; en reposo rota −0,4° y al pasar el cursor se endereza.
 * - Tocarla entra a editar sobre el mismo papel (textarea con anillo #e6c65a).
 * - Atajos (Alergia · Horario · Le gusta · Entrega · Pago) agregan una línea «Alergia: » y abren la edición.
 * - «Lo que dejó escrito en sus pedidos»: notas de sus pedidos (máx. 6), cada una abre el pedido.
 */
@Component({
  selector: 'app-pestana-notas',
  standalone: true,
  imports: [IcComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3.5 animate-[fade-in-up_.22s_ease-out]' },
  template: `
    <div class="flex items-start justify-between gap-3">
      <span class="flex items-start gap-3">
        <span class="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#fff6d1] text-[#8a5a00]"><app-ic nombre="notebook" [size]="17" /></span>
        <span class="flex flex-col gap-0.5"><span class="text-[15px] font-semibold tracking-[-.005em] text-gray-900">Libreta del cliente</span><span class="text-xs leading-[17px] text-[#8a8a8a]">Solo la ve tu equipo · aparece al armarle un pedido</span></span>
      </span>
      @if (!editando() && cliente().notas) { <button type="button" class="gp-btn shrink-0" (click)="editar()"><app-ic nombre="pencil" [size]="13" />Editar</button> }
    </div>

    @if (!editando()) {
      <div (click)="editar()" class="papel-libreta relative mt-1.5 cursor-text whitespace-pre-wrap rounded-[4px_4px_14px_4px] py-3.5 pl-[46px] pr-[18px] text-[13.5px] shadow-[0_1px_0_#efe3b4,0_14px_24px_-18px_rgba(120,90,0,.45)] transition-transform duration-[250ms] ease-[cubic-bezier(.2,.8,.2,1)] rotate-[-.4deg] hover:-translate-y-px hover:rotate-0" [style.min-height.px]="cliente().notas ? null : 140" [style.color]="cliente().notas ? '#3b3220' : '#a8996a'">
        <span class="absolute -top-[9px] left-1/2 -ml-[39px] h-5 w-[78px] rotate-[-2.5deg] border-x border-dashed border-black/5 bg-[rgba(255,236,170,.75)] shadow-[0_1px_2px_rgba(0,0,0,.06)]"></span>
        @if (cliente().notas) { {{ cliente().notas }} } @else { <span class="block">Toca para escribir…</span><span class="block">Preferencias, alergias, horarios de entrega.</span> }
      </div>
    } @else {
      <div class="relative mt-1.5">
        <span class="absolute -top-[9px] left-1/2 z-[1] -ml-[39px] h-5 w-[78px] rotate-[-2.5deg] bg-[rgba(255,236,170,.75)] shadow-[0_1px_2px_rgba(0,0,0,.06)]"></span>
        <textarea #ta rows="6" [ngModel]="borrador()" (ngModelChange)="borrador.set($event)" placeholder="Ej. Prefiere que la llamen antes de llevar el pedido." class="papel-libreta block min-h-[168px] w-full resize-y rounded-[4px_4px_14px_4px] border-0 py-3.5 pl-[46px] pr-[18px] font-[inherit] text-[13.5px] text-[#3b3220] shadow-[0_0_0_1.5px_#e6c65a,0_14px_24px_-18px_rgba(120,90,0,.45)] outline-none"></textarea>
      </div>
    }

    <div class="flex flex-wrap gap-1.5">
      @for (a of atajos; track a[1]) {
        <button type="button" (click)="atajo(a[1])" class="flex h-7 items-center gap-1.5 rounded-full bg-white pl-[9px] pr-[11px] text-xs font-medium text-[#303030] shadow-[inset_0_0_0_1px_#e7e5df] transition-[background-color,box-shadow] duration-200 hover:bg-[#fafafa] hover:shadow-[inset_0_0_0_1px_#c9c6bd]"><app-ic [nombre]="a[0]" [size]="13" class="text-[#8a5a00]" />{{ a[1] }}</button>
      }
    </div>

    @if (editando()) {
      <div class="flex justify-end gap-2"><button type="button" class="gp-btn" (click)="editando.set(false)">Descartar</button><button type="button" class="gp-btn-primario" [disabled]="guardando()" (click)="guardar()"><app-ic nombre="check" [size]="14" />{{ guardando() ? 'Guardando…' : 'Guardar notas' }}</button></div>
    }

    @if (notasPedidos().length) {
      <div class="flex flex-col gap-2 border-t border-[#f1f1f1] pt-3.5">
        <span class="flex items-center gap-1.5 text-xs font-semibold text-[#303030]"><app-ic nombre="message-2" [size]="14" class="text-[#8a8a8a]" />Lo que dejó escrito en sus pedidos</span>
        @for (n of notasPedidos(); track n.id) {
          <button type="button" (click)="abrirPedido.emit(n.id)" class="flex flex-col gap-1 rounded-xl bg-[#fafafa] px-3 py-2.5 text-left shadow-[inset_0_0_0_1px_#f0f0f0] transition-colors duration-200 hover:bg-[#f4f4f4]">
            <span class="text-[13px] leading-[19px] text-[#303030]">“{{ n.texto }}”</span>
            <span class="text-[11px] text-gray-400"><span class="font-['IBM_Plex_Mono']">{{ n.num }}</span> · {{ n.cuando }}</span>
          </button>
        }
      </div>
    }
  `,
})
export class PestanaNotasComponent {
  private readonly v = inject(VentasStore);
  readonly cliente = input.required<Cliente>();
  readonly abrirPedido = output<number>();
  readonly puedeEditar = input(true);

  protected readonly atajos = ATAJOS;
  protected readonly editando = signal(false);
  protected readonly borrador = signal('');
  protected readonly guardando = signal(false);

  protected readonly notasPedidos = computed(() =>
    this.v.pedidosDe(this.cliente().id).filter((p) => p.notas.trim()).slice(0, 6).map((p) => ({ id: p.id, num: pnum(p.numero), cuando: relativo(p.creadoEn, this.v.hoy()), texto: p.notas })),
  );

  protected editar() {
    if (!this.puedeEditar()) return;
    this.borrador.set(this.cliente().notas);
    this.editando.set(true);
  }
  protected atajo(t: string) {
    if (!this.puedeEditar()) return;
    const cur = this.editando() ? this.borrador() : this.cliente().notas;
    this.borrador.set((cur.trim() ? cur.replace(/\s+$/, '') + '\n' : '') + t + ': ');
    this.editando.set(true);
  }
  protected async guardar() {
    this.guardando.set(true);
    if (await this.v.guardarNotas(this.cliente().id, this.borrador())) this.editando.set(false);
    this.guardando.set(false);
  }
  /** Para la pila «Cambios sin guardar» de la página. */
  sucio() { return this.editando() && this.borrador() !== this.cliente().notas; }
}
