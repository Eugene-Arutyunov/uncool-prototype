// Forwards characters typed on the page to the program running inside Wine.
// Boxedwine only knows the US keyboard layout, so Cyrillic keys never reach it as letters;
// instead typed characters are written to a file that rbkbd.exe (inside Wine) polls and posts as WM_CHAR.
(function () {
  var FILE = '/root/home/username/.wine/drive_c/rbkbd.bin';   // C:\rbkbd.bin inside Wine
  var KEEP = 64;            // recent characters kept in the file
  var total = 0, tail = [];
  var swallowed = {};       // physical keys whose keyup must not reach the emulator
  // Wine runs with the Russian locale (LC_ALL=ru_RU.UTF-8 in index.html), so it converts
  // Unicode Cyrillic to the Windows-1251 bytes the 16-bit program expects.
  // Spaces, digits, Latin letters and punctuation take the same route as Cyrillic: the emulator's
  // own keyboard path is slower, and mixing the two delivered characters out of order.
  function toUnit(ch) {
    var c = ch.charCodeAt(0);
    if (c >= 0x20 && c <= 0x7E) return c;
    if ((c >= 0x410 && c <= 0x44F) || c === 0x401 || c === 0x451) return c;
    return '\u2116\u00AB\u00BB\u2014\u2013'.indexOf(ch) !== -1 ? c : 0;   // № « » — –
  }
  window.rbSendText = function (text) {
    for (var i = 0; i < text.length; i++) {
      var u = toUnit(text[i]);
      if (!u) continue;
      tail.push(u); total++;
    }
    if (tail.length > KEEP) tail = tail.slice(-KEEP);
    var b = new Uint8Array(4 + 2 * tail.length), v = new DataView(b.buffer);
    v.setUint32(0, total, true);
    for (var j = 0; j < tail.length; j++) v.setUint16(4 + 2 * j, tail[j], true);
    try { FS.writeFile(FILE, b); } catch (e) { console.log('rbkbd: ' + e); }
  };
  function onKey(e) {
    if (e.type === 'keydown') {
      if (e.key && e.key.length === 1 && toUnit(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        swallowed[e.code] = true;
        window.rbSendText(e.key);
        e.stopImmediatePropagation(); e.preventDefault();
      }
    } else if (swallowed[e.code] || (e.key && e.key.length === 1 && toUnit(e.key))) {
      if (e.type === 'keyup') delete swallowed[e.code];
      e.stopImmediatePropagation(); e.preventDefault();
    }
  }
  ['keydown', 'keypress', 'keyup'].forEach(function (t) { window.addEventListener(t, onKey, true); });
})();
