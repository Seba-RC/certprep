// Sección 2: Sockets TCP en C (~8 preguntas del examen)
// 2.1 Secuencia del servidor / 2.2 Cierre y estados TCP / 2.3 Servidor concurrente con fork() / 2.4 Parsing y funciones auxiliares

### sd-2101 [2.1] d1 #servidor #secuencia
¿Cuál es el orden correcto de llamadas para un servidor TCP?
+ socket() → bind() → listen() → accept() :: Se crea el socket, se le asocia dirección y puerto, se pasa a modo pasivo y luego se extraen conexiones de la cola.
- socket() → listen() → bind() → accept() :: listen() necesita que el socket ya tenga dirección. Sin bind() el kernel le asignaría un puerto aleatorio que nadie conoce.
- socket() → connect() → listen() → accept() :: connect() es del cliente. Un socket que llama a connect() queda como socket activo y no puede escuchar.
- bind() → socket() → listen() → accept() :: bind() necesita el descriptor que retorna socket(); no puede ir primero.
> Servidor TCP: socket → bind → listen → accept. Cliente TCP: socket → connect.

### sd-2102 [2.1] d2 #listen #backlog
¿Qué hace `listen(sfd, 10)`?
- Se bloquea hasta que lleguen 10 clientes :: listen() no se bloquea; retorna de inmediato. Quien espera clientes es accept().
+ Pasa el socket al estado LISTEN y define el tamaño de la cola de conexiones pendientes (backlog) :: Desde ese momento el kernel completa handshakes y deja las conexiones en cola hasta que accept() las extraiga.
- Limita el servidor a 10 clientes simultáneos como máximo :: El backlog limita las conexiones que esperan a ser aceptadas, no las que ya fueron aceptadas y se están atendiendo.
- Asocia el socket al puerto 10 :: El puerto se asigna con bind() mediante la estructura sockaddr.
> listen() convierte el socket en pasivo (LISTEN). El backlog es la cola de conexiones esperando accept(), no un límite de clientes atendidos.

### sd-2103 [2.1] d1 #accept
¿Qué retorna `accept()` en un servidor TCP?
- El mismo descriptor del socket de escucha, ahora conectado al cliente :: Si fuera así, el servidor perdería su socket de escucha y no podría aceptar más clientes.
+ Un descriptor nuevo para la conexión con ese cliente; el socket de escucha sigue disponible para otras conexiones :: Por eso un servidor maneja dos tipos de descriptores: uno de escucha (uno solo) y uno por cada cliente.
- El PID del proceso cliente :: accept() no sabe nada del proceso remoto. Opcionalmente entrega su dirección IP y puerto.
- 0 si la conexión fue exitosa :: 0 es un descriptor válido (stdin), no un código de éxito. accept() retorna el nuevo descriptor o -1.
> accept() extrae una conexión de la cola y retorna un descriptor nuevo; el socket de escucha nunca se usa para leer ni escribir datos.

### sd-2104 [2.1] d3 #accept #handshake
El servidor llamó a `listen()`, pero todavía no llama a `accept()`. Un cliente ejecuta `connect()`. ¿Qué pasa?
+ connect() puede retornar con éxito: el kernel completa el three-way handshake y deja la conexión en la cola hasta que el servidor llame a accept() :: El handshake lo hace el kernel. accept() solo retira conexiones ya establecidas de la cola.
- connect() falla con ECONNREFUSED porque nadie está en accept() :: ECONNREFUSED ocurre cuando no hay ningún socket en LISTEN en ese puerto. Aquí sí lo hay.
- connect() queda bloqueado hasta que el servidor llame a accept() :: No hace falta esperar a accept(): con el socket en LISTEN, el kernel responde el SYN.
- La conexión se descarta y el cliente debe reintentar :: Solo se descarta (o se ignora el SYN) si la cola de backlog está llena.
> El kernel acepta conexiones en segundo plano tras listen(); accept() las retira de la cola. Una cola llena es lo que hace fallar o demorar connect().

### sd-2105 [2.1] d2 #af-local #af-inet
Según la comparación de la Unidad 1, ¿qué diferencia a un socket AF_LOCAL (AF_UNIX) de uno AF_INET?
- AF_LOCAL es unidireccional como un pipe; AF_INET es bidireccional :: Ambos tipos de socket son bidireccionales. La unidireccionalidad es propia del pipe.
+ AF_LOCAL comunica procesos en la misma máquina identificándose con una ruta del sistema de archivos; AF_INET usa IP y puerto y puede cruzar la red :: AF_LOCAL tiene latencia muy baja y se protege con permisos de archivo; AF_INET escala a LAN/WAN a cambio de latencia variable.
- AF_LOCAL solo sirve para procesos emparentados por fork() :: Dos procesos independientes pueden conectarse usando la ruta del socket.
- AF_INET no permite UDP :: AF_INET admite SOCK_STREAM (TCP) y SOCK_DGRAM (UDP).
> AF_LOCAL: misma máquina, ruta en el filesystem. AF_INET: IP + puerto, alcance de red.

### sd-2106 [2.1] d1 #cliente #connect
¿Por qué un cliente TCP normalmente no llama a `bind()` antes de `connect()`?
- Porque bind() solo existe para UDP :: bind() se usa tanto en TCP como en UDP.
+ Porque si no lo hace, el kernel le asigna una IP de origen y un puerto efímero automáticamente al conectar :: Al cliente no le importa su puerto local; nadie se conecta a él. El servidor, en cambio, necesita un puerto conocido.
- Porque connect() falla si el socket ya tiene bind() :: Un cliente puede hacer bind() antes de connect() si necesita un puerto específico; no es un error.
- Porque el cliente usa el mismo puerto que el servidor :: Cliente y servidor usan puertos distintos; la conexión queda identificada por la tupla de 4 valores.
> El servidor hace bind() a un puerto conocido; el cliente deja que el kernel le asigne un puerto efímero al hacer connect().

### sd-2107 [2.1] d1 #htons #sockaddr
Al llenar `struct sockaddr_in` para el puerto 5000, ¿por qué se escribe `addr.sin_port = htons(5000);`?
+ Porque el puerto debe ir en orden de bytes de red (big-endian), que puede ser distinto del orden del host :: htons convierte un short del orden del host al de red. En x86 (little-endian) sin htons el puerto quedaría invertido.
- Porque htons valida que el puerto esté libre :: htons solo reordena bytes; no consulta al sistema operativo.
- Porque los puertos se guardan como texto :: El puerto es un entero de 16 bits, no texto.
- Porque htons reserva el puerto para el proceso :: La reserva del puerto ocurre en bind().
> Puertos y direcciones en sockaddr van en orden de red: htons/htonl al escribir, ntohs/ntohl al leer.

### sd-2201 [2.2] d1 #fin #recv
El cliente llama a `close()` sobre su socket conectado. ¿Qué observa el servidor en su `recv()`?
- recv() retorna -1 con ECONNRESET :: Eso ocurre con un RST (cierre abrupto). close() normal envía FIN.
+ recv() retorna 0, que indica cierre ordenado de la conexión :: El FIN significa "no enviaré más datos". El servidor debe tratar 0 como fin de la conexión y cerrar su lado.
- recv() se bloquea para siempre :: Después del FIN, recv() deja de bloquearse y retorna 0 de inmediato cada vez.
- recv() retorna los últimos datos de nuevo :: Los datos ya leídos no se repiten.
> close() envía FIN y el peer ve recv() == 0. Es la forma normal de detectar que el otro lado terminó.

### sd-2202 [2.2] d2 #rst #econnreset
Un servidor detecta `recv()` = -1 con errno ECONNRESET. ¿Qué significa?
+ El peer terminó la conexión de forma abrupta enviando un RST :: Pasa, por ejemplo, si el proceso remoto cerró con datos sin leer, o si un middlebox o el host remoto rechazó la conexión. No hubo cierre ordenado.
- El cliente cerró normalmente con close() :: Un cierre normal produce recv() == 0, no un error.
- El backlog de listen() está lleno :: El backlog afecta a conexiones nuevas, no a una ya establecida.
- El socket todavía no tiene datos disponibles :: Sin datos, un recv() bloqueante simplemente espera. En modo no bloqueante el error sería EAGAIN.
> FIN → recv() = 0 (cierre ordenado). RST → recv() = -1 con ECONNRESET (terminación abrupta).

### sd-2203 [2.2] d2 #close-wait
Con `ss -tan` ves cientos de conexiones del servidor en estado CLOSE_WAIT que nunca desaparecen. ¿Cuál es el bug más probable?
- Los clientes no cierran sus conexiones :: CLOSE_WAIT significa justamente que el cliente ya cerró (envió FIN).
+ El servidor no llama a close() cuando recv() retorna 0, así que nunca cierra su lado de la conexión :: CLOSE_WAIT = el peer remoto cerró y la aplicación local aún no. Es casi siempre un descriptor que la aplicación olvidó cerrar.
- El servidor usa un timeout demasiado largo de TIME_WAIT :: TIME_WAIT es otro estado (del lado que inicia el cierre). CLOSE_WAIT no expira por tiempo.
- El kernel está esperando 2×MSL :: Esa espera corresponde a TIME_WAIT, no a CLOSE_WAIT.
> Muchos CLOSE_WAIT = la aplicación local no cierra sockets después de recibir el FIN del otro lado.

### sd-2204 [2.2] d2 #time-wait
¿Qué describe correctamente el estado TIME_WAIT?
- Lo tiene el lado que recibió el primer FIN, mientras su aplicación no llame a close() :: Ese es CLOSE_WAIT.
+ Lo tiene el lado que inició el cierre; espera 2×MSL para que segmentos retrasados de la conexión vieja no se confundan con una conexión nueva y para poder retransmitir el último ACK :: Por eso aparece en quien llamó primero a close(), y desaparece solo, sin intervención de la aplicación.
- Indica que el servidor está esperando nuevas conexiones :: Ese es el estado LISTEN.
- Indica que el handshake inicial no ha terminado :: Ese sería SYN_SENT o SYN_RECEIVED.
> TIME_WAIT: lado que cerró primero, espera 2×MSL para absorber segmentos retrasados. CLOSE_WAIT: el remoto cerró y el local no.

### sd-2205 [2.2] d2 #eaddrinuse #so-reuseaddr
Detienes el servidor con Ctrl+C y lo vuelves a lanzar de inmediato. `bind()` falla con EADDRINUSE durante uno o dos minutos. ¿Qué pasa y cómo se evita?
- Otro programa tomó el puerto; hay que cambiar el puerto cada vez :: El puerto lo retienen las conexiones viejas del propio servidor, no otro programa.
+ Las conexiones que el servidor cerró quedaron en TIME_WAIT en ese puerto; activar SO_REUSEADDR con setsockopt() antes de bind() permite reutilizarlo :: SO_REUSEADDR permite hacer bind() aunque existan conexiones en TIME_WAIT sobre esa dirección y puerto.
- El kernel no libera el puerto hasta reiniciar la máquina :: TIME_WAIT dura 2×MSL (en Linux, unos 60 segundos) y luego el puerto se libera solo.
- Hay que llamar a listen() antes de bind() :: El orden correcto es bind() → listen(); cambiarlo no resuelve EADDRINUSE.
> EADDRINUSE tras un reinicio rápido = conexiones en TIME_WAIT. Solución: setsockopt(SO_REUSEADDR) antes de bind().

### sd-2206 [2.2] d3 #sigpipe #send
Un servidor hace `send()` sobre una conexión cuyo cliente ya terminó (y el kernel recibió un RST). El servidor muere sin imprimir ningún error. ¿Qué pasó y cómo se previene?
+ Recibió SIGPIPE, igual que al escribir en un pipe sin lector; se evita ignorando SIGPIPE o usando la bandera MSG_NOSIGNAL en send() y revisando EPIPE :: En sockets, escribir sobre una conexión ya reseteada genera SIGPIPE. Un servidor no debe morir por un cliente que se fue.
- Recibió SIGCHLD porque el cliente era su hijo :: El cliente es otro proceso, normalmente en otra máquina; no es hijo del servidor.
- send() retornó 0 y el servidor salió del bucle :: send() no usa 0 para indicar cierre del peer. El síntoma "muere sin mensaje" apunta a una señal.
- El kernel cerró el socket de escucha :: El socket de escucha no se ve afectado por el cierre de un cliente.
> Escribir en una conexión cerrada por el peer genera SIGPIPE. En servidores: SIG_IGN o MSG_NOSIGNAL y manejar EPIPE.

### sd-2301 [2.3] d1 #fork #cierre-descriptores
En un servidor concurrente con `fork()` después de cada `accept()`, ¿qué descriptores se deben cerrar? (Elige dos.)
+ El hijo cierra el socket de escucha :: El hijo solo atiende a su cliente. Mantener el socket de escucha abierto deja una referencia innecesaria al puerto.
+ El padre cierra el socket del cliente aceptado :: El padre solo acepta conexiones. Si no cierra la copia del cliente, la conexión no se cierra cuando el hijo termina y se filtran descriptores.
- El hijo cierra el socket del cliente aceptado antes de atenderlo :: Ese es justamente el socket que el hijo necesita para hablar con el cliente.
- El padre cierra el socket de escucha :: Sin el socket de escucha, el padre no puede aceptar más clientes.
- Ninguno, porque fork() no duplica descriptores :: fork() sí duplica todos los descriptores abiertos; por eso hay que cerrar las copias que no se usan.
> Servidor con fork(): el hijo cierra el socket de escucha; el padre cierra el socket del cliente.

### sd-2302 [2.3] d2 #fork #fuga-descriptores
El padre de un servidor con `fork()` olvida hacer `close(cfd)` después de crear al hijo. El hijo atiende al cliente, llama a `close(cfd)` y termina. ¿Qué ve el cliente?
- Ve el cierre normal, porque el hijo cerró el socket :: El socket tiene otra referencia abierta en el padre, así que el kernel no envía FIN.
+ La conexión sigue abierta: el cliente no recibe FIN y su recv() se queda esperando, mientras el padre acumula descriptores hasta agotar su límite :: La conexión se cierra solo cuando se cierra la última copia del descriptor. Además, cada cliente filtra un descriptor en el padre.
- Recibe un RST inmediato :: Nadie aborta la conexión; simplemente queda una referencia abierta.
- El padre recibe SIGPIPE :: El padre no escribe en ese socket. SIGPIPE solo aparece al escribir.
> La conexión se cierra cuando se cierra la última copia del descriptor. Un close() olvidado en el padre deja conexiones colgadas y filtra descriptores.

### sd-2303 [2.3] d3 #fork #socket-escucha
Los hijos de un servidor no cierran el socket de escucha. El padre muere por un error mientras varios hijos siguen atendiendo clientes largos. ¿Qué consecuencia tiene?
+ El puerto sigue ocupado (en LISTEN) porque los hijos mantienen abierto el socket de escucha; un servidor nuevo no puede hacer bind() hasta que terminen todos esos hijos :: Las copias heredadas mantienen vivo el socket de escucha. Incluso llegan conexiones a la cola que nadie aceptará.
- Nada: el puerto se libera en cuanto muere el padre :: El socket se libera cuando se cierra su última copia, y las tienen los hijos.
- Los hijos se convierten en zombies inmediatamente :: Los hijos siguen vivos; quedan huérfanos y los adopta init. No son zombies.
- Los clientes de los hijos pierden su conexión :: Las conexiones de los clientes están en otros descriptores, que los hijos siguen usando.
> Un hijo que no cierra el socket de escucha mantiene ocupado el puerto si el padre termina mientras haya hijos activos.

### sd-2304 [2.3] d2 #fork #exit
¿Qué problema tiene este bucle de servidor?
```c
while (1) {
    int cfd = accept(sfd, NULL, NULL);
    if (fork() == 0) {
        close(sfd);
        atender(cfd);
        close(cfd);
    }
    close(cfd);
}
```
- El padre cierra cfd demasiado pronto :: El padre debe cerrar cfd; el hijo tiene su propia copia.
+ El hijo no termina con exit() después de atender: vuelve al while y llama a accept() sobre sfd, que ya cerró :: Sin exit(0), el hijo sigue ejecutando el bucle del padre. Aquí accept() fallaría con EBADF y el hijo podría seguir haciendo fork(). El hijo siempre debe terminar con exit().
- accept() debería llamarse dentro del hijo :: El padre acepta y el hijo atiende; es el diseño correcto.
- Falta llamar a listen() dentro del bucle :: listen() se llama una sola vez, antes del bucle.
> En servidores con fork(), la rama del hijo termina siempre con exit(); si no, el hijo se mete en el bucle del padre.

### sd-2401 [2.4] d2 #recv #stream
Un cliente envía dos mensajes con `send(s, "JOIN ana\n", 9, 0)` y `send(s, "MSG hola\n", 9, 0)`. ¿Qué puede retornar un solo `recv(s, buf, 100, 0)` en el servidor?
- Siempre exactamente "JOIN ana\n", porque cada send() es un mensaje :: TCP no preserva los límites entre send(). Es un flujo de bytes.
+ Cualquier fragmento del flujo: un mensaje parcial, uno completo o ambos juntos ("JOIN ana\nMSG hola\n") :: Por eso el servidor debe acumular en un buffer y extraer mensajes buscando el delimitador '\n'.
- Siempre ambos mensajes juntos, porque se enviaron seguidos :: Puede pasar, pero también pueden llegar separados o cortados; nada lo garantiza.
- Retorna -1 si llegan dos mensajes a la vez :: Que haya varios mensajes en el buffer no es un error.
> TCP es un stream de bytes: recv() puede traer mensajes parciales o varios juntos. El protocolo necesita un delimitador o un largo explícito.

### sd-2402 [2.4] d3 #parsing #buffer
El servidor acumula bytes en `acc` (con `len` bytes válidos) y extrae líneas terminadas en '\n'. Tras procesar la primera línea, de longitud `k` (incluyendo el '\n'), ¿qué debe hacer con los bytes restantes?
- Descartarlos, porque pertenecen a un recv() ya procesado :: Esos bytes pueden ser otro mensaje completo o el inicio de uno incompleto. Descartarlos pierde datos.
+ Moverlos al inicio del buffer con `memmove(acc, acc + k, len - k); len -= k;` y volver a buscar '\n' :: Puede haber más mensajes completos en el buffer, y un mensaje incompleto debe esperar al próximo recv().
- Copiarlos con `strcpy(acc, acc + k);` :: Las regiones se solapan (comportamiento indefinido con strcpy) y los datos binarios o sin '\0' no se copian bien. memmove maneja el solapamiento.
- Llamar a recv() de nuevo antes de procesar el resto :: Si el buffer ya contiene otra línea completa, hay que procesarla primero; esperar un recv() podría bloquear sin necesidad.
> Patrón de parsing TCP: acumular, extraer todas las líneas completas, y conservar el resto (memmove) para el siguiente recv().

### sd-2403 [2.4] d2 #sscanf #validacion
El protocolo define mensajes como `SEND <usuario> <número>`. ¿Cuál es la forma correcta de parsear la línea?
- `sscanf(linea, "SEND %31s %d", usuario, &n);` sin revisar nada más :: Si la línea viene mal formada, `usuario` o `n` quedan sin inicializar y el servidor trabaja con basura.
+ `if (sscanf(linea, "SEND %31s %d", usuario, &n) != 2) { /* responder error */ }` :: sscanf retorna cuántos campos asignó. Si no son 2, el mensaje es inválido. El ancho %31s evita desbordar el buffer de 32 bytes.
- `if (sscanf(linea, "SEND %s %d", usuario, &n) == 0)` :: Solo detecta el caso sin ningún campo; un mensaje con usuario pero sin número pasaría. Además %s sin ancho puede desbordar el buffer.
- `if (sscanf(linea, "SEND %31s %d", usuario, &n) == -1)` :: EOF (-1) solo aparece si falla la entrada antes de asignar algo. Un formato parcialmente correcto no se detecta.
> Valida siempre el retorno de sscanf contra el número de campos esperados y limita el ancho de %s.

### sd-2404 [2.4] d2 #ctime
Un servidor registra eventos con `printf("[%s] %s\n", ctime(&t), msg);` y en el log cada mensaje aparece en una línea distinta de su fecha. ¿Por qué?
+ ctime() retorna una cadena que ya termina en '\n', así que el salto de línea queda dentro de los corchetes :: Hay que quitar el '\n', por ejemplo con `s[strcspn(s, "\n")] = '\0';`, o usar strftime() con formato propio.
- printf no admite dos %s en la misma llamada :: printf admite cualquier cantidad de especificadores.
- ctime() retorna la hora en UTC y eso agrega una línea :: ctime() usa la hora local; la zona horaria no agrega saltos de línea.
- El mensaje msg viene con un '\n' al principio :: El problema aparece siempre, sin importar msg: está en el formato de ctime().
> ctime() incluye '\n' al final de la cadena; quítalo antes de interpolarlo.

### sd-2405 [2.4] d3 #ctime #thread-safety #fork
ctime() retorna un puntero a un buffer estático y no es thread-safe. ¿Es un problema usarla en un servidor concurrente con `fork()`?
- Sí, porque todos los hijos comparten el mismo buffer estático :: Después de fork() cada proceso tiene su propia copia de la memoria, incluido el buffer estático.
+ No, porque cada proceso tiene su propia copia del buffer estático; el riesgo aparece con hilos, donde sí comparten memoria :: Con hilos, dos llamadas simultáneas pueden pisar el mismo buffer. En ese caso conviene ctime_r() o strftime().
- Sí, porque ctime() solo funciona en el proceso padre :: Cualquier proceso puede llamar a ctime().
- No, porque ctime() reserva memoria nueva con malloc en cada llamada :: No usa malloc; retorna siempre el mismo buffer estático, por eso no es thread-safe.
> Buffer estático: seguro entre procesos (fork copia la memoria), inseguro entre hilos. Para hilos: ctime_r() o strftime().

### sd-2406 [2.4] d2 #recv #cadenas
¿Qué problema tiene este código?
```c
char buf[256];
int n = recv(cfd, buf, sizeof buf, 0);
printf("Recibido: %s\n", buf);
```
- recv() no puede usarse con buffers en el stack :: El buffer puede estar en el stack sin problema.
+ recv() no agrega '\0': hay que recibir como máximo `sizeof buf - 1` bytes, revisar n (0 = cierre, -1 = error) y luego hacer `buf[n] = '\0'` :: Sin terminador, printf lee más allá de los datos recibidos. Y si n es 0 o -1, no hay mensaje que imprimir.
- recv() siempre llena los 256 bytes, así que no hay problema :: recv() retorna los bytes disponibles, que pueden ser muchos menos.
- Debería usarse read() en vez de recv() :: Con flags 0, recv() equivale a read(). El problema es el terminador y la falta de verificación.
> recv() trabaja con bytes, no con cadenas: revisa su retorno y agrega tú el '\0' si vas a tratar los datos como texto.
