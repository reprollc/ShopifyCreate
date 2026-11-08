/* Create theme – storefront scripts (no dependencies) */
(function () {
  'use strict';

  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    var placeholder = /\{\{\s*(\w+)\s*\}\}/;
    var fmt = format || '¥{{amount_no_decimals}}';

    function withDelimiters(number, precision, thousands, decimal) {
      thousands = thousands || ',';
      decimal = decimal || '.';
      if (isNaN(number) || number == null) return '0';
      number = (number / 100.0).toFixed(precision);
      var parts = number.split('.');
      var dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
      var centsPart = parts[1] ? decimal + parts[1] : '';
      return dollars + centsPart;
    }

    var match = fmt.match(placeholder);
    var value = '';
    switch (match ? match[1] : 'amount_no_decimals') {
      case 'amount': value = withDelimiters(cents, 2); break;
      case 'amount_no_decimals': value = withDelimiters(cents, 0); break;
      case 'amount_with_comma_separator': value = withDelimiters(cents, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator': value = withDelimiters(cents, 0, '.', ','); break;
      case 'amount_with_apostrophe_separator': value = withDelimiters(cents, 2, "'", '.'); break;
      default: value = withDelimiters(cents, 0);
    }
    return fmt.replace(placeholder, value);
  }

  /* ---------- Mobile menu ---------- */
  function initMenu() {
    var toggle = document.querySelector('[data-menu-toggle]');
    var menu = document.querySelector('[data-menu]');
    var overlay = document.querySelector('[data-menu-overlay]');
    var close = document.querySelector('[data-menu-close]');
    if (!toggle || !menu) return;

    function setOpen(open) {
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (overlay) overlay.hidden = !open;
      document.body.classList.toggle('no-scroll', open);
    }
    toggle.addEventListener('click', function () { setOpen(!menu.classList.contains('is-open')); });
    if (close) close.addEventListener('click', function () { setOpen(false); });
    if (overlay) overlay.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  /* ---------- Cart count ---------- */
  function updateCartCount(count) {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = count;
      el.hidden = count === 0;
    });
    document.querySelectorAll('[data-cart-count-text]').forEach(function (el) {
      el.textContent = count;
    });
  }

  /* ---------- Product page ---------- */
  function initProduct(section) {
    var dataEl = section.querySelector('[data-product-json]');
    var form = section.querySelector('[data-product-form]');
    if (!dataEl || !form) return;
    var data = JSON.parse(dataEl.textContent);

    var idInput = form.querySelector('[data-variant-id]');
    var addButton = form.querySelector('[data-add-to-cart]');
    var addText = form.querySelector('[data-add-to-cart-text]');
    var errorEl = form.querySelector('[data-form-error]');
    var priceWrap = section.querySelector('[data-product-price]');

    function showMedia(mediaId) {
      if (!mediaId) return;
      section.querySelectorAll('[data-media-id]').forEach(function (el) {
        el.hidden = String(el.dataset.mediaId) !== String(mediaId);
      });
      section.querySelectorAll('[data-thumb]').forEach(function (el) {
        el.classList.toggle('is-active', String(el.dataset.thumb) === String(mediaId));
      });
    }

    section.querySelectorAll('[data-thumb]').forEach(function (btn) {
      btn.addEventListener('click', function () { showMedia(btn.dataset.thumb); });
    });

    function selectedOptions() {
      var values = [];
      form.querySelectorAll('.product-option').forEach(function (fieldset) {
        var checked = fieldset.querySelector('[data-option-input]:checked');
        values.push(checked ? checked.value : null);
      });
      return values;
    }

    function renderPrice(variant) {
      if (!priceWrap) return;
      var regular = priceWrap.querySelector('[data-price-regular]');
      var compare = priceWrap.querySelector('[data-price-compare]');
      var price = priceWrap.querySelector('[data-price]');
      if (!variant) return;
      if (regular) regular.textContent = formatMoney(variant.price, data.moneyFormat);
      var onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
      if (compare) {
        compare.hidden = !onSale;
        if (onSale) compare.textContent = formatMoney(variant.compare_at_price, data.moneyFormat);
      }
      if (price) {
        price.classList.toggle('price--on-sale', !!onSale);
        price.classList.toggle('price--sold-out', !variant.available);
      }
    }

    function onOptionChange() {
      var options = selectedOptions();
      var variant = data.variants.find(function (v) {
        return v.options.every(function (opt, i) { return opt === options[i]; });
      });

      if (!variant) {
        addButton.disabled = true;
        addText.textContent = data.strings.unavailable;
        return;
      }
      idInput.value = variant.id;
      addButton.disabled = !variant.available;
      addText.textContent = variant.available ? data.strings.addToCart : data.strings.soldOut;
      renderPrice(variant);
      if (variant.featured_media) showMedia(variant.featured_media.id);

      var url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());
    }

    form.querySelectorAll('[data-option-input]').forEach(function (input) {
      input.addEventListener('change', onOptionChange);
    });

    form.addEventListener('submit', function (e) {
      if (!window.fetch) return;
      e.preventDefault();
      if (errorEl) errorEl.hidden = true;
      addButton.setAttribute('aria-busy', 'true');
      addButton.disabled = true;

      fetch(window.Shopify && Shopify.routes ? Shopify.routes.root + 'cart/add.js' : '/cart/add.js', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form)
      })
        .then(function (res) { return res.json().then(function (json) { return { ok: res.ok, json: json }; }); })
        .then(function (result) {
          if (!result.ok) throw new Error(result.json.description || result.json.message);
          return fetch('/cart.js').then(function (r) { return r.json(); });
        })
        .then(function (cart) {
          updateCartCount(cart.item_count);
          window.location.href = (window.Shopify && Shopify.routes ? Shopify.routes.root : '/') + 'cart';
        })
        .catch(function (err) {
          if (errorEl) {
            errorEl.textContent = err.message;
            errorEl.hidden = false;
          }
          addButton.disabled = false;
        })
        .finally(function () { addButton.removeAttribute('aria-busy'); });
    });
  }

  /* ---------- Quantity +/- ---------- */
  function initQuantity() {
    document.querySelectorAll('[data-quantity]').forEach(function (wrap) {
      var input = wrap.querySelector('input');
      wrap.querySelector('[data-quantity-minus]').addEventListener('click', function () {
        input.value = Math.max(parseInt(input.min || 1, 10), (parseInt(input.value, 10) || 1) - 1);
      });
      wrap.querySelector('[data-quantity-plus]').addEventListener('click', function () {
        input.value = (parseInt(input.value, 10) || 0) + 1;
      });
    });
  }

  /* ---------- Cart page: auto update on qty change ---------- */
  function initCart() {
    var form = document.getElementById('CartForm');
    if (!form) return;
    var timer;
    form.querySelectorAll('[data-cart-quantity]').forEach(function (input) {
      input.addEventListener('change', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = 'update';
          hidden.value = '1';
          form.appendChild(hidden);
          form.submit();
        }, 400);
      });
    });
  }

  /* ---------- Collection filters/sort: submit on change ---------- */
  function initFilters() {
    var form = document.querySelector('[data-collection-filters]');
    if (!form) return;
    form.addEventListener('change', function () {
      var params = new URLSearchParams(new FormData(form));
      Array.from(params.keys()).forEach(function (key) {
        if (params.get(key) === '') params.delete(key);
      });
      window.location.search = params.toString();
    });
  }

  /* ---------- Product recommendations ---------- */
  function initRecommendations() {
    document.querySelectorAll('[data-recommendations]').forEach(function (el) {
      if (el.children.length) return;
      fetch(el.dataset.url)
        .then(function (res) { return res.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var inner = doc.querySelector('[data-recommendations]');
          if (inner && inner.innerHTML.trim()) el.innerHTML = inner.innerHTML;
        })
        .catch(function () {});
    });
  }

  /* ---------- Share ---------- */
  function initShare() {
    document.querySelectorAll('[data-share-url]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var url = btn.dataset.shareUrl;
        if (navigator.share) {
          navigator.share({ title: btn.dataset.shareTitle, url: url }).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () {
            var original = btn.textContent;
            btn.textContent = '✓ Copied';
            setTimeout(function () { btn.textContent = original; }, 2000);
          });
        }
      });
    });
  }

  /* ---------- Customer login: recover password toggle ---------- */
  function initRecover() {
    var login = document.getElementById('Login');
    var recover = document.getElementById('Recover');
    if (!login || !recover) return;
    function show(isRecover) {
      recover.hidden = !isRecover;
      login.hidden = isRecover;
    }
    document.querySelectorAll('[data-toggle-recover]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        show(a.getAttribute('href') === '#recover');
      });
    });
    if (window.location.hash === '#recover') show(true);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initMenu();
    initQuantity();
    initCart();
    initFilters();
    initRecommendations();
    initShare();
    initRecover();
    document.querySelectorAll('[data-product-section]').forEach(initProduct);
  });
})();

/* ==========================================================================
   Additional components: slideshow, vendor products, contact prefill,
   localization selector
   ========================================================================== */
(function () {
  'use strict';

  function initSlideshow(root) {
    var slides = root.querySelectorAll('[data-slide]');
    var dots = root.querySelectorAll('[data-slide-to]');
    if (slides.length < 2) return;
    var current = 0;
    var timer = null;
    var delay = parseInt(root.dataset.speed, 10) || 6000;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function go(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        var active = i === current;
        slide.hidden = !active;
        slide.classList.toggle('is-active', active);
        slide.classList.toggle('is-entering', active);
      });
      dots.forEach(function (dot, i) {
        var active = i === current;
        dot.classList.toggle('is-active', active);
        if (active) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      if (root.dataset.autoplay !== 'true' || reduceMotion) return;
      stop();
      timer = setInterval(function () { go(current + 1); }, delay);
    }

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () { go(parseInt(dot.dataset.slideTo, 10)); start(); });
    });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);

    // Swipe on touch devices
    var startX = null;
    root.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var diff = e.changedTouches[0].clientX - startX;
      if (Math.abs(diff) > 40) { go(current + (diff < 0 ? 1 : -1)); start(); }
      startX = null;
    });

    // Theme editor: show the selected block
    document.addEventListener('shopify:block:select', function (e) {
      var index = Array.prototype.indexOf.call(slides, e.target);
      if (index > -1) { stop(); go(index); }
    });

    start();
  }

  function initVendorProducts(el) {
    fetch(el.dataset.url)
      .then(function (res) { return res.ok ? res.text() : ''; })
      .then(function (html) {
        if (!html) return;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var section = doc.querySelector('.vendor-products');
        var grid = section && section.querySelector('[data-vendor-grid]');
        if (!grid) return;
        var limit = parseInt(el.dataset.limit, 10) || 4;
        var shown = 0;
        Array.prototype.slice.call(grid.children).forEach(function (item) {
          if (item.dataset.handle === el.dataset.exclude || shown >= limit) item.remove();
          else shown += 1;
        });
        if (shown === 0) return;
        grid.style.setProperty('--columns-desktop', Math.min(limit, 4));
        el.innerHTML = section.innerHTML;
      })
      .catch(function () {});
  }

  function initContactPrefill() {
    var body = document.querySelector('[data-prefill-product]');
    if (!body || body.value) return;
    var product = new URLSearchParams(window.location.search).get('product');
    if (product) body.value = body.dataset.prefillProduct + product + '\n\n';
  }

  function initLocalization() {
    document.querySelectorAll('[data-localization-select]').forEach(function (select) {
      select.addEventListener('change', function () { select.form.submit(); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-slideshow]').forEach(initSlideshow);
    document.querySelectorAll('[data-vendor-products]').forEach(initVendorProducts);
    initContactPrefill();
    initLocalization();
  });
})();
