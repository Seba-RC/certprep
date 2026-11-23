// Sección 6: Relojes lógicos (~3 preguntas del examen)
// 6.1 Lamport y happened-before / 6.2 Relojes vectoriales

### sd-6101 [6.1] d1 #lamport #reglas
Un proceso con reloj de Lamport L = 4 recibe un mensaje con timestamp T = 9. ¿Cuánto vale L después de recibirlo?
- 9 :: Tomar el máximo no basta: la recepción es un evento nuevo y debe incrementar el reloj.
+ 10 :: Regla de recepción: L = max(L, T) + 1 = max(4, 9) + 1 = 10.
- 5 :: Eso ignora el timestamp del mensaje; la recepción debe quedar después del envío.
- 13 :: Los relojes de Lamport no suman los valores; toman el máximo.
> Lamport al recibir: L = max(L_local, T_mensaje) + 1.

### sd-6102 [6.1] d2 #lamport #calculo
Ambos relojes parten en 0. P1 ejecuta el evento local a y luego envía el mensaje m a P2 (evento b). P2 ejecuta el evento local c, luego recibe m (evento d) y después ejecuta el evento local e. ¿Qué timestamp tiene e?
- 3 :: Ese es el timestamp de d: max(1, 2) + 1 = 3. El evento e viene después.
+ 4 :: a = 1, b = 2 (el envío incrementa y m lleva 2), c = 1, d = max(1, 2) + 1 = 3, e = 3 + 1 = 4.
- 2 :: Sería ignorar tanto el incremento de la recepción como el de e.
- 5 :: Contaría un incremento extra; cada evento suma exactamente 1.
> Lamport: +1 en cada evento local y envío; al recibir, max + 1.

### sd-6103 [6.1] d2 #lamport #concurrencia
En el mismo escenario (a = 1, b = 2 en P1; c = 1, d = 3, e = 4 en P2), ¿qué par de eventos es concurrente?
- a y e :: a → b (mismo proceso), b → d (mensaje) y d → e (mismo proceso). Por transitividad, a → e.
- c y e :: Ambos están en P2 y c ocurre antes: c → e.
+ a y c :: Ninguno ocurre antes que el otro: están en procesos distintos y ningún mensaje los conecta. Son concurrentes (a ∥ c), aunque tengan el mismo timestamp.
- b y d :: b es el envío y d la recepción del mismo mensaje: b → d.
> A → B si están en el mismo proceso en ese orden, si A es el envío y B la recepción del mismo mensaje, o por transitividad. Si nada de eso aplica, son concurrentes.

### sd-6104 [6.1] d2 #lamport #limitacion
Dos eventos cumplen L(x) = 3 y L(y) = 7. ¿Qué se puede concluir?
- Que x → y :: Lamport garantiza la implicación inversa (si x → y entonces L(x) < L(y)), no esta.
+ Que y no ocurrió antes que x, pero no se puede saber si x → y o si son concurrentes :: Es el "talón de Aquiles" de Lamport: no detecta concurrencia.
- Que son concurrentes :: Pueden serlo, pero también puede que x → y. Lamport no lo distingue.
- Que y ocurrió 4 unidades de tiempo real después de x :: Los relojes lógicos no miden tiempo físico.
> Si L(a) < L(b), no se sabe si a → b o si son concurrentes. Para detectar concurrencia se usan relojes vectoriales.

### sd-6105 [6.1] d2 #lamport #envio
¿Por qué el algoritmo de Lamport incrementa el reloj también al enviar un mensaje?
+ Porque el envío es un evento local distinguible que necesita su propio timestamp único, y el receptor debe quedar después de él :: Si no se incrementara, el envío compartiría timestamp con el evento anterior del mismo proceso.
- Para compensar la latencia de la red :: Los relojes lógicos no modelan tiempo físico ni latencia.
- Para que el receptor pueda calcular la hora real del envío :: El timestamp lógico no tiene relación con la hora real.
- Porque el receptor resta 1 al recibir :: El receptor hace max + 1; nunca resta.
> En Lamport, enviar es un evento más: se incrementa el reloj y el mensaje lleva ese valor.

### sd-6106 [6.1] d3 #lamport #orden-total
El servidor del chat ordena mensajes por timestamp de Lamport, y dos mensajes llegan con el mismo timestamp desde clientes distintos. ¿Cómo se obtiene un orden total determinístico?
- Es imposible: con timestamps iguales el orden queda indefinido :: Se puede: basta un criterio de desempate fijo.
+ Desempatando con el ID del proceso o usuario: se ordena por el par (timestamp, id) :: Todos los nodos aplican la misma regla y obtienen el mismo orden, que además respeta la causalidad.
- Ordenando por la hora del reloj físico de cada cliente :: Los relojes físicos tienen drift y pueden estar mal configurados, así que el orden dependería del cliente.
- Descartando uno de los dos mensajes :: Se perderían mensajes válidos.
> Orden total con Lamport: (timestamp, id del proceso). Todos los nodos ordenan igual.

### sd-6201 [6.2] d1 #vector-clocks #calculo
P1, con reloj vectorial [3, 0, 0] (incluyendo el evento de envío), envía un mensaje a P2, que tiene [0, 2, 0]. ¿Qué vector tiene P2 tras recibirlo?
- [3, 2, 0] :: Tomó el máximo componente a componente, pero olvidó incrementar el componente propio de P2 por el evento de recepción.
+ [3, 3, 0] :: Máximo componente a componente = [3, 2, 0], y luego P2 incrementa su propio componente: [3, 3, 0].
- [4, 3, 0] :: Solo se incrementa el componente del proceso que recibe (P2), no el de P1.
- [3, 2, 1] :: El tercer componente corresponde a P3, que no participó.
> Vectorial al recibir: max componente a componente y luego +1 en el componente propio.

### sd-6202 [6.2] d2 #vector-clocks #comparacion
El evento x tiene vector [2, 1, 0] y el evento y tiene [1, 2, 0]. ¿Qué relación tienen?
- x → y, porque la suma de x es igual y su primer componente es mayor :: La suma no se usa para comparar vectores.
- y → x :: Para eso haría falta que y ≤ x en todos los componentes, y el segundo componente de y es mayor.
+ Son concurrentes: ni x ≤ y ni y ≤ x :: x es mayor en el primer componente e y en el segundo. Ninguno domina al otro.
- Son el mismo evento :: Los vectores son distintos.
> V(a) ≤ V(b) en todos los componentes (y distintos) ⇒ a → b. Si ninguno domina al otro, son concurrentes.

### sd-6203 [6.2] d2 #vector-clocks #causalidad
El evento x tiene [1, 2, 0] y el evento y tiene [2, 2, 1]. ¿Qué relación tienen?
+ x → y, porque cada componente de x es menor o igual que el de y y los vectores son distintos :: Con relojes vectoriales la relación es bidireccional: V(x) < V(y) si y solo si x → y.
- Son concurrentes :: Para ser concurrentes, cada uno debería ser mayor en algún componente. x no lo es en ninguno.
- y → x :: y tiene componentes mayores; no puede haber ocurrido antes que x.
- No se puede determinar con relojes vectoriales :: A diferencia de Lamport, los vectores sí permiten determinarlo.
> Vectores: V(a) < V(b) ⇔ a → b. Esa equivalencia es lo que Lamport no ofrece.

### sd-6204 [6.2] d2 #vector-clocks #significado
En el proceso P2, con vector V = [5, 3, 7], ¿qué significa V[3] = 7?
- Que P2 ejecutó 7 eventos :: El número de eventos propios de P2 es V[2] = 3.
+ Que P2 sabe que ocurrieron (al menos) 7 eventos de P3, por la información que le llegó en mensajes :: V[i] cuenta los eventos propios; V[j], con j ≠ i, cuenta los eventos de j que el proceso conoce.
- Que P3 tiene el vector [5, 3, 7] en este momento :: P3 puede haber avanzado; V[3] solo refleja lo que P2 conoce.
- Que P2 envió 7 mensajes a P3 :: Los componentes cuentan eventos, no mensajes enviados a un destino.
> V[i] = eventos propios. V[j] = eventos de j que i conoce.

### sd-6205 [6.2] d2 #vector-clocks #uso
Según la Unidad 2, ¿cuándo conviene usar relojes vectoriales en vez de relojes de Lamport?
+ Cuando hay que detectar escrituras concurrentes para resolver conflictos, como en el carrito de compras de Amazon (Dynamo) o en estructuras CRDT :: Detectan concurrencia a cambio de un vector de N enteros por mensaje.
- Cuando solo se necesita un orden total de eventos, como en un log :: Para eso basta Lamport, que usa un solo entero.
- Cuando el ancho de banda es muy limitado :: El vector crece con el número de procesos; es la opción más pesada.
- Cuando se necesita la hora real de cada evento :: Ninguno de los dos relojes lógicos entrega hora real.
> Lamport: orden total barato. Vectoriales: detectan concurrencia y conflictos, con más overhead.
