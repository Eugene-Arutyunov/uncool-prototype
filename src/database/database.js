/* Страница /database/: вкладки, фильтр по юниту и раскрытие карточки по ссылке вида #s-<id>. */
(function () {
  var tabs = document.querySelector(".db-tabs");
  var tabButtons = document.querySelectorAll("[data-tab]");
  var panels = document.querySelectorAll("[data-panel]");
  var buttons = document.querySelectorAll("[data-unit].db-filter__item");
  var stories = document.querySelectorAll("[data-story]");
  var groups = document.querySelectorAll("[data-group]");
  var nothing = document.querySelector("[data-nothing]");

  /* вкладки */
  function show(tab) {
    panels.forEach(function (p) { p.hidden = p.id !== tab; });
    tabButtons.forEach(function (b) {
      var on = b.dataset.tab === tab;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }

  tabButtons.forEach(function (b, i) {
    b.addEventListener("click", function () {
      show(b.dataset.tab);
      history.replaceState(null, "", "#" + b.dataset.tab);
    });
    b.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var next = tabButtons[(i + (e.key === "ArrowRight" ? 1 : tabButtons.length - 1)) % tabButtons.length];
      next.focus();
      next.click();
    });
  });

  /* фильтр по юниту */
  function apply(unit) {
    var shown = 0;
    stories.forEach(function (s) {
      var visible = !unit || s.dataset.unit === unit;
      s.hidden = !visible;
      if (visible) shown++;
    });
    groups.forEach(function (g) {
      var n = g.querySelectorAll("[data-story]:not([hidden])").length;
      g.hidden = n === 0;
      g.querySelector("[data-group-count]").textContent = n;
    });
    buttons.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.unit === unit));
    });
    nothing.hidden = shown !== 0;
  }

  buttons.forEach(function (b) {
    b.addEventListener("click", function () { apply(b.dataset.unit); });
  });

  /* адрес: #requests, #stories или #s-<id> конкретной истории */
  function route() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (id === "stories" || id === "requests") return show(id);
    var el = id && document.getElementById(id);
    if (!el || !el.matches("[data-story]")) return;
    show("stories");
    if (el.hidden) apply("");
    el.open = true;
    el.scrollIntoView({ block: "start" });
  }

  document.body.classList.add("db_tabs");
  tabs.hidden = false;
  show("stories");
  window.addEventListener("hashchange", route);
  route();
})();
