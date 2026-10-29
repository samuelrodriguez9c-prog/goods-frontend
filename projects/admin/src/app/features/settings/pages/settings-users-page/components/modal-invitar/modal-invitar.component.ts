import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { tonoPersona } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { iconoRol } from '../../../../shared/permisos';
import {
  MarcoModalComponent,
  PieModalComponent,
} from '../../../../shared/ui/marco-modal/marco-modal.component';
import { PuntoRadioComponent } from '../../../../shared/ui/punto-radio/punto-radio.component';
import { RolUsuario, arbolRoles, evaluarCorreos } from '../../usuarios.util';
import { CampoCorreosComponent } from '../campo-correos/campo-correos.component';
import { VistaCorreoInvitacionComponent } from '../vista-correo-invitacion/vista-correo-invitacion.component';

export interface Invitacion {
  correos: string[];
  rol: RolUsuario;
  /** «Mensaje personal»; vacío si no se escribió. */
  mensaje: string;
}

/** Lo que acepta `POST /usuarios/empleado` en `mensaje`. */
const MAX_MENSAJE = 500;

/**
 * Modal «Invitar personas»: correos a la izquierda (varios a la vez), un rol
 * para todos y, a la derecha, cómo les llega el correo con el mensaje
 * personal (opcional) que va en él. No llama al backend:
 * emite `enviar` y la página crea a cada persona.
 */
@Component({
  selector: 'app-modal-invitar',
  standalone: true,
  imports: [
    IcComponent,
    MarcoModalComponent,
    PieModalComponent,
    PuntoRadioComponent,
    CampoCorreosComponent,
    VistaCorreoInvitacionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <app-marco-modal
      etiqueta="Invitar personas"
      [ancho]="920"
      alto="min(640px,100%)"
      (cerrar)="cerrar.emit()"
    >
      <div class="flex items-center gap-3.5 px-[18px] pt-[18px] pb-4">
        <span class="relative flex h-11 min-w-[52px] shrink-0 items-center">
          @if (!listos().length) {
            <span
              class="flex size-11 animate-[st-pop_.25s_both] items-center justify-center rounded-full bg-[#303030] text-white"
              ><app-ic nombre="user-plus" [size]="20"
            /></span>
          } @else {
            <span class="relative flex flex-row-reverse pl-3.5">
              @if (listos().length > 2) {
                <span
                  class="absolute -top-[5px] -right-1.5 z-[9] flex h-[18px] min-w-[18px] animate-[st-pop_.25s_cubic-bezier(.2,.8,.2,1)_both] items-center justify-center rounded-full bg-[#303030] px-1 text-[9.5px] font-bold text-white shadow-[0_0_0_2px_#fff]"
                  >+{{ listos().length - 2 }}</span
                >
              }
              @for (a of avatares(); track a.correo) {
                <span
                  class="-ml-3.5 flex size-9 animate-[st-pop_.28s_cubic-bezier(.2,.8,.2,1)_both] items-center justify-center rounded-full text-xs font-semibold shadow-[0_0_0_2.5px_#fff]"
                  [style.background]="a.bg"
                  [style.color]="a.fg"
                  [style.z-index]="a.z"
                  >{{ a.ini }}</span
                >
              }
            </span>
          }
        </span>
        <span class="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span class="flex flex-wrap items-center gap-2">
            <span
              class="font-display text-lg leading-[22px] font-semibold tracking-[-0.01em] text-[#111827]"
              >Invitar personas</span
            >
            @if (listos().length) {
              <span
                class="inline-flex h-5 animate-[st-pop_.25s_both] items-center gap-[5px] rounded-md bg-[#e7f6ec] px-[7px] text-[11.5px] font-semibold tabular-nums text-[#1f6b43]"
              >
                <span class="size-1.5 rounded-full bg-[#29845a]"></span
                >{{ listos().length === 1 ? '1 lista' : listos().length + ' listas' }}
              </span>
            }
          </span>
          <span class="text-pretty text-[12.5px] leading-[18px] text-[#6b7280]">{{ sub() }}</span>
        </span>
        <div class="flex shrink-0 items-center gap-2.5">
          <span class="flex flex-col items-end gap-px text-right">
            <span class="text-[10.5px] font-semibold tracking-[.06em] text-[#9ca3af] uppercase">{{
              empresa()
            }}</span>
            <span class="whitespace-nowrap text-xs font-medium tabular-nums text-[#374151]">{{
              resumenEquipo()
            }}</span>
          </span>
          <span class="h-7 w-px bg-[#efefef]"></span>
          <kbd
            class="flex h-5 items-center rounded-[5px] bg-[#f4f4f4] px-1.5 font-sans text-[11px] text-[#6b7280]"
            >Esc</kbd
          >
          <button
            type="button"
            (click)="cerrar.emit()"
            title="Cerrar · Esc"
            class="flex rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f4f4f4] hover:text-[#111827]"
          >
            <app-ic nombre="x" [size]="17" />
          </button>
        </div>
      </div>
      <div class="mx-[18px] h-px bg-[#f1f1f1]"></div>

      <div
        class="grid min-h-0 flex-1 grid-cols-[minmax(0,1.35fr)_minmax(260px,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden"
      >
        <div
          class="box-border flex h-full min-h-0 min-w-0 flex-col gap-[22px] overflow-y-auto p-[18px] [scrollbar-width:thin]"
        >
          <div class="flex flex-col gap-2">
            <span class="text-[12.5px] font-semibold text-[#111827]">¿A quiénes invitas?</span>
            <span class="-mt-1.5 text-xs leading-[17px] text-[#6b7280]"
              >Pega una lista completa: separamos los correos por comas, espacios o saltos de
              línea.</span
            >
            <app-campo-correos [(correos)]="correos" [existentes]="existentes()" />
          </div>
          <div class="flex flex-col gap-2">
            <span class="text-[12.5px] font-semibold text-[#111827]">¿Con qué rol entran?</span>
            <span class="-mt-1.5 text-xs leading-[17px] text-[#6b7280]"
              >Todos entran con el mismo rol; puedes cambiárselo a cada uno después desde su
              ficha.</span
            >
            <div role="radiogroup" class="flex flex-col gap-0.5">
              @for (g of arbol(); track g.t; let gi = $index) {
                <div
                  class="flex h-[34px] items-center gap-[9px] pr-1.5 pl-0.5"
                  [style.margin-top.px]="gi ? 6 : 0"
                >
                  <span
                    class="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-[#efefef] text-[#6b7280]"
                    ><app-ic [nombre]="g.icono" [size]="13"
                  /></span>
                  <span class="min-w-0 flex-1 text-[12.5px] font-medium text-[#111827]">{{
                    g.t
                  }}</span>
                  <span class="text-[11px] tabular-nums text-[#9ca3af]">{{ g.roles.length }}</span>
                </div>
                @for (r of g.roles; track r.id) {
                  @let on = rol()?.id === r.id;
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="on"
                    (click)="rolId.set(r.id)"
                    class="group flex min-h-[38px] animate-[st-fade-in_.2s_both] items-center py-0.5 pr-1.5 pl-[30px] text-left"
                  >
                    <app-punto-radio variante="aparece" [on]="on" />
                    <span
                      class="mr-[9px] flex size-6 shrink-0 items-center justify-center rounded-[7px] text-[#6b7280]"
                      ><app-ic [nombre]="iconoDe(r)" [size]="13"
                    /></span>
                    <span class="flex min-w-0 flex-1 flex-col gap-px">
                      <span
                        class="text-[12.5px] text-[#111827]"
                        [style.font-weight]="on ? 600 : 500"
                        >{{ r.nombre }}</span
                      >
                      <span class="truncate text-[11.5px] text-[#8a8a8a]">{{ r.descripcion }}</span>
                    </span>
                    <span class="ml-2 text-[11px] tabular-nums text-[#9ca3af]">{{
                      r.modulosTexto
                    }}</span>
                  </button>
                }
              }
            </div>
          </div>
        </div>
        <div
          class="box-border flex h-full min-h-0 min-w-0 flex-col gap-[18px] overflow-y-auto border-l border-[#f1f1f1] bg-[#fcfcfc] p-[18px] [scrollbar-width:thin]"
        >
          <div class="flex flex-col gap-2">
            <span class="text-[12.5px] font-semibold text-[#111827]">Así les llega</span>
            <span class="-mt-1.5 text-xs leading-[17px] text-[#6b7280]"
              >Así se ve la plantilla de invitación de Goods con los datos de la primera
              persona.</span
            >
            <app-vista-correo-invitacion
              [quienInvita]="quienInvita()"
              [empresa]="empresa()"
              [correo]="primerCorreo()"
              [para]="para()"
              [rol]="rol()?.nombre ?? ''"
              [mensaje]="mensaje()"
            />
          </div>
          <label class="flex flex-col gap-2">
            <span class="flex items-baseline justify-between gap-2"
              ><span class="text-[12.5px] font-semibold text-[#111827]"
                >Mensaje personal <span class="font-normal text-[#9ca3af]">· opcional</span></span
              >
              @if (mensaje().length > maxMensaje - 60) {
                <span class="text-[11px] tabular-nums text-[#b45309]"
                  >{{ mensaje().length }} / {{ maxMensaje }}</span
                >
              }
            </span>
            <textarea
              [value]="mensaje()"
              (input)="mensaje.set($any($event.target).value)"
              rows="3"
              [attr.maxlength]="maxMensaje"
              placeholder="Bienvenidos al equipo. Cualquier duda me escriben por WhatsApp."
              class="min-h-[72px] resize-none rounded-xl border-0 bg-white px-3 py-[9px] text-[13px] leading-5 text-[#111827] shadow-[0_0_0_1px_#e5e5e5] outline-none transition-shadow duration-200 [field-sizing:content] focus:shadow-[0_0_0_1px_#303030,0_0_0_4px_rgba(48,48,48,.07)]"
            ></textarea>
          </label>
        </div>
      </div>

      <app-pie-modal
        [texto]="pie()"
        [accion]="accion()"
        icono="send"
        [deshabilitado]="!listos().length || enviando()"
        (cancelar)="cerrar.emit()"
        (aceptar)="confirmar()"
      />
    </app-marco-modal>
  `,
})
export class ModalInvitarComponent {
  readonly roles = input.required<RolUsuario[]>();
  readonly existentes = input.required<Set<string>>();
  /** Rol elegido al abrir. */
  readonly rolInicial = input<number | null>(null);
  readonly empresa = input.required<string>();
  readonly quienInvita = input.required<string>();
  /** «5 en tu equipo · 2 por aceptar». */
  readonly resumenEquipo = input('');
  readonly enviando = input(false);
  readonly enviar = output<Invitacion>();
  readonly cerrar = output<void>();

  protected readonly correos = signal<string[]>([]);
  protected readonly rolId = signal<number | null>(null);
  protected readonly mensaje = signal('');
  protected readonly maxMensaje = MAX_MENSAJE;
  private readonly campo = viewChild.required(CampoCorreosComponent);

  protected readonly iconoDe = iconoRol;
  protected readonly arbol = computed(() => arbolRoles(this.roles()));
  private readonly tokens = computed(() => evaluarCorreos(this.correos(), this.existentes()));
  protected readonly listos = computed(() => this.tokens().filter((t) => t.estado === 'ok'));
  private readonly malos = computed(() => this.tokens().length - this.listos().length);
  protected readonly rol = computed<RolUsuario | null>(() => {
    const elegibles = this.arbol().flatMap((g) => g.roles);
    const id = this.rolId() ?? this.rolInicial();
    return elegibles.find((r) => r.id === id) ?? elegibles[0] ?? null;
  });
  /** Hasta dos avatares (el primero encima) y el «+N». */
  protected readonly avatares = computed(() =>
    this.listos()
      .slice(0, 2)
      .map((t, i) => {
        const [bg, fg] = tonoPersona(t.correo);
        return { correo: t.correo, ini: t.correo.charAt(0).toUpperCase(), bg, fg, z: 5 - i };
      })
      .reverse(),
  );
  protected readonly primerCorreo = computed(() => this.listos()[0]?.correo ?? 'ana@mitienda.co');
  protected readonly para = computed(() => {
    const ok = this.listos().map((t) => t.correo);
    if (!ok.length) return 'ana@mitienda.co';
    return ok.slice(0, 2).join(', ') + (ok.length > 2 ? ` y ${ok.length - 2} más` : '');
  });
  protected readonly sub = computed(() =>
    this.listos().length
      ? `Se unirán como ${this.rol()?.nombre ?? '—'}. Cada persona recibe un enlace para crear su contraseña; tú nunca la conoces.`
      : 'Pega uno o varios correos. Cada persona recibe un enlace para crear su contraseña; tú nunca la conoces.',
  );
  protected readonly pie = computed(() => {
    const ok = this.listos().length;
    const m = this.malos();
    if (ok)
      return `${ok === 1 ? '1 invitación lista' : ok + ' invitaciones listas'} como ${this.rol()?.nombre ?? ''}${m ? ' · ' + m + ' no se enviarán' : ''}`;
    return m ? 'Ningún correo se puede enviar todavía' : 'Agrega al menos un correo';
  });
  protected readonly accion = computed(() => {
    if (this.enviando()) return 'Enviando…';
    const n = this.listos().length;
    return n > 1 ? `Enviar ${n} invitaciones` : 'Enviar invitación';
  });

  constructor() {
    afterNextRender(() => this.campo().enfocar());
  }

  protected confirmar(): void {
    const rol = this.rol();
    if (!this.listos().length || !rol || this.enviando()) return;
    this.enviar.emit({
      correos: this.listos().map((t) => t.correo),
      rol,
      mensaje: this.mensaje().trim(),
    });
  }
}
