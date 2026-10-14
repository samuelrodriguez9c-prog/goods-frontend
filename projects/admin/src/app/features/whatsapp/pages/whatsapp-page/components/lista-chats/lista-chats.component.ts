import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconClockPause,
  IconHourglassLow,
  IconMessageDots,
  IconMessages,
  IconSearch,
  IconSparkles,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { Conversacion } from '../../../../../../core/whatsapp/whatsapp.model';
import { FiltroBandeja } from '../../../../shared/whatsapp-modulo.store';
import {
  atiendeIa,
  claseAvatar,
  cuandoLista,
  estadoVentana,
  fraccionVentana,
  iniciales,
  nombreChat,
  pasaFiltro,
  prefijoUltimo,
  restante,
  ventanaFmt,
} from '../../bandeja.utils';
import { IaMarcaComponent } from '../../../../../../shared/ui/ia-marca/ia-marca.component';

const FILTROS: { k: FiltroBandeja; label: string; icono: typeof IconMessages }[] = [
  { k: 'todos', label: 'Todos', icono: IconMessages },
  { k: 'sin', label: 'Sin responder', icono: IconMessageDots },
  { k: 'vence', label: 'Por vencer', icono: IconHourglassLow },
  { k: 'ia', label: 'IA', icono: IconSparkles },
];

/**
 * Columna izquierda de la Bandeja: buscador, botón de filtros (los mismos de
 * las métricas de la cabecera), contador y los chats con el anillo de la
 * ventana de 24 h, la insignia de la IA y los avisos ("La IA te lo pasó",
 * "Cierra en…", "Ventana cerrada").
 */
@Component({
  selector: 'app-lista-chats',
  imports: [IaMarcaComponent, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lista-chats.component.html',
  host: {
    class: 'flex flex-col shrink-0 overflow-hidden rounded-[14px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,.04),0_1px_2px_rgba(0,0,0,.04)]',
    '(document:click)': 'filtrosAbiertos.set(false)',
    '(document:keydown.escape)': 'filtrosAbiertos.set(false)',
  },
})
export class ListaChatsComponent {
  readonly chats = input.required<Conversacion[]>();
  /** Total de chats del negocio (el backend pagina la lista). */
  readonly total = input(0);
  readonly abiertoId = input<number | null>(null);
  readonly filtro = input<FiltroBandeja>('todos');
  readonly busca = input('');
  readonly ahora = input(Date.now());
  readonly asistenteActivo = input(false);
  readonly hayMas = input(false);
  /** Chats donde la IA está escribiendo una respuesta ahora. */
  readonly escribiendo = input<number[]>([]);

  readonly elegir = output<Conversacion>();
  readonly cambiarFiltro = output<FiltroBandeja>();
  readonly cambiarBusca = output<string>();
  readonly masChats = output<void>();

  protected readonly i = {
    buscar: IconSearch,
    x: IconX,
    filtros: IconAdjustmentsHorizontal,
    check: IconCheck,
    ia: IconSparkles,
    vence: IconHourglassLow,
    cerrada: IconClockPause,
  };

  protected readonly filtrosAbiertos = signal(false);

  protected readonly visibles = computed(() => {
    const f = this.filtro();
    const ia = this.asistenteActivo();
    const ahora = this.ahora();
    return this.chats().filter((c) => pasaFiltro(c, f, ia, ahora));
  });

  protected readonly opciones = computed(() => {
    const ia = this.asistenteActivo();
    const ahora = this.ahora();
    return FILTROS.map((f) => {
      const n = f.k === 'todos' ? this.total() : this.chats().filter((c) => pasaFiltro(c, f.k, ia, ahora)).length;
      const alerta = (f.k === 'vence' || f.k === 'sin') && n > 0;
      return { ...f, n, on: this.filtro() === f.k, alerta };
    });
  });

  protected readonly chip = computed(() => FILTROS.find((f) => f.k === this.filtro())?.label ?? '');

  protected readonly conteo = computed(() => {
    const total = this.total();
    const v = this.visibles().length;
    return this.filtro() === 'todos' || v === total ? `${total} ${total === 1 ? 'chat' : 'chats'}` : `${v} de ${total} chats`;
  });

  protected readonly filas = computed(() => {
    const ahora = this.ahora();
    const ia = this.asistenteActivo();
    return this.visibles().map((c) => {
      const st = estadoVentana(c, ahora);
      const r = restante(c, ahora);
      const aviso: { texto: string; clase: string; icono: typeof IconSparkles; ia?: boolean } | null =
        st === 'vence'
          ? { texto: `Cierra en ${ventanaFmt(r)}`, clase: 'bg-[#fffbeb] text-[#92400e]', icono: this.i.vence }
          : st === 'cerrada'
            ? { texto: 'Ventana cerrada', clase: 'bg-[#f3f3f3] text-[#6b7280]', icono: this.i.cerrada }
            : c.pasadoAEquipo
              ? { texto: 'La IA te lo pasó', clase: 'bg-[#303030] text-white', icono: this.i.ia, ia: true }
              : null;
      return {
        c,
        nombre: nombreChat(c),
        ini: iniciales(c),
        avatar: claseAvatar(c),
        ia: atiendeIa(c, ia, ahora),
        anilloColor: st === 'vence' ? '#d97706' : '#1d8a4b',
        anilloOffset: (119.4 * (1 - fraccionVentana(c, ahora))).toFixed(1),
        anilloTip: st === 'cerrada' ? 'Ventana de 24 h cerrada' : `Puedes responder gratis por ${ventanaFmt(r)}`,
        cuando: cuandoLista(c.ultimoMensajeEn, ahora),
        prefijo: prefijoUltimo(c),
        aviso,
      };
    });
  });

  protected alternarFiltros(e: Event): void {
    e.stopPropagation();
    this.filtrosAbiertos.update((v) => !v);
  }

  protected elegirFiltro(k: FiltroBandeja): void {
    this.cambiarFiltro.emit(k);
    this.filtrosAbiertos.set(false);
  }

  protected desplazar(e: Event): void {
    const el = e.target as HTMLElement;
    if (this.hayMas() && el.scrollHeight - el.scrollTop - el.clientHeight < 120) this.masChats.emit();
  }
}
