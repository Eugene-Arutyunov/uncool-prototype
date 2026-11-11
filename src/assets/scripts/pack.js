/*
  Вид «пачка»: лента карточек в перспективе, по мотивам tlb.betteroff.studio/surf.

  Как устроено:
  - все карточки лежат в одной точке, каждой задаётся transform;
  - виртуальный скролл: колесо и перетаскивание меняют target,
    каждый кадр current догоняет target через lerp (это инерция);
  - карточки — клоны карточек сетки (.stories__item, кроме заголовка),
    выровнены по низу ленты;
  - карточка i стоит на i * step (step = ширина экрана / плотность),
    лента закольцована через wrap; карточек клонируется столько,
    чтобы хватило на экран;
  - по положению на экране (q от 0 слева до 1 справа) считаются
    подъём по диагонали, волна (синус) и угол поворота rotateY;
  - z-index: левые карточки лежат поверх правых;
  - ховер на название в столбике слева: лента едет так, чтобы карточка
    встала в середину свободной области, карточка плавно приближается,
    поворачивается фронтально и ложится поверх всех (focus 0→1).
*/

const root = document.documentElement;
const pack = document.querySelector(".pack");
const stage = pack?.querySelector(".pack__stage");
const form = pack?.querySelector(".pack-controls");

const PARAMS = [
  { key: "speed", label: "Скорость", min: 0.2, max: 4, step: 0.1, value: 2.4 },
  { key: "inertia", label: "Инерция", min: 0.02, max: 0.3, step: 0.01, value: 0.22 },
  { key: "perspective", label: "Перспектива", min: 300, max: 3000, step: 50, value: 2400, unit: "px" },
  { key: "size", label: "Размер", min: 5, max: 20, step: 0.5, value: 14.5, unit: "rem" },
  { key: "density", label: "Плотность", min: 4, max: 40, step: 1, value: 13 },
  { key: "angle", label: "Угол", min: 0, max: 90, step: 1, value: 51, unit: "°" },
  { key: "tilt", label: "Наклон", min: -1, max: 1, step: 0.05, value: 0.65 },
  { key: "wave", label: "Волна", min: 0, max: 3, step: 0.1, value: 0 },
];

const storage = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} },
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (min, max, v) => Math.min(max, Math.max(min, v));
const wrap = (min, max, v) => {
  const range = max - min;
  return min + ((((v - min) % range) + range) % range);
};

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (pack && stage) {
  // лента на всю страницу: выносим из секции прямо в body
  document.body.appendChild(pack);

  const templates = [...document.querySelectorAll(".stories__item")].map((item) => {
    const card = item.cloneNode(true);
    card.classList.add("pack__card");
    card.querySelectorAll("a, img").forEach((el) => el.setAttribute("draggable", "false"));
    card.setAttribute("draggable", "false");
    card.tabIndex = -1;
    return card;
  });
  let cards = [];
  let step = 0;
  let length = 0;
  let cardWidth = 0;
  let width = 0;
  let height = 0;
  let centerX = 0; // x карточки в фокусе: середина области правее заголовка
  let bottomPx = 0;
  let heights = [];
  let focus = []; // 0…1 для каждой карточки
  let focusIndex = -1; // номер карточки (в сетке), на название которой навели
  const ZOOM = 0.35;

  let target = 0;
  let current = 0;
  let time = 0;
  let unfold = 0; // 0→1 при входе: карточки «разворачиваются»
  let raf = 0;
  let last = 0;

  // параметры
  let saved = {};
  try { saved = JSON.parse(storage.get("pack-params") || "{}"); } catch (e) {}
  const params = Object.fromEntries(PARAMS.map((p) => [p.key, saved[p.key] ?? p.value]));

  function applyCssParams() {
    pack.style.setProperty("--pack-perspective", `${params.perspective}px`);
    pack.style.setProperty("--pack-size", `${params.size}rem`);
  }

  // раскладка: размеры, шаг, нужное число клонов
  function layout() {
    width = pack.clientWidth;
    height = pack.clientHeight;
    const rem = parseFloat(getComputedStyle(root).fontSize);
    cardWidth = params.size * rem;
    step = width / params.density;

    const minLength = width + cardWidth * 3;
    const copies = Math.max(1, Math.ceil(minLength / (templates.length * step)));
    const needed = templates.length * copies;
    if (cards.length !== needed) {
      stage.replaceChildren();
      cards = [];
      for (let c = 0; c < copies; c++) {
        for (const tpl of templates) {
          const card = c === 0 ? tpl : tpl.cloneNode(true);
          stage.appendChild(card);
          cards.push(card);
        }
      }
    }
    length = cards.length * step;
    focus = cards.map((_, i) => focus[i] || 0);
    heights = cards.map((card) => card.offsetHeight);
    bottomPx = parseFloat(getComputedStyle(cards[0]).bottom) || 0;
    const heading = document.querySelector(".stories__heading");
    const left = heading ? heading.getBoundingClientRect().right : 0;
    centerX = (left + width) / 2 - cardWidth / 2;
  }

  function render(velocity, dt) {
    const n = templates.length;
    const focusStep = 1 - Math.pow(1 - 0.15, dt);
    const amp = (height / 27) * 0.35 * params.wave * (1 + Math.min(Math.abs(velocity), 200) * 0.01);
    const angle = params.angle * unfold;
    cards.forEach((card, i) => {
      const x = wrap(-cardWidth * 1.5, length - cardWidth * 1.5, i * step - current);
      const q = clamp(0, 1, (x + cardWidth) / (width + cardWidth)); // 0 слева, 1 справа
      const wave = reducedMotion ? 0 : Math.sin(time + (q - 0.5) * Math.PI * 2) * amp;
      // от нижней линии: при положительном наклоне лента поднимается вправо, при отрицательном — влево
      const y = -height * 0.5 * Math.abs(params.tilt) * (params.tilt >= 0 ? q : 1 - q) + wave;
      const rotate = -(angle + 15 * q * unfold);

      // фокус: ближайшая к середине копия карточки, на название которой навели
      const wanted = focusIndex >= 0 && i % n === focusIndex && Math.abs(x - centerX) < (n * step) / 2 ? 1 : 0;
      const f = (focus[i] = lerp(focus[i], wanted, focusStep));
      const yCenter = -(height / 2 - heights[i] / 2 - bottomPx); // по вертикали в середину
      const fy = lerp(y, yCenter, f);

      card.style.transform = `translate3d(${x.toFixed(1)}px, ${fy.toFixed(1)}px, 0) rotateY(${(rotate * (1 - f)).toFixed(2)}deg) scale(${(1 + ZOOM * f).toFixed(3)})`;
      card.style.zIndex = f > 0.01 ? 100000 + Math.round(f * 1000) : Math.round(length - x);
    });
  }

  function tick(now) {
    const dt = last ? Math.min(3, (now - last) / (1000 / 60)) : 1; // в кадрах по 60 fps
    last = now;
    const before = current;
    current = lerp(current, target, 1 - Math.pow(1 - params.inertia, dt));
    time += 0.02 * dt;
    if (unfold < 1) unfold = Math.min(1, unfold + dt / 60);
    render(current - before, dt);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (raf) return;
    unfold = 0;
    last = 0;
    layout();
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // ввод: колесо
  // слушаем на window: колесо над логотипом и столбиком тоже листает ленту
  window.addEventListener("wheel", (e) => {
    if (root.dataset.view !== "pack" || e.target.closest(".pack-settings")) return;
    e.preventDefault();
    target += (e.deltaY + e.deltaX) * params.speed;
  }, { passive: false });

  // ввод: перетаскивание (мышь и тач одним кодом)
  let drag = null;
  let suppressClick = false;
  pack.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest(".pack-settings")) return;
    drag = { x: e.clientX, y: e.clientY, target, moved: false };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(e.clientY - drag.y)) {
      drag.moved = true;
      pack.classList.add("pack_dragging");
    }
    if (drag.moved) target = drag.target - dx * 2 * params.speed;
  });
  window.addEventListener("pointerup", () => {
    if (!drag) return;
    suppressClick = drag.moved;
    drag = null;
    pack.classList.remove("pack_dragging");
  });
  pack.addEventListener("click", (e) => {
    if (suppressClick) e.preventDefault();
    suppressClick = false;
  }, true);

  // ввод: стрелки
  window.addEventListener("keydown", (e) => {
    if (root.dataset.view !== "pack" || e.target.closest("input")) return;
    if (e.key === "ArrowRight") target += step * 4;
    else if (e.key === "ArrowLeft") target -= step * 4;
    else return;
    e.preventDefault();
  });

  window.addEventListener("resize", () => raf && layout());

  // столбик названий: ховер (или фокус с клавиатуры) — карточку в середину и в фокус
  function focusCard(index) {
    focusIndex = index;
    document.querySelectorAll(".stories__list-link").forEach((link) => {
      link.classList.toggle("stories__list-link_active", +link.dataset.index === index);
    });
    if (index < 0 || !step) return;
    // копии повторяются с периодом n·step: берём ближайшую к текущей позиции
    const period = templates.length * step;
    const base = index * step - centerX;
    target = base + Math.round((target - base) / period) * period;
  }

  document.querySelectorAll(".stories__list-link").forEach((link) => {
    const index = +link.dataset.index;
    link.addEventListener("mouseenter", () => focusCard(index));
    link.addEventListener("mouseleave", () => focusCard(-1));
    link.addEventListener("focus", () => focusCard(index));
    link.addEventListener("blur", () => focusCard(-1));
  });

  // панель параметров: по наведению в угол — кнопка «Настройки», по клику панель, × закрывает
  const settings = pack.querySelector(".pack-settings");
  settings?.querySelector(".pack-settings__toggle")?.addEventListener("click", () => settings.classList.add("pack-settings_open"));
  settings?.querySelector(".pack-controls__close")?.addEventListener("click", () => settings.classList.remove("pack-settings_open"));

  if (form) {
    const outputs = {};
    const format = (p, v) => `${+v.toFixed(2)}${p.unit || ""}`;
    for (const p of PARAMS) {
      const id = `pack-${p.key}`;
      const name = document.createElement("label");
      name.htmlFor = id;
      name.textContent = p.label;
      const input = Object.assign(document.createElement("input"), {
        type: "range", id, min: p.min, max: p.max, step: p.step, value: params[p.key],
      });
      const out = document.createElement("output");
      out.textContent = format(p, params[p.key]);
      outputs[p.key] = { input, out };
      input.addEventListener("input", () => {
        params[p.key] = +input.value;
        out.textContent = format(p, params[p.key]);
        storage.set("pack-params", JSON.stringify(params));
        applyCssParams();
        if (["size", "density"].includes(p.key)) layout();
      });
      form.append(name, input, out);
    }
    const reset = Object.assign(document.createElement("button"), { type: "button", className: "pack-controls__reset", textContent: "Сбросить" });
    reset.addEventListener("click", () => {
      for (const p of PARAMS) {
        params[p.key] = p.value;
        outputs[p.key].input.value = p.value;
        outputs[p.key].out.textContent = format(p, p.value);
      }
      storage.set("pack-params", "{}");
      applyCssParams();
      layout();
    });
    form.append(reset);
  }

  applyCssParams();

  // переключатель «Сетка / Пачка»
  function setView(view) {
    root.dataset.view = view;
    storage.set("view", view);
    if (view === "pack") {
      window.scrollTo(0, 0);
      start();
    } else {
      stop();
    }
  }

  const radios = document.querySelectorAll('.segmented__input[name="view"]');
  const initial = root.dataset.view === "pack" ? "pack" : "grid";
  radios.forEach((radio) => {
    radio.checked = radio.value === initial;
    radio.addEventListener("change", () => radio.checked && setView(radio.value));
  });
  setView(initial);
}
