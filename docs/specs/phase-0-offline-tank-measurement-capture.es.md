# Fase 0 — Captura offline de la medida diaria del tanque

## Problema

La finca piloto no tiene un sistema confiable de registros y opera con señal celular intermitente o inexistente. No hay una forma simple de guardar la medida del tanque que recoge el tanquero ni de saber si el dato quedó respaldado. Un sistema ganadero amplio agregaría demasiada fricción para los dueños, que usan un Android económico, a menudo con las manos mojadas y en horario de ordeño.

El riesgo inmediato no es la falta de una métrica avanzada: es no crear el hábito de anotar un número diario. Si la captura depende de internet, exige litros por vaca o añade pasos, la finca volverá a las notas sueltas y no tendrá datos confiables para las fases reproductiva, sanitaria y económica.

## Solución

Entregar una PWA instalable y local-first que permita registrar la medida diaria del tanque en menos de diez segundos, incluso sin red. La interfaz de producto tendrá exactamente cuatro pantallas: Inicio, Anotar la leche, Mis vacas y Ajustes.

La medida del tanque será el hecho primario de producción. La persona podrá ingresar litros directamente o una marca de regla cuando exista tabla de aforo; la leche retirada para terneros será opcional. La aplicación guardará primero el dato en el celular junto con una operación persistente de sincronización y lo respaldará en Supabase cuando vuelva la conectividad. La interfaz comunicará “Guardado en el celular” o “Ya se envió” y nunca bloqueará la captura por el estado de red.

## Historias de usuario

1. Como dueño de la finca, quiero abrir la aplicación instalada sin señal, para registrar la medida del tanque desde cualquier parte del predio.
2. Como dueño de la finca, quiero ver claramente los litros de hoy, para saber si ya se anotó la entrega.
3. Como dueño de la finca, quiero ver el promedio de los últimos siete días, para notar una variación sin leer una gráfica complicada.
4. Como dueño de la finca, quiero un único botón predominante “Anotar la leche de hoy”, para iniciar la tarea diaria sin navegar por menús.
5. Como dueño de la finca, quiero un teclado numérico para ingresar litros, para evitar errores de un teclado completo.
6. Como dueño de la finca, quiero registrar litros directamente, para anotar lo declarado por el tanquero aun antes de tener la tabla de aforo.
7. Como dueño de la finca, quiero ingresar una marca de regla cuando exista tabla de aforo, para no calcular los litros manualmente.
8. Como dueño de la finca, quiero ver la conversión de marca a litros antes de guardar, para detectar una marca mal escrita.
9. Como dueño de la finca, quiero una advertencia clara cuando una marca quede fuera de la tabla de aforo, para decidir si un resultado extrapolado es creíble.
10. Como dueño de la finca, quiero anotar opcionalmente la leche retirada para terneros, para que esa salida no sea invisible sin convertirla en requisito diario.
11. Como hijo administrador, quiero usar una fecha retroactiva, para transcribir con precisión lo contado después por los dueños.
12. Como dueño de la finca, quiero corregir una medida de tanque mal ingresada, para que el historial sea útil sin eliminar silenciosamente el hecho original.
13. Como dueño de la finca, quiero confirmación inmediata al guardar, para saber que el teléfono conservó el dato aun sin internet.
14. Como dueño de la finca, quiero que una medida sobreviva al cierre o recarga de la aplicación, para no perder datos de ordeño.
15. Como dueño de la finca, quiero recibir una advertencia de posible duplicación del mismo día y decidir cómo continuar, para no distorsionar el promedio por un toque accidental.
16. Como dueño de la finca, quiero confirmar una medida inusualmente alta o baja en lugar de quedar bloqueado, para no descartar hechos reales.
17. Como dueño de la finca, quiero que el promedio de siete días incluya solo registros vigentes de mi finca, para que sea una referencia honesta.
18. Como dueño de la finca, quiero ver “Guardado en el celular” mientras esté offline, para distinguir un respaldo pendiente de un guardado fallido.
19. Como administrador, quiero que los registros pendientes se respalden automáticamente cuando vuelva la señal, para que nadie deba reingresar datos ni administrar archivos.
20. Como administrador, quiero que la sincronización reintentada sea idempotente, para que las reconexiones nunca dupliquen una medida.
21. Como miembro de la finca, quiero que los datos de otra finca sean inaccesibles, para proteger la información familiar desde la primera entrega.
22. Como dueño de la finca, quiero una lista simple de mis vacas por nombre y, cuando exista, foto, para reconocerlas como las reconoce la finca.
23. Como dueño de la finca, quiero dar de alta una vaca con nombre, sexo y edad aproximada, para cargar el rejo inicial sin formulario técnico largo.
24. Como dueño de la finca, quiero que solo el nombre sea obligatorio al dar de alta una vaca, para poder anotarla aunque no recuerde todos los datos.
25. Como administrador, quiero que la edad aproximada siga marcada como estimada, para no presentar una fecha inventada como un hecho.
26. Como dueño de la finca, quiero corregir información de una vaca sin borrarla físicamente, para conservar un historial recuperable.
27. Como administrador, quiero configurar los datos básicos de finca y Alpina como comprador, para que las medidas pertenezcan al contexto correcto.
28. Como administrador, quiero cargar y editar pares de marca y litros de la tabla de aforo, para usar la regla específica de este tanque.
29. Como administrador, quiero que la tabla de aforo avise valores de litros que no crecen con la marca, para corregir configuración riesgosa.
30. Como dueño de la finca, quiero una explicación única del uso correcto de la regla, para mejorar la medida sin llenar la captura diaria de instrucciones.
31. Como administrador, quiero instalar la aplicación en el Android de la finca y abrirla como una aplicación normal, para que el uso diario no dependa de recordar una URL.
32. Como administrador, quiero que todas las fechas de negocio se interpreten en America/Guayaquil, para que un registro de madrugada no caiga en el día anterior.
33. Como equipo de finca, quiero que esta fase excluya reproducción, sanidad, costos, potreros, reportes, gráficas y control lechero, para validar primero el hábito de un registro.
34. Como equipo de finca, quiero usar la aplicación treinta días consecutivos antes de ampliarla, para justificar la siguiente fase con evidencia.

## Decisiones de implementación

- La aplicación será una PWA con React, TypeScript, Tailwind, componentes accesibles, formularios validados y persistencia de consultas.
- Los textos visibles de interfaz estarán en español del Carchi. El código, comentarios de código, títulos de issues y commits estarán en inglés.
- El dispositivo escribe primero en IndexedDB mediante Dexie. Supabase es respaldo y colaboración, nunca requisito para la captura diaria.
- Aplica ADR-0001: cada mutación guarda datos locales y una entrada de outbox en una transacción. Un worker entrega las entradas cuando hay conectividad, usa claves idempotentes y conserva auditoría de conflictos por campo con last-write-wins.
- Todas las entidades de negocio incluyen UUIDv7, farm_id, datos de auditoría de creación y actualización, created_by, marca de sincronización y soft delete. Las correcciones nunca hacen borrado físico.
- La primera autenticación y el aprovisionamiento requieren conectividad. Una vez aprovisionada, la aplicación debe seguir leyendo y capturando offline.
- Supabase aplica control de acceso por miembros de finca. Fase 0 admite administrador y dueño; los demás roles quedan modelables pero no se exponen.
- Fase 0 modela finca, membresía, comprador, tabla de aforo, animal, medida de tanque, salida interna y outbox. No materializa flujos futuros de reproducción, sanidad, economía o potreros.
- Una medida de tanque conserva fecha local, hora, momento y fuente de lectura para ser compatible con lecturas dobles futuras. Fase 0 expone únicamente la medida diaria de entrega de la finca.
- La leche para terneros se guarda como salida interna opcional en la misma fecha de negocio.
- La tabla de aforo acepta puntos de marca y litros. La conversión interpola linealmente entre puntos, devuelve cero bajo el mínimo, no convierte una tabla vacía y solo permite extrapolar sobre el máximo con advertencia.
- Inicio contiene únicamente litros de hoy, promedio de siete días y acceso a captura. Exige texto de al menos 18 px, controles de al menos 48 px, alto contraste y uso táctil con una mano.
- Mis vacas permite creación y corrección mínima. La edad aproximada se representa explícitamente como estimada y nunca se convierte en fecha histórica inventada.
- Ajustes permite datos de finca, comprador y tabla de aforo. Los valores aún desconocidos permanecen opcionales; el sistema no inventa hectáreas, potreros, sanidad ni activos.
- El seam principal de pruebas es el comando de captura diaria: recibe medida de tanque, fecha local y salida opcional; valida, persiste hechos locales y crea la operación de outbox atómicamente. La interfaz usa ese único camino de guardado.
- El adaptador de sincronización es un seam secundario: consume operaciones pendientes, confirma entregas idempotentes, recibe cambios de finca y conserva evidencia de conflicto. Las pantallas no prueban detalles de Dexie ni Supabase.

## Decisiones de pruebas

- Las pruebas verifican comportamiento observable y contratos de dominio: qué se guarda, muestra, sincroniza y queda disponible offline. No dependen de internos de componentes, consultas concretas de IndexedDB ni detalles visuales.
- La conversión de tabla de aforo se prueba como función pura para puntos exactos, interpolación, tabla vacía, valores bajo mínimo y advertencias de extrapolación.
- El manejo de fechas se prueba alrededor de las 04:00 y medianoche en America/Guayaquil.
- El comando de captura diaria se prueba con almacén local falso para demostrar que escribe medida, salida opcional y outbox atómicamente; tras un fallo no puede quedar escritura parcial.
- El comando se prueba con duplicados, valores atípicos confirmados, fechas retroactivas, correcciones y registros con soft delete.
- El adaptador de sincronización se prueba contra backend falso para reintentos, idempotencia, recuperación tras reinicio y aislamiento por finca.
- El acceso se prueba con un miembro de otra finca que intenta leer, escribir y sincronizar: toda operación debe rechazarse.
- Las pruebas de interfaz cubren Inicio a captura y regreso, modo litros, modo regla, feedback de guardado local, controles táctiles, alta de vacas y formularios de aforo.
- Una prueba de navegador instalado verifica abrir, capturar, cerrar, recargar y reabrir en modo avión. Otra restaura conectividad y demuestra que la medida llega una sola vez al respaldo.

## Fuera de alcance

- Reproducción, celos, servicios, palpaciones, partos, secados y alertas reproductivas.
- Eventos sanitarios, plan sanitario, alertas de brucelosis, tratamientos y bloqueo por retiro de leche.
- Lecturas dobles, balance de leche, producción por sacada y control lechero individual.
- Facturas, calidad, precio justo, ingresos, egresos, costo por litro, compras, activos y mano de obra.
- Potreros, lotes, rotación, carga animal e indicadores del rejo.
- Gráficas, reportes, exportaciones, notificaciones, WhatsApp, RFID y hardware de medición.
- Onboarding multifinca autónomo, certificaciones, SIFAE y roles operativos distintos de administrador y dueño.
- Importación histórica, porque la finca no posee registros históricos confiables.

## Notas

- La aprobación es conductual: la finca debe registrar treinta días seguidos sin recordatorios externos. Si no se alcanza, se rediseña la experiencia antes de iniciar Fase 1.
- La aplicación puede señalar una medida inusual, pero nunca debe impedir que una persona guarde un hecho real confirmado.
- La captura por regla explica una única vez que el tanque debe estar nivelado, sin espuma y con el agitador apagado.
- La configuración legal de precios, el estado reproductivo y los cálculos sanitarios pertenecen a fases posteriores. Esta especificación no autoriza adelantarlos.
