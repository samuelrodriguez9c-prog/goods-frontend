import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  AreaSolicitud,
  CrearSolicitudPayload,
  IMPACTO_SOLICITUD,
  ImpactoSolicitud,
  TipoSolicitud,
} from '../../../../../../core/solicitudes/models/solicitud.model';
import { AlertaService } from '../../../../../../core/ui/alerta.service';
import { normalizar } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import {
  MarcoModalComponent,
  PieModalComponent,
} from '../../../../shared/ui/marco-modal/marco-modal.component';
import { ModalCabeceraComponent } from '../../../../shared/ui/modal-cabecera/modal-cabecera.component';
import {
  ICONO_AREA,
  MAX_CAPTURAS_ENVIO,
  TIPO_UI,
  filtrarCapturas,
  iconoSeccion,
  refDe,
} from '../../solicitudes.util';

/** Los tipos del backend en el orden del selector, con el texto del ejemplo y la ayuda. */
const TIPOS: {
  k: TipoSolicitud;
  d: string;
  sub: string;
  ph: string;
  ejemplos: string[];
}[] = [
  {
    k: 'ajuste_modulo',
    d: 'Algo que ya usas y podría funcionar mejor',
    sub: 'Cuéntanos qué podría funcionar mejor. El equipo de Goods la revisa y te responde aquí en 2 días hábiles.',
    ph: '¿Qué te gustaría que hiciera mejor? ¿Cómo lo haces hoy?',
    ejemplos: [
      'Filtrar pedidos por fecha de entrega',
      'Exportar con mis campos propios',
      'Ver el stock en la tienda',
    ],
  },
  {
    k: 'campo_personalizado',
    d: 'Guardar un dato que hoy no tiene dónde ir',
    sub: 'Cuéntanos qué dato necesitas guardar y dónde. El equipo de Goods la revisa y te responde aquí en 2 días hábiles.',
    ph: '¿Qué dato quieres guardar, en qué registros y para qué lo usarías?',
    ejemplos: ['Talla y color en mis productos', 'El NIT de mis clientes', 'Fecha de cumpleaños'],
  },
  {
    k: 'modulo_nuevo',
    d: 'Una sección que Goods todavía no tiene',
    sub: 'Cuéntanos qué sección le falta a tu tienda. El equipo de Goods la revisa y te responde aquí en 2 días hábiles.',
    ph: '¿Qué te gustaría poder hacer? ¿Con qué herramienta lo haces hoy?',
    ejemplos: ['Reservas y citas', 'Programa de puntos', 'Conectar con Siigo'],
  },
  {
    k: 'otro',
    d: 'Algo que no funciona como esperas, o cualquier otra idea',
    sub: 'Cuéntanos qué pasa. El equipo de Goods la revisa y te responde aquí en 2 días hábiles.',
    ph: '¿Qué pasa hoy? ¿Qué esperabas que pasara? ¿En qué pantalla?',
    ejemplos: [
      'El total no incluye el envío',
      'No llegan las notificaciones',
      'El buscador no encuentra clientes',
    ],
  },
];

const GUIAS = [
  { t: '¿Qué problema resuelve?', icono: 'help-circle', pre: 'Problema: ' },
  { t: '¿Cómo lo haces hoy?', icono: 'clock', pre: 'Hoy lo hago así: ' },
  { t: '¿Qué esperas?', icono: 'target-arrow', pre: 'Lo que espero: ' },
];

/** Qué cubre cada área (para buscarla). */
const AREA_D: Record<string, string> = {
  dashboard: 'Métricas y reportes de la tienda',
  orders: 'Estados, envíos y devoluciones',
  products: 'Catálogo, precios, variantes e inventario',
  customers: 'Fichas, historial y segmentos',
  discounts: 'Cupones y promociones',
  messages: 'Tu chat con el equipo de Goods',
  actividad_equipo: 'Qué hizo cada persona del equipo',
  users: 'Tu equipo y sus accesos',
  roles: 'Qué puede hacer cada persona',
  asistente_ia: 'El asistente que responde por ti',
  tienda: 'Tienda en línea y redes',
  whatsapp: 'Chats, plantillas y pedidos por chat',
};

/** Palabras del título o del texto que sugieren un área. */
const AREA_KW: [string, RegExp][] = [
  ['whatsapp', /whats|plantilla/i],
  ['messages', /soporte|ayuda/i],
  ['asistente_ia', /asistente|\bia\b|inteligencia/i],
  ['discounts', /descuento|cup[oó]n|promoci/i],
  ['customers', /client/i],
  ['products', /product|precio|variante|cat[aá]logo|stock|inventar|bodega/i],
  ['orders', /pedido|env[ií]o|devoluc|factur/i],
  ['tienda', /tienda|instagram|mercado|web/i],
  ['users', /usuario|equipo|empleado/i],
  ['roles', /\brol|permiso/i],
];

/** `null` es «No estoy seguro»: va sin módulo y el equipo la asigna. */
type Area = string | null;

const MAX_CAPTURAS = MAX_CAPTURAS_ENVIO;

/** Lo que emite el modal: la solicitud y las capturas que se suben después de crearla. */
export interface NuevaSolicitud {
  payload: CrearSolicitudPayload;
  capturas: File[];
}

interface FilaArea {
  key: string;
  k: Area;
  sub: string | null;
  t: string;
  d: string;
  icono: string;
  on: boolean;
  /** El área tiene elegida una de sus secciones. */
  parcial: boolean;
}

const IMPACTOS = Object.entries(IMPACTO_SOLICITUD) as [ImpactoSolicitud, string][];

const MAX_TITULO = 80;

/**
 * Modal «Nueva solicitud» del handoff: a la izquierda el tipo (selector con
 * ejemplos para empezar) y el título con su descripción y guías; a la derecha
 * el área, con buscador y sugerencia por lo que se escribió.
 *
 * @remarks
 * - Los tipos son los cuatro del backend, no los tres del prototipo.
 * - Áreas y secciones salen de `GET /mis-solicitudes/areas` (la página las
 *   pasa en `areas`): un área, o una de sus secciones, o «No estoy seguro».
 * - «¿Qué tanto te afecta?» va en `impacto`.
 * - «Adjuntar»: hasta 4 capturas (PNG, JPG, WebP o GIF de 5 MB). Se suben
 *   después de crear la solicitud, así que van aparte del payload.
 */
@Component({
  selector: 'app-modal-nueva-solicitud',
  standalone: true,
  imports: [IcComponent, MarcoModalComponent, PieModalComponent, ModalCabeceraComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <app-marco-modal etiqueta="Nueva solicitud" [ancho]="920" (cerrar)="cerrar.emit()">
      <app-modal-cabecera
        [icono]="ui().icono"
        [iconoBg]="ui().bg"
        [iconoColor]="ui().fg"
        titulo="Nueva solicitud"
        [referencia]="ref()"
        [sub]="def().sub"
        (cerrar)="cerrar.emit()"
      />
      <div
        class="grid min-h-0 flex-1 grid-cols-[minmax(0,1.35fr)_minmax(260px,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden"
      >
        <div
          class="box-border flex h-full min-h-0 min-w-0 flex-col gap-5 overflow-y-auto p-[18px] [scrollbar-width:thin]"
        >
          <div class="flex flex-col gap-2.5">
            <span class="text-[12.5px] font-semibold text-[#111827]">¿Qué necesitas?</span>
            <span class="-mt-1.5 text-xs leading-[17px] text-[#6b7280]"
              >Elige el tipo para que llegue a la persona correcta del equipo.</span
            >
            <div class="relative grid grid-cols-4 rounded-xl bg-[#f4f4f4] p-1">
              <span
                class="absolute inset-y-1 left-1 w-[calc((100%-8px)/4)] rounded-[9px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.08),0_4px_12px_-6px_rgba(0,0,0,.2)] transition-transform duration-[380ms] ease-[cubic-bezier(.3,1.3,.5,1)]"
                [style.transform]="'translateX(' + indice() * 100 + '%)'"
              ></span>
              @for (t of tipos; track t.k) {
                @let on = tipo() === t.k;
                @let u = tiposUi[t.k];
                <button
                  type="button"
                  (click)="tipo.set(t.k)"
                  [title]="t.d"
                  class="relative z-[1] flex h-10 min-w-0 cursor-pointer items-center justify-center gap-[7px] rounded-[9px] px-1 text-[13px] font-medium transition-colors duration-200"
                  [style.color]="on ? '#111827' : '#6b7280'"
                >
                  <span
                    class="flex size-[22px] shrink-0 items-center justify-center rounded-[7px] transition-transform duration-[350ms] ease-[cubic-bezier(.3,1.6,.5,1)]"
                    [style.background]="u.bg"
                    [style.color]="u.fg"
                    [style.transform]="on ? 'scale(1.08)' : 'none'"
                    ><app-ic [nombre]="u.icono" [size]="13"
                  /></span>
                  <span class="truncate">{{ u.t }}</span>
                </button>
              }
            </div>
            <div
              class="flex flex-col gap-2 rounded-xl py-3 pl-3.5 pr-3 transition-colors duration-300"
              [style.background]="ui().bg"
            >
              <span class="text-pretty text-[12.5px] leading-[18px] text-[#374151]"
                ><strong class="font-semibold" [style.color]="ui().fg">{{ ui().t }}.</strong>
                {{ def().d }}</span
              >
              <div class="flex flex-wrap gap-1.5">
                <span class="flex items-center text-[11.5px] text-[#6b7280]">Empieza con:</span>
                @for (x of def().ejemplos; track tipo() + x) {
                  <button
                    type="button"
                    (click)="usarEjemplo(x)"
                    class="flex h-[26px] animate-[pop_.25s_both] cursor-pointer items-center gap-[5px] rounded-full bg-white px-2.5 text-xs text-[#111827] shadow-[0_0_0_1px_rgba(0,0,0,.06)] hover:shadow-[0_0_0_1px_#303030]"
                    [style.animation-delay]="$index * 50 + 'ms'"
                  >
                    <app-ic nombre="corner-down-right" [size]="12" class="text-[#9ca3af]" />{{ x }}
                  </button>
                }
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="flex items-baseline justify-between gap-2"
              ><span class="text-[12.5px] font-semibold text-[#111827]">Tu solicitud</span
              ><span
                class="text-[11px] tabular-nums"
                [style.color]="titulo().length > maxTitulo - 10 ? '#b45309' : '#9ca3af'"
                >{{ titulo().length }} / {{ maxTitulo }}</span
              ></span
            >
            <span class="-mt-1.5 text-xs leading-[17px] text-[#6b7280]"
              >Un buen título y un ejemplo real nos ayudan a resolverla más rápido.</span
            >
            <div
              class="flex flex-col rounded-[14px] bg-white shadow-[0_0_0_1px_#e5e5e5] transition-shadow duration-200 focus-within:shadow-[0_0_0_1px_#303030,0_0_0_4px_rgba(48,48,48,.07)]"
            >
              <input
                #campoTitulo
                [value]="titulo()"
                (input)="titulo.set($any($event.target).value)"
                [attr.maxlength]="maxTitulo"
                placeholder="Un título corto y claro"
                class="h-[46px] border-0 bg-transparent px-3.5 font-display text-[15.5px] font-semibold text-[#111827] outline-none"
              />
              <div class="mx-3.5 h-px bg-[#f1f1f1]"></div>
              <textarea
                #campoDesc
                [value]="descripcion()"
                (input)="descripcion.set($any($event.target).value)"
                rows="4"
                maxlength="4000"
                [placeholder]="def().ph"
                class="max-h-[220px] min-h-24 resize-none border-0 bg-transparent px-3.5 py-2.5 text-[13.5px] leading-[21px] text-[#111827] outline-none [field-sizing:content]"
              ></textarea>
              <div
                class="flex flex-wrap items-center gap-1.5 border-t border-[#f4f4f4] px-2.5 py-2"
              >
                @for (g of guias; track g.pre) {
                  <button
                    type="button"
                    (click)="usarGuia(g.pre)"
                    title="Agregar a la descripción"
                    class="flex h-[26px] cursor-pointer items-center gap-[5px] rounded-full bg-[#f4f4f4] px-2.5 text-xs text-[#4b5563] transition-colors duration-200 hover:bg-[#ececec] hover:text-[#111827]"
                  >
                    <app-ic [nombre]="g.icono" [size]="13" />{{ g.t }}
                  </button>
                }
                <input
                  #campoArchivos
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  class="hidden"
                  (change)="elegirCapturas($any($event.target))"
                />
                <button
                  type="button"
                  (click)="campoArchivos.click()"
                  [disabled]="capturas().length >= maxCapturas"
                  title="Adjuntar captura (hasta 4, de 5 MB)"
                  class="ml-auto flex h-7 cursor-pointer items-center gap-[5px] rounded-full px-2.5 text-xs text-[#4b5563] hover:bg-[#f4f4f4] hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <app-ic nombre="paperclip" [size]="14" />{{ textoAdjuntar() }}
                </button>
              </div>
              @if (capturas().length) {
                <div class="flex flex-wrap gap-2 border-t border-[#f4f4f4] px-2.5 py-2">
                  @for (c of capturas(); track c.url) {
                    <span
                      class="group relative size-14 animate-[pop_.25s_both] overflow-hidden rounded-[10px] bg-[#f4f4f4] shadow-[0_0_0_1px_#ececec]"
                      [title]="c.file.name"
                    >
                      <img [src]="c.url" [alt]="c.file.name" class="size-full object-cover" />
                      <button
                        type="button"
                        (click)="quitarCaptura(c.url)"
                        title="Quitar"
                        class="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <app-ic nombre="x" [size]="11" />
                      </button>
                    </span>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <div
          class="box-border flex h-full min-h-0 min-w-0 flex-col gap-5 overflow-y-auto border-l border-[#f1f1f1] bg-[#fcfcfc] p-[18px] [scrollbar-width:thin]"
        >
          <div class="flex min-h-0 flex-[1_1_0] flex-col gap-2">
            <span class="text-[12.5px] font-semibold text-[#111827]">Área</span>
            <span class="-mt-1.5 text-xs leading-[17px] text-[#6b7280]"
              >¿En qué parte de Goods lo notas? Así la asignamos al equipo indicado.</span
            >
            <div class="flex items-center gap-1.5">
              <label
                class="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[#ececec] px-3 transition-[background-color,box-shadow] duration-200 focus-within:bg-white focus-within:shadow-[0_0_0_1px_#d4d4d4]"
              >
                <app-ic nombre="search" [size]="15" class="text-[#8a8a8a]" />
                <input
                  [value]="buscarArea()"
                  (input)="buscarArea.set($any($event.target).value); foco.set(0)"
                  (keydown)="teclaArea($event)"
                  placeholder="Busca un área de Goods"
                  class="min-w-0 flex-1 border-0 bg-transparent py-2 text-[13px] text-[#111827] outline-none"
                />
                @if (buscarArea()) {
                  <button type="button" (click)="buscarArea.set('')" class="flex text-[#8a8a8a]">
                    <app-ic nombre="x" [size]="13" />
                  </button>
                }
              </label>
              <span
                [title]="nombreArea()"
                class="flex size-[30px] shrink-0 animate-[pop_.3s_cubic-bezier(.2,.8,.2,1)_both] items-center justify-center rounded-full bg-[#303030] text-white"
                ><app-ic [nombre]="subElegida()?.icono ?? iconoDe(area())" [size]="14"
              /></span>
            </div>
            @if (sugerida(); as sg) {
              <button
                type="button"
                (click)="elegirArea(sg.codigo, null)"
                class="flex animate-[st-fade-in-up_.25s_both] cursor-pointer items-center gap-2 rounded-[10px] bg-[#eef9f8] px-3 py-2 text-left text-xs text-[#00605b] hover:bg-[#e3f5f3]"
              >
                <app-ic nombre="sparkles" [size]="14" /><span class="min-w-0 flex-1"
                  >Por tu título parece de
                  <strong class="font-semibold">{{ sg.nombre }}</strong></span
                ><span class="font-semibold">Usar</span>
              </button>
            }
            <div
              role="radiogroup"
              aria-label="Área"
              class="flex min-h-[72px] flex-[1_1_0] flex-col items-center gap-0.5 overflow-y-auto px-3 [scrollbar-width:thin]"
            >
              @for (a of areas(); track a.key; let i = $index) {
                @let on = a.on;
                @let marca = a.on || a.parcial;
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="on"
                  (click)="elegirArea(a.k, a.sub)"
                  (mouseenter)="foco.set(i)"
                  [title]="a.d"
                  class="group box-border flex h-[34px] w-full max-w-[300px] shrink-0 animate-[st-fade-in_.2s_both] cursor-pointer items-center rounded-lg pr-1.5 text-left"
                  [style.padding-left]="a.sub ? '28px' : '0px'"
                  [style.background]="foco() === i && buscarArea() ? '#f1f1f1' : null"
                >
                  <span
                    class="flex h-[18px] shrink-0 items-center justify-center overflow-hidden rounded-[5px] transition-[width,margin,opacity,transform,background-color] duration-[260ms] ease-[cubic-bezier(.2,.8,.2,1)]"
                    [class]="
                      marca
                        ? 'mr-[9px] w-[18px] bg-[#303030] opacity-100'
                        : 'mr-0 w-0 -translate-x-1.5 scale-[.8] bg-white opacity-0 shadow-[inset_0_0_0_1.5px_#d4d4d4] group-hover:mr-[9px] group-hover:w-[18px] group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100'
                    "
                    ><app-ic
                      [nombre]="a.parcial ? 'minus' : 'check'"
                      [size]="12"
                      class="text-white transition-[opacity,transform] duration-200"
                      [style.opacity]="marca ? 1 : 0"
                      [style.transform]="marca ? 'none' : 'scale(.5)'"
                  /></span>
                  <span
                    class="mr-[9px] flex size-6 shrink-0 items-center justify-center rounded-[7px] text-[#6b7280]"
                    [style.background]="a.sub ? 'transparent' : '#efefef'"
                    ><app-ic [nombre]="a.icono" [size]="13"
                  /></span>
                  <span
                    class="min-w-0 flex-1 truncate text-[12.5px]"
                    [style.font-weight]="on ? 600 : a.sub ? 400 : 500"
                    [style.color]="a.sub && !on ? '#4b5563' : '#111827'"
                    >{{ a.t }}</span
                  >
                </button>
              }
              @if (!areasApi().length) {
                <span class="px-2.5 py-3.5 text-center text-xs text-[#9ca3af]"
                  >Cargando áreas…</span
                >
              } @else if (areas().length === 1 && buscarArea()) {
                <span class="px-2.5 py-3.5 text-center text-xs text-[#6b7280]"
                  >No hay áreas con ese nombre</span
                >
              }
            </div>
          </div>
          <div class="flex shrink-0 flex-col gap-2">
            <span class="text-[12.5px] font-semibold text-[#111827]">¿Qué tanto te afecta?</span>
            <span class="-mt-1.5 text-xs leading-[17px] text-[#6b7280]"
              >Lo usamos para priorizar; no cambia el orden en que respondemos.</span
            >
            <div
              role="radiogroup"
              class="grid grid-cols-3 gap-1 rounded-[10px] bg-[#f4f4f4] p-[3px]"
            >
              @for (i of impactos; track i[0]) {
                @let on = impacto() === i[0];
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="on"
                  (click)="impacto.set(i[0])"
                  class="h-8 cursor-pointer rounded-lg text-[12.5px] font-medium transition-[background-color,color,box-shadow] duration-200"
                  [class]="
                    on
                      ? 'bg-white text-[#111827] shadow-[0_1px_2px_rgba(0,0,0,.1)]'
                      : 'text-[#6b7280] hover:text-[#111827]'
                  "
                >
                  {{ i[1] }}
                </button>
              }
            </div>
          </div>
        </div>
      </div>
      <app-pie-modal
        [texto]="lista() ? 'Te respondemos en 2 días hábiles.' : falta()"
        [accion]="creando() ? 'Enviando…' : 'Enviar solicitud'"
        icono="send"
        [deshabilitado]="!lista() || creando()"
        (cancelar)="cerrar.emit()"
        (aceptar)="enviar()"
      />
    </app-marco-modal>
  `,
})
export class ModalNuevaSolicitudComponent {
  /** Número que tendrá (solo de referencia en la cabecera). */
  readonly siguienteId = input(1);
  readonly creando = input(false);
  /** `GET /mis-solicitudes/areas`; vacío mientras carga. */
  readonly areasApi = input<AreaSolicitud[]>([], { alias: 'areas' });
  readonly crear = output<NuevaSolicitud>();
  readonly cerrar = output<void>();

  protected readonly tipos = TIPOS;
  protected readonly tiposUi = TIPO_UI;
  protected readonly guias = GUIAS;
  protected readonly impactos = IMPACTOS;
  protected readonly maxCapturas = MAX_CAPTURAS;
  private readonly alerta = inject(AlertaService);
  protected readonly maxTitulo = MAX_TITULO;

  protected readonly tipo = signal<TipoSolicitud>('ajuste_modulo');
  protected readonly titulo = signal('');
  protected readonly descripcion = signal('');
  protected readonly area = signal<Area>(null);
  /** `clave` de la sección del área, si se eligió una. */
  protected readonly sub = signal<string | null>(null);
  protected readonly impacto = signal<ImpactoSolicitud>('medio');
  /** Capturas elegidas, con su vista previa (`URL.createObjectURL`). */
  protected readonly capturas = signal<{ file: File; url: string }[]>([]);
  protected readonly buscarArea = signal('');
  /** Fila resaltada con ↑ ↓ mientras se busca. */
  protected readonly foco = signal(0);
  private readonly campoTitulo = viewChild<ElementRef<HTMLInputElement>>('campoTitulo');
  private readonly campoDesc = viewChild<ElementRef<HTMLTextAreaElement>>('campoDesc');

  protected readonly ui = computed(() => TIPO_UI[this.tipo()]);
  protected readonly def = computed(() => TIPOS.find((t) => t.k === this.tipo())!);
  protected readonly indice = computed(() => TIPOS.findIndex((t) => t.k === this.tipo()));
  protected readonly ref = computed(() => refDe(this.siguienteId()));

  /**
   * Las áreas con sus secciones debajo (sangradas). Al buscar, un área sale
   * si coincide ella o alguna de sus secciones.
   */
  protected readonly areas = computed<FilaArea[]>(() => {
    const q = normalizar(this.buscarArea().trim());
    const cumple = (t: string) => !q || normalizar(t).includes(q);
    const area = this.area();
    const sub = this.sub();
    const filas: FilaArea[] = [];
    for (const ar of this.areasApi()) {
      const d = AREA_D[ar.codigo] ?? '';
      const propia = cumple(`${ar.nombre} ${d}`);
      const hijas = propia ? ar.secciones : ar.secciones.filter((x) => cumple(x.nombre));
      if (!propia && !hijas.length) continue;
      filas.push({
        key: ar.codigo,
        k: ar.codigo,
        sub: null,
        t: ar.nombre,
        d,
        icono: ICONO_AREA[ar.codigo] ?? 'layout-grid',
        on: area === ar.codigo && !sub,
        parcial: area === ar.codigo && !!sub,
      });
      for (const x of hijas)
        filas.push({
          key: `${ar.codigo}:${x.clave}`,
          k: ar.codigo,
          sub: x.clave,
          t: x.nombre,
          d: `${ar.nombre} › ${x.nombre}`,
          icono: iconoSeccion(ar.codigo, x.clave),
          on: area === ar.codigo && sub === x.clave,
          parcial: false,
        });
    }
    if (cumple('No estoy seguro'))
      filas.push({
        key: 'otro',
        k: null,
        sub: null,
        t: 'No estoy seguro',
        d: 'El equipo la asigna por ti',
        icono: 'help-circle',
        on: area === null,
        parcial: false,
      });
    return filas;
  });
  private readonly areaElegida = computed(
    () => this.areasApi().find((a) => a.codigo === this.area()) ?? null,
  );
  protected readonly subElegida = computed(() => {
    const a = this.areaElegida();
    const s = this.sub();
    const x = a && s ? a.secciones.find((y) => y.clave === s) : null;
    return x && a ? { ...x, icono: iconoSeccion(a.codigo, x.clave) } : null;
  });
  protected readonly nombreArea = computed(() => {
    const a = this.areaElegida();
    if (!a) return 'No estoy seguro';
    const s = this.subElegida();
    return `${a.nombre}${s ? ' › ' + s.nombre : ''}`;
  });
  protected readonly textoAdjuntar = computed(() => {
    const n = this.capturas().length;
    return n ? (n === 1 ? '1 captura' : `${n} capturas`) : 'Adjuntar';
  });
  /** Área que sugiere lo escrito, si no es la que ya está elegida. */
  protected readonly sugerida = computed(() => {
    const texto = `${this.titulo()} ${this.descripcion()}`;
    const k = AREA_KW.find(([, re]) => re.test(texto))?.[0] ?? null;
    if (!k || k === this.area()) return null;
    return this.areasApi().find((a) => a.codigo === k) ?? null;
  });
  /** Los mínimos de `CrearSolicitudDto`: 5 caracteres de título y 15 de descripción. */
  protected readonly lista = computed(
    () => this.titulo().trim().length >= 5 && this.descripcion().trim().length >= 15,
  );
  protected readonly falta = computed(() =>
    this.titulo().trim().length < 5
      ? 'Escribe un título de al menos 5 caracteres'
      : 'Cuéntanos un poco más en la descripción',
  );

  constructor() {
    afterNextRender(() => this.campoTitulo()?.nativeElement.focus());
    inject(DestroyRef).onDestroy(() => this.capturas().forEach((c) => URL.revokeObjectURL(c.url)));
  }

  /** Suma las imágenes válidas hasta 4; avisa de las que no entran. */
  protected elegirCapturas(el: HTMLInputElement): void {
    const files = [...(el.files ?? [])];
    el.value = '';
    const { entran, fuera } = filtrarCapturas(files, MAX_CAPTURAS - this.capturas().length);
    if (fuera)
      this.alerta.mostrar({
        estado: 'warning',
        titulo: 'Algunas capturas no se agregaron',
        texto: `Hasta ${MAX_CAPTURAS} imágenes PNG, JPG, WebP o GIF de 5 MB cada una.`,
      });
    if (entran.length)
      this.capturas.update((cs) => [
        ...cs,
        ...entran.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ]);
  }

  protected quitarCaptura(url: string): void {
    URL.revokeObjectURL(url);
    this.capturas.update((cs) => cs.filter((c) => c.url !== url));
  }

  protected iconoDe(a: Area): string {
    return a ? (ICONO_AREA[a] ?? 'layout-grid') : 'help-circle';
  }

  protected elegirArea(k: Area, sub: string | null): void {
    this.area.set(k);
    this.sub.set(sub);
    this.buscarArea.set('');
  }

  protected usarEjemplo(t: string): void {
    this.titulo.set(t.slice(0, MAX_TITULO));
    this.campoTitulo()?.nativeElement.focus();
  }

  /** Agrega el comienzo de la guía en una línea nueva y deja el cursor al final. */
  protected usarGuia(pre: string): void {
    const d = this.descripcion();
    this.descripcion.set(d + (d && !d.endsWith('\n') ? '\n' : '') + pre);
    const el = this.campoDesc()?.nativeElement;
    if (!el) return;
    el.value = this.descripcion();
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }

  protected teclaArea(e: KeyboardEvent): void {
    const n = this.areas().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.foco.update((f) => Math.max(0, Math.min(n - 1, f + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const a = this.areas()[this.foco()];
      if (a) this.elegirArea(a.k, a.sub);
    }
  }

  protected enviar(): void {
    if (!this.lista() || this.creando()) return;
    const area = this.area();
    this.crear.emit({
      payload: {
        tipo: this.tipo(),
        moduloCodigo: area ?? undefined,
        seccion: area ? (this.sub() ?? undefined) : undefined,
        impacto: this.impacto(),
        titulo: this.titulo().trim(),
        descripcion: this.descripcion().trim(),
      },
      capturas: this.capturas().map((c) => c.file),
    });
  }
}
