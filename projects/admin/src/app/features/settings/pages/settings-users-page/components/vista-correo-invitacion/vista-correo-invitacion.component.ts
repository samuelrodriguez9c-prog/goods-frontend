import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HORAS_INVITACION } from '../../usuarios.util';

/**
 * Vista previa del correo de invitación con los datos de la primera persona.
 * Copia el texto de la plantilla `user-invite.hbs` del backend tal cual
 * (incluido su voseo): si la plantilla cambia, este texto también. Como se
 * invita solo con el correo, el saludo va sin nombre («Hola:»). El mensaje
 * personal va como en la plantilla: un recuadro con borde negro firmado por
 * quien invita.
 */
@Component({
  selector: 'app-vista-correo-invitacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex flex-col overflow-hidden rounded-[14px] bg-[#f1f1f1] shadow-[0_0_0_1px_#e5e5e5,0_18px_36px_-24px_rgba(0,0,0,.4)]',
  },
  template: `
    <div class="flex flex-col gap-0.5 border-b border-[#efefef] bg-white px-3 py-[9px]">
      <span class="flex items-center gap-1.5 text-[11.5px] text-[#111827]"
        ><strong class="font-semibold"
          >{{ quienInvita() }} te invitó a {{ empresa() }} en Goods</strong
        ></span
      >
      <span class="truncate text-[11px] text-[#6b7280]"
        >Goods &lt;no-responder&#64;goods.app&gt; · para {{ para() }}</span
      >
    </div>
    <div class="flex flex-col bg-[#f1f1f1] px-[22px] pt-[18px] pb-6 font-sans">
      <img src="email/goods-smart-negro.png" alt="Goods" class="block h-auto w-[72px]" />
      <p
        class="mt-6 mb-3.5 font-['Poppins','Inter',sans-serif] text-4xl leading-9 font-bold tracking-[-1.4px] text-[#0a0a0a]"
      >
        Te invitaron.
      </p>
      <p class="mb-[9px] text-[9.5px] leading-3 font-bold tracking-[1.1px] text-[#555] uppercase">
        Equipo · Invitación
      </p>
      <p class="mb-[7px] text-[11.5px] leading-[17px] text-[#1f1f1f]">
        Hola{{ nombre() ? ', ' + nombre() : '' }}:
      </p>
      <p class="mb-3 text-[11.5px] leading-[17px] text-[#1f1f1f]">
        <strong>{{ quienInvita() }}</strong> te agregó al equipo de
        <strong>{{ empresa() }}</strong> en Goods{{ rol() ? ' como ' : ''
        }}<strong>{{ rol() }}</strong
        >. Para entrar, creá tu contraseña.
      </p>
      @if (mensaje().trim()) {
        <p
          class="mb-3 animate-[st-fade-in_.2s_both] whitespace-pre-line border-l-[3px] border-[#0a0a0a] bg-[#f6f6f6] px-3 py-2.5 text-[11.5px] leading-[17px] text-[#1f1f1f]"
        >
          {{ mensaje().trim() }}<br /><span class="text-[#555]">— {{ quienInvita() }}</span>
        </p>
      }
      <span
        class="mb-4 self-start bg-[#0a0a0a] px-[18px] py-[11px] text-[11.5px] leading-[14px] font-bold text-white"
        >Crear mi contraseña</span
      >
      <p class="mb-1.5 text-[11.5px] leading-[17px] text-[#303030] italic">
        Vas a ingresar con <strong>{{ correo() }}</strong
        >. El enlace vence en {{ horas }} horas y se usa una sola vez. Si el botón no funciona,
        <span class="text-[#0a0a0a] underline">abrí este enlace</span>.
      </p>
      <p class="mb-3 text-[11.5px] leading-[17px] text-[#303030] italic">
        ¿No conocés a {{ quienInvita() }} o a {{ empresa() }}? Ignorá este correo; sin contraseña no
        se activa ningún acceso.
      </p>
      <p class="text-[11.5px] leading-[17px] text-[#1f1f1f]">Equipo de Goods</p>
    </div>
  `,
})
export class VistaCorreoInvitacionComponent {
  readonly quienInvita = input.required<string>();
  readonly empresa = input.required<string>();
  /** Correo de la primera persona («Vas a ingresar con…»). */
  readonly correo = input.required<string>();
  /** «ana@x.co, pedro@x.co y 3 más». */
  readonly para = input.required<string>();
  /** Vacío al invitar solo con el correo. */
  readonly nombre = input('');
  readonly rol = input('');
  /** «Mensaje personal» del modal. */
  readonly mensaje = input('');
  protected readonly horas = HORAS_INVITACION;
}
