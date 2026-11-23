// Sección 3: Consenso y algoritmo Raft (~8 preguntas del examen)
// 3.1 Consenso, FLP y visión general / 3.2 Terms, elección y heartbeats / 3.3 Log, quórum y safety / 3.4 Particiones

### sd-3101 [3.1] d1 #consenso #propiedades
Un protocolo de consenso garantiza que "todos los procesos correctos deciden el mismo valor". ¿Qué propiedad es esa?
+ Agreement (acuerdo) :: Acuerdo: no puede haber dos procesos correctos que decidan valores distintos.
- Validity (validez) :: Validez exige que el valor decidido haya sido propuesto por algún proceso, no que todos coincidan.
- Termination (terminación) :: Terminación exige que todo proceso correcto termine decidiendo algún valor.
- Integrity (integridad) :: Integridad exige que cada proceso decida a lo más una vez, sin cambiar de opinión.
> Consenso: Termination, Agreement, Validity e Integrity. Agreement = todos deciden lo mismo.

### sd-3102 [3.1] d2 #flp
¿Qué dice el teorema FLP (Fischer, Lynch y Paterson, 1985) y cómo lo esquiva Raft?
- Que el consenso es imposible en cualquier sistema distribuido; Raft solo funciona con un nodo :: FLP habla de sistemas asíncronos con algoritmos determinísticos. Raft funciona con muchos nodos.
+ Que en un sistema asíncrono ningún algoritmo determinístico garantiza consenso si al menos un proceso puede fallar; Raft asume timeouts y usa la detección de fallos por timeout como suposición práctica :: Sin límites de tiempo no se distingue un nodo lento de uno caído. Raft asume cierta sincronía (timeouts) para garantizar progreso, sin sacrificar la seguridad.
- Que el consenso requiere relojes físicos perfectamente sincronizados; Raft usa NTP :: FLP no habla de relojes físicos, y Raft no depende de NTP: usa terms como reloj lógico.
- Que el consenso necesita al menos 3 fases; Raft usa 3 RPCs :: FLP no es un resultado sobre número de fases.
> FLP: consenso determinístico imposible en un sistema asíncrono con fallas. Raft lo esquiva asumiendo timeouts (sincronía parcial).

### sd-3103 [3.1] d1 #raft #estados
¿Cuáles son los estados de un nodo Raft?
- Primary, Backup y Arbiter :: Esa terminología es de replicación primary-backup, no de Raft.
+ Follower, Candidate y Leader :: Todos parten como followers; un follower sin noticias del líder pasa a candidate, y el candidate que gana la elección pasa a leader.
- Proposer, Acceptor y Learner :: Esos son los roles de Paxos.
- Master, Slave y Witness :: No son estados de Raft.
> Raft: follower → candidate (al vencer el timeout) → leader (con mayoría de votos). Cualquier mensaje con term mayor lo devuelve a follower.

### sd-3104 [3.1] d2 #raft #paxos
Según la Unidad 2, ¿por qué Raft se considera más fácil de entender e implementar que Paxos?
+ Porque descompone el consenso en elección de líder, replicación de log y safety, y solo el líder propone entradas :: Con un líder fuerte se reduce el espacio de estados: menos casos posibles, más fácil de razonar y menos bugs.
- Porque no necesita mayoría de votos :: Raft sí usa mayoría tanto para elegir líder como para comprometer entradas.
- Porque tolera más fallas que Paxos con la misma cantidad de nodos :: Ambos toleran f fallas con 2f+1 nodos.
- Porque no usa timeouts :: Raft depende de timeouts para detectar la caída del líder.
> Raft = líder fuerte + descomposición en subproblemas. Mismo nivel de tolerancia que Paxos, pero más simple de razonar.

### sd-3201 [3.2] d1 #heartbeat #appendentries
En Raft, ¿qué es un heartbeat?
- Un RPC especial llamado Heartbeat que solo contiene el ID del líder :: Raft no tiene un RPC de heartbeat aparte.
+ Un AppendEntries sin entradas que el líder envía periódicamente :: Mantiene la autoridad del líder, reinicia el election timeout de los followers e informa el commit index actual.
- Un RequestVote que el líder envía para confirmar su mayoría :: RequestVote lo usan los candidatos durante una elección, no el líder.
- Un ping ICMP entre nodos :: Raft trabaja con sus propios RPCs, no con ICMP.
> Heartbeat = AppendEntries vacío. Previene elecciones innecesarias y propaga el commit index del líder.

### sd-3202 [3.2] d2 #heartbeat #commit-index
Además de evitar elecciones, ¿qué información útil transporta un heartbeat?
- El election timeout que cada follower debe usar :: Cada follower elige su timeout de forma aleatoria; el líder no lo impone.
+ El commit index del líder (`leader_commit`), con el que los followers saben hasta qué entrada pueden aplicar a su máquina de estados :: Un follower puede tener entradas replicadas pero no comprometidas; el heartbeat le avisa cuándo ya son definitivas.
- El listado completo del log del líder :: El log se envía de forma incremental en AppendEntries con entradas, no completo en cada heartbeat.
- La cantidad de votos que recibió el líder :: Esa información no se envía; no sirve después de la elección.
> AppendEntries (incluido el heartbeat) lleva leader_commit; así los followers saben qué entradas ya están comprometidas.

### sd-3203 [3.2] d1 #terms #reloj-logico
¿Qué función cumplen los terms (mandatos) en Raft?
+ Actúan como reloj lógico: si un nodo recibe un mensaje con term mayor que el suyo, actualiza su term y vuelve a follower, reconociendo que existe un líder más reciente :: Así se detectan líderes obsoletos sin relojes físicos.
- Miden el tiempo en milisegundos que lleva el líder en el cargo :: Los terms son números enteros crecientes, no medidas de tiempo físico.
- Indican cuántas entradas tiene el log :: Eso es el índice del log, no el term.
- Son el identificador del nodo líder :: El líder se identifica con leader_id. Un term puede incluso no tener líder.
> Term = reloj lógico. Term mayor gana: quien ve un term mayor se vuelve follower.

### sd-3204 [3.2] d2 #votacion #un-lider
¿Qué regla de Raft garantiza que haya como máximo un líder por term?
- Que el candidato con menor ID siempre gane :: Raft no desempata por ID. Gana quien obtenga mayoría.
+ Cada nodo vota por un solo candidato por term, y se necesita mayoría para ganar; dos mayorías no pueden ser disjuntas :: Si cada nodo emite como máximo un voto por term, es imposible que dos candidatos reúnan cada uno una mayoría en el mismo term.
- Que el líder anterior designe a su sucesor :: El líder anterior puede estar caído; no designa a nadie.
- Que los timeouts sean aleatorios :: Los timeouts aleatorios reducen los split votes, pero la garantía de un solo líder viene de un voto por term más mayoría.
> Un voto por nodo por term + mayoría estricta ⇒ a lo más un líder por term (Election Safety).

### sd-3205 [3.2] d2 #election-timeout #split-vote
¿Por qué el election timeout de cada nodo se elige al azar dentro de un rango (por ejemplo, 150–300 ms)?
- Para que el líder pueda ajustar la frecuencia de heartbeats :: La frecuencia de heartbeats la define el líder y debe ser mucho menor que el timeout; no es para eso.
+ Para que normalmente un solo nodo venza su timeout primero, se vuelva candidato y gane antes de que otros compitan, reduciendo los split votes :: Si todos tuvieran el mismo timeout, varios se postularían a la vez y repartirían los votos una y otra vez.
- Para evitar que dos nodos tengan el mismo term :: Dos nodos pueden tener el mismo term sin problema; es lo normal entre líder y followers.
- Para que las elecciones duren siempre lo mismo :: El objetivo es reducir conflictos, no fijar la duración.
> Timeout aleatorio = menos candidatos simultáneos = menos split votes.

### sd-3206 [3.2] d2 #eleccion #pasos
Un follower vence su election timeout. ¿Qué hace, en orden?
+ Incrementa su term, pasa a candidate, vota por sí mismo, reinicia su timeout y envía RequestVote a los demás nodos :: Es el procedimiento de on_election_timeout() de la Unidad 2.
- Envía AppendEntries a todos anunciando que es el nuevo líder :: Primero debe ganar una elección; solo el líder envía AppendEntries.
- Espera a que otro nodo le envíe RequestVote :: Esperar no resuelve la ausencia de líder; justamente por eso se vuelve candidato.
- Mantiene su term y pide votos con el term actual :: Debe incrementar el term: una elección nueva corresponde a un term nuevo.
> Timeout de elección: current_term++, estado CANDIDATE, voto propio, reset del timeout, RequestVote a todos.

### sd-3207 [3.2] d2 #candidato #appendentries
Un candidato en el term 7 está pidiendo votos y recibe un AppendEntries de otro nodo, también con term 7. ¿Qué hace?
- Lo rechaza y sigue su elección, porque ambos tienen el mismo term :: Que tenga el mismo term significa que ese nodo ya ganó la elección de este term; seguir compitiendo no tiene sentido.
+ Reconoce al remitente como líder legítimo y vuelve a follower :: Solo un líder envía AppendEntries, y si su term es igual o mayor al del candidato, este acepta que perdió la elección.
- Incrementa su term a 8 y repite la elección :: Eso generaría una elección innecesaria contra un líder válido.
- Le envía un RequestVote para que el otro nodo vote por él :: El otro nodo ya es líder del term 7.
> Candidato que recibe AppendEntries con term ≥ al suyo: reconoce al líder y vuelve a follower.

### sd-3208 [3.2] d3 #votacion #log-actualizado
Un follower recibe un RequestVote de un candidato con un term mayor, pero el log del candidato está menos actualizado que el suyo (su última entrada tiene un term menor). ¿Qué hace el follower?
- Le da el voto, porque el term del candidato es mayor :: El term mayor hace que el follower actualice su term, pero no basta para obtener su voto.
+ Actualiza su term pero niega el voto, porque Raft solo vota por candidatos cuyo log esté al menos tan actualizado como el propio :: Esta restricción garantiza Leader Completeness: un líder nuevo siempre tiene todas las entradas comprometidas.
- Se convierte en candidato y le gana la elección automáticamente :: No hay victoria automática; tendría que vencer su propio timeout y conseguir mayoría.
- Ignora el mensaje sin actualizar su term :: Un mensaje con term mayor siempre hace que el receptor actualice su term.
> Para votar: term válido, no haber votado a otro en este term, y log del candidato al menos tan actualizado como el propio.

### sd-3301 [3.3] d1 #quorum
¿Cuántos votos necesita un candidato para ser líder en un cluster Raft de 5 nodos?
- 2 :: 2 de 5 no es mayoría; otro candidato podría juntar 3.
+ 3, incluyendo su propio voto :: Mayoría estricta: ⌊5/2⌋ + 1 = 3.
- 4 :: Pedir 4 haría que el cluster no pudiera elegir líder con 2 nodos caídos, aunque sí tiene mayoría.
- 5 :: Exigir todos los votos haría imposible tener líder con un solo nodo caído.
> Quórum = ⌊N/2⌋ + 1. Con 5 nodos: 3 votos, contando el propio.

### sd-3302 [3.3] d2 #quorum #tolerancia
¿Por qué se recomienda un número impar de nodos? Compara un cluster de 4 con uno de 3.
+ Ambos toleran la caída de solo 1 nodo, porque con 4 el quórum es 3; el cuarto nodo agrega costo sin tolerar más fallas :: Con N = 2f + 1 se toleran f fallas. 4 nodos tolera 1, igual que 3; 5 tolera 2.
- El de 4 tolera 2 fallas y el de 3 tolera 1 :: Con 4 nodos y 2 caídos quedan 2, que no son mayoría (se necesitan 3).
- Con número par Raft no puede funcionar :: Funciona, pero desperdicia un nodo en tolerancia.
- Con número par no existen split votes :: Los split votes son incluso más probables con número par (por ejemplo, 2 contra 2).
> 2f + 1 nodos toleran f fallas. Agregar un nodo para llegar a número par no aumenta la tolerancia.

### sd-3303 [3.3] d1 #commit #mayoria
¿Cuándo está comprometida (committed) una entrada del log en Raft?
- Cuando el líder la escribe en su propio log :: Si el líder cae justo después, la entrada podría perderse. Todavía no es segura.
+ Cuando el líder la replicó en la mayoría de los nodos (contándose a sí mismo) :: A partir de ahí sobrevive a la caída de una minoría, y el líder puede aplicarla y responder al cliente.
- Cuando todos los followers la confirman :: Raft no espera a todos; con mayoría basta, así un nodo lento o caído no bloquea al sistema.
- Cuando el cliente confirma que la recibió :: El cliente no participa del compromiso; recibe la respuesta después.
> Committed = replicada en la mayoría. Recién entonces se aplica a la máquina de estados y se responde al cliente.

### sd-3304 [3.3] d2 #log-matching
Un follower recibe AppendEntries con `prev_log_index = 5` y `prev_log_term = 3`, pero en su log la entrada 5 tiene term 2. ¿Qué pasa?
- Acepta las entradas nuevas y deja la entrada 5 como está :: Si aceptara, su log quedaría inconsistente con el del líder.
+ Rechaza el AppendEntries (success = false); el líder retrocede `prev_log_index` y reintenta hasta encontrar el punto en que los logs coinciden, y luego el follower sobrescribe lo que sigue :: Es el consistency check que mantiene la Log Matching Property.
- Se convierte en candidato porque detecta un líder defectuoso :: Un log distinto no indica que el líder sea defectuoso; el follower simplemente tiene entradas viejas.
- Le pide al líder que borre su entrada 5 :: El líder nunca borra ni sobrescribe su propio log (Leader Append-Only).
> Consistency check: si prev_log_index/prev_log_term no coinciden, el follower rechaza y el líder retrocede hasta el punto común.

### sd-3305 [3.3] d2 #safety #log-matching
Según la Log Matching Property, si dos logs tienen una entrada con el mismo índice y el mismo term, ¿qué se puede asegurar?
+ Que esa entrada tiene el mismo comando y que ambos logs son idénticos en todas las entradas anteriores :: Se garantiza porque un líder crea una sola entrada por índice y term, y por el consistency check de AppendEntries.
- Solo que esa entrada tiene el mismo comando; las anteriores pueden diferir :: La propiedad también cubre todas las entradas previas.
- Que ambas entradas ya están comprometidas :: Coincidir en índice y term no implica estar replicada en mayoría.
- Que ambos nodos fueron líderes en ese term :: Solo hay un líder por term; la entrada la replicó ese líder.
> Mismo índice + mismo term ⇒ mismo comando y logs idénticos hasta ese punto.

### sd-3306 [3.3] d2 #safety #leader-completeness
¿Qué garantiza la propiedad Leader Completeness y de qué mecanismo depende?
- Que el líder nunca falla; depende de los heartbeats :: Ningún algoritmo evita que el líder falle.
- Que el líder tiene más entradas que cualquier follower; depende de que el líder escriba primero :: Lo relevante son las entradas comprometidas, y la garantía viene de la votación.
+ Que toda entrada comprometida en un term estará en el log de todos los líderes de terms posteriores; depende de la restricción de votación (votar solo por logs al menos tan actualizados) :: Como una entrada comprometida está en una mayoría, y el candidato necesita votos de una mayoría que no le dará votos si le falta, todo líder nuevo la tiene.
- Que todos los nodos aplican los comandos al mismo tiempo; depende de relojes sincronizados :: Raft no sincroniza relojes; garantiza el mismo orden, no el mismo instante.
> Leader Completeness: lo comprometido nunca se pierde con un cambio de líder, gracias a la restricción de votación.

### sd-3401 [3.4] d2 #particion #mayoria
Un cluster de 5 nodos con líder en A se particiona en {A, B} y {C, D, E}. ¿Qué ocurre?
+ {C, D, E} no recibe heartbeats, elige un nuevo líder con un term mayor y sigue operando; A no puede comprometer nuevas entradas porque solo llega a 2 de 5 :: Solo la partición con mayoría (3) puede elegir líder y comprometer entradas.
- Ambas particiones siguen comprometiendo entradas y se sincronizan al recuperarse :: Eso sería split-brain. Raft lo evita exigiendo mayoría para comprometer.
- Ninguna partición puede operar hasta que la red se recupere :: La partición con 3 nodos tiene mayoría y puede operar.
- A sigue siendo líder en todo el cluster porque fue elegido primero :: A no llega a C, D y E; esos nodos vencen su timeout y eligen otro líder.
> Con partición, solo el lado con mayoría elige líder y compromete entradas; el lado minoritario no puede avanzar.

### sd-3402 [3.4] d2 #particion #recuperacion
En el escenario anterior, la red se recupera. A (líder viejo, term 4) recibe un AppendEntries de C, el nuevo líder con term 5. ¿Qué hace A?
- Sigue como líder porque tiene más antigüedad :: La antigüedad no importa en Raft; manda el term.
+ Ve el term mayor, actualiza su term a 5 y vuelve a follower; las entradas que agregó sin comprometer se reemplazan con las del nuevo líder :: Los terms permiten detectar el líder obsoleto. Las entradas no comprometidas del lado minoritario nunca fueron confirmadas a los clientes.
- Inicia una elección para resolver el conflicto :: No hay conflicto que resolver: el term 5 es mayor y A lo acepta.
- Envía su log a C para que C lo adopte :: Los followers adoptan el log del líder, nunca al revés.
> Al sanar una partición, el líder viejo reconoce al nuevo por su term mayor y se vuelve follower.

### sd-3403 [3.4] d3 #particion #clientes
Durante la partición, un cliente envía `SET x=7` al líder viejo A en la partición minoritaria {A, B}. ¿Qué pasa con esa escritura?
- Se compromete en {A, B} y luego se replica al resto cuando se recupera la red :: No puede comprometerse sin mayoría (3 de 5), y al recuperarse el nuevo líder manda.
+ A la agrega a su log, pero no logra replicarla en mayoría; nunca se compromete, el cliente no recibe confirmación y la entrada se descarta al volver la red :: Esto es Raft eligiendo consistencia (CP): el lado minoritario no confirma escrituras.
- A rechaza la escritura de inmediato porque sabe que está en minoría :: A no sabe que está particionado; solo nota que no logra mayoría para comprometer.
- B la compromete porque tiene un voto de desempate :: No existe voto de desempate; se necesitan 3 de 5.
> En la partición minoritaria las escrituras no se comprometen ni se confirman; Raft prefiere consistencia a disponibilidad.

### sd-3404 [3.4] d2 #particion #cap
Desde la perspectiva del teorema CAP, ¿cómo se clasifica Raft?
+ CP: ante una partición mantiene consistencia, y el lado sin mayoría deja de aceptar escrituras :: Sacrifica disponibilidad en la minoría para evitar estados divergentes.
- AP: ambos lados aceptan escrituras y se reconcilian después :: Ese es el comportamiento de sistemas como Cassandra o DynamoDB, no de Raft.
- CA: no tolera particiones :: Raft está diseñado justamente para seguir funcionando ante particiones, en el lado con mayoría.
- Ninguna, porque Raft no replica datos :: Raft replica un log de comandos en todos los nodos.
> Raft es CP: consistencia garantizada; la minoría pierde disponibilidad durante la partición.
