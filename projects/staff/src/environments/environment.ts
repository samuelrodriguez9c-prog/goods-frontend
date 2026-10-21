/**
 * Environment de desarrollo; en producción lo reemplaza
 * `environment.production.ts` (`fileReplacements` en angular.json).
 *
 * Usa el mismo backend que `admin`: lo que cambia es el rol del usuario
 * (`staff_goods`), no la URL.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  /** Raíz del backend, sin `/api`: el gateway de sockets no usa el `setGlobalPrefix('api')` de las rutas HTTP. */
  socketUrl: 'http://localhost:3000',
  /** Registro público (checkout) del panel `admin`: "Nueva Empresa" lo
   *  abre para cargar el alta en nombre del negocio (alta asistida). */
  registroPublicoUrl: 'http://localhost:4200/registro',
};
