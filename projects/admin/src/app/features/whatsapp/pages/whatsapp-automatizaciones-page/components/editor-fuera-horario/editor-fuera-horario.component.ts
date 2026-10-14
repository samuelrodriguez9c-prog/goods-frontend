import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, model, signal } from '@angular/core';
import { IconChevronDown, TablerIconComponent } from '@tabler/icons-angular';
import { HorarioSemanal } from '../../../../../../core/whatsapp/whatsapp.model';
import { DIAS, ZONAS, aHoras, ahoraEn, etiquetaZona, hora } from '../../automatico';

/**
 * Editor del paso "Fuera de horario": el mensaje y el horario de atención
 * como barras de 24 h por día, con la marca de "ahora" en el día de hoy
 * (en la zona horaria del negocio). Tocar el día lo abre o lo cierra; tocar
 * el rango deja cambiar las horas.
 */
@Component({
  selector: 'app-editor-fuera-horario',
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editor-fuera-horario.component.html',
  host: { class: 'block' },
})
export class EditorFueraHorarioComponent {
  readonly texto = model.required<string>();
  readonly zona = model.required<string>();
  readonly horario = model.required<HorarioSemanal>();
  readonly puedeConfigurar = input(false);

  protected readonly zonas = computed(() => {
    const z = ZONAS.map((x) => ({ v: x.v, t: etiquetaZona(x.v) }));
    return z.some((x) => x.v === this.zona()) ? z : [...z, { v: this.zona(), t: this.zona() }];
  });
  protected readonly etiqueta = computed(() => etiquetaZona(this.zona()));
  protected readonly iChevron = IconChevronDown;
  protected readonly editando = signal<string | null>(null);

  private readonly reloj = signal(Date.now());
  private readonly ahora = computed(() => {
    this.reloj();
    return ahoraEn(this.zona());
  });

  protected readonly dias = computed(() => {
    const h = this.horario();
    const a = this.ahora();
    return DIAS.map((d) => {
      const r = h[d.k];
      const A = r ? aHoras(r.desde) : 0;
      const B = r ? aHoras(r.hasta) : 0;
      return {
        ...d,
        r,
        hoy: d.k === a.dia,
        rango: r ? `${hora(r.desde)} – ${hora(r.hasta)}` : 'Cerrado',
        left: (A / 24) * 100,
        width: (Math.max(0, B - A) / 24) * 100,
        malo: !!r && r.hasta <= r.desde,
      };
    });
  });
  protected readonly ahoraPct = computed(() => (this.ahora().horas / 24) * 100);

  constructor() {
    const id = setInterval(() => this.reloj.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  protected alternarDia(k: string): void {
    if (!this.puedeConfigurar()) return;
    const abierto = !!this.horario()[k];
    this.horario.update((h) => ({ ...h, [k]: h[k] ? null : { desde: '08:00', hasta: '18:00' } }));
    this.editando.set(abierto ? null : k);
  }

  protected editar(k: string): void {
    if (!this.puedeConfigurar() || !this.horario()[k]) return;
    this.editando.update((e) => (e === k ? null : k));
  }

  protected cambiarHora(k: string, campo: 'desde' | 'hasta', valor: string): void {
    if (!valor) return;
    this.horario.update((h) => (h[k] ? { ...h, [k]: { ...h[k]!, [campo]: valor } } : h));
  }
}
