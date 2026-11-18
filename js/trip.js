// Detox prototype: the trip page's own small parts.
// The hotel level changes the price, the steppers count, and the two-step enquiry sends nothing anywhere.
(function () {
  var D = window.Detox;
  var rupee = String.fromCharCode(8377);

  function choose(group, chip) {
    D.all('.chip', group).forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
  }
  // Groups where exactly one chip is chosen.
  D.all('[data-single]').forEach(function (group) {
    group.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (chip && group.contains(chip)) choose(group, chip);
    });
  });

  // The hotel level, chosen on the price card or in the enquiry: both follow, and so does every price on the page.
  var tiers = D.one('#tiers'), level = D.one('#enq-level'), stay = D.one('#stay');
  function setTier(i) {
    var chip = D.all('.chip', tiers)[i];
    if (!chip) return;
    choose(tiers, chip);
    if (level) choose(level, D.all('.chip', level)[i]);
    var price = rupee + Number(chip.getAttribute('data-price')).toLocaleString('en-IN');
    D.all('.js-price').forEach(function (el) { el.textContent = price; });
    if (stay) stay.textContent = chip.getAttribute('data-stay');
  }
  [tiers, level].forEach(function (group) {
    if (!group) return;
    group.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (chip && group.contains(chip)) setTier(D.all('.chip', group).indexOf(chip));
    });
  });

  // Steppers: a number between two limits; the button that would pass a limit is switched off.
  D.all('.stepper').forEach(function (st) {
    var out = D.one('output', st), btns = D.all('[data-step]', st);
    var min = Number(st.getAttribute('data-min') || 0), max = Number(st.getAttribute('data-max') || 20);
    function set(v) {
      v = Math.max(min, Math.min(max, v));
      out.textContent = String(v);
      btns.forEach(function (b) { b.disabled = Number(b.getAttribute('data-step')) < 0 ? v <= min : v >= max; });
    }
    st.addEventListener('click', function (e) {
      var b = e.target.closest('[data-step]');
      if (b && !b.disabled) set(Number(out.textContent) + Number(b.getAttribute('data-step')));
    });
    set(Number(out.textContent));
  });

  // The enquiry: two steps and a last screen. Nothing leaves the page.
  var form = D.one('#enquiry');
  if (!form) return;
  var steps = [D.one('#step1'), D.one('#step2'), D.one('#sent')];
  function show(el, focusId) {
    steps.forEach(function (s) { s.hidden = s !== el; });
    var f = focusId && D.one(focusId);
    if (f) f.focus();
    D.refresh();
  }
  var name = D.one('#enq-name'), phone = D.one('#enq-phone');
  var nameHelp = D.one('#enq-name-help'), phoneHelp = D.one('#enq-phone-help');
  var phoneHint = phoneHelp.textContent;
  function mark(input, help, problem, usual) {
    input.classList.toggle('is-error', !!problem);
    if (problem) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    help.classList.toggle('is-error', !!problem);
    help.textContent = problem || usual || '';
    help.hidden = !help.textContent;
  }
  function checkName() { return name.value.trim().length > 1 ? '' : 'Please add your name.'; }
  function checkPhone() { return phone.value.replace(/\D/g, '').length >= 10 ? '' : 'Please add a 10-digit mobile number.'; }
  name.addEventListener('input', function () { if (name.classList.contains('is-error')) mark(name, nameHelp, checkName()); });
  phone.addEventListener('input', function () { if (phone.classList.contains('is-error')) mark(phone, phoneHelp, checkPhone(), phoneHint); });

  D.one('#to-step2').addEventListener('click', function () { show(steps[1], '#step2-cap'); });
  D.one('#to-step1').addEventListener('click', function () { show(steps[0], '#step1-cap'); });
  D.one('#again').addEventListener('click', function () {
    name.value = '';
    phone.value = '';
    show(steps[0], '#step1-cap');
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var badName = checkName(), badPhone = checkPhone();
    mark(name, nameHelp, badName);
    mark(phone, phoneHelp, badPhone, phoneHint);
    if (badName) { name.focus(); return; }
    if (badPhone) { phone.focus(); return; }
    show(steps[2], '#sent-cap');
  });
})();
