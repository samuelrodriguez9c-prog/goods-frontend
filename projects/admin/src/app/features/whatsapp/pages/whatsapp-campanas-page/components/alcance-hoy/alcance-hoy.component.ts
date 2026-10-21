import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AudienciaCampanas } from '../../../../../../core/whatsapp/whatsapp.model';

/**
 * «Recibirían una campaña hoy»: el alcance en grande, cuántos
 * aceptan promociones y cuántos están protegidos por la regla de N días, con
 * la barra turquesa + rayada.
 */
@Component({
  selector: 'app-alcance-hoy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alcance-hoy.component.html',
  host: { class: 'block rounded-2xl bg-white p-[18px] shadow-[0_0_0_1px_rgba(0,0,0,.04),0_1px_2px_rgba(0,0,0,.04)]' },
})
export class AlcanceHoyComponent {
  readonly audiencia = input.required<AudienciaCampanas>();
}
