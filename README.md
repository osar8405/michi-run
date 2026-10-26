# Michi Run: Neon Nights

Un endless runner de acción en Phaser 3 y Vite: un michi callejero, cyber-hounds, una ciudad de neón y una banda sonora synthwave sintetizada en tiempo real. El escenario combina ilustración local, capas con paralaje, sol segmentado, edificios luminosos, cuadrícula en perspectiva, partículas aditivas y tratamiento CRT.

## Ejecutar

Requiere Node.js **20.19 o posterior** y npm.

```bash
npm install
npm run dev
```

Abre la dirección que muestre Vite, normalmente `http://localhost:5173`. Las dependencias se descargan al instalar; durante el juego, imágenes, fuentes, música y efectos se resuelven localmente. No requiere cuentas, claves de API ni servicios externos.

```bash
npm run build
npm run preview
```

La compilación se escribe en `dist/`. Usa un servidor HTTP para jugar: abrir `index.html` directamente con `file://` no ejecuta el proyecto Vite.

## Controles

| Acción | Teclado | Pantalla táctil |
| --- | --- | --- |
| Empezar | Espacio / Enter | Iniciar carrera |
| Saltar / doble salto | Espacio / ↑ / W | Salto |
| Desplegar alas al caer | Mantener salto | Mantener Salto |
| Cyber claws | F / J | Garras |
| Dash | Shift / K | Dash |
| Ajustar posición | A / D / ← / → | Posición automática |
| Pausar / continuar | Esc / P | Botón de pausa / Continuar |
| Reiniciar | R | Una carrera más |
| Audio | M / botón de altavoz | Botón de altavoz |

La pantalla completa se activa desde el icono de la cabecera. En móviles, la orientación horizontal ofrece más espacio para anticipar enemigos.

## Mecánicas

- **Doble salto:** dos impulsos antes de volver a tocar suelo, con tolerancia al borde y buffer de salto para que el control responda con precisión.
- **Alas de neón:** mantener salto durante la caída reduce la gravedad y limita la velocidad descendente. Las alas y sus partículas se dibujan en tiempo real.
- **Cyber claws:** ataque frontal con hitbox Arcade independiente de la animación. Acércate y encadena bajas para aumentar el multiplicador.
- **Neon dash:** avance corto con invencibilidad y estela de imágenes residuales; tiene recarga visible.
- **Overdrive:** reúne energía y enlaza combos para llenar la barra, activar invencibilidad temporal y duplicar los puntos.
- **Escudo e imán:** absorbe un impacto o atrae fragmentos cercanos.
- **Misiones y récord:** objetivos durante la carrera y mejor puntuación guardada en el navegador.
- **Enemigos progresivos:** runners terrestres, hounds que saltan y drones aéreos. El director introduce variantes y oleadas de forma gradual, conservando espacio entre amenazas.

El mundo avanza hacia la izquierda; el jugador puede desplazar ligeramente su posición y el dash lo impulsa hacia delante. El suelo, los enemigos y los ataques usan `Phaser.Physics.Arcade`.

## Cyber-Beast Evolution

La evolución reemplaza las tres vidas. Comienzas en **Cyber-Michi (nivel 1)**. Cada fragmento de neón da 1 de carga; cada baja da `2 + min(4, floor(combo / 3))`. La barra central muestra el progreso, separado del Overdrive.

| Etapa | Tamaño | Poder nuevo | Carga hacia la siguiente |
| --- | --- | --- | --- |
| Cyber-Michi · cian | 100% | Doble salto, alas y garras | 12 |
| Neon Bobcat · magenta | 120% | Dash con estela letal durante 900 ms | 20 |
| Laser Leopard · amarillo | 140% | Garras que disparan un proyectil hacia delante | 30 |
| Plasma Tiger · naranja | 170% | Contacto destruye runners; hounds y drones siguen siendo peligrosos | 42 |
| Mecha-Solar Lion · blanco/dorado | 200% | Melena de partículas y rugido que cubre la pantalla con F (recarga 1.8 s) | Máximo |

Los poderes anteriores se conservan, excepto que el rugido reemplaza garras y proyectil. Recibir daño baja exactamente una etapa, vacía la carga de evolución, elimina las armas activas y concede **2 segundos de invencibilidad**, con fragmentación de píxeles y cámara lenta de 240 ms. Un impacto sin protección en nivel 1 termina la carrera. Escudo, dash y Overdrive conservan su protección; no hay otra reserva de vidas. En Apex no se acumula carga oculta.

`src/config/evolution.js` concentra etapas, colores, costes y tiempos. `Kitten.levelUp()` aplica una etapa; `addEvolutionCharge()` procesa fragmentos y combos; `takeDamage()` aplica la degradación. La escena resuelve las colisiones de los grupos `projectiles` y `dashTrails` del jugador. Las armas expiran con el reloj de simulación, se congelan en pausa y se destruyen al reiniciar. El collider mantiene los pies y la velocidad al cambiar de escala, incluso durante una colisión; las dimensiones del cuerpo permanecen en píxeles de textura para evitar escalarlas dos veces ([API Arcade Body 3.90](https://docs.phaser.io/api-documentation/3.90.0/class/physics-arcade-body)). Todo el arte añadido es procedural y local.

## Arquitectura

```text
index.html                   Entrada Vite
src/
  main.js                    Phaser.Game, fuentes locales y montaje de interfaz
  config/game.js             Dimensiones, gravedad y paleta
  config/evolution.js        Cinco evoluciones, costes y tiempos de habilidades
  scenes/
    BootScene.js             Carga de ilustraciones y texturas procedurales
    GameScene.js             Estados, colisiones, puntuación y bucle de juego
  entities/
    Kitten.js                Física, doble salto, planeo, garras y dash
    Dog.js                   Variantes de enemigos y comportamiento
  systems/
    InputController.js       Pulsaciones por frame, teclas mantenidas y multitouch
    RunDirector.js           Semillas, ritmo de encuentros y dificultad
    SynthAudio.js            Secuenciador Web Audio y efectos
    ProgressStore.js         Récord local con fallback en memoria
  world/NeonCity.js           Ciudad, paralaje, luces y cuadrícula
  fx/NeonEffects.js           Explosiones, destellos, estelas y partículas
  assets/createTextures.js   Arte jugable generado por código
  ui/GameInterface.js        Menú, HUD, ayuda y estados DOM
  style.css                  Interfaz adaptable y luces de neón
public/
  assets/neo-tokyo.webp       Ilustración de la ciudad
  assets/michi-hero.webp      Ilustración decorativa del protagonista
tests/
  director.test.js           Contratos y seguridad del director
  input.test.js              Teclado, multitouch y ciclo de vida del audio
  browser.mjs                Verificaciones en navegador
  evolution.browser.js       Escalado, armas, daño, hit-stop y limpieza con Arcade real
```

El archivo original `michi-run.html` se conserva como referencia. La nueva aplicación entra por `index.html`.

Para ajustar la sensación de movimiento, comienza en `src/config/game.js`. Los tiempos y velocidades del protagonista están concentrados en `Kitten.js`; los ritmos de enemigos, rutas de energía y powerups están en `RunDirector.js`. El director no depende de Phaser y acepta una semilla para reproducir una carrera.

`InputController.pressed()` conserva una pulsación durante el frame; `held()` consulta el estado continuo. `endFrame()` libera las pulsaciones y `clear()` impide que un botón usado en el menú se convierta en una acción al comenzar la carrera.

## Arte, audio y fuentes

Las ilustraciones WebP están incluidas en `public/assets/`, con rutas locales. Los personajes jugables, enemigos y efectos se generan mediante gráficos y texturas Phaser. Si falta la ilustración de la ciudad, la escena conserva su fondo procedural; la imagen del michi en el menú es decorativa.

La dirección de arte y los prompts originales de las ilustraciones están en [ART-DIRECTION.md](public/assets/ART-DIRECTION.md). Se utilizó generación de imágenes integrada, con los resultados guardados en el proyecto. El diseño combina portada tipográfica de arcade, un protagonista ilustrado, UI táctica y una ciudad lluviosa con reflejos.

La música a 108 BPM y los efectos se generan con Web Audio. El audio se desbloquea mediante una interacción del usuario; el estado de silencio se guarda en `localStorage`. Pausar detiene el secuenciador y sus voces, y destruir la escena libera los recursos.

Tipografías: [Rajdhani](https://fontsource.org/fonts/rajdhani) y [Orbitron](https://fontsource.org/fonts/orbitron), distribuidas mediante Fontsource bajo **SIL Open Font License 1.1**. Vite empaqueta sus archivos locales desde los paquetes `@fontsource`; el navegador no consulta Google Fonts. Conserva los archivos de licencia de los paquetes al redistribuir las fuentes.

## Verificación

```bash
npm test
npm run build
npm run test:browser
```

Las pruebas de Node verifican el director, teclado y multitouch, pérdida de captura, cambio de pestaña y limpieza del audio. Para `test:browser`, deja `npm run dev` activo en otra terminal. Las pruebas de navegador verifican las mecánicas, reinicios, móvil y el desplazamiento físico con frames lentos. Usa `MICHI_TEST_URL` si Vite eligió otro puerto.

Para comprobar la compilación real de producción, ejecuta `npm run build`, deja `npm run preview` activo en otra terminal y después ejecuta `npm run test:production`. Verifica carga de arte y scripts, puntuación, pausa, ayuda y que no se publique el acceso de diagnóstico del modo desarrollo. El preview usa el puerto 4173 por defecto.

La física Arcade se avanza explícitamente desde `GameScene` con el mismo delta limitado que los timers de ataque, dash y Overdrive. Así, un frame lento no desplaza al personaje más tiempo que el que descuentan sus habilidades. Los temporizadores de juego se detienen en pausa.

Si Playwright indica que falta su navegador, instala Chromium y repite la comprobación:

```bash
npx playwright install chromium
npm run test:browser
```

## Problemas frecuentes

- **No hay sonido:** pulsa Iniciar carrera y revisa el botón de altavoz. Los navegadores bloquean Web Audio antes de una interacción; también comprueba el silencio de la pestaña.
- **No funcionan los controles:** cierra el diálogo de ayuda y pulsa dentro del juego. Las teclas alternativas W, J y K facilitan jugar en distintos teclados.
- **La ciudad aparece sin ilustración:** confirma que `public/assets/neo-tokyo.webp` existe y que estás usando Vite o un servidor de `dist/`. Las advertencias de carga aparecen en la consola del navegador.
- **La puntuación récord no persiste:** `localStorage` puede estar restringido en sesiones privadas; la carrera sigue funcionando.
- **Rendimiento bajo:** cierra pestañas con carga gráfica, usa un navegador con aceleración por hardware y evita ejecutar varias instancias del juego.
- **El puerto está ocupado:** Vite puede elegir otro puerto; usa la dirección que imprima en la terminal.
