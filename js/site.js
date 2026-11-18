// Detox prototype: what every page shares.
// Motion and smooth scrolling (both on, with no switch for visitors), the slow reveal, the contact bar that docks,
// the pointer's label, and buttons that do nothing here on purpose.
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  // A phone held sideways is too low for the held scenes, so there the pages stand still.
  var low = window.matchMedia('(max-height: 520px) and (orientation: landscape)');
  var one = function (s, el) { return (el || document).querySelector(s); };
  var all = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  // Decided on 18 November 2026: visitors get no switch for motion or for smooth scrolling, and both are on.
  // On the finished site they become two switches in the Studio. Until then a tester can see either one off by adding
  // ?motion=off or ?smooth=off to the address (the start page has links that do it). Nothing is remembered.
  var asked = { motionOff: false, smoothOff: false };
  try {
    var query = new URLSearchParams(window.location.search);
    asked.motionOff = query.get('motion') === 'off';
    asked.smoothOff = query.get('smooth') === 'off';
  } catch (e) { /* a very old browser: both simply stay on */ }
  // Earlier copies of this prototype remembered the tester's two switches. Forget them, or a page could stand still
  // for ever with no switch left to bring it back.
  try { localStorage.removeItem('detox-proto-still'); localStorage.removeItem('detox-proto-smooth'); } catch (e) { /* private window */ }

  var stillListeners = [], scrollListeners = [];
  var D = window.Detox = {
    still: false,
    fine: fine,
    one: one,
    all: all,
    clamp: function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    ease: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    onStill: function (fn) { stillListeners.push(fn); },
    // One scroll listener for the whole page; each part adds its own step to it.
    onScroll: function (fn) { scrollListeners.push(fn); },
    refresh: function () { requestTick(); },
    say: say
  };

  // A short message at the bottom of the screen.
  var toast = null, toastTimer = 0;
  function say(text) {
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 3800);
  }

  var ticking = false;
  function tick() {
    ticking = false;
    for (var i = 0; i < scrollListeners.length; i++) scrollListeners[i]();
  }
  function requestTick() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }

  // 1. Motion. It is on, unless the visitor's own device asks for less motion, the screen is a phone held sideways,
  //    or the tester's address says off. Without it every page is the same page standing still.
  function wantStill() { return asked.motionOff || reduce.matches || low.matches; }
  function setStill(on) {
    D.still = on;
    root.classList.toggle('still', on);
    root.classList.toggle('has-ptag', !on && fine.matches);
    for (var i = 0; i < stillListeners.length; i++) stillListeners[i](on);
    syncSmooth();
    requestTick();
  }

  // 2. Smooth wheel scrolling. It is on wherever there is a real pointer (laptops), and never where the pages stand
  //    still. Phones always keep their own scroll. If the small library cannot be fetched, the page scrolls the usual way.
  var lenis = null, lenisFrame = 0, lenisLoading = false;
  var LENIS = 'https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.min.js';
  function wantSmooth() { return !asked.smoothOff && !D.still && fine.matches; }
  function startLenis() {
    if (lenis || !wantSmooth() || !window.Lenis) return;
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    (function loop(time) { if (!lenis) return; lenis.raf(time); lenisFrame = requestAnimationFrame(loop); })(performance.now());
  }
  function syncSmooth() {
    if (!wantSmooth()) {
      if (lenis) { cancelAnimationFrame(lenisFrame); lenis.destroy(); lenis = null; }
      return;
    }
    if (lenis) return;
    if (window.Lenis) { startLenis(); return; }
    if (lenisLoading) return;
    lenisLoading = true;
    var s = document.createElement('script');
    s.src = LENIS;
    s.async = true;
    s.onload = function () { lenisLoading = false; startLenis(); };
    s.onerror = function () { lenisLoading = false; };
    document.head.appendChild(s);
  }

  // 3. Buttons that would call, message or send on the real site do nothing here, and say so.
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-inert]') : null;
    if (!el) return;
    e.preventDefault();
    say(el.getAttribute('data-inert') || 'In the prototype this button does nothing.');
  });

  // 3b. Links to a place on the same page. While a glide is still finishing, the browser's own jump would be undone
  //     by the glide's next step, so the glide's own engine is asked to go there: gliding when the place is near,
  //     at once when it is far (a long glide would fast-forward through the held scenes).
  document.addEventListener('click', function (e) {
    if (!lenis || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    var id = a ? a.getAttribute('href').slice(1) : '';
    var el = id ? document.getElementById(id) : null;
    if (!el) return;
    e.preventDefault();
    var far = Math.abs(el.getBoundingClientRect().top) > window.innerHeight * 2.5;
    lenis.scrollTo(el, { immediate: far || a.classList.contains('skip'), duration: 0.9 });
    // What the browser's own jump would also have done: the address shows the place, and the keyboard carries on from it.
    try { window.history.replaceState(null, '', '#' + id); } catch (err) { /* a page opened from a folder may refuse */ }
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });

  // 4. Slow reveal. A headline rises into place line by line and a photograph unveils, once.
  //    Only things below the first screen are armed, so the page's opening photograph and headline are simply there.
  function riseByLine(el) {
    var text = el.textContent;
    if (el.children.length || !text.trim()) { el.classList.add('in'); return; }
    var words = text.trim().split(/\s+/);
    el.textContent = '';
    var spans = words.map(function (w, i) {
      var s = document.createElement('span');
      s.textContent = w + (i < words.length - 1 ? ' ' : '');
      s.style.display = 'inline-block';
      s.style.whiteSpace = 'pre';
      el.appendChild(s);
      return s;
    });
    var lines = [], top = null;
    spans.forEach(function (s) {
      var t = s.offsetTop;
      if (top === null || Math.abs(t - top) > 2) { lines.push(''); top = t; }
      lines[lines.length - 1] += s.textContent;
    });
    el.textContent = '';
    el.removeAttribute('data-armed');
    lines.forEach(function (line, i) {
      var outer = document.createElement('span'), inner = document.createElement('span');
      outer.className = 'rise-line';
      inner.textContent = line;
      inner.style.animationDelay = (i * 90) + 'ms';
      outer.appendChild(inner);
      el.appendChild(outer);
    });
    // Afterwards the headline goes back to plain words, so it wraps freely again when the screen changes.
    setTimeout(function () { el.textContent = text; }, 450 + lines.length * 90 + 120);
  }
  function reveal(el) {
    if (D.still) { el.classList.add('in'); return; }
    if (el.getAttribute('data-reveal') === 'lines') riseByLine(el); else el.classList.add('in');
  }
  var revealEls = all('[data-reveal]');
  if (revealEls.length && 'IntersectionObserver' in window) {
    var vh = window.innerHeight;
    var watcher = new IntersectionObserver(function (items) {
      items.forEach(function (it) { if (it.isIntersecting) { watcher.unobserve(it.target); reveal(it.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
    revealEls.forEach(function (el) {
      if (el.getBoundingClientRect().top > vh * 0.95) { el.setAttribute('data-armed', ''); watcher.observe(el); }
    });
  }

  // 5. The contact bar. It appears after the first screen and steps aside while the price card
  //    or the enquiry form is itself on screen.
  var bar = one('#contactBar');
  if (bar) {
    var blockers = all('[data-bar-hide]');
    var seen = [];
    if ('IntersectionObserver' in window) {
      var barWatch = new IntersectionObserver(function (items) {
        items.forEach(function (it) { seen[blockers.indexOf(it.target)] = it.isIntersecting; });
        placeBar();
      }, { threshold: 0.15 });
      blockers.forEach(function (b) { barWatch.observe(b); });
    }
    var placeBar = function () {
      var on = window.scrollY > window.innerHeight * 0.8 && !seen.some(Boolean);
      if (bar.classList.contains('on') !== on) { bar.classList.toggle('on', on); bar.setAttribute('aria-hidden', on ? 'false' : 'true'); if ('inert' in bar) bar.inert = !on; }
    };
    D.onScroll(placeBar);
  }

  // 6. The pointer's label: one element, eased towards the pointer, tilting with its speed. Only with a real pointer.
  var ptag = one('#ptag');
  var P = { x: 0, y: 0, tx: 0, ty: 0, rot: 0, on: false, raf: 0, down: false, cx: -1, cy: -1 };
  D.pointer = P;
  if (ptag) {
    var ptext = one('span', ptag);
    var tagLoop = function () {
      P.raf = 0;
      var dx = P.tx - P.x, dy = P.ty - P.y;
      P.x += dx * 0.14;
      P.y += dy * 0.14;
      P.rot += (Math.max(-7, Math.min(7, dx * 0.06)) - P.rot) * 0.2;
      ptag.style.transform = 'translate3d(' + P.x.toFixed(1) + 'px,' + P.y.toFixed(1) + 'px,0) rotate(' + P.rot.toFixed(2) + 'deg)';
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3 || Math.abs(P.rot) > 0.05) P.raf = requestAnimationFrame(tagLoop);
    };
    D.placeTag = function (target) {
      var host = target && target.closest ? target.closest('[data-label]') : null;
      if (host && !D.still && fine.matches) {
        if (!P.on) { P.x = P.tx; P.y = P.ty; }
        P.on = true;
        var word = P.down ? 'Drag' : host.getAttribute('data-label');
        if (ptext.textContent !== word) ptext.textContent = word;
        ptag.classList.add('on');
      } else {
        P.on = false;
        ptag.classList.remove('on');
      }
      if (!P.raf) P.raf = requestAnimationFrame(tagLoop);
    };
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      P.cx = e.clientX; P.cy = e.clientY;
      P.tx = e.clientX + 14; P.ty = e.clientY + 16;
      D.placeTag(e.target);
    }, { passive: true });
    root.addEventListener('mouseleave', function () { P.cx = -1; D.placeTag(null); });
    var lastY = window.scrollY;
    D.onScroll(function () {
      var y = window.scrollY;
      if (P.cx >= 0 && y !== lastY) D.placeTag(document.elementFromPoint(P.cx, P.cy));
      lastY = y;
    });
  } else {
    D.placeTag = function () {};
  }

  // 7. For the tester only. When the address asks for motion or smooth scrolling off, the dark strip says so, offers
  //    the way back, and the links to the prototype's other pages carry the same wish along.
  function testNote() {
    if (!asked.motionOff && !asked.smoothOff) return;
    var wish = (asked.motionOff ? ['motion=off'] : []).concat(asked.smoothOff ? ['smooth=off'] : []).join('&');
    all('a[href]').forEach(function (a) {
      var m = /^([a-z-]+\.html)(#.*)?$/.exec(a.getAttribute('href'));
      if (m) a.setAttribute('href', m[1] + '?' + wish + (m[2] || ''));
    });
    var strip = one('.proto .wrap');
    if (!strip) return;
    var note = document.createElement('span'), back = document.createElement('a');
    note.className = 'sw';
    note.appendChild(document.createTextNode(asked.motionOff ? 'Motion is off on this visit.' : 'Smooth scrolling is off on this visit.'));
    back.href = window.location.pathname.split('/').pop() || 'index.html';
    back.textContent = 'Back to normal';
    note.appendChild(back);
    strip.appendChild(note);
  }

  // Start once every page script has added its parts. The device can change its mind while the page is open
  // (the phone is turned, the setting for less motion is switched, a mouse is plugged in), and the page follows.
  var follow = function () { setStill(wantStill()); };
  [reduce, low, fine].forEach(function (m) { if (m.addEventListener) m.addEventListener('change', follow); else m.addListener(follow); });
  document.addEventListener('DOMContentLoaded', function () {
    testNote();
    setStill(wantStill());
    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', requestTick);
    window.addEventListener('load', requestTick);
    requestTick();
  });
})();
