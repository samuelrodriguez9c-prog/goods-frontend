import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../shared/catalogo.store';
import { cop, fecha, num, pl } from '../../../shared/formato';
import { ATRASO } from '../../../shared/proveedores.util';
import { icono } from '../../../shared/ui/iconos';
import { FichaCompra, inicioDia } from '../compras.modelo';

/** Color del punto de cada evento de la historia. */
type TonoEvento = 'normal' | 'esperando' | 'atrasada' | 'recibida' | 'cancelada';
interface Evento {
  titulo: string;
  texto: string;
  fecha: string;
  tono: TonoEvento;
  detalle: { t: string; v: string }[];
}

const PUNTO: Record<TonoEvento, string> = {
  normal: 'shadow-[0_0_0_2px_#303030]',
  esperando: 'shadow-[0_0_0_2px_#8a5a00]',
  atrasada: 'shadow-[0_0_0_2px_#b42318]',
  recibida: 'shadow-[0_0_0_2px_#087b5d]',
  cancelada: 'shadow-[0_0_0_2px_#6b7280]',
};
/** Barra de duración según el estado. */
const BARRA = {
  recibida: { relleno: 'bg-[#29845a]', anillo: 'shadow-[0_0_0_2px_#29845a]' },
  cancelada: { relleno: 'bg-[#c4c4c4]', anillo: 'shadow-[0_0_0_2px_#c4c4c4]' },
  atrasada: { relleno: 'bg-[#d82c0d]', anillo: 'shadow-[0_0_0_2px_#d82c0d]' },
  pendiente: { relleno: 'bg-[#ffb904]', anillo: 'shadow-[0_0_0_2px_#ffb904]' },
};

/**
 * Pestaña "Actividad": cuánto tardó (o lleva) la compra frente al promedio del
 * proveedor y la historia de eventos (con detalle desplegable).
 */
@Component({
  selector: 'app-pestana-actividad',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[fade-in-up_.22s_ease-out] flex-col gap-5.5' },
  template: `
    @if (duracion(); as du) {
      <div class="flex flex-col gap-3.5">
        <div class="flex items-end justify-between gap-3">
          <span class="flex flex-col gap-0.5">
            <span class="text-[11.5px] font-medium" [class]="du.atrasada ? 'text-[#b42318]' : 'text-[#6b7280]'">{{ du.estado }}</span>
            <span class="font-[Archivo] text-[30px] leading-[32px] font-semibold tracking-[-0.03em] text-[#111827]">{{ du.cifra }}</span>
          </span>
          <span class="max-w-55 text-right text-[12px] leading-[17px] text-pretty text-[#6b7280]">{{ du.comparacion }}</span>
        </div>
        <div class="relative h-7.5">
          <span class="absolute top-[9px] right-0 left-0 h-2 rounded-full bg-[#f3f3f3]"></span>
          <span class="absolute top-[9px] left-0 h-2 origin-left animate-[barra-crece_.9s_cubic-bezier(.2,.8,.2,1)_both] rounded-full"
            [class]="du.barra.relleno" [style.width.%]="du.ancho"></span>
          @if (du.enCurso) {
            <span class="absolute top-1.5 -ml-[7px] size-3.5 animate-[gp-latido_2s_ease-in-out_infinite] rounded-full bg-white"
              [class]="du.barra.anillo" [style.left.%]="du.ancho"></span>
          }
          @if (du.promedio; as pr) {
            <span [title]="pr.texto" class="absolute top-[3px] h-5 w-0.5 rounded-xs bg-[#111827]" [style.left.%]="pr.posicion"></span>
            <span class="absolute top-6 [transform:translateX(-50%)] text-[10px] font-medium whitespace-nowrap text-[#111827]" [style.left.%]="pr.posicion">{{ pr.texto }}</span>
          }
          @if (du.posicionAtraso != null) {
            <span title="Se considera atrasada" class="absolute top-[5px] h-4 w-[1px] border-l-[1.5px] border-dashed border-l-[#d82c0d]"
              [style.left.%]="du.posicionAtraso"></span>
          }
        </div>
        <div class="mt-1.5 flex justify-between text-[11px] text-[#9ca3af]"><span>{{ du.inicio }}</span><span>{{ du.fin }}</span></div>
      </div>
    }
    @if (historia().length) {
      <div class="flex flex-col">
        <span class="px-0.5 pb-2 text-[11px] font-semibold tracking-[.06em] text-[#9ca3af] uppercase">Historia</span>
        @for (x of historia(); track x.titulo; let k = $index, n = $count) {
          @let abierto = abiertoEvento() === x.titulo && x.detalle.length > 0;
          <div (mouseenter)="eventoEncima.set(x.titulo)" (mouseleave)="eventoEncima() === x.titulo && eventoEncima.set(null)"
            class="relative grid animate-[mov-in_360ms_cubic-bezier(.2,.8,.2,1)_both] grid-cols-[22px_minmax(0,1fr)] gap-3.5"
            [style.animation-delay.ms]="(n - 1 - k) * 40">
            <span class="relative flex justify-center">
              <span class="absolute top-0 bottom-0 w-[1px] bg-[#ececec]"></span>
              <span class="relative mt-4 size-[9px] rounded-full bg-white transition-[transform] duration-200 ease-[cubic-bezier(.2,.8,.2,1)]" [class]="punto[x.tono]"></span>
            </span>
            <div class="flex flex-col rounded-xl transition-[background-color] duration-200 ease-[ease]"
              [class]="eventoEncima() === x.titulo || abierto ? 'bg-[#fafafa]' : 'bg-transparent'">
              <button type="button" (click)="alternar(x)" class="flex items-start gap-2.5 pt-2.5 pr-2.5 pb-2.5 pl-1 text-left"
                [class]="x.detalle.length ? 'cursor-pointer' : 'cursor-default'">
                <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span class="flex items-center gap-2">
                    <span class="text-[13px] font-semibold text-[#111827]">{{ x.titulo }}</span>
                    <span class="text-[11px] text-[#9ca3af]">{{ x.fecha }}</span>
                  </span>
                  <span class="text-[12px] leading-[17px] break-words text-[#6b7280]">{{ x.texto }}</span>
                </span>
                @if (x.detalle.length) {
                  <tabler-icon [icon]="icono('chevron-down')" [size]="14" [stroke]="2"
                    class="mt-[3px] text-[#9ca3af] transition-[rotate] duration-250 ease-[cubic-bezier(.2,.8,.2,1)]" [class.rotate-180]="abierto" />
                }
              </button>
              <div class="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]" [class]="abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
                <div class="min-h-0 overflow-hidden">
                  <div class="flex flex-col gap-[5px] pr-2.5 pb-3 pl-1">
                    @for (y of x.detalle; track $index) {
                      <div class="flex items-baseline gap-2 text-[12px]">
                        <span class="truncate text-[#374151]">{{ y.t }}</span>
                        <span class="flex-1 [transform:translateY(-3px)] border-b border-dotted border-b-[#d4d4d4]"></span>
                        <span class="font-semibold whitespace-nowrap text-[#111827] tabular-nums">{{ y.v }}</span>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    }
    @if (ficha().esNueva) {
      <div class="rounded-2xl border border-dashed border-[#e0e0e0] p-7 text-center text-[13px] text-[#6b7280]">La actividad aparece cuando guardes la compra.</div>
    }
  `,
})
export class PestanaActividadComponent {
  private readonly catalogo = inject(CatalogoStore);
  readonly ficha = input.required<FichaCompra>();
  /** Título del evento desplegado. */
  readonly abiertoEvento = model<string | null>(null);

  protected readonly icono = icono;
  protected readonly punto = PUNTO;
  protected readonly eventoEncima = signal<string | null>(null);
  private readonly nombre = (id: number) => this.catalogo.producto(id)?.nombre ?? '?';

  /** Duración: desde la fecha de la compra hasta recibirla (o hasta hoy). */
  protected readonly duracion = computed(() => {
    const { compra: c, esNueva, estado, atrasada } = this.ficha();
    if (esNueva || !c) return null;
    const fin = c.recibidaEn ? new Date(c.recibidaEn).getTime() : this.catalogo.hoy().getTime();
    const dias = Math.max(1, (fin - inicioDia(c.fecha)) / 864e5);
    const anteriores = this.catalogo.compras().filter((x) => x.proveedorId === c.proveedorId && x.estado === 'recibida' && x.recibidaEn && x.id !== c.id);
    const promedio = anteriores.length
      ? anteriores.reduce((a, x) => a + Math.max(0, (new Date(x.recibidaEn!).getTime() - inicioDia(x.fecha)) / 864e5), 0) / anteriores.length
      : null;
    const escala = Math.max(dias, (promedio ?? 0) * 1.25, ATRASO);
    const recibida = estado === 'recibida', pendiente = estado === 'pendiente';
    return {
      ancho: (dias / escala) * 100,
      barra: BARRA[recibida ? 'recibida' : estado === 'cancelada' ? 'cancelada' : atrasada ? 'atrasada' : 'pendiente'],
      enCurso: pendiente,
      promedio: promedio != null
        ? { posicion: (promedio / escala) * 100, texto: 'Promedio ' + (promedio < 1 ? 'mismo día' : pl(Math.round(promedio), 'día', 'días')) }
        : null,
      posicionAtraso: pendiente ? (ATRASO / escala) * 100 : null,
      cifra: recibida ? (dias < 1 ? 'Mismo día' : pl(Math.round(dias), 'día', 'días')) : pendiente ? pl(Math.round(dias), 'día', 'días') : '—',
      estado: recibida ? 'Tardó en llegar' : pendiente ? (atrasada ? 'Atrasada' : 'En camino') : 'Cancelada',
      atrasada: pendiente && atrasada,
      comparacion: promedio == null
        ? 'Primera compra recibida de este proveedor'
        : recibida
          ? dias <= promedio ? 'Llegó ' + (promedio - dias < 0.5 ? 'en su tiempo habitual' : 'antes de lo habitual') : 'Tardó más de lo habitual'
          : 'Suele entregar en ' + (promedio < 1 ? 'el mismo día' : pl(Math.round(promedio), 'día', 'días')),
      inicio: fecha(c.fecha),
      fin: recibida ? fecha(c.recibidaEn!) : pendiente ? 'hoy' : '',
    };
  });

  protected readonly historia = computed<Evento[]>(() => {
    const { compra: c, esNueva, proveedor: p, atrasada, dias } = this.ficha();
    if (esNueva || !c) return [];
    const eventos: Evento[] = [{
      titulo: 'Compra creada', texto: (p ? p.nombre : '') + ' · ' + cop(this.catalogo.totalCompra(c)), fecha: fecha(c.fecha), tono: 'normal',
      detalle: c.items.map((it) => ({ t: this.nombre(it.productoId), v: it.cantidad + ' × ' + cop(it.precioUnitario) })),
    }];
    if (c.archivoNombre) eventos.push({ titulo: 'Factura adjunta', texto: c.archivoNombre, fecha: fecha(c.fecha), tono: 'normal', detalle: [] });
    if (c.estado === 'pendiente') {
      eventos.push({
        titulo: atrasada ? 'Atrasada' : 'Esperando la entrega', texto: dias === 0 ? 'Creada hoy' : 'Lleva ' + dias + ' días sin recibir', fecha: 'Ahora',
        tono: atrasada ? 'atrasada' : 'esperando', detalle: [],
      });
    }
    if (c.estado === 'recibida') {
      const movimientos = this.catalogo.movimientos().filter((m) => m.referenciaTipo === 'compra' && m.referenciaId === c.id);
      const detalle = movimientos.length
        ? movimientos.map((m) => ({ t: this.nombre(m.productoId), v: '+' + m.cantidad + ' u' }))
        : c.items.map((it) => ({ t: this.nombre(it.productoId), v: '+' + it.cantidad + ' u' }));
      eventos.push({
        titulo: 'Recibida · stock actualizado',
        texto: pl(movimientos.length || c.items.length, 'entrada', 'entradas') + ' en Inventario · +' + num(this.catalogo.unidadesCompra(c)) + ' u',
        fecha: c.recibidaEn ? fecha(c.recibidaEn) : '', tono: 'recibida', detalle,
      });
    }
    if (c.estado === 'cancelada') eventos.push({ titulo: 'Cancelada', texto: 'No sumó stock', fecha: '', tono: 'cancelada', detalle: [] });
    if (c.notas) eventos.push({ titulo: 'Nota', texto: c.notas, fecha: '', tono: 'normal', detalle: [] });
    return eventos;
  });

  protected alternar(x: Evento): void {
    if (!x.detalle.length) return;
    this.abiertoEvento.update((t) => (t === x.titulo ? null : x.titulo));
  }
}
