// Detox prototype: what every page shares.
// The test strip's two switches (motion, smooth scrolling), the slow reveal, the contact bar that docks,
// the pointer's label, and buttons that do nothing here on purpose.
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var one = function (s, el) { return (el || document).querySelector(s); };
  var all = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function keep(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window: carry on without it */ } }
  function kept(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

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

  // 1. Motion on or off. With it off, every page is the same page standing still.
  var stillBtn = one('#stillBtn');
  function setStill(on, remember) {
    D.still = on;
    root.classList.toggle('still', on);
    root.classList.toggle('has-ptag', !on && fine.matches);
    if (stillBtn) { stillBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); stillBtn.textContent = on ? 'Motion is off' : 'Motion is on'; }
    for (var i = 0; i < stillListeners.length; i++) stillListeners[i](on);
    if (remember) keep('detox-proto-still', on ? '1' : '0');
    if (on && lenis) setSmooth(false, false);
    requestTick();
  }
  if (stillBtn) stillBtn.addEventListener('click', function () { setStill(!D.still, true); });

  // 2. Smooth wheel scrolling, laptops only, to be judged with the switch. Phones always keep their own scroll.
  var smoothBtn = one('#smoothBtn');
  var lenis = null, lenisFrame = 0, lenisLoading = false;
  var LENIS = 'https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.min.js';
  function runLenis() {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    (function loop(time) { if (!lenis) return; lenis.raf(time); lenisFrame = requestAnimationFrame(loop); })(performance.now());
  }
  function setSmooth(on, remember) {
    if (smoothBtn) { smoothBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); smoothBtn.textContent = on ? 'Smooth scrolling is on' : 'Smooth scrolling is off'; }
    if (remember) keep('detox-proto-smooth', on ? '1' : '0');
    if (!on) {
      if (lenis) { cancelAnimationFrame(lenisFrame); lenis.destroy(); lenis = null; }
      return;
    }
    if (!fine.matches || D.still || lenis) return;
    if (window.Lenis) { runLenis(); return; }
    if (lenisLoading) return;
    lenisLoading = true;
    var s = document.createElement('script');
    s.src = LENIS;
    s.onload = function () { lenisLoading = false; if (smoothBtn && smoothBtn.getAttribute('aria-pressed') === 'true' && !D.still) runLenis(); };
    s.onerror = function () { lenisLoading = false; setSmooth(false, false); say('Smooth scrolling could not load. The page scrolls the usual way.'); };
    document.head.appendChild(s);
  }
  if (smoothBtn) smoothBtn.addEventListener('click', function () {
    if (D.still) { say('Switch motion on first.'); return; }
    setSmooth(smoothBtn.getAttribute('aria-pressed') !== 'true', true);
  });

  // 3. Buttons that would call, message or send on the real site do nothing here, and say so.
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-inert]') : null;
    if (!el) return;
    e.preventDefault();
    say(el.getAttribute('data-inert') || 'In the prototype this button does nothing.');
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

  // Start once every page script has added its parts.
  // A phone held sideways is too low for the held scenes, so there the pages stand still.
  var low = window.matchMedia('(max-height: 520px) and (orientation: landscape)');
  function wantStill() {
    var choice = kept('detox-proto-still');
    return low.matches || (choice === null ? reduce.matches : choice === '1');
  }
  var onLow = function () { setStill(wantStill(), false); };
  if (low.addEventListener) low.addEventListener('change', onLow); else low.addListener(onLow);
  document.addEventListener('DOMContentLoaded', function () {
    setStill(wantStill(), false);
    if (kept('detox-proto-smooth') === '1') setSmooth(true, false);
    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', requestTick);
    window.addEventListener('load', requestTick);
    requestTick();
  });
  // Laptop shortcuts for the tester: M for motion, S for smooth scrolling.
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.key === 'm' || e.key === 'M') { if (stillBtn) stillBtn.click(); }
    if (e.key === 's' || e.key === 'S') { if (smoothBtn) smoothBtn.click(); }
  });
})();
