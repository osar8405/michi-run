# Arte de Michi Run: Neon Nights

Ilustraciones creadas para este proyecto con la herramienta integrada `image_gen` (no CLI ni API propia). Guardadas localmente y convertidas a WebP, conservando transparencia. No se consulta un servicio de imágenes al jugar.

- `neo-tokyo.webp`: panorama cyberpunk, 1672 × 941, ~221 KB.
- `michi-hero.webp`: protagonista del menú, 1536 × 1024, ~329 KB.

Los sprites animados de juego se dibujan por código en `src/assets/createTextures.js`; las ilustraciones decorativas se pueden sustituir sin modificar los cuerpos físicos.

## Prompts utilizados

### Ciudad

Use case: stylized-concept. Asset type: background artwork for a professional 2D side-scrolling neon cyberpunk arcade game, wide landscape 16:9. Create spectacular hand-painted/anime pixel-inspired concept art of a futuristic Tokyo skyline at night, layered city architecture, detailed tall buildings and antennas, hot pink and cyan illuminated windows, Japanese neon signage, a huge banded pink-to-orange synthwave sun behind the skyline on the RIGHT half, hazy distant violet mountains. Color palette near-black navy #0d0221 with electric cyan #00f3ff, hot pink #ff00ff, neon yellow accents. Composition: side-on lateral panorama, city mainly in middle 35%-75% of image height, dark star-filled purple sky upper third, dark indigo empty rooftop/ground lower 20% for gameplay overlay. LEFT quarter significantly darker and less detailed to hold bright UI text; no character, no UI, no title, no letters or watermark. Atmospheric cinematic polished game key art with controlled bright neon and abundant dark negative space, crisp structural details, radiant glow in distance. This is a game backdrop, not a perspective street scene. Save output on local filesystem for game integration.

### Michi

Use case: stylized-concept. Asset type: hero character cutout for polished neon arcade game. A single adorable fearless cyberpunk orange-and-cream kitten sprinting toward the right in mid-air, three-quarter SIDE view. Huge pointed fluffy ears, expressive determined face, glowing narrow cyan futuristic wraparound visor, tiny high-tech dark jacket and mechanical dark boots with cyan trims, bright hot-pink scarf streaming far to left. Body is natural agile quadruped cat not humanoid. Glowing cyan tail tip, luminous cyan claws. Premium highly detailed 2D anime game character illustration, softly painted with crisp contour, neon rim lights, expressive silhouette, dynamic pose. Character fully contained including scarf tail paws, centered with padding. Actual transparent background, no scenery, no floor, no shadow plane, no text, no watermark. Palette cream orange black navy magenta cyan. This is key art for a synthwave cat runner.
