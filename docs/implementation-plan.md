# Plan de implementación — REJO

## 1. Objetivo y lectura del proyecto

REJO es una PWA local-first para que una finca lechera pequeña del Carchi pueda empezar a registrar un dato diario sin depender de internet y, progresivamente, evitar pérdidas reproductivas, sanitarias y económicas. El producto no digitaliza un proceso ya establecido: crea el hábito de registrar.

La primera entrega no es “un sistema ganadero reducido”. Es una rutina que el padre o la madre debe poder completar en menos de diez segundos con un Android económico, antes o después de que llegue el tanquero.

El archivo REJO-contexto-para-claude-code.md es la especificación canónica. Si una tarea futura lo contradice, se detiene y se pide una decisión antes de implementar.

## 2. Límites que no se negocian

- La aplicación funciona sin red después de su aprovisionamiento inicial. Una pantalla de captura no espera al backend, ni muestra una falla de red como fallo de guardado.
- Fase 0 contiene exactamente cuatro pantallas de producto: Inicio, Anotar la leche, Mis vacas y Ajustes. No se añade navegación, reportes, gráficas, reproducción, sanidad, costos ni control lechero.
- La medida del tanque es el hecho primario. Los litros por vaca no son obligatorios y no aparecen en Fase 0.
- El estado “parece preñada” es válido sin palpación. Nunca se fuerza una preñez confirmada.
- Todo registro es recuperable: se usa deleted_at y jamás borrado físico.
- Todas las entidades de negocio incluyen farm_id desde la primera migración y las políticas RLS lo aplican.
- Fechas de negocio se interpretan y prueban en America/Guayaquil. Ninguna regla crítica depende de Date sin zona explícita.
- La interfaz usa el glosario de CONTEXT.md, tipografía de al menos 18 px, controles de al menos 48 px y contraste alto.
- Las reglas que cambian por norma o por precio se versionan como datos; no se codifican como constantes.

## 3. Decisiones de diseño para arrancar

### 3.1 Contextos y propiedad de los datos

El producto se divide en módulos de dominio, aunque inicialmente solo se habilita el módulo de captura de leche:

| Módulo | Hechos que posee | Estado derivado que publica |
| --- | --- | --- |
| Fundación de finca | finca, miembros, comprador, tabla de aforo | configuración disponible para capturas |
| Rejo | animales, altas y bajas | categoría, estado productivo |
| Leche | medidas de tanque, entregas, salidas, controles individuales | producción, entrega, balance y variación |
| Reproducción | celos, servicios, palpaciones, partos, secados | estado reproductivo, fechas estimadas, repetidora |
| Sanidad | eventos, tareas y CMT | retiro de leche, tareas vencidas |
| Economía | insumos, compras, transacciones, facturas y activos | costo por litro, brecha legal y conciliación |
| Pastoreo | potreros, lotes y movimientos | descanso y carga animal |

Los hechos son editables de forma retroactiva y se conservan. Los estados e indicadores se recalculan localmente a partir de esos hechos. Un campo derivado almacenado solo se admite como caché o para consulta rápida y debe poder recomponerse.

### 3.2 Identidad, auditoría y sincronización

La primera sesión autenticada debe ocurrir con conexión. Después, la sesión y la base local permiten trabajo offline. La provisión de miembros no forma parte de las cuatro pantallas de uso diario de Fase 0: el administrador crea la finca piloto, invita a los owners y verifica el dispositivo antes de la prueba de 30 días.

Cada tabla local y remota tendrá el sobre común: id UUIDv7, farm_id, created_at, updated_at, deleted_at, synced_at y created_by. Las fechas de modificación se generan en cliente con un reloj normalizado y todos los comandos contienen un identificador idempotente.

Un repositorio por entidad encapsula Dexie. Una operación de escritura hace, en una única transacción local:

1. validar el comando con Zod;
2. guardar o actualizar el registro;
3. escribir una entrada de sync_queue con operación, carga, intento y clave idempotente;
4. actualizar la vista local de inmediato.

El worker de sincronización intenta la cola al recuperar conectividad, reintenta con espera progresiva, marca los elementos confirmados y descarga cambios de la finca. Para conflictos concurrentes se aplica last-write-wins por campo, se conserva una bitácora de conflicto y nunca se descarta silenciosamente la versión local. Una primera prueba de recuperación incluirá apagar la red durante una captura, cerrar la app y abrirla antes y después de sincronizar.

### 3.3 Backend mínimo

Supabase aporta Auth, Postgres, Storage y RLS. Fase 0 necesita migraciones solo para farms, users/farm_members, buyers, tank_calibrations, animals, tank_readings, milk_usages y el soporte de auditoría/sincronización. Las tablas de Fases 1 y 2 se diseñan en el mapa de datos, pero no se despliegan ni se exponen prematuramente salvo que una dependencia técnica sea real.

Las políticas RLS deben comprobar membresía activa de la finca en cada tabla. El rol admin administra miembros; owner crea y edita registros de su finca; worker y advisor se habilitan cuando haya una necesidad de producto. Las fotos se almacenarán bajo un prefijo por farm_id y tendrán políticas equivalentes.

### 3.4 Interpretación de los tests “antes de UI”

La especificación exige tests para cinco funciones puras. Para respetar también la prohibición de construir Fases 1 y 2 anticipadamente, se implementarán y probarán antes de la interfaz de la fase que las use:

| Función | Se introduce en |
| --- | --- |
| interpolateTankLiters y manejo horario | Fase 0 |
| computeMilkBalance | Fase 1, junto con lectura doble |
| computeReproductiveState | Fase 1 |
| computeMilkWithholding | Fase 1 |
| computeLegalMilkPrice | Fase 2 |

Si se pretende interpretar literalmente que las cinco deben existir antes de toda UI, se requiere confirmación: esa lectura produciría lógica de dos fases futuras durante Fase 0 y contradice el alcance estricto.

## 4. Fase de preparación (antes de la Fase 0)

Duración prevista: 2–3 días. Esta preparación no añade funcionalidad de usuario.

1. Crear el proyecto Vite con React 18 y TypeScript estricto; añadir Tailwind, shadcn/ui, PWA, TanStack Query con persistencia, React Hook Form, Zod, Dexie y la librería de fechas con zona horaria explícita.
2. Configurar lint, formato, typecheck, Vitest y pruebas de navegador en un Android de gama baja o emulación equivalente. Agregar CI para lint, tipos, pruebas y build.
3. Definir la estructura de carpetas por módulo: app, shared, i18n, db, sync, features/milk, features/animals y features/settings. No crear módulos vacíos de fases posteriores.
4. Crear los tipos compartidos de auditoría, IDs, dinero, litros, fechas de negocio y resultado de dominio; evitar tipos any y conversiones implícitas de moneda.
5. Crear las migraciones de Supabase y las tablas Dexie de Fase 0, con índices para fecha, farm_id, deleted_at y cola de sincronización.
6. Implementar Auth y el aprovisionamiento técnico inicial, sin añadir una pantalla cotidiana adicional. Documentar el procedimiento de alta del dispositivo piloto.
7. Crear el service worker, app shell y una prueba manual de instalación, recarga sin red y actualización de versión.
8. Completar las políticas RLS y una prueba negativa: un miembro de otra finca no puede leer, escribir ni descargar datos de la finca piloto.
9. Dejar documentadas las variables de entorno, el flujo de migraciones y el rollback de despliegue. Ninguna clave se registra en el repositorio.

Salida: se puede iniciar sesión una vez, instalar la app, cortar la red y seguir abriendo una app vacía de forma confiable.

## 5. Fase 0 — “Un número al día”

Duración objetivo: 2 semanas de construcción, seguida de 30 días de uso real. La segunda parte es una puerta de salida, no una formalidad.

### 5.1 Incrementos de trabajo

#### Incremento 0A — Base local y configuración

- Crear el repositorio Dexie y las migraciones para farms, buyers, tank_calibrations, animals, tank_readings, milk_usages y sync_queue.
- Sembrar únicamente los datos permitidos: finca piloto incompleta pero editable, Alpina y los valores de configuración necesarios. Datos aún por confirmar permanecen vacíos y claramente identificados.
- Implementar el repositorio de tabla de aforo y la función interpolateTankLiters.
- Probar interpolación en punto exacto, tramo intermedio, tabla vacía, marca bajo mínimo y marca sobre máximo con señal de advertencia.
- Construir el flujo de sincronización básico y su observabilidad técnica: número de pendientes, último respaldo exitoso y errores recuperables; la UI usa “Guardado en el celular” y “Ya se envió”.

Salida: una medida escrita offline persiste tras recarga, aparece localmente y llega al servidor cuando vuelve la red.

#### Incremento 0B — Inicio y captura diaria

- Construir Inicio con solo: litros de hoy, promedio de los últimos siete días y un botón predominante “Anotar la leche de hoy”.
- Construir Anotar la leche con teclado numérico, valor en litros o valor de regla si hay tabla cargada, fecha editable y salida opcional para terneros.
- La captura por regla muestra la conversión calculada antes de guardar y una advertencia sencilla si necesita extrapolar; el usuario puede corregirla.
- Guardar una medida de tanque en el momento de entrega, con origen de la finca para captura propia. La abstracción conserva el momento para compatibilidad con lecturas dobles futuras, pero no expone ese flujo en Fase 0.
- Prevenir accidentes sin bloquear el registro: confirmar un valor anormal respecto de la media reciente, permitir fecha retroactiva y evitar duplicados involuntarios del mismo día mediante una decisión explícita de reemplazar o conservar otra medida.
- Al guardar, regresar con confirmación visible, sin spinner de red ni pasos extra.

Salida: un usuario puede registrar la medida diaria y la salida para terneros en menos de diez segundos estando offline.

#### Incremento 0C — Mis vacas

- Mostrar una lista legible por nombre y, cuando exista, foto. No mostrar estados reproductivos ni métricas que aún no existen.
- Alta mínima: nombre obligatorio, sexo y edad aproximada. La edad aproximada se convierte en birth_date_estimated sin inventar una fecha exacta visible como hecho.
- Permitir editar y marcar una corrección sin borrado físico.
- Mantener farm_id y campos futuros de origen, cuarentena y relaciones familiares en el modelo, sin exponerlos en el formulario.

Salida: cargar las aproximadamente veinte vacas toma menos de veinte minutos y toda alta funciona sin red.

#### Incremento 0D — Ajustes

- Editar datos de finca, comprador y tabla de aforo por filas de marca y litros.
- Validar puntos numéricos y ordenar la tabla; advertir cuando los litros no sean crecientes.
- No pedir información aún no conocida, como hectáreas exactas, activos o esquema sanitario.
- Explicar una sola vez el uso correcto de la regla: tanque nivelado, sin espuma y agitador apagado.

Salida: la finca puede capturar en litros desde el primer día y cambiar a regla cuando complete su tabla de aforo.

#### Incremento 0E — Accesibilidad, calidad y entrega piloto

- Verificar tamaño de letra, objetivos táctiles, navegación con una mano, contraste, foco y errores en español del Carchi.
- Probar flujo instalado sin red, pestaña recargada, cuota razonable de IndexedDB, cierre inesperado y sincronización después de varios días desconectado.
- Añadir manejo de datos corruptos o migraciones Dexie fallidas con respaldo previo y recuperación segura.
- Desplegar un ambiente de prueba y uno piloto. No activar otros usuarios hasta que el administrador compruebe el respaldo.
- Realizar una sesión de acompañamiento de diez minutos, observar una captura real y corregir fricción antes de declarar la fase lista.

### 5.2 Pruebas de aceptación de Fase 0

- Con modo avión activo, el usuario abre la app instalada, registra litros, cierra y reabre: el dato sigue presente y la pantalla confirma “Guardado en el celular”.
- Con una tabla de aforo de dos o más puntos, una marca intermedia devuelve los litros correctos y una tabla vacía nunca rompe la captura.
- Un registro de las 04:00 en America/Guayaquil pertenece al día local correcto.
- El promedio de siete días ignora los registros con deleted_at y no mezcla fincas.
- Un animal se guarda con solo nombre; los demás campos siguen siendo opcionales.
- La app contiene solo las cuatro pantallas acordadas, además del acceso técnico inicial.
- Tras reconectar, el mismo dato no se duplica en Supabase y queda respaldado.
- Durante 30 días reales se registra la medida diaria sin recordatorio externo. Si falla, se estudia el comportamiento y se rediseña Fase 0 antes de ampliar alcance.

## 6. Fase 1 — “El sistema se acuerda por él”

Duración objetivo: 4–5 semanas, solo después de aprobar Fase 0.

### 6.1 Orden de construcción

1. **Núcleo de reproducción.** Crear hechos de celo, servicio, palpación, parto y secado; implementar primero computeReproductiveState con una batería de casos de retorno al celo, tercer servicio, palpación negativa, fechas de parto y secado.
2. **Ficha de animal.** Añadir línea de tiempo cronológica, estado calculado y acciones de registrar celo, servicio, parto y secado. Un parto vivo crea ternero(s) con madre prellenada y solo pregunta nombre y sexo.
3. **Alertas locales.** Crear un motor puro, sin tabla de alertas materializadas. Recalcular al abrir desde los datos locales y clasificar rojo, naranja, amarillo e informativo.
4. **Sanidad.** Registrar eventos de salud y construir computeMilkWithholding antes de cualquier formulario. Al guardar un tratamiento con retiro, actualizar el estado derivado del animal y mostrar alerta roja persistente hasta su expiración.
5. **Plan sanitario.** Cargar la plantilla editable de vacunación de terneras, curada periódica y serología anual; crear tareas al nacer hembras y permitir completar, posponer o ignorar.
6. **Prevención crítica.** Resaltar vaca repetidora con la recomendación de prueba de brucelosis; no diagnosticar enfermedad ni sugerir tratamiento.
7. **Medir dos veces.** Incorporar las lecturas opcionales después de la sacada de la tarde, de madrugada y al pickup. Implementar computeMilkBalance, el umbral de diferencia de 3% y una explicación sin convertirlo en obligación.

### 6.2 Casos de aceptación de Fase 1

- La ausencia de celo tras 26 días produce “parece preñada”; una palpación no es requisito.
- Un celo entre los días 18 y 26 tras el servicio devuelve a vacía e incrementa el contador; al tercero marca repetidora.
- Un tratamiento de 96 horas impide entregar la leche hasta la hora exacta en Guayaquil; tratamientos solapados conservan la fecha más tardía.
- Un parto de hembra crea la tarea de vacuna de brucelosis a los tres meses.
- Las alertas aparecen y desaparecen al recalcular desde datos locales, sin esperar al servidor.
- Se evidencia al menos un error real evitado por una alerta antes de pasar a Fase 2.

## 7. Fase 2 — “Ahora sabe cuánto gana”

Duración objetivo: 4–6 semanas, solo después de la evidencia de valor de Fase 1.

### 7.1 Orden de construcción

1. **Datos legales versionados.** Cargar price_settings por effective_from, con fuente documental y sin hardcodear importes. Antes de desarrollar la UI, verificar contra las fuentes oficiales vigentes las tablas, precio y fecha de efecto; el documento de contexto no sustituye esa verificación regulatoria.
2. **Calculadora y conciliación.** Implementar computeLegalMilkPrice con los cinco escenarios obligatorios, redondeo explícito y selección histórica de versión. Cargar factura, prueba de calidad y diferencias de litros y dinero.
3. **Flujo de dinero.** Registrar ingresos, egresos y compras de insumos; enlazar sin duplicar transacciones relacionadas.
4. **Costo por litro.** Mostrar por separado caja, caja con depreciación y caja con mano de obra familiar. Visibilizar leche para terneros como ingreso no percibido.
5. **Control lechero mensual.** Habilitar registros por vaca solo como jornada de control manual, con fuente manual, medidor o estimación y posición de pesonera.
6. **Potreros.** Configurar potreros, lotes y movimientos; permitir papa, descanso u otro cultivo y metas por época. Calcular carga como dato contextual, no reproche.
7. **Indicadores.** Publicar los indicadores reproductivos, sanitarios, económicos y estructurales cuando haya datos suficientes. Cada indicador muestra período, fórmula y advertencia de datos incompletos.

### 7.2 Casos de aceptación de Fase 2

- Una factura histórica de julio sigue usando su configuración de julio después de una actualización de agosto.
- Un valor de calidad malo puede explicar una diferencia de precio sin atribuir automáticamente mala fe al comprador.
- Las tres versiones de costo no se mezclan y los valores sin datos se muestran como “aún no sabemos”, no como cero.
- El control mensual no bloquea el registro diario de tanque.
- El padre toma y verbaliza una decisión diferente basada en una recomendación o discrepancia del sistema.

## 8. Fases 3 y 4

### Fase 3 — Multifinca y certificación

Antes de abrir onboarding autónomo, completar pruebas de aislamiento RLS, administración de membresías, migración de datos y soporte. Añadir onboarding, camino de certificación de brucelosis/BPP, preparación para SIFAE, exportaciones y reportes anuales. Las reglas regulatorias se presentan como requisitos a confirmar con Agrocalidad cuando dependan de esquema de vacuna o normativa vigente.

### Fase 4 — WhatsApp

Crear una capa de ingesta separada que traduce mensajes, transcripciones y dispositivos en comandos del dominio con source app, whatsapp o device. Ningún mensaje escribe directamente en las tablas: se valida, se muestra una propuesta de confirmación y luego pasa por los mismos comandos, auditoría y cola de sincronización. Los resúmenes salientes se construyen a partir de indicadores locales ya validados.

## 9. Estrategia transversal de calidad

| Capa | Protección |
| --- | --- |
| Dominio | Funciones puras deterministas con tests de borde, dinero y zonas horarias |
| Formularios | Esquemas Zod y mensajes breves, sin convertir campos opcionales en barreras |
| Persistencia local | Migraciones Dexie, transacciones atómicas y pruebas de cierre/recarga |
| Sincronización | Idempotencia, reintentos, conflicto por campo, pull/push y recuperación offline |
| Supabase | Migraciones repetibles, RLS por finca y pruebas de acceso cruzado negativas |
| Interfaz | Pruebas de flujos críticos, tamaño táctil, contraste y validación con usuarios reales |
| Operación | Backup verificable, monitoreo de cola, registro de errores sin datos sensibles y rollback |

Los precios y cantidades monetarias se representan en una unidad decimal segura o enteros de menor denominación con una política de redondeo explícita. Las fotos y documentos se comprimen en el dispositivo, se guardan opcionalmente y nunca bloquean la creación de un hecho principal.

## 10. Ritmo de entrega y control de alcance

Cada cambio se entrega en commits pequeños: migración y tipos, función con tests, repositorio local, sincronización, pantalla, pruebas de aceptación. Una revisión de alcance al final de cada incremento comprueba dos preguntas: “¿esta función pertenece a la fase actual?” y “¿funciona sin red?”.

No se inicia una fase por calendario solamente. Sus puertas son:

| Transición | Evidencia requerida |
| --- | --- |
| Preparación → Fase 0 | App instalable, autenticada una vez y abierta sin red |
| Fase 0 → Fase 1 | 30 días de medida diaria continua o rediseño de Fase 0 |
| Fase 1 → Fase 2 | Una alerta evita un error real y comprobable |
| Fase 2 → Fase 3 | Una decisión distinta tomada por el dueño gracias al sistema |
| Fase 3 → Fase 4 | Multifizca estable y una capa de eventos suficientemente desacoplada |

## 11. Riesgos y respuestas

| Riesgo | Respuesta planificada |
| --- | --- |
| El hábito diario no nace | Mantener una sola captura, observar uso real y rediseñar antes de agregar módulos |
| Pérdida de datos por offline prolongado | Escritura transaccional local, cola persistente, respaldo al reconectar y comprobación visible |
| Un retiro de leche se pasa por alto | Alerta roja persistente, cálculo horario probado y ninguna acción que la oculte sin expiración o corrección auditada |
| Un cálculo económico queda legalmente desactualizado | Settings versionados, fuente enlazada y verificación oficial antes de cada actualización |
| Conflictos entre padre, madre e hijo | Edición retroactiva con auditoría, LWW por campo y bitácora visible al administrador |
| Demasiado alcance inicial | Puertas de fase, cuatro pantallas y revisión explícita antes de aceptar una historia nueva |
| UI incómoda para el dispositivo real | Pruebas tempranas en Android económico y validación acompañada en la finca |
| Datos de arranque incompletos | Campos opcionales y tareas de confirmación; no valores inventados ni importación ficticia |

## 12. Decisiones pendientes que deben resolverse antes o durante Fase 0

1. Método concreto de alta inicial de padre y madre: enlace mágico, contraseña administrada u otro mecanismo compatible con conectividad intermitente.
2. Nombre de la finca, hectáreas definitivas, número y nombres de potreros, número actual de animales por categoría y tabla de aforo.
3. Política de corrección de una medida diaria duplicada: conservar ambas medidas o marcar una como reemplazada, manteniendo auditoría.
4. Propietario operativo de Supabase, Cloudflare/Vercel y Storage, más la política de cuentas de recuperación.
5. Navegador Android y versión mínima de dispositivo para validar PWA, almacenamiento persistente y actualizaciones.
6. Fuente oficial y responsable de verificar las tablas de precio y el esquema sanitario vigente antes de habilitar Fase 2.

Estas preguntas no bloquean el scaffolding, el modo litros ni la alta mínima de vacas. Sí bloquean decisiones de identidad, la conversión por regla y cualquier comunicación de cumplimiento legal.
