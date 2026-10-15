import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { completa } from '../../../../shared/ventas.formato';
import { EST, Pedido } from '../../../../shared/ventas.modelos';
import { VentasStore } from '../../../../shared/ventas.store';

const EVI: Record<string, [string, string, string, string]> = {
  creado: ['file-plus', '#f1f1f1', '#303030', ''],
  estado: ['progress-check', '#e0f7f5', '#00605b', ''],
  pago: ['cash', '#e6f6ec', '#087b5d', ''],
  editado: ['pencil', '#f1f1f1', '#303030', ''],
  nota: ['note', '#fff6d1', '#8a5a00', 'Nota interna'],
};

/** Pestaña Actividad: nota interna (Ctrl+Enter) y la línea de tiempo del pedido, de la más nueva a la más vieja. */
@Component({
  selector: 'app-pestana-actividad',
  standalone: true,
  imports: [IcComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[fade-in-up_.22s_ease-out] flex-col gap-3' },
  template: `
    <div class="flex flex-col gap-2 rounded-[14px] bg-[#fafafa] p-3 shadow-[inset_0_0_0_1px_#f0f0f0]">
      <textarea class="gp-input resize-y" rows="2" placeholder="Deja una nota interna · solo la ve tu equipo" [ngModel]="nota()" (ngModelChange)="nota.set($event)"
        (keydown.control.enter)="dejarNota()" (keydown.meta.enter)="dejarNota()"></textarea>
      <button type="button" class="gp-btn-primario self-end" [disabled]="!nota().trim() || guardando()" (click)="dejarNota()">Guardar nota</button>
    </div>
    @if (!pedido().detalle) {
      @for (k of [1, 2, 3]; track k) {
        <span class="h-11 animate-[gp-brillo_1.4s_linear_infinite] rounded-xl [background:linear-gradient(90deg,#f1f1f1_0,#f7f7f7_80px,#f1f1f1_160px)] [background-size:320px_100%]"></span>
      }
    }
    @for (e of eventos(); track $index) {
      <div class="flex gap-3" [style.animation]="'mov-in 360ms cubic-bezier(.2,.8,.2,1) ' + e.retraso + 'ms both'">
        <span class="flex size-8 shrink-0 items-center justify-center rounded-[10px]" [style.background-color]="e.fondo" [style.color]="e.tinta"><app-ic [nombre]="e.ic" [size]="15" /></span>
        <span class="flex min-w-0 flex-1 flex-col gap-0.5" [class]="e.nota ? 'rounded-xl bg-[#fffbea] px-3 py-2' : ''">
          <span class="text-[13px] font-semibold text-gray-900">{{ e.titulo }}</span>
          @if (e.detalle) {
            <span class="text-[12.5px] leading-[18px] whitespace-pre-wrap text-gray-600">{{ e.detalle }}</span>
          }
          <span class="text-[11.5px] text-gray-400">{{ e.por }} · {{ e.cuando }}</span>
        </span>
      </div>
    }
  `,
})
export class PestanaActividadComponent {
  private readonly v = inject(VentasStore);
  readonly pedido = input.required<Pedido>();
  /** El borrador de la nota se vacía al cambiar de pedido. */
  protected readonly nota = linkedSignal({ source: () => this.pedido().id, computation: () => '' });
  protected readonly guardando = signal(false);

  protected readonly eventos = computed(() =>
    [...this.pedido().eventos].reverse().map((e, i) => {
      const I = EVI[e.tipo] ?? EVI['editado'], E2 = e.tipo === 'estado' && e.estado ? EST[e.estado] : null;
      return {
        ic: e.estado === 'cancelado' ? 'circle-x' : e.estado === 'devuelto' ? 'undo' : I[0],
        fondo: E2?.bg ?? I[1],
        tinta: E2?.fg ?? I[2],
        titulo: I[3] || e.detalle,
        detalle: I[3] ? e.detalle : e.motivo && !e.detalle.includes(e.motivo) ? '«' + e.motivo + '»' : '',
        por: e.por,
        cuando: completa(e.en),
        nota: e.tipo === 'nota',
        retraso: i * 40,
      };
    }),
  );

  protected async dejarNota(): Promise<void> {
    if (!this.nota().trim() || this.guardando()) return;
    this.guardando.set(true);
    if (await this.v.dejarNota(this.pedido().id, this.nota())) this.nota.set('');
    this.guardando.set(false);
  }
}
