# Datos locales primero y sincronización mediante outbox

REJO se usará en una finca sin conectividad confiable, por lo que Dexie/IndexedDB es el lugar donde cada pantalla lee y escribe. Cada mutación local y su elemento de cola de sincronización se guardan en la misma transacción; un worker los entrega a Supabase cuando haya red, recibe cambios remotos y registra conflictos por campo con last-write-wins y bitácora. Esto prioriza que anotar la leche o un evento sanitario nunca dependa de la red, a cambio de diseñar explícitamente idempotencia, conflictos y recuperación de cola.
