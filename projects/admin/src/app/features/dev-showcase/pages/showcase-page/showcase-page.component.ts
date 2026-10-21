import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TableModule } from 'primeng/table';
import {
  StatusBadgeComponent,
  DataTableComponent,
  dataTablePt,
  SelectionCheckboxComponent,
  QuickAdjustPopoverComponent,
  QuickAdjustResult,
  OrderLineItemComponent,
} from 'shared-ui';

interface DemoOrder {
  id: string;
  order: string;
  date: string;
  customer: string;
  paymentLabel: string;
  paymentTone: 'success' | 'warning' | 'neutral' | 'critical';
  fulfillmentLabel: string;
  total: string;
  items: string;
  /** Orden reembolsada: la fila entera va tachada. */
  struck: boolean;
}

/**
 * Vitrina de los composites de `shared-ui` en `/dev`, fuera de la navegación
 * del admin: sirve para revisar cómo se ven antes de usarlos en una pantalla.
 */
@Component({
  selector: 'app-showcase-page',
  standalone: true,
  imports: [
    StatusBadgeComponent,
    DataTableComponent,
    SelectionCheckboxComponent,
    QuickAdjustPopoverComponent,
    OrderLineItemComponent,
    TableModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './showcase-page.component.html',
})
export class ShowcasePageComponent {
  /** Pedidos de ejemplo para la tabla. */
  protected readonly orders = signal<DemoOrder[]>([
    {
      id: '1005',
      order: '#1005',
      date: 'Today at 5:48 am',
      customer: 'John Smith',
      paymentLabel: 'Paid',
      paymentTone: 'neutral',
      fulfillmentLabel: 'Unfulfilled',
      total: '$28.20',
      items: '3 items',
      struck: false,
    },
    {
      id: '1004',
      order: '#1004',
      date: 'Today at 5:08 am',
      customer: 'Charlotte Wilson',
      paymentLabel: 'Paid',
      paymentTone: 'neutral',
      fulfillmentLabel: 'Unfulfilled',
      total: '$9.00',
      items: '1 item',
      struck: false,
    },
    {
      id: '1003',
      order: '#1003',
      date: 'Today at 5:05 am',
      customer: 'John Smith',
      paymentLabel: 'Refunded',
      paymentTone: 'critical',
      fulfillmentLabel: 'Unfulfilled',
      total: '$0.00',
      items: '0 items',
      struck: true,
    },
    {
      id: '1002',
      order: '#1002',
      date: 'Today at 3:32 am',
      customer: 'Sam Lee',
      paymentLabel: 'Payment pending',
      paymentTone: 'warning',
      fulfillmentLabel: 'Unfulfilled',
      total: '$700.00',
      items: '50 items',
      struck: false,
    },
    {
      id: '1001',
      order: '#1001',
      date: 'Yesterday at 11:24 pm',
      customer: 'Sam Lee',
      paymentLabel: 'Paid',
      paymentTone: 'neutral',
      fulfillmentLabel: 'Unfulfilled',
      total: '$90.00',
      items: '10 items',
      struck: false,
    },
  ]);

  protected readonly selectedOrders = signal<DemoOrder[]>([]);
  protected readonly selectedCount = computed(() => this.selectedOrders().length);
  protected readonly allSelected = computed(
    () => this.orders().length > 0 && this.selectedOrders().length === this.orders().length,
  );
  protected readonly someSelected = computed(
    () => this.selectedOrders().length > 0 && !this.allSelected(),
  );

  /** Preset visual del composite DataTable — ver data-table.component.ts. */
  protected readonly tablePt = dataTablePt();

  protected isOrderSelected(order: DemoOrder): boolean {
    return this.selectedOrders().some((o) => o.id === order.id);
  }

  protected toggleOrder(order: DemoOrder, checked: boolean): void {
    this.selectedOrders.update((current) =>
      checked ? [...current, order] : current.filter((o) => o.id !== order.id),
    );
  }

  protected toggleAll(checked: boolean): void {
    this.selectedOrders.set(checked ? [...this.orders()] : []);
  }

  /** Inventario de ejemplo (ficha de producto). */
  protected readonly inventory = signal({
    location: 'Shop location',
    unavailable: 0,
    committed: 0,
    available: 100,
    onHand: 100,
  });

  protected readonly lastAdjustment = signal<QuickAdjustResult | null>(null);

  protected applyInventoryAdjustment(result: QuickAdjustResult): void {
    this.lastAdjustment.set(result);
    this.inventory.update((current) => {
      const delta =
        result.mode === 'set'
          ? result.quantity - current.available
          : result.mode === 'add'
            ? result.quantity
            : -result.quantity;
      const available = Math.max(0, current.available + delta);
      return { ...current, available, onHand: available + current.committed };
    });
  }

  /**
   * Placeholder de imagen de producto — no hay fotos reales en este demo,
   * así que se usa un ícono neutro en vez de dejar el <img> roto.
   */
  protected readonly productImagePlaceholder =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56">
        <rect width="56" height="56" fill="#f1f1f1"/>
        <path d="M16 38l8-10 6 7 6-8 10 11" fill="none" stroke="#c7c7c7" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="21" cy="20" r="4" fill="#c7c7c7"/>
      </svg>`,
    );

  /** Detalle de orden en solo lectura. */
  protected readonly readonlyLineItems = signal([
    {
      id: 'a',
      title: 'Premium Pul Biber (Turkish Crushed Red Pepper Flakes)',
      variant: '100g - Large',
      sku: '101',
      unitPrice: 10,
      quantity: 10,
    },
    {
      id: 'b',
      title: 'Premium Red Pepper Spice – Bold & Aromatic Ground Chili Powder',
      variant: null,
      sku: '100',
      unitPrice: 8.2,
      quantity: 10,
    },
  ]);

  /** Edición de orden con cantidad editable. */
  protected readonly editableLineItems = signal([
    {
      id: 'a',
      title: 'Premium Pul Biber (Turkish Crushed Red Pepper Flakes)',
      variant: '100g - Large',
      sku: '101',
      unitPrice: 10,
      quantity: 5,
    },
    {
      id: 'b',
      title: 'Premium Red Pepper Spice – Bold & Aromatic Ground Chili Powder',
      variant: null,
      sku: '100',
      unitPrice: 8.2,
      quantity: 8,
    },
  ]);

  protected onEditableQuantityChange(id: string, quantity: number): void {
    this.editableLineItems.update((items) =>
      items.map((item) => (item.id === id ? { ...item, quantity } : item)),
    );
  }

  protected onEditableRemove(id: string): void {
    this.editableLineItems.update((items) => items.filter((item) => item.id !== id));
  }

  /** Modo «X of Y» de retener o reembolsar: `maxQuantity` simula el mismo pedido #1003 de los otros ejemplos. */
  protected readonly partialLineItems = signal([
    {
      id: 'a',
      title: 'Premium Pul Biber (Turkish Crushed Red Pepper Flakes)',
      variant: '100g - Large',
      sku: '101',
      unitPrice: 10,
      quantity: 5,
      maxQuantity: 10,
      selected: true,
    },
    {
      id: 'b',
      title: 'Premium Red Pepper Spice – Bold & Aromatic Ground Chili Powder',
      variant: null,
      sku: '100',
      unitPrice: 8.2,
      quantity: 0,
      maxQuantity: 10,
      selected: false,
    },
  ]);

  protected onPartialQuantityChange(id: string, quantity: number): void {
    this.partialLineItems.update((items) =>
      items.map((item) => (item.id === id ? { ...item, quantity } : item)),
    );
  }

  protected onPartialSelectedChange(id: string, selected: boolean): void {
    this.partialLineItems.update((items) =>
      items.map((item) => (item.id === id ? { ...item, selected } : item)),
    );
  }
}
