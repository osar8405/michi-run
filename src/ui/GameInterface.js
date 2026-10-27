const icons = {
  cat: '<path d="M4 17V4l6 5h4l6-5v13l-8 5Z"/><path d="M7 13h3m4 0h3m-6 4h2"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  sound:
    '<path d="m11 4-6 5H2v6h3l6 5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-6 5H2v6h3l6 5Zm5 5 6 6m0-6-6 6"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  claw: '<path d="M3 20 9 5M9 21 15 3M16 20 22 5"/>',
  jump: '<path d="M4 19h16M12 16V3m-6 6 6-6 6 6"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
  trophy:
    '<path d="M7 3h10v7a5 5 0 0 1-10 0Zm5 12v6m-4 0h8M7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4"/>',
  close: '<path d="m5 5 14 14m0-14L5 19"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
};
const icon = (name, className = "") =>
  `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.bolt}</svg>`;

export class GameInterface {
  constructor(root) {
    this.root = root;
    this.mode = "loading";
    this.cache = {};
    root.innerHTML = `
      <header class="site-header">
        <a class="brand" href="./" aria-label="Michi Run, inicio"><span class="brand-mark">${icon("cat")}</span><span>MICHI<span class="brand-dot">.</span><small>THE AFTER-HOURS ARCADE</small></span></a>
        <nav class="main-nav" aria-label="Menú principal"><button class="nav-item active" data-ui="play">JUGAR <span>01</span></button><button class="nav-item" data-ui="help">CÓMO JUGAR <span>02</span></button></nav>
        <div class="header-tools"><span class="live-indicator"><i></i> SISTEMA ONLINE</span><button class="icon-button" data-ui="mute" aria-label="Activar o silenciar audio" aria-pressed="false">${icon("sound")}</button><button class="icon-button" data-ui="fullscreen" aria-label="Pantalla completa">${icon("expand")}</button></div>
      </header>
      <main class="main-content">
        <div class="game-heading"><div><span class="eyebrow">EL ARCADE NUNCA DUERME</span><h1>Tu próxima obsesión<span> nocturna.</span></h1></div><div class="edition"><span class="edition-lines">///</span> NEON NIGHTS <b>VOL. 03</b></div></div>
        <section class="arcade-frame" id="arcade-frame" aria-label="Michi Run, videojuego de acción" data-mode="loading">
          <div id="game-canvas" role="img" aria-label="Escenario de Michi Run. Usa Espacio para saltar, F para atacar y Shift para dash."></div>
          <div class="frame-grain" aria-hidden="true"></div><div class="frame-vignette" aria-hidden="true"></div>
          <div class="corner corner-tl"></div><div class="corner corner-tr"></div><div class="corner corner-bl"></div><div class="corner corner-br"></div>
          <div class="arena-top"><div class="location"><i></i><span id="sector-label">NEO TOKIO</span><span class="location-divider">/</span><span class="location-time">23:48</span></div><div class="record">${icon("trophy")}<span>RÉCORD</span><b id="best-score">000000</b></div></div>
          <div class="load-screen"><span class="load-cat">${icon("cat")}</span><span class="eyebrow">ENCENDIENDO LA CIUDAD</span><div class="load-track"><i id="load-progress"></i></div></div>
          <div class="menu-screen">
            <div class="title-copy"><div class="game-kicker"><span></span> CORRE. BRILLA. REPITE.</div><div class="game-logo" aria-label="Michi Run"><span class="logo-michi">MICHI</span><span class="logo-run">RUN<span class="logo-star">✦</span></span></div><div class="subtitle"><span>NEON NIGHTS</span><i>夜の街</i></div>
            <p class="game-description">Nueve vidas. Cero límites.<br>Conquista la ciudad a toda velocidad.</p>
            <button class="start-button" data-ui="start">${icon("play")}<span>INICIAR CARRERA</span>${icon("arrow")}</button><div class="start-hint">O PRESIONA <kbd>ESPACIO</kbd> PARA EMPEZAR</div>
            </div>
            <div class="hero-orbit" aria-hidden="true"><div class="orbit-ring ring-one"></div><div class="orbit-ring ring-two"></div><span class="hero-spark spark-one">✦</span><span class="hero-spark spark-two">+</span><img class="hero-cat" src="/assets/michi-hero.webp" alt=""/><div class="hero-id"><span class="hero-id-line"></span><div><b>MI-CHI / 01</b><small>CALLEJERO POR NATURALEZA.</small></div></div></div>
            <div class="menu-bottom"><span><i></i> ENDLESS RUNNER <em>×</em> CYBER COMBAT</span><span>INSERT COIN? <b>NAH. SOLO ACTITUD.</b></span></div>
          </div>
          <div class="run-hud" aria-label="Estadísticas de la carrera"><div class="hud-left"><span class="hud-caption">PUNTUACIÓN</span><strong id="score">000000</strong><div class="vitals"><div id="health" class="health">${icon("heart")}${icon("heart")}${icon("heart")}</div><span id="distance">0 m</span></div></div><div class="hud-right"><span class="hud-caption">NEON OVERDRIVE</span><div class="drive-track"><i id="drive-fill"></i><span class="drive-ticks"></span></div><div class="drive-details"><span id="drive-label">RECARGA CON ENERGÍA Y COMBOS</span><strong id="combo">×1</strong></div></div>
            <div class="mission"><span class="mission-label">MISIÓN DE LA NOCHE</span><span id="mission-text">Recoge 20 fragmentos de neón</span><b id="mission-progress">0 / 20</b></div>
            <div class="ability-status"><span id="shield-status"></span><span id="magnet-status"></span></div>
            <div class="evolution-status" id="evolution-status"><span class="hud-caption" id="evolution-name">NV. 1 · CYBER-MICHI</span><div class="evolution-track" role="progressbar" aria-label="Energía para evolucionar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="evolution-fill"></i></div><span id="evolution-progress">0 / 12 FRAGMENTOS</span><small id="evolution-power">DOBLE SALTO · GARRAS</small></div>
            <button class="pause-button icon-button" data-ui="pause" aria-label="Pausar carrera">${icon("pause")}</button>
            <div class="dash-indicator"><div class="dash-orb" id="dash-orb">${icon("bolt")}</div><span id="dash-label">DASH LISTO <kbd>SHIFT</kbd></span></div>
          </div>
          <div class="state-screen" id="state-screen"><div class="state-panel"><span class="eyebrow" id="state-eyebrow">RESPIRA. LA NOCHE ES LARGA.</span><h2 id="state-title">EN PAUSA<span>_</span></h2><p id="state-description">Tu ciudad. Tu ritmo.</p><div class="result-stats" id="result-stats"><div><span>PUNTUACIÓN</span><b id="final-score">0</b></div><div><span>DISTANCIA</span><b id="final-distance">0 m</b></div><div><span>MEJOR COMBO</span><b id="final-combo">×1</b></div></div><button class="start-button" id="state-primary" data-ui="resume">${icon("play")}<span>CONTINUAR</span>${icon("arrow")}</button><button class="text-button" data-ui="menu">VOLVER AL INICIO</button></div></div>
          <div class="touch-controls" aria-label="Controles táctiles"><button data-action="dash" aria-label="Dash">${icon("bolt")}<span>DASH</span></button><button data-action="attack" aria-label="Atacar">${icon("claw")}<span>GARRAS</span></button><button data-action="jump" aria-label="Saltar, mantener para planear">${icon("jump")}<span>SALTO</span></button></div>
          <div class="arena-toast" id="arena-toast" role="status"></div><div class="drive-announcement" id="drive-announcement"><small>SISTEMAS AL MÁXIMO</small><strong>OVERDRIVE</strong></div>
        </section>
        <div class="control-strip"><div class="control-intro"><span class="tiny-square"></span> DOMINA LA NOCHE</div><div class="control-item"><kbd>ESPACIO</kbd><span>Saltar <b>×2</b><small>MANTÉN PARA PLANEAR</small></span></div><div class="control-item"><kbd>F</kbd><span>Cyber claws<small>ENLAZA TUS COMBOS</small></span></div><div class="control-item"><kbd>SHIFT</kbd><span>Neon dash<small>RÁPIDO E INVENCIBLE</small></span></div><div class="control-item pause-control"><kbd>ESC</kbd><span>Pausa<small>TOMA UN RESPIRO</small></span></div><button class="how-button" data-ui="help">VER CONTROLES ${icon("arrow")}</button></div>
      </main>
      <footer class="site-footer"><span>HECHO PARA LOS QUE SIEMPRE DICEN <b>“UNA MÁS”.</b></span><span><i></i> SIN DESCARGAS. SIN EXCUSAS. <b>100% ARCADE.</b></span></footer>
      <dialog class="help-dialog" id="help-dialog" aria-labelledby="help-title"><button class="dialog-close icon-button" data-ui="close-help" aria-label="Cerrar instrucciones">${icon("close")}</button><span class="eyebrow">MANUAL DE SUPERVIVENCIA / 01</span><h2 id="help-title">No eres un gato<br><em>cualquiera.</em></h2><p>La ciudad corre hacia ti. Tú decides cómo conquistarla.</p><div class="help-grid"><article><kbd>ESPACIO / ↑</kbd><h3>Doble salto + alas</h3><p>Salta otra vez en el aire. Mantén el botón al caer para desplegar tus alas de neón.</p></article><article><kbd>F</kbd><h3>Cyber claws</h3><p>Ataca de cerca a los cyber-hounds. Encadena bajas en 4 segundos para multiplicar puntos.</p></article><article><kbd>SHIFT</kbd><h3>Neon dash</h3><p>Atraviesa enemigos con invencibilidad. Se recarga en 1.45 segundos.</p></article><article><kbd>◈</kbd><h3>Overdrive</h3><p>Recoge energía y enlaza combos. Llena la barra para 8 segundos de invencibilidad y puntos dobles.</p></article></div><div class="help-note"><span>EXTRAS</span> Escudo antiimpacto · Imán de energía · Récord local · <b>A / D</b> para ajustar tu posición · <b>M</b> audio · <b>ESC</b> pausa</div><button class="start-button" data-ui="close-help">ENTENDIDO, A CORRER ${icon("arrow")}</button></dialog>
    `;
    this.frame = root.querySelector("#arcade-frame");
    root.querySelector("#health").innerHTML = icon("heart").repeat(5);
    this.dialog = root.querySelector("#help-dialog");
    const evolutionHelp = document.createElement("p");
    evolutionHelp.className = "help-note";
    evolutionHelp.textContent =
      "CYBER-BEAST: fragmentos y combos te llevan de Michi a Lince, Leopardo, Tigre y León. En niveles 4–5 aparece el Cyber-Catcher: salta su red EMP o usa Dash. El EMP atraviesa armadura, escudo y Overdrive, reinicia tu evolución; en nivel 1 te atrapa. Los golpes normales bajan una etapa y dan 2 s de protección.";
    this.dialog.querySelector(".help-note").before(evolutionHelp);
    this.handleClick = (event) => {
      const button = event.target.closest("[data-ui]");
      if (!button) return;
      const action = button.dataset.ui;
      if (action === "fullscreen") {
        this.toggleFullscreen();
        return;
      }
      if (action === "help") {
        this.game?.events.emit("ui-action", "help");
        this.dialog.showModal();
      } else if (action === "close-help") {
        this.dialog.close();
        this.game?.events.emit("ui-action", "close-help");
      } else this.game?.events.emit("ui-action", action);
      button.blur();
    };
    this.handleCancel = () => this.game?.events.emit("ui-action", "close-help");
    this.handleHelpKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      this.dialog.close();
      this.handleCancel();
    };
    root.addEventListener("click", this.handleClick);
    this.dialog.addEventListener("cancel", this.handleCancel);
    this.dialog.addEventListener("keydown", this.handleHelpKeyDown);
  }

  attach(game) {
    this.game = game;
  }
  loading(value) {
    this.root.querySelector("#load-progress").style.width =
      `${Math.round(value * 100)}%`;
  }
  setMode(mode) {
    this.mode = mode;
    this.frame.dataset.mode = mode;
    if (mode === "menu" || mode === "gameover") {
      this.frame.classList.remove("overdrive", "has-combo");
      this.root.querySelector("#arena-toast").classList.remove("visible");
      this.root
        .querySelector("#drive-announcement")
        .classList.remove("visible");
    }
    const isPaused = mode === "paused";
    if (isPaused || mode === "gameover") {
      this.setText(
        "state-eyebrow",
        isPaused
          ? "RESPIRA. LA NOCHE ES LARGA."
          : "CADA FINAL ES OTRA OPORTUNIDAD.",
      );
      this.root.querySelector("#state-title").innerHTML = isPaused
        ? "EN PAUSA<span>_</span>"
        : "BUENA<br><em>CARRERA.</em>";
      this.setText(
        "state-description",
        isPaused
          ? "Tu ciudad. Tu ritmo."
          : "La ciudad ya está esperando tu regreso.",
      );
      const primary = this.root.querySelector("#state-primary");
      primary.dataset.ui = isPaused ? "resume" : "restart";
      primary.querySelector("span").textContent = isPaused
        ? "CONTINUAR"
        : "UNA CARRERA MÁS";
    }
    this.cache = {};
  }
  setText(id, text) {
    if (this.cache[id] === text) return;
    this.cache[id] = text;
    this.root.querySelector(`#${id}`).textContent = text;
  }
  update(stats) {
    this.setText("score", String(Math.floor(stats.score)).padStart(6, "0"));
    this.setText("distance", `${Math.floor(stats.distance)} m`);
    this.setText("sector-label", stats.sector);
    this.setText("combo", `×${stats.multiplier}`);
    this.setText(
      "drive-label",
      stats.overdrive
        ? "OVERDRIVE ACTIVO · PUNTOS ×2"
        : stats.combo > 1
          ? `${stats.combo} BAJAS · NO PARES AHORA`
          : "RECARGA CON ENERGÍA Y COMBOS",
    );
    this.root.querySelector("#drive-fill").style.transform =
      `scaleX(${stats.energy / 100})`;
    this.frame.classList.toggle("overdrive", stats.overdrive);
    this.frame.classList.toggle("has-combo", stats.combo > 1);
    const healthKey = `${stats.health}`;
    if (this.cache.health !== healthKey) {
      this.cache.health = healthKey;
      this.root
        .querySelectorAll("#health svg")
        .forEach((heart, i) =>
          heart.classList.toggle("empty", i >= stats.health),
        );
      this.root
        .querySelector("#health")
        .setAttribute("aria-label", `${stats.health} etapas de supervivencia`);
    }
    const evolutionRatio = stats.evolution.shards
      ? stats.evolutionCharge / stats.evolution.shards
      : 1;
    const evolutionColor = `#${stats.evolution.color.toString(16).padStart(6, "0")}`;
    this.root
      .querySelector("#evolution-status")
      .style.setProperty("--evolution-color", evolutionColor);
    this.root
      .querySelector("#health")
      .style.setProperty("--evolution-color", evolutionColor);
    this.setText(
      "evolution-name",
      `NV. ${stats.evolutionLevel} · ${stats.evolution.name.toUpperCase()}`,
    );
    this.setText(
      "evolution-progress",
      stats.evolution.shards
        ? `${stats.evolutionCharge} / ${stats.evolution.shards} FRAGMENTOS`
        : "APEX · EVOLUCIÓN MÁXIMA",
    );
    this.setText("evolution-power", stats.evolution.power);
    this.root.querySelector("#evolution-fill").style.transform =
      `scaleX(${evolutionRatio})`;
    this.root
      .querySelector(".evolution-track")
      .setAttribute("aria-valuenow", String(Math.round(evolutionRatio * 100)));
    this.root.querySelector('[data-action="attack"] span').textContent =
      stats.evolutionLevel === 5 ? "RUGIDO" : "GARRAS";
    this.setText(
      "dash-label",
      stats.dashReady
        ? "DASH LISTO [SHIFT]"
        : `RECARGANDO ${Math.round(stats.dashProgress * 100)}%`,
    );
    this.root
      .querySelector("#dash-orb")
      .style.setProperty("--charge", `${stats.dashProgress * 100}%`);
    this.root
      .querySelector("#dash-orb")
      .classList.toggle("ready", stats.dashReady);
    this.setText("shield-status", stats.shield ? "◇ ESCUDO ACTIVO" : "");
    this.setText("magnet-status", stats.magnet ? "⊙ IMÁN ACTIVO" : "");
    this.setText("mission-text", stats.mission.text);
    this.setText(
      "mission-progress",
      `${Math.min(stats.mission.value, stats.mission.goal)} / ${stats.mission.goal}`,
    );
  }
  setBest(best) {
    this.setText("best-score", String(Math.floor(best)).padStart(6, "0"));
  }
  results(stats) {
    this.setText(
      "final-score",
      Math.floor(stats.score).toLocaleString("es-MX"),
    );
    this.setText("final-distance", `${Math.floor(stats.distance)} m`);
    this.setText("final-combo", `×${stats.maxCombo}`);
  }
  setMuted(muted) {
    const button = this.root.querySelector('[data-ui="mute"]');
    button.innerHTML = icon(muted ? "mute" : "sound");
    button.setAttribute("aria-pressed", String(muted));
    button.setAttribute(
      "aria-label",
      muted ? "Activar audio" : "Silenciar audio",
    );
  }
  toast(message) {
    const el = this.root.querySelector("#arena-toast");
    el.textContent = message;
    el.classList.remove("visible");
    void el.offsetWidth;
    el.classList.add("visible");
  }
  announceOverdrive() {
    this.root.querySelector("#arena-toast").classList.remove("visible");
    const el = this.root.querySelector("#drive-announcement");
    el.classList.remove("visible");
    void el.offsetWidth;
    el.classList.add("visible");
  }
  async toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await this.frame.requestFullscreen();
    } catch {
      this.toast("La pantalla completa no está disponible en este navegador.");
    }
  }
  destroy() {
    this.root.removeEventListener("click", this.handleClick);
    this.dialog.removeEventListener("cancel", this.handleCancel);
    this.dialog.removeEventListener("keydown", this.handleHelpKeyDown);
  }
}
