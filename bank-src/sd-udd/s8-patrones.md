// Sección 8: Patrones, conceptos adicionales e IPC (~4 preguntas del examen)
// 8.1 Saga vs 2PC, UUID y gossip / 8.2 Fundamentos de sistemas distribuidos e IPC local vs remota (Unidad 1)

### sd-8101 [8.1] d1 #saga
¿Cómo maneja una saga la falla de uno de sus pasos?
- Bloquea los recursos de todos los participantes hasta que el coordinador decida :: Eso describe 2PC.
+ Ejecuta acciones compensatorias que deshacen semánticamente los pasos locales ya completados :: Una saga es una cadena de transacciones locales; si una falla, se compensa lo anterior (por ejemplo, reembolsar un cobro) sin bloquear recursos.
- Reintenta el paso fallido indefinidamente sin deshacer nada :: Puede reintentar, pero si el paso no puede completarse, debe compensar.
- Hace rollback automático de todas las bases de datos involucradas :: Las transacciones locales ya hicieron commit; no hay rollback global. Por eso existen las compensaciones.
> Saga = transacciones locales + compensaciones ante falla. Sin bloqueo de recursos.

### sd-8102 [8.1] d2 #saga #2pc
Un flujo de reserva de viaje (vuelo, hotel, auto) involucra tres servicios de empresas distintas, y cada paso puede tardar minutos. ¿Por qué conviene una saga en vez de 2PC?
+ 2PC mantendría bloqueados los recursos de los tres servicios hasta la decisión final, y quedaría bloqueado si el coordinador cae; la saga confirma cada paso localmente y compensa si algo falla después :: Con pasos largos y servicios independientes, bloquear recursos es impráctico.
- Porque 2PC no garantiza atomicidad :: 2PC sí la garantiza; su problema es el bloqueo.
- Porque la saga garantiza aislamiento completo entre transacciones :: Al contrario: en una saga los estados intermedios son visibles para otros. Es su principal desventaja.
- Porque 2PC solo funciona con dos servicios :: "Dos fases" no significa dos participantes.
> 2PC: atomicidad con bloqueo. Saga: sin bloqueo, con compensaciones y sin aislamiento.

### sd-8103 [8.1] d3 #saga #aislamiento
En una saga de compra, el paso 1 descuenta stock y el paso 2 (cobrar) falla, así que se compensa devolviendo el stock. ¿Qué problema puede observarse mientras tanto?
- Ninguno: la saga es atómica e invisible hasta el final :: Cada paso hace commit local, así que sus efectos son visibles de inmediato.
+ Otro cliente puede ver el stock descontado (y quedarse sin comprar) antes de que la compensación lo devuelva :: Las sagas no tienen aislamiento: los estados intermedios son visibles. Hay que diseñar pensando en ello (reservas, estados "pendiente").
- La base de datos queda bloqueada hasta la compensación :: Las sagas no bloquean recursos; precisamente por eso el estado intermedio es visible.
- El stock se descuenta dos veces :: La compensación devuelve el stock; no lo descuenta otra vez.
> Sagas: sin bloqueo, pero los estados intermedios son visibles (falta de aislamiento).

### sd-8104 [8.1] d1 #uuid
¿Cuántos bits aleatorios tiene un UUID versión 4?
- 128 :: El UUID tiene 128 bits en total, pero algunos están fijos.
+ 122 :: De los 128 bits, 4 indican la versión y 2 la variante; los 122 restantes son aleatorios.
- 64 :: Es bastante menos de lo que usa un UUID v4.
- 32 :: Con solo 32 bits las colisiones serían frecuentes en sistemas grandes.
> UUID v4: 128 bits, de los cuales 122 son aleatorios.

### sd-8105 [8.1] d2 #uuid #coordinacion
Varios nodos crean registros en paralelo y cada registro necesita un ID único. ¿Por qué UUID v4 es una buena opción?
+ Cada nodo genera IDs de forma independiente sin consultar a un coordinador central, y con 122 bits aleatorios la probabilidad de colisión es despreciable :: Se evita el cuello de botella y el punto único de falla de un generador central.
- Porque los UUID garantizan matemáticamente que nunca habrá colisiones :: La garantía es probabilística: la colisión es posible, pero tan improbable que se ignora en la práctica.
- Porque los UUID v4 vienen ordenados por tiempo de creación :: Los v4 son aleatorios y no tienen orden temporal.
- Porque los UUID son más cortos que un entero autoincremental :: Un UUID ocupa 128 bits, más que un entero de 64.
> UUID v4: IDs únicos sin coordinación central, con colisión probabilísticamente despreciable.

### sd-8106 [8.1] d2 #gossip
¿Qué describe correctamente un protocolo gossip?
- Un coordinador central difunde el estado a todos los nodos en una ronda :: Gossip no tiene coordinador central.
+ En cada ronda cada nodo comparte su estado con un subconjunto aleatorio de pares; la información se propaga de forma epidémica y converge de forma probabilística en O(log N) rondas :: Es robusto ante fallas de nodos individuales y escala bien.
- Cada nodo envía su estado a todos los demás en cada ronda :: Eso es broadcast completo, con costo O(N²) mensajes por ronda.
- La información converge en exactamente N rondas, garantizado :: La convergencia es probabilística y crece como log N, no como N.
> Gossip: propagación epidémica a pares aleatorios, sin coordinador, convergencia en O(log N) rondas.

### sd-8201 [8.2] d1 #definicion
Según la definición usada en la Unidad 1, ¿qué es un sistema distribuido?
+ Un sistema cuyos componentes, ubicados en computadores en red, se comunican y coordinan sus acciones únicamente mediante el paso de mensajes :: Sus elementos: nodos independientes, comunicación por red, estado compartido, coordinación y fallos parciales.
- Cualquier programa con varios hilos de ejecución :: Una aplicación multihilo sin red no es un sistema distribuido: comparte memoria en un solo computador.
- Un servidor central con clientes que solo muestran lo que el servidor calcula :: Esos son "clientes tontos". Sin cómputo ni decisiones en los clientes, el curso no lo considera distribuido.
- Un sistema con una base de datos en la nube :: Usar un servicio en la nube no hace distribuida a una aplicación por sí mismo.
> Sistema distribuido: nodos en red que se coordinan solo con mensajes.

### sd-8202 [8.2] d2 #fallos-parciales
¿Qué significa que un sistema distribuido tenga "fallos parciales"?
- Que los fallos solo duran una parte del tiempo :: El término no se refiere a la duración.
+ Que un nodo puede fallar o caer sin que se caiga todo el sistema, y el resto debe seguir funcionando :: A diferencia de un programa local, que falla completo, aquí parte del sistema sigue viva y debe manejar la ausencia de la otra.
- Que solo pueden fallar los clientes, nunca los servidores :: Cualquier nodo puede fallar.
- Que los mensajes llegan a medias :: Los mensajes incompletos son otro problema (parsing sobre TCP), no la definición de fallo parcial.
> Fallo parcial: falla una parte, el resto sigue. Una buena arquitectura no evita fallos: los gestiona.

### sd-8203 [8.2] d2 #reloj-global
¿Por qué no se puede confiar en los relojes físicos para ordenar eventos entre nodos?
- Porque los computadores modernos no tienen reloj :: Todos tienen reloj físico; el problema es que no coinciden entre sí.
+ Porque no existe un reloj global: cada nodo tiene su propio reloj, con configuración y deriva (clock drift) distintas; por ejemplo, el cuarzo varía con la temperatura :: Por eso la Unidad 2 introduce relojes lógicos, donde solo importa el orden de los eventos.
- Porque los relojes físicos solo miden segundos :: La resolución no es el problema; la falta de sincronía sí.
- Porque las zonas horarias impiden comparar horas :: Las zonas horarias se pueden normalizar a UTC; la deriva entre relojes persiste igual.
> No hay reloj global y los relojes derivan. Para ordenar eventos se usan relojes lógicos.

### sd-8204 [8.2] d1 #ipc #pipe-vs-tcp
Dos procesos deben intercambiar datos. En el caso A son padre e hijo creados con fork() en la misma máquina; en el caso B corren en máquinas distintas. ¿Qué mecanismo corresponde a cada caso?
+ A: pipe (IPC local entre procesos con ancestro común); B: socket TCP (procesos independientes, posiblemente en máquinas distintas) :: El pipe no cruza la red. TCP extiende la idea a procesos independientes en cualquier host.
- A: socket TCP obligatoriamente; B: pipe :: Un pipe no puede conectar procesos en máquinas distintas.
- Ambos casos: pipe anónimo :: Un pipe anónimo solo se comparte por herencia, en la misma máquina.
- Ambos casos: FIFO con nombre :: Un FIFO también es local: vive en el sistema de archivos de una máquina.
> Pipe: procesos relacionados por fork(), mismo host. TCP: procesos independientes, posiblemente en hosts distintos.

### sd-8205 [8.2] d2 #ipc #comparacion
Según la tabla comparativa de la Unidad 1, ¿qué afirmación sobre PIPE, socket AF_LOCAL y socket AF_INET es correcta?
- El pipe es el más escalable y tolerante a fallos de los tres :: Es al revés: el pipe tiene escalabilidad y tolerancia a fallos bajas.
+ El pipe y AF_LOCAL tienen latencia muy baja pero solo funcionan en la misma máquina; AF_INET tiene más latencia (red) pero escala más y tolera mejor los fallos :: Es el trade-off entre rendimiento local y alcance de red.
- AF_LOCAL y AF_INET se identifican ambos con IP y puerto :: AF_LOCAL se identifica con una ruta en el sistema de archivos.
- Los tres son unidireccionales :: Solo el pipe es unidireccional; los sockets son bidireccionales.
> Local (pipe, AF_LOCAL): rápido, misma máquina. AF_INET: latencia de red, pero escalable y tolerante a fallos.

### sd-8206 [8.2] d2 #problemas-elementales
En el chat distribuido de la Unidad 1, dos usuarios envían mensajes al mismo tiempo y no todos los clientes los ven en el mismo orden. ¿Qué problema elemental de los sistemas distribuidos se está manifestando?
- Seguridad :: Nadie está atacando el sistema; el problema es de orden entre réplicas o clientes.
+ Consistencia (agravada por la concurrencia): los resultados deberían ser los mismos para todos los nodos :: El servidor como coordinador central (o un orden con relojes lógicos) resuelve que todos vean el mismo historial.
- Latencia, porque el mensaje tarda en llegar :: La demora por sí sola no desordena; el problema es que distintos clientes vean órdenes distintos.
- Fallos, porque un nodo se cayó :: Ningún nodo falló en este escenario.
> Problemas elementales: latencia, concurrencia, consistencia, fallos y seguridad. Órdenes distintos entre clientes = problema de consistencia.
