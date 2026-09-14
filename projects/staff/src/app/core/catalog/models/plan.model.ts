/** Espejo de la entidad `Plan` del backend (`plan.entity.ts`). */
export interface Plan {
  id: number;
  nombre: string;
  descripcion: string | null;
  precioMensual: number | null;
  caracteristicas: string[] | null;
  activo: boolean;
}
