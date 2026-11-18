// Detox prototype: the homepage's three moving parts.
// The sentence that inks in, the photographs that change, and the trips row that runs to its end.
// All three were tried at phone size with real finger drags before this page was built.
(function () {
  var D = window.Detox;
  var clamp = D.clamp, lerp = D.lerp, ease = D.ease;
  var narrow = window.matchMedia('(max-width: 900px)');
  var phone = window.matchMedia('(max-width: 760px)');

  // 1. Ink-in: split the sentence into words once; they fill while it crosses the middle of the screen.
  var ink = document.getElementById('ink');
  var spans = [];
  if (ink) {
    var inkP = ink.querySelector('p');
    var words = inkP.textContent.trim().split(/\s+/);
    inkP.textContent = '';
    spans = words.map(function (w, i) {
      var s = document.createElement('span');
      s.className = 'w';
      s.textContent = w + (i < words.length - 1 ? ' ' : '');
      inkP.appendChild(s);
      return s;
    });
  }

  // 2. The photo scene.
  var album = document.getElementById('album');
  var stage = album && album.querySelector('.stage');
  var big = album && album.querySelector('.big');
  var pics = album ? D.all('.pic', album) : [];
  var caps = album ? D.all('figcaption', album) : [];
  var count = document.getElementById('albumCount');
  var shownCount = '';

  // 3. The trips row.
  var trips = document.getElementById('trips');
  var tripscene = document.getElementById('tripscene');
  var tstage = tripscene && tripscene.querySelector('.tstage');
  var base = 0, busyUntil = 0, ownLeft = trips ? trips.scrollLeft : 0;
  var drag = null;
  var P = D.pointer;

  function near(r, vh) { return r.bottom > -200 && r.top < vh + 200; }
  function busy() { busyUntil = performance.now() + 1400; }
  // How far the page's own movement has carried the row: the scene holds, and the hold takes the row
  // from its first card to its last. It depends only on where the scene sits on the screen.
  function slideNow() {
    var sc = tripscene.getBoundingClientRect();
    return clamp(-sc.top / Math.max(1, sc.height - tstage.offsetHeight)) * (trips.scrollWidth - trips.clientWidth);
  }
  // The hold is as long as the row needs: on a laptop 1 px of scroll moves the row 1.5 px, on a phone 1.4 px.
  function layoutTrips() {
    if (!tripscene) return;
    tripscene.style.setProperty('--hold', Math.round((trips.scrollWidth - trips.clientWidth) / (phone.matches ? 1.4 : 1.5)) + 'px');
  }

  D.onScroll(function () {
    if (D.still) return;
    var vh = window.innerHeight;

    if (ink) {
      var r = ink.getBoundingClientRect();
      if (near(r, vh)) {
        var q = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.28));
        spans.forEach(function (s, i) { s.style.opacity = (0.16 + 0.84 * clamp(q * spans.length * 1.08 - i)).toFixed(3); });
      }
    }

    // One number, how far through the hold we are, drives the whole photo scene.
    if (album) {
      var a = album.getBoundingClientRect();
      if (near(a, vh)) {
        var sh = stage.offsetHeight;
        var p = clamp(-a.top / Math.max(1, a.height - sh));
        var n = pics.length, A = 1, B = 0.9, C = 0.35, u = p * (A + (n - 1) * B + C);
        var fw = pics[0].offsetWidth, fh = pics[0].offsetHeight;
        var small = narrow.matches ? 0.2 : 0.22, gap = narrow.matches ? 6 : 16;
        var wx = fw / 2 + gap + (fw * small) / 2, wy = fh / 2 - (fh * small) / 2;
        var h = ease(clamp(u / A));
        big.style.transform = 'translate3d(0,' + lerp(sh * (narrow.matches ? 0.16 : 0.2), sh * 0.045, h).toFixed(1) + 'px,0) scale(' + lerp(1, narrow.matches ? 0.42 : 0.3, h).toFixed(4) + ')';
        var active = 0;
        for (var i = 0; i < n; i++) {
          var start = i === 0 ? 0.12 : A + (i - 1) * B;
          var len = i === 0 ? A - 0.12 : B;
          var inn = ease(clamp((u - start) / len));
          var out = i < n - 1 ? ease(clamp((u - (A + i * B)) / B)) : 0;
          var fx = i === 0 ? 0 : wx, fy = i === 0 ? fh * 0.66 : wy, fs = i === 0 ? 0.14 : small;
          var x = lerp(lerp(fx, 0, inn), -wx, out);
          var yy = lerp(lerp(fy, 0, inn), -wy, out);
          var sc = lerp(lerp(fs, 1, inn), small, out);
          // A waiting photograph appears once the one before it is nearly in place. A finished one fades as the next but one arrives.
          var shown = i === 0 ? clamp((u - 0.05) / 0.2) : clamp((u - (start - B * 0.45)) / (B * 0.3));
          var fade = i < n - 2 ? 1 - clamp((u - (A + (i + 1) * B)) / (B * 0.5)) : 1;
          pics[i].style.opacity = (shown * fade).toFixed(3);
          pics[i].style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + yy.toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')';
          pics[i].style.zIndex = out >= 0.5 ? 1 : inn > 0 ? 3 : 2;
          caps[i].style.opacity = (clamp((inn - 0.72) / 0.28) * (1 - clamp(out / 0.3))).toFixed(3);
          if (inn > 0.5) active = i;
        }
        var counter = '0' + (active + 1) + ' / 0' + n;
        if (counter !== shownCount) { shownCount = counter; count.textContent = counter; }
      }
    }

    // The trips row: `base` is where the visitor's own hand last left it.
    if (trips) {
      var slide = slideNow();
      if (performance.now() > busyUntil) {
        var want = Math.max(0, Math.round(base + slide));
        if (Math.abs(trips.scrollLeft - want) >= 1) { trips.scrollLeft = want; ownLeft = trips.scrollLeft; }
      } else {
        base = trips.scrollLeft - slide;
      }
    }
  });

  if (trips) {
    // The row tells us when someone else moved it (a swipe, a drag, the arrows): then the script lets go for a moment
    // and remembers the new place. A thumb resting on a card while the page scrolls is not a swipe, so touches alone never pause it.
    trips.addEventListener('scroll', function () {
      if (Math.abs(trips.scrollLeft - ownLeft) > 2) { busy(); if (!D.still) base = trips.scrollLeft - slideNow(); }
      ownLeft = trips.scrollLeft;
    }, { passive: true });
    trips.addEventListener('keydown', busy);
    // A link or a photograph must not be picked up and carried off by the mouse: that would end our own drag at once.
    trips.addEventListener('dragstart', function (e) { e.preventDefault(); });
    trips.addEventListener('wheel', function (e) { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) busy(); }, { passive: true });
    trips.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      busy();
      drag = { x: e.clientX, left: trips.scrollLeft, moved: false };
      P.down = true;
      D.placeTag(e.target);
    });
    document.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerType === 'touch') return;
      var dx = e.clientX - drag.x;
      if (Math.abs(dx) > 5 && !drag.moved) { drag.moved = true; trips.classList.add('dragging'); }
      if (drag.moved) trips.scrollLeft = drag.left - dx;
    }, { passive: true });
    // A drag with the mouse must never open a trip: the click that follows a drag is swallowed.
    var lastDragged = false;
    window.addEventListener('pointerup', function (e) {
      if (!drag) return;
      lastDragged = drag.moved;
      drag = null;
      P.down = false;
      trips.classList.remove('dragging');
      busy();
      D.placeTag(e.target);
    });
    trips.addEventListener('click', function (e) { if (lastDragged) { e.preventDefault(); e.stopPropagation(); } lastDragged = false; }, true);
    var by = function (dir) {
      var card = trips.querySelector('.trip');
      busy();
      trips.scrollBy({ left: dir * (card.offsetWidth + 24), behavior: D.still ? 'auto' : 'smooth' });
    };
    document.getElementById('tripsPrev').addEventListener('click', function () { by(-1); });
    document.getElementById('tripsNext').addEventListener('click', function () { by(1); });
  }

  function settle() {
    layoutTrips();
    if (trips && !D.still) base = trips.scrollLeft - slideNow();
  }
  D.onStill(function (on) {
    if (on) {
      spans.forEach(function (s) { s.style.opacity = ''; });
      pics.forEach(function (pc) { pc.style.opacity = ''; pc.style.transform = ''; pc.style.zIndex = ''; });
      caps.forEach(function (c) { c.style.opacity = ''; });
      if (big) big.style.transform = '';
    }
    settle();
  });
  window.addEventListener('resize', settle);
  window.addEventListener('load', function () { settle(); D.refresh(); });
  settle();
})();
