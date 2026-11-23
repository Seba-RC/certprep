// Sección 4: Consistencia, replicación y tolerancia a fallos (~7 preguntas del examen)
// 4.1 CAP, PACELC y modelos / 4.2 Replicación, NWR y 2PC / 4.3 Conflictos, detección de fallos y recuperación

### sd-4101 [4.1] d1 #cap
Según el teorema CAP, ¿qué decisión enfrenta un sistema distribuido durante una partición de red?
+ Elegir entre consistencia (rechazar operaciones que no puede coordinar) y disponibilidad (aceptarlas con riesgo de inconsistencia) :: Con la red partida no se puede responder siempre y además garantizar que todos vean la última escritura.
- Elegir entre latencia y throughput :: Ese es un trade-off de rendimiento, no el que plantea CAP.
- Elegir qué partición se apaga para siempre :: No se apaga nada; cada lado decide si responde o no mientras dure la partición.
- Elegir entre replicación síncrona y asíncrona en el diseño inicial :: Influye, pero CAP habla del comportamiento durante la partición.
> CAP: con partición (P), hay que elegir entre C (rechazar) y A (responder con posible inconsistencia).

### sd-4102 [4.1] d2 #cap #operacional
Un compañero dice: "Elegimos AP, así que nuestro sistema nunca es consistente". ¿Qué corrección corresponde?
- Es correcto: un sistema AP renuncia a la consistencia para siempre :: La renuncia aplica mientras hay partición; sin partición puede comportarse de forma consistente.
+ La elección de CAP es operacional durante la partición: sin partición el sistema puede ser consistente, y la decisión entre C y A solo se toma mientras la red está partida :: Brewer insiste en que CAP no es una etiqueta permanente del diseño: las particiones son raras y la decisión se toma cuando ocurren.
- Un sistema AP es consistente siempre que use TCP :: TCP no evita las particiones ni la divergencia entre réplicas.
- CAP solo aplica a bases de datos SQL :: CAP aplica a cualquier sistema con datos replicados en red.
> CAP describe la decisión durante la partición; no condena al sistema a ser inconsistente siempre.

### sd-4103 [4.1] d2 #pacelc
¿Qué agrega el teorema PACELC (Abadi, 2012) respecto de CAP?
- Que se puede tener C, A y P al mismo tiempo usando caché :: PACELC no contradice CAP; lo extiende.
+ Que incluso sin partición hay que elegir entre latencia y consistencia: si hay Partición, A o C; si no (Else), L o C :: Esperar a que se coordinen las réplicas da consistencia pero cuesta latencia en la operación normal.
- Que la tolerancia a particiones es opcional en redes locales :: En redes reales las particiones ocurren; PACELC no cambia eso.
- Que la consistencia eventual es siempre preferible :: PACELC no recomienda un modelo; muestra el trade-off.
> PACELC: con partición, A vs C; sin partición, Latencia vs Consistencia.

### sd-4104 [4.1] d3 #linearizabilidad #consistencia-secuencial
P1 escribe x = 1 y la escritura termina a las 10:00:01. A las 10:00:05 P2 comienza una lectura de x y obtiene 0 (el valor anterior). No hay otras operaciones. ¿Qué modelo de consistencia se viola?
+ Linearizabilidad, pero no necesariamente consistencia secuencial :: Linearizabilidad respeta el tiempo real: la escritura terminó antes de que la lectura empezara, así que la lectura debía ver 1. La consistencia secuencial solo exige un orden global compatible con el orden de programa de cada proceso, y ubicar la lectura de P2 antes de la escritura de P1 lo es.
- Consistencia secuencial, pero no linearizabilidad :: Es al revés: la linearizabilidad es la más estricta de las dos. Si se viola la secuencial, también se viola la linearizabilidad.
- Ambas, porque P2 leyó un valor viejo :: La consistencia secuencial permite leer un valor viejo si existe un orden global válido, y aquí existe.
- Ninguna, porque son procesos distintos :: La linearizabilidad sí relaciona operaciones de procesos distintos mediante el tiempo real.
> Linearizabilidad = orden global que respeta el tiempo real. Consistencia secuencial = orden global que respeta el orden de programa de cada proceso, sin importar el reloj.

### sd-4105 [4.1] d2 #consistencia-eventual
¿Qué garantiza la consistencia eventual?
- Que las réplicas convergen en un tiempo máximo acotado, por ejemplo 5 segundos :: La consistencia eventual no promete ningún plazo.
+ Que si dejan de llegar escrituras, todas las réplicas terminan convergiendo al mismo valor, sin límite de tiempo garantizado :: Durante la propagación se pueden leer valores viejos; el DNS es el ejemplo clásico de la Unidad 2.
- Que toda lectura ve la escritura más reciente :: Esa es la consistencia fuerte (linearizabilidad).
- Que los conflictos se resuelven con last-writer-wins :: El modelo no dice cómo resolver conflictos, solo que se converge.
> Consistencia eventual: convergencia sin plazo garantizado; las lecturas pueden ser viejas mientras tanto.

### sd-4106 [4.1] d2 #read-your-writes
Un usuario cambia su foto de perfil y, al recargar la página, la petición la atiende otra réplica que todavía muestra la foto antigua. ¿Qué garantía faltó?
+ Read-your-writes: un proceso siempre debe leer su propia escritura o una más reciente, aunque acceda a otra réplica :: Es una garantía centrada en el cliente. Se implementa, por ejemplo, leyendo desde la réplica que recibió la escritura o esperando a que la réplica alcance esa versión.
- Linearizabilidad global, que es la única forma de arreglarlo :: Linearizabilidad lo resolvería, pero es mucho más de lo necesario. Read-your-writes basta para este caso.
- Consistencia eventual :: El sistema probablemente sí es eventualmente consistente; la foto nueva terminará llegando. Lo que falló es la garantía de sesión.
- Atomicidad de 2PC :: Aquí no hay una transacción entre varios participantes; el problema es qué réplica responde la lectura.
> Read-your-writes: el usuario nunca debe "perder" su propia escritura al cambiar de réplica.

### sd-4107 [4.1] d2 #consistencia-causal
En un chat, Alice escribe "¿Vamos al cine?" y Bob responde "Sí, vamos". Carol no debe ver nunca la respuesta de Bob antes que la pregunta de Alice, pero tolera algunos segundos de retraso. ¿Qué modelo basta?
- Consistencia fuerte, porque es la única que ordena mensajes :: Funcionaría, pero es más costosa de lo necesario: Carol tolera retraso, solo exige el orden correcto.
+ Consistencia causal, que asegura que las escrituras relacionadas causalmente se vean en el mismo orden en todas las réplicas :: La respuesta de Bob depende de la pregunta de Alice. Mensajes concurrentes sin relación pueden verse en distinto orden.
- Consistencia eventual, porque al final Carol verá ambos mensajes :: La eventual no garantiza el orden de llegada; Carol podría ver la respuesta antes que la pregunta.
- Read-your-writes :: Esa garantía es sobre las propias escrituras de Carol, no sobre mensajes de Alice y Bob.
> Causal: respeta "esto responde a aquello". Más barata que la fuerte, más útil que la eventual para colaboración.

### sd-4201 [4.2] d1 #replicacion #sincrona
¿Qué caracteriza a la replicación síncrona frente a la asíncrona?
+ La síncrona confirma al cliente solo cuando las réplicas aplicaron la escritura (consistencia fuerte, más latencia); la asíncrona confirma de inmediato y propaga después (rápida, pero las réplicas pueden quedar desactualizadas) :: Es el trade-off clásico: esperar a las réplicas cuesta tiempo, no esperar cuesta frescura de los datos.
- La síncrona usa UDP y la asíncrona TCP :: El modo de replicación no depende del protocolo de transporte.
- La asíncrona nunca pierde datos si el primario cae :: Si el primario cae antes de propagar, las escrituras confirmadas pueden perderse.
- La síncrona es siempre más disponible :: Es menos disponible: si una réplica no responde, las escrituras se bloquean o fallan.
> Síncrona: fuerte y lenta. Asíncrona: rápida, con réplicas que pueden quedar atrás (y riesgo de perder lo no propagado).

### sd-4202 [4.2] d2 #quorum #nwr
En un sistema con N = 3 réplicas, ¿qué combinación de W (réplicas que confirman una escritura) y R (réplicas consultadas en una lectura) garantiza que toda lectura vea la última escritura confirmada?
- W = 1, R = 1 :: W + R = 2 ≤ 3: la réplica leída puede no ser la que recibió la escritura.
- W = 1, R = 2 :: W + R = 3 = N: puede leerse justamente el par de réplicas que no recibió la escritura.
+ W = 2, R = 2 :: W + R = 4 > 3, así que todo conjunto de lectura se solapa con todo conjunto de escritura en al menos una réplica.
- W = 2, R = 1 :: W + R = 3 = N: no hay solapamiento garantizado.
> Regla de quórum: W + R > N garantiza intersección entre escrituras y lecturas.

### sd-4203 [4.2] d3 #quorum #trade-off
Con N = 3, compara W = 2, R = 2 con W = 3, R = 1. Ambas cumplen W + R > N. ¿Qué diferencia práctica hay?
+ W = 3, R = 1 da lecturas más rápidas (una sola réplica), pero si cae una réplica ya no se puede escribir; W = 2, R = 2 tolera una réplica caída tanto en lecturas como en escrituras :: Subir W favorece las lecturas a costa de la disponibilidad de escritura.
- Son equivalentes en disponibilidad y latencia :: Ambas garantizan intersección, pero difieren en qué operación se vuelve frágil o lenta.
- W = 3, R = 1 tolera dos réplicas caídas para escrituras :: W = 3 exige las tres réplicas: con una caída ya no se escribe.
- W = 2, R = 2 no garantiza consistencia porque no escribe en todas :: Con W + R > N la intersección asegura que se lee la versión más reciente.
> W alto: lecturas baratas, escrituras frágiles. W y R equilibrados: toleran fallas en ambas operaciones.

### sd-4204 [4.2] d2 #2pc
¿Cuál es la principal desventaja de Two-Phase Commit (2PC) según la Unidad 2?
- Que no garantiza atomicidad :: 2PC garantiza justamente atomicidad: todos hacen commit o todos abortan.
+ Que es bloqueante: los participantes retienen recursos hasta que el coordinador decide, y si el coordinador cae tras el PREPARE quedan esperando :: Además debe esperar a todas las réplicas, lo que aumenta la latencia y reduce la disponibilidad.
- Que solo funciona con dos nodos :: "Dos fases" se refiere a PREPARE y COMMIT/ABORT, no a dos nodos.
- Que permite que algunos participantes hagan commit y otros aborten :: Eso violaría atomicidad; 2PC lo evita.
> 2PC: atómico pero bloqueante. Un coordinador caído deja a los participantes con recursos tomados.

### sd-4205 [4.2] d2 #2pc #fases
En 2PC, uno de los tres participantes responde "No" en la fase PREPARE. ¿Qué hace el coordinador?
- Hace COMMIT en los dos que dijeron "Sí" :: Rompería la atomicidad: la transacción quedaría aplicada parcialmente.
+ Envía ABORT a todos los participantes :: En 2PC, COMMIT exige que todos voten "Sí". Un solo "No" aborta la transacción completa.
- Reintenta PREPARE indefinidamente hasta que diga "Sí" :: El "No" es una decisión del participante; reintentarla para siempre bloquearía el sistema.
- Ignora al participante y le hace commit más tarde :: Eso dejaría réplicas inconsistentes.
> 2PC: unanimidad en PREPARE → COMMIT; cualquier "No" o timeout → ABORT para todos.

### sd-4206 [4.2] d2 #primary-backup #multi-master
¿Qué diferencia a la replicación primary-backup de la multi-master?
- En primary-backup cualquier nodo acepta escrituras; en multi-master solo uno :: Es al revés: en primary-backup solo escribe el primario.
+ En primary-backup solo el primario acepta escrituras (sin conflictos, pero es cuello de botella); en multi-master cualquier nodo las acepta (sin cuello de botella, pero hay conflictos que resolver) :: MySQL o PostgreSQL usan primary-backup; Cassandra o CouchDB usan multi-master.
- Multi-master no necesita replicación :: Multi-master replica en todas las direcciones entre masters.
- Primary-backup no tolera la caída del primario :: Tolera mediante failover: se elige un nuevo primario, con algo de downtime.
> Primary-backup: simple, sin conflictos, cuello de botella de escritura. Multi-master: sin cuello de botella, con conflictos.

### sd-4207 [4.2] d2 #quorum #fallas
En el laboratorio K-V con 3 réplicas se mata una réplica. ¿Qué modos siguen aceptando escrituras?
+ Eventual y quórum (W = 2); el modo strong, que exige confirmación de las 3, falla :: put_strong cuenta acks == 3. Con una réplica caída nunca los consigue. El quórum necesita 2 y la eventual escribe localmente.
- Solo strong, porque es el más confiable :: "Confiable" en consistencia no significa disponible: es el que primero falla.
- Ninguno: con una réplica caída todo el sistema se detiene :: Quórum y eventual están diseñados para tolerar esa falla.
- Solo eventual; quórum también necesita las 3 :: Quórum con N = 3 necesita 2 confirmaciones.
> Cuantas más confirmaciones exige una escritura, más consistente es y menos fallas tolera.

### sd-4301 [4.3] d2 #split-brain #conflictos
Durante una partición, un sistema AP acepta `saldo = 80` en un lado y `saldo = 50` en el otro. ¿Qué ocurre al recuperarse la red?
- Las réplicas convergen solas al valor correcto, porque el modelo es eventual :: La consistencia eventual dice que convergen, pero no define cómo elegir entre dos versiones divergentes.
+ Hay dos versiones divergentes que no se pueden reconciliar sin una estrategia explícita (last-writer-wins, merge semántico o CRDT) :: El split-brain con escrituras en ambos lados produce conflictos. Elegir cómo resolverlos es parte del diseño.
- Gana siempre la partición con más nodos :: Esa es la lógica de un sistema CP con quórum; un sistema AP acepta escrituras en ambos lados.
- Se suman ambos valores automáticamente :: Sumar no tiene sentido para un valor absoluto como el saldo, salvo que el dato se modele como contador CRDT.
> Escrituras en ambos lados de una partición = versiones divergentes. La resolución (LWW, merge, CRDT) la define el sistema, no el modelo eventual.

### sd-4302 [4.3] d2 #lww #crdt
¿Cuál es el principal riesgo de resolver conflictos con last-writer-wins (LWW)?
+ Se pierde silenciosamente la escritura con timestamp menor, aunque haya sido una actualización válida :: LWW es simple y determinista, pero descarta datos. Además depende de relojes que pueden estar desfasados.
- Que nunca converge :: LWW converge siempre: todos eligen la misma versión con el mismo criterio.
- Que requiere vector clocks de tamaño N :: LWW usa un timestamp simple; los vector clocks se usan para detectar conflictos, no para LWW.
- Que bloquea las escrituras hasta resolver :: LWW resuelve sin bloquear; justamente por eso es popular en sistemas AP.
> LWW = simple pero con pérdida de datos. Si no se puede perder nada: detectar con vector clocks y hacer merge, o usar CRDT.

### sd-4303 [4.3] d2 #crdt #g-counter
Un G-Counter (contador que solo crece) tiene el valor 10 en la réplica A y 15 en la réplica B para la misma entrada. Según la Unidad 2, ¿cómo se fusionan?
- Se suman: 25 :: Sumar contaría dos veces los incrementos que ambas réplicas ya conocían.
+ Se toma el máximo por componente: 15 :: En un G-Counter cada nodo lleva su propio contador; el merge es max componente a componente, que es conmutativo, asociativo e idempotente.
- Se toma el valor con timestamp más reciente :: Eso es LWW; un CRDT no necesita timestamps para fusionar.
- Se marca como conflicto para que lo resuelva el usuario :: La gracia de un CRDT es que el merge es automático y determinista.
> CRDT: estructuras con merge automático y determinista (G-Counter usa max), sin conflictos que resolver a mano.

### sd-4304 [4.3] d2 #deteccion-fallos #timeouts
El nodo A deja de recibir respuestas de B. ¿Qué puede concluir A con certeza?
- Que B está caído :: También puede estar lento o la red puede estar partida.
- Que la red está particionada :: Es solo una de las posibilidades.
+ Nada con certeza: B puede estar caído, lento o aislado por una partición, o el mensaje se perdió; solo puede suponer una falla tras un timeout :: Es el problema fundamental de la detección de fallos, y la razón de ser del teorema FLP.
- Que B tiene un bug :: No hay información suficiente para eso.
> En un sistema distribuido no se distingue un nodo caído de uno lento o de una partición. Los timeouts son una suposición.

### sd-4305 [4.3] d2 #heartbeat #timeouts
Un sistema de heartbeats usa un timeout de 1 segundo y marca como caídos a nodos que en realidad solo estaban lentos. ¿Qué describe mejor el trade-off?
+ Un timeout corto detecta fallas rápido pero genera falsos positivos; uno largo tiene pocos falsos positivos pero detecta lento. Un timeout adaptativo (media + k·desviación de la latencia medida) ajusta el compromiso :: La Unidad 2 muestra un timeout adaptativo con media móvil exponencial.
- El timeout debe ser siempre 0 para detectar al instante :: Con timeout 0 todo nodo se vería caído.
- Los falsos positivos se eliminan enviando heartbeats con UDP :: El protocolo no cambia el problema: la latencia sigue siendo variable.
- Un timeout largo detecta más rápido :: Un timeout largo tarda más en declarar caído a un nodo.
> Timeout corto: rápido y con falsos positivos. Timeout largo: lento pero preciso. Adaptativo: se ajusta a la red.

### sd-4306 [4.3] d3 #redis-sentinel #quorum
En Redis Sentinel, ¿cuál es la diferencia entre SDOWN y ODOWN?
- SDOWN significa caída por software y ODOWN caída por hardware :: Los nombres vienen de "subjective" y "objective", no de tipos de falla.
+ SDOWN (subjetivo) es la opinión de un solo sentinel que no recibe respuesta; ODOWN (objetivo) se declara cuando un quórum de sentinels coincide, y solo entonces se inicia el failover :: Exigir acuerdo evita que un sentinel con problemas de red provoque un failover innecesario.
- ODOWN lo declara el primario sobre sí mismo :: Un primario caído no puede declarar nada; lo declaran los sentinels.
- SDOWN dispara el failover inmediatamente y ODOWN lo confirma después :: El failover espera ODOWN; con SDOWN no basta.
> Sentinel: SDOWN = un observador sospecha; ODOWN = quórum de observadores coincide → failover.

### sd-4307 [4.3] d2 #recuperacion #checkpoint
Un nodo se cae y debe recuperar su estado. Tiene un checkpoint de hace 10 minutos y el log completo de operaciones. ¿Qué estrategia es la más eficiente?
- Reproducir el log completo desde el principio :: Funciona, pero puede ser muy lento si el log es largo; para eso existen los checkpoints.
+ Cargar el último checkpoint y reproducir solo las operaciones del log posteriores a él :: Combina rapidez (no se parte de cero) con completitud (no se pierde nada posterior al checkpoint).
- Cargar el checkpoint y descartar las operaciones posteriores :: Se perderían 10 minutos de operaciones ya confirmadas.
- Esperar a que otro nodo le envíe heartbeats con el estado :: Los heartbeats no transportan el estado completo; para eso existe la transferencia de estado.
> Recuperación típica: último checkpoint + replay del log desde ese punto. Alternativa: state transfer desde una réplica al día.

### sd-4308 [4.3] d2 #replicacion #disponibilidad
Se agregan más réplicas a un sistema. ¿Qué efecto tiene?
+ Mejora la disponibilidad de lectura (hay más nodos que pueden responder ante fallas), pero las escrituras se complican porque hay que coordinar más réplicas para mantener la consistencia :: Más réplicas = más opciones de lectura y más trabajo para cada escritura.
- Mejora lecturas y escrituras por igual, sin costo :: Cada escritura debe llegar a más réplicas, sea de forma síncrona (latencia) o asíncrona (más ventanas de inconsistencia).
- Empeora la disponibilidad de lectura :: Más réplicas dan más alternativas cuando alguna falla.
- No cambia nada si se usa consistencia eventual :: Incluso con eventual consistency hay más tráfico de propagación y más posibles conflictos.
> Replicar ayuda a leer y a sobrevivir fallas; el costo está en coordinar las escrituras.
