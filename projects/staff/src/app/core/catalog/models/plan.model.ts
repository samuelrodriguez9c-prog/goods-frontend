/** Espejo de la entidad `Plan` del backend (`plan.entity.ts`). */
export interface Plan {
  id: number;
  nombre: string;
  descripcion: string | null;
  precioMensual: number | null;
  caracteristicas: string[] | null;
  activo: boolean;
  /** Días de prueba que ofrece el plan (0 = sin prueba). Staff los ajusta por Empresa en la llamada de alta. */
  diasPrueba: number;
  /** Módulos incluidos en el plan. El asistente de activación los usa para
   * separarlos de los "extra" pedidos en el checkout. */
  modulos: { codigo: string; nombre: string }[];
}
