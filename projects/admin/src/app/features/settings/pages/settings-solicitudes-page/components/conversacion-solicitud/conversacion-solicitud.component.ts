import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AuthService } from '../../../../../../core/auth/auth.service';
import {
  IMPACTO_SOLICITUD,
  Solicitud,
} from '../../../../../../core/solicitudes/models/solicitud.model';
import { AlertaService } from '../../../../../../core/ui/alerta.service';
import { haceCuanto, iniciales, tonoPersona } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import {
  MAX_CAPTURAS_SOLICITUD,
  TIPO_UI,
  filtrarCapturas,
  vistaEvento,
} from '../../solicitudes.util';
import { CapturasSolicitudComponent } from '../capturas-solicitud/capturas-solicitud.component';

/** Desde este ancho la conversación va a dos lados de un riel central. */
const ANCHO_DOBLE = 520;

/**
 * La descripción original como primera burbuja (con tipo y área), la
 * conversación con el equipo (`eventos`: cambios de estado como pastillas y
 * comentarios; los de Goods con su sello) y el campo para responder.
 *
 * @remarks
 * - Como en el handoff: si cabe (≥ 520 px), el riel va al centro, lo tuyo a la
 *   derecha en oscuro y lo demás a la izquierda; si no, el riel va a la
 *   izquierda y lo tuyo se alinea a la derecha.
 * - El scroll va dentro de la conversación: con `llenar` ocupa el alto que
 *   queda en la ficha; si no, los mensajes tienen un alto máximo.
 * - Enter envía, Shift+Enter hace un salto de línea. Baja sola al final
 *   cuando llegan mensajes.
 * - Debajo de la descripción, el tipo, el impacto y las capturas. El clip del
 *   campo sube más (hasta 8 por solicitud): emite `adjuntar` y la página las sube.
 */
@Component({
  selector: 'app-conversacion-solicitud',
  standalone: true,
  imports: [IcComponent, CapturasSolicitudComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @let x = solicitud();
    @let doble = ancho();
    <div
      class="grid animate-[st-fade-in-up_.3s_cubic-bezier(.2,.8,.2,1)_both] grid-cols-[34px_minmax(0,1fr)] gap-2.5"
    >
      <span
        class="flex size-[34px] items-center justify-center rounded-full text-xs font-semibold"
        [style.background]="autor().tono[0]"
        [style.color]="autor().tono[1]"
        >{{ autor().ini }}</span
      >
      <div class="flex min-w-0 flex-col items-start gap-1.5">
        <span class="flex flex-wrap items-baseline gap-1.5 text-xs text-[#9ca3af]"
          ><strong class="text-[13px] font-semibold text-[#111827]">{{ autor().nombre }}</strong
          >envió esta solicitud · {{ enviada() }}</span
        >
        <div
          class="relative max-w-[560px] rounded-[4px_18px_18px_18px] bg-[#f4f4f4] px-[15px] py-3"
        >
          <p class="m-0 whitespace-pre-wrap text-pretty text-sm leading-[22px] text-[#1f2937]">
            {{ x.descripcion }}
          </p>
        </div>
        <span class="flex flex-wrap gap-1.5">
          <span
            class="inline-flex h-[22px] items-center gap-[5px] rounded-full px-[9px] text-[11.5px] text-[#4b5563] shadow-[0_0_0_1px_#ececec]"
            ><app-ic [nombre]="tipo().icono" [size]="12" />{{ tipo().t }}</span
          >
          @if (impacto(); as im) {
            <span
              class="inline-flex h-[22px] items-center gap-[5px] rounded-full px-[9px] text-[11.5px] text-[#4b5563] shadow-[0_0_0_1px_#ececec]"
              ><app-ic nombre="gauge" [size]="12" />Impacto: {{ im }}</span
            >
          }
        </span>
        @if (x.adjuntos?.length) {
          <app-capturas-solicitud [solicitudId]="x.id" [adjuntos]="x.adjuntos!" />
        }
      </div>
    </div>

    <div
      class="flex flex-col gap-3"
      [style.flex]="llenar() ? '1 1 0' : null"
      [style.min-height]="llenar() ? '220px' : null"
    >
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span class="flex min-w-0 flex-col gap-0.5">
          <span class="font-display text-[15px] font-semibold text-[#111827]"
            >Conversación con el equipo</span
          >
          <span class="text-xs text-[#6b7280]">{{ resumen() }}</span>
        </span>
        @if (participantes().length) {
          <span [title]="quienes()" class="flex items-center gap-2">
            <span class="flex pl-1.5">
              @for (p of participantes(); track p.n) {
                <span
                  class="-ml-1.5 flex size-6 items-center justify-center rounded-full text-[9.5px] font-bold shadow-[0_0_0_2px_#fff]"
                  [style.background]="p.bg"
                  [style.color]="p.fg"
                  >{{ p.ini }}</span
                >
              }
            </span>
            <span class="whitespace-nowrap text-xs text-[#6b7280]">{{
              participantes().length === 1 ? '1 persona' : participantes().length + ' personas'
            }}</span>
          </span>
        }
      </div>
      <div
        #scroll
        [style.flex]="llenar() ? '1 1 0' : null"
        [style.max-height]="llenar() ? null : (altoMax() ?? 420) + 'px'"
        class="-mx-1.5 min-h-0 overflow-y-auto overscroll-contain rounded-xl px-1.5 pb-1.5 [mask-image:linear-gradient(transparent,#000_18px,#000_calc(100%-18px),transparent)] [scrollbar-width:thin]"
      >
        <div #conv class="relative flex flex-col gap-3.5 pb-3 pt-3.5">
          <span
            class="absolute inset-y-0 -ml-px w-0.5 rounded-sm bg-[linear-gradient(#f0f0f0,#ececec_85%,rgba(236,236,236,0))]"
            [style.left]="doble ? '50%' : '16px'"
          ></span>
          @for (c of eventos(); track c.id) {
            @if (c.esEvento) {
              <div
                class="relative flex animate-[st-fade-in_.25s_both]"
                [style.justify-content]="doble ? 'center' : 'flex-start'"
              >
                <span
                  class="flex items-center gap-[7px] whitespace-nowrap rounded-full bg-white py-1 pl-[5px] pr-[11px] text-xs text-[#4b5563] shadow-[0_0_0_1px_#ececec]"
                >
                  <span
                    class="flex size-[18px] items-center justify-center rounded-full"
                    [style.background]="c.evBg"
                    [style.color]="c.evFg"
                    ><app-ic [nombre]="c.evIcono" [size]="10" /></span
                  >{{ c.t }}<span class="text-[#9ca3af]">· {{ c.cuando }}</span>
                </span>
              </div>
            } @else {
              @let derecha = c.mio;
              <div
                class="relative grid animate-[st-fade-in-up_.28s_cubic-bezier(.2,.8,.2,1)_both] items-start gap-2.5"
                [style.grid-template-columns]="
                  doble ? 'minmax(0,1fr) 32px minmax(0,1fr)' : '32px minmax(0,1fr)'
                "
              >
                <div
                  class="row-start-1 flex min-w-0 flex-col gap-1 pt-px"
                  [style.grid-column]="doble ? (c.mio ? '3' : '1') : '2'"
                  [style.align-items]="
                    doble
                      ? c.mio
                        ? 'flex-start'
                        : 'flex-end'
                      : derecha
                        ? 'flex-end'
                        : 'flex-start'
                  "
                >
                  <span
                    class="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 text-xs"
                    [style.flex-direction]="
                      doble ? (c.mio ? 'row' : 'row-reverse') : derecha ? 'row-reverse' : 'row'
                    "
                  >
                    <strong class="text-[13px] font-semibold text-[#111827]">{{ c.autor }}</strong>
                    @if (c.deGoods) {
                      <span
                        class="flex items-center gap-[3px] rounded-[5px] bg-[#f1f1f1] px-1.5 py-px text-[10.5px] font-semibold text-[#303030]"
                        ><app-ic
                          nombre="rosette-discount-check-filled"
                          [size]="12"
                          class="text-[#5fbfb8]"
                        />Equipo Goods</span
                      >
                    }
                    <span class="text-[#9ca3af]">{{ c.cuando }}</span>
                  </span>
                  <span
                    class="max-w-full whitespace-pre-wrap text-pretty px-[13px] py-[9px] text-[13.5px] leading-5"
                    [style.border-radius]="
                      doble
                        ? c.mio
                          ? '4px 16px 16px 16px'
                          : '16px 4px 16px 16px'
                        : derecha
                          ? '16px 4px 16px 16px'
                          : '4px 16px 16px 16px'
                    "
                    [style.background]="c.mio ? '#303030' : '#fff'"
                    [style.color]="c.mio ? '#fff' : '#1f2937'"
                    [style.box-shadow]="c.mio ? 'none' : '0 0 0 1px #e8e8e8'"
                    >{{ c.t }}</span
                  >
                </div>
                <span
                  class="row-start-1 flex size-8 items-center justify-center rounded-full text-[11px] font-semibold shadow-[0_0_0_4px_#fff]"
                  [style.grid-column]="doble ? '2' : '1'"
                  [style.background]="c.avBg"
                  [style.color]="c.avFg"
                  >{{ c.ini }}</span
                >
              </div>
            }
          }
        </div>
      </div>
      @if (abierta()) {
        <div
          class="relative flex flex-col gap-2.5 pt-0.5"
          [style.align-items]="doble ? 'center' : 'flex-start'"
        >
          <span
            class="flex size-8 items-center justify-center rounded-full text-[11px] font-semibold shadow-[0_0_0_4px_#fff]"
            [style.background]="yo().tono[0]"
            [style.color]="yo().tono[1]"
            >{{ yo().ini }}</span
          >
          <div
            class="flex w-full items-end gap-1 rounded-3xl bg-white p-1 shadow-[0_0_0_1px_#e5e5e5] transition-shadow duration-200 focus-within:shadow-[0_0_0_1px_#d4d4d4,0_0_0_4px_rgba(10,10,10,.04)]"
          >
            <input
              #campoArchivos
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif"
              class="hidden"
              (change)="elegir($any($event.target))"
            />
            <button
              type="button"
              (click)="campoArchivos.click()"
              [disabled]="subiendo() || libres() <= 0"
              [title]="
                libres() <= 0
                  ? 'Ya tiene las 8 capturas que admite'
                  : subiendo()
                    ? 'Subiendo…'
                    : 'Adjuntar captura'
              "
              class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f4f4f4] text-[#4b5563] hover:bg-[#ebebeb] hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <app-ic
                [nombre]="subiendo() ? 'loader' : 'paperclip'"
                [size]="17"
                [class.animate-spin]="subiendo()"
              />
            </button>
            <textarea
              rows="1"
              [value]="texto()"
              (input)="texto.set($any($event.target).value)"
              (keydown)="tecla($event)"
              placeholder="Agrega contexto o responde al equipo…"
              class="box-border max-h-[140px] min-h-9 min-w-0 flex-1 resize-none border-0 bg-transparent px-3 py-[7px] text-[13.5px] leading-5 text-[#111827] outline-none [field-sizing:content]"
            ></textarea>
            <button
              type="button"
              (click)="enviar()"
              title="Enviar · Enter"
              [disabled]="!texto().trim() || enviando()"
              class="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors enabled:bg-[#303030] enabled:text-white disabled:bg-[#f1f1f1] disabled:text-[#b5b5b5]"
            >
              <app-ic nombre="arrow-up" />
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ConversacionSolicitudComponent {
  private readonly auth = inject(AuthService);

  readonly solicitud = input.required<Solicitud>();
  /** Lo que se está escribiendo; la página lo vacía al enviar bien. */
  readonly texto = model('');
  readonly enviando = input(false);
  /** La ficha es alta: la conversación ocupa el resto del alto y el scroll queda adentro. */
  readonly llenar = input(false);
  /** Si no llena: alto máximo de los mensajes, para que la conversación quepa en la ficha. */
  readonly altoMax = input<number | null>(null);
  readonly comentar = output<string>();
  /** Se están subiendo capturas. */
  readonly subiendo = input(false);
  /** Capturas válidas elegidas con el clip (la página las sube). */
  readonly adjuntar = output<File[]>();
  private readonly alerta = inject(AlertaService);

  private readonly scroll = viewChild<ElementRef<HTMLElement>>('scroll');
  private readonly conv = viewChild<ElementRef<HTMLElement>>('conv');
  /** Si cabe la conversación a dos lados. */
  protected readonly ancho = signal(true);

  private readonly yoId = computed(() => this.auth.currentUser()?.id ?? -1);
  protected readonly eventos = computed(() =>
    (this.solicitud().eventos ?? []).map((e) => vistaEvento(e, this.yoId())),
  );
  protected readonly abierta = computed(
    () => !['cancelada', 'entregada'].includes(this.solicitud().estado),
  );
  protected readonly enviada = computed(() => haceCuanto(this.solicitud().creadoEn).toLowerCase());
  protected readonly tipo = computed(() => TIPO_UI[this.solicitud().tipo]);
  protected readonly impacto = computed(() => {
    const i = this.solicitud().impacto;
    return i ? IMPACTO_SOLICITUD[i].toLowerCase() : null;
  });
  protected readonly libres = computed(
    () => MAX_CAPTURAS_SOLICITUD - (this.solicitud().adjuntos?.length ?? 0),
  );
  protected readonly autor = computed(() => {
    const c = this.solicitud().creadaPor;
    const n = c?.nombre ?? 'Tu equipo';
    return { nombre: c?.id === this.yoId() ? 'Tú' : n, ini: iniciales(n), tono: tonoPersona(n) };
  });
  protected readonly yo = computed(() => {
    const u = this.auth.currentUser();
    const n = u ? `${u.nombres} ${u.apellidos}`.trim() : 'Tú';
    return { ini: iniciales(n), tono: tonoPersona(n) };
  });
  /** «2 mensajes · 1 cambio de estado · Laura respondió hace 2 h». */
  protected readonly resumen = computed(() => {
    const ev = this.solicitud().eventos ?? [];
    const ms = ev.filter((e) => e.tipo === 'comentario');
    if (!ms.length) return 'Aún no hay mensajes · escribe para dar más contexto';
    const nEv = ev.length - ms.length;
    const ult = [...ms].reverse().find((e) => e.deGoods);
    return [
      ms.length === 1 ? '1 mensaje' : `${ms.length} mensajes`,
      nEv ? (nEv === 1 ? '1 cambio de estado' : `${nEv} cambios de estado`) : '',
      ult
        ? `${(ult.autor?.nombre ?? 'Goods').split(' ')[0]} respondió ${haceCuanto(ult.creadoEn).toLowerCase()}`
        : 'el equipo aún no responde',
    ]
      .filter(Boolean)
      .join(' · ');
  });
  /** Las personas que escribieron (las de Goods en negro). */
  protected readonly participantes = computed(() => {
    const m = new Map<string, { n: string; ini: string; bg: string; fg: string }>();
    for (const e of this.solicitud().eventos ?? []) {
      if (e.tipo !== 'comentario' || !e.autor) continue;
      const t = tonoPersona(e.autor.nombre);
      const n = e.autor.id === this.yoId() && !e.deGoods ? 'Tú' : e.autor.nombre;
      m.set(e.autor.nombre, {
        n,
        ini: iniciales(e.autor.nombre),
        bg: e.deGoods ? '#303030' : t[0],
        fg: e.deGoods ? '#fff' : t[1],
      });
    }
    return [...m.values()].slice(0, 4);
  });
  protected readonly quienes = computed(() =>
    this.participantes()
      .map((p) => p.n)
      .join(', '),
  );

  constructor() {
    effect(() => {
      void this.eventos().length;
      untracked(() =>
        setTimeout(() => {
          const el = this.scroll()?.nativeElement;
          el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }, 60),
      );
    });
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.conv()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(([e]) => this.ancho.set(e.contentRect.width >= ANCHO_DOBLE));
      ro.observe(el);
      destroy.onDestroy(() => ro.disconnect());
    });
  }

  protected elegir(el: HTMLInputElement): void {
    const { entran, fuera } = filtrarCapturas([...(el.files ?? [])], this.libres());
    el.value = '';
    if (fuera)
      this.alerta.mostrar({
        estado: 'warning',
        titulo: 'Algunas capturas no se agregaron',
        texto: `Hasta 4 por vez y ${MAX_CAPTURAS_SOLICITUD} por solicitud, PNG, JPG, WebP o GIF de 5 MB.`,
      });
    if (entran.length) this.adjuntar.emit(entran);
  }

  protected tecla(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.enviar();
    }
  }

  protected enviar(): void {
    const t = this.texto().trim();
    if (t && !this.enviando()) this.comentar.emit(t);
  }
}
