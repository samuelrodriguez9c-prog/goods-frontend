/**
 * Environment de desarrollo; el build de producción lo reemplaza por
 * `environment.production.ts` (`fileReplacements` en angular.json).
 *
 * @remarks
 * `socketUrl` es la raíz del backend sin `/api`: el gateway de Socket.IO no
 * usa el prefijo global que sí tienen las rutas HTTP.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  socketUrl: 'http://localhost:3000',
};
