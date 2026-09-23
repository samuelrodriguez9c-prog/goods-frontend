# Referencia de diseño — Panel administrativo (Goods)

> Este archivo documenta decisiones de diseño para el frontend del admin,
> basadas en capturas reales del admin de Shopify (versión Spring '26,
> con su asistente "Sidekick" integrado) que el cliente ya aprobó como
> referencia. Las capturas completas (219 imágenes) están en la carpeta
> `png/`, nombradas `Shopify Web <N>.png`, sin categorizar — este
> documento recoge lo ya revisado y organizado por módulo, para no tener
> que volver a examinar las 219 cada vez.
>
> Shopify usa su propio sistema de diseño llamado **Polaris**
> (documentado públicamente: tokens de color, espaciado, tipografía,
> especificación de componentes). Nosotros construimos en Angular, no
> React, así que no podemos usar los componentes de Polaris directo,
> pero sí replicar su lenguaje visual (tokens, layout, comportamiento)
> sobre Angular Material personalizado o Tailwind + componentes propios
> — la decisión de cuál se toma aparte, en la capa de "librería de
> componentes".

## Lenguaje visual general (aplica a todo el admin)

- **Corrección (verificado con pipeta sobre las capturas reales):** el
  sidebar izquierdo **no es negro** — es gris muy claro (`#ebebeb`), el
  mismo tono de familia que el fondo de contenido pero un poco más
  oscuro para diferenciarse como panel. Lo único realmente casi-negro es
  la barra superior (`#0a0a0a`). La descripción anterior ("sidebar casi
  negro") era un error de lectura visual a distancia — quedó corregido
  aquí y en la sección de tokens de color más abajo.
- Sidebar izquierdo gris muy claro, con navegación por ícono + texto y
  submenús expandibles (ej. Orders → Drafts/Shipping labels; Products →
  Collections/Inventory). El item activo se resalta con una píldora aún
  más clara (casi blanca) sobre ese fondo gris.
- Barra superior oscura (casi negra): buscador global, ícono de
  asistente IA, notificaciones, usuario. En pantallas de edición se
  vuelve contextual (breadcrumb + título + acciones a la derecha, o
  aviso de "cambios sin guardar" con Discard/Save).
- Fondo de contenido gris muy claro (`#f1f1f1`, un poco más claro que el
  sidebar); tarjetas blancas puras (`#ffffff`) de esquinas redondeadas
  con sombra sutil — el contraste entre canvas y tarjeta es sutil pero
  real y perceptible al hacer pipeta.
- Color reservado casi exclusivamente para estado: verde (activo/pagado/
  éxito), naranja-ámbar (pendiente/en espera/vencido), rojo (error/
  crítico), azul (links). Todo lo demás en negro/gris.
- Botones primarios: negro sólido (no un negro puro — ver tokens), texto
  blanco. Secundarios: blancos con borde.
- Modales centrados: header con título + X, footer con Cancelar +
  acción primaria.
- Páginas de detalle (pedido, cliente): contenido principal a la
  izquierda (líneas, resumen, timeline), panel derecho con metadata
  (cliente, canal, direcciones, notas, etiquetas) — patrón repetido en
  varios módulos.
- Tablas: checkboxes de selección, badges de estado, barra de acciones
  en lote al seleccionar filas ("3 selected" + botones de acción).

### Tokens de color (extraídos con pipeta de las capturas reales)

Metodología: en vez de adivinar valores hex "que se ven parecidos", se
recortó cada elemento de interés de las capturas PNG originales (sin
comprimir) y se calculó el color dominante real por conteo de píxeles
(moda, no promedio — el promedio se contamina con el anti-aliasing de
bordes y texto). Se evitaron capturas con un modal abierto para los
colores de fondo/superficie, porque el scrim semitransparente del modal
oscurece todo lo que queda detrás y falsea la lectura.

| Token | Hex | Uso | Fuente (captura) |
|---|---|---|---|
| `--color-topbar` | `#0a0a0a` | Barra superior | 106 |
| `--color-sidebar-bg` | `#ebebeb` | Fondo del sidebar | 106 |
| `--color-canvas-bg` | `#f1f1f1` | Fondo del área de contenido | 106, 479 |
| `--color-card-bg` | `#ffffff` | Fondo de tarjetas | 479 |
| `--color-nav-active` | `#fafafa` | Píldora del item de nav activo | 106 |
| `--color-primary-button` | `#303030` | Botón primario (Save, Create order, Add customer) | 445, 479 |
| `--color-badge-neutral-bg` | `#e3e3e3` | Badge neutro (ej. "Paid") | 106 |
| `--color-badge-warning-bg` | `#ffeb79` | Badge de pendiente/en espera (ej. "Unfulfilled", "Payment pending") | 106 |
| `--color-badge-warning-solid` | `#ffb904` | Banner/alerta ámbar sólida (ej. "Erasure request submitted") | 479 |
| `--color-badge-success-bg` | `#a4ffb6` | Badge de éxito claro (ej. "Active") | 336 |
| `--color-success-solid` | `#087b5d` | Verde sólido para indicadores de estado (ej. puntos de "Email/SMS/WhatsApp" en Marketing) | 479 |

Notas:
- Todavía falta un rojo/error de referencia — ninguna de las capturas
  revisadas hasta ahora muestra un badge o alerta de error en pantalla.
  Se tomará de una captura futura que sí lo muestre, o si no aparece
  ninguna, se usará un rojo estándar de Polaris documentado públicamente
  (`#d82c0d` aprox.) como placeholder razonable.
- Estos tokens ya están escritos como bloque `@theme` de Tailwind v4 en
  `frontend/projects/admin/src/styles.css` (ver sección "Implicaciones
  técnicas" más abajo).

## Dashboard / Analítica

Fuente: capturas 19, 20, 26 (Home) y 61 (Orders).

El hallazgo clave: **no es una sola pantalla de dashboard aislada**. Es
un componente de "franja de KPIs" reutilizable que cada módulo puede
instanciar con sus propias métricas — aparece en el Home (Sessions,
Total sales, Orders, Conversion rate, Live visitors) y por separado,
con métricas distintas, en la propia pantalla de Orders (Orders, Items
ordered, Returns, Orders fulfilled, Orders delivered, todo con el
filtro "Today").

Comportamiento del componente de KPI:
- Cada tarjeta muestra: nombre de la métrica, número grande, y una
  mini-gráfica de tendencia (sparkline) sin ejes ni etiquetas — solo la
  forma de la curva. Si no hay tendencia que mostrar (ej. "0%"), se
  muestra un guion en vez del sparkline — no se oculta la tarjeta.
- Al hacer clic en una tarjeta, **se expande en el mismo lugar** (no
  navega a otra página) mostrando uno de dos contenidos:
  - Una gráfica de línea completa con eje de fechas, comparando el
    período actual (línea sólida) contra el período anterior (línea
    punteada), con leyenda de fechas exactas debajo.
  - Una tabla de desglose (ej. "Total sales" se abre en: Ventas brutas,
    Descuentos, Devoluciones, Ventas netas, Envío, Impuestos, Total),
    donde cada fila es a su vez un link para seguir profundizando.
- Arriba de la franja de KPIs: selector de período (ej. "Last 30 days")
  y de canal/alcance (ej. "All channels").
- "Live visitors" con un punto verde pulsante — indicador en tiempo
  real. En Goods esto lo podemos lograr con la infraestructura de
  WebSockets ya construida (`RealtimeGateway`), ej. "usuarios conectados
  ahora".

### Cómo mapea al alcance ya definido para Goods

(Ver `backend/MODULOS_PENDIENTES.md`, sección "Dashboard / analítica"
para el alcance funcional acordado con gerencia.)

- **Usuarios** → tarjeta "Nuevos registros" con sparkline, expandible a
  gráfica de línea con período de comparación.
- **Ventas / ingresos** → tarjeta "Ventas totales" expandible al
  desglose (bruto, descuentos, devoluciones, neto, envío, total) —
  mapea directo a nuestras entidades `pedido`/`pago`.
- **Pedidos** → franja de KPIs propia dentro de la pantalla de listado
  de pedidos (no solo en el dashboard global), con métricas propias:
  pedidos hoy, ítems vendidos, devoluciones, etc.
- **Productos e inventario** → por el mismo patrón, una franja de KPIs
  en la pantalla de productos (más vendidos, stock bajo el mínimo).

### Implicaciones técnicas (para cuando se construya)

- Frontend: un componente Angular de "tarjeta KPI" reutilizable —
  número + sparkline + slot de contenido expandido intercambiable
  (gráfica de línea vs. tabla de desglose).
- Backend: los endpoints de analítica no pueden devolver solo el total
  actual — necesitan series de tiempo con período de comparación (dos
  rangos de fechas, no uno) para poder dibujar la línea sólida vs.
  punteada.

## Pedidos / Órdenes

Fuente: capturas 106, 107, 111, 124, 127, 130, 133, 134 (todas sobre la
misma orden de ejemplo, #1003, vista en distintos momentos de su ciclo de
vida), más 61 y 65 del muestreo general.

### Página de detalle de la orden

Layout de dos columnas (ya anotado en "Lenguaje visual general"), aplicado
aquí así:

- **Header**: `#1003` + badges de estado en línea (ej. "Paid" + "Unfulfilled",
  o "Partially refunded" + "Unfulfilled" — **pueden coexistir dos badges de
  naturaleza distinta**: uno de pago, otro de cumplimiento/envío). A la
  derecha: Refund, Edit, Print, More actions, y flechas de
  orden-anterior/siguiente.
- **Columna izquierda**: una tarjeta por cada "grupo de cumplimiento"
  (fulfillment group) — no es una sola lista de líneas. En la orden de
  ejemplo aparecen tres grupos distintos apilados: "Unfulfilled (13)" con
  método de envío (Express) y sus líneas, "Removed (7)" con las líneas que
  se quitaron de la orden, y un resumen "Partially refunded" (Original
  order / Subtotal / Discount / Shipping / Total / Paid / Refunded / Net
  payment). Cada grupo "Unfulfilled" tiene sus propios botones
  contextuales: "Mark as fulfilled ▾" (split-button con opciones "Mark as
  in progress" / "Mark as on hold") y "Create shipping label".
- **Columna derecha**: Notes, Channel Information, Customer (con link al
  perfil, dirección de envío/facturación, contacto), Conversion summary,
  Order risk ("Analysis not available" cuando no aplica), y Tags (input
  libre).
- **Timeline / bitácora**: lista de eventos en orden cronológico inverso,
  muy granular — cada acción del staff queda registrada como una línea con
  hora relativa: "Fulfillment was released", "You released a manual hold
  on 20 items", "You marked 20 items as on hold", "You canceled
  fulfillment via Manual for 20 items", entradas de email transaccional
  enviado (con botón "View email"), comentarios internos del staff (con
  menú "…" → "Delete comment", que abre un modal de confirmación
  destructivo estándar: título + texto de advertencia, footer
  Cancel/Delete en rojo).

### Flujo "Mark as on hold"

Al elegir la opción desde el split-button: modal con checklist de cada
línea (cantidad editable en formato "X of Y", para retener solo parte de
los ítems), un dropdown "Hold reason" (motivo obligatorio, de lista
cerrada), y footer Cancel / "Mark as on hold" (primario). Este mismo
patrón de "selecciona ítems + cantidad parcial + motivo de lista cerrada"
se repite, con variaciones, en refund y en remove/edit.

### Flujo de reembolso (página dedicada, no modal)

`#1003 > Refund` es una **página completa**, no un modal — separa esta
acción de las demás por su complejidad:

- Por cada línea: cantidad a reembolsar en formato editable "X / Y".
- Checkbox "Restock items" (si se marca, la devolución repone inventario;
  si no, el ítem se da por perdido/no vendible).
- Campo de texto "Reason for refund" (visible solo a staff, igual que
  "Reason for edit" en la edición de orden).
- Panel derecho "Summary": Items subtotal, Refund total (calculado según
  las cantidades marcadas), dropdown "Refund method" (por defecto,
  "Original payment"), campo de monto manual con hint "$X available for
  refund" (permite reembolsos parciales en dinero, no solo por ítem),
  checkbox "Send notification" (email al cliente), y botón primario
  "Refund $X.XX" con el monto ya calculado en el label del botón.

### Flujo de edición de orden ("Edit order")

También página/vista dedicada (no un modal simple), con overlay modal
propio para agregar ítems custom:

- Botones "+ Add product" (buscar y agregar del catálogo) y "+ Add custom
  item" (ítem libre: nombre, precio, cantidad, checkboxes "Item is
  taxable" / "Item is a physical product" — para cosas como tarjetas de
  regalo o cargos manuales que no son un producto real del catálogo).
- Cada línea agregada muestra un badge "Added" hasta que se confirma.
- Panel derecho "Summary" recalculando en vivo: Updated total, Net
  payment, Amount to collect (o a devolver, si el cambio reduce el
  total), checkbox "Send invoice to customer".
- Campo "Reason for edit" (solo staff) antes de poder confirmar.
- El botón de confirmación ("Update order") permanece deshabilitado
  ("No changes have been made") hasta que hay al menos un cambio real.

### Cómo mapea al modelo de `pedido` ya construido en Goods

Estados actuales de `Pedido` en el backend (`pedido.service.ts`,
`TRANSICIONES_VALIDAS`): `pendiente → confirmado | cancelado`,
`confirmado → enviado | cancelado`, `enviado → entregado | cancelado`,
`entregado → devuelto`, `cancelado`/`devuelto` sin salida. Es un modelo
más simple que el de Shopify (que separa estado de **pago**, de
**cumplimiento/envío** y de la orden en sí, con grupos parciales), pero el
lenguaje visual sí es directamente aplicable:

- El patrón de **dos badges independientes** (pago vs. cumplimiento) es
  útil incluso sin cambiar el modelo de datos: podemos derivar un badge de
  "estado de pago" a partir de la entidad `Pago` asociada, y mostrarlo
  junto al badge de `pedido.estado`, sin necesitar una migración.
- El listado de acciones vía **split-button contextual según el estado
  actual** (solo mostrar transiciones válidas) mapea 1:1 con
  `TRANSICIONES_VALIDAS` — el frontend puede pedir al backend qué
  transiciones son válidas para el pedido actual, o replicar el mismo
  mapa en el cliente.
- El **timeline granular** es un patrón nuevo para Goods — hoy no
  registramos un log de eventos por pedido (solo el `estado` actual más
  fechas de auditoría genéricas, si existen). Para replicar esto haría
  falta una tabla de eventos/histórico (`pedido_evento` o similar) que
  registre cada cambio de estado con quién y cuándo.
- El **flujo de reembolso como página dedicada** con reposición opcional
  de inventario mapea bien a lo que ya existe: `InventarioService` para
  ajustar `cantidadDisponible`, y `PagoService.cambiarEstado` (o un nuevo
  método `reembolsar`) para el lado del pago. El campo de "monto manual"
  además del reembolso por ítem es una idea a considerar para pagos
  parciales.
- El **flujo de edición de orden** (agregar/quitar ítems después de
  creada) no existe hoy en el backend — actualmente un pedido se crea
  completo o se cancela; no hay edición de líneas post-creación. Es una
  funcionalidad nueva a evaluar si el negocio la necesita (Shopify la usa
  mucho para "agregar algo que el cliente pidió por teléfono/chat").

### Implicaciones técnicas (para cuando se construya)

- Backend: para el timeline se necesita una tabla de eventos por pedido
  (append-only), no derivarlo solo del estado actual.
- Backend: para reembolsos parciales con reposición de inventario, la
  lógica debe reutilizar la misma transacción + locking pessimistic ya
  construida para reservas de stock (evitar condiciones de carrera al
  reponer).
- Frontend: el componente de línea de pedido (producto + cantidad +
  precio) se reutiliza en al menos tres contextos (detalle, hold parcial,
  refund, edit) — conviene construirlo como un componente Angular
  configurable (modo solo-lectura / modo cantidad-editable) desde el
  principio, no duplicarlo.
- Frontend: los formularios de "motivo" (hold reason, refund reason,
  reason for edit) son casi idénticos — un mismo componente de
  "motivo + visibilidad solo-staff" sirve para los tres.

## Productos / Inventario

Fuente: capturas 304, 336, 348 (misma ficha de producto, "Premium Red
Pepper Spice", en distintos estados: activo/archivado), 397 (Purchase
orders → Create supplier), 409 (Gift cards → Create gift card).

### Ficha de producto (patrón de detalle más elaborado del admin)

- **Columna izquierda**: Title, Description (editor de texto enriquecido:
  negrita/cursiva/subrayado/color/alineación, botón para ver el HTML
  crudo), Media (grid de imágenes + botón "+" para agregar), Category
  (selector jerárquico de taxonomía — ej. "Herbs & Spices" dentro de
  "Seasonings & Spices" — que además desbloquea "N metafields" propios de
  esa categoría, con nota explicando que la categoría también determina
  impuestos y mejora búsqueda/filtros), Price (precio, y un acordeón
  colapsable con Compare-at, Unit price, Charge tax, Cost per item),
  Inventory (tabla por ubicación: Unavailable / Committed / Available /
  On hand, link "View all locations", **popover de ajuste rápido en
  línea**: dropdown "Set to / Add / Subtract" + cantidad + dropdown de
  motivo de lista cerrada, ej. "Damaged" + botón de confirmar; además
  SKU, Barcode, toggle "Sell when out of stock"), Shipping (toggle
  "Physical product", preset de paquete con dimensiones, peso), Variants
  ("Add options like size or color"), y metafields propios de la
  categoría (ej. "Food product form: Ground").
- **Columna derecha**: **Status** como su propia tarjeta con dropdown
  (Active/Draft/Archived — cuando está archivado, en su lugar aparece un
  aviso "Archived — Hidden from your Shopify admin, except your product
  list" con botón "Unarchive product"), Publishing (canales de venta),
  Sales ("No recent sales of this product" / link a detalle), Product
  organization (Type, Vendor, Collections, Tags), Theme template.

### Asistente de IA contextual por registro

Distinto del ícono de IA global de la barra superior: en la ficha de
producto aparece un panel lateral "Setup guide" que **da sugerencias
específicas para ese producto exacto** ("has estado puliendo el listado
de Premium Red Pepper Spice... ¿quieres que genere una foto de producto
o escriba una descripción más fuerte?"), con iconos de pulgar
arriba/abajo para feedback y un campo de chat para seguir pidiendo cosas
("¿alguna recomendación para mejorar el catálogo de productos?"). Es el
mismo asistente ("Sidekick") pero aplicado con contexto del registro
actual, no solo como chat genérico.

### Compras a proveedores y tarjetas de regalo (submenús de Products)

- **Purchase orders → Create supplier**: formulario de alta de proveedor
  (Company, Country/region, Address, Apartment/suite, City/State/ZIP,
  Contact name, Phone, Email, Website, Notes) — entidad separada de
  producto, para gestión de reabastecimiento.
- **Gift cards → Create gift card**: código, valor inicial, fecha de
  expiración, cliente asociado (opcional), notas — un tipo de producto
  especial con su propio flujo de creación.

### Cómo mapea al modelo de `producto`/`inventario` ya construido en Goods

El backend de Goods ya tiene una separación muy parecida a la de
Shopify entre el producto (catálogo) y su inventario (stock):

- `Inventario` (`cantidadDisponible`, `cantidadReservada`, `stockMinimo`)
  mapea directo a la tabla "Locations: Unavailable / Committed /
  Available / On hand" de Shopify — en Goods aún no manejamos múltiples
  ubicaciones/bodegas, solo un total por producto, así que el equivalente
  visual sería una sola fila en vez de una tabla (a menos que se agregue
  soporte multi-bodega más adelante).
- `MovimientoInventario` (`tipo`: `entrada` | `salida` | `ajuste`, más
  `motivo` de texto libre y `delta` con signo) mapea **casi 1:1** al
  popover de ajuste rápido de Shopify (Set to/Add/Subtract + motivo) — ya
  tenemos el modelo de datos necesario, solo falta el componente de UI.
  A diferencia de Shopify (motivo de lista cerrada tipo "Damaged"),
  Goods usa texto libre en `motivo`; se podría mantener así o
  estandarizar a una lista cerrada más adelante.
- `Producto` ya tiene campos de envío (`pesoGramos`, `altoCm`, `anchoCm`,
  `largoCm`) equivalentes a la sección "Shipping" de Shopify, y un
  `estado` (activo/inactivo, a diferencia del Active/Draft/Archived de
  tres estados de Shopify).
- Goods hoy no tiene variantes de producto (talla/color) ni categorías
  jerárquicas con metafields dinámicos — son features de Shopify bastante
  más avanzadas que el alcance actual; no parece prioritario replicarlas
  a menos que el catálogo real de Goods las necesite.
- No existe todavía un módulo de "proveedores"/compras en Goods más allá
  de `compra` (que ya vimos en pagination) — si se decide construir algo
  como "Purchase orders → Create supplier" habría que evaluar si
  `compra` ya cubre esa necesidad o si hace falta una entidad `proveedor`
  nueva.

### Implicaciones técnicas (para cuando se construya)

- Frontend: el popover de ajuste de inventario (Set to/Add/Subtract +
  motivo) es una pieza de UI pequeña y muy reutilizable — conviene
  construirla una vez y usarla tanto en la ficha de producto como en un
  futuro listado de inventario.
- Frontend: el patrón "Status como su propia tarjeta con estados
  especiales" (banner + acción cuando está archivado) es más limpio que
  un simple badge — vale la pena replicarlo para `producto.estado`.
- Backend: si se quiere el asistente de IA contextual por producto más
  adelante, es una función completamente aparte de todo lo ya
  construido (requiere LLM + contexto del registro) — no es parte del
  alcance actual, solo se documenta como inspiración de UX.

## Clientes / Usuarios

Fuente: capturas 446 (listado + import CSV), 445 (alta de cliente +
"Add default address"), 468/479 (detalle del cliente "Sam Lee" en dos
momentos), 459 (Edit tax details), 465 (Add to new company).

### Listado

Tabla simple: Customer name, Email subscription (badge "Subscribed"),
Location, Orders, Amount spent. Barra superior con buscador, botones
Export/Import/"Add customer", y resumen "N customers — X% of your
customer base" (referencia útil si más adelante se segmenta por país,
canal, etc.). "Import customers by CSV" es un modal simple: drop de
archivo + link "Download a sample CSV".

### Alta de cliente

Formulario "Customer overview": First/Last name, Language (para el
idioma de las notificaciones — dato que Goods no tiene hoy),
Email + checkbox de consentimiento de marketing, Phone + checkbox
propio de consentimiento SMS, Notes (privadas, nunca visibles al
cliente), Tags. La dirección por defecto se agrega aparte, en un modal
"Add default address" (Country, First/Last name, Company —para
clientes B2B—, Address con autocompletado, Apartment/suite, City/State/
ZIP, Phone).

### Detalle del cliente

- **Franja de KPIs** arriba (mismo patrón del dashboard, aplicado aquí
  con métricas propias del cliente): Amount spent, Orders, Customer
  since, **RFM group** (ej. "Dormant" — segmentación automática
  Recency/Frequency/Monetary que Shopify calcula solo).
- Card "Last order placed" con preview de la orden más reciente y
  botones "View all orders" / "Create order".
- Timeline de actividad — mismo patrón granular que vimos en Pedidos:
  cada acción queda registrada (envío de email de notificación, crédito
  emitido, solicitudes de datos/borrado, comentarios internos).
- Columna derecha: Contact information (email, teléfono, idioma de
  notificaciones), Default address, Marketing (badges Email/SMS/
  WhatsApp — canales de consentimiento independientes entre sí), Tax
  details (editable vía modal "Edit tax details" → "Collect tax" / "Don't
  collect tax", para clientes exentos de impuestos), **Store credit**
  (saldo + modal "Adjust store credit": monto, moneda, expiración
  opcional, checkbox de notificación por email), Tags, Notes.
- **Privacidad/GDPR**: banner "Erasure request submitted" cuando se
  programó el borrado de datos personales de un cliente (con fecha y
  botón "Cancel request") — Shopify separa "customer data request" (el
  cliente pide sus datos) de "customer erasure request" (pide que se
  borren), ambos quedan registrados en el timeline.
- **B2B**: modal "Add to new company" agrupa clientes bajo una empresa
  (razón social, contacto principal, checkbox para mover las órdenes
  existentes del cliente a la empresa, dirección de envío) — cubre
  ventas al por mayor, fuera del alcance actual de Goods pero vale la
  pena tenerlo mapeado si en el futuro se vende B2B.

### Cómo mapea al modelo de `usuario` ya construido en Goods

La entidad `Usuario` de Goods ya es bastante completa y cubre gran
parte de lo que Shopify separa en "Customer": `nombres`/`apellidos`,
`correo`/`telefono` (con sus flags `correoVerificado`/
`telefonoVerificado`), `direccionPrincipal`/`referenciaDireccion`/
`latitud`/`longitud` (dirección por defecto), `activo`/
`motivoDesactivacion` (equivalente simplificado al archivado),
`aceptaMarketing` (un solo flag, Shopify separa Email/SMS/WhatsApp),
`puntosFidelidad` y `codigoReferido`/`referidoPorId` (fidelización y
referidos — features que Shopify ni siquiera muestra en estas capturas,
Goods ya va adelantado ahí), `preferenciasNotificaciones` (jsonb libre,
cubriría el idioma de notificaciones que Shopify sí expone en el UI).

Lo que **no existe hoy** en Goods y aparece en Shopify:
- **Store credit / saldo a favor**: no hay tabla de crédito de tienda ni
  movimientos asociados — si se quiere replicar, es una entidad nueva
  (`credito_tienda` + histórico de movimientos, análogo a
  `MovimientoInventario`).
- **RFM / segmentación automática**: no hay lógica de segmentación de
  clientes — sería un cálculo periódico (recency/frequency/monetary)
  sobre `pedido`, no un campo almacenado.
- **Solicitudes de datos/borrado (GDPR/Habeas Data)**: no hay flujo de
  "derecho al olvido" — relevante si Goods opera en Colombia (Ley
  1581/2012, Habeas Data) o vende a la UE; sería una tabla de
  solicitudes con estado y fecha programada de borrado, más un job que
  ejecute el borrado real.
- **Impuestos por cliente** (exento de impuestos): no existe — hoy los
  impuestos, si los hay, se calculan igual para todos.
- **Agrupación B2B por empresa**: no existe — coherente con que Goods
  hoy es B2C.

### Implicaciones técnicas (para cuando se construya)

- Frontend: el componente de franja de KPIs (ya identificado en
  Dashboard y Pedidos) se reutiliza una tercera vez aquí con métricas de
  cliente — refuerza que vale la pena construirlo una sola vez, genérico.
- Backend: si se prioriza algo de esta lista, RFM y store credit son los
  de mayor impacto comercial (marketing dirigido, retención); GDPR/
  Habeas Data es el de mayor urgencia legal si aplica al mercado de
  Goods — vale la pena resolverlo con el cliente/negocio antes de
  construir nada de esto.

## Topbar

Fuente: captura 106. Se construye por partes (izquierda → centro →
derecha), calcando la esquina superior izquierda/derecha y el buscador
central de Shopify.

### Izquierda: logo + badge de versión (hecho)

- Shopify usa ícono (bolsa de compras) + wordmark "shopify" en negrita
  itálica, y junto a eso un badge tipo píldora con el texto "Spring '26"
  (la versión de su plataforma): fondo casi idéntico al de la barra
  (transparente en la práctica), borde sutil gris claro, texto itálico
  gris muy claro (casi blanco).
- Goods todavía no tiene un archivo de logo — por ahora es un wordmark de
  texto ("Goods", `font-bold italic`), reemplazable después por un ícono
  real sin tocar el resto del layout.
- El badge se reutiliza para la versión del admin en vez de la versión de
  la plataforma: por ahora texto fijo `v0.1`, sin lectura automática de
  `package.json` (hoy está en `0.0.0`, no tiene sentido mostrarlo hasta
  que se decida versionar el proyecto de verdad).
- Tokens nuevos (pipeta sobre la captura 106): `--color-topbar-badge-border`
  (`#2a2a2a`), `--color-topbar-badge-text` (`#f0f0f0`).

### Centro: buscador global (hecho)

- Barra de búsqueda ancha, fondo `#282828` (levemente más claro que
  `--color-topbar`, token `--color-topbar-search-bg`), esquinas
  redondeadas (`rounded-lg`, no píldora completa — distinto del badge de
  versión), ícono de lupa + placeholder "Search", y al final de la barra
  un hint de atajo de teclado (`⌘` `K`) en dos badges pequeños
  (`--color-topbar-kbd-bg`, `#2f2f2f`, apenas más claro que el fondo de
  la barra — diferencia de ~7 puntos de gris verificada con pipeta).
- Es un `<input>` real (enfocable, con anillo de foco), pero sin lógica
  de búsqueda ni el atajo de teclado ⌘K conectados todavía — eso
  requiere definir qué busca (¿pedidos? ¿productos? ¿clientes? ¿todo a
  la vez, como Shopify?) y es trabajo aparte.

### Tipografía e íconos (decisión de gerencia)

Gerencia pidió definir de una vez fuente e íconos para todo el admin, no
solo para el topbar — estas decisiones aplican a todo `shared/ui` hacia
adelante:

- **Tipografía: Inter, self-hosted** vía `@fontsource/inter`. Las letras
  de las capturas de Shopify se ven como un grotesco geométrico — no se
  pudo confirmar con certeza que sea exactamente Inter (no hay forma de
  extraer metadata de fuente de un PNG), pero es la opción más parecida
  y es un estándar de facto para este estilo de UI. Se eligió
  self-hosted (paquete npm, sin request a Google Fonts en cada carga)
  para no depender de un servicio externo. Solo se importan los pesos
  que el admin ya usa (`400`, `500`, `600`, `700`, más `400-italic` y
  `700-italic` para el wordmark del logo y el badge de versión) — no los
  9 pesos completos que ofrece Inter, para no cargar peso de más.
  Token: `--font-sans` en el `@theme`, con fallback a la fuente nativa
  del sistema si algo falla al cargar.
- **Íconos: `@tabler/icons-angular`** (reemplaza a `@lucide/angular`,
  usado primero — ver "Sidebar > Íconos" para el porqué del cambio).
  Línea limpia y minimalista, cercana al lenguaje visual de
  Shopify/Polaris, sin ser el set exacto de Shopify
  (`@shopify/polaris-icons`, que se descartó por no tener integración
  oficial para Angular — requeriría traer los SVG sueltos a mano). Es
  el paquete **oficial** de Tabler (`@tabler/icons-angular`, no un
  wrapper de comunidad) y trae outline **y relleno** de cada ícono
  desde la misma familia visual — a diferencia de Lucide, que es
  puramente de trazo y no tiene versión rellena.
- Dos formas de usar el componente `<tabler-icon>`, según el caso:
  por referencia de objeto (`[icon]="iconSearch"`, con
  `iconSearch = IconSearch` importado en el componente — así lo usa el
  topbar) cuando los íconos de un componente son fijos, o por nombre
  registrado con `provideTablerIcons(...)` (`[icon]="item.icon"` con
  un string como `"home-filled"`) cuando el ícono depende de un dato
  que cambia por ítem (así lo usa el sidebar — ver "Sidebar >
  Implementación técnica"). `provideTablerIcons` devuelve
  `EnvironmentProviders`, que solo puede registrarse a nivel de app
  (`app.config.ts`) o de ruta, nunca en el `providers` de un
  componente.
- Implicación técnica: `npm install` hay que correrlo de nuevo en cada
  máquina de desarrollo después de este cambio (se agregó
  `@tabler/icons-angular` a `package.json`, se quitó `@lucide/angular`;
  `@fontsource/inter` sigue igual).

### Derecha: íconos (hecho)

- De izquierda a derecha: ícono del asistente IA, campana de
  notificaciones, y avatar + nombre de usuario.
- En Shopify el ícono de asistente es "Sidekick", un ícono propio de
  carita/máscara — no existe en Tabler (ni existía en Lucide). Se usó
  `IconRobot` como el equivalente semántico más cercano dentro del set
  ya elegido; en Goods representaría el mismo patrón de asistente
  contextual ya visto en la ficha de producto (ver "Asistente de IA
  contextual por registro"). Si más adelante hace falta más fidelidad
  visual con Sidekick, es la única pieza del topbar que valdría la pena
  traer como SVG propio en vez de un ícono de la librería.
- La campana de notificaciones sí tiene equivalente exacto (`IconBell`).
- Avatar: cuadrado redondeado con iniciales — en Shopify el color es
  aleatorio por cuenta (no es un token de marca real), pero por
  indicación de gerencia se pipeteó el color exacto de la captura 106
  para que la referencia y el admin se vean iguales: fondo
  `--color-topbar-avatar-bg` (`#2be0d5`, turquesa/cian brillante — se ve
  "azulado" a simple vista), texto `--color-topbar-avatar-text`
  (`#004442`, teal oscuro, también pipeteado) en vez de blanco para
  mantener contraste sobre un fondo tan claro.
- Sin lógica real detrás de ninguno de los tres todavía: no hay panel de
  asistente, no hay lista de notificaciones, y el nombre/iniciales
  ("Admin" / "AD") son un placeholder fijo porque `core/auth` todavía no
  existe (ver estructura de carpetas — hoy es solo un `.gitkeep`). Wirear
  esto a un usuario real es trabajo aparte, depende de que exista login.

### Esquinas redondeadas del contenido (bajo el topbar)

- Detalle que se había pasado por alto: el borde inferior del topbar
  **no es una línea recta** — el sidebar y el canvas, justo debajo,
  tienen la esquina superior (izquierda y derecha respectivamente)
  redondeada, "mordiendo" el negro del topbar en las dos esquinas
  exteriores. La costura interna entre sidebar y canvas sí es recta, sin
  redondeo — el efecto solo se ve en las dos esquinas exteriores de la
  pantalla.
- Radio medido con precisión sobre la captura 106 (no a ojo): se buscó
  en qué fila deja de haber negro lejos de la esquina (y=112 en la
  captura) y en qué fila empieza el gris justo en el borde (x=0, y=130)
  — la diferencia (18px de captura ÷ el factor de escala 1.512 de la
  captura ≈ 12px CSS) coincide casi exacto con `rounded-xl` (12px) de
  Tailwind — se usó ese valor en vez de un `rounded-2xl` a ojo.
  Implementación: el contenedor que envuelve sidebar+canvas tiene fondo
  negro (`bg-topbar`) de base, y sidebar/canvas cada uno con su propia
  esquina superior redondeada (`rounded-tl-xl` / `rounded-tr-xl`) —
  así el negro de fondo se asoma exactamente en las dos esquinas, sin
  necesidad de ningún margen/gap explícito.

## Sidebar

Fuente: captura 106 (sidebar completo, de arriba a abajo). La versión
anterior era texto plano sin íconos, sin estado activo real, sin
Settings — esta sección documenta el rediseño.

### Catálogo completo de la captura (para referencia futura)

De arriba a abajo, la captura 106 tiene: Home, **Orders** (activo, pill
+ badge de conteo "3") con submenú Drafts/Shipping labels/Abandoned
checkouts, Products, Customers, Growth, Discounts, Content, Markets,
Finance, Analytics — sección "Sales channels ›" (Online Store, Agentic,
Point of Sale) — sección "Apps ›" — Messaging (con punto de no-leído) —
sección "Sidekick conversations ›" (historial de chats con el
asistente) — Settings fijo abajo.

### Decisión de alcance (gerencia)

Se replicó el **estilo** exacto (ícono + texto, pill de item activo,
Settings fijo abajo) pero **no el contenido completo** — Goods no tiene
Growth/Discounts/Content/Markets/Finance/Analytics/Online
Store/Agentic/Point of Sale/Apps/Messaging/Sidekick conversations, y
agregar esos ítems como enlaces muertos iba en contra del criterio ya
usado en todo este documento (alcance real de Goods, lenguaje visual de
Shopify). El sidebar de Goods hoy es: **Dashboard, Orders, Products,
Customers, Settings** — los mismos 4 módulos ya documentados en el
resto de este archivo, más Settings.

- Tampoco se replicaron los submenús (Drafts/Shipping labels/Abandoned
  checkouts bajo Orders; Collections/Inventory bajo Products) porque no
  existen como rutas reales en `orders.routes.ts` / `products.routes.ts`
  — Shipping labels/Abandoned checkouts ni siquiera tienen equivalente
  claro en el modelo `pedido` de Goods. Si en algún momento se agrega
  una ruta real (ej. inventario como página propia en vez de sección de
  la ficha de producto), ahí sí tendría sentido agregar el submenú.
- Tampoco se replicó el badge de conteo ("Orders 3") — mostrar un número
  falso hubiera sido peor que no mostrar nada; se agrega el día que haya
  un servicio real de pedidos conectado (`OrdersApiService`, pendiente).
- **Settings** sí se agregó como ítem + ruta (`features/settings`,
  placeholder igual que el resto de páginas) aunque todavía no se
  definió qué configuración necesita Goods — existe porque su posición
  fija abajo es parte del patrón de layout de Shopify, no porque el
  contenido ya esté decidido.

### Íconos

**Relleno vs. línea (revisado contra la captura 106, zoom a la columna
de íconos):** Shopify no usa el mismo estilo para todos los ítems del
sidebar — Home, Products y Customers usan íconos **sólidos/rellenos**,
mientras que Orders, Settings y el resto de secciones fuera de alcance
(Growth, Discounts, Content, Markets) usan **de línea/outline**.

Primer intento: `@lucide/angular` (misma decisión que el topbar en su
momento) para todo. Al llegar a este detalle se descubrió que Lucide es
una librería puramente de trazo (stroke) — no tiene variante rellena de
sus íconos, y sus paths no son regiones cerradas rellenables (probarlo
con `fill` en vez de `stroke` da un resultado roto). Como parche
temporal se instaló el paquete oficial `heroicons` solo para copiar a
mano el `path` verificado de sus íconos sólidos de Home/Tag/User, sin
quedar como dependencia. Funcionaba, pero dejaba dos familias de
íconos mezcladas en el proyecto (Lucide de trazo + heroicons rellenos
copiados a mano) — al preguntarle a gerencia si convenía mantener el
híbrido o resolverlo de raíz, se decidió **migrar todo el proyecto de
`@lucide/angular` a `@tabler/icons-angular`** (paquete oficial de
Tabler, no un wrapper de comunidad): mismo lenguaje visual que Lucide
(trazo 2px, esquinas redondeadas, muy cercano a Feather/Lucide en
espíritu), pero con **outline y relleno de cada ícono en la misma
librería** — sin mezclar dos sets ni copiar paths a mano. `heroicons`
ya no es necesario y se desinstaló.

Mapeo final (todos de `@tabler/icons-angular`):

- **Dashboard** → `IconHome2Filled`, **Products** → `IconTagFilled`,
  **Customers** → `IconUserFilled` (rellenos).
- **Orders** → `IconInbox`, **Settings** → `IconSettings2` (de línea).
- Topbar (sin cambios de estilo, solo de librería): `IconSearch`,
  `IconRobot` (antes `LucideBot`), `IconBell` — los tres de línea.

**Ajuste "más curvo" (pedido de gerencia, después de explorar Streamline
Flex Remix — ver más abajo por qué se descartó):** Tabler es una
librería de un solo estilo geométrico consistente — no tiene una
familia alternativa "curva" completa como Streamline. Sí tiene, para
algunos conceptos, un segundo ícono con silueta más suave sin cambiar
el significado:

- **Settings**: `IconSettings` (engranaje clásico de 8 dientes,
  anguloso) → **`IconSettings2`** (insignia hexagonal de esquinas
  suaves) — el cambio más notorio de los dos.
- **Dashboard**: `IconHomeFilled` (ventana rectangular recta) →
  **`IconHome2Filled`** (ventana con esquinas redondeadas) — cambio
  sutil.

Se revisaron alternativas para Products, Customers, Orders, Search,
Bell y el asistente (Robot) y ninguna es notablemente más curva sin
cambiar el ícono a otro concepto — se dejaron como estaban.

**Por qué no se usó Streamline (Flex "Remix" / "Plump"):** gerencia
vio en la propia página de Tabler una promoción de Streamline
(250,000+ íconos) y le gustó el estilo curvo/fluido de su set "Flex",
variante "Remix" (también existe "Plump", más bulboso — familia
aparte). Investigado: son gratis pero bajo licencia **CC BY 4.0**, que
exige atribución visible a Streamline en el producto (a diferencia de
Tabler/Lucide, que son MIT y no la exigen). Existe soporte técnico real
para usarlo (`iconify-icon`, MIT, + `@iconify-json/streamline-flex` o
`@iconify-json/streamline-plump`, datos offline sin depender de un CDN
en producción) — no era una limitación técnica. La decisión fue de
licenciamiento: gerencia prefirió no mostrar atribución de terceros en
el admin, y la única forma de usar Streamline sin atribución es pagar
su suscripción (desde $19-29/mes) — se descartó por el costo recurrente
frente a un ajuste puramente estético, y se optó por quedarse en
Tabler (MIT, sin atribución, sin costo) con los dos swaps de arriba.

### Implementación técnica

El item activo se resuelve con `routerLinkActive` (ya existía). A
diferencia de Lucide (cada ícono era su propio componente standalone,
sin forma de pasarlo como dato — obligaba a un `@switch` sobre
`icon: 'house' | 'inbox' | 'tag' | 'user'`), `@tabler/icons-angular`
expone un único componente genérico `<tabler-icon>` que acepta el
nombre del ícono **por string** (`icon="home-2-filled"`) cuando ese
nombre se registra antes con `provideTablerIcons({ IconHome2Filled, ... })`.
Eso permitió simplificar el sidebar: `NavItem.icon` ahora es
simplemente el string del ícono de Tabler (`'home-2-filled'`, `'inbox'`,
`'tag-filled'`, `'user-filled'`, y `'settings-2'` para el link fijo de
Settings), usado directo como `<tabler-icon [icon]="item.icon" />`
dentro del `@for` — ya no hace falta el `@switch`. Los íconos se
registran con `provideTablerIcons` en `app.config.ts` (no en el propio
componente: esa función devuelve `EnvironmentProviders`, que Angular no
permite en el `providers` de un componente, solo a nivel de app o de
ruta).

### Medidas (corregidas contra la captura, no a ojo)

Primer intento (ancho `w-56`/224px, `gap-1` entre items, `py-2.5`) se
veía más angosto y con más aire entre items que la referencia. Se
volvió a medir con precisión sobre la captura 106:

- **Ancho del sidebar**: se buscó en qué columna termina el gris del
  sidebar (`#ebebeb`) y empieza el del canvas (`#f1f1f1`) — el borde
  cae en x≈478px de la captura. Dividido por el factor de escala de la
  captura (1.512) da ≈316px CSS → se usó `w-80` (320px) de Tailwind en
  vez de `w-56` (224px).
- **Separación entre items**: se aprovechó que el pill activo de
  "Orders" tiene un color distinguible (`#fafafa` vs `#ebebeb` del
  sidebar) para medir su alto exacto con precisión de píxel: 56px de
  captura, de borde a borde, **sin ningún hueco** antes de que empiece
  la fila siguiente — el pill ocupa toda la fila, no hay `gap` entre
  items. 56px ÷ 1.512 ≈ 37px CSS por fila. Se quitó el `gap-1` entre
  items y se bajó el padding vertical de cada item de `py-2.5` a `py-2`
  (con el ícono de 20px, `py-2` dos veces + ícono ≈ 36px, calza con la
  medición).

### Ajuste post-medición: micro-gap entre items (`gap-0.5`)

El cero-gap de arriba se verificó contra una captura **estática** de
Shopify, que nunca muestra dos pills superpuestas (activo + hover al
mismo tiempo) — solo una activa a la vez. En uso real sí pasa: al pasar
el mouse de un módulo activo al siguiente, las dos pills (la de
`routerLinkActive` y la de `:hover`) quedan exactamente pegadas, y como
ambas tienen las 4 esquinas redondeadas, la unión sin espacio se ve
como un "pellizco" — un recorte raro justo donde se tocan, en vez de
dos pills separadas. Se agregó `gap-0.5` (2px) al contenedor `<nav>`
para separar visualmente las pills sin perder la sensación "apretada"
de la referencia — 2px es imperceptible comparado con la fila de 37px,
pero alcanza para que las esquinas redondeadas no se toquen. Es una
excepción deliberada a la medición de arriba, documentada acá porque
contradice el "sin gap" — se prioriza que la interacción se vea bien
sobre el calco exacto de un estado que la captura de referencia nunca
mostró.

De paso se alargó la transición de color al pasar el mouse
(`transition-colors` → `duration-200 ease-out`, antes sin duración
explícita — usaba el default de Tailwind de 150ms) para que el cambio
de fondo entre módulos se sienta más suave, a pedido de gerencia.

### Indicador deslizante (reemplaza el fondo por item)

El ajuste de arriba (micro-gap + transición de color más lenta) no
resolvía el pedido real de gerencia: quería que la selección se sienta
como que **se desplaza** de un módulo a otro, no que cada item
prenda/apague su propio color (que sigue siendo un aparecer/desaparecer,
por más lento que sea). La causa de fondo: cada `<a>` tenía su propio
fondo independiente (`routerLinkActive="bg-nav-active"` +
`hover:bg-nav-active`), así que nunca había *una* forma moviéndose,
había dos formas alternándose.

Se reemplazó por un **indicador único**: una sola `<div>` absolutamente
posicionada (el `<nav>` pasó a `relative`) que se desliza entre items
animando `top`/`height` con `transition-all duration-200 ease-out`, en
vez de que cada item controle su propio fondo:

- Cada `<a>` del `@for` tiene una referencia de plantilla `#link`
  (`ElementRef`), leída desde el componente con `viewChildren<ElementRef>('link')`
  (API de queries por signal de Angular 21).
- `hoveredIndex` (signal) guarda qué item está bajo el mouse — se
  actualiza con `(mouseenter)` por item y se limpia con `(mouseleave)`
  en el propio `<nav>`.
- `activeIndex` (signal) guarda el item de la ruta activa — se
  actualiza desde `(isActiveChange)` de cada `routerLinkActive` (no se
  reimplementa el matching de ruta a mano, se deja que el propio
  directive decida y solo se escucha su evento).
- Un `computed` elige el elemento objetivo (`hoveredIndex` si hay
  hover, si no `activeIndex`), y de ahí salen `indicatorTop` /
  `indicatorHeight` (`offsetTop` / `offsetHeight` del elemento) y
  `indicatorVisible`, todos leídos directo del DOM real — no hay
  alturas ni posiciones hardcodeadas, así que si el padding cambia en
  el futuro el indicador se sigue ajustando solo.
- Cada `<a>` dejó de tener su propio `bg-nav-active`/`hover:bg-nav-active`
  — ahora solo cambia el color de texto/ícono
  (`[class.text-gray-900]="rla.isActive"`, vía `#rla="routerLinkActive"`
  sin lista de clases propia) y queda por encima del indicador
  (`relative z-10`, indicador en `z-0` y `pointer-events-none`).
- **Settings queda afuera de este sistema** — está separado del grupo
  (empujado al fondo con `mt-auto`, sin vecino inmediato debajo), así
  que no había problema de "pellizco" ni necesidad real de que el
  indicador viaje hasta ahí; se dejó con el fondo propio + fade simple
  de antes.

Con esto, el "pellizco" del micro-gap (arriba) ya no puede pasar —
nunca hay dos pills visibles al mismo tiempo, solo una que se mueve —
pero se dejó el `gap-0.5` igual, no molesta en nada.

## Pendiente de revisar

(Todos los módulos priorizados ya fueron revisados: Dashboard/Analítica,
Pedidos/Órdenes, Productos/Inventario, Clientes/Usuarios. El Topbar ya
está completo en sus tres partes — izquierda, centro y derecha — todas
sin lógica real conectada todavía, solo estructura y estilo calcados de
Shopify.)

## Decisión: stack de UI para el admin

**Gerencia discutió y aprobó PrimeNG** como librería de componentes del
admin — esto reemplaza la opción "Tailwind puro + Angular CDK" que se
había explorado primero. Al ir a instalarlo apareció un tema serio de
licenciamiento (ver abajo) que cambió la versión final a usar, y luego
se armó y verificó el proyecto real (no solo en teoría). Queda todo el
razonamiento registrado porque explica qué vigilar al construir.

### Aviso de licenciamiento que hizo cambiar la versión

PrimeTek (los creadores de PrimeNG) anunciaron un cambio de
licenciamiento que arranca **justo en la versión 22** (igual para
PrimeReact 11 y PrimeVue 5): todo lo anterior queda MIT para siempre
(no retroactivo), pero de la v22 en adelante hay un modelo nuevo
("PrimeUI licensing") con una Community License gratuita (para equipos
chicos, con registro/confirmación anual) o una Commercial Suite de pago.
**Decisión tomada: quedarse en PrimeNG 21.x (última versión MIT, sin
condiciones)** para no depender de ningún registro ni licencia — la
`v21-stable` (21.1.10) es la que PrimeTek mismo etiquetó como la pareja
estable de esa última versión libre.

### Angular 21 (LTS), no Angular 22

Al revisar el `package.json` publicado de `primeng@21.1.10`, su
`peerDependencies` exige `@angular/core: ^21.0.7` y
`@angular/cdk: ^21.0.0` — no soporta oficialmente Angular 22 (la versión
más reciente, liberada en junio 2026). Para no combinar dos piezas que
ninguno de los dos proyectos probó together, **el workspace quedó en
Angular 21**, que sigue en soporte LTS activo hasta 2027 (no es una
versión vieja, solo no es la última).

### Fidelidad visual sigue siendo el requisito — y así se logra en la práctica

El factor que no cambió es el del cliente: fidelidad casi de calco a
Polaris, no "inspirado en". La razón por la que esto es viable con
PrimeNG (y no lo era con sus versiones viejas, de temas SCSS pesados y
opinionados) es que desde la reescritura de su sistema de theming
(v18+) expone una API de **Pass Through (`pt`)** en cada componente,
que permite inyectar clases (Tailwind incluido) sobre cualquier nodo
interno del DOM que renderiza el componente — el lema del proyecto es
explícito al respecto: *"Your Components, Not Ours"*.

**Corrección importante tras probarlo de verdad:** el tipo de
`providePrimeNG` expone una opción `unstyled: true`, pero en la versión
instalada (21.1.10) está marcada en el propio `.d.ts` como
`@experimental` — *"not yet implemented"*. **No usar esa opción todavía.**
El mecanismo real y funcional para arrancar sin ningún CSS de tema
puesto es pasar **`theme: 'none'`** en `providePrimeNG` (confirmado
compilando el proyecto real, con Tailwind generando clases sobre un
`p-button` sin ningún estilo de PrimeNG de por medio). Es exactamente
el punto de partida que queríamos, solo que con la API que sí funciona.

**Recomendación concreta para no terminar peleando con la estética:**

1. Seguir en `theme: 'none'` (ya configurado así en el proyecto
   entregado) en vez de partir de un preset ya vestido (Aura) — sacarle
   clases a algo ya estilizado es más trabajo que vestir algo en blanco.
2. Configurar **CSS Layers** entre PrimeNG y Tailwind cuando se empiece
   a construir UI real — evita forzar cada clase con `!important`.
3. Auditar primero los componentes de mayor riesgo visual/estructural,
   en este orden: **DataTable** (selección múltiple + bulk actions, el
   patrón que más se repite en las capturas de Shopify), **Popover**
   (para el popover de ajuste de inventario), **DatePicker** (para el
   date-range picker con comparación de períodos del dashboard),
   **Tag** (el mapeo de estado → color).
4. Como ya hay experiencia previa con PrimeNG (Bankú lo usa), vale la
   pena traer de ahí las convenciones que ya funcionaron — configuración
   de `pt`, manejo de CSS Layers, wrappers ya resueltos — en vez de
   redescubrirlas desde cero en este proyecto.
5. `@angular/animations` (que PrimeNG usa para las transiciones de
   overlays) aparece marcado como deprecado por Angular a favor de
   `animate.enter`/`animate.leave` — no hay nada que hacer al respecto
   todavía, es PrimeNG quien tendría que migrar; solo queda pendiente de
   vigilar en futuras actualizaciones.

### El workspace ya está creado y verificado

`m_za_v01/frontend` — workspace Angular 21 con la app `admin` (Tailwind
v4 + PrimeNG 21.1.10, sin librería compartida todavía: se agrega cuando
se empiece `tienda`). Se verificó con un build real (`ng build`, con un
`p-button` de prueba después removido) que Angular + Tailwind + PrimeNG
compilan juntos sin conflictos antes de entregarlo. Falta correr
`npm install --legacy-peer-deps` en la máquina real (necesario por un
bug de npm al resolver peers de vitest, no por PrimeNG) — el `--legacy-
peer-deps` hay que repetirlo en instalaciones futuras de paquetes en
este proyecto, ya que no se dejó un `.npmrc` (bloqueado por el puente
remoto para escribir).

### Qué construir como librería propia (esto no cambia con PrimeNG)

La mayoría de los 7 componentes identificados abajo **no son primitivas
de PrimeNG** — son composites de dominio propio (construidos combinando
primitivas de PrimeNG + Tailwind para layout), así que se construyen
igual sin importar la librería de base:

Ya identificamos varios componentes que se repiten entre módulos — estos
son los primeros candidatos de la librería interna, en orden de
reutilización (de más a menos usada):

1. **Tarjeta de KPI** (número + sparkline + slot expandible) — usada en
   Dashboard, Pedidos y Clientes.
2. **Fila/línea de ítem de pedido** (producto + cantidad + precio, con
   modo solo-lectura / modo cantidad-editable) — usada en detalle,
   hold parcial, refund y edición de orden. **✅ Construido** — ver
   "Estado de la librería interna" más abajo.
3. **Popover de ajuste rápido** (Set to/Add/Subtract + motivo) — usado en
   inventario, y estructuralmente parecido al ajuste de store credit.
   **✅ Construido** — ver "Estado de la librería interna" más abajo.
4. **Campo de "motivo + visibilidad solo-staff"** — hold reason, refund
   reason, reason for edit.
5. **Timeline de eventos** (lista cronológica con iconos/acciones) — usado
   en pedido y cliente.
6. **Tabla con selección múltiple + barra de bulk actions** — patrón
   base de casi todos los listados. **✅ Construido** — ver "Estado de
   la librería interna" más abajo.
7. **Badge de estado** (mapeo de estado → color: verde/ámbar/rojo/gris) —
   transversal a todo el admin. **✅ Construido** — ver más abajo.

### Estado de la librería interna (qué ya existe en `frontend/`)

- **`StatusBadgeComponent`** (`shared/ui/status-badge/`) — envuelve
  `p-tag` vía `pt`, con inputs `label`/`tone` (success/warning/neutral/
  critical, sobre los tokens de color)/`dot` (none/filled/ring, para el
  patrón "punto relleno = estado de pago, anillo = estado de
  cumplimiento" visto en las capturas). Verificado contra las capturas
  106 y 336 con un build real + captura de navegador.
- **`DataTableComponent` + `dataTablePt()` + `SelectionCheckboxComponent`**
  (`shared/ui/data-table/`) — el "shell" de tabla con selección múltiple
  y barra de bulk actions. Verificado contra la captura 61 (listado de
  Orders), incluyendo la fila tachada de una orden reembolsada.

  **Dos hallazgos técnicos importantes de cómo quedó armado**, para no
  repetir el mismo camino la próxima vez que se toque esto:

  1. **`DataTableComponent` NO envuelve `<p-table>`.** La primera versión
     lo hacía (el wrapper tenía `<p-table>` en su propio template, y el
     consumidor pasaba `<ng-template pTemplate="header">`/`body` como
     contenido proyectado). Compilaba sin errores pero **no renderizaba
     nada** — se armó un caso mínimo de prueba y se confirmó que
     `p-table` no detecta esos `pTemplate` cuando llegan a través de un
     `<ng-content>` intermedio (su `@ContentChildren(PrimeTemplate)` no
     atraviesa ese segundo nivel de proyección). La solución: el
     consumidor usa `<p-table>` tal cual, con su API nativa completa
     intacta (sorting, paginación, filtros — nada de eso hay que
     re-exponer a mano), y `DataTableComponent` solo aporta el "shell"
     visual alrededor (tarjeta + barra de selección) proyectando el
     `<p-table>` ya armado como una unidad. El preset de estilo
     (`dataTablePt()`) se pasa aparte, directo al `[pt]` del `p-table`
     del consumidor.
  2. **El checkbox de selección no usa `p-tableCheckbox`/
     `p-tableHeaderCheckbox`.** Son los componentes "esperables" de
     PrimeNG para esto, pero no exponen `pt` ni heredan el
     `pt.pcCheckbox`/`pt.headerCheckbox` configurado en el `p-table`
     padre — se confirmó inspeccionando el DOM real, llegan sin ninguna
     clase propia (con `theme: 'none'` eso significa invisibles). En vez
     de pelear con esa limitación, `SelectionCheckboxComponent` es un
     checkbox propio y simple: un `<input type="checkbox">` real
     (accesible) vuelto transparente y superpuesto a una caja + ícono de
     check dibujados a mano en Tailwind, con soporte de estado
     indeterminado (para "seleccionar todo" cuando hay selección
     parcial). Se conecta a mano al estado de selección del consumidor
     (no depende de `[(selection)]` de `p-table` en absoluto).

  Moraleja general para el resto de los composites que faltan: cuando
  algo de PrimeNG "debería" encajar pero no se deja estilizar por `pt`,
  conviene verificar con un build real + inspección del DOM antes de
  asumir que el problema es de sintaxis — puede ser una limitación real
  del componente en esta versión, y la salida más simple suele ser
  construir esa pieza puntual a mano en vez de insistir.

- **`QuickAdjustPopoverComponent`** (`shared/ui/quick-adjust-popover/`)
  — el popover "Set to / Add / Subtract" + cantidad + motivo + confirmar.
  Calcado pixel a pixel de la captura 304 (ficha de producto > Inventory)
  y verificado con un build real: abrir el popover, cambiar a "Add 25 —
  Restock" y confirmar efectivamente actualiza "Available"/"On hand" en
  la tabla de la izquierda.

  A diferencia de `DataTableComponent`, acá **sí** fue seguro que el
  componente envuelva su overlay de PrimeNG (`<p-popover>`) directo en su
  propio template — la razón es que `p-popover` NO depende del mecanismo
  de `pTemplate`/`ContentChildren(PrimeTemplate)` que falló con
  `p-table`: acepta contenido simple vía `<ng-content>` normal, que sí
  atraviesa un nivel de wrapper sin problema. Por eso `p-table` necesitó
  quedar "desenvuelto" en cada pantalla y `p-popover` no.

  Dicho eso, después de la sorpresa de `p-tableCheckbox`, el contenido
  *interno* del popover (los dos dropdowns y el input de cantidad) se
  hizo con `<select>`/`<input>` nativos + Tailwind en vez de `p-select`
  — son controles simples que no necesitan lo que PrimeNG resuelve bien
  (overlays con posicionamiento), así que no valía la pena arriesgarse a
  otra limitación de `pt` sin haberla probado primero. PrimeNG se usa acá
  solo para lo difícil de reimplementar: el anclaje del popover al botón
  "Adjust", el cierre al hacer click afuera, y el foco.

  El modal "Adjust store credit" (Clientes/Usuarios) resuelve una
  interacción parecida (monto + motivo + confirmar) pero es un **modal**,
  no un popover — no reusa este componente tal cual, aunque si el día de
  mañana se construye un composite de modal equivalente, tiene sentido
  que copie la misma forma de inputs/output (`reasons`, evento
  `confirmed` con `{ mode, quantity/amount, reason }`).

- **`OrderLineItemComponent`** (`shared/ui/order-line-item/`) — la fila
  de producto (imagen + título + variante/SKU + precio × cantidad +
  total) que se repite en detalle de orden, hold, refund y edit order.
  Calcada de las capturas 106/130 (detalle de orden, grupos "Unfulfilled"
  y "Removed") y 133 (Edit order) — verificada con un build real:
  cambiar la cantidad recalcula el total, sacar una línea la quita de la
  lista, y en el modo con checkbox tildar una fila y escribir una
  cantidad mayor al máximo la deja clampeada en el máximo.

  Son dos modos (`mode: 'readonly' | 'editable'`), no tres, como dice el
  ítem de la lista de arriba:
  - `readonly`: precio y cantidad son texto plano, la cantidad va dentro
    de una píldora ("$10.00 × 10") — así se ve en el detalle de la orden.
  - `editable`: el precio se resalta en el color de acento (igual que
    Shopify) y la cantidad es un `<input>` real. Dentro de este modo hay
    dos variantes de *formato*, no dos modos nuevos: sin `maxQuantity` es
    un input simple (pantalla "Edit order", captura 133); con
    `maxQuantity` seteado pasa a formato "X of Y" / "X / Y"
    (`partialSeparator`), que es lo que se necesita para hold y refund
    parcial — ahí la cantidad editable es "cuántos de los Y originales"
    entran en la acción. **No hay captura de esos modales en el
    muestreo** (el flujo está descrito en texto en "Pedidos / Órdenes" >
    "Flujo 'Mark as on hold'" y "Flujo de reembolso" más arriba en este
    documento) — el formato "X of Y" del componente sigue esa
    descripción textual, así que conviene confirmarlo contra una captura
    real de Shopify el día que aparezca una.

  `selectable` (reutiliza `SelectionCheckboxComponent` del composite de
  tabla) agrega el checkbox de la izquierda para cuando primero hay que
  elegir qué líneas participan (hold, refund) antes de tocar la
  cantidad. `removable` agrega el botón "X" de sacar la línea — solo
  tiene sentido en "Edit order", por eso es opt-in y no parte del modo
  `editable` en sí.

- **`SearchToolbarComponent`** (`shared-ui`'s `lib/search-toolbar/`) — la
  barra de búsqueda + pestañas de estado + filtros aplicados que va
  arriba de cualquier `p-table` (slot `[toolbar]` de `DataTableComponent`,
  ver nota de ese composite más arriba). Reemplaza, desde 2026-09-16, el
  patrón anterior de `<input>`/`<select>`/`<input type="date">` nativos
  sueltos con labels al costado — no se parecían en nada a Shopify y fue
  pedido explícito del cliente ajustarlo, revisando capturas reales en
  vez de ir de memoria.

  Calcada de las capturas 61 (Orders) y 446 (Customers): una sola fila
  con ícono de lupa + placeholder + acciones a la derecha (acá,
  "Filtros"), sin caja ni borde visible — search "flotante" dentro de la
  tarjeta, no un input con recuadro propio. Fila de pestañas arriba
  (opcional, `[tabs]`/`[activeTab]`) solo cuando la pantalla tiene
  estados con nombre (p. ej. Empresas: Todos/Solicitud recibida/
  Pendiente/.../Cancelada) — reemplaza los botones con anillo alrededor
  del `StatusBadgeComponent` que había antes ("los botones que rodean a
  los tags", como lo describió el cliente) por pestañas de texto plano
  con fondo gris cuando están activas, mismo lenguaje que las vistas
  guardadas de Shopify. Fila de chips de filtros aplicados (opcional,
  `[appliedFilters]`) debajo, con botón "Limpiar todo".

  Los filtros que antes eran `<select>`/`<input type="date">` nativos
  ahora vagan dentro de un `p-popover` (mismo patrón "solo comportamiento"
  que `QuickAdjustPopoverComponent`) disparado por el botón "Filtros",
  usando `p-select`/`p-date-picker` de PrimeNG con los presets `pt` de
  `filterSelectPt()`/`filterDatePickerPt()` (`shared-ui`'s
  `lib/utils/filter-controls-pt.ts`) — se llega a esto y no a inputs
  nativos porque un `<select>`/`<input type="date">` del sistema
  operativo no se puede re-estilizar para que su menú/calendario
  desplegable se vea como el de Shopify; sigue la misma regla ya
  documentada en "Decisión: stack de UI" de usar PrimeNG solo donde
  hace falta overlay real. `shared-ui`'s `lib/utils/format-date.ts`
  (`parseDateInput`/`formatDateInput`) traduce entre el string
  `'YYYY-MM-DD'` que ya usan las señales existentes (y que espera el
  backend en los query params) y el `Date` que pide `p-date-picker`,
  construyendo la fecha en hora local para no correr un día por offset
  de UTC.

  Todo el composite anima suave (pedido explícito del cliente): el
  overlay de `p-select`/`p-date-picker` y la fila de chips usan
  `fade-in-up` (la misma animación ya establecida para "golpe suave" en
  el resto del admin), y los estados de hover/focus de pestañas, campos
  y botones llevan `transition-colors`/`transition-all duration-200`.

  Primeros dos consumidores (verificados con build real, sin errores de
  compilación — falta verificación visual en vivo contra las capturas):
  `empresas-page` (staff) usa pestañas de estado + `p-select` de plan +
  dos `p-date-picker`; `auditoria-page` (staff) usa solo los dos
  `p-date-picker`, sin pestañas ni select.

  **Actualización 2026-09-17 — segundo rediseño de `empresas-page`, sobre
  un handoff de diseño del cliente:** se subió un componente de
  referencia (`empresas-page.component.html`/`.ts`, marcado "solo las
  partes nuevas o modificadas — integrar sobre el componente actual")
  con un diseño nuevo para esta pantalla: tarjetas de métrica clicables
  (En alta / Activas / Inactivas / Total) en vez de las pestañas de
  estado, selects en línea de Estado y Plan, layout de fila custom
  (avatar con iniciales + botón "Revisar alta" + chevron) en vez de
  `p-table`/`DataTableComponent`, paginación y skeleton de carga. Se
  integró reconciliando el handoff contra el código real, no tal cual
  vino: usaba PrimeIcons en vez de los íconos Tabler del proyecto,
  tokens de color genéricos (`bg-ink`, `neutral-200`) en vez de los
  reales de `styles.css`, una API inventada de `StatusBadgeComponent`
  (`ui-status-badge [estado] size="sm"` en vez de la real `app-status-badge
  [label] [tone] [dot]`), un modelo de `Empresa` incompleto (sin el
  estado `pendiente`, campos anidados que no existen) y rutas que no
  existen (`/altas-pendientes/:id`) en vez del panel lateral ya
  existente `<app-empresa-detalle-panel>`, que se mantuvo tal cual
  para "Revisar alta" y para abrir el detalle de una fila.

  Dos decisiones de producto se confirmaron con el cliente antes de
  implementar (el handoff no las resolvía):
  1. El filtro de rango de fechas (Desde/Hasta, con los dos
     `p-date-picker` de la sección anterior) se sacó de esta pantalla —
     el nuevo diseño no lo contemplaba.
  2. En vez de duplicar el filtro de estado en dos lugares (las tarjetas
     de métrica nuevas + las pestañas de `SearchToolbarComponent` de la
     sección anterior), se sacaron las pestañas: el filtro de estado
     queda solo en las 4 tarjetas de métrica (grupos en alta/activa/
     inactivas) + un `p-select` para elegir uno de los 7 valores de
     `EstadoEmpresa` puntual. `filtroEstados: EstadoEmpresa[] | null` es
     ahora la única fuente de verdad del filtro de estado, alimentada
     por ambos controles.

  Esto también movió la pantalla a un modelo 100% client-side: como
  `EmpresaService.listar()` ya traía hasta 100 filas en una sola llamada
  (documentado en su propio JSDoc desde antes), y ya no hace falta
  re-consultar al backend por fecha, todo el filtrado/orden/paginación
  (estado, plan, buscador, orden por nombre/fecha, páginas de 10) se
  resuelve en `computed()` sobre esas filas en memoria — se sacó el
  patrón anterior de re-pedir al backend en cada cambio de filtro.

  Nuevo preset para esto: **`paginatorPt()`** (`shared-ui`'s
  `lib/utils/pagination-pt.ts`) — mismo enfoque que el resto de los
  presets `pt` bajo `theme: 'none'`: nombres de sección confirmados
  grepeando `ptm('...')` directo en el bundle instalado de
  `p-paginator` (no hay `root` propio en su template — el host del
  componente ES la raíz, pero `pt.root` igual aplica, como en el resto
  de los composites de PrimeNG). Hallazgo no obvio: la página
  seleccionada del paginador **no** es una sección de `pt` — PrimeNG
  siempre agrega la clase `p-paginator-page-selected` al lado de lo que
  ponga `pt.page`, así que ese estado se resuelve con un selector
  arbitrario de Tailwind (`[&.p-paginator-page-selected]:bg-primary-button`,
  mismo patrón que `[&_tr:hover]` en `dataTablePt()`).

  `SearchToolbarComponent` sumó un input opcional
  `resultsSummary: string | null` — texto tipo "N resultados" que se
  muestra en la fila de chips aunque no haya ningún filtro tipo chip
  puesto (antes esa fila solo aparecía si había chips).

  Verificado con build real (`ng build shared-ui`/`staff`/`admin`, los
  tres sin errores) + Playwright contra un usuario de prueba real: clic
  en cada tarjeta de métrica filtra correctamente, el `p-select` de
  Estado filtra por un valor puntual, la búsqueda por texto combina con
  el filtro activo, y la paginación cambia de página y resalta la
  página actual.

  **Actualización 2026-09-17 (mismo día) — tercer ajuste de
  `empresas-page`, sobre un SEGUNDO handoff de diseño que reemplaza al
  de arriba:** el cliente subió una carpeta "zip" nueva con los mismos
  dos archivos de referencia más un `LEEME.md` explicando los cambios.
  Reemplaza las 4 tarjetas de métrica clicables por un **"embudo de
  alta"**: barras horizontales, una por etapa (`solicitud_recibida` →
  `pendiente` → `informacion_corroborada` → `activa`), con ancho
  proporcional al conteo de cada una y clicables para filtrar por esa
  etapa — más una barra aparte "Fuera del embudo" para las 3 inactivas
  (`suspendida`/`rechazada`/`cancelada`). El header suma badges de
  resumen ("N esperando revisión"/"N vigentes"/"N inactivas", reusando
  `app-status-badge` con label dinámico en vez de HTML a mano) y una
  nota de la solicitud más vieja sin atender. Tipografía nueva:
  **Archivo** (self-hosted vía `@fontsource/archivo`, no el `<link>` de
  Google Fonts que pedía el handoff — el proyecto ya evita esa
  dependencia externa para el resto de la tipografía, ver el comentario
  de cabecera de `staff/src/styles.css`) solo para el título "Empresas"
  y los números del embudo, vía el nuevo token `--font-display`
  (sumado también a `admin/src/styles.css` en paridad, aunque `admin`
  no lo usa todavía).

  Nuevo tono **`info`** en `StatusBadgeComponent` (`shared-ui`) — sumado
  específicamente para `informacion_corroborada`: ni ámbar (ya no hay
  nada pendiente del lado del staff) ni verde (todavía no es cliente
  activo). Tokens nuevos en ambos `styles.css` (`staff` y `admin`, en
  paridad): `--color-badge-info-bg` (`#c8ecff`, tal cual el handoff) y
  `--color-badge-info-solid` (`#0284c7`, criterio propio para la barra
  del embudo, mismo patrón -bg/-solid que warning/success).

  El handoff traía además un mapa de "próximo paso" por fila (ej.
  "Llamar al dueño" con flecha) que resultó ser una **suposición propia
  del autor del handoff, no el flujo real** ya aprobado por gerencia en
  `PROPUESTA_FLUJO_ALTA_ASISTIDA.md` §1: asumía que en
  `informacion_corroborada` todavía faltaba llamar al dueño, cuando en
  realidad esa llamada YA se hizo para llegar a ese estado (ahí se
  espera al cliente, no al staff). Se ajustó al flujo real, confirmado
  con el cliente:
  1. `solicitud_recibida` → "Mandar a Altas pendientes", un solo clic
     (`EmpresaService.enviarAAltasPendientes`), sin abrir nada.
  2. `pendiente` → "Llamar / verificar datos", abre
     `ActivarEmpresaWizardComponent` — **hallazgo importante**: este
     asistente de activación de 2 pasos (§4/§11 Paso 3 de
     PROPUESTA_FLUJO_ALTA_ASISTIDA.md) YA estaba construido de punta a
     punta (wizard, `SidePanelComponent`, `CampoDetalleComponent`,
     `RealtimeService` con WebSocket + polling de 30s) de una tarea
     anterior — la nota de avance del documento de propuesta decía
     "pendiente" pero estaba desactualizada; verificado contra el
     código real antes de escribir una sola línea nueva. Esta pantalla
     solo necesitaba engancharlo (mismo patrón que
     `AltasPendientesPageComponent`: señal `empresaSeleccionadaWizard`
     + `abrirWizard`/`cerrarWizard`/`onWizardActualizada`), no
     construirlo de nuevo.
  3. `informacion_corroborada` → sin botón, solo texto de lectura
     "Esperando confirmación del cliente" — retomar esa Empresa
     (reenviar enlace, rechazar) se hace desde "Altas pendientes", que
     ya la muestra con la misma etiqueta.
  4. `suspendida` → sin próximo paso — el handoff suponía "Revisar el
     pago", pero no existe ninguna pantalla de facturación todavía.

  También corregido de paso: el embudo original del handoff (`ETAPAS`
  en el `.ts`) traía solo 3 etapas y se olvidaba de `pendiente` — igual
  que el handoff anterior se había olvidado de este mismo estado en sus
  tarjetas de métricas. Se agregó como cuarta etapa entre "Solicitud" y
  "Corroborada".

  Umbral de urgencia (filas "en alta" marcadas en ámbar) confirmado con
  el cliente en 10 días, tal como sugería el handoff.

  Verificado con build real (`ng build shared-ui`/`staff`/`admin`, los
  tres sin errores) + Playwright contra un usuario de prueba real: clic
  en cada etapa del embudo filtra correctamente y atenúa las demás,
  "Mandar a Altas pendientes" transiciona la fila y actualiza el embudo
  en vivo, y "Llamar / verificar datos" abre el asistente de activación
  ya construido (paso 1, con "Guardar cambios"/"Llamar ahora"/
  "Programar llamada"/"Rechazar"/"Cerrar y seguir trabajando" visibles y
  funcionales).

  **Actualización 2026-09-21 — rediseño de `empresa-detalle-panel`, sobre
  un TERCER handoff de diseño (esta vez componente por componente, a
  pedido del cliente):** la carpeta "zip" volvió a cambiar de nombre
  (`Conectar repositorio al proyecto_unico/handoff/`) y el `LEEME.md`
  ahora es un manual grande que cubre **seis pantallas futuras**
  (`altas-pendientes` "hoja del día", `planes`, `suscripciones`,
  `auditoría`, `usuarios`) además de esta — se integró solo la sección
  4 (`empresa-detalle-panel`), como pidió el cliente explícitamente
  ("vamos a ir componente por componente"); el resto queda documentado
  en el `LEEME.md` para cuando toque su turno.

  Mismos tres cambios de forma que anticipaba el propio handoff:

  1. **Ya no usa `SidePanelComponent`.** Arma su propio overlay de
     pantalla completa (mismo backdrop `bg-black/50`, mismo `z-50`,
     mismas keyframes `fade-in-up`/`slide-in-right`) porque la cabecera
     y la barra de guardado ahora quedan fijas y solo el cuerpo
     scrollea — cosa que `SidePanelComponent` no permite (scrollea todo
     junto). Punto que el handoff no verificaba y sí se confirmó acá:
     este panel se sigue abriendo **anidado** arriba del
     `app-side-panel` propio de `ActivarEmpresaWizardComponent` (icono
     de información del Paso 1) — mismo `z-50`/`fixed inset-0` en
     ambos, así que el orden del DOM decide el apilado, igual que
     apilaba antes con la versión vieja. Verificado con Playwright
     abriendo el asistente desde "Altas pendientes" y clickeando el
     icono de info: se ve un solo overlay limpio, sin backdrop doble.
     `SidePanelComponent` sigue intacto — lo sigue usando el asistente.
  2. **Ya no usa `CampoDetalleComponent`** para rubro/correo/teléfono:
     van en una sola tarjeta de filas etiqueta + `<input pInputText>`.
     Primer uso de `InputTextModule` de PrimeNG en el proyecto — como
     `theme: 'none'` no inyecta CSS de tema, el input se ve 100% por las
     clases de Tailwind del propio template (`border-0 bg-transparent
     ...`), sin conflicto. `CampoDetalleComponent` también sigue intacto
     para el asistente.
  3. **Sección "Personas" nueva**: lo declarado en el registro público y
     la cuenta real (`duenoUsuario`) se muestran como dos puntos de una
     línea de tiempo, con un veredicto arriba ("Coincide con lo
     declarado" / "No coincide con lo declarado" / "La cuenta todavía no
     existe") — comparación de nombres laxa a propósito (sin acentos,
     sin mayúsculas, espacios colapsados). Badge de estado con etiqueta
     legible (`ETIQUETA_POR_ESTADO`) en vez del `estado` crudo — mismo
     mapa duplicado sin exportar que ya existe en
     `EmpresasPageComponent` (mismo criterio ya documentado que
     `TONO_POR_ESTADO`: no vale la pena un tercer archivo por siete
     líneas).

  Un ajuste propio, no pedido por el handoff: el punto "Cuenta del
  dueño" de la línea de tiempo mostraba solo nombre + estado de
  verificación, sin el correo real de esa cuenta — a diferencia del
  punto "Declarado en el registro", que sí muestra su correo. El dato
  (`dueno.correo`, de `ResumenDuenoEmpresa`) ya estaba disponible y es
  útil para el staff, así que se agregó al lado del nombre para que los
  dos puntos de la línea de tiempo sean simétricos.

  La barra inferior de guardado pasó de estar siempre visible
  (deshabilitada sin cambios) a solo aparecer cuando hay algo que decir
  (cambios sin guardar / guardando / guardado / error) — suma un estado
  "Cambios guardados." que no existía antes.

  Sin tokens ni tipografía nueva esta vez — reutiliza `font-display` y
  los tokens `badge-info` que ya se habían sumado con el rediseño de
  `empresas-page`.

  Verificado con build real (`ng build staff`, sin errores) + Playwright
  contra datos reales de la base de prueba: Empresa sin cuenta todavía
  ("la cuenta todavía no existe"), Empresa con cuenta real coincidente
  (veredicto verde, correo real visible), Empresa rechazada (sección
  "Motivo de rechazo" visible), edición de los tres campos editables con
  "Guardar cambios" actualizando la fila de la lista en vivo sin
  recargar, y el panel anidado dentro del asistente de activación desde
  "Altas pendientes". No había en la base de prueba ninguna Empresa con
  nombre declarado distinto al de la cuenta real, así que el veredicto
  "No coincide" se verificó por revisión de código, no con screenshot.


**Actualización 2026-09-21 — rediseño de `altas-pendientes-page` +
`activar-empresa-wizard`, cuarto componente del mismo handoff (LEEME.md
§3 y §5):** siguiente en la lista "componente por componente" que pidió
el cliente, con instrucción explícita de seguir el `LEEME.md` con
cuidado. Dos archivos por pantalla, cuatro en total.

**`AltasPendientesPageComponent` ("hoja del día"):**

1. **Se fue la tabla.** `p-table`, `dataTablePt()` y `DataTableComponent`
   ya no se usan acá (siguen intactos, en uso en otras pantallas). La
   lista pasa a ser dos secciones de tarjetas: "Te toca llamar" (con
   corte visual entre las urgentes y el resto) y "Esperando al cliente".
2. Tres constantes nuevas son supuestos de diseño a ajustar al proceso
   real, tal como el propio handoff advierte: `UMBRAL_URGENTE = 10`
   (reutiliza el mismo umbral de "más de 10 días" ya confirmado con el
   cliente en el rediseño de `empresas-page` del 17/9, no uno nuevo),
   `DIAS_REINTENTO = 3` y `MAX_DESTACADAS = 3` (el resalte cálido se
   limita a las tres peores a propósito — con cola larga, pintar todas
   las vencidas hace que el color deje de significar algo).
3. **`agendadaEn` sigue sin sobrevivir un refresh.** `programarLlamada`
   ya persiste del lado del backend, pero `GET /empresas` no devuelve
   esa fecha, así que la etiqueta "Agendada …" de la fila vive en un
   signal en memoria de la página, tal como advertía el handoff. Cuando
   se exponga el campo del lado del backend, hay que leerlo de ahí y
   sacar el signal.

**`ActivarEmpresaWizardComponent`:**

1. **`fase: FaseWizard` (`'preparar' | 'enCurso' | 'esperando' |
   'activada'`) reemplaza lo que lee el template** de los tres signals
   viejos (`paso`, `llamadaIniciada`, `exito`) — esos tres siguen siendo
   la fuente real, así que la lógica de red (mismos métodos de
   `EmpresaService`: `corregirNombre`, `actualizar`, `cambiarPlan`,
   `programarLlamada`, `llamadaFinalizada`, `reenviarEnlace`,
   `rechazar`, mismo `RealtimeService.escuchar`) quedó igual.
2. **Ya no usa `SidePanelComponent` ni `CampoDetalleComponent`.** Mismo
   cambio de forma que `empresa-detalle-panel` diez días antes: overlay
   de pantalla completa propio, mismo `bg-black/50` + `z-50` + keyframes
   `fade-in-up`/`slide-in-right`. Los dos componentes siguen intactos,
   en uso en otras pantallas.
3. **Los dos modales (confirmar llamada finalizada / rechazar) quedaron
   inline**, ya no usan `ModalComponent` (que sigue intacto, en uso en
   otras pantallas) — el de confirmar lleva un mini-checklist y un
   bloque de consecuencias, no dos botones genéricos. Los dos van a
   `z-[60]`, por encima del `z-50` del asistente — mejora propia sobre
   depender solo del orden del DOM, que es lo que usa el resto de los
   overlays superpuestos del proyecto.
4. **Guion mínimo de llamada + cronómetro**: cuatro puntos tildables
   (nunca obligatorios — el botón "Terminé la llamada" funciona igual
   sin tildar ninguno) y un cronómetro en vivo (`00:01`, `00:02`…)
   mientras `fase() === 'enCurso'`. Verificado con Playwright: tildar
   puntos del guion, ver el cronómetro correr, y el botón habilitado en
   todo momento.
5. **`verEmpresa()`** navega a `/empresas` (antes no existía esa salida
   directa desde la pantalla final).

**Hueco encontrado en el handoff, corregido acá:** el `.ts` traía
`abrirDetalle()`/`cerrarDetalle()` y el signal `mostrarDetalle`
intactos, y el `.html` traía el bloque `@if (mostrarDetalle()) {
<app-empresa-detalle-panel ... /> }` al final — pero **ningún botón del
`.html` nuevo llamaba a `abrirDetalle()`**. La versión vieja del
asistente sí tenía ese disparador: un ícono de información junto a
"Datos a confirmar" en el paso 1, con `aria-label="Ver todos los datos
de la Empresa"`. Se restituyó ese botón en la cabecera del nuevo
asistente (junto al de cerrar, visible salvo en la fase "activada" — ya
no tiene sentido revisar datos después de la activación, esa pantalla
ya ofrece "Ver la Empresa"), llamando al mismo `abrirDetalle()` que ya
traía el handoff. Es el único punto de este handoff que no se siguió
al pie de la letra — todo lo demás sí, incluido el resto del §5 del
`LEEME.md`.

Esto era el punto más delicado de todo el handoff: el asistente dejó de
usar `SidePanelComponent`, así que había que confirmar que
`EmpresaDetallePanelComponent` (que también arma su propio overlay
`z-50` desde el rediseño anterior) se siguiera anidando arriba sin
backdrop doble ni problema de apilado. Verificado con Playwright:
clickeando el botón restituido se ve un solo overlay limpio encima del
asistente, igual que se veía anidado sobre la versión vieja con
`app-side-panel`.

**Keyframes nuevas — solo en `staff/src/styles.css`, no en
`admin`** (mismo criterio que `slide-in-right`: son de una pantalla que
no existe del otro lado): `latido` (el punto verde de "Llamada en
curso" y el hito "ahora" de la línea de progreso del paso 2, pulso
`opacity`/`scale`), `aparecer` (entrada del paso 2 y de los dos modales
inline, un fade con leve `scale` sin desplazamiento vertical), `pop`
(el círculo de tilde de la pantalla "Activada", con rebote vía
`cubic-bezier` con overshoot) y `onda` (el anillo que se expande y se
desvanece en loop detrás de ese círculo).

Verificado con build real (`ng build staff`, sin errores) + Playwright
contra datos reales de la base de prueba: la hoja del día completa
(sección "Te toca llamar" con el corte urgente/no urgente, "Esperando
al cliente" con "Reenviar el enlace"), el asistente en fase "preparar"
(incluida una fila sin teléfono, con "Llamar ahora" bloqueado y
reemplazado por el aviso correspondiente — comportamiento que ya venía
en el propio template condicional), la fase "enCurso" con guion
tildándose y cronómetro corriendo, el modal de confirmar llamada
finalizada, la fase "esperando" con la línea de progreso y la animación
`latido` en el hito "ahora", el modal de rechazo (`z-[60]` por encima
del asistente), "Reenviar el enlace" desde la hoja abriendo el
asistente directo en el paso 2, y el panel de detalle anidado (con el
botón restituido) sobre el asistente nuevo. La fase final "activada"
(que llega por WebSocket o por el poll cuando el cliente confirma) no
se pudo disparar en vivo sin simular esa confirmación del cliente — se
revisó por código: mismo patrón de clases `animate-[...]` con las
keyframes `pop`/`onda`/`aparecer` ya verificadas funcionando en la fase
"esperando" con `latido`, así que no hay motivo para esperar un
comportamiento distinto.


**Actualización 2026-09-21 — rediseño de `planes-page` ("catálogo
comparado"), siguiente componente del mismo handoff (LEEME.md §6):**
sigue el `abrirDetalle()`/`activar-empresa-wizard` de más arriba en la
lista "componente por componente".

Deja de ser una tabla de cinco columnas con un modal de edición y pasa a
ser una matriz: un plan por columna, las características como filas
compartidas.

1. **Se fue el modal.** `ModalComponent`, `FormularioPlan` y el textarea
   de "una característica por línea" ya no se usan acá — era el punto
   más frágil de la versión anterior (se editaba a ciegas, sin ver cómo
   quedaba el plan al lado de sus vecinos). Ahora se edita en la celda,
   con `<input pInputText>` (mismo primer uso de `InputTextModule` que
   `empresa-detalle-panel`). `ModalComponent` sigue intacto, en uso en
   otras pantallas. También se fue la columna "N ítems", que escondía
   justo lo que diferencia un plan de otro.
2. **Los huecos se detectan solos** (`esHueco`): si un plan más caro NO
   incluye algo que sí incluye uno más barato (activo), la celda sale en
   ámbar con un triángulo y el párrafo de arriba (`lectura()`) lo dice
   en palabras — verificado con Playwright en dos escenarios: el hueco
   que ya traía la base de prueba (Plus vs. Base) y uno nuevo generado
   en vivo al reactivar un plan más barato que sí cubría algo que el más
   caro no tiene.
3. **Nada se guarda al tocar.** Los cambios (nombre, precio, descripción,
   características marcadas, plan nuevo) viven en el signal `borrador` y
   se publican juntos desde una barra fija al pie (`slide-up` de entrada)
   que solo existe si `hayCambios()` — esto lo ve el cliente en la
   página de precios, no es un ajuste interno. Verificado: editar,
   publicar (persiste de verdad — confirmado con reload de la página),
   y descartar (revierte todo, plan nuevo incluido, sin pegarle al
   backend).
4. **Desactivar/reactivar es una acción directa** en la columna — sí
   pega contra el backend al instante (`DELETE /planes/:id` /
   `PATCH` con `activo: true`), no un badge distinto en una celda.
   Verificado con Playwright: reactivar y volver a desactivar un plan,
   sin pasar por la barra de publicación.

**SUPOSICIÓN A VALIDAR, del propio handoff:** `Plan.caracteristicas` es
un `string[]` libre por plan — la matriz arma el *union* de todas las
características del catálogo y al publicar reconstruye el array de cada
plan. Funciona con el backend actual sin cambios, pero renombrar una
característica es un renombre por texto en todos los planes que la
tienen. Si esto se usa seguido, conviene una tabla `caracteristica` real
con relación N:M.

**Un ajuste propio sobre el handoff:** `mostrarSuscripciones` pedía
`SuscripcionService.listar()` **sin filtro de estado**, así que el
conteo "Empresas por plan" iba a incluir suscripciones canceladas o
vencidas — de haber alguna en la base, se hubiera contado como cliente
activo sin serlo. Se agregó el filtro `listar('activa')`, el mismo que
ya usa `EmpresasPageComponent` para lo mismo (`GET
/suscripciones?estado=activa` + cruce con `PlanService.listarTodos()`
en memoria). No fue posible confirmar la diferencia con datos reales
porque la base de prueba no tenía ninguna suscripción cancelada o
vencida en ese momento — corregido por revisión de código y por
coherencia con el criterio ya establecido, no por comparación de
antes/después con Playwright.

**Otro ajuste propio, de tipos, no de lógica:** `desactivar()` devuelve
`Observable<void>` y `reactivar()` `Observable<Plan>` — el handoff
unificaba las dos ramas en una constante `request` sin anotar, y el
compilador de Angular no podía resolver qué sobrecarga de `.subscribe()`
aplicaba sobre esa unión de tipos (`ng build` fallaba). Se anotó
`request: Observable<unknown>` explícitamente — el `next` de esa
suscripción no usa el valor emitido, así que el tipo real nunca importó,
solo hacía falta decírselo al compilador.

**Keyframe nueva — solo en `staff/src/styles.css`, no en `admin`**
(mismo criterio que las demás): `slide-up`, la entrada de la barra de
publicación desde el borde inferior de la pantalla, análoga a
`slide-in-right` pero en vertical.

Verificado con build real (`ng build staff`, sin errores ni warnings —
se corrigió también un warning de Angular sobre `attr.aria-label`
estático que traía el handoff, cambiado a `aria-label` a secas) y
Playwright contra datos reales de la base de prueba: la matriz completa
con sus tres planes (uno desactivado), el hueco ya existente entre Plus
y Base, agregar una característica nueva y un plan nuevo (con su
columna vacía y grid recalculado), descartar (revierte todo sin tocar
el backend), editar y publicar una descripción (con reload para
confirmar que persistió del lado del backend) y luego revertirla de la
misma forma, y reactivar/desactivar un plan de forma directa (sin pasar
por la barra de publicación), que de paso generó un segundo hueco en
vivo y confirmó que `lectura()` lo detecta dinámicamente.


**Actualización 2026-09-21 — rediseño de `suscripciones-page` ("ingresos
por Empresa"), siguiente componente del mismo handoff (LEEME.md §7):**
sigue el de `planes-page` en la lista "componente por componente".

Dos cambios de tesis respecto de la tabla anterior:

1. **Una fila por Empresa, no por registro.** El historial venía ordenado
   por `creadoEn desc` con todas las Empresas mezcladas, así que las dos
   suscripciones de una misma Empresa quedaban separadas por filas de
   otras Empresas. Ahora se agrupa por `empresaId`, la vigente al frente
   y el resto en una línea de tiempo que se despliega con el chevron
   (keyframe `desplegar`, nueva). Verificado con Playwright: desplegar el
   historial de una Empresa con dos planes, ver la línea de tiempo con el
   punto verde en el vigente.
2. **Esto es plata.** La pantalla ahora cruza `Plan.precioMensual` y
   expone el MRR total, el desglose por plan y el monto de cada Empresa.
   Verificado en vivo: el MRR y el desglose por plan se recalculan
   correctamente después de un cambio de plan real (ver más abajo).

Además: los estados hablan castellano y dicen la consecuencia
(`ESTADO_UI`: "Cobrando", "Sin cobrar aún"), el orden es por facturación
y no por fecha de creación, y ya no usa `ModalComponent`/`p-table`/
`dataTablePt()`/`DataTableComponent` (siguen intactos, en uso en el
resto del panel de staff). No hay "crear" ni "eliminar": una Suscripción
nace con el alta de una Empresa o con un cambio de plan (cierra la vieja,
abre una nueva) — nunca se crea ni se borra a mano.

**A pedido explícito del cliente — distinto del resto de los handoffs
integrados hasta acá, que traían el panel embebido en un `@if` dentro de
la página: el panel de "Mover a otro plan / cambiar el estado" se separó
en un componente aparte, `GestionarSuscripcionPanelComponent`
(`features/suscripciones/pages/gestionar-suscripcion-panel/`), mismo
patrón que ya tenían `EmpresaDetallePanelComponent`
(`features/empresas/pages/`) y `ActivarEmpresaWizardComponent`
(`features/altas-pendientes/pages/`) — un componente por panel, sibling
de la página en `pages/`, no un bloque más del template de la página.**

Cómo quedó dividido:

- **`SuscripcionesPageComponent`** conserva toda la lista: MRR, desglose
  por plan, filtros, agrupado por Empresa, historial desplegable. Guarda
  solo `empresaGestionandoId: signal<number | null>` (antes era
  `filaGestionando: signal<FilaEmpresa | null>`, la fila entera) y se lo
  pasa al panel como `[empresaId]`.
- **`GestionarSuscripcionPanelComponent`** recibe `[empresaId]` y carga
  por su cuenta la Suscripción vigente de esa Empresa
  (`SuscripcionService.listar(undefined, empresaId)`), el nombre
  (`EmpresaService.obtenerUno`) y el catálogo de planes activos
  (`PlanService.listarTodos`) — mismo criterio que
  `EmpresaDetallePanelComponent`: no depende de que la página ya tenga
  esos datos en memoria, se abre y se cierra sola. `(cerrar)` y
  `(actualizada)` son los mismos dos eventos que ya usan los otros dos
  paneles.
- **Una excepción deliberada:** además de `empresaId`, el panel recibe
  `[mrrTotal]` como segundo `input`. La nota del cambio de plan dice a
  cuánto pasa la facturación mensual de TODO Goods (no solo de esta
  Empresa) — recalcular ese número acá adentro exigiría traer las
  Suscripciones de las demás Empresas otra vez, por un solo valor que la
  página ya tiene calculado. Se pasa tal cual en vez de recargarlo.
  Verificado con Playwright: bajar "Taller Creativo Norte" de Plus
  ($140.000) a Base ($100.000) mostró correctamente "La facturación
  mensual de Goods pasa a $700.059,9" (740.059,9 − 40.000), calculado con
  el `mrrTotal` recibido de la página.
- **El aviso de éxito sigue viviendo en la página, no en el panel.** El
  panel emite `actualizada` con el mensaje ya armado (ej. "Taller
  Creativo Norte pasó a Base.") en vez de un evento vacío — la página lo
  usa tal cual para el toast de abajo a la derecha, que aparece recién
  después de que el panel ya se cerró (por eso no podía vivir dentro del
  panel: para cuando se muestra, el panel ya no está montado). La página
  también dispara su propio `cargar()` al recibir `actualizada`, para
  traer los montos y el desglose actualizados.
- **`ESTADO_UI` y `formatCop` quedaron duplicados** entre la página y el
  panel — mismo criterio ya documentado varias veces (`TONO_POR_ESTADO`/
  `ETIQUETA_POR_ESTADO` en Empresas): no vale la pena un archivo
  compartido por un mapa de cuatro líneas.

Verificado con build real (`ng build staff`, sin errores ni warnings,
primer intento) y Playwright contra datos reales de la base de prueba:
la lista completa con MRR/desglose/filtros, desplegar el historial de
una Empresa con dos planes, abrir el panel nuevo (confirmando que carga
sus propios datos de forma independiente), elegir un plan más barato y
ver el delta calculado correctamente con el `mrrTotal` recibido por
`input`, aplicar el cambio de verdad (el panel se cerró solo, apareció
el toast en la página, la lista se refrescó con los montos nuevos) y
revertirlo de la misma forma, y cerrar el panel tanto con el botón X
como haciendo click en el backdrop.


**Actualización 2026-09-21 — rediseño de `auditoria-page` ("bitácora"),
cuarto componente del mismo handoff (LEEME.md §8): sigue el de
`suscripciones-page` en la lista "componente por componente".**

La tabla anterior era el log HTTP crudo: `PATCH /empresas/14` es una ruta,
no una acción; el usuario era un número; tres intentos de login fallidos
seguidos se veían igual que un PATCH exitoso. Una auditoría se lee de dos
maneras — barriendo ("¿pasó algo raro?") e investigando ("¿quién tocó
Empresa 14?") — y la tabla no servía para ninguna. Cinco cosas nuevas,
todas sacadas de lo que el endpoint ya devuelve:

1. **`REGLAS`: la ruta se traduce a una frase** — `POST
   /api/suscripciones/cambiar-plan` con `cuerpo.empresaId: 14` → "Cambió
   el plan de Empresa #14". Once reglas por endpoint de escritura, más el
   fallback `METODO /ruta` para lo que no tiene regla todavía.
2. **`alertas()`: anomalías detectadas en cliente** — 3+ intentos de
   sesión fallidos desde una misma IP, acciones hechas fuera de un
   navegador (`userAgent` con `PostmanRuntime`/`curl`/etc.), cambios
   sensibles (permisos y bajas).
3. **`pulso()`: volumen por hora del día**, con los errores apilados en
   rojo — el pico se ve sin leer una fila.
4. **El `cuerpo` por fin se usa** (pestaña "Datos" del panel), con
   `[oculto]` mostrado como "No se guarda".
5. **`rastroPanel()` / `verRastroCompleto()`**: modo investigación — todo
   lo que pasó con una misma entidad, filtrando la bitácora por
   `entidad`+`entidadId`.

Agrupado por día, orden estricto descendente por `creadoEn`, panel de
detalle partido en tres pestañas (Resumen / Datos / Técnico) con el
contexto de sesión (`sesion()`: otras acciones de la misma persona/IP en
la misma media hora). `SearchToolbarComponent`/`p-table`/`dataTablePt()`/
`DataTableComponent`/`p-popover`/`p-date-picker` se fueron de esta
pantalla — siguen en uso en el resto del panel.

**El panel de detalle NO se extrajo a un componente aparte**, a
diferencia de `EmpresaDetallePanelComponent` / `ActivarEmpresaWizardComponent`
/ `GestionarSuscripcionPanelComponent` (ver esos tres): el pedido
explícito del cliente de separar el panel en un componente fue puntual
para suscripciones, y los tres paneles ya separados comparten un patrón
que este no tiene — cargan sus propios datos por `id` contra el backend,
independientes de lo que ya tenga cargado la página. El panel de
auditoría es lo opuesto: es una vista derivada de `leibles()`, la lista
ENTERA ya cargada por la página (`sesion()` y `rastroPanel()` recorren
todas las acciones ya en memoria) — extraerlo exigiría pasarle la lista
completa como `input` igual, sin ahorrar ninguna carga. Se deja como en
el handoff: un bloque `@if` dentro de la página.

Verificado antes de integrar, tal como pedía LEEME.md §8:
`environment.apiUrl` es `http://localhost:3000/api` y
`AuditoriaAccionInterceptor` guarda `ruta: request.originalUrl`, que sí
incluye ese prefijo (`main.ts` llama `app.setGlobalPrefix('api')`) — las
regex de `REGLAS`, todas ancladas a `/api/...`, matchean contra los
valores reales guardados (confirmado en vivo con la pestaña "Técnico":
`Ruta: /api/planes/1`). `UsuarioService.listar()` no toma argumentos y
devuelve `RespuestaPaginada<UsuarioGoods>` con `nombres`/`apellidos`/
`correo` — coincide tal cual con lo que espera `cargar()`.

**Cuatro ajustes propios al integrar — bugs del handoff, no decisiones de
diseño, los primeros dos hacían que `ng build` no compilara con
`strictTemplates`:**

1. `accion.cuando` y `accion.caja`, usados en el encabezado del panel de
   detalle, no existían en la interfaz `AccionLeible` del handoff — se
   agregan ahí, calculados una sola vez en `leibles()` (TS2339 sin esto).
2. `dias()` tipaba `filas` como `ReturnType<typeof this.aFila>[]` inline
   dentro del `computed()`, lo que disparaba TS2683 ("'this' implicitly
   has type 'any'") — se extrajo `FilaAuditoria` como interfaz propia y
   se anotó el retorno de `aFila()` con ella.
3. La regla de login en `REGLAS` solo cubría `/api/auth/login` (el que
   usa el panel `admin`) — se amplió a `/api/auth/login(-staff)?`, el que
   de verdad pega el panel de staff (`AuthController`, `@Post('login-staff')`).
   Sin esto, el login — la acción más frecuente de esta pantalla — caía
   siempre al fallback genérico en vez de mostrar "Inició sesión".
4. Ninguna keyframe nueva hacía falta: `fade-in-up` y `slide-in-right`
   (las que usa esta pantalla para el panel) ya estaban en
   `staff/src/styles.css` desde rediseños anteriores.

Verificado con build real (`ng build staff`, sin errores ni warnings tras
los cuatro ajustes) y Playwright contra datos reales de la base de
prueba: lista agrupada por día con las cifras/alertas/pulso, la regla de
login-staff mostrando "Inició sesión" en vez del fallback crudo, abrir el
panel de detalle y navegar las tres pestañas (Resumen con "Quién y desde
dónde" + "En la misma sesión", Datos con los campos reales del payload,
Técnico con método/ruta/estado/IP/agente), "Ver todo el rastro" filtrando
la bitácora a una sola entidad (`plan #6`, 2 acciones) y volviendo con el
chip "Salir del rastro", los cinco lentes (incluido "Sensibles"),
búsqueda con resultado vacío ("Nada con estos filtros") y cerrar el panel
con el botón X.


**Corrección 2026-09-21 (más tarde el mismo día) — el panel de detalle de
`auditoria-page` SÍ se separó en un componente aparte.** El párrafo de
arriba decía que no, por no encajar con el patrón de carga independiente
de los otros tres paneles — el cliente pidió explícitamente mantener la
misma estructura de `pages/` para todos los módulos, así que se corrigió:

**`AccionDetallePanelComponent`** (`features/auditoria/pages/accion-detalle-panel/`)
— mismo patrón de carpeta que `EmpresaDetallePanelComponent` /
`ActivarEmpresaWizardComponent` / `GestionarSuscripcionPanelComponent`: un
componente por panel, sibling de la página en `pages/`.

La diferencia real con esos tres sigue siendo cierta y se documenta en el
propio componente: este panel no carga sus datos por `id` contra el
backend. Recibe `[accionId]` (qué acción mostrar) y `[acciones]` — la
lista COMPLETA `leibles()` que ya cargó la página — porque "En la misma
sesión" y "Historia de X" necesitan recorrer todas las acciones, y
recargar eso por su cuenta significaría reimplementar ahí adentro las 11
reglas de `REGLAS`/`describir()`/`agente()` de la página y pegarle una
segunda vez a `AuditoriaService.listar()` + `UsuarioService.listar()`. Es
la misma clase de excepción que `[mrrTotal]` en
`GestionarSuscripcionPanelComponent`: no todo lo que se pasa por `input`
rompe el patrón, cuando es un dato que la página ya tiene y recalcularlo
adentro del panel no ahorra nada.

Para que el panel no necesitara tampoco el mapa `nombrePorUsuario` ni el
método `nombreUsuario()` de la página, se agregó `nombreResuelto: string
| null` a la interfaz `AccionLeible` (ahora exportada desde
`auditoria-page.component.ts`) — el nombre de usuario ya resuelto, una
vez por acción, en `leibles()`.

La navegación DENTRO del panel (botones de "En la misma sesión"/"Historia
de X", que cambian qué acción se muestra sin cerrar el panel) no la
resuelve el panel solo: emite `(verAccion)` con el id nuevo y la página
—dueña de qué acción se está viendo— decide, reutilizando el mismo
`abrirPanel()` que abre desde la lista. "Ver todo el rastro" emite
`(verRastro)` con la entidad; la página arma el filtro transversal y
cierra el panel (antes esto lo hacía `verRastroCompleto()` en la propia
página, ahora es `onVerRastro()`).

Verificado con build real (`ng build staff`, sin errores ni warnings tras
la extracción — incluida la referencia cruzada de tipos entre
`auditoria-page.component.ts` y `accion-detalle-panel.component.ts`, con
`import type` de un lado para que no genere un ciclo real en el JS
compilado) y Playwright: abrir el panel desde una fila de la lista,
navegar internamente a otra acción desde "En la misma sesión" sin que el
panel se cierre, las tres pestañas, "Ver todo el rastro" cerrando el
panel y activando el filtro transversal correctamente — mismo
comportamiento exacto que antes de la extracción, cero errores de consola
en todo el flujo.


**Actualización 2026-09-21 (más tarde el mismo día) — rediseño de
`usuarios-page` ("matriz de accesos"), quinto componente del mismo
handoff (LEEME.md §9): sigue el de `auditoria-page` en la lista
"componente por componente".**

La pantalla anterior era una tabla + tres modales (crear/editar/eliminar)
sin forma de ver de un vistazo quién puede hacer qué. La nueva es una
matriz: una fila por persona (agrupadas por rol), una columna por módulo,
el nivel de acceso como medidor de tres barras (Sin acceso/Solo ver/
Editar/Todo). El rol se elige viendo lo que concede, no por su nombre.

**El panel se separó en DOS componentes aparte** (no uno con `modo()`
interno como traía el handoff), mismo patrón de `pages/` que el resto de
los módulos: `FichaUsuarioPanelComponent` (ver/editar a alguien que ya
existe) y `CrearUsuarioPanelComponent` (dar de alta). El handoff los
trataba como dos cuerpos muy distintos compartiendo solo el contenedor
deslizable — separarlos en dos componentes, uno por concepto, es más
consistente con el resto de la app.

`CrearUsuarioPanelComponent` es completamente autónomo (no hay ninguna
fila existente con la que cruzar un diff), así que carga su propia copia
de `MODULOS`/`nivelDe()` — misma clase de duplicación deliberada que
`fechaCorta`/`horaCorta` en `AccionDetallePanelComponent`.
`FichaUsuarioPanelComponent` en cambio sí depende de la página: mientras
hay un cambio de rol en preview, la fila de esa persona en la matriz (a
la izquierda, fuera del panel) tiene que pintar el mismo diff y el velo
del panel se vuelve transparente para que se vea — por eso `rolPreview`
sigue viviendo en la página (el panel lo recibe por `[rolPreviewId]` y lo
cambia emitiendo `(rolPreviewSeleccionado)`) y `matrizPanel()`/
`textoCambioRol()` se calculan en la página y se pasan ya armados. Misma
clase de excepción que `[mrrTotal]`/`[acciones]` en los paneles
anteriores.

Ajustes propios hechos durante la integración (no estaban en el handoff):

- **`RUTA_LOGIN` no matcheaba nunca** — mismo bug ya corregido en
  `auditoria-page`: el handoff traía `/^\/api\/auth\/login$/`, pero el
  staff siempre entra por `/api/auth/login-staff`. Sin el fix,
  `reconstruirAccesos()` nunca encuentra un login de staff y toda la
  función (estado/último acceso/tira de 14 días) queda rota para el
  propio personal de Goods. Corregido a `/^\/api\/auth\/login(-staff)?$/`.

- **Columna "Altas pendientes" completamente rota** — el LEEME ya avisaba
  "ojo altas" y tenía razón: se verificó contra la tabla `permiso` real
  (`SELECT codigo, modulo FROM permisos`, no solo migraciones) y no existe
  ningún `modulo = 'altas'` — `empresas.activar`/`empresas.rechazar`/
  `empresas.gestionar_alta` están agrupados bajo `modulo: 'empresas'`.
  Sin corregir, esa columna mostraba "Sin acceso" para TODOS los roles,
  incluido admin/staff_goods. Se agregó un campo opcional `codigos?:
  string[]` a la definición de columna (`ModuloDef`) que `nivelDe()` usa
  para matchear por código exacto en vez de por `modulo`/prefijo cuando
  está presente — usado solo para la columna `altas`.

- **`PAGINA_AUDITORIA = 500` reventaba la pantalla ENTERA, siempre** —
  este no es el mismo tipo de ajuste menor que los anteriores: todo
  endpoint paginado del backend hereda `PaginationQueryDto`, que fuerza
  `@Max(100)` en `pageSize` a propósito. Pedir 500 no traía "menos
  cobertura a partir de cierta escala" como sugería el comentario del
  handoff — hacía que `GET /auditoria` respondiera 400 SIEMPRE, lo que
  rompía el `forkJoin` completo y la pantalla se quedaba mostrando "No se
  pudo cargar el personal de Goods" de forma permanente, para cualquier
  cantidad de personal. Bajado a 100 (el máximo real) para que la
  pantalla cargue — sigue siendo una ventana chica para reconstruir
  accesos con más de ~100 acciones de auditoría recientes entre todo el
  personal, así que el punto del LEEME de mover este cálculo al backend
  (un `ultimoAccesoEn` real en `Usuario`) sigue vigente y es más urgente
  de lo que el handoff pensaba.

- **`<i-tabler>` no existe en este codebase** — el selector real de
  `TablerIconComponent` es `tabler-icon` (confirmado contra el `.mjs`
  compilado). El handoff usaba `<i-tabler [icon]="x" class="size-N">` en
  los 15 lugares donde usa un ícono; convertido a `<tabler-icon [icon]="x"
  [size]="Npx" [stroke]="N" />`, con las clases que no eran de tamaño
  movidas a `class`.

- **Clases `animate-*` sueltas no hacían nada** — este codebase no define
  tokens `--animate-*` de Tailwind; toda animación usa la sintaxis de
  valor arbitrario (`animate-[nombre-keyframe_duración_timing]`) contra
  los `@keyframes` crudos de `styles.css`. El handoff usaba
  `animate-fade-in-up`/`animate-slide-in-right`/`animate-desplegar`/
  `animate-latido` sueltos (no hacen nada así) y dos bindings
  `[class.animate-latido]="cond"` (sintaxis inválida con corchetes en el
  nombre de clase) — convertidos a la sintaxis de corchetes con las
  duraciones ya usadas en los módulos anteriores, y los dos
  `[class.animate-latido]` reescritos como `[class]="cond ? '...' : ''"`.

- **Firma de `nivelDe()` cambiada** de `(rol, moduloId: string)` a `(rol,
  modulo: ModuloDef)` — necesario para que pueda leer el nuevo campo
  `codigos` de la columna, no solo su `id`.

- **Bug real de timing con signal inputs en `CrearUsuarioPanelComponent`**
  — inicializar el signal `formulario` leyendo
  `this.rolPreseleccionado()`/`this.roles()` directamente en el
  inicializador de campo tira `NG0950` ("Input is required but no value
  is available yet"): los signal inputs todavía no tienen valor ni en los
  inicializadores de campo ni en el cuerpo del constructor, Angular los
  asigna después. Se resolvió sin usar `effect()`: `formulario().rolId`
  arranca en `null` (elección explícita del usuario, si la hizo) y un
  `computed` nuevo, `rolIdEfectivo`, resuelve el valor por defecto
  (preseleccionado o `staff_goods`) leyendo los inputs de forma reactiva
  en vez de una sola vez al construir.

- **Se sacó la frase "Se le pide cambiar la contraseña en su primer
  acceso"** del pie del panel de alta, tal como sugería el propio LEEME
  si no se iba a implementar: no existe ese flujo (no hay invitación ni
  `debeCambiarPassword` en `Usuario`/`CreateUsuarioDto`, la cuenta entra
  directo con la contraseña que se define en el formulario).

Sin corregir, documentado nomás (son mejoras de backend, no bugs de esta
pantalla): la reconstrucción de accesos vía `GET /auditoria` sigue siendo
frágil a escala (ver el punto de `PAGINA_AUDITORIA` arriba); no hay
`ultimoAccesoEn` en `Usuario`; no hay flujo de invitación (`POST
/usuarios` crea la cuenta con contraseña directa, no una invitación); y
`CreateUsuarioDto` del backend solo exige `MinLength(8)` en la contraseña
— sin mayúscula/número/símbolo — mientras el frontend sí lo exige. Es una
capa de UX intencional que no hace falta debilitar para "coincidir" con
el backend; la mejora pendiente es reforzar el backend, no relajar el
frontend.

Verificado con build real (`ng build staff`, sin errores tras la
extracción en tres componentes) y Playwright contra datos reales: matriz
cargando con roles dinámicos (incluye roles fuera de los tres
hardcodeados en `ETIQUETA_ROL`/`PUNTO_ROL`, con el fallback al nombre
crudo funcionando), abrir la ficha de una persona, las tres pestañas,
elegir otro rol y ver el diff pintado en el panel Y en la fila de la
matriz con el velo transparente, aplicar el cambio de verdad, crear un
usuario nuevo de punta a punta (con el rol `staff_goods` preseleccionado
por defecto), buscarlo en la matriz, y quitarle el acceso (borra la
cuenta, cierra el panel, la lista se refresca) — cero errores de consola
en todo el flujo.

**Corrección posterior (mismo día):** tres ajustes pedidos después de la
primera integración, sobre este mismo módulo:

1. **El panel vuelve a ser overlay, no push.** La primera versión seguía al
   pie de la letra la instrucción original del handoff de "empujar" el
   contenido con `marginRight` cuando había un panel abierto (ficha o
   crear). Se corrigió para que coincida con el patrón real de todos los
   demás módulos ya integrados (Empresas, Suscripciones, Auditoría...): el
   panel es un `fixed inset-0 z-50` con velo, la matriz de atrás no se
   mueve ni se encoge. Se quitó el binding de `marginRight` y la clase de
   transición de `usuarios-page.component.html`; los paneles (`ficha` y
   `crear`) ya eran overlay desde el principio, así que no hizo falta
   tocarlos.

2. **Nombres de rol humanizados.** La matriz, el selector de rol del panel
   de ficha, el panel de crear, y el texto de diff al cambiar de rol
   mostraban el slug crudo de la base (`dueno_empresa`, `admin_goods`,
   etc.). Se armó un mapa `ETIQUETA_ROL` completo con los 8 roles reales
   del sistema (sacado de las constantes con docstring de `rol.service.ts`
   para que cada etiqueta refleje el significado real, no una traducción
   literal del slug): `admin` → "Administrador", `staff_goods` → "Staff
   Goods", `admin_goods` → "Admin de Goods", `auditoria_goods` →
   "Auditoría de Goods", `empleado_goods` → "Empleado de Goods", `cliente`
   → "Cliente", `dueno_empresa` → "Dueño de la Empresa", `empleado_empresa`
   → "Empleado de la Empresa". Para un rol nuevo o ad-hoc fuera de esa
   lista (ej. el rol de prueba "soporte-690" que ya existía en la BD desde
   antes) hay un fallback (`etiquetaRolTexto`) que capitaliza cada palabra
   del slug en vez de mostrarlo crudo. `CrearUsuarioPanelComponent`
   mantiene su propia copia local (consistente con que ya era
   "completamente autónomo"); `FichaUsuarioPanelComponent`, que ya
   importaba otras constantes de la página, importa esta función en vez de
   duplicarla.

3. **El rol `admin` ve usuarios de cualquier Empresa, no solo el
   sub-conjunto de staff de Goods.** El pedido era literal ("como es super
   admin se le deben mostrar todos los usuarios del sistema pero solo a
   ese rol admin"), pero investigando el mecanismo real de login
   (`AuthService.loginParaStaff`) apareció un detalle importante: el rol
   `admin` tiene `esRolStaff: false` (es el superadmin de bootstrap,
   pensado para un futuro panel `admin`, no para `staff`) — así que
   `loginParaStaff` nunca deja pasar la identidad real `admin` dentro de
   una sesión del panel `staff`: o la rechaza, o (si el usuario tiene
   `accesoStaffGoods`) le presta la identidad `admin_goods`. Es decir, un
   chequeo literal de `rolNombre === 'admin'` no habría tenido ningún
   efecto observable hoy. La solución cubre los dos casos:
   `TenantContextData` ahora lleva también `rolNombre` y
   `esSesionCrossPanelStaff` (este último ya viaja en el JWT — es la
   bandera de "Acceso especial de superadmin" que se ve en el badge
   naranja arriba a la derecha, hoy exclusiva de la cuenta de Samuel), y
   `UsuarioService.filtroTenantUsuarios()` devuelve `{}` (sin filtro de
   Empresa) si cualquiera de las dos es cierta — la primera por si algún
   día existe login directo como `admin` fuera del panel `staff`; la
   segunda es la que efectivamente hace que hoy, adentro de `staff`, la
   sesión con acceso especial de superadmin vea las 29 cuentas reales
   repartidas en varias Empresas en vez de solo las de Goods. Antes de
   implementarlo se verificó por `psql` que las 4 cuentas con rol `admin`
   existentes tienen `empresaId: null` — el split de roles de la Fase 4
   (`ROL_DUENO_EMPRESA`) ya separó "admin de Goods" de "dueño de una
   Empresa", así que dar visibilidad total a `admin` no reabre el bug
   histórico que el filtro de tenant vino a cerrar.

Verificado de nuevo con Playwright contra datos reales tras las tres
correcciones: el panel abre como velo fijo sobre la matriz sin que esta
se mueva ni encoja (`marginRight: 0px` confirmado); la matriz, el
selector de rol de la ficha, el panel de crear usuario y el texto de
preview del cambio de rol muestran únicamente las etiquetas humanizadas
(cero apariciones de los slugs crudos `dueno_empresa`, `admin_goods`,
`auditoria_goods`, `empleado_goods`, `empleado_empresa`); y la sesión con
acceso especial de superadmin ve "29 cuentas" repartidas en los 8 grupos
de rol, incluyendo 14 personas bajo "Dueño de la Empresa" y 7 bajo
"Cliente" de distintas Empresas — antes de este ajuste esa misma sesión
solo veía el subconjunto de Goods. Cero errores de consola en todo el
flujo.

**Segunda corrección (mismo día): "nunca entró" para todos + presencia en
línea.** El usuario notó que la columna `Usuario.ultimoAcceso` del backend
aparecía en `null` para todas las cuentas, y que la matriz de Usuarios
mostraba "nunca entró" hasta para la propia cuenta con la que estaba
probando — que había entrado decenas de veces ese mismo día. Investigando
aparecieron dos bugs reales, no uno:

1. `Usuario.ultimoAcceso` (columna `ultimo_acceso`) existía en la entidad
   desde antes, pero nada la escribía — confirmado por código (no
   aparecía en ningún `.update()`/`.save()` de `AuthService`) y por base
   (0 de 29 cuentas con valor). La pantalla de Usuarios ni siquiera la
   leía: reconstruía "último acceso" enteramente filtrando `GET
   /auditoria` (ver la nota de arriba sobre por qué "conviene un
   `ultimoAccesoEn` en el backend").
2. Esa reconstrucción vía auditoría tampoco funcionaba, por una razón más
   sutil: cada intento de login SÍ queda auditado por
   `AuditoriaAccionInterceptor` (el interceptor global), pero siempre con
   `usuario_id: null` — en el momento en que un login corre, `request.user`
   todavía no existe (es el propio login el que lo crea), así que ninguna
   captura automática puede saber QUIÉN entró. El frontend descarta esas
   filas justo por tener `usuarioId: null`. Había un único registro manual
   con el id real — la rama de "acceso especial de superadmin" de
   `AuthService.loginParaStaff` — pero quedó escrito con
   `ruta: '/auth/login-staff'` (sin el prefijo `/api` que sí lleva todo lo
   demás en esa tabla, porque el server corre con `setGlobalPrefix('api')`),
   así que el regex `RUTA_LOGIN` del frontend nunca hacía match con esas
   filas tampoco — 51 logins reales, invisibles. Y esa rama manual era la
   ÚNICA que auditaba algo: cuando alguien entraba con su propio rol real
   de staff (el caso más común, `loginParaStaff` rama 1), no se registraba
   nada en absoluto.

Arreglado con `AuthService.registrarAccesoExitoso()`, un método
compartido que se llama desde `login()` y las DOS ramas de
`loginParaStaff()` (nunca desde `refrescarToken()` — un refresh no es un
acceso nuevo, pasa solo cada pocos minutos mientras la sesión sigue
abierta) y hace dos cosas: guarda `Usuario.ultimoAcceso` de verdad
(`UsuarioService.registrarUltimoAcceso`), y registra el login a mano en
`auditoria_acciones` con el usuarioId real y la ruta CON el prefijo
`/api`. El frontend (`usuarios-page.component.ts` y
`ficha-usuario-panel.component.ts`, cada uno con su propia copia de
`ultimoMsEfectivo()` — mismo criterio de duplicación que el resto del
módulo) combina `usuario.ultimoAcceso` con `acceso.ultimoMs`
(reconstruido de auditoría) tomando el más reciente de los dos, en vez de
reemplazar uno por el otro — así no se pierde el historial de accesos que
ya estaba auditado antes de este fix (las 51 filas del acceso especial de
superadmin, ahora sí visibles con el prefijo corregido).

De paso, el usuario preguntó si existía algo de "usuario en línea" — no
existía. Se construyó sobre `RealtimeGateway` (el WebSocket compartido
que ya usaba el chat de soporte y el asistente de activación, no uno
nuevo): un contador en memoria por usuarioId
(`conteoPorUsuario`, sube/baja en `handleConnection`/`handleDisconnect`,
cuenta conexiones porque una misma persona puede tener varias pestañas
abiertas), una sala nueva `staff:presencia` (a la que se une, al
conectar, cualquiera cuyo rol tenga `usuarios.ver` — el mismo permiso que
protege la pantalla, no reutiliza la sala de soporte porque son permisos
distintos), y un evento `presencia:cambio` que se emite SOLO en las
transiciones (0 conexiones → 1, o 1 → 0), no en cada conexión/desconexión
individual. `GET /usuarios/en-linea` (mismo permiso `usuarios.ver`,
ruta literal declarada ANTES de `@Get(':id')` para que Nest no la
confunda con un id) da la foto inicial; el frontend se suscribe aparte al
evento en vivo para mantenerla al día. El socket, que antes solo se
abría en las pantallas que necesitaban escuchar algo puntual (Usuarios,
el asistente de activación de empresa), ahora también se abre desde
`ShellComponent` (el layout raíz de toda sesión de staff autenticada,
vía `RealtimeService.mantenerConectado()`) — si no, alguien navegando por
Empresas o Planes nunca contaría como "conectado" aunque esté usando la
app en ese momento.

En la matriz y en la ficha, "en línea ahora" (verde, con un punto sobre
el avatar/indicador de estado) reemplaza al texto de días cuando aplica —
es más específico y más cierto que "hace X días" en el instante en que
de verdad hay una conexión abierta.

Verificado con Playwright con dos sesiones simultáneas (contextos de
browser separados) más una tercera "mirando" la matriz: el login con rol
real de staff (`staff_goods`, antes completamente sin auditar) y el login
del acceso especial de superadmin quedan ambos con `ultimoAcceso`
guardado y con una fila `/api/auth/login-staff` en `auditoria_acciones`
con su usuarioId real (confirmado por `psql`); "2 con acceso esta semana"
en vez de 0; las dos cuentas conectadas muestran el punto verde y "en
línea ahora" tanto en la matriz como en la ficha; y al cerrar una de las
dos sesiones, la otra pestaña (que seguía con la matriz abierta, sin
recargar) pasó sola de "en línea ahora" a "hace minutos" en cuanto llegó
el evento de desconexión. Cero errores de consola en las tres sesiones.

**Roles y permisos ("matriz de permisos") — integrado 2026-09-22.**
Reemplaza la tabla de 4 columnas + los tres modales (crear/editar,
asignar permisos, eliminar) de la pantalla anterior por la matriz
roles × módulos del LEEME (§10): el acceso de un rol a un módulo es
**acumulativo** (0 sin acceso, 1 `ver`, 2 `ver+crear`, 3 `+editar`, 4
`+eliminar`), con un segmento por acción real del módulo — no todos
tienen cuatro, `auditoria`/`permisos` tienen una sola acción y la celda
dibuja un solo segmento, no cuatro vacíos. Un panel único hace de
ficha, edición y alta (con presets "Sin acceso"/"Solo lectura"/"Acceso
total" y plantillas de partida al crear), y una barra flotante agrupa
los cambios sin guardar de los roles que quedaron tocados fuera del
panel.

Sin cambios de backend: `RolService`/`Rol`/`Permiso` del frontend ya
tenían exactamente lo que pedía el handoff (`listar`, `crear`,
`actualizar`, `eliminar`, `asignarPermisos`, `listarPermisos`), así que
fue un reemplazo directo de `roles-page.component.ts`/`.html`.

Único ajuste propio hecho durante la integración (no estaba en el
handoff): el panel del LEEME es un `<aside class="fixed inset-y-0
right-0 z-50">` suelto, sin backdrop — a diferencia de Empresas y de
Usuarios (ver arriba), que envuelven el panel deslizante en un `fixed
inset-0 z-50 flex justify-end` con velo y `onBackdropClick`. Se agregó
ese wrapper acá también — mismo criterio de "el panel nunca corre la
página, siempre es overlay `fixed`" recién corregido en Usuarios el
mismo día que se integró este módulo — pero con el velo **transparente**
en vez de oscurecer la pantalla: la barra flotante de "cambios sin
guardar" (`tocadosFuera()`) está pensada por diseño para convivir con
el panel abierto — tocar la matriz de un rol, abrir el panel de otro
para revisarlo, y seguir viendo ese aviso — y un velo oscuro la taparía.
El clic afuera del panel lo cierra igual que en los demás módulos, solo
sin el oscurecido (`RolesPageComponent.onBackdropClick`).

Keyframe nueva en `styles.css`: `rise` (entrada de la barra flotante y
del aviso de confirmación, ambos centrados con `-translate-x-1/2` — el
LEEME advertía que el `-50%` en X tiene que ir dentro de la keyframe, no
alcanza con la clase sola, o el elemento salta al terminar la
animación).

Verificado con Playwright: la matriz carga con los 9 roles reales
agrupados en plantillas del sistema / roles propios de clientes, y las
16 columnas reales que devuelve el backend — incluidas las que no están
en `ORDEN_MODULO` (`categorias`, `chat`, `compras`, etc.), que aparecen
al final con su id crudo como etiqueta, tal como describe el LEEME. El
panel abre como overlay sin correr la página (`margin-right` del
contenedor en `0px`, ancho del panel 432px de punta a punta); un clic
afuera lo cierra; togglear un permiso dentro del panel marca la celda
como sucia, actualiza las métricas y habilita "Guardar cambios"; guardar
hace el `PUT /roles/:id/permisos`, muestra el aviso de confirmación y
refleja el cambio en la matriz sin recargar. Cero errores de consola.
(La verificación tocó y volvió a revertir un permiso real del rol
`admin` para probar el flujo de guardado — quedó con el mismo conteo de
permisos que antes, confirmado contra `roles_permisos`.)

**Roles y permisos, segunda pasada (mismo día): panel aparte + nombres
legibles.** El usuario pidió dos ajustes sobre la integración de arriba,
ambos ya aplicados en otros módulos y ahora traídos acá:

1. **El panel se separó en `RolPanelComponent`**, componente aparte,
   sibling de `roles-page` en `pages/` — mismo patrón que
   `EmpresaDetallePanelComponent`/`FichaUsuarioPanelComponent`. A
   diferencia de Usuarios (que separó ficha y alta en dos componentes
   distintos), acá queda uno solo: el LEEME (§10) diseñó a propósito un
   único panel que cambia de modo con `creando()`, reusando la misma
   lista de switches de permisos y los mismos preajustes para ver/editar
   y para dar de alta — separarlo en dos hubiera duplicado ese template
   entero, justo lo que el diseño evitaba. `niveles`/`nivelesOriginales`/
   `edits`/`roles`/`modulos` se quedan en la página (la matriz, afuera
   del panel, necesita pintar el diff en vivo de TODOS los roles
   tocados, no solo el abierto, y la barra flotante también); el panel
   recibe todo lo que se arma con ese estado ya calculado —
   `modulosPanel`/`metricas`/`bases`/`metadatos`/`chip`/`nombrePanel`/
   `textoPie`, etc. — por `@Input`, y emite `confirmar`/`eliminar`/
   `duplicar`/`fijar`/`aplicarPreset`/`elegirBase`/`actualizarTexto`;
   `persistir`/`crearRol`/`eliminarRol` (que necesitan ese mismo estado
   compartido) se quedan en la página, así que el panel nunca llama a
   `RolService` por su cuenta — mismo tipo de excepción que
   `[matrizPanel]`/`[textoCambioRol]` en `FichaUsuarioPanelComponent`. Lo
   único genuinamente interno del panel es la pestaña activa
   (permisos/datos): un `effect` la reinicia solo cuando cambia de QUÉ
   se trata el panel (`creando()`, o el id del rol — nunca la referencia
   sola, que cambia cada vez que algo se guarda), mismo criterio que el
   `effect` de `FichaUsuarioPanelComponent`.

2. **Los nombres de rol que se MUESTRAN pasan por `etiquetaRolTexto()`**
   — el mismo ajuste que ya tenía Usuarios para sus cabeceras de grupo
   (`ETIQUETA_ROL`/`etiquetaRolTexto()` en `usuarios-page.component.ts`),
   ahora también en su propio módulo: la fila de la matriz, el título
   del panel y las plantillas de "Partir de" al crear muestran "Admin de
   Goods" en vez del slug crudo `admin_goods`; un rol propio sin
   etiqueta a mano (`soporte-690`) cae al fallback genérico y se lee
   "Soporte 690". Exportado desde `roles-page.component.ts` (mismos
   ocho roles de sistema, mismas etiquetas que la copia de Usuarios) e
   importado por `RolPanelComponent` — mismo criterio que
   `FichaUsuarioPanelComponent` importando eso de `usuarios-page` en vez
   de duplicarlo, porque ya depende de la página para todo lo demás.
   **La traducción es puramente de lectura**: el campo editable de
   "Datos del rol" nunca la usa — recibe `nombreEdicion` (el `nombreDe()`
   crudo, sin pasar por `etiquetaRolTexto()`) para que lo que se ve
   escrito, letra por letra, sea exactamente lo que se termina
   guardando. Mientras se está creando un rol nuevo el título del panel
   también queda crudo (es lo que la persona está tecleando en ese
   instante, no un slug de la base que traducir).

Verificado con Playwright: la matriz muestra "Admin de Goods"/
"Soporte 690"/etc. en vez de los slugs; abrir el rol de sistema `admin`
muestra "Administrador" como título del panel pero el input de "Datos
del rol" (deshabilitado) sigue mostrando `admin` crudo; abrir el rol
propio `soporte-690` muestra "Soporte 690" en el título y `soporte-690`
crudo en el input editable; crear un rol nuevo y escribir
`cajero_turno-noche` deja el título del panel exactamente así, sin
traducir mientras se escribe; `<app-rol-panel>` aparece como elemento
propio en el DOM, con el mismo ancho fijo de 432px y sin `margin-right`
en el contenedor de la página (overlay, no empuja); clic afuera sigue
cerrando el panel; togglear un permiso y guardar desde el panel ya
separado hace el `PUT` real y actualiza la matriz. Cero errores de
consola. (Volvió a tocar y revertir un permiso real de `admin` para
probar el guardado a través del componente nuevo — mismo conteo que
antes, confirmado contra `roles_permisos`.)

**Roles y permisos, tercera pasada (mismo día): más espacio, matriz con
scroll horizontal.** El usuario sintió la tabla y el panel "muy pegados
o apretados" y pidió más espacio, aceptando que la matriz se desplace
horizontalmente en vez de comprimir columnas para que quepa todo — así
que se ensancharon las columnas y se dejó que el contenedor
`overflow-x-auto` que ya existía absorbiera el sobrante, en vez de
encoger nada:

- Grid de la matriz: `212px repeat(N, minmax(52px, 1fr)) 84px` →
  `240px repeat(N, minmax(88px, 1fr)) 100px` (columna Rol, columnas de
  módulo y columna Total, las tres); el piso `min-w-[700px]` del
  contenedor subió a `min-w-[900px]`. Con los 16 módulos reales de hoy
  esto da un ancho de contenido de ~1750px contra ~1120px visibles en
  1440px de pantalla — el scroll horizontal entra en juego a propósito,
  confirmado con Playwright (`scrollWidth` 1768 vs `clientWidth` 1118).
- Padding de filas/celdas/encabezados de la matriz subido un escalón
  (`px-4`→`px-5`, `py-2.5`→`py-3`, celda de módulo `gap-0.5 px-1 py-2`→
  `gap-1 px-1.5 py-2.5`) y los segmentos de nivel de acceso más altos
  (`h-[18px]`→`h-5`). `anchoSegmento()` en `roles-page.component.ts` se
  escaló junto con la columna más ancha (`38px/13px/9px` →
  `44px/15px/10px`) — sigue centrado dentro de la celda, así que el
  ancho extra de columna que no usan los segmentos queda de gutter.
- `RolPanelComponent` pasó de `w-[432px]` a `w-[480px]`, con el mismo
  ajuste de un escalón en su padding interno (`px-5`→`px-6` en cabecera/
  cuerpo/pie, tarjetas de módulo y filas de metadatos con más aire).

Puramente visual — ningún dato, permiso ni endpoint tocado. Verificado
con Playwright: matriz y panel se ven con más aire en captura, scroll
horizontal funciona (`scrollLeft` se mueve y el contenido se desplaza),
`ng build staff --configuration production` sale limpio, cero errores
de consola. No se guardó ningún cambio de permisos durante esta
verificación (solo se abrió el panel para la captura), así que no hizo
falta revertir nada esta vez.

**Roles y permisos, cuarta pasada (mismo día): los segmentos llenan la
celda, columna Total más ancha.** El usuario mandó una captura señalando
dos cosas puntuales sobre el ajuste anterior: la columna Total "no se
logra ver bien", y los colores de la matriz "apenas llegan hasta
inventario" sin extenderse por el resto del panel. La causa real de lo
segundo: los segmentos de nivel de acceso tenían un ancho fijo en `px`
(`anchoSegmento()`) centrado dentro de la celda — al ensanchar las
columnas en la pasada anterior, quedó mucho blanco alrededor de cada
grupo de segmentos, dando la sensación de que el color no llega a cubrir
la celda. Arreglado así:

- Cada segmento pasó de `[style.width]` fijo a `flex-1` (mismo reparto
  entre los segmentos de una celda) — ahora el color genuinamente ocupa
  todo el ancho de la celda, sea cual sea el ancho real de la columna
  (fija en 88px de piso o estirada por el `1fr` en pantallas anchas).
  `s.ancho`/`anchoSegmento()` no se borraron: pasaron de ancho fijo a
  piso mínimo (`min-width`), para que un módulo con una sola acción
  (`auditoria`, `reportes`) no quede con un segmento demasiado angosto.
- Columna Total: `84px` → `130px` en la pasada anterior había quedado
  corta todavía; subió a los mismos `130px` en ambas filas de grid
  (encabezado y filas), y la barra de progreso de `w-[34px] h-1` pasó a
  `w-14 h-1.5` para que se note más con el número al lado.

Verificado con Playwright: los segmentos ahora se ven como una barra
segmentada continua que llena cada celda (antes quedaban agrupados
chicos al centro); haciendo scroll hasta el final del contenedor, la
columna "Total" se confirmó con `getBoundingClientRect()` — termina en
x=1407 dentro de un viewport de 1440px, ya no cortada. `ng build staff
--configuration production` sale limpio, cero errores de consola.

**Roles y permisos, quinta pasada (mismo día): Rol y Total quedan
`sticky`, ya no dependen del ancho de pantalla.** El usuario mostró
capturas de su propia pantalla: al hacer scroll horizontal, cualquier
columna que quedara a medio cortar en el borde del visor se veía "sin
color" — que es exactamente lo esperable de un scroll normal (lo que no
entra en el visor no se ve hasta scrollear), pero la columna Total en
particular quedaba fuera de vista salvo que se scrolleara hasta el
final, y con 16+ módulos reales eso no siempre entra en una pantalla
normal por más ancho que se le diera. La solución robusta: las columnas
"Rol" (izquierda) y "Total" (derecha) pasaron a `position: sticky` —
quedan siempre visibles sin importar cuánto se scrollee ni cuántos
módulos tenga el sistema, en vez de depender de que alcance el ancho.

Detalle técnico que costó una vuelta extra: la primera versión usó
`sticky left-5`/`right-5` con un margen negativo (`-ml-5`/`-mr-5`) para
que la columna fija "tapara" el padding lateral de la fila (`px-5`) —
dejaba un hueco de ~20px por el que se colaba la celda de al lado
(confirmado con `getBoundingClientRect()`: el borde de Total quedaba a
1387px con el contenedor terminando en 1408px). Se resolvió sacando el
`px-5` de la fila entera y poniendo ese padding como `pl-5`/`pr-5`
directamente dentro de las columnas Rol/Total, con `sticky left-0`/
`right-0` — así no hace falta ningún margen negativo compensatorio y el
borde de la columna fija queda exacto contra el borde del contenedor.
Cada columna fija lleva su propio color de fondo (mismas clases
condicionales que ya tenía la fila — blanco/seleccionada/tocada) y una
sombra sutil hacia el lado donde scrollea el resto, para que se note que
hay contenido pasando por debajo.

Verificado con Playwright en tres posiciones de scroll (al inicio, a la
mitad, al final) con `getBoundingClientRect()` + `elementFromPoint()` en
los bordes de ambas columnas fijas — sin huecos, sin fuga de celdas
vecinas. Interacciones (abrir el panel de un rol, clic en un segmento)
siguen funcionando igual a través del wrapper nuevo. `ng build staff
--configuration production` sale limpio, cero errores de consola.

**Roles y permisos, sexta pasada (mismo día): la descripción larga se
desbordaba sobre las columnas de módulo.** Efecto colateral de envolver
el botón del nombre en el `<div sticky>` de la pasada anterior: el
`<button class="flex ...">` dejó de ser un ítem directo del grid (que
`justify-items: stretch` sí ajusta a los 240px de la columna) y pasó a
ser un hijo normal del wrapper `sticky` — sin un ancho explícito, un
contenedor flex con texto `white-space: nowrap` adentro se dimensiona
por contenido en vez de heredar el ancho del padre, así que roles con
descripción larga ("Empleado de un emprendimiento cliente de Goods —
acceso operativo acotado dentro de la Empresa de su dueño") medían
618px en vez de ~220px y se desbordaban visualmente sobre las celdas de
módulo de al lado — confirmado midiendo con `getBoundingClientRect()`.
Arreglado dándole al wrapper `sticky` un ancho fijo explícito
(`w-[240px]` + `overflow-hidden` como resguardo) y `w-full` al botón de
adentro, para que el ancho de 240px se propague de forma explícita en
vez de depender de que el navegador lo infiera solo — confirmado que
ahora mide 220px (240 menos el padding) y el `truncate` con "…" vuelve
a cortar donde corresponde. `ng build` limpio, interacciones (abrir
panel, tocar un segmento) verificadas de nuevo tras el cambio.

**Topbar de staff: aviso de acceso especial pasa de píldora suelta a
segunda línea del bloque de usuario (handoff, §11).** Integrado desde
`projects/staff/src/app/layout/topbar/` del zip — reemplaza
`topbar.component.html` entero; el `.ts` queda con la misma lógica de
siempre (`currentUser`/`initials`/`displayName`/`esCrossPanelStaff`/
`logout`), solo cambió el comentario de cabecera.

Qué cambió, tal como lo documentaba el LEEME:
- La píldora ámbar "Acceso especial de superadmin" que flotaba suelta a
  la izquierda del avatar desapareció. El dato es sobre *esa cuenta*, no
  un estado de la aplicación, así que ahora es una segunda línea dentro
  del bloque de usuario: punto cian + `SUPERADMIN`, separador de 1px,
  "Acceso especial". El `title` con la explicación completa se movió del
  badge viejo al bloque de usuario.
- El header pasó de `h-14` a `h-15` y el logo de `h-6` a `h-12`; la
  píldora "Staff" con borde redondeado se volvió un separador de 1px +
  "Staff" en versalitas de 10px — menos peso a la izquierda.
- En sesión normal (sin acceso especial) el bloque de usuario queda
  idéntico al de siempre (avatar + nombre en una línea) — verificado con
  la cuenta `staff.qa@goods.example.com`.

**Desviación del handoff**: el nuevo HTML referenciaba
`logo-goods-plus-wordmark.png`, un archivo que no existe ni en
`projects/staff/public/` ni en la carpeta del zip — el usuario confirmó
seguir con el `logo-goods-wordmark.png` de siempre, solo al tamaño nuevo
(`h-12`). Nada de tokens nuevos (usa `--color-topbar-badge-border` y
`--color-topbar-avatar-bg`/`-text`, que ya existían) ni keyframes.

Verificado con Playwright en las dos cuentas de prueba (superadmin
cross-panel y staff normal), capturas del topbar en ambos casos, cero
errores de consola, `ng build staff --configuration production` limpio.






**Settings del panel de staff: nuevo ítem de sidebar + módulo de perfil
propio (pedido 2026-09-22, sin handoff — "con base a los estilos que hay
y que estamos usando").**

A diferencia de `admin/features/settings/` (gestiona el equipo de UNA
Empresa, con sub-páginas Usuarios/Roles), en staff no había nada que
copiar de ahí: la propia página de Settings de admin es un placeholder
reconocido sin contenido definido, y sus únicas sub-páginas reales
administran a "otros", algo que en staff ya viven como ítems de primer
nivel del sidebar (Usuarios / Roles y permisos, system-wide). Se planteó
esto al usuario antes de construir — confirmó que Settings acá es el
perfil de la PROPIA cuenta, no gestión de otros.

Sidebar: se sumó `settingsItem` a `layout/sidebar/sidebar.component.ts`
calcado en posición/estilo del de `admin` — link simple sin submenú,
empujado al fondo con `mt-auto`, fuera del `@for`/indicador deslizante
de primer nivel. A diferencia de `admin`, sin sección "Administración"
arriba (no aplica: acá no hay nada de eso). Sin `permiso`: es el perfil
de la cuenta logueada, visible para cualquier rol de staff — el propio
backend tampoco lo gatea (`GET`/`PATCH /usuarios/:id` permiten el propio
id sin `usuarios.ver`/`usuarios.editar`, ver
`UsuarioController.verificarPropioOPermiso`).

Contenido de `features/settings/` (una sola ruta, `SettingsPageComponent`),
decidido con el usuario campo por campo:
- **Perfil completo editable** (nombres/apellidos/teléfono) vía
  `UsuarioService.obtener()`/`.actualizar()` — mismos endpoints que ya
  usaba `ficha-usuario-panel` para editar a otros, acá apuntados al
  propio id (`AuthService.currentUser().id`). El correo se muestra de
  solo lectura ("no se cambia desde acá").
- **Foto de perfil**: nuevo `core/upload/upload.service.ts` (`POST
  /upload`, genérico, ya existía en el backend sin consumidor en staff)
  + `PATCH /usuarios/:id { imagenPerfil }` para asociarla. Valida tipo
  (jpg/png/webp/gif) y tamaño (5 MB) en el cliente, espejo de los límites
  reales del backend (`upload.constants.ts`).
- **Aviso de correo sin verificar**: si `correoVerificado` es `false`,
  tarjeta con botón "Enviar código" (`POST /auth/send-verification`) +
  input de 6 dígitos (`POST /auth/verify-email`) — ambos endpoints ya
  existían, sin uso previo en staff.
- **Último acceso**: solo se muestra (`Usuario.ultimoAcceso`, ya viene
  en el perfil), no hace falta pedir nada aparte.
- **Cambiar contraseña**: decisión explícita del usuario — NO se
  construyó un endpoint nuevo de "cambiar con la actual" (el propio
  `UpdateUsuarioDto` excluye `password` a propósito: "el cambio de
  contraseña pasa por auth: reset/forgot-password"). El botón reusa
  `POST /auth/forgot-password` a la propia cuenta — mismo flujo que ya
  usa la pantalla de login, la persona termina el cambio en su correo,
  fuera del panel.

Extensiones de servicios existentes (sin tocar nada del backend):
`UsuarioGoods` sumó `imagenPerfil`/`correoVerificado`;
`UsuarioService` sumó `obtener(id)` (`GET /usuarios/:id`) y
`ActualizarUsuarioGoodsPayload` sumó `imagenPerfil?`; `AuthService`
(staff) sumó `solicitarRecuperacionPassword`/`reenviarVerificacionCorreo`/
`verificarCorreoConCodigo`. `app.config.ts` sumó `IconSettings2`
(registrado por nombre de string, igual que el resto del sidebar —
`admin` usa la misma variante para el mismo ítem).

**Bug encontrado y arreglado durante la verificación**: la primera
versión de `SettingsPageComponent` leía
`authService.currentUser()?.id` una sola vez en el constructor.
`AuthService.currentUser` no se persiste (solo el accessToken) — tras un
F5 o un deep-link directo a `/settings`, `ShellComponent.ngOnInit` recién
dispara `GET /auth/me` de forma asíncrona, así que esa lectura síncrona
corría real riesgo de encontrar `null` (confirmado con Playwright:
navegar directo a `/settings` tras login mostraba "No se pudo identificar
tu sesión" pese a la sesión ser válida). Arreglado con un `effect()` que
reacciona cuando el signal por fin trae el id, en vez de depender de que
el shell termine antes.

Verificado con Playwright en dos cuentas (`staff.qa@goods.example.com`,
plana, sin `usuarios.ver`/`roles.ver` — Settings visible igual; y la
cuenta superadmin cross-panel, con Usuarios/Roles visibles además de
Settings): editar y guardar datos (persiste tras reload), subir foto
(URL nueva `http://localhost:3000/uploads/...`), disparar
envío-de-código con manejo de error (en este entorno de verificación no
hay un SMTP local corriendo — `ECONNREFUSED 127.0.0.1:1025` en el log
del backend, mismo límite que ya tenía la pantalla de login con su
"olvidé mi contraseña", no es un bug nuevo), botón de cambiar contraseña.
Cero errores de consola tras el fix del ícono/la carrera de `currentUser`.
`ng build staff --configuration production` sale limpio (solo el warning
preexistente de presupuesto de bundle inicial, no relacionado).




**Settings de staff, segunda vuelta el mismo día: de "nombres/apellidos/
teléfono" a "toda la información" del perfil.** El usuario pegó el JSON
crudo de `GET /usuarios/:id` como referencia de lo que quería ver
("hay que ajustar para mostrar toda la información").

Se creó un modelo aparte, `core/usuarios/models/mi-perfil.model.ts`
(`MiPerfil`/`ActualizarPerfilPayload`), en vez de bolsear los campos
nuevos en `UsuarioGoods` — esa exclusión ("no repite columnas de
e-commerce que no aplican al personal de Goods") seguía siendo correcta
para `features/usuarios/` (gestionar a OTROS colegas), pero para el
PROPIO perfil esos mismos campos sí son "su información". `obtener()`/
`actualizar()` de `UsuarioService` se volvieron genéricos en el tipo de
respuesta (`<T = UsuarioGoods>`) para servir a los dos modelos sin
duplicar el HTTP — cero ruptura de los llamadores existentes
(`ficha-usuario-panel` sigue recibiendo `UsuarioGoods` por defecto).

Campos sumados a la tarjeta "Datos personales" (todos editables vía el
mismo `PATCH /usuarios/:id` de siempre — `UpdateUsuarioDto` ya los
permitía, cero cambios de backend): tipo y número de documento, fecha de
nacimiento, género, dirección + referencia, y un checkbox de "acepto
comunicaciones de Goods" (`aceptaMarketing`). El teléfono sumó un
indicador de verificado/sin verificar a la derecha (`telefonoVerificado`
— sin flujo de reenvío como el de correo, el backend no tiene un
endpoint equivalente para teléfono, así que acá solo se MUESTRA).

Nueva tarjeta "Cuenta" (solo lectura): banner verde si la cuenta tiene
`accesoStaffGoods` (acceso especial de superadmin — dato de la CUENTA,
distinto de `esCrossPanelStaff` del topbar que es de la SESIÓN actual),
estado (activa/desactivada), miembro desde, términos aceptados (si hay
fecha), origen de registro y código de referido (si vienen), puntos de
fidelidad, última actualización.

Quedaron afuera a propósito (documentado en el docstring de `MiPerfil`):
`latitud`/`longitud` (coordenadas crudas sin mapa no son información
legible, no hay flujo que las use), `tokenRecuperacionExpira`/
`intentosFallidos`/`bloqueadoHasta` (metadata interna de seguridad
anti-fuerza-bruta, no "perfil"), `eliminadoEn`/`motivoDesactivacion`
(solo aplican a una cuenta desactivada, que no podría tener una sesión
propia viendo su Settings), `empresaId`/`rolId` (siempre null / redundante
con `rol.id`), `preferenciasNotificaciones` (sin lógica de negocio
todavía, ver el propio comentario de la entidad `Usuario`),
`referidoPorId` (un id crudo sin nombre no dice nada útil).

Sin precedente en el repo para un `<select>` de tipoDocumento/género
(se buscó en `admin`/`staff`/`shared-ui`, no existe ningún formulario de
registro con esos campos) — se dejaron como texto libre en vez de
inventar una lista de opciones (ej. CC/CE/TI/Pasaporte) que el negocio
no pidió. Fecha de nacimiento sí usa `<input type="date">` nativo
(compatible con `@IsDateString()` del backend, que ya validaba ese
formato).

Verificado con Playwright en las dos cuentas de siempre: la superadmin
cross-panel (mostró el banner de acceso especial, guardó y persistió
documento/fecha de nacimiento/género/dirección tras reload) y la staff
plana (sin el banner, campos opcionales en blanco se ven bien vacíos,
nada roto). Cero errores de consola, `ng build staff --configuration
production` limpio.




### Sistema de alertas transversal + rediseño de Settings de staff
(2026-09-22, handoff LEEME.md §12/§13)

Settings (arriba) dependía a propósito de un sistema de alertas que
todavía no existía en el proyecto — el propio LEEME lo marcaba como
prerrequisito duro ("AlertaService y EstadoIconoComponent tienen que
estar integrados antes") — así que se integraron los dos juntos.

Seis piezas nuevas, en `projects/staff/src/app/` (proyecto-local, NO en
la librería `shared-ui` promovida — ver "Qué construir como librería
propia" más abajo: esto es exclusivo del panel de staff por ahora, no
algo que `admin` también consuma):

- `shared/ui/estado-icono/` — el ícono de estado (anillo que gira
  mientras carga, se cierra en el glifo del resultado al resolver). Un
  solo componente a 16-76px según dónde se use: fila de tabla, alerta en
  línea, modal, overlay. Todo el movimiento es CSS
  (`stroke-dasharray`/`stroke-dashoffset`), no Angular Animations.
- `shared/ui/alerta-pila/` — alertas apiladas arriba-derecha. La
  operación en curso y su resultado son la MISMA alerta (`mostrar()` +
  `resolver(id, …)`), nunca una que desaparece y otra que aparece.
- `shared/ui/alerta-overlay/` — alerta bloqueante para operaciones sin
  decisión a medio camino (activar una Empresa, publicar el catálogo).
  Dos variantes: `tarjeta` (con botones) y `velo` (solo ícono+texto).
- `shared/ui/pantalla-estado/` — envoltorio de carga/error para una
  pantalla entera; el esqueleto lo proyecta cada página (forma real, no
  un spinner genérico).
- `core/ui/alerta.service.ts` — único dueño del estado (`providedIn:
  'root'`), con el azúcar `seguir()` para el caso de una llamada HTTP +
  su alerta en línea.

Montados una sola vez en `layout/shell/shell.component.html`
(`<app-alerta-pila />` + `<app-alerta-overlay />`), no por página — el
estado vive en el servicio, así que una operación lanzada en una
pantalla sigue avisando si el usuario navega a otra antes de que
termine. Seis keyframes nuevas en `styles.css`: `girar`,
`aparecer-alerta`, `aparecer-modal`, `barra-indeterminada`, `brillo`
(sistema de alertas) y `parpadeo`/`sacudir-a`/`sacudir-b` (modal de
código de Settings). Sin tokens de color nuevos — reutiliza
`--color-success-solid`/`--color-badge-error-solid`/
`--color-badge-info-solid` ya definidos, más `#b07400` sin tokenizar
para warning.

Settings mismo se reescribió sobre esta base: pasó de una columna larga
a 4 secciones con subnavegación (Perfil/Correo y contacto/Seguridad/
Cuenta), guardado por barra de cambios flotante (aparece solo si hay
diff real contra el perfil del servidor, no un botón fijo), modal de
verificación de correo con un solo input invisible sobre 6 cajas
(soporta pegar y autocompletado de iOS/Android), tarjeta de "credencial
de staff" con historial de la cuenta. Mismos endpoints que la versión
anterior, cero cambios de backend.

Verificado con Playwright contra el backend real: login, las 4
secciones, editar y guardar con la alerta en vivo (`AlertaPilaComponent`
mutando de "Guardando cambios" a "Datos guardados"), toggle de
marketing optimista, modal de cambiar contraseña. Cero errores de
consola. `ng build staff --configuration production` sin errores
nuevos — el bundle inicial ya excedía el budget de 500kB antes de este
cambio (519.89kB), subió a 534.05kB con el sistema de alertas montado en
el shell (sigue siendo warning, no error). No se pudo probar el flujo
de verificación de correo de punta a punta (depende de SMTP, no
disponible en el sandbox de verificación) — misma limitación de
siempre, documentada en sesiones anteriores.


### Alertas integradas globalmente en todo el staff (2026-09-22)

Pedido del usuario: "agregar nuestro sistema de alertas... hay que
integrarlas globalmente" — llevar `AlertaService` +
`PantallaEstadoComponent` (construidos para Settings, ver la entrada
anterior) a las 9 pantallas restantes del staff: Empresas (lista +
panel de detalle), Altas pendientes (lista + wizard de activación),
Planes, Suscripciones (lista + panel de gestionar), Auditoría,
Usuarios (lista + panel de ficha + panel de alta) y Roles y permisos
(matriz + panel de rol). Regla explícita del usuario en todo momento:
sumar la capa de alertas SIN tocar la UI contextual que ya tenía cada
pantalla (barras de guardado, checklists, pasos del wizard, modales de
confirmación) — nunca reemplazarla.

Patrón aplicado, igual en las 9 pantallas:

- A nivel de página: un `computed` `estadoPantalla` (`error() ?
  'error' : cargando() ? 'cargando' : 'listo'`) alimenta
  `<app-pantalla-estado [estado]="estadoPantalla()" modulo="..."
  (reintentar)="cargar()" (volver)="volver()">`. El esqueleto que ya
  tenía cada pantalla se movió dentro de `<div esqueleto>` (se ve solo
  en `cargando`); el resto del template quedó como contenido por
  defecto (se ve solo en `listo`).
- Paneles dentro de overlays `fixed inset-0` con layout flex interno
  (cabecera/cuerpo/pie como hijos directos del flex): se envuelven con
  `<app-pantalla-estado class="contents" ...>` — el `display: contents`
  evita que el wrapper rompa el layout flex, dejando que sus hijos
  actúen como ítems directos del contenedor de afuera. Confirmado en
  el detalle de Empresa, el wizard de Altas pendientes y el panel de
  Gestionar suscripción.
- `(volver)` de un panel cierra el overlay (`cerrar.emit()`), no
  navega; `(volver)` de una página enrutada vuelve a su propia ruta
  (`Router.navigateByUrl('/<ruta>')`) — no hay "otro inicio" al que
  volver, mismo criterio que ya se había fijado para Empresas.
- A nivel de acción: la llamada HTTP se envuelve directo con
  `alertas.seguir(peticion$, { titulo, texto?, exito: {...}, error:
  {...} })`, dejando intactas todas las señales locales
  (`guardando`/`errorGuardar`/etc.) y toda la UI contextual existente
  — la alerta es una capa aparte, no un reemplazo.

Un bug se encontró y se corrigió dos veces mientras se replicaba el
patrón (Planes y Roles), y se evitó por diseño en las siguientes
pantallas (Suscripciones, Usuarios): varias páginas usaban la MISMA
señal `error` tanto para el fallo de carga de la página (la que
alimenta `estadoPantalla`) como para errores de una acción puntual
(`this.error.set(...)` dentro de `alternarActivo()`, `publicar()`,
`guardarTodo()`, etc.). Sin corregirlo, que fallara una sola acción
—por ejemplo, no poder desactivar un plan— hubiera reemplazado toda la
pantalla por la tarjeta de error fija de `PantallaEstadoComponent` en
vez de solo avisar la falla puntual. Se sacaron todos esos `.set()` de
los manejadores de error de acciones; el aviso de esa falla ahora lo
da la propia alerta en línea de `alertas.seguir()`.

También se eliminó, en vez de solo dejar de usar, el patrón de aviso
casero que tenían Planes, Suscripciones, Usuarios y Roles antes de
esta integración: una señal `aviso`/`publicado` + `mostrarAviso()` +
`setTimeout(2600)` reimplementada casi igual en cada página, con un
pill de texto al pie de la pantalla. Se borró por completo (señal,
método y markup), reemplazada por la alerta en línea del
`AlertaService`.

En Suscripciones y Usuarios había además un quirk de UX marcado en el
reconocimiento previo a esta fase: el panel hijo (`ficha-usuario-panel`,
`crear-usuario-panel`, `gestionar-suscripcion-panel`) hacía la llamada
HTTP real, pero el aviso de éxito/error lo mostraba el padre, vía
outputs `avisoTexto`/`errorTexto` burbujeando hacia arriba — el error
aparecía lejos de su causa. Se corrigió inyectando `AlertaService`
directo en el componente que hace la llamada, y se sacaron esos
outputs por completo; el padre ya no necesita mostrar nada.

Roles y permisos tenía además una carencia real (no solo de alertas):
su estado de carga era un `<p>Cargando…</p>` de texto plano, sin
esqueleto. Se aprovechó el paso por `PantallaEstadoComponent` para
construirle un esqueleto nuevo que sigue la forma real de la matriz
(encabezado + filas con fade), consistente con el resto del staff.

Verificado con Playwright contra el backend real, con sesión logueada,
recorriendo las 9 pantallas (lista + panel/wizard donde aplica) más
una interacción real por pantalla que ejercita `alertas.seguir()`
(alternar un plan del catálogo y volver a activarlo, abrir el wizard
de una alta pendiente, abrir el panel de gestionar de una suscripción,
abrir un panel de rol, abrir la ficha y el alta de un usuario). Cero
errores de consola en todo el recorrido. `ng build staff
--configuration production` sin errores nuevos en cada una de las 9
pantallas, verificado pantalla por pantalla a medida que se integraba
cada una (no en un solo build final) — mismo warning preexistente de
budget del bundle inicial que ya traía Settings, ninguno nuevo.


### Estructura de carpetas de `admin/src/app/`

A partir de acá `admin` deja de ser un único `app.html` con todo
apilado y pasa a tener rutas y páginas reales:

```
app/
├── core/                # servicios singleton de toda la app (auth/http/layout state)
├── layout/               # el shell real: shell/ (topbar+sidebar+router-outlet), sidebar/, topbar/
├── features/             # una carpeta por área de negocio, 1:1 con las secciones de este documento
│   ├── dashboard/
│   ├── orders/           # pages/ (list/detail/edit/refund) + components/ + services/ + models/
│   ├── products/         # pages/ (list/detail) + components/ + services/ + models/
│   ├── customers/        # pages/ (list/create/detail) + components/ + services/ + models/
│   └── dev-showcase/      # página /dev de validación visual — ver más abajo
├── shared/                # ya existía — cross-feature
│   ├── ui/                 # los composites: status-badge, data-table, order-line-item, quick-adjust-popover
│   ├── utils/               # funciones puras cross-feature (ej. formatMoney)
│   └── models/               # tipos genéricos cross-feature (vacío por ahora)
├── app.routes.ts           # solo hace lazy-load de cada features/*/*.routes.ts, bajo ShellComponent
└── app.ts / app.html        # reducido a `<router-outlet />` — el shell vive en layout/shell
```

Dos decisiones tomadas al armar esto:

1. **Nombres de `features/` en inglés** (`orders`, `products`,
   `customers`, `dashboard`) aunque el backend use español (`pedido`,
   `producto`, `usuario`). Motivo: el copy de la UI y las rutas/URLs ya
   están calcadas literal de Shopify en inglés — meter español ahí
   generaría una mezcla constante entre "lo que dice la pantalla" y
   "cómo se llama la carpeta". El mapeo español↔inglés queda contenido
   en la capa `services/` de cada feature (el único lugar que habla con
   `/pedido`, `/producto`, `/usuario` del backend) — una sola costura de
   traducción, no una filtración por todos lados.
2. **`shared/ui` se queda dentro de `admin/`, no se extrae a librería
   Angular todavía.** Extraer con `ng generate library` es mecánico y de
   bajo riesgo el día que la app `tienda` exista de verdad; hacerlo antes
   sería diseñar una API pública de librería (segunda entrada de build,
   versionado, qué es "genérico" vs "específico de admin") a ciegas, sin
   un segundo consumidor real que confirme qué es realmente compartido.

Dentro de cada feature, `pages/` son componentes atados a una ruta
(`*.routes.ts` los referencia directo); `components/` son piezas
propias de esa feature reusadas entre varias de sus páginas pero sin
alcance cross-feature (si empiezan a hacer falta en otra feature, ahí
sí pasan a `shared/ui`). Por ahora `components/`, `services/` y
`models/` de cada feature están vacíos (con `.gitkeep`) — se llenan
cuando cada página deja de ser un placeholder.

**`features/dev-showcase`** (ruta `/dev`, fuera del sidebar) es la
continuación del `app.html` original: sigue siendo donde se comparan
componentes de `shared/ui/` contra las capturas de Shopify antes de
darlos por buenos, ahora como una página más del árbol de rutas en vez
de todo el contenido de `App`. Efecto colateral bueno de haberla vuelto
una ruta lazy-loaded: PrimeNG's `TableModule` (pesado) salió del bundle
inicial — bajó de ~926 kB a ~336 kB, bien debajo del budget de 500 kB
que antes tiraba warning.

El shell (`layout/shell` + `sidebar` + `topbar`) es deliberadamente
mínimo por ahora: usa los tokens de color ya extraídos
(`--color-topbar`, `--color-sidebar-bg`, `--color-nav-active`) pero sin
íconos, submenús expandibles, buscador global, ni el resto de lo
descrito en "Lenguaje visual general" — eso es una pieza de diseño
propia, todavía pendiente de especificar a nivel de composite.

### Implicaciones técnicas

- Ya instalado en `frontend/`: `@angular/cdk@21` (peer dependency
  obligatoria de PrimeNG, no la trae sola), `@angular/animations@21`
  (para `provideAnimationsAsync`), `primeng@21.1.10`,
  `@primeuix/themes@2.0.2` (**no** `@primeng/themes` — ese paquete está
  deprecado, el equipo de PrimeTek movió el contenido de los presets a
  `@primeuix/themes`), `tailwindcss@4` + `@tailwindcss/postcss`.
- `providePrimeNG({ theme: 'none' })` ya configurado en
  `app.config.ts` de `admin`, junto con `provideAnimationsAsync()`.
- Definir los **design tokens** (colores de estado, escala tipográfica,
  radios de borde, sombras) calcados de la sección "Lenguaje visual
  general" de este documento — como variables/config de Tailwind, ya
  que no se está usando el sistema de preset de PrimeNG — antes de
  construir el primer componente, para no rehacer trabajo.
- La librería de componentes compartida (`shared-ui` o similar) se
  agrega con `ng generate library` cuando se empiece `tienda` — por
  ahora los 7 composites listados arriba viven directo en `admin`, ya
  que no hay un segundo consumidor todavía.
- Empezar por el componente más simple y más reutilizado (Badge de
  estado, sobre `p-tag`) para validar el patrón de `pt` antes de
  meterse con el `p-table` (el más riesgoso visualmente) o el popover de
  posicionamiento.
