/*
  Демо Библейского справочника в лонгриде.
  Эмулятор грузится около минуты, поэтому фрейм создаётся сразу после загрузки страницы:
  пока читатель долистает до демо, программа уже запустится.
  Исключение — режим экономии трафика (демо весит около 40 МБ): там остаётся кнопка запуска.
*/
for (const demo of document.querySelectorAll("[data-demo-src]")) {
  const start = demo.querySelector(".longread__demo-start");
  if (!start) continue;

  const launch = (byClick) => {
    if (!start.isConnected) return;
    const frame = document.createElement("iframe");
    frame.src = demo.dataset.demoSrc;
    frame.title = demo.dataset.demoTitle || "";
    frame.allow = "fullscreen";
    start.replaceWith(frame);
    // фокус переносим только по клику, иначе страница прыгнет к демо
    if (byClick) frame.focus();
  };

  start.addEventListener("click", () => launch(true));

  const saveData = navigator.connection && navigator.connection.saveData;
  if (saveData) continue;

  if (document.readyState === "complete") launch(false);
  else window.addEventListener("load", () => launch(false), { once: true });
}
