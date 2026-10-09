# Tacos Enmascarados 1.4 — novedades y números

## Nombre, letra y colores
- El nombre oficial es **Tacos Enmascarados** (menú, ventanas de la página, ícono de la app, instaladores y tienda).
- Letra nueva: **Luckiest Guy** (estilo cómic de lucha) para títulos y carteles; el texto de lectura sigue en Barlow Condensed.
- Colores: negro y blanco como el logotipo, con la tira de colores de la máscara (rojo, naranja, amarillo, verde, turquesa, azul, morado y rosa). Los bordes de botones y ventanas son blancos; el título del menú tiene un relieve de color distinto en cada letra.

## Personal nuevo (pestaña PERSONAL de la tienda)
| Personal | Nivel | Precio | Sueldo por semana | Qué hace |
|---|---|---|---|---|
| **Mesero Payasito** | 15 | $1,000 | $100 | Cara de payaso. Atiende solo, pero se cansa **2.2 veces más rápido** que un mesero normal |
| **Cadenero Matón** | 12 | $2,000 | $200 | Máscara negra de ladrón y bate. Junto a la puerta: a la gente de la fila **se le acaba la paciencia 2.4 veces más lento** y, una vez por cliente, les llama la atención cuando están por desesperarse (recuperan 40 % de paciencia) |
| **El Oso, Jefe de Puerta** | 24 | $7,500 | $450 | Enorme, con lentes oscuros y bate de acero: la fila espera **4 veces más** y avisa **dos veces** por cliente (recupera 60 %). Con los dos cadeneros la fila espera ≈ 4.7 veces más |

- La semana es la del **calendario del juego** (7 días del calendario). Cada día de juego avanza 3 días, así que toca pagar cada 2 o 3 días de juego (≈ 52 veces al año). El resumen del día avisa cuándo es la próxima nómina y cuánto se paga.
- Si no alcanza el dinero, **renuncia** quien no pudo cobrar (se paga primero al que cobra menos). También se puede **despedir** desde la tienda (se toca DESPEDIR dos veces).
- Sueldo diario equivalente: Payasito ≈ $43, Matón ≈ $86, El Oso ≈ $193.

## Estrellas de Sabor (antes "estrellas Michelin", con nombre propio para evitar problemas de marca)
- Empiezas con **media estrella**. Hay un **letrero** parado sobre el muro, junto a la puerta, que muestra cuántas tienes (de 0 a 5, de media en media).
- Cada estrella (por arriba de la primera mitad) da: **+3 % de propina**, **+15 % de probabilidad de VIPs** (y más gemas, +1.2 puntos de probabilidad por estrella) y **+2.5 % de clientes**. Con las 5 estrellas: +13.5 % de propina, ×1.68 de VIPs y +11 % de gente.
- Se **roban** a los rivales: +1, +1, +1 y +1.5 (total 5 con la media del principio).

## Técnicas de lucha (pestaña TÉCNICAS, desde el nivel 10)
| Técnica | Nivel | Precio | Daño | Energía | Extra |
|---|---|---|---|---|---|
| Golpe Rudo | siempre | gratis | 8 | 0 | — |
| Puñetazo Doble | 10 | $800 | 15 | 10 | dos golpes |
| Patada Voladora | 12 | $1,600 | 22 | 18 | salto |
| Tope Suicida | 16 | $3,200 | 30 | 26 | vuelo horizontal |
| Huracanrana | 20 | $5,500 | 28 | 30 | el rival pierde su turno |
| El Cangrejo | 23 | $8,500 | 22 | 30 | su golpe duele la mitad durante 2 turnos |
| Plancha Mortal | 26 | $12,000 | 44 | 42 | salto desde lo alto |
| Quebradora | 29 | $17,000 | 52 | 50 | lo levanta y lo estrella |
| Súper Mortal | 32 | $26,000 | 78 | 70 | doble maroma |

Cada técnica tiene su **propia animación**; en la tienda se ve el luchador en la postura del golpe y en la ventana de subida de nivel se ve la animación completa.

## Mapa y restaurantes rivales
Botón **MAPA** (a la izquierda, bajo el zoom) o tecla **M**. Se pelea por turnos: eliges una técnica, acomodas el golpe en la barra de tiempo (**¡PERFECTO!** ×1.5, **¡BIEN!** ×1, fallar ×0.5), y el jefe responde con uno de sus ataques. Hay energía de lucha (empiezas con 100, +18 por turno), **CUBRIRSE** (+22 energía y el golpe duele 60 % menos) y **SUERO** (cura 28 %, 2 por pelea). Tu vida = 100 + 4 × nivel.

| Restaurante | Jefe | Nivel | Técnicas necesarias | Vida del jefe | Botín |
|---|---|---|---|---|---|
| Rancho El Coyote (vaqueros) | Sheriff Cuervo | 14 | Puñetazo Doble, Patada Voladora | 170 | ★ +1, $1,500, **Vaquero Veloz** ($150/sem, camina más rápido) |
| Cantina Los Gallos (mariachis) | Don Gallo | 20 | + Tope Suicida, Huracanrana | 300 | ★ +1, $3,000, 5 gemas, **Mariachi Serenata** ($220/sem, +8 % de propina) |
| Lowrider Grill (cholos) | El Flaco | 26 | + El Cangrejo, Plancha Mortal | 370 | ★ +1, $6,000, 10 gemas, **Cholo Lowrider** ($180/sem, casi no se cansa) |
| Sakura Dojo Ramen (japoneses) | Maestro Kenji | 32 | las 8 técnicas | 440 | ★ +1½, $12,000, 20 gemas, **Itamae Kenji** ($320/sem, cocina 10 % más rápido) |

- Perder cuesta el 12 % de tu dinero (máximo $2,500) y media máscara, y ese rival no se puede retar otra vez hasta el día siguiente. **Huir** no cuesta nada. Cada rival se conquista una vez.
- Equilibrio medido con **simulaciones de miles de peleas** (jugadores simulados, no personas): con el nivel mínimo, un jugador que pulsa casi siempre en el momento justo gana 100 / 100 / 100 / 85 % de las veces; uno regular, 100 / 100 / 92 / 55 %; uno que casi siempre falla el tiempo, 100 / 93 / 9 / 2 %. Cada nivel extra ayuda un poco. Hay que probarlo con jugadores reales.

## Revisión y pruebas
- 106 pruebas nuevas (personal, cadeneros, sueldos, estrellas, tienda, mapa, peleas con las 9 técnicas y los 9 ataques de los rivales, guardado y carga) y todas las anteriores siguen en verde.
- Pruebas de "mono tecleando" con peleas, mapa, tienda y ventanas al azar: sin errores en todas las semillas.
- Revisión automática de textos que se salen de su caja en menú, tienda (todas las pestañas), mapa (los 4 rivales en sus 3 estados), peleas, resumen del día y subidas de nivel: sin textos fuera de su lugar.
- Red de seguridad nueva: si algo fallara al dibujar, el juego ya no se congela (si una ventana falla muchos cuadros seguidos, se cierra sola).
- No se pudo probar en teléfonos ni PC reales, ni el sonido en bocinas.
