/**
 * Overlay.js — seluruh antarmuka HTML di atas kanvas WebGL.
 *
 * Antarmuka dibangun dari JavaScript supaya struktur HTML di index.html tetap
 * bersih dan setiap bagian punya satu tempat tinggal. Semua label memakai
 * atribut berbahasa Indonesia sebagai nilai awal, lalu diganti saat bahasa
 * berpindah.
 *
 * Bagian:
 *   Loader       layar pemuatan bertahap
 *   Hint         petunjuk "gulir untuk menjauh", menghilang setelah dipakai
 *   ScaleBar     penanda skala pandang (permukaan planet → seluruh tata surya)
 *   Legend       tombol untuk menuju tiap benda langit
 *   InfoPanel    fakta ilmiah benda yang sedang dilihat
 *   Settings     kecepatan waktu, garis orbit, label, kualitas, bahasa
 *   Credits      atribusi lisensi tekstur (kewajiban CC BY 4.0)
 */
import { SPEED_PRESETS } from '../core/Clock.js';
import { UI_TEXT, factsFor } from '../data/i18n.js';

/** Pembantu ringkas untuk membuat elemen. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export class Overlay {
  /**
   * @param {object} options
   * @param {Array<{ id:string, name:object, def:object, kind:string }>} options.bodies
   * @param {(id: string) => void} options.onSelectBody
   * @param {(key: string, value: any) => void} options.onSettingChange
   * @param {(z: number) => void} options.onJumpToScale
   */
  constructor(options) {
    this.options = options;
    this.language = 'id';
    this.root = document.getElementById('ui');
    this.text = UI_TEXT[this.language];

    this.#buildLoader();
    this.#buildTopBar();
    this.#buildScaleBar();
    this.#buildLegend();
    this.#buildInfoPanel();
    this.#buildSettings();
    this.#buildCredits();

    this.hintUsed = false;
    this.activeBodyId = null;
  }

  // -------------------------------------------------------------------------
  // Layar pemuatan
  // -------------------------------------------------------------------------

  #buildLoader() {
    const loader = el('div', 'loader');
    loader.id = 'loader';

    const card = el('div', 'loader__card');
    card.appendChild(el('div', 'loader__globe'));
    card.appendChild(el('h1', 'loader__title', this.text.title));
    card.appendChild(el('p', 'loader__hint', this.text.loadingHint));

    const bar = el('div', 'loader__bar');
    this.loaderFill = el('div', 'loader__fill');
    bar.appendChild(this.loaderFill);
    card.appendChild(bar);

    this.loaderLabel = el('div', 'loader__label', `${this.text.loading}…`);
    card.appendChild(this.loaderLabel);

    loader.appendChild(card);
    this.root.appendChild(loader);
    this.loader = loader;
  }

  /** @param {number} progress 0..1 */
  setProgress(progress) {
    const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
    this.loaderFill.style.width = `${percent}%`;
    this.loaderLabel.textContent = `${this.text.loading}… ${percent}%`;
  }

  hideLoader() {
    this.loader.classList.add('is-hidden');
    window.setTimeout(() => this.loader.remove(), 900);
  }

  // -------------------------------------------------------------------------
  // Bar atas: judul, tanggal simulasi, dan tombol kembali
  // -------------------------------------------------------------------------

  #buildTopBar() {
    const bar = el('header', 'topbar');

    const left = el('div', 'topbar__left');
    this.titleNode = el('div', 'topbar__title', this.text.title);
    this.subtitleNode = el('div', 'topbar__subtitle', this.text.subtitle);
    left.appendChild(this.titleNode);
    left.appendChild(this.subtitleNode);

    const right = el('div', 'topbar__right');
    this.dateNode = el('div', 'topbar__date');
    right.appendChild(this.dateNode);

    this.homeButton = el('button', 'button button--ghost', this.text.resetView);
    this.homeButton.type = 'button';
    this.homeButton.addEventListener('click', () => this.options.onSelectBody('earth'));
    right.appendChild(this.homeButton);

    bar.appendChild(left);
    bar.appendChild(right);
    this.root.appendChild(bar);
    this.topBar = bar;
  }

  /** @param {Date} date tanggal simulasi */
  setSimDate(date, paused) {
    const formatted = new Intl.DateTimeFormat(this.language === 'id' ? 'id-ID' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(date);
    const suffix = paused ? ` · ${this.text.speedPaused}` : '';
    this.dateNode.textContent = `${this.text.simDate}: ${formatted} UTC${suffix}`;
  }

  // -------------------------------------------------------------------------
  // Penanda skala pandang
  // -------------------------------------------------------------------------

  #buildScaleBar() {
    const wrap = el('div', 'scalebar');
    wrap.appendChild(el('div', 'scalebar__title', this.text.levelTitle));

    this.scaleLabel = el('div', 'scalebar__label');
    wrap.appendChild(this.scaleLabel);

    const track = el('div', 'scalebar__track');
    this.scaleFill = el('div', 'scalebar__fill');
    this.scaleThumb = el('div', 'scalebar__thumb');
    track.appendChild(this.scaleFill);
    track.appendChild(this.scaleThumb);

    // Empat titik skala yang bisa diklik langsung.
    this.scaleSteps = [
      { z: 0.0, key: 'levelGlobe' },
      { z: 0.28, key: 'levelOrbit' },
      { z: 0.62, key: 'levelInner' },
      { z: 1.0, key: 'levelOuter' },
    ].map((step) => {
      const dot = el('button', 'scalebar__step');
      dot.type = 'button';
      dot.title = this.text[step.key];
      dot.addEventListener('click', () => this.options.onJumpToScale(step.z));
      track.appendChild(dot);
      return { ...step, dot };
    });

    wrap.appendChild(track);
    this.root.appendChild(wrap);
    this.scaleBar = wrap;
  }

  /** @param {number} zoom 0..1 */
  setZoomState(zoom) {
    const percent = Math.max(0, Math.min(1, zoom));
    this.scaleFill.style.height = `${(percent * 100).toFixed(1)}%`;
    this.scaleThumb.style.bottom = `${(percent * 100).toFixed(1)}%`;

    let key = 'levelGlobe';
    if (percent > 0.78) key = 'levelOuter';
    else if (percent > 0.5) key = 'levelInner';
    else if (percent > 0.2) key = 'levelOrbit';
    this.scaleLabel.textContent = this.text[key];
  }

  // -------------------------------------------------------------------------
  // Legend benda langit
  // -------------------------------------------------------------------------

  #buildLegend() {
    const wrap = el('nav', 'legend');
    wrap.appendChild(el('div', 'legend__title', this.text.legendTitle));

    const list = el('div', 'legend__list');
    this.legendButtons = new Map();

    for (const entry of this.options.bodies) {
      const button = el('button', 'legend__item');
      button.type = 'button';
      button.dataset.bodyId = entry.id;
      const dotColor = `#${(entry.def.color ?? 0x8a94ad).toString(16).padStart(6, '0')}`;
      button.style.setProperty('--dot', dotColor);

      const dot = el('span', 'legend__dot');
      dot.style.background = dotColor;
      const label = el('span', 'legend__name', entry.name[this.language] ?? entry.name.id);

      button.appendChild(dot);
      button.appendChild(label);
      button.addEventListener('click', () => this.options.onSelectBody(entry.id));

      list.appendChild(button);
      this.legendButtons.set(entry.id, { button, label, entry });
    }

    wrap.appendChild(list);
    this.root.appendChild(wrap);
    this.legend = wrap;
  }

  /** Tandai benda langit yang sedang difokuskan. */
  setActiveBody(id) {
    this.activeBodyId = id;
    for (const [key, item] of this.legendButtons) {
      item.button.classList.toggle('is-active', key === id);
    }
  }

  // -------------------------------------------------------------------------
  // Panel keterangan
  // -------------------------------------------------------------------------

  #buildInfoPanel() {
    const panel = el('aside', 'info');
    panel.id = 'info';

    const head = el('div', 'info__head');
    this.infoTitle = el('h2', 'info__title');
    this.infoTagline = el('p', 'info__tagline');

    const close = el('button', 'info__close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', this.text.close);
    close.addEventListener('click', () => this.hideInfo());

    head.appendChild(this.infoTitle);
    head.appendChild(close);
    panel.appendChild(head);
    panel.appendChild(this.infoTagline);

    this.infoStats = el('dl', 'info__stats');
    panel.appendChild(this.infoStats);

    this.infoFacts = el('ul', 'info__facts');
    panel.appendChild(this.infoFacts);

    this.root.appendChild(panel);
    this.infoPanel = panel;
  }

  /**
   * Tampilkan keterangan sebuah benda langit.
   * @param {object} def definisi dari data/bodies.js
   */
  showInfo(def) {
    const data = factsFor(def, this.language);
    const accent = `#${(def.color ?? 0x8a94ad).toString(16).padStart(6, '0')}`;
    this.infoTitle.textContent = def.name[this.language] ?? def.name.id;
    this.infoTitle.style.setProperty('--accent', accent);
    this.infoTagline.textContent = data.tagline;

    this.infoStats.replaceChildren();
    for (const [key, value] of data.stats) {
      this.infoStats.appendChild(el('dt', 'info__stat-key', key));
      this.infoStats.appendChild(el('dd', 'info__stat-value', value));
    }

    this.infoFacts.replaceChildren();
    for (const fact of data.facts) {
      this.infoFacts.appendChild(el('li', 'info__fact', fact));
    }

    this.infoPanel.classList.add('is-visible');
  }

  hideInfo() {
    this.infoPanel.classList.remove('is-visible');
  }

  // -------------------------------------------------------------------------
  // Pengaturan
  // -------------------------------------------------------------------------

  /** Buat satu baris kontrol berisi label + elemen masukan. */
  #settingRow(labelText, control) {
    const row = el('label', 'settings__row');
    row.appendChild(el('span', 'settings__label', labelText));
    row.appendChild(control);
    return row;
  }

  #checkbox(labelText, checked, onChange) {
    const input = el('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    const wrap = el('span', 'settings__check');
    wrap.appendChild(input);
    return { row: this.#settingRow(labelText, wrap), input };
  }

  /** Isi daftar pilihan ke sebuah <select>. */
  #fillSelect(select, entries, selected) {
    for (const [value, label] of entries) {
      const option = el('option', null, label);
      option.value = value;
      option.selected = value === selected;
      select.appendChild(option);
    }
    return select;
  }

  #buildSettings() {
    const panel = el('section', 'settings');
    panel.id = 'settings';

    const toggle = el('button', 'settings__toggle', '⚙');
    toggle.type = 'button';
    toggle.setAttribute('aria-label', this.text.settingsTitle);
    toggle.addEventListener('click', () => panel.classList.toggle('is-open'));
    panel.appendChild(toggle);

    const body = el('div', 'settings__body');
    body.appendChild(el('h2', 'settings__title', this.text.settingsTitle));

    // Kecepatan waktu
    this.speedSelect = this.#fillSelect(
      el('select', 'settings__select'),
      SPEED_PRESETS.map((preset) => [String(preset.daysPerSecond), preset.label]),
      '0.1',
    );
    this.speedSelect.addEventListener('change', () =>
      this.options.onSettingChange('speed', Number(this.speedSelect.value)),
    );
    body.appendChild(this.#settingRow(this.text.speed, this.speedSelect));

    // Jeda
    this.paused = false;
    this.pauseButton = el('button', 'button button--tiny', this.text.pause);
    this.pauseButton.type = 'button';
    this.pauseButton.addEventListener('click', () => {
      this.paused = !this.paused;
      this.pauseButton.textContent = this.paused ? this.text.play : this.text.pause;
      this.options.onSettingChange('paused', this.paused);
    });
    body.appendChild(this.#settingRow('⏯', this.pauseButton));

    this.toggles = {};
    for (const [key, label, initial, setting] of [
      ['orbits', this.text.orbits, true, 'orbits'],
      ['labels', this.text.labels, true, 'labels'],
      ['belts', this.text.belts, true, 'belts'],
      ['bloom', this.text.bloom, true, 'bloom'],
      ['autoRotate', this.text.autoRotate, false, 'autoRotate'],
    ]) {
      const { row, input } = this.#checkbox(label, initial, (value) =>
        this.options.onSettingChange(setting, value),
      );
      this.toggles[key] = input;
      body.appendChild(row);
    }

    this.qualitySelect = this.#fillSelect(
      el('select', 'settings__select'),
      [
        ['auto', this.text.qualityAuto],
        ['low', 'Rendah / Low'],
        ['medium', 'Sedang / Medium'],
        ['high', 'Tinggi / High'],
      ],
      'auto',
    );
    this.qualitySelect.addEventListener('change', () =>
      this.options.onSettingChange('quality', this.qualitySelect.value),
    );
    body.appendChild(this.#settingRow(this.text.quality, this.qualitySelect));

    this.languageSelect = this.#fillSelect(
      el('select', 'settings__select'),
      [
        ['id', 'Bahasa Indonesia'],
        ['en', 'English'],
      ],
      'id',
    );
    this.languageSelect.addEventListener('change', () => this.setLanguage(this.languageSelect.value));
    body.appendChild(this.#settingRow(this.text.language, this.languageSelect));

    const resetDate = el('button', 'button button--tiny', this.text.resetDate);
    resetDate.type = 'button';
    resetDate.addEventListener('click', () => this.options.onSettingChange('resetDate', true));
    body.appendChild(this.#settingRow('⟲', resetDate));

    body.appendChild(el('p', 'settings__help', this.text.keyboardHelp));

    panel.appendChild(body);
    this.root.appendChild(panel);
    this.settingsPanel = panel;
  }

  setToggle(key, value) {
    if (this.toggles?.[key]) this.toggles[key].checked = value;
  }

  // -------------------------------------------------------------------------
  // Petunjuk, atribusi, dan pesan galat
  // -------------------------------------------------------------------------

  /** Petunjuk awal; menghilang setelah pengguna menggulir atau menekan tombol. */
  showHint(onFirstInteraction) {
    const hint = el('div', 'hint');
    hint.appendChild(el('div', 'hint__main', this.text.scrollHint));
    hint.appendChild(el('div', 'hint__sub', this.text.scrollHintDetail));
    hint.appendChild(el('div', 'hint__keys', `${this.text.dragHint} · ${this.text.clickHint}`));
    this.root.appendChild(hint);
    this.hint = hint;

    const dismiss = () => {
      if (this.hintUsed) return;
      this.hintUsed = true;
      hint.classList.add('is-hidden');
      window.removeEventListener('wheel', dismiss);
      window.removeEventListener('pointerdown', dismiss);
      window.setTimeout(() => hint.remove(), 700);
      onFirstInteraction?.();
    };

    window.addEventListener('wheel', dismiss, { passive: true });
    window.addEventListener('pointerdown', dismiss);
    this.hintDismiss = dismiss;
  }

  #buildCredits() {
    const credits = el('footer', 'credits');
    this.creditsLabel = el('span', 'credits__label', `${this.text.credits}: `);
    this.creditsText = el('span', 'credits__text', this.text.creditsText);
    credits.appendChild(this.creditsLabel);
    credits.appendChild(this.creditsText);
    this.root.appendChild(credits);
    this.credits = credits;
  }

  /** Pesan galat bila WebGL tidak tersedia. */
  showWebGLError() {
    const wrap = el('div', 'error');
    wrap.appendChild(el('h2', 'error__title', this.text.webglError));
    wrap.appendChild(el('p', 'error__hint', this.text.webglErrorHint));
    this.root.appendChild(wrap);
    this.loader?.classList.add('is-hidden');
  }

  /** Sembunyikan atau tampilkan seluruh antarmuka (tombol H). */
  setInterfaceVisible(visible) {
    this.root.classList.toggle('is-hidden', !visible);
  }

  // -------------------------------------------------------------------------
  // Bahasa
  // -------------------------------------------------------------------------

  /** @param {'id'|'en'} language */
  setLanguage(language) {
    this.language = language;
    this.text = UI_TEXT[language];
    document.documentElement.lang = language;

    this.titleNode.textContent = this.text.title;
    this.subtitleNode.textContent = this.text.subtitle;
    this.homeButton.textContent = this.text.resetView;
    this.scaleBar.querySelector('.scalebar__title').textContent = this.text.levelTitle;
    this.legend.querySelector('.legend__title').textContent = this.text.legendTitle;
    this.settingsPanel.querySelector('.settings__title').textContent = this.text.settingsTitle;
    this.settingsPanel.querySelector('.settings__help').textContent = this.text.keyboardHelp;
    this.creditsLabel.textContent = `${this.text.credits}: `;
    this.creditsText.textContent = this.text.creditsText;
    this.pauseButton.textContent = this.paused ? this.text.play : this.text.pause;

    for (const [, item] of this.legendButtons) {
      item.label.textContent = item.entry.name[language] ?? item.entry.name.id;
    }
    for (const step of this.scaleSteps) step.dot.title = this.text[step.key];

    // Segarkan panel keterangan bila sedang terbuka.
    if (this.activeBodyId && this.infoPanel.classList.contains('is-visible')) {
      const item = this.legendButtons.get(this.activeBodyId);
      if (item) this.showInfo(item.entry.def);
    }

    this.options.onLanguageChange?.(language);
  }

  /** Label nama di kanvas perlu tahu bahasa yang berlaku. */
  syncLabels(labels) {
    labels?.setLanguage(this.language);
  }
}
