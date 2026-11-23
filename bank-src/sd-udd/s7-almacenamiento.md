// Sección 7: Almacenamiento distribuido (~5 preguntas del examen)
// 7.1 Sharding y DHT (Chord) / 7.2 WAL, read repair y event sourcing

### sd-7101 [7.1] d1 #sharding #rango #hash
¿Qué diferencia práctica hay entre sharding por rango y sharding por hash?
+ Por rango hace eficientes las consultas por intervalos, pero es susceptible a hot spots; por hash reparte uniformemente, pero no soporta range queries de forma eficiente :: El hash dispersa claves vecinas en shards distintos: buen balance, pero una consulta por intervalo debe preguntar a todos.
- Por hash permite range queries eficientes y por rango reparte uniformemente :: Es al revés: el hash dispersa las claves vecinas y el rango las agrupa.
- Ambos tienen exactamente las mismas propiedades; solo cambia la implementación :: Tienen trade-offs opuestos en balance y en consultas por intervalo.
- Por rango requiere una DHT y por hash no :: Las DHT como Chord son, de hecho, una forma de particionar por hash.
> Rango: range queries eficientes, riesgo de hot spots. Hash: distribución uniforme, range queries costosas.

### sd-7102 [7.1] d2 #sharding #hot-spot
Una base de eventos se particiona por rango de fecha: cada shard guarda un mes. ¿Qué problema aparecerá?
- Las consultas "eventos de marzo" serán lentas :: Al contrario: una consulta por intervalo de fechas va a uno o pocos shards.
+ Todas las escrituras nuevas van al shard del mes actual, que se convierte en hot spot mientras los demás quedan ociosos :: Las claves secuenciales (fechas, IDs autoincrementales) concentran la carga en un solo rango.
- Los datos se reparten al azar entre shards :: El rango define exactamente a qué shard va cada fecha.
- No se pueden agregar shards nuevos :: Se agregan shards para los meses siguientes; el problema es la concentración de carga.
> Particionar por rango con claves secuenciales crea hot spots: la carga nueva cae siempre en el mismo shard.

### sd-7103 [7.1] d2 #chord #finger-table
¿Para qué sirve la finger table en Chord?
- Para guardar las claves de los nodos vecinos :: Las claves se guardan en el nodo responsable; la finger table guarda referencias a nodos.
+ Guarda referencias a nodos a distancias exponencialmente crecientes en el anillo (n + 2^0, n + 2^1, n + 2^2...), de modo que cada salto reduce la distancia restante aproximadamente a la mitad y una búsqueda toma O(log N) saltos :: Sin finger table, solo con el sucesor, habría que recorrer el anillo en O(N).
- Para elegir un líder en el anillo :: Chord no tiene líder; es un sistema peer-to-peer.
- Para cifrar las claves :: El hash se usa para ubicar claves en el anillo, no para cifrarlas.
> Finger table: atajos a distancias 2^i en el anillo → búsquedas en O(log N).

### sd-7104 [7.1] d2 #chord #sucesor
En un anillo Chord con identificadores de 0 a 63 hay nodos en 5, 20, 40 y 58. ¿Qué nodo es responsable de la clave 60?
- 58, porque es el nodo más cercano :: En Chord la clave va a su sucesor: el primer nodo con id mayor o igual a la clave.
+ 5, porque el anillo da la vuelta y 5 es el primer nodo después de 60 :: No hay nodos entre 60 y 63, así que el sucesor es el primer nodo del inicio del anillo.
- 40 :: 40 está antes de 60 en el anillo; nunca podría ser su sucesor.
- Ninguno, porque 60 es mayor que todos los nodos :: El espacio es circular: después de 63 sigue 0.
> En Chord, la clave k se guarda en successor(k): el primer nodo con id ≥ k, dando la vuelta al anillo si es necesario.

### sd-7105 [7.1] d2 #chord #ingreso-nodo
Un nodo nuevo ingresa a un anillo Chord. ¿Qué pasos describe el temario?
+ Contacta a un nodo existente para encontrar su posición, asume el rango de claves que le correspondía a su sucesor y se actualizan las finger tables :: Solo se mueven las claves entre el predecesor del nodo nuevo y el nodo nuevo; el resto del anillo no cambia.
- Se reparten de nuevo todas las claves del sistema entre todos los nodos :: Eso sería muy caro. Chord mueve solo las claves del tramo que el nuevo nodo pasa a cubrir.
- Pide a un coordinador central que le asigne claves :: Chord es descentralizado; no tiene coordinador.
- Copia la finger table de su sucesor sin cambios :: Las fingers dependen de la posición de cada nodo; deben calcularse para el nuevo id.
> Ingreso en Chord: contactar un nodo, tomar parte del rango del sucesor y actualizar finger tables.

### sd-7106 [7.1] d1 #sharding #hash #range-query
Una tabla de usuarios está particionada por hash del ID. ¿Qué pasa con la consulta "usuarios con ID entre 1000 y 2000"?
- Va a un solo shard, porque los IDs son consecutivos :: El hash dispersa IDs consecutivos en shards distintos.
+ Debe consultar todos los shards y combinar resultados, porque el hash dispersa los IDs del intervalo :: Es la desventaja del sharding por hash: las range queries tocan todo el cluster.
- Falla, porque las bases particionadas por hash no admiten WHERE :: La consulta funciona; el problema es su costo.
- Es más rápida que con sharding por rango :: Con sharding por rango iría a uno o pocos shards; con hash es más costosa.
> Hash = buen balance, pero las consultas por rango deben preguntar a todos los shards.

### sd-7201 [7.2] d1 #wal
¿Qué es un Write-Ahead Log (WAL)?
+ Un log donde cada escritura se registra secuencialmente antes de aplicarse a la estructura principal de datos :: Si el sistema cae, el log permite reconstruir las operaciones confirmadas que no alcanzaron a aplicarse.
- Un log que se escribe después de aplicar los cambios, para auditoría :: Lo esencial del WAL es que se escribe antes ("ahead") de modificar los datos.
- Una copia de seguridad diaria de la base de datos :: El WAL registra cada operación de forma continua, no un snapshot diario.
- Un log de errores del servidor :: El WAL contiene operaciones de datos, no mensajes de error.
> WAL: primero el log (secuencial y durable), después la estructura principal.

### sd-7202 [7.2] d2 #wal #recuperacion
Una base de datos con WAL confirma una escritura al cliente y se cae antes de actualizar sus páginas de datos. ¿Qué pasa al reiniciar?
- La escritura se pierde, porque no llegó a las páginas de datos :: La escritura ya estaba en el WAL, que es durable.
+ Hace replay de las entradas del WAL que no se habían aplicado y recupera la operación confirmada :: Es la razón de escribir el log antes: confirmar al cliente solo después de que la operación está en el log.
- Le pide al cliente que vuelva a enviar la operación :: El cliente ya recibió la confirmación; el sistema debe cumplirla sin ayuda.
- Restaura el último backup completo y descarta lo posterior :: Perdería operaciones confirmadas. El WAL existe para no tener que hacer eso.
> Tras un crash, se reproducen las entradas del WAL no aplicadas: lo confirmado no se pierde.

### sd-7203 [7.2] d2 #read-repair
Un coordinador lee una clave de tres réplicas y obtiene versión 5, versión 5 y versión 3. ¿Qué hace con read repair?
+ Responde con la versión 5 y le envía ese valor a la réplica que tenía la versión 3 para actualizarla :: La lectura sirve también para reparar réplicas desactualizadas, sin esperar a un proceso aparte.
- Responde con la versión 3, porque es la más antigua y por lo tanto la más segura :: Se debe responder con la versión más reciente.
- Devuelve un error de inconsistencia al cliente :: Read repair resuelve la diferencia en segundo plano; no hace fallar la lectura.
- Borra la clave en las tres réplicas :: Borrar perdería datos válidos.
> Read repair: el coordinador detecta réplicas viejas durante la lectura y les envía el valor más reciente.

### sd-7204 [7.2] d2 #event-sourcing
¿Qué caracteriza a event sourcing?
- Guardar solo el estado actual y sobrescribirlo en cada cambio :: Ese es el modelo CRUD tradicional.
+ Guardar la secuencia completa de eventos inmutables que produjeron el estado, de modo que el estado se reconstruye reproduciéndolos :: Permite reconstruir el estado en cualquier punto del tiempo y auditar cada cambio.
- Enviar eventos a una cola y descartarlos al consumirlos :: En event sourcing los eventos son la fuente de verdad y se conservan.
- Usar eventos solo para notificar a otros servicios :: Eso es mensajería por eventos; en event sourcing los eventos son el almacenamiento.
> Event sourcing: se guardan los eventos, no solo el estado; el estado es el resultado de reproducirlos.

### sd-7205 [7.2] d2 #event-sourcing #auditoria
Un banco necesita responder "¿cuál era el saldo de esta cuenta el 3 de marzo a las 14:00 y qué movimientos lo explican?". ¿Qué enfoque lo facilita?
- Guardar solo el saldo actual en una tabla :: El saldo actual no permite reconstruir valores pasados ni explicar cómo se llegó a ellos.
+ Event sourcing: reproducir los eventos (depósitos, retiros) hasta esa fecha reconstruye el saldo, y los mismos eventos son la auditoría :: Cada cambio queda registrado como un evento inmutable con su momento.
- Read repair :: Read repair corrige réplicas desactualizadas; no guarda historia.
- Sharding por hash del número de cuenta :: Distribuye la carga, pero no aporta historia ni auditoría.
> Event sourcing permite consultas temporales ("¿cómo estaba en tal fecha?") y auditoría completa.

### sd-7206 [7.2] d3 #event-sourcing #snapshots
Un sistema con event sourcing tiene millones de eventos por cuenta y reconstruir el estado se volvió lento. ¿Qué técnica, análoga al checkpointing de la Unidad 2, lo resuelve?
+ Guardar snapshots periódicos del estado y reproducir solo los eventos posteriores al último snapshot :: Igual que checkpoint + replay del log: se conserva la historia completa y se acorta la reconstrucción.
- Borrar los eventos antiguos y quedarse con el estado actual :: Se perdería la capacidad de auditar y de reconstruir estados pasados.
- Reproducir los eventos en orden aleatorio en paralelo :: El orden de los eventos importa; reordenarlos puede producir un estado distinto.
- Pasar a consistencia eventual :: El modelo de consistencia no reduce la cantidad de eventos a reproducir.
> Snapshot + replay de eventos posteriores: misma idea que checkpoint + log replay.
