// Sección 1: Programación POSIX en C — fork(), pipes y señales (~15 preguntas del examen)
// 1.1 fork(), herencia y waitpid() / 1.2 Zombies y SIGCHLD / 1.3 Pipes, FIFOs y socketpair() / 1.4 Señales y pipes

### sd-1101 [1.1] d1 #fork #retorno
Un proceso ejecuta `pid_t pid = fork();` y la llamada tiene éxito. ¿Qué valor de `pid` ve cada proceso?
+ El hijo ve 0 y el padre ve el PID del hijo :: Así distingue el código quién es quién: el hijo recibe 0 (puede obtener su propio PID con `getpid()`) y el padre recibe el PID del hijo para poder esperarlo con `waitpid()`.
- El hijo ve su propio PID y el padre ve 0 :: Está al revés. El padre necesita el PID del hijo para controlarlo, por eso es el padre quien lo recibe.
- Ambos ven el PID del hijo :: Si ambos vieran el mismo valor no habría forma de que el código se bifurque. El hijo siempre recibe 0.
- El hijo ve -1 y el padre ve el PID del hijo :: -1 significa error, y en ese caso no se crea ningún hijo. Solo el padre recibe -1 cuando `fork()` falla.
> fork() retorna 0 en el hijo, el PID del hijo en el padre y -1 (en el padre, sin crear hijo) si falla.

### sd-1102 [1.1] d1 #fork #conteo
¿Cuántas veces se imprime "hola" al ejecutar este programa (suponiendo que ningún `fork()` falla)?
```c
int main(void) {
    fork();
    fork();
    printf("hola\n");
    return 0;
}
```
- 2 veces :: Eso sería con un solo `fork()`. El segundo `fork()` lo ejecutan los dos procesos que ya existen, así que se vuelve a duplicar.
- 3 veces :: Cada `fork()` duplica a todos los procesos que lo ejecutan; el número de procesos crece como potencia de 2, no de forma lineal.
+ 4 veces :: Tras el primer `fork()` hay 2 procesos; ambos ejecutan el segundo, quedando 4. Los 4 llegan al `printf`.
- 1 vez, porque solo el proceso original llega al printf :: Padre e hijo continúan ejecutando la línea siguiente al `fork()`. No hay ningún `if` que separe sus caminos.
> n llamadas a fork() en secuencia, sin condiciones, producen 2^n procesos que ejecutan el código posterior.

### sd-1103 [1.1] d2 #fork #conteo
Un servidor de prueba ejecuta este bucle. ¿Cuántos procesos existen en total al terminar el bucle, incluyendo el original?
```c
for (int i = 0; i < 3; i++) {
    fork();
}
```
- 3 :: Contaría solo una creación por iteración. En cada iteración todos los procesos existentes llaman a `fork()`.
- 4 :: Sería el caso si solo el padre original hiciera los `fork()` (1 + 3 hijos). Aquí los hijos también continúan el bucle.
+ 8 :: Cada iteración duplica la cantidad de procesos: 1 → 2 → 4 → 8.
- 6 :: No hay forma de llegar a 6 duplicando; el crecimiento es 2^3.
> Los hijos heredan la posición en el bucle y siguen iterando; por eso un fork() dentro de un for sin control crece exponencialmente.

### sd-1104 [1.1] d2 #fork #memoria
¿Qué imprime el padre?
```c
int x = 10;
pid_t pid = fork();
if (pid == 0) {
    x = x + 5;
    exit(0);
}
waitpid(pid, NULL, 0);
printf("x = %d\n", x);
```
+ x = 10 :: Padre e hijo tienen espacios de memoria separados. El hijo modifica su propia copia de `x`; la del padre no cambia.
- x = 15 :: Esto supone memoria compartida. `fork()` no comparte variables: cada proceso trabaja sobre su copia lógica.
- Depende de quién se ejecute primero :: El `waitpid()` asegura que el hijo terminó, pero aunque no estuviera, el padre nunca vería el cambio del hijo.
- x = 0, porque la memoria del hijo se libera al hacer exit :: La memoria del hijo se libera, pero eso no afecta a la variable del padre, que nunca fue modificada.
> Después de fork() cada proceso tiene su propia copia de las variables; para compartir datos se necesita IPC (pipes, sockets, memoria compartida).

### sd-1105 [1.1] d2 #fork #copy-on-write
¿Qué describe correctamente el mecanismo copy-on-write que usa Linux en `fork()`?
- El kernel copia toda la memoria del padre al hijo en el momento del fork :: Así funcionaban implementaciones antiguas. Copiar todo de inmediato sería lento y desperdiciaría memoria si el hijo hace `exec()` enseguida.
+ Padre e hijo comparten las mismas páginas físicas marcadas como solo lectura, y una página se copia recién cuando alguno escribe en ella :: Por eso `fork()` es barato: solo se duplican las páginas que efectivamente se modifican, y cada proceso sigue viendo su propia copia lógica.
- Padre e hijo comparten la memoria de forma permanente, así que las escrituras de uno son visibles para el otro :: Eso sería memoria compartida. Con copy-on-write, al escribir se crea una copia privada, así que los cambios nunca se ven entre procesos.
- Solo se comparte el código; los datos y el stack se copian siempre al inicio :: Copy-on-write aplica también a datos y stack: nada se copia hasta que hay una escritura.
> Copy-on-write: comparten páginas físicas hasta la primera escritura; lógicamente cada proceso tiene memoria independiente.

### sd-1106 [1.1] d3 #fork #buffer-stdio
La salida estándar va a la terminal. ¿Qué se imprime?
```c
int main(void) {
    printf("A");
    fork();
    printf("B\n");
    return 0;
}
```
- `A` una vez y `B` dos veces :: Sería así si "A" ya hubiera salido a la terminal antes del `fork()`. Sin `\n`, queda en el buffer de stdio.
+ `AB` dos veces :: stdout hacia una terminal tiene buffer por línea. "A" sigue en el buffer de usuario al hacer `fork()`, el hijo hereda una copia del buffer y ambos imprimen "AB\n".
- `AB` una vez y `B` una vez :: Ambos procesos tienen exactamente el mismo contenido en su buffer, así que su salida es idéntica.
- Solo `AB` una vez, porque el hijo no hereda stdout :: El hijo hereda el descriptor 1 y además la copia de la memoria del proceso, incluido el buffer de stdio.
> El buffer de stdio vive en la memoria del proceso y se duplica con fork(). Usa fflush(stdout) antes de fork() para evitar salidas repetidas.

### sd-1107 [1.1] d2 #fork #file-descriptors
Un servidor acepta una conexión, obtiene el descriptor `cfd` y luego llama a `fork()`. ¿Qué ocurre con `cfd`?
- Solo el padre puede usar `cfd`; el hijo debe volver a aceptar la conexión :: Los descriptores abiertos se heredan. El hijo puede leer y escribir en `cfd` sin ningún paso extra.
+ Padre e hijo tienen cada uno un descriptor que apunta a la misma conexión, y la conexión solo se cierra cuando ambos lo cierran :: Los descriptores se duplican y comparten la misma descripción de archivo abierta (open file description). Por eso cada proceso debe cerrar las copias que no usa.
- El hijo recibe una conexión TCP nueva hacia el mismo cliente :: No se crea ninguna conexión nueva. Es la misma conexión, referenciada desde dos procesos.
- `cfd` se cierra automáticamente en el padre después del fork :: Nada se cierra automáticamente. Si el padre no lo cierra, la conexión sigue abierta aunque el hijo la cierre.
> Los descriptores abiertos (sockets, pipes, archivos) se heredan con fork() y apuntan al mismo recurso; el recurso se libera cuando se cierra la última copia.

### sd-1108 [1.1] d2 #fork #senales
Un proceso instala un handler para `SIGUSR1` con `sigaction()` y luego llama a `fork()`. Más tarde el hijo recibe `SIGUSR1`. ¿Qué pasa?
+ El hijo ejecuta el mismo handler, porque los handlers instalados antes del fork se heredan :: El hijo hereda la disposición de todas las señales. Solo se reinician los handlers si el hijo llama a `exec()`.
- El hijo aplica la acción por defecto, porque los handlers no se heredan :: Los handlers sí se heredan con `fork()`. Lo que se reinicia a la acción por defecto es un handler personalizado al hacer `exec()`.
- La señal se entrega al padre, que fue quien instaló el handler :: Las señales se entregan al proceso destino. Cada proceso tiene su propia copia de la tabla de handlers.
- El hijo ignora la señal hasta que vuelva a instalar el handler :: No hay que reinstalar nada: la disposición se copia completa al hijo.
> fork() copia las disposiciones de señales (handlers incluidos); lo que no hereda el hijo son las señales pendientes del padre.

### sd-1109 [1.1] d2 #waitpid #wexitstatus
El hijo termina con `exit(3)`. ¿Cuál es la forma correcta de obtener ese 3 en el padre?
- `waitpid(pid, &status, 0); printf("%d", status);` :: `status` codifica varios datos (cómo terminó y el código). En Linux imprimiría 768, no 3.
+ `waitpid(pid, &status, 0); if (WIFEXITED(status)) printf("%d", WEXITSTATUS(status));` :: `WIFEXITED` confirma que el hijo terminó normalmente y `WEXITSTATUS` extrae los 8 bits del código de salida.
- `int r = waitpid(pid, NULL, 0); printf("%d", r);` :: `waitpid()` retorna el PID del hijo recolectado, no su código de salida. Con `NULL` se descarta el estado.
- `waitpid(pid, &status, 0); if (WIFSIGNALED(status)) printf("%d", WEXITSTATUS(status));` :: `WIFSIGNALED` es verdadero cuando el hijo murió por una señal; en ese caso `WEXITSTATUS` no tiene sentido. Corresponde `WTERMSIG`.
> Primero WIFEXITED(status) y luego WEXITSTATUS(status). Si murió por señal: WIFSIGNALED y WTERMSIG.

### sd-1110 [1.1] d2 #fork #errores
Este código no revisa el caso de error. Si `fork()` falla porque se alcanzó el límite de procesos, ¿qué pasa?
```c
pid_t pid = fork();
if (pid == 0) {
    atender_cliente(cfd);
    exit(0);
} else {
    close(cfd);
}
```
- El hijo ejecuta `atender_cliente()` con pid -1 :: Cuando `fork()` falla no existe ningún hijo. Solo está el padre, con `pid == -1`.
+ No se crea ningún hijo y el padre entra al `else`, cerrando la conexión sin atenderla :: -1 no es 0, así que el padre cae en la rama del padre. El cliente queda sin servicio y no hay registro del error. Hay que tratar `pid < 0` explícitamente (por ejemplo con `perror`).
- El proceso termina automáticamente con un error :: `fork()` solo retorna -1 y deja `errno` (EAGAIN o ENOMEM). El programa sigue ejecutándose.
- Se crea un proceso zombie :: Un zombie es un hijo que ya terminó. Aquí ningún hijo llega a existir.
> Siempre maneja pid < 0 después de fork(); de lo contrario el error se confunde con la rama del padre.

### sd-1111 [1.1] d1 #fork #getppid
Dentro del hijo, ¿cómo se obtiene el PID del padre?
- Con el valor que retornó `fork()` en el hijo :: En el hijo `fork()` retorna 0, no el PID del padre.
+ Con `getppid()` :: `getppid()` retorna el PID del proceso padre. `getpid()` retorna el propio.
- Con `getpid()` :: `getpid()` retorna el PID del propio proceso (el hijo).
- No es posible: solo el padre conoce la relación :: El kernel guarda la relación padre-hijo y la expone con `getppid()`.
> En el hijo: getpid() = propio PID, getppid() = PID del padre. En el padre, fork() entrega el PID del hijo.

### sd-1112 [1.1] d3 #fork #exec
Un proceso abre un socket, instala un handler para `SIGINT`, hace `fork()` y el hijo llama a `execvp()` para ejecutar otro programa. ¿Qué conserva el nuevo programa?
- El handler de `SIGINT` y las variables globales del proceso original :: `exec()` reemplaza la imagen del proceso: el código y los datos desaparecen, así que el handler (que es código) ya no puede existir.
+ El socket abierto (salvo que tenga FD_CLOEXEC), pero no el handler, que vuelve a la acción por defecto :: Los descriptores sobreviven a `exec()` salvo que tengan close-on-exec. Las señales con handler se reinician a SIG_DFL porque el código del handler ya no existe.
- Nada: exec cierra todos los descriptores y reinicia todas las señales :: Por defecto los descriptores siguen abiertos; así funciona la redirección en la shell. Solo se cierran los marcados con FD_CLOEXEC.
- Todo, porque exec solo cambia el nombre del proceso :: `exec()` carga un programa nuevo con su propio código y datos; conserva el PID y los descriptores, no la memoria.
> fork() hereda casi todo; exec() reemplaza código y datos, conserva el PID y los descriptores sin FD_CLOEXEC, y reinicia los handlers a SIG_DFL.

### sd-1201 [1.2] d1 #zombie
¿Qué es un proceso zombie?
- Un proceso cuyo padre terminó antes que él :: Ese es un proceso huérfano. El huérfano sigue ejecutándose y es adoptado por init.
+ Un proceso que ya terminó, pero cuyo estado de salida aún no ha sido recolectado por el padre con wait()/waitpid() :: El kernel conserva su entrada en la tabla de procesos (PID y estado de salida) hasta que el padre lo recoge.
- Un proceso bloqueado indefinidamente en read() :: Un proceso bloqueado sigue vivo; está dormido esperando datos. No es un zombie.
- Un proceso que consume 100% de CPU sin responder a señales :: Eso es un proceso colgado o en bucle. Un zombie no ejecuta código ni consume CPU.
> Zombie = terminado pero no recolectado. Ocupa una entrada en la tabla de procesos hasta que el padre llama a wait()/waitpid().

### sd-1202 [1.2] d2 #zombie #servidor
Un servidor TCP concurrente hace `fork()` por cada cliente y nunca llama a `wait()`. Después de varios días aparecen fallos de `fork()` con EAGAIN. ¿Cuál es la causa más probable?
+ Cada hijo terminado quedó como zombie; se acumularon miles y se agotaron los PID o el límite de procesos del usuario :: Los zombies no usan CPU ni mucha memoria, pero cada uno ocupa un PID y cuenta contra el límite de procesos. En un servidor de larga ejecución se acumulan sin parar.
- Los hijos siguen ejecutándose y consumen toda la CPU :: Los hijos ya terminaron de atender a sus clientes. El problema no es CPU sino entradas en la tabla de procesos.
- Los sockets de clientes quedaron en TIME_WAIT :: TIME_WAIT afecta a puertos y a `bind()`, no a la creación de procesos con `fork()`.
- El backlog de listen() se llenó :: Un backlog lleno hace que se rechacen o retrasen conexiones nuevas, pero no hace fallar `fork()`.
> En servidores fork-por-cliente hay que recolectar a los hijos (handler de SIGCHLD con waitpid) o se acumulan zombies hasta agotar el límite de procesos.

### sd-1203 [1.2] d2 #sigchld #waitpid
¿Cuál es el handler de `SIGCHLD` correcto para un servidor con muchos hijos?
- `void h(int s) { wait(NULL); }` :: Recoge solo un hijo por señal. Si terminan varios a la vez llega una sola SIGCHLD y quedan zombies.
+ `void h(int s) { int e = errno; while (waitpid(-1, NULL, WNOHANG) > 0); errno = e; }` :: El bucle recoge a todos los hijos terminados, `WNOHANG` evita bloquearse si otros hijos siguen vivos, y guardar `errno` evita alterar el código interrumpido.
- `void h(int s) { waitpid(-1, NULL, 0); }` :: Sin `WNOHANG`, si no hay más hijos terminados se bloquea dentro del handler. Además recoge solo uno.
- `void h(int s) { while (waitpid(-1, NULL, 0) > 0); }` :: Recogería a todos, pero se quedaría bloqueado esperando a los hijos que siguen atendiendo clientes, y el servidor dejaría de aceptar conexiones.
> Patrón estándar: while (waitpid(-1, NULL, WNOHANG) > 0); dentro del handler de SIGCHLD, preservando errno.

### sd-1204 [1.2] d3 #sigchld #senales
Tres hijos terminan casi al mismo tiempo, pero el handler de `SIGCHLD` se ejecuta una sola vez. ¿Por qué?
- Porque el kernel pierde las señales cuando hay mucha carga :: No se pierden por carga: es el comportamiento definido de las señales estándar.
+ Las señales estándar no se encolan: mientras una SIGCHLD está pendiente, las siguientes se fusionan en esa misma :: Una señal estándar pendiente es un solo bit. Por eso el handler debe recolectar en un bucle hasta que `waitpid` retorne 0 o -1.
- Porque solo el primer hijo envía SIGCHLD; los demás no :: Cada hijo que termina genera SIGCHLD, pero las ocurrencias se fusionan mientras están pendientes.
- Porque el handler se desinstala después de ejecutarse una vez :: Con `sigaction()` el handler queda instalado. Aun así, las señales pendientes iguales se fusionan.
> SIGCHLD no cuenta cuántos hijos terminaron. El bucle con WNOHANG es lo que garantiza recogerlos a todos.

### sd-1205 [1.2] d2 #sigchld #sig-ign
Un servidor usa `signal(SIGCHLD, SIG_IGN);` para no tener zombies. ¿Qué consecuencia tiene?
- Los hijos nunca terminan :: Los hijos terminan normalmente. Lo que cambia es qué hace el kernel con su estado de salida.
- Los zombies se acumulan igual, porque solo cambia el handler :: En Linux (y según POSIX.1-2001) ignorar SIGCHLD explícitamente hace que los hijos no queden como zombies.
+ El kernel descarta automáticamente el estado de salida de los hijos, así que el padre ya no puede saber cómo terminaron :: No quedan zombies, pero se pierde la información de terminación: `waitpid()` termina fallando con ECHILD.
- El padre recibe el código de salida en una variable global :: No existe tal mecanismo. Con SIG_IGN la información de salida simplemente se descarta.
> signal(SIGCHLD, SIG_IGN) evita zombies a costa de perder el estado de salida de los hijos.

### sd-1206 [1.2] d2 #zombie #huerfano
El padre de un proceso zombie termina sin haberlo recolectado. ¿Qué pasa con el zombie?
- Queda en la tabla de procesos para siempre, hasta reiniciar la máquina :: El sistema tiene un mecanismo para limpiar a los hijos de padres muertos.
+ Es adoptado por init (PID 1) o un subreaper, que lo recolecta :: init llama periódicamente a wait() sobre los hijos que adopta, así que el zombie desaparece.
- Vuelve a ejecutarse desde donde terminó :: Un zombie ya terminó su ejecución; no puede reanudarse.
- Se convierte en el nuevo padre de sus hermanos :: Los procesos huérfanos se reasignan a init (o a un subreaper), no a un hermano.
> Matar al padre elimina sus zombies indirectamente: init los adopta y los recolecta.

### sd-1207 [1.2] d1 #zombie #kill
En `ps` aparece un proceso con estado `Z` (`<defunct>`). Un compañero ejecuta `kill -9` sobre su PID y el proceso sigue ahí. ¿Por qué?
+ El proceso ya está muerto; lo único que lo hace desaparecer es que su padre lo recolecte (o que el padre muera y init lo haga) :: SIGKILL termina procesos vivos. Un zombie no ejecuta código, solo es una entrada que espera un wait().
- SIGKILL no funciona sobre procesos de otros usuarios :: Aunque fuera del mismo usuario y con root, kill no elimina zombies.
- Hay que usar `kill -15` en vez de `kill -9` :: Ninguna señal afecta a un zombie, porque no hay proceso en ejecución que la reciba.
- El zombie está ignorando SIGKILL :: SIGKILL no se puede ignorar ni capturar. Simplemente no hay nada que matar.
> A un zombie no se le "mata": se le recolecta desde el padre con wait()/waitpid().

### sd-1208 [1.2] d3 #sigchld #eintr #accept
Un servidor instala su handler de `SIGCHLD` con `sigaction()` sin la bandera `SA_RESTART`. De vez en cuando el bucle principal termina con "accept: Interrupted system call". ¿Qué está pasando?
- El cliente cerró la conexión antes de que el servidor la aceptara :: Eso puede producir otros errores, pero el mensaje indica EINTR: una señal interrumpió la llamada.
+ Llegó SIGCHLD mientras `accept()` estaba bloqueado; tras ejecutar el handler, `accept()` retorna -1 con errno EINTR :: Sin SA_RESTART las llamadas lentas interrumpidas por un handler fallan con EINTR. Se arregla con SA_RESTART o reintentando `accept()` cuando errno == EINTR.
- El handler de SIGCHLD cerró el socket de escucha :: El handler solo llama a waitpid. El socket sigue abierto; la llamada simplemente fue interrumpida.
- El backlog de listen() es demasiado pequeño :: Un backlog pequeño no genera EINTR. Ese error es exclusivo de interrupciones por señales.
> Las llamadas bloqueantes interrumpidas por un handler retornan EINTR salvo que se use SA_RESTART. Un servidor robusto reintenta en ese caso.

### sd-1209 [1.2] d2 #waitpid #wnohang
¿Qué retorna `waitpid(-1, &status, WNOHANG)` si el proceso tiene hijos, pero ninguno ha terminado todavía?
- -1 con errno ECHILD :: ECHILD indica que el proceso no tiene hijos que esperar. Aquí sí tiene, solo que siguen vivos.
+ 0, sin bloquearse :: Con WNOHANG, 0 significa "hay hijos, pero ninguno cambió de estado". Por eso el bucle del handler termina cuando waitpid retorna 0 o -1.
- Se bloquea hasta que algún hijo termine :: Ese es el comportamiento sin WNOHANG.
- El PID del primer hijo que se creó :: waitpid solo retorna un PID cuando ese hijo cambió de estado y fue recolectado.
> waitpid con WNOHANG: >0 recogió un hijo, 0 hay hijos vivos, -1 error (ECHILD si no hay hijos).

### sd-1301 [1.3] d1 #pipe
Después de `int fd[2]; pipe(fd);`, ¿qué extremo se usa para qué?
+ `fd[0]` es el extremo de lectura y `fd[1]` el de escritura :: Regla mnemotécnica: 0 como stdin (leer) y 1 como stdout (escribir).
- `fd[0]` es el extremo de escritura y `fd[1]` el de lectura :: Está invertido. Escribir en `fd[0]` falla con EBADF.
- Ambos extremos sirven para leer y escribir :: Un pipe es unidireccional. Para comunicación bidireccional se usan dos pipes o `socketpair()`.
- Depende de qué proceso llame primero a read() :: Los roles quedan fijados al crear el pipe, no dependen del orden de uso.
> pipe(): fd[0] lectura, fd[1] escritura. El flujo es unidireccional.

### sd-1302 [1.3] d1 #pipe #bidireccional
Padre e hijo necesitan enviarse mensajes en ambos sentidos usando pipes anónimos. ¿Qué se necesita?
- Un solo pipe, porque ambos procesos tienen los dos extremos :: Si ambos leen y escriben en el mismo pipe, un proceso puede leer sus propios mensajes. El pipe no distingue quién escribe.
+ Dos pipes: uno para padre → hijo y otro para hijo → padre :: Cada pipe es unidireccional. Con dos pipes cada sentido tiene su propio canal y cada proceso cierra los extremos que no usa.
- Un FIFO con nombre, porque los anónimos no sirven entre padre e hijo :: Los pipes anónimos son justamente para procesos emparentados. Un FIFO también es unidireccional.
- Un pipe creado después del fork en cada proceso :: Si se crea después del fork, cada proceso tiene un pipe distinto y no se comunican.
> Comunicación bidireccional con pipes = dos pipes. Alternativa: socketpair(), que es bidireccional.

### sd-1303 [1.3] d2 #pipe #eof
El hijo lee del pipe en un bucle `while ((n = read(fd[0], buf, sizeof buf)) > 0)`. El padre escribe varios mensajes y cierra `fd[1]`, pero el hijo nunca sale del bucle. ¿Cuál es el error más probable?
+ El hijo no cerró su propia copia de `fd[1]`, así que el pipe todavía tiene un escritor y `read()` se bloquea en vez de retornar 0 :: `read()` retorna 0 (EOF) solo cuando todas las copias del extremo de escritura están cerradas. Cada proceso debe cerrar el extremo que no usa.
- El padre debía enviar un carácter EOF especial al final :: En Unix no existe un "carácter EOF" en pipes. El EOF se señala cerrando todos los escritores.
- `read()` sobre pipes nunca retorna 0 :: Sí retorna 0 cuando el pipe está vacío y no quedan escritores.
- El buffer del pipe se llenó :: Un buffer lleno bloquea al escritor, no al lector. Aquí el lector tiene datos o espera más.
> Cierra siempre los extremos que no usas. Un extremo de escritura abierto por descuido impide que el lector vea EOF.

### sd-1304 [1.3] d2 #pipe #escritores
Cuatro procesos hijos escriben reportes en el mismo pipe, y el padre los lee. ¿Cómo sabe el padre qué hijo escribió cada reporte?
- `read()` informa el PID del escritor en errno :: errno solo informa errores. read() no entrega ningún dato sobre el origen.
- El pipe intercala los datos en orden de PID :: El pipe es un buffer FIFO de bytes; el orden es el de llegada, sin metadatos.
+ No puede saberlo por el pipe: cada hijo debe incluir su identificador dentro del mensaje :: El buffer FIFO no guarda información del escritor. El protocolo de la aplicación debe incluirla, por ejemplo `"PID 1234: ..."`.
- Leyendo siempre exactamente PIPE_BUF bytes :: El tamaño de lectura no identifica al escritor. Además los mensajes pueden ser más cortos.
> Un pipe es un buffer FIFO anónimo: no preserva quién escribió. Si importa el origen, va dentro del mensaje.

### sd-1305 [1.3] d2 #pipe-buf #atomicidad
Varios procesos escriben mensajes al mismo pipe con un solo `write()` cada uno. ¿Cuándo está garantizado que el mensaje no se intercale con el de otro escritor?
+ Cuando el write() es de PIPE_BUF bytes o menos (4096 en Linux) :: POSIX garantiza que las escrituras de hasta PIPE_BUF bytes son atómicas. Las más grandes pueden quedar intercaladas con las de otros escritores.
- Siempre, porque un write() es una sola llamada al sistema :: Para escrituras mayores que PIPE_BUF el kernel puede dividirlas, y otros escritores pueden colarse en medio.
- Nunca: los pipes no tienen ninguna garantía de atomicidad :: Sí la tienen, hasta PIPE_BUF bytes.
- Solo si el pipe se abre con O_NONBLOCK :: O_NONBLOCK cambia qué pasa cuando no hay espacio, no el límite de atomicidad.
> Escrituras ≤ PIPE_BUF son atómicas; las mayores pueden intercalarse cuando hay varios escritores.

### sd-1306 [1.3] d2 #socketpair #pipe
¿Qué diferencias tiene `socketpair(AF_UNIX, SOCK_DGRAM, 0, sv)` frente a `pipe(fd)`? (Elige dos.)
+ Ambos descriptores de `socketpair()` permiten leer y escribir, así que el canal es bidireccional :: socketpair crea dos sockets conectados entre sí: lo que se escribe en `sv[0]` se lee en `sv[1]` y viceversa.
+ Con SOCK_DGRAM cada write() llega como un mensaje separado, preservando sus límites :: Con datagramas cada lectura entrega un mensaje completo, a diferencia del flujo de bytes de un pipe.
- socketpair() permite comunicar procesos en máquinas distintas :: socketpair solo funciona con AF_UNIX/AF_LOCAL, en la misma máquina.
- pipe() devuelve dos sockets y socketpair() dos descriptores de archivo :: Es al revés en la terminología: pipe() devuelve dos descriptores de un pipe, socketpair() dos sockets.
- socketpair() no necesita fork() para que dos procesos lo compartan :: Igual que con pipe(), dos procesos comparten los sockets heredándolos por fork().
> pipe(): unidireccional, flujo de bytes. socketpair(): bidireccional y, con SOCK_DGRAM, preserva límites de mensaje.

### sd-1307 [1.3] d2 #pipe #limites-mensaje
El escritor hace dos llamadas `write(fd[1], msg, 10)` seguidas. El lector hace `read(fd[0], buf, 100)`. ¿Qué puede retornar ese read()?
- Siempre exactamente 10 bytes, porque cada write() es un mensaje :: Un pipe es un flujo de bytes: no guarda los límites entre escrituras.
+ Entre 1 y 20 bytes; si ambos writes ya ocurrieron, puede retornar los 20 juntos :: read() entrega los bytes disponibles hasta el tamaño pedido. Para separar mensajes hace falta un delimitador o un prefijo de longitud.
- Siempre 100 bytes, rellenando con ceros :: read() nunca rellena. Retorna cuántos bytes leyó realmente.
- Retorna -1 porque se pidieron más bytes de los disponibles :: Pedir más de lo disponible no es error; simplemente retorna lo que hay.
> Pipes y TCP son flujos de bytes: los límites entre write() no se conservan. El protocolo debe definirlos.

### sd-1308 [1.3] d1 #fifo #pipe-nombrado
Dos programas independientes, lanzados por separado desde dos terminales, deben comunicarse en la misma máquina. ¿Qué mecanismo de la Unidad 1 sirve sin usar red?
- Un pipe anónimo creado por el primer programa :: Un pipe anónimo solo se comparte por herencia (fork). Un proceso no relacionado no puede obtener sus descriptores.
+ Un FIFO (pipe con nombre) creado con `mkfifo`, que ambos abren por su ruta en el sistema de archivos :: El nombre en el filesystem permite que procesos sin parentesco se encuentren. Sigue siendo local y unidireccional.
- Una variable global compartida :: Procesos distintos tienen memorias separadas; una variable global no es visible desde otro programa.
- Un socket AF_INET obligatoriamente :: Funcionaría, pero usa la pila de red. AF_LOCAL o un FIFO bastan para IPC local.
> Pipe anónimo: procesos emparentados. FIFO con nombre: procesos independientes en la misma máquina.

### sd-1309 [1.3] d2 #pipe #orden-llamadas
Un estudiante escribe este código y el hijo nunca recibe nada. ¿Por qué?
```c
pid_t pid = fork();
int fd[2];
pipe(fd);
if (pid == 0) {
    read(fd[0], buf, sizeof buf);
} else {
    write(fd[1], "hola", 4);
}
```
- Porque el padre debía cerrar fd[0] antes de escribir :: Es buena práctica, pero no explica el problema: aunque lo cerrara, el hijo seguiría sin recibir.
+ Porque `pipe()` se llama después de `fork()`: padre e hijo crean cada uno un pipe distinto que no está conectado entre ellos :: El pipe debe crearse antes del fork para que el hijo herede los mismos descriptores. Aquí el hijo lee de su propio pipe, en el que nadie escribe.
- Porque "hola" no termina en '\0' :: El pipe transporta bytes; el '\0' no importa para la entrega.
- Porque read() necesita que el escritor use PIPE_BUF bytes exactos :: No hay tal requisito. read() entrega lo que haya disponible.
> Orden correcto: pipe() → fork() → cada proceso cierra el extremo que no usa.

### sd-1310 [1.3] d1 #pipe #bloqueo
El pipe está vacío y el extremo de escritura sigue abierto en otro proceso. ¿Qué hace `read()` en modo bloqueante?
+ Se bloquea hasta que haya datos disponibles :: Es la sincronización natural del pipe: el lector duerme sin consumir CPU hasta que el escritor envía algo.
- Retorna 0 inmediatamente :: 0 significa EOF y solo ocurre cuando no queda ningún escritor.
- Retorna -1 con EAGAIN :: Ese es el comportamiento con O_NONBLOCK, no en modo bloqueante.
- Retorna los últimos datos leídos otra vez :: Los datos leídos se consumen del buffer; no se repiten.
> Pipe vacío + escritores abiertos → read() bloquea. Pipe vacío + sin escritores → read() retorna 0 (EOF).

### sd-1311 [1.3] d3 #pipe #dup2
Para implementar `ls | wc -l`, el hijo que ejecutará `ls` debe hacer que su salida estándar vaya al pipe. ¿Qué hace antes del `execlp("ls", ...)`?
- `dup2(fd[0], STDOUT_FILENO);` :: `fd[0]` es el extremo de lectura. La salida de `ls` debe ir al extremo de escritura.
+ `dup2(fd[1], STDOUT_FILENO);` y luego cierra `fd[0]` y `fd[1]` :: dup2 hace que el descriptor 1 apunte al extremo de escritura. Después se cierran los originales para no dejar escritores extra (que impedirían el EOF de `wc`).
- `dup2(STDOUT_FILENO, fd[1]);` :: Los argumentos están invertidos: así fd[1] pasaría a apuntar a la terminal.
- Nada: exec redirige la salida automáticamente al pipe :: exec no sabe del pipe. La redirección se hace con dup2 antes del exec, aprovechando que los descriptores sobreviven a exec.
> dup2(oldfd, newfd) hace que newfd apunte a lo mismo que oldfd. En `a | b`, a usa dup2(fd[1], 1) y b usa dup2(fd[0], 0).

### sd-1401 [1.4] d1 #sigpipe
Un proceso escribe en un pipe cuyo extremo de lectura ya fue cerrado por todos los procesos. No tiene ningún handler instalado. ¿Qué pasa?
- write() se bloquea hasta que aparezca un lector :: Un pipe sin lectores nunca volverá a tener uno (si es anónimo); bloquear sería inútil.
+ Recibe SIGPIPE, cuya acción por defecto termina el proceso :: El kernel avisa que nadie leerá esos datos. Por defecto el proceso muere sin mensaje, lo que suele confundir al depurar.
- write() retorna 0 :: write() no usa 0 para indicar este caso.
- Los datos quedan en el buffer hasta que un lector abra el pipe :: Con todos los lectores cerrados, los datos no tienen destino. El kernel lo trata como error.
> Escribir en un pipe (o socket) sin lector genera SIGPIPE, que por defecto termina el proceso.

### sd-1402 [1.4] d2 #sigpipe #epipe
El mismo proceso ahora hace `signal(SIGPIPE, SIG_IGN);` antes de escribir en el pipe sin lectores. ¿Qué observa?
+ write() retorna -1 y errno vale EPIPE, y el proceso sigue ejecutándose :: Al ignorar (o manejar) SIGPIPE, el error se reporta por el valor de retorno, que el programa puede revisar.
- write() retorna -1 con errno EBADF :: EBADF indica un descriptor inválido. Aquí el descriptor es válido; lo que falta es el lector.
- El proceso termina igual :: SIG_IGN evita la terminación. Lo que queda es el error en write().
- write() escribe normalmente y los datos se descartan sin aviso :: El kernel siempre reporta el problema, sea con la señal o con EPIPE.
> Con SIGPIPE ignorada o manejada, write() retorna -1 con errno = EPIPE. Es la forma recomendada en servidores.

### sd-1403 [1.4] d2 #pipe #bloqueo #sleep
En un laboratorio, un generador escribe un dato por segundo en un pipe usando `sleep(1)`. Un estudiante también agrega `sleep(1)` al bucle del receptor "para esperar a que lleguen datos". ¿Qué opinas?
- Es necesario, porque sin sleep el receptor consumiría 100% de CPU :: Un read() bloqueante no consume CPU mientras espera: el proceso duerme.
+ Es innecesario: read() ya se bloquea hasta que hay datos, y el sleep solo agrega latencia :: El sleep tiene sentido en el generador para marcar el ritmo de producción. El receptor queda sincronizado por el bloqueo natural de read().
- Es necesario para que el receptor no lea datos a medio escribir :: Las escrituras pequeñas (≤ PIPE_BUF) son atómicas. El sleep no aporta ninguna garantía.
- Es correcto porque así ambos procesos quedan sincronizados por reloj :: No hay reloj compartido; el sleep del receptor no se alinea con el del generador. La sincronización real la da el pipe.
> El emisor decide el ritmo (sleep); el receptor se sincroniza solo, porque read() bloquea hasta tener datos.

### sd-1404 [1.4] d2 #pipe #capacidad
El receptor de un pipe se detiene (por ejemplo, con Ctrl+Z) y el escritor sigue enviando datos sin parar. ¿Qué ocurre con el escritor?
- Recibe SIGPIPE de inmediato :: SIGPIPE ocurre cuando no hay lectores. Aquí el lector existe, solo está detenido.
- Sus datos se descartan cuando se llena el buffer :: El pipe no descarta datos. Se los guarda hasta que el lector los consuma.
+ Escribe hasta llenar el buffer del pipe (64 KiB por defecto en Linux) y luego write() se bloquea hasta que el lector consuma :: El bloqueo del escritor es una forma natural de back-pressure: el productor no puede adelantarse sin límite al consumidor.
- write() retorna 0 para indicar que el pipe está lleno :: En modo bloqueante write() espera. Con O_NONBLOCK retornaría -1 con EAGAIN.
> Pipe lleno → el escritor se bloquea. Es control de flujo (back-pressure) incorporado en el sistema operativo.

### sd-1405 [1.4] d3 #sigpipe #wifsignaled
Un padre lanza un hijo que escribe en un pipe; el padre cierra el extremo de lectura por error y luego llama a `waitpid(pid, &st, 0)`. ¿Qué expresión es verdadera sobre `st`?
- `WIFEXITED(st)` es verdadero y `WEXITSTATUS(st) == EPIPE` :: El hijo no terminó con exit(). Murió por una señal, así que WIFEXITED es falso.
+ `WIFSIGNALED(st)` es verdadero y `WTERMSIG(st) == SIGPIPE` :: Al escribir sin lectores, el hijo recibió SIGPIPE y murió por su acción por defecto. Así se diagnostica desde el padre.
- `WIFEXITED(st)` es verdadero y `WEXITSTATUS(st) == 0` :: El hijo nunca llegó a su exit(0); la señal lo terminó antes.
- `waitpid` retorna -1 porque el hijo murió por una señal :: waitpid recolecta a hijos que terminan por cualquier causa. Retorna el PID y deja la causa en st.
> Para saber si un hijo murió por una señal: WIFSIGNALED(st) y WTERMSIG(st). Un hijo que "desaparece" escribiendo en un pipe suele ser SIGPIPE.

### sd-1406 [1.4] d2 #senales #sigaction
¿Por qué se recomienda `sigaction()` en lugar de `signal()` para instalar handlers en un servidor?
- Porque `signal()` no puede instalar handlers, solo SIG_IGN o SIG_DFL :: signal() sí puede instalar handlers. El problema es otro.
+ Porque `sigaction()` tiene un comportamiento portable y permite controlar detalles como SA_RESTART y qué señales se bloquean durante el handler :: La semántica de signal() varía entre sistemas (por ejemplo, si el handler se reinstala o si se reinician las llamadas). sigaction() lo deja explícito.
- Porque `signal()` hace que los handlers no se hereden con fork() :: La herencia con fork() es igual con ambas funciones.
- Porque `sigaction()` hace que las señales se encolen :: Las señales estándar no se encolan con ninguna de las dos funciones.
> sigaction() es la forma portable y explícita de instalar handlers; con ella se decide, por ejemplo, si usar SA_RESTART.

### sd-1312 [1.3] d2 #fifo #open
Un proceso abre un FIFO con `open("/tmp/chat_fifo", O_RDONLY)` y ningún otro proceso lo tiene abierto para escritura. ¿Qué pasa?
+ open() se bloquea hasta que otro proceso abra el FIFO para escritura :: En modo bloqueante, abrir un FIFO espera a que exista el otro extremo. Así se sincronizan lector y escritor desde el inicio.
- open() retorna de inmediato y read() devuelve 0 :: Ese sería el comportamiento con O_NONBLOCK, no en modo bloqueante.
- open() falla con ENOENT porque no hay escritor :: ENOENT indica que la ruta no existe. Aquí el FIFO existe; solo falta el escritor.
- open() crea el FIFO si no existe :: Los FIFO se crean con mkfifo(); open() no los crea.
> Abrir un FIFO bloquea hasta que el otro extremo también esté abierto (salvo O_NONBLOCK).

### sd-1407 [1.4] d3 #senales #grupo-procesos
Un servidor con fork() corre en primer plano en la terminal. El usuario presiona Ctrl+C. ¿Quién recibe SIGINT?
- Solo el padre, porque fue el proceso lanzado desde la shell :: La terminal envía SIGINT a todo el grupo de procesos en primer plano, no a un proceso.
+ El padre y todos sus hijos, porque los hijos heredan el grupo de procesos del padre, y la terminal envía SIGINT al grupo en primer plano :: Si los hijos heredaron un handler de SIGINT, todos lo ejecutan. Para que los hijos no lo reciban se puede cambiar su grupo (setpgid) o ignorar la señal en ellos.
- Solo los hijos, porque el padre está bloqueado en accept() :: Estar bloqueado no impide recibir señales; de hecho la señal interrumpe el accept().
- Nadie: SIGINT solo afecta a procesos sin hijos :: Tener hijos no protege de SIGINT.
> Ctrl+C envía SIGINT a todo el grupo de procesos en primer plano, que incluye a los hijos creados con fork().
