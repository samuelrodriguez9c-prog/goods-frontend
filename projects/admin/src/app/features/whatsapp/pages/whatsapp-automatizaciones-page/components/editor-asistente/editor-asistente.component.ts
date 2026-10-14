import { ChangeDetectionStrategy, Component, ElementRef, computed, input, model, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IconAlertTriangle,
  IconCash,
  IconLock,
  IconMessageQuestion,
  IconPlus,
  IconReceipt,
  IconTruck,
  IconUser,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';

/** Ícono de un motivo según de qué habla. */
function iconoDe(t: string): typeof IconCash {
  const s = t.toLowerCase();
  if (/pag|cobr|transfer|nequi/.test(s)) return IconCash;
  if (/reclam|garant|devol|queja|da[ñn]/.test(s)) return IconAlertTriangle;
  if (/pedido|orden|compra|\$/.test(s)) return IconReceipt;
  if (/env[ií]o|domicil|entrega/.test(s)) return IconTruck;
  return IconMessageQuestion;
}

/** Ideas para agregar con un toque. */
const IDEAS = ['Pedido de más de $500.000', 'Pide un descuento', 'Envío fuera de la ciudad', 'Quiere devolver un producto', 'Pregunta por un producto agotado'];

/** Editor del paso "Asistente de IA": uso de hoy, lo que debe saber del negocio y cuándo pasa el chat. */
@Component({
  selector: 'app-editor-asistente',
  imports: [TablerIconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editor-asistente.component.html',
  host: { class: 'block' },
})
export class EditorAsistenteComponent {
  readonly instrucciones = model.required<string>();
  /**
   * Cuándo le pasa el chat al equipo (se guarda en la config del asistente y
   * va en sus reglas). "Pide hablar con alguien" y "no sabe la respuesta" van
   * siempre: no se pueden quitar.
   */
  readonly motivos = model<string[]>([]);
  readonly disponible = input(true);
  readonly puedeConfigurar = input(false);
  readonly respuestas = input(0);
  readonly limite = input(0);
  /** % de chats atendidos por la IA que no pasaron al equipo (null = sin datos). */
  readonly sinAyudaPct = input<number | null>(null);
  readonly pasados = input<number | null>(null);

  protected readonly i = { lock: IconLock, mas: IconPlus, x: IconX, user: IconUser };
  protected readonly chips = computed(() => this.motivos().map((t) => ({ t, icon: iconoDe(t) })));
  protected readonly ideas = computed(() => IDEAS.filter((t) => !this.motivos().some((m) => m.toLowerCase() === t.toLowerCase())).slice(0, 3));
  protected readonly agregando = signal(false);
  protected readonly nuevo = signal('');
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  protected abrir(): void {
    this.agregando.set(true);
    requestAnimationFrame(() => this.campo()?.nativeElement.focus());
  }

  protected agregar(t = this.nuevo()): void {
    const m = t.trim().slice(0, 80);
    if (m && !this.motivos().some((x) => x.toLowerCase() === m.toLowerCase()) && this.motivos().length < 10) {
      this.motivos.set([...this.motivos(), m]);
    }
    this.nuevo.set('');
    this.agregando.set(false);
  }

  protected quitar(t: string): void {
    this.motivos.set(this.motivos().filter((m) => m !== t));
  }

  protected tecla(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.agregar();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      this.nuevo.set('');
      this.agregando.set(false);
    }
  }
  protected readonly uso = computed(() => (this.limite() ? Math.min(100, (this.respuestas() / this.limite()) * 100) : 0));
  protected readonly textoPasados = computed(() => {
    const n = this.pasados();
    if (n == null) return 'Sin chats pasados a tu equipo';
    return `${n} ${n === 1 ? 'chat pasado' : 'chats pasados'} a tu equipo`;
  });
}
