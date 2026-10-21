/** Body de `POST /empresas/registro-publico` (`RegistroPublicoEmpresaDto`): primer paso del alta asistida. */
export interface RegistroPublicoEmpresaPayload {
  nombre: string;
  rubro?: string;
  correoContacto: string;
  telefonoContacto?: string;
  duenoNombres: string;
  duenoApellidos: string;
  duenoCorreo: string;
  planId: number;
  /**
   * Módulos pedidos como extra (los que el plan elegido no trae). Es una
   * sugerencia: Goods la confirma en la llamada de activación.
   */
  modulosSolicitados?: string[];
}

/** La `Empresa` recién creada por el registro; solo los campos que usa la confirmación. */
export interface EmpresaRegistrada {
  id: number;
  nombre: string;
  estado: string;
}
