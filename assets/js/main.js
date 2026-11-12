/* Lumen — общий скрипт сайта. Без зависимостей, подключается с defer. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Год в подвале ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Прозрачная шапка поверх hero ---------- */
  const header = $('.site-header');
  const toggle = $('.nav-toggle');
  const nav = $('#site-nav');
  const hasHero = document.body.classList.contains('has-hero');
  const syncHeader = () => {
    if (!header || !hasHero) return;
    const menuOpen = nav?.classList.contains('is-open');
    header.classList.toggle('is-transparent', window.scrollY < 40 && !menuOpen);
  };
  if (hasHero) {
    syncHeader();
    window.addEventListener('scroll', syncHeader, { passive: true });
  }

  /* ---------- Мобильное меню ---------- */
  if (toggle && nav) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      nav.classList.toggle('is-open', open);
      syncHeader();
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    matchMedia('(min-width: 881px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
  }

  /* ---------- Плавное появление блоков ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Фильтр галереи ---------- */
  const filters = $('[data-filters]');
  if (filters) {
    filters.hidden = false;
    const items = $$('.gallery-item[data-category]');
    const status = $('[data-gallery-status]');
    const buttons = $$('[data-filter]', filters);

    const apply = (cat, updateUrl) => {
      let shown = 0;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === cat)));
      items.forEach((item) => {
        const visible = cat === 'all' || item.dataset.category === cat;
        item.hidden = !visible;
        if (visible) { shown += 1; item.classList.add('is-visible'); }
      });
      if (status) status.textContent = `Showing ${shown} photo${shown === 1 ? '' : 's'}`;
      if (updateUrl) history.replaceState(null, '', cat === 'all' ? location.pathname : `#${cat}`);
    };

    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (btn) apply(btn.dataset.filter, true);
    });

    const initial = decodeURIComponent(location.hash.slice(1));
    if (initial && buttons.some((b) => b.dataset.filter === initial)) apply(initial, false);
  }

  /* ---------- Лайтбокс ---------- */
  const galleries = $$('[data-gallery]');
  if (galleries.length && typeof HTMLDialogElement === 'function') {
    const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
    const dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', 'Photo viewer');
    dlg.innerHTML = `
      <div class="lb-top">
        <span data-lb-count></span>
        <button type="button" class="lb-btn" data-lb-close aria-label="Close">${svg('M6 6l12 12M18 6L6 18')}</button>
      </div>
      <div class="lb-stage" data-lb-stage>
        <button type="button" class="lb-btn lb-prev" data-lb-prev aria-label="Previous photo">${svg('M15 18l-6-6 6-6')}</button>
        <img data-lb-img alt="" decoding="async">
        <button type="button" class="lb-btn lb-next" data-lb-next aria-label="Next photo">${svg('M9 18l6-6-6-6')}</button>
      </div>
      <p class="lb-caption" data-lb-caption></p>`;
    document.body.append(dlg);

    const img = $('[data-lb-img]', dlg);
    const caption = $('[data-lb-caption]', dlg);
    const count = $('[data-lb-count]', dlg);
    const prevBtn = $('[data-lb-prev]', dlg);
    const nextBtn = $('[data-lb-next]', dlg);
    let list = [];
    let index = 0;
    let opener = null;

    const fullSrc = (a) => a.dataset.full || a.href;
    const preload = (a) => { if (a) { const p = new Image(); p.src = fullSrc(a); } };

    const show = (i) => {
      // Направление листания для анимации: 0 — открытие, ±1 — влево/вправо.
      const dir = img.getAttribute('src') ? Math.sign(i - index) : 0;
      index = (i + list.length) % list.length;
      if (!reducedMotion && img.animate) {
        img.animate(
          [{ opacity: 0, transform: dir ? `translateX(${dir * 40}px)` : 'scale(.96)' }, { opacity: 1, transform: 'none' }],
          { duration: 340, easing: 'cubic-bezier(.2, .7, .2, 1)' },
        );
      }
      const link = list[index];
      const thumb = $('img', link);
      // Сначала мгновенно показываем превью, затем подменяем на большое фото.
      img.src = thumb.currentSrc || thumb.src;
      img.alt = thumb.alt;
      const full = new Image();
      const swap = () => { if (list[index] === link) img.src = full.src; };
      full.addEventListener('load', swap, { once: true });
      full.src = fullSrc(link);
      if (full.complete && full.naturalWidth) swap();

      caption.textContent = link.closest('figure')?.querySelector('figcaption')?.textContent || thumb.alt;
      count.textContent = `${index + 1} / ${list.length}`;
      preload(list[(index + 1) % list.length]);
      preload(list[(index - 1 + list.length) % list.length]);
    };

    const open = (gallery, link) => {
      list = $$('.gallery-item:not([hidden]) a', gallery);
      opener = link;
      const single = list.length < 2;
      prevBtn.hidden = single;
      nextBtn.hidden = single;
      document.documentElement.style.overflow = 'hidden';
      dlg.showModal();
      show(list.indexOf(link));
    };

    galleries.forEach((gallery) => {
      gallery.addEventListener('click', (e) => {
        const link = e.target.closest('.gallery-item a');
        if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        open(gallery, link);
      });
    });

    // Очистка вызывается явно и дублируется в событии close (оно асинхронное).
    const cleanup = () => {
      if (!opener) return;
      document.documentElement.style.overflow = '';
      img.removeAttribute('src');
      const target = opener;
      opener = null;
      target.focus({ preventScroll: true });
    };
    const close = () => { if (dlg.open) dlg.close(); cleanup(); };

    prevBtn.addEventListener('click', () => show(index - 1));
    nextBtn.addEventListener('click', () => show(index + 1));
    $('[data-lb-close]', dlg).addEventListener('click', close);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); }); // Esc
    dlg.addEventListener('close', cleanup);
    dlg.addEventListener('click', (e) => {
      // Клик по пустому месту вокруг фото закрывает просмотр.
      if (e.target === dlg || e.target.matches('[data-lb-stage], .lb-caption, .lb-top')) close();
    });
    dlg.addEventListener('keydown', (e) => {
      if (list.length < 2) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    });
    // Свайпы на телефоне
    let touchX = null;
    let touchY = null;
    dlg.addEventListener('touchstart', (e) => {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }, { passive: true });
    dlg.addEventListener('touchend', (e) => {
      if (touchX === null || list.length < 2) return;
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
  }

  /* ---------- Форма заявки ---------- */
  const form = $('#booking-form');
  if (form) initForm(form);

  function localISODate(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function initForm(formEl) {
    formEl.noValidate = true; // показываем свои сообщения вместо системных
    const els = formEl.elements;
    const statusEl = $('[data-form-status]', formEl);
    const submitBtn = $('button[type="submit"]', formEl);
    const submitLabel = submitBtn.textContent;

    // Предзаполнение из ссылки: contact.html?service=family&package=signature
    const params = new URLSearchParams(location.search);
    ['service', 'package'].forEach((key) => {
      const value = params.get(key);
      const select = els[key];
      if (value && select && [...select.options].some((o) => o.value === value)) select.value = value;
    });

    const today = localISODate();
    const maxDate = localISODate(365);
    if (els.date) { els.date.min = today; els.date.max = maxDate; }

    // Номер США: 10 цифр (код 1 в начале допускается), формат NANP — код зоны и
    // номер станции не начинаются с 0 или 1.
    const usDigits = (v) => {
      const d = v.replace(/\D/g, '');
      return d.length === 11 && d[0] === '1' ? d.slice(1) : d;
    };
    const formatUSPhone = (v) => {
      const d = usDigits(v);
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    };

    const rules = {
      name(v) {
        v = v.trim();
        if (!v) return 'Please enter your name';
        if (v.length < 2) return 'Name is too short';
        if (!/^\p{L}[\p{L}\s'’.-]*$/u.test(v)) return 'Use letters, spaces, hyphens, and apostrophes only';
        return '';
      },
      phone(v) {
        v = v.trim();
        if (!v) return 'Please enter your phone number so we can reach you';
        if (!/^\+?[\d\s().-]+$/.test(v)) return 'Use digits only, e.g. (555) 555-0123';
        const d = usDigits(v);
        if (d.length !== 10) return 'Enter a 10-digit US phone number';
        if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return "This doesn't look like a valid US phone number";
        return '';
      },
      email(v) {
        v = v.trim();
        if (!v) return 'Please enter your email';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email, e.g. name@example.com';
        return '';
      },
      service(v) { return v ? '' : 'Please choose a session type'; },
      date(v) {
        if (!v) return '';
        if (v < today) return 'That date has passed. Please pick today or a future date';
        if (v > maxDate) return 'We book up to one year in advance';
        return '';
      },
      message(v) {
        const len = v.trim().length;
        if (!len) return 'Tell us a little about the session you have in mind';
        if (len < 10) return `Please add a few more words (at least 10 characters, currently ${len})`;
        if (len > 1000) return 'Please keep it under 1,000 characters';
        return '';
      },
    };

    const fields = Object.keys(rules).map((n) => els[n]).filter(Boolean);
    const touched = new WeakSet();

    const validate = (el) => {
      const msg = rules[el.name](el.value, el);
      const err = document.getElementById(`${el.id}-error`);
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      el.classList.toggle('is-valid', !msg && el.type !== 'checkbox' && el.value.trim() !== '');
      if (err) err.textContent = msg;
      return !msg;
    };

    fields.forEach((el) => {
      const isChoice = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date';
      // Ошибку показываем после того, как человек ушёл из поля, а не на первом же символе.
      el.addEventListener('blur', () => {
        if (el.value.trim() || touched.has(el)) {
          touched.add(el);
          // Корректный номер приводим к привычному виду (555) 555-0123.
          if (validate(el) && el.name === 'phone') el.value = formatUSPhone(el.value);
        }
      });
      el.addEventListener(isChoice ? 'change' : 'input', () => {
        if (isChoice) touched.add(el);
        if (touched.has(el)) validate(el);
      });
    });

    // Счётчик символов
    const counter = $('[data-counter-for="message"]', formEl);
    const updateCounter = () => {
      if (!counter) return;
      const max = Number(els.message.maxLength) || 1000;
      const len = els.message.value.length;
      counter.textContent = `${len} / ${max}`;
      counter.classList.toggle('over', len > max);
    };
    els.message?.addEventListener('input', updateCounter);

    const setStatus = (type, text) => {
      statusEl.className = `form-status ${type}`;
      statusEl.textContent = text;
    };

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      setStatus('', '');

      let firstInvalid = null;
      fields.forEach((el) => {
        touched.add(el);
        if (!validate(el) && !firstInvalid) firstInvalid = el;
      });
      if (firstInvalid) {
        const n = fields.filter((el) => el.getAttribute('aria-invalid') === 'true').length;
        setStatus('error', `Please fix the ${n} highlighted field${n === 1 ? '' : 's'}.`);
        firstInvalid.focus();
        return;
      }

      const name = els.name.value.trim();
      const finish = () => {
        setStatus('success', `Thanks, ${name.split(/\s+/)[0]}! Your request has been sent. We'll get back to you within one business hour.`);
        formEl.reset();
        fields.forEach((el) => { el.removeAttribute('aria-invalid'); el.classList.remove('is-valid'); });
        updateCounter();
      };

      // Бот заполнил скрытое поле: делаем вид, что всё хорошо, но ничего не отправляем.
      if (els.website?.value) { finish(); return; }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending…';
      try {
        const endpoint = formEl.dataset.endpoint;
        if (endpoint) {
          const res = await fetch(endpoint, {
            method: 'POST',
            body: new FormData(formEl),
            headers: { Accept: 'application/json' },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } else {
          await new Promise((r) => setTimeout(r, 700)); // демо-режим без сервера
        }
        finish();
      } catch (err) {
        setStatus('error', "Something went wrong and your request wasn't sent. Please check your connection and try again, or call us at (555) 555-0123.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      }
    });
  }
})();
