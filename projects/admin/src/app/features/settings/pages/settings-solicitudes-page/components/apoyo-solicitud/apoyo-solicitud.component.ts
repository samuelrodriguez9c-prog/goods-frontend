import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { SolicitudLista, esPublica } from '../../solicitudes.util';

/**
 * Votar y seguir, arriba del lateral de la ficha.
 *
 * @remarks
 * - Del tablero: «Me interesa» vota (y sigue); si la tienda ya la pidió, no se
 *   vota y lleva a su propia solicitud.
 * - Propia: la tienda ya cuenta como voto; solo se muestra el total cuando
 *   está en el tablero u otras tiendas la piden.
 */
@Component({
  selector: 'app-apoyo-solicitud',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  template: `
    @let x = solicitud();
    @if (puedeVotar()) {
      <button
        type="button"
        (click)="votar.emit()"
        [disabled]="votando()"
        [title]="votado() ? 'Quitar tu voto' : 'Votar: las más votadas se revisan primero'"
        class="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 active:scale-[.97] disabled:cursor-wait"
        [class]="
          votado()
            ? 'bg-[#303030] text-white'
            : 'bg-white text-[#303030] shadow-[0_0_0_1px_#e5e5e5] hover:bg-[#f7f7f7]'
        "
      >
        <span
          class="flex"
          [class]="votado() ? 'animate-[pop_.35s_cubic-bezier(.3,1.6,.5,1)_both]' : ''"
          ><app-ic [nombre]="votado() ? 'caret-up-filled' : 'caret-up'" [size]="16"
        /></span>
        {{ votado() ? 'Te interesa' : 'Me interesa' }}
        <span class="font-semibold tabular-nums">{{ x.votos }}</span>
      </button>
    } @else if (mostrarTotal()) {
      <div
        title="Tu tienda ya cuenta como voto"
        class="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-[#f6f6f6] text-[13px] font-medium text-[#303030]"
      >
        <app-ic nombre="caret-up-filled" [size]="16" class="text-[#00a39b]" />Tu tienda la pide
        <span class="font-semibold tabular-nums">{{ x.votos }}</span>
      </div>
    }
    @if (miId(); as id) {
      <button
        type="button"
        (click)="verMia.emit(id)"
        class="flex h-10 w-full cursor-pointer items-center justify-center gap-[7px] rounded-[10px] bg-white text-[13px] font-medium text-[#303030] shadow-[0_0_0_1px_#e5e5e5] hover:bg-[#f7f7f7]"
      >
        <app-ic nombre="message-dots" [size]="16" />Ver tu solicitud
      </button>
    }
    <button
      type="button"
      (click)="seguir.emit()"
      [disabled]="siguiendo()"
      [title]="x.sigo ? 'Dejar de recibir sus avisos' : 'Recibe un aviso cuando cambie de estado'"
      class="flex h-10 w-full cursor-pointer items-center justify-center gap-[7px] rounded-[10px] bg-white text-[13px] font-medium text-[#303030] shadow-[0_0_0_1px_#e5e5e5] hover:bg-[#f7f7f7] disabled:cursor-wait"
    >
      <app-ic [nombre]="x.sigo ? 'bell-ringing' : 'bell'" [size]="16" />{{
        x.sigo ? 'Siguiendo' : 'Seguir'
      }}
    </button>
    @if (nota()) {
      <span class="text-pretty text-center text-xs text-[#6b7280]">{{ nota() }}</span>
    }
  `,
})
export class ApoyoSolicitudComponent {
  readonly solicitud = input.required<SolicitudLista>();
  readonly votando = input(false);
  readonly siguiendo = input(false);

  readonly votar = output<void>();
  readonly seguir = output<void>();
  /** El id de la solicitud propia de la tienda (cuando ya la pidió). */
  readonly verMia = output<number>();

  protected readonly puedeVotar = computed(() => {
    const x = this.solicitud();
    return esPublica(x) && !x.esMia;
  });
  protected readonly votado = computed(() => {
    const x = this.solicitud();
    return esPublica(x) && x.voto;
  });
  protected readonly miId = computed(() => {
    const x = this.solicitud();
    return esPublica(x) && x.esMia ? x.miSolicitudId : null;
  });
  protected readonly mostrarTotal = computed(() => {
    const x = this.solicitud();
    return esPublica(x) ? x.esMia : x.publica || x.votos > 1;
  });
  protected readonly nota = computed(() => {
    const x = this.solicitud();
    const tiendas = (n: number, mas = '') =>
      `${n} ${n === 1 ? `tienda${mas} la pide` : `tiendas${mas} la piden`}`;
    if (esPublica(x) && !x.esMia) {
      if (!x.voto) return `${tiendas(x.votos)} · vota y te avisamos cuando cambie de estado`;
      const otras = x.votos - 1;
      return otras ? `${tiendas(otras, ' más')}` : 'Eres la primera tienda en apoyarla';
    }
    const otras = x.votos - 1;
    if (otras > 0) return tiendas(otras, ' más');
    if (!esPublica(x) && x.publica) return 'Está en el tablero: otras tiendas pueden apoyarla';
    return '';
  });
}
