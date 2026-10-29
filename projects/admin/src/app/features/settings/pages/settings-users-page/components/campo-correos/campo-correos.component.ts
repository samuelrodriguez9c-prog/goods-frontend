import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { estiloToken, evaluarCorreos, partirCorreos, resumenCorreos } from '../../usuarios.util';

/**
 * Campo de correos de «Invitar personas»: cada correo queda como una pastilla
 * (Enter, coma, punto y coma, espacio o Tab; pegar una lista la parte sola).
 * En rojo lo que no es un correo; en ámbar los repetidos o los que ya están en
 * el equipo. Debajo, el resumen por estado.
 */
@Component({
  selector: 'app-campo-correos',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  template: `
    <div
      (click)="enfocar()"
      class="flex min-h-[104px] cursor-text flex-wrap content-start gap-1.5 rounded-[14px] bg-white p-2 shadow-[0_0_0_1px_#e5e5e5] transition-shadow duration-200 focus-within:shadow-[0_0_0_1px_#303030,0_0_0_4px_rgba(48,48,48,.07)]"
    >
      @for (t of tokens(); track $index; let i = $index) {
        @let s = estilo(t);
        <span
          [title]="s.nota"
          class="inline-flex h-7 max-w-full animate-[st-pop_.22s_cubic-bezier(.2,.8,.2,1)_both] items-center gap-1.5 rounded-full px-1 text-[12.5px]"
          [style.background]="s.bg"
          [style.color]="s.color"
          [style.box-shadow]="s.sombra"
        >
          <span
            class="flex size-5 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold"
            [style.background]="s.avBg"
            [style.color]="s.avColor"
            >{{ t.correo.charAt(0).toUpperCase() }}</span
          >
          <span class="min-w-0 truncate">{{ t.correo }}</span>
          @if (s.nota) {
            <span class="shrink-0 text-[11px] opacity-85">· {{ s.nota }}</span>
          }
          <button
            type="button"
            (click)="$event.stopPropagation(); quitar(i)"
            title="Quitar"
            class="flex size-[18px] shrink-0 items-center justify-center rounded-full opacity-60 hover:bg-black/[.06] hover:opacity-100"
          >
            <app-ic nombre="x" [size]="11" />
          </button>
        </span>
      }
      <input
        #campo
        [value]="texto()"
        (input)="escribir($any($event.target).value)"
        (keydown)="tecla($event)"
        (paste)="pegar($event)"
        (blur)="agregar(texto())"
        [placeholder]="
          correos().length ? 'Agrega otro correo' : 'nombre@correo.com, otro@correo.com…'
        "
        class="h-7 min-w-[180px] flex-1 border-0 bg-transparent px-1.5 text-[13px] text-[#111827] outline-none"
      />
    </div>
    <div class="flex min-h-6 flex-wrap items-center gap-1.5">
      @for (x of resumen(); track x.t) {
        <span
          class="inline-flex h-[22px] animate-[st-fade-in_.2s_both] items-center gap-[5px] rounded-md px-2 text-[11.5px] font-medium"
          [style.background]="x.bg"
          [style.color]="x.color"
        >
          <span class="size-1.5 rounded-full" [style.background]="x.punto"></span>{{ x.t }}
        </span>
      }
      @if (malos()) {
        <button
          type="button"
          (click)="quitarMalos()"
          class="text-xs font-medium text-[#4b5563] hover:text-[#111827] hover:underline"
        >
          Quitar los que no se enviarán
        </button>
      }
      @if (!correos().length) {
        <span class="text-xs text-[#9ca3af]"
          >Ejemplo: ana&#64;mitienda.co, pedro&#64;mitienda.co</span
        >
      }
    </div>
  `,
})
export class CampoCorreosComponent {
  /** Correos tal como se escribieron; su estado se calcula cada vez. */
  readonly correos = model<string[]>([]);
  /** Correos que ya están en el equipo (en minúsculas). */
  readonly existentes = input<Set<string>>(new Set());

  protected readonly texto = signal('');
  protected readonly estilo = estiloToken;
  protected readonly tokens = computed(() => evaluarCorreos(this.correos(), this.existentes()));
  protected readonly resumen = computed(() => resumenCorreos(this.tokens()));
  protected readonly malos = computed(() => this.tokens().some((t) => t.estado !== 'ok'));
  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  enfocar(): void {
    this.campo().nativeElement.focus();
  }

  protected escribir(v: string): void {
    if (/[,;\n]/.test(v)) this.agregar(v);
    else this.texto.set(v);
  }

  protected agregar(t: string): void {
    const nuevos = partirCorreos(t);
    this.texto.set('');
    this.campo().nativeElement.value = '';
    if (nuevos.length) this.correos.update((cs) => [...cs, ...nuevos]);
  }

  protected tecla(e: KeyboardEvent): void {
    if (['Enter', ',', ';', ' ', 'Tab'].includes(e.key)) {
      if (this.texto().trim()) {
        e.preventDefault();
        this.agregar(this.texto());
      } else if (e.key !== 'Tab') {
        e.preventDefault();
      }
    } else if (e.key === 'Backspace' && !this.texto() && this.correos().length) {
      this.correos.update((cs) => cs.slice(0, -1));
    }
  }

  protected pegar(e: ClipboardEvent): void {
    const t = e.clipboardData?.getData('text') ?? '';
    if (/[\s,;]/.test(t.trim())) {
      e.preventDefault();
      this.agregar(`${this.texto()} ${t}`);
    }
  }

  protected quitar(i: number): void {
    this.correos.update((cs) => cs.filter((_, k) => k !== i));
  }

  protected quitarMalos(): void {
    const buenos = new Set(this.tokens().map((t, i) => (t.estado === 'ok' ? i : -1)));
    this.correos.update((cs) => cs.filter((_, i) => buenos.has(i)));
  }
}
