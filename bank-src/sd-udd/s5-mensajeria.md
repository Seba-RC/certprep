// Sección 5: Colas de mensajes y middleware (~10 preguntas del examen)
// 5.1 Semánticas, idempotencia y deduplicación / 5.2 Kafka / 5.3 Ack, back-pressure y DLQ / 5.4 Patrones y desacoplamiento

### sd-5101 [5.1] d1 #semanticas #at-most-once
Un productor envía cada mensaje una sola vez y nunca reintenta, aunque no reciba confirmación. ¿Qué semántica de entrega obtiene?
+ At-most-once: cada mensaje llega una vez o ninguna; puede perder mensajes, pero nunca los duplica :: Sin reintentos no hay duplicados, pero un mensaje perdido en la red se pierde para siempre.
- At-least-once :: At-least-once requiere reintentar hasta tener confirmación.
- Exactly-once :: Exactly-once necesita reintentos más deduplicación o confirmación transaccional.
- Best-effort ordering :: No es una de las semánticas de entrega del temario; además el orden es otro tema.
> At-most-once: sin reintentos → puede perder, nunca duplica.

### sd-5102 [5.1] d1 #semanticas #at-least-once
¿Qué riesgo introduce la semántica at-least-once?
- Perder mensajes cuando la red falla :: Al reintentar hasta tener confirmación, at-least-once evita justamente las pérdidas.
+ Procesar el mismo mensaje más de una vez, porque se reintenta aunque el mensaje ya hubiera llegado y solo se perdiera la confirmación :: Por eso los consumidores at-least-once deben ser idempotentes o detectar duplicados.
- Que los mensajes lleguen desordenados siempre :: El orden es una garantía distinta; no depende solo de la semántica de entrega.
- Que el broker se sature con mensajes vacíos :: No hay mensajes vacíos involucrados.
> At-least-once: reintenta hasta confirmar → nunca pierde, pero puede duplicar.

### sd-5103 [5.1] d2 #exactly-once
¿Qué se necesita para lograr exactly-once en un sistema de mensajería?
- Usar TCP, porque TCP garantiza entrega exactamente una vez :: TCP garantiza el orden y la entrega dentro de una conexión; si la conexión se cae y la aplicación reintenta, puede haber duplicados.
+ Reintentos (como at-least-once) combinados con deduplicación o confirmación transaccional, de modo que los duplicados no tengan efecto :: Exactly-once es "at-least-once + efectos idempotentes o transaccionales". Kafka lo implementa con productor idempotente y transacciones.
- No reintentar nunca :: Eso es at-most-once: evita duplicados a costa de perder mensajes.
- Un broker con discos más rápidos :: El rendimiento no cambia la semántica de entrega.
> Exactly-once = reintentos + deduplicación (o commit transaccional del efecto y la confirmación).

### sd-5104 [5.1] d2 #idempotencia
Un consumidor at-least-once procesa mensajes de pagos. ¿Qué operación es idempotente?
- `saldo = saldo + 100` :: Si el mensaje se procesa dos veces, se abona 200. No es idempotente.
+ `UPDATE pedidos SET estado = 'PAGADO' WHERE id = 42` :: Aplicarla una o varias veces deja el mismo resultado; un duplicado no causa daño.
- `INSERT INTO pagos (monto) VALUES (100)` sin clave única :: Cada repetición inserta una fila nueva; se duplica el pago.
- Enviar un correo de confirmación :: Un duplicado envía dos correos. Es un efecto externo no idempotente.
> Idempotente = aplicar una o N veces produce el mismo efecto. Con at-least-once, el consumidor debe serlo o deduplicar.

### sd-5105 [5.1] d2 #deduplicacion #ack
Un consumidor procesa correctamente un mensaje, pero su ACK se pierde en la red. ¿Qué pasa y por qué importa?
+ El broker no recibe el ACK y reenvía el mensaje; el consumidor lo recibirá de nuevo aunque ya lo procesó :: Por eso el consumidor no puede confiar solo en el broker para evitar duplicados: necesita deduplicación propia o procesamiento idempotente.
- El broker detecta que el consumidor ya lo procesó y no lo reenvía :: El broker no tiene forma de saberlo sin el ACK.
- El mensaje se pierde para siempre :: Con at-least-once el broker conserva el mensaje hasta recibir el ACK.
- El consumidor recibe un error y debe reiniciarse :: No hay error visible: el reenvío es el funcionamiento normal.
> Un ACK perdido produce un reenvío de un mensaje ya procesado. La deduplicación tiene que estar en el consumidor.

### sd-5106 [5.1] d3 #deduplicacion #transaccion
Un consumidor deduplica guardando el ID de cada mensaje procesado en una tabla. ¿Cuál es la implementación correcta?
- Guardar el ID en la tabla, confirmar el mensaje y después aplicar el efecto :: Si el consumidor cae después de guardar el ID y antes de aplicar el efecto, el mensaje queda marcado como procesado sin haberlo sido.
- Aplicar el efecto, enviar el ACK y por último guardar el ID :: Si cae antes de guardar el ID y el broker reenvía, el efecto se aplica dos veces.
+ Aplicar el efecto y guardar el ID en la misma transacción de base de datos; luego enviar el ACK. Al recibir un mensaje, si su ID ya está, se confirma sin procesar :: Efecto y registro quedan atómicos: o están ambos o ninguno. Un reenvío posterior se detecta y se descarta.
- Guardar los IDs en memoria del proceso consumidor :: Si el consumidor se reinicia, pierde la lista y vuelve a procesar duplicados.
> Deduplicación robusta: registrar el ID procesado en la misma transacción que el efecto, y confirmar después.

### sd-5107 [5.1] d2 #idempotencia #clave
Un servicio de pedidos recibe mensajes "crear pedido" por una cola at-least-once. ¿Qué diseño evita pedidos duplicados?
- Aumentar el timeout de ACK del broker :: Reduce los reenvíos pero no los elimina; cualquier falla de red puede seguir causándolos.
+ Incluir un ID único generado por el productor (por ejemplo, un UUID) y usarlo como clave única al insertar el pedido :: Un duplicado choca con la restricción de unicidad y se ignora, haciendo idempotente la creación.
- Usar auto-ack para que el broker no reenvíe :: Auto-ack cambia el riesgo de duplicar por el de perder mensajes.
- Procesar los mensajes en un solo hilo :: Un hilo no impide que el broker reenvíe un mensaje ya procesado.
> Para hacer idempotente una creación: ID único del productor + restricción de unicidad en el consumidor.

### sd-5108 [5.1] d1 #semanticas #comparacion
Un sistema de métricas envía lecturas de temperatura cada segundo. Perder alguna lectura no importa, pero duplicarlas distorsionaría los promedios. ¿Qué semántica conviene?
+ At-most-once :: Es la más barata y nunca duplica. Perder una lectura entre muchas es aceptable en este caso.
- At-least-once :: Garantiza no perder, pero introduce duplicados, que aquí sí importan.
- Exactly-once :: Sería correcta, pero es la más cara; no hace falta si las pérdidas son tolerables.
- Ninguna, las métricas no usan colas :: Las métricas suelen viajar justamente por colas o streams.
> Elige la semántica según qué es peor para el caso: perder (→ at-least-once) o duplicar (→ at-most-once).

### sd-5201 [5.2] d1 #kafka #orden
¿Qué garantía de orden da Kafka?
- Orden global entre todos los mensajes de un topic :: Kafka no ordena entre particiones distintas de un topic.
+ Orden FIFO dentro de cada partición, sin garantía de orden entre particiones distintas :: Cada partición es un log ordenado. Si un topic tiene varias, los mensajes de distintas particiones pueden consumirse en cualquier orden relativo.
- Ningún orden: los mensajes se entregan al azar :: Dentro de una partición el orden se respeta siempre.
- Orden por timestamp del productor :: Kafka ordena por offset dentro de la partición, no por el reloj del productor.
> Kafka: orden garantizado solo dentro de una partición.

### sd-5202 [5.2] d2 #kafka #partition-key
Todos los eventos de un mismo pedido (creado, pagado, enviado) deben procesarse en orden. El topic tiene 6 particiones. ¿Qué hace el productor?
+ Usa el ID del pedido como partition key, para que todos sus eventos caigan en la misma partición :: Misma key → misma partición → orden FIFO garantizado para ese pedido. Pedidos distintos pueden procesarse en paralelo.
- Envía los eventos sin key, para repartir la carga :: Sin key los eventos de un pedido pueden caer en particiones distintas y perder su orden relativo.
- Reduce el topic a una partición :: Funciona, pero elimina el paralelismo para todos los pedidos. La key logra el orden necesario sin ese costo.
- Agrega un timestamp a cada evento para que Kafka los reordene :: Kafka no reordena mensajes por contenido.
> Para ordenar eventos de una entidad: partition key = ID de la entidad.

### sd-5203 [5.2] d2 #consumer-group
Un topic tiene 4 particiones y un consumer group tiene 6 consumidores. ¿Qué pasa?
- Cada partición se reparte entre varios consumidores del grupo :: Dentro de un grupo, cada partición la procesa un solo miembro a la vez.
+ 4 consumidores reciben una partición cada uno y 2 quedan ociosos :: El paralelismo máximo de un grupo es el número de particiones. Los ociosos sirven de reemplazo si alguno falla.
- Kafka crea 2 particiones nuevas automáticamente :: El número de particiones no cambia solo.
- Todos reciben todos los mensajes :: Eso pasa entre grupos distintos, no dentro de un mismo grupo.
> En un consumer group: cada partición → exactamente un miembro. Más consumidores que particiones = consumidores ociosos.

### sd-5204 [5.2] d2 #consumer-group #pub-sub
El servicio de facturación y el de analítica leen el mismo topic, cada uno con su propio consumer group. ¿Qué mensajes recibe cada uno?
+ Cada grupo recibe todos los mensajes del topic; dentro de cada grupo, las particiones se reparten entre sus miembros :: Así Kafka combina publish-subscribe (entre grupos) con reparto de carga (dentro de un grupo).
- Se reparten los mensajes: la mitad a cada servicio :: Eso pasaría si ambos estuvieran en el mismo grupo.
- Solo el primer grupo en conectarse recibe los mensajes :: Los grupos son independientes y cada uno lleva sus propios offsets.
- Cada mensaje lo recibe un único consumidor en todo el sistema :: Eso es point-to-point. Entre grupos distintos, cada uno recibe su copia.
> Grupos distintos = pub-sub (todos reciben todo). Mismo grupo = reparto de particiones.

### sd-5205 [5.2] d3 #kafka #particiones
Un topic de 4 particiones usa el ID de cliente como key. Se aumenta a 8 particiones. ¿Qué riesgo aparece?
- Ninguno: las keys conservan siempre su partición :: Con el particionador por defecto la partición sale del hash de la key módulo el número de particiones. Al cambiar el número, cambia el destino de muchas keys.
+ Muchas keys pasan a otra partición; mientras haya mensajes viejos sin consumir en la partición anterior, los eventos de un cliente pueden procesarse fuera de orden :: El orden solo se garantiza dentro de una partición, y la misma key quedó repartida entre dos.
- Kafka borra los mensajes antiguos al repartir :: Agregar particiones no borra ni mueve mensajes existentes.
- Los consumidores dejan de funcionar hasta reiniciar el broker :: El grupo se rebalancea y sigue funcionando.
> Partición = hash(key) mod N. Cambiar N rompe la relación key → partición y con ella el orden por key.

### sd-5206 [5.2] d1 #consumer-group #paralelismo
¿Para qué sirve un consumer group?
- Para que un mismo mensaje se procese en paralelo por todos los miembros :: Dentro de un grupo cada mensaje lo procesa un solo miembro.
+ Para repartir las particiones de un topic entre varios consumidores y procesarlas en paralelo, con cada partición asignada a un solo miembro a la vez :: Si un miembro cae, sus particiones se reasignan a los demás.
- Para garantizar orden global entre particiones :: El grupo no cambia las garantías de orden.
- Para replicar los mensajes en varios brokers :: La replicación es una función del broker, no de los consumidores.
> Consumer group = escalar el consumo: particiones repartidas, una por miembro a la vez.

### sd-5301 [5.3] d1 #ack #manual
¿Cuándo debe un consumidor enviar el ACK si usa confirmación manual?
- Apenas recibe el mensaje, antes de procesarlo :: Si falla al procesar, el broker ya lo descartó y el mensaje se pierde.
+ Después de procesarlo con éxito; si falla antes, el broker lo reentrega :: Así un fallo del consumidor no pierde mensajes (at-least-once).
- Nunca; el broker detecta solo cuando terminó :: Sin ACK el broker no sabe si el mensaje se procesó.
- Antes de recibirlo, para reservarlo :: No se puede confirmar algo que aún no se ha recibido.
> Manual ack: confirmar después de procesar con éxito. Si no hay ACK, el broker reentrega.

### sd-5302 [5.3] d2 #auto-ack
Un consumidor usa auto-ack y se cae a mitad de procesar un mensaje. ¿Qué pasa con ese mensaje?
- El broker lo reentrega a otro consumidor :: Con auto-ack el broker ya lo dio por entregado y no lo conserva.
+ Se pierde: con auto-ack el broker lo descarta al entregarlo, antes de saber si se procesó correctamente :: Auto-ack equivale a at-most-once. Es útil si perder mensajes es aceptable y se quiere máximo rendimiento.
- Queda en la DLQ :: La DLQ recibe mensajes rechazados o que agotaron reintentos; con auto-ack no hay rechazo posible.
- Se procesa dos veces :: Nadie lo reenvía; el problema es la pérdida, no el duplicado.
> Auto-ack: el broker descarta al entregar. Si el consumidor cae, el mensaje se pierde.

### sd-5303 [5.3] d2 #back-pressure
¿Qué es back-pressure en un sistema de mensajería?
+ Un mecanismo por el que el consumidor o el broker le indica al productor que reduzca su tasa de envío, para no saturar recursos ni perder mensajes :: Por ejemplo: el broker bloquea o frena a los productores cuando se queda sin memoria, o el consumidor limita cuántos mensajes recibe sin confirmar.
- Reenviar mensajes desde el consumidor al productor :: Back-pressure es una señal de control de flujo, no un reenvío de mensajes.
- Una cola especial para mensajes que fallaron :: Esa es la dead letter queue.
- Aumentar la presión de procesamiento usando más hilos :: Agregar hilos puede ayudar, pero back-pressure se trata de frenar la entrada.
> Back-pressure: el lento le dice al rápido que frene. Evita saturación y pérdida de mensajes.

### sd-5304 [5.3] d2 #dlq
Un mensaje con un formato inválido hace fallar al consumidor cada vez, y el broker lo reentrega sin fin. ¿Qué solución describe el temario?
- Usar auto-ack para que no se reentregue :: Ocultaría el problema y además perdería los mensajes válidos si el consumidor cae.
+ Configurar una dead letter queue: tras N reintentos fallidos, el mensaje se mueve a la DLQ para investigarlo, sin bloquear el flujo normal :: El "mensaje venenoso" deja de ocupar al consumidor y queda guardado para análisis.
- Borrar el topic y volver a crearlo :: Perdería todos los mensajes pendientes, incluidos los válidos.
- Reiniciar el consumidor cada vez que falla :: El mensaje volvería a fallar después del reinicio.
> DLQ: destino de mensajes que fallan tras N reintentos. Permite investigar sin bloquear la cola principal.

### sd-5305 [5.3] d3 #back-pressure #prefetch
Un consumidor de RabbitMQ lento recibe miles de mensajes sin confirmar y se queda sin memoria. ¿Qué ajuste aplica back-pressure desde el consumidor?
- Pasar a auto-ack para que el broker no espere confirmaciones :: Con auto-ack el broker envía todo lo que puede y el problema empeora; además se pierden mensajes si el consumidor cae.
+ Limitar el prefetch (por ejemplo, `basic.qos` con prefetch = 10) para que el broker no envíe más mensajes sin confirmar de los que el consumidor puede manejar :: El broker frena las entregas hasta recibir ACKs: el consumidor marca su propio ritmo.
- Aumentar el tamaño del buffer TCP del consumidor :: Postergaría el problema, pero el broker seguiría enviando más de lo que el consumidor procesa.
- Crear una DLQ :: La DLQ sirve para mensajes fallidos, no para controlar el ritmo de entrega.
> El prefetch limitado es back-pressure del lado consumidor: no recibir más de lo que se puede procesar.

### sd-5306 [5.3] d2 #ack #rechazo
El consumidor detecta un error transitorio (la base de datos no responde) al procesar un mensaje con ack manual. ¿Qué debería hacer?
+ No confirmar o enviar un NACK con reencolado, para que el broker lo reentregue más tarde; tras N fallos, que el mensaje vaya a la DLQ :: El error es transitorio, así que un reintento probablemente funcione. La DLQ evita reintentos infinitos si no se resuelve.
- Enviar ACK y registrar el error en un log :: El ACK elimina el mensaje del broker; se perdería el trabajo.
- Terminar el proceso consumidor :: Al caer sin ACK el mensaje se reentregaría, pero detener el consumidor afecta a todos los demás mensajes.
- Reenviarlo como mensaje nuevo al mismo topic :: Pierde el conteo de reintentos y puede duplicar el mensaje si el original también se reentrega.
> Error transitorio con ack manual: no confirmar o NACK con reencolado, con un límite de reintentos que termine en la DLQ.

### sd-5401 [5.4] d1 #patrones #point-to-point
¿En qué se diferencian los patrones point-to-point y publish-subscribe?
+ En point-to-point cada mensaje lo consume exactamente un receptor; en publish-subscribe cada mensaje se entrega a todos los suscriptores del topic :: Point-to-point reparte trabajo (colas de tareas); pub-sub difunde eventos a varios interesados.
- Point-to-point usa TCP y publish-subscribe usa UDP :: El patrón no depende del protocolo de transporte.
- En publish-subscribe el productor debe conocer a cada suscriptor :: El productor publica en el topic; el broker se encarga de los suscriptores.
- En point-to-point los mensajes se entregan a todos los receptores conectados :: Eso describe publish-subscribe.
> Point-to-point: uno consume cada mensaje. Pub-sub: todos los suscriptores reciben cada mensaje.

### sd-5402 [5.4] d2 #desacoplamiento-temporal
¿Cuál es el principal beneficio de poner un broker de mensajes entre dos servicios?
- Que los mensajes viajan más rápido que con una conexión directa :: Agregar un intermediario suele sumar latencia, no restarla.
+ El desacoplamiento temporal: el productor puede enviar aunque el consumidor no esté disponible, y el broker guarda el mensaje hasta que este se reconecte :: Los servicios no necesitan estar activos al mismo tiempo ni conocerse entre sí.
- Que elimina la necesidad de manejar errores :: Siguen existiendo fallas: duplicados, mensajes venenosos, consumidores caídos.
- Que garantiza exactly-once sin configuración :: La semántica de entrega depende de la configuración y del consumidor.
> Broker = desacoplamiento temporal: productor y consumidor no tienen que estar activos a la vez.

### sd-5403 [5.4] d2 #request-reply
Un servicio A necesita una respuesta del servicio B, pero se comunican por un broker. ¿Cómo se implementa request-reply?
- A abre una conexión TCP directa con B para recibir la respuesta :: Eso elimina el desacoplamiento que se buscaba con el broker.
+ A publica la solicitud con un correlation ID y una cola de respuesta (reply-to); B procesa y publica la respuesta en esa cola con el mismo correlation ID :: A asocia la respuesta a su solicitud y ninguno necesita estar activo al mismo tiempo que el otro.
- B lee la memoria de A para dejar la respuesta :: Son procesos distintos, normalmente en máquinas distintas.
- A espera bloqueado en el broker hasta que B esté conectado :: El broker almacena la solicitud; A no necesita que B esté conectado en ese momento.
> Request-reply sobre broker: cola de respuesta + correlation ID; mantiene el desacoplamiento temporal.

### sd-5404 [5.4] d2 #competing-consumers
Una cola de trabajos de conversión de video tiene tres instancias del worker leyendo de ella. ¿Qué patrón es y qué se obtiene?
+ Point-to-point con consumidores en competencia: cada trabajo lo procesa una sola instancia y la carga se reparte entre las tres :: Agregar workers aumenta el throughput sin que un video se convierta dos veces (salvo reentregas).
- Publish-subscribe: cada video se convierte tres veces :: En pub-sub cada suscriptor recibe todo; aquí se quiere repartir el trabajo.
- Request-reply: cada worker responde a los otros dos :: Los workers no se comunican entre sí.
- Un consumer group de Kafka obligatoriamente :: Los consumidores en competencia también existen en colas como RabbitMQ; Kafka es una forma, no la única.
> Varios consumidores sobre una cola point-to-point = reparto de carga (competing consumers).

### sd-5405 [5.4] d1 #pub-sub
Cuando se registra un usuario, deben enterarse el servicio de correo, el de analítica y el de recomendaciones. ¿Qué patrón conviene?
- Point-to-point con una cola compartida por los tres :: Cada evento lo recibiría solo uno de los tres servicios.
+ Publish-subscribe: el servicio de usuarios publica "usuario_registrado" en un topic y los tres se suscriben :: Cada servicio recibe su copia del evento, y se pueden agregar suscriptores sin modificar al publicador.
- Request-reply desde usuarios hacia cada servicio :: Acopla al servicio de usuarios con cada consumidor y lo obliga a esperar respuestas que no necesita.
- Escribir directamente en la base de datos de cada servicio :: Acoplamiento máximo, sin las ventajas del broker.
> Un evento que interesa a varios servicios → publish-subscribe.

### sd-5207 [5.2] d2 #consumer-group #rebalanceo
Un miembro de un consumer group de Kafka se cae mientras procesaba mensajes de su partición. ¿Qué ocurre?
+ El grupo se rebalancea: su partición se asigna a otro miembro, que continúa desde el último offset confirmado, por lo que algunos mensajes pueden reprocesarse :: El reprocesamiento es otra razón para que los consumidores sean idempotentes.
- La partición queda detenida hasta que ese consumidor vuelva :: Kafka reasigna la partición a los miembros vivos del grupo.
- Otro miembro continúa exactamente desde el último mensaje que el consumidor caído alcanzó a leer :: Continúa desde el último offset confirmado (commit), que puede ser anterior a lo que el consumidor alcanzó a leer.
- Todos los miembros del grupo reciben los mensajes de esa partición :: Incluso tras el rebalanceo, cada partición sigue asignada a un solo miembro.
> Si cae un consumidor del grupo, sus particiones se reasignan y se retoma desde el último offset confirmado (posibles duplicados).

### sd-5307 [5.3] d3 #kafka #offset #semanticas
En Kafka, el equivalente al ACK es confirmar (commit) el offset. Un consumidor confirma el offset antes de procesar cada lote. ¿Qué semántica obtiene?
+ At-most-once: si se cae después del commit y antes de terminar de procesar, al reiniciar se salta esos mensajes :: Confirmar primero es como el auto-ack: se arriesga a perder mensajes, nunca a duplicarlos.
- At-least-once :: Para at-least-once el commit debe ir después de procesar.
- Exactly-once :: Exactly-once requiere que el procesamiento y el commit del offset sean atómicos (transacciones) o que el consumidor sea idempotente.
- Ninguna, porque Kafka no tiene confirmaciones :: El commit del offset cumple justamente esa función.
> Commit antes de procesar → at-most-once. Commit después de procesar → at-least-once.

### sd-5406 [5.4] d2 #desacoplamiento-temporal #disponibilidad
El servicio de inventario se cae dos horas. El servicio de ventas le comunicaba cada venta por HTTP directo; se propone cambiarlo por una cola. ¿Qué cambia durante la caída?
- Nada: en ambos casos las ventas fallan mientras inventario esté caído :: Con la cola, ventas puede publicar aunque inventario no esté.
+ Con HTTP las llamadas fallan y ventas debe reintentar o perder las notificaciones; con la cola, los mensajes se acumulan en el broker y se procesan cuando inventario vuelve :: Es el desacoplamiento temporal. Hay que dimensionar la retención y considerar que el inventario queda desactualizado mientras tanto.
- Con la cola las ventas se procesan dos veces, una por cada intento :: Con at-least-once puede haber duplicados ocasionales, pero no se duplica todo; para eso está la idempotencia.
- Con HTTP se pierde menos información porque es síncrono :: Ser síncrono hace que la falla del receptor se propague al emisor.
> Con un broker, la caída del consumidor no bloquea al productor: los mensajes esperan en la cola.
