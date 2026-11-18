// Detox prototype: the route that draws itself.
// The map's shapes, legs and labels come from the website's own map code (see data/route-*.js).
// Two hands are on the line. Until the days are reached it plays the whole trip on a loop, as the site does
// today, with pause and play. Once the days are being read the scroll takes over: the played line steps back
// to a dotted trace and each day draws its own part.
(function () {
  var D = window.Detox;
  var fig = document.getElementById('routeMap');
  var data = window.DetoxRouteModel;
  if (!fig || !data) return;
  var box = document.getElementById('rmBox');
  var toggle = document.getElementById('rmToggle'), icon = document.getElementById('rmIcon');
  var dayN = document.getElementById('rmDay'), dayT = document.getElementById('rmTitle');
  var route = document.getElementById('route');
  var days = D.all('.day', route);
  var narrow = window.matchMedia('(max-width: 1023px)');
  var clamp = D.clamp;

  // Timing of the loop, as on the live site. SPEED is in map units a second.
  var SPEED = 210, DWELL = 0.35, HOLD = 2.2, FADE = 0.6, STAY = 1.1;
  var M = null, autoG = null, marker = null, legsAuto = [], legsScroll = [], lens = [], timing = [], dayLegs = [], dayLen = [];
  var playEnd = 0, playTotal = 0, stickTop = 0, shown = '';
  // k: 1 while the loop leads, 0 once the scroll leads.
  var R = { k: 1, auto: [], scroll: [], fade: 1, at: 0, t0: 0, raf: 0, playing: false, userPaused: false, onScreen: false };

  function esc(s) { return String(s).split('&').join('&amp;').split('<').join('&lt;').split('"').join('&quot;'); }

  function build() {
    M = narrow.matches ? data.rider : data.wide;
    var L = M.labelSize, h = '';
    h += '<svg viewBox="0 0 ' + M.width + ' ' + M.height + '" role="img" aria-label="' + esc(M.ariaLabel) + '">';
    h += '<rect class="rm-bg" width="' + M.width + '" height="' + M.height + '"/>';
    if (M.valley) h += '<path class="rm-valley" d="' + M.valley + '"/>';
    M.lakes.forEach(function (d) { h += '<path class="rm-lake" d="' + d + '"/>'; });
    M.rivers.forEach(function (d) { h += '<path class="rm-river" d="' + d + '"/>'; });
    M.ranges.forEach(function (r) { h += '<text class="rm-range" x="' + r.x + '" y="' + r.y + '" text-anchor="middle" font-size="' + (L * 0.8) + '">' + esc(r.name.toUpperCase()) + '</text>'; });
    h += '<g class="rm-north" transform="translate(' + (M.width - 26) + ',28)" aria-hidden="true"><path d="M0,-12 L5,2 L0,-1 L-5,2 Z"/><text x="0" y="16" text-anchor="middle" font-size="' + (L * 0.8) + '">N</text></g>';
    h += '<g aria-hidden="true">' + M.legs.map(function (l) { return '<path class="rm-ghost" d="' + l.d + '"/>'; }).join('') + '</g>';
    h += '<g id="rmAuto" aria-hidden="true">' + M.legs.map(function (l) { return '<path class="rm-leg" d="' + l.d + '"/>'; }).join('') + '</g>';
    h += '<g id="rmScroll" aria-hidden="true">' + M.legs.map(function (l) { return '<path class="rm-leg" d="' + l.d + '"/>'; }).join('') + '</g>';
    h += '<g aria-hidden="true">' + M.stops.map(function (s) { return '<circle class="rm-stop' + (s.night ? ' rm-night' : '') + '" cx="' + s.x + '" cy="' + s.y + '" r="' + s.r + '"/>'; }).join('') + '</g>';
    h += '<g aria-hidden="true">' + M.labels.map(function (l) { return '<text class="rm-label' + (l.minor ? ' rm-minor' : '') + '" x="' + l.x + '" y="' + l.y + '" text-anchor="' + l.anchor + '" font-size="' + L + '">' + esc(l.text.toUpperCase()) + '</text>'; }).join('');
    h += M.badges.map(function (b) { return '<g class="rm-badge"><rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '"/><text x="' + (b.x + b.w / 2) + '" y="' + (b.y + b.h / 2 + L * 0.28) + '" text-anchor="middle" font-size="' + (L * 0.78) + '">' + esc(b.text) + '</text></g>'; }).join('') + '</g>';
    h += '<g class="rm-marker" id="rmMarker" aria-hidden="true"><circle class="rm-ring" r="9"/><circle class="rm-core" r="5.5"/></g>';
    h += '</svg>';
    box.querySelector('.rmap-svg').innerHTML = h;

    autoG = document.getElementById('rmAuto');
    marker = document.getElementById('rmMarker');
    legsAuto = D.all('path', autoG);
    legsScroll = D.all('path', document.getElementById('rmScroll'));
    lens = legsScroll.map(function (p) { return p.getTotalLength(); });
    legsAuto.concat(legsScroll).forEach(function (p, i) { var len = lens[i % lens.length]; p.style.strokeDasharray = len + ' ' + len; });

    // The loop's clock: each leg takes as long as its length asks, with a short rest at the end of each day.
    timing = M.legs.map(function () { return { start: 0, dur: 1 }; });
    var t = 0;
    M.steps.forEach(function (s, i) {
      var dur = s.kind === 'move' ? (M.legs[s.leg].offBoth ? 0.9 : Math.max(0.5, Math.min(2.4, lens[s.leg] / SPEED))) : STAY;
      if (s.kind === 'move') timing[s.leg] = { start: t, dur: dur };
      t += dur;
      var next = M.steps[i + 1];
      if (!next || next.day !== s.day) t += DWELL;
    });
    playEnd = t;
    playTotal = t + HOLD + FADE;
    dayLegs = data.days.map(function () { return []; });
    M.legs.forEach(function (l, i) { dayLegs[l.day].push(i); });
    dayLen = dayLegs.map(function (list) { return list.reduce(function (n, i) { return n + lens[i]; }, 0); });
    R.auto = M.legs.map(function () { return 1; });
    R.scroll = data.days.map(function () { return 0; });
    R.at = playEnd;
    R.fade = 1;
    shown = '';
  }

  function playAt(t) {
    for (var i = 0; i < timing.length; i++) R.auto[i] = 0.5 - Math.cos(Math.PI * clamp((t - timing[i].start) / timing[i].dur)) / 2;
    R.fade = t > playEnd + HOLD ? 1 - clamp((t - playEnd - HOLD) / FADE) : 1;
    R.at = t;
  }
  // A day's progress, spread over that day's legs in the order they are travelled.
  function legsOf(dayProgress) {
    var out = M.legs.map(function () { return 0; });
    dayLegs.forEach(function (list, d) {
      var covered = dayProgress[d] * dayLen[d], before = 0;
      list.forEach(function (i) { out[i] = clamp((covered - before) / lens[i]); before += lens[i]; });
    });
    return out;
  }
  function paint() {
    var loopLeads = R.k > 0.5;
    var scrollLegs = D.still ? M.legs.map(function () { return 1; }) : legsOf(R.scroll);
    var prog = loopLeads && !D.still ? R.auto : scrollLegs;
    autoG.style.opacity = D.still ? '0' : (R.k * R.fade).toFixed(3);
    legsAuto.forEach(function (p, i) { p.style.strokeDashoffset = (lens[i] * (1 - R.auto[i])).toFixed(2); p.style.visibility = R.auto[i] > 0.001 ? 'visible' : 'hidden'; });
    legsScroll.forEach(function (p, i) { p.style.strokeDashoffset = (lens[i] * (1 - scrollLegs[i])).toFixed(2); p.style.visibility = scrollLegs[i] > 0.001 ? 'visible' : 'hidden'; });
    // The marker rides the tip of whichever line leads, and ducks out while they change places.
    var tip = 0;
    for (var i = 0; i < prog.length; i++) if (prog[i] > 0.001) tip = i;
    var pt = legsScroll[tip].getPointAtLength(lens[tip] * prog[tip]);
    marker.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ',' + pt.y.toFixed(1) + ')');
    marker.style.opacity = (Math.abs(2 * R.k - 1) * (loopLeads ? R.fade : 1)).toFixed(3);
    var day = M.legs[tip].day;
    days.forEach(function (el, d) { el.classList.toggle('on', !D.still && !loopLeads && d === day); });
    toggle.classList.toggle('off', !loopLeads || D.still);
    var title = D.still ? ['All ' + data.days.length + ' days', data.trip]
      : loopLeads && R.at >= playEnd ? ['The whole trip', data.days.length + ' days']
        : ['Day ' + data.days[day].day + ' of ' + data.days.length, data.days[day].title];
    if (title[0] + title[1] !== shown) { shown = title[0] + title[1]; dayN.textContent = title[0]; dayT.textContent = title[1]; }
  }
  function setIcon() {
    icon.setAttribute('d', R.playing ? 'M3 2h3v10H3zM8 2h3v10H8z' : 'M4 2l8 5-8 5z');
    toggle.setAttribute('aria-label', R.playing ? 'Pause the route' : 'Play the route');
  }
  function tick(now) {
    R.raf = 0;
    if (!R.playing) return;
    playAt(((now - R.t0) / 1000) % playTotal);
    paint();
    R.raf = requestAnimationFrame(tick);
  }
  function playFrom(t) {
    R.playing = true;
    R.t0 = performance.now() - t * 1000;
    if (!R.raf) R.raf = requestAnimationFrame(tick);
    setIcon();
  }
  function pausePlay() {
    if (!R.playing) return;
    R.playing = false;
    if (R.raf) cancelAnimationFrame(R.raf);
    R.raf = 0;
    setIcon();
  }
  // The loop runs only while it leads, the map is on screen, the tab is in front and nobody pressed pause.
  function syncPlay() {
    var should = !D.still && !R.userPaused && R.k > 0.02 && R.onScreen && !document.hidden;
    if (should && !R.playing) playFrom(R.at >= playEnd ? 0 : R.at);
    if (!should && R.playing) pausePlay();
  }
  // What rides: on a phone the map itself, on a laptop the column that holds the map and its key.
  function measure() { stickTop = parseFloat(window.getComputedStyle(narrow.matches ? fig : fig.parentNode).top) || 0; }

  D.onScroll(function () {
    if (D.still || !M) return;
    var vh = window.innerHeight, rr = route.getBoundingClientRect();
    if (rr.bottom < -200 || rr.top > vh + 200) return;
    var s = (stickTop - rr.top) / vh; // screens scrolled since the map came to rest
    R.k = 1 - clamp((s - 0.05) / 0.12);
    // On a phone the map itself covers the top third, so a day starts and finishes its line a little lower on the screen.
    var from = narrow.matches ? 0.82 : 0.68;
    days.forEach(function (el, i) {
      var v = i === 0 ? clamp((s - 0.17) / 0.24) : clamp((vh * from - el.getBoundingClientRect().top) / (vh * 0.42));
      R.scroll[i] = i === 0 ? v : Math.min(v, clamp((R.scroll[i - 1] - 0.85) / 0.15));
    });
    syncPlay();
    paint();
  });

  toggle.addEventListener('click', function () {
    if (R.playing) { R.userPaused = true; pausePlay(); }
    else { R.userPaused = false; playFrom(R.at >= playEnd ? 0 : R.at); }
    paint();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (items) { R.onScreen = items[0].isIntersecting; syncPlay(); }, { threshold: 0.35 }).observe(box);
  } else {
    R.onScreen = true;
  }
  document.addEventListener('visibilitychange', syncPlay);
  D.onStill(function (on) {
    if (on) pausePlay();
    measure();
    paint();
    if (!on) syncPlay();
  });
  function rebuild() { pausePlay(); build(); measure(); paint(); D.refresh(); }
  if (narrow.addEventListener) narrow.addEventListener('change', rebuild); else narrow.addListener(rebuild);
  window.addEventListener('resize', measure);
  build();
  measure();
  paint();
})();
