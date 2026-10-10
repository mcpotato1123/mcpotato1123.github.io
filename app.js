/* ==========================================================================
   Cenilla Network Group — app.js
   全部为渐进增强：任何一段失败，页面依然是完整可读的静态文档。
   约束（与 styles.css 对应，改动前先读）：
   · 不引入任何第三方库，纯原生实现；
   · 触屏设备（hover:none）不启用自定义光标、聚光斑与倾斜；
   · prefers-reduced-motion 下只做主题切换与导航，不做位移动画；
   · 所有 scroll / pointer 监听都用 rAF 合并，避免逐事件触发布局。

   关键安全约束：隐藏正文的两个类（html.js-anim / html.no-anim）由**本文件**控制，
   不写死在 HTML 里。整段逻辑包在 init() 的 try/catch 中：只要本文件没加载、
   抛异常或被 CSP 拦掉，正文就以静态可见的形态呈现，绝不会变成一片空白。
   ========================================================================== */
(function () {
  'use strict';

  var d = document.documentElement;
  var body = document.body;

  /* 回到静态可见形态：观察器不可用 / 脚本出错 / 只有一个 <noscript> 生效时走这里 */
  function showAll() {
    d.classList.remove('js-anim');
    d.classList.add('no-anim');
  }

  /* ---------- 能力探测 ---------------------------------------------------- */
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqTouch = window.matchMedia('(hover: none)');
  var reduce = mqReduce.matches;
  var touch = mqTouch.matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !touch;

  /* rAF 合帧工具：同一帧内多次调用只执行最后一次 */
  function frame(fn) {
    var queued = false;
    return function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        fn();
      });
    };
  }

  /* ---------- 提前接管的变量（init 与收尾都要用） ---------- */
  var header = document.getElementById('siteHeader');
  var progressBar = document.getElementById('progressBar');
  var toTop = document.getElementById('toTop');
  var nav = document.getElementById('siteNav');
  var navInd = document.getElementById('navInd');
  var themeToggle = document.getElementById('themeToggle');
  var menuToggle = document.getElementById('menuToggle');
  var mobileMenu = document.getElementById('mobileMenu');
  var navLinks = nav ? Array.prototype.slice.call(nav.querySelectorAll('a')) : [];
  var finePointer = false;

  function setMenu(open) {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    mobileMenu.hidden = !open;
    if (open) {
      var first = mobileMenu.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    }
  }

  /* 页面卸载 / 转入后台时收拾干净：关菜单、清倾斜、去掉自定义光标 */
  function cleanup() {
    setMenu(false);
    if (finePointer) {
      body.classList.remove('custom-cursor', 'cursor-hover', 'cursor-down', 'has-pointer');
    }
    var tilted = document.querySelectorAll('[data-tilt]');
    for (var i = 0; i < tilted.length; i++) tilted[i].style.transform = '';
    if (navInd) navInd.style.opacity = '0';
  }

  function init() {
    var mqDark = window.matchMedia('(prefers-color-scheme: dark)');

    /* ====================================================================
       0. 入场动画 + 数字滚动
       隐藏正文的类在这里、由 JS 自己加上：观察器就绪 = 后续必定会把元素放出来。
       两个观察器合成一个 —— 它们进入视口的时机一致，没必要开两条。
       ==================================================================== */
    var revealItems = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
    var counterData = [];
    /* 目标值先存进 JS 并清空节点：避免「先显示终值、再跳回 0 往上数」的闪烁 */
    counters.forEach(function (el) {
      var n = parseFloat(el.getAttribute('data-count'));
      counterData.push({ el: el, n: n, suffix: el.getAttribute('data-suffix') || '' });
      el.textContent = '';
    });

    if ('IntersectionObserver' in window && !reduce) {
      d.classList.add('js-anim');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
      revealItems.forEach(function (el) { io.observe(el); });

      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var rec = null;
          for (var i = 0; i < counterData.length; i++) {
            if (counterData[i].el === entry.target) rec = counterData[i];
          }
          if (rec) runCount(rec.el, rec.n, rec.suffix);
          cio.unobserve(entry.target);
        });
      }, { threshold: 0.4 });
      counterData.forEach(function (rec) { cio.observe(rec.el); });
    } else {
      /* 没有 IntersectionObserver，或者用户要求减少动效：正文直接可读 */
      revealItems.forEach(function (el) { el.classList.add('in'); });
      counterData.forEach(function (rec) {
        rec.el.textContent = rec.n + (rec.suffix || '');
      });
    }

    /* 首屏编排：动效开启时延迟一帧打开总开关 */
    if (d.classList.contains('js-anim')) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { body.classList.add('hero-ready'); });
      });
    }

    /* ====================================================================
       1. 主题：三态（浅色 / 深色 / 跟随系统）
       与 <head> 里的内联脚本共用同一套键名与语义，两边必须一起改：
         localStorage['cenilla-theme'] = 'light' | 'dark' | 'auto'（缺省即 auto）
         data-theme      当前**生效**的主题，CSS 只认它
         data-theme-pref 用户的**选择**，用来画按钮状态
       区分这两者是关键：pref 是 auto 时，系统一变更就要跟着走；
       pref 一旦被用户手动定死，就不再受系统影响。

       首帧那次由内联脚本完成（避免闪主题），这里只处理运行中的切换。
       ==================================================================== */

    /* 点按钮的循环顺序：浅色 → 深色 → 跟随系统 → 浅色 …
       把「跟随系统」放在循环里，用户才有办法从手动选择回到自动，
       否则一旦点过按钮就永远回不去了。 */
    var THEME_CYCLE = ['light', 'dark', 'auto'];
    var THEME_LABEL = {
      light: '当前浅色主题，点击切换到深色',
      dark: '当前深色主题，点击改为跟随系统',
      auto: '当前跟随系统，点击切换到浅色'
    };

    function currentPref() {
      var p = d.dataset.themePref;
      return (p === 'light' || p === 'dark' || p === 'auto') ? p : 'auto';
    }
    function prefersDark() {
      return !!(mqDark && mqDark.matches);
    }
    /* 把 pref 解析成实际生效的主题 */
    function resolveTheme(pref) {
      return pref === 'auto' ? (prefersDark() ? 'dark' : 'light') : pref;
    }

    /* 只改「生效主题」相关的副作用，不碰 pref、不写存储。
       系统主题变化时走这条，不能走 applyTheme —— 那会把 auto 覆盖成具体值。 */
    function paintTheme(resolved) {
      d.dataset.theme = resolved;
      d.dataset.themeState = resolved;
      /* 两个 meta 靠 media 切换生效项：
         比直接改 content 稳，且不会出现两条同时生效。 */
      var metaL = document.getElementById('metaThemeLight');
      var metaD = document.getElementById('metaThemeDark');
      if (metaL && metaD) {
        var isLight = resolved === 'light';
        metaL.setAttribute('media', isLight ? 'all' : 'not all');
        metaD.setAttribute('media', isLight ? 'not all' : 'all');
      }
      if (themeToggle) {
        themeToggle.setAttribute('aria-label', THEME_LABEL[currentPref()] || THEME_LABEL.auto);
      }
    }

    /* 写入用户选择（点按钮走这条），带圆形揭示动效 */
    function applyTheme(pref, origin) {
      var resolved = resolveTheme(pref);
      var commit = function () {
        d.dataset.themePref = pref;
        try { localStorage.setItem('cenilla-theme', pref); } catch (e) {}
        paintTheme(resolved);
      };

      var canVT = typeof document.startViewTransition === 'function' && !reduce;
      if (!canVT) { commit(); return; }

      if (origin) {
        var x = origin.x, y = origin.y;
        d.style.setProperty('--vt-x', x + 'px');
        d.style.setProperty('--vt-y', y + 'px');
        var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        d.style.setProperty('--vt-r', r + 'px');
      } else {
        d.style.setProperty('--vt-x', '50%');
        d.style.setProperty('--vt-y', '0px');
        d.style.setProperty('--vt-r', '120vmax');
      }
      d.dataset.vt = 'theme';
      var t = document.startViewTransition(commit);
      if (t && t.finished && t.finished.finally) {
        t.finished.finally(function () { delete d.dataset.vt; });
      } else {
        setTimeout(function () { delete d.dataset.vt; }, 700);
      }
    }

    if (themeToggle) {
      /* 支持右键/长按「直接回到跟随系统」，不用转一圈 */
      themeToggle.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (currentPref() !== 'auto') applyTheme('auto');
      });
      themeToggle.addEventListener('click', function () {
        var p = currentPref();
        var next = THEME_CYCLE[(THEME_CYCLE.indexOf(p) + 1) % THEME_CYCLE.length];
        var r = themeToggle.getBoundingClientRect();
        applyTheme(next, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      });
    }

    /* 系统主题变化：只有 pref 是 auto 时才跟。
       走 paintTheme —— 它不改 pref、不写存储，用户的「跟随系统」选择得以保留。 */
    var onSystemTheme = function () {
      if (currentPref() !== 'auto') return;
      /* 跟随时也给同样的圆形揭示（从顶部铺开），视觉上和手动切换一致 */
      if (reduce || typeof document.startViewTransition !== 'function') {
        paintTheme(resolveTheme('auto'));
        return;
      }
      d.style.setProperty('--vt-x', '50%');
      d.style.setProperty('--vt-y', '0px');
      d.style.setProperty('--vt-r', '120vmax');
      d.dataset.vt = 'theme';
      var t = document.startViewTransition(function () { paintTheme(resolveTheme('auto')); });
      if (t && t.finished && t.finished.finally) {
        t.finished.finally(function () { delete d.dataset.vt; });
      } else {
        setTimeout(function () { delete d.dataset.vt; }, 700);
      }
    };
    if (mqDark) {
      if (mqDark.addEventListener) mqDark.addEventListener('change', onSystemTheme);
      else if (mqDark.addListener) mqDark.addListener(onSystemTheme);
    }
    /* 进入页面时同步一次按钮文案（首帧内联脚本设不了 aria-label，
       那时按钮可能还没解析出来） */
    paintTheme(d.dataset.theme === 'dark' ? 'dark' : 'light');

    /* ====================================================================
       2. 滚动：进度条 / 顶栏吸顶 / 回到顶部 / 导航高亮
       全部挤在同一个 scroll 处理器里，一帧只读一次布局。
       ==================================================================== */
    var sections = navLinks
      .map(function (a) {
        var id = a.getAttribute('href');
        return id && id.charAt(0) === '#' ? document.querySelector(id) : null;
      })
      .filter(Boolean);

    function moveNavInd(el) {
      if (!nav || !navInd || !el) return;
      var nr = nav.getBoundingClientRect();
      var ar = el.getBoundingClientRect();
      navInd.style.width = (ar.width - 26) + 'px';
      navInd.style.transform = 'translateX(' + (ar.left - nr.left + 13) + 'px)';
      navInd.style.opacity = '1';
    }

    var onScroll = frame(function () {
      var y = window.pageYOffset || d.scrollTop;
      var docH = d.scrollHeight - window.innerHeight;

      if (progressBar) {
        progressBar.style.transform = 'scaleX(' + (docH > 0 ? Math.min(y / docH, 1) : 0) + ')';
      }
      if (header) header.classList.toggle('is-stuck', y > 8);
      if (toTop) toTop.classList.toggle('show', y > window.innerHeight * 0.9);

      /* 导航高亮：取当前视口内最靠上、且已越过顶栏的那一节 */
      if (sections.length) {
        var active = null;
        var mark = y + window.innerHeight * 0.32;
        for (var i = 0; i < sections.length; i++) {
          if (sections[i].getBoundingClientRect().top + y <= mark) active = sections[i];
        }
        var link = null;
        for (var j = 0; j < navLinks.length; j++) {
          var isOn = active && navLinks[j].getAttribute('href') === '#' + active.id;
          navLinks[j].classList.toggle('is-active', !!isOn);
          if (isOn) link = navLinks[j];
        }
        if (link) moveNavInd(link);
        else if (navInd) navInd.style.opacity = '0';
      }
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', frame(function () {
      onScroll();
      if (nav) {
        var cur = nav.querySelector('a.is-active');
        if (cur) moveNavInd(cur);
      }
    }), { passive: true });
    window.addEventListener('orientationchange', onScroll, { passive: true });
    onScroll();

    if (toTop) {
      toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      });
    }

    /* ====================================================================
       3. 移动端菜单
       移动端没有底部标签栏，这枚按钮是窄屏唯一的导航入口，
       所以打开时把焦点交给第一项，Esc 与点击空白处都能关。
       ==================================================================== */
    if (menuToggle && mobileMenu) {
      menuToggle.addEventListener('click', function () {
        setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
      });
      mobileMenu.addEventListener('click', function (e) {
        if (e.target.closest('a')) setMenu(false);
      });
      document.addEventListener('click', function (e) {
        if (mobileMenu.hidden) return;
        if (mobileMenu.contains(e.target) || menuToggle.contains(e.target)) return;
        setMenu(false);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !mobileMenu.hidden) {
          setMenu(false);
          menuToggle.focus();
        }
      });
    }

    /* ====================================================================
       4. 指针效果：自定义光标 / 聚光斑 / 卡片倾斜 / 指针跟随高亮
       四件事共用同一个 pointermove，写样式一律在 rAF 里。
       ==================================================================== */
    if (fine && !reduce) {
      var cursorEl = document.querySelector('.cursor');
      var ring = document.querySelector('.cursor-ring');
      var dot = document.querySelector('.cursor-dot');
      var spotlight = document.querySelector('.spotlight');
      var tilts = Array.prototype.slice.call(document.querySelectorAll('[data-tilt]'));

      var mx = innerWidth / 2, my = innerHeight / 2;
      var cx = mx, cy = my;   /* 光标环的缓动位置 */
      var sx = mx, sy = my;   /* 聚光斑的缓动位置 */
      var hoverEl = null;     /* 当前倾斜中的卡片 */

      /* 只有替代光标真实存在时，才允许把系统指针藏起来 */
      if (cursorEl && ring && dot) {
        body.classList.add('custom-cursor');
        finePointer = true;
      }
      body.classList.add('has-pointer');

      var onMove = frame(function () {
        if (dot) dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';

        /* 指针跟随高亮：把坐标写进元素自身的 --px / --py */
        var g = document.querySelector('.glow:hover');
        if (g) {
          var gr = g.getBoundingClientRect();
          g.style.setProperty('--px', (mx - gr.left) + 'px');
          g.style.setProperty('--py', (my - gr.top) + 'px');
        }

        /* 3D 倾斜 */
        var t = document.querySelector('[data-tilt]:hover');
        if (t !== hoverEl) {
          if (hoverEl) hoverEl.style.transform = '';
          hoverEl = t;
        }
        if (hoverEl) {
          var max = parseFloat(hoverEl.getAttribute('data-tilt-max')) || 6;
          var r = hoverEl.getBoundingClientRect();
          var ry = ((mx - r.left) / r.width - 0.5) * 2 * max;
          var rx = (0.5 - (my - r.top) / r.height) * 2 * max;
          hoverEl.style.transform =
            'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) +
            'deg) translateY(-3px)';
        }
      });

      document.addEventListener('pointermove', function (e) {
        mx = e.clientX; my = e.clientY;
        onMove();
      }, { passive: true });

      document.addEventListener('pointerover', function (e) {
        var inter = e.target && e.target.closest
          ? e.target.closest('a,button,[data-tilt],input,textarea,select')
          : null;
        body.classList.toggle('cursor-hover', !!inter);
      }, { passive: true });

      document.addEventListener('pointerdown', function () { body.classList.add('cursor-down'); }, { passive: true });
      document.addEventListener('pointerup', function () { body.classList.remove('cursor-down'); }, { passive: true });
      document.addEventListener('pointerleave', function () { body.classList.add('cursor-hidden'); }, { passive: true });
      document.addEventListener('pointerenter', function () { body.classList.remove('cursor-hidden'); }, { passive: true });

      /* 环与聚光斑各自缓动，常驻 rAF；页面切到后台就停 */
      var ticking = true;
      function loop() {
        if (!ticking) return;
        cx += (mx - cx) * 0.18;
        cy += (my - cy) * 0.18;
        sx += (mx - sx) * 0.07;
        sy += (my - sy) * 0.07;
        if (ring) ring.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
        if (spotlight) spotlight.style.transform = 'translate3d(' + sx + 'px,' + sy + 'px,0)';
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
      document.addEventListener('visibilitychange', function () { ticking = !document.hidden; });
    }

    /* ====================================================================
       5. 首屏粒子
       数量按视口宽度收敛，元素只在首屏内，滑出后不参与绘制。
       ==================================================================== */
    var particleHost = document.getElementById('particles');
    if (particleHost && !reduce && !d.classList.contains('fx-lite')) {
      var colors = ['var(--accent)', 'var(--teal)', 'var(--amber)'];
      var count = innerWidth < 900 ? 10 : 18;
      var frag = document.createDocumentFragment();
      for (var i = 0; i < count; i++) {
        var p = document.createElement('span');
        p.className = 'particle';
        p.style.setProperty('--s', (2 + Math.random() * 4).toFixed(1) + 'px');
        p.style.setProperty('--pc', colors[i % colors.length]);
        p.style.setProperty('--dur', (16 + Math.random() * 14).toFixed(1) + 's');
        p.style.setProperty('--delay', (-Math.random() * 22).toFixed(1) + 's');
        p.style.setProperty('--dx', (Math.random() * 90 - 45).toFixed(0) + 'px');
        p.style.setProperty('--po', (0.22 + Math.random() * 0.4).toFixed(2));
        p.style.left = (Math.random() * 100).toFixed(2) + '%';
        frag.appendChild(p);
      }
      particleHost.appendChild(frag);
    }

    /* ====================================================================
       6. FAQ 手风琴
       用 aria-expanded + grid-template-rows 展开，可同时打开多项。
       ==================================================================== */
    Array.prototype.forEach.call(document.querySelectorAll('.faq-item'), function (item) {
      var q = item.querySelector('.faq-q');
      if (!q) return;
      q.addEventListener('click', function () {
        var open = item.classList.toggle('open');
        q.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });

    /* ====================================================================
       7. 合集卡：上下拖动切换整张卡片
       一页 = 封面 + 序号 + 作品名 + 类型，整块一起滑（原设计就是这样）。
       页与页在 .pc-viewport 里绝对定位叠放，由 JS 按「离当前页的位移」摆位：
         d = 0   正好落在视口里
         d = ±1  错开到上/下相邻位置，转 8°、缩小并变淡，拖动时斜着探进来
       视口高度取自 .pc-page 的实测高度（页面高度不是常量，别写死）。
       拖动过程中直接写 inline transform（同时 .is-dragging 关掉 CSS 过渡），
       松手后清掉 inline、交回 CSS 过渡做缓动 —— 跟手与回弹两段分开控制。
       ==================================================================== */
    var pcCard = document.getElementById('collageCard');
    var pcViewport = document.getElementById('collageViewport');
    var pcPages = pcViewport
      ? Array.prototype.slice.call(pcViewport.querySelectorAll('.pc-page'))
      : [];

    if (pcCard && pcViewport && pcPages.length) {
      var pcDotsEl = document.getElementById('collageDots');
      var pcScrollHint = document.getElementById('collageScroll');
      var pcPrev = document.getElementById('collagePrev');
      var pcNext = document.getElementById('collageNext');
      var pcNav = pcCard.querySelector('.pc-nav');

      var pcCount = pcPages.length;
      var pcAt = 0;
      var pcDragging = false, pcStartY = 0, pcDy = 0, pcLastY = 0, pcLastT = 0, pcVy = 0, pcMoved = false;
      var pcPageH = 0;      /* 一页的高度，首次布局时量 */
      var pcSized = false;
      /* 供 ?diag=1 诊断面板读取（见文件末尾 runDiagnostics）。
         注意必须用取值函数实时读，不能在这里写死一个对象字面量 ——
         字面量是初始化那一刻的快照，之后 pcAt / pcPageH 一直在变，
         面板会一直显示 0/false，反而误导排查（这个坑踩过一次）。 */
      window.__pcDbg = {
        get count() { return pcCount; },
        get at() { return pcAt; },
        get pageH() { return Math.round(pcPageH * 100) / 100; },
        get sized() { return pcSized; },
        get rectH() { return Math.round(pcPages[0].getBoundingClientRect().height * 100) / 100; },
        get offH() { return pcPages[0].offsetHeight; },
        /* ?diag=1 时收集拖动姿态，供 runDiagnostics 统计「两页同时可见」的区间 */
        record: new URLSearchParams(location.search).get('diag') === '1' ? [] : null
      };

      /* 量一页的高度。三个坑都要绕开：
         · offsetHeight 在「高度是小数」（封面 6/5 比例很容易出现）时，
           某些 Chrome 版本 / 缩放比例下会返回 0 —— 一旦返回 0，
           视口就撑不起来、整叠卡片会退化成普通流、上下页直接叠在一起（出重影）。
           所以优先用 getBoundingClientRect().height 取小数高度。
         · 字号/图片还没布局完时也可能量到 0，这时用 rAF 重试，不要直接放弃。
         · 量之前先把视口高度清掉，否则量到的是上一轮撑开后的高度。 */
      var pcMeasure = function () {
        pcViewport.style.height = '';
        var rectH = pcPages[0].getBoundingClientRect().height;
        var offH = pcPages[0].offsetHeight;
        var h = rectH || offH;
        if (h > 0) {
          pcPageH = h;
          /* ceil 一下：宁可多 1px 也不要把封面的下边缘切掉 */
          pcViewport.style.height = Math.ceil(h) + 'px';
          pcSized = true;
          /* 放开 CSS 兜底：被打上 pc-ready 之后，第 2 页起才会显示出来 */
          pcViewport.classList.add('pc-ready');
          return true;
        }
        return false;
      };

      /* ---------------------------------------------------------------
         拖动时的位移与透明度。
         核心约束：**同一时刻只能有一页可见**，两页绝不共存。
         之前是「两页各按距离线性淡出」，于是中间必然出现
         「上一页还剩 85%、下一页已经 15%」的区间 —— 两层叠在同一块区域，
         看起来就是重影（实测抓到的 opacity=0.15 正是这个区间）。

         现在按行程分两段，用 s ∈ [-1, 1]（s = 拖动位移 / 页高）控场：
           s ∈ [-1, 0]  下一张从下方升上来（0 → 1 不透明），当前页纹丝不动
           s ∈ [ 0, 1]  当前页被往上推走（1 → 0 不透明），下一张停在下方
         于是任意时刻只有一页在动、只有一页可见。松手后按阈值决定翻不翻。
         --------------------------------------------------------------- */
      var pcEase = function (u) {
        u = u < 0 ? 0 : (u > 1 ? 1 : u);
        return 1 - Math.pow(1 - u, 3);
      };
      var pcDragPose = function (el, i, s) {
        var f = i - pcAt;                        /* 相对当前页的序号 */
        var y, op, sc;

        if (f === 0) {                           /* 当前页 */
          if (s <= 0) { y = 0; op = 1; }                     /* 下一张正在升上来，它不动 */
          else { y = -pcEase(s) * pcPageH; op = 1 - pcEase(s); }  /* 被推走并淡出 */
          sc = 1;
        } else if (f === -1) {                    /* 上一页：从上方落回来 */
          y = s <= 0 ? -pcPageH : -(1 - pcEase(s)) * pcPageH;
          op = s <= 0 ? 0 : pcEase(s);
          sc = 1;
        } else if (f === 1) {                     /* 下一页：从下方升上来 */
          y = s <= 0 ? (1 - pcEase(-s)) * pcPageH : 0;
          op = s <= 0 ? pcEase(-s) : 1;
          sc = 1;
        } else {                                  /* 更远的页一律不可见 */
          y = f < 0 ? -pcPageH : pcPageH;
          op = 0;
          sc = 1;
        }
        el.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0) scale(' + sc + ')';
        el.style.opacity = op.toFixed(3);
      };

      /* 静止态：只留当前页可见，其余整页移出并彻底透明 */
      var pcRestPose = function (el, i) {
        var f = i - pcAt;
        el.style.transform = f === 0 ? '' : 'translate3d(0,' + (f < 0 ? -pcPageH : pcPageH).toFixed(2) + 'px,0)';
        el.style.opacity = f === 0 ? '' : '0';
        /* 兜底：只有当前页及其直接邻居允许出像素，更远的页直接不参与绘制 */
        el.style.visibility = (f === 0 || f === 1 || f === -1) ? '' : 'hidden';
      };

      /* ?diag=1 时记录拖动过程中的姿态快照，用来定位「两页同时可见」的区间 */
      function pcSnapshot(s) {
        if (!window.__pcDbg || !window.__pcDbg.record) return;
        window.__pcDbg.record.push({
          s: Math.round(s * 1000) / 1000,
          at: pcAt,
          pages: pcPages.map(function (el) {
            return {
              op: Math.round(parseFloat(el.style.opacity || '1') * 1000) / 1000,
              tr: (el.style.transform || 'none').replace('translate3d(0,', '').replace(',0) scale(1)', '')
            };
          })
        });
      }

      /* 把当前页与上下邻居摆到静止位 */
      var pcLayout = function (offset) {
        if (!pcSized) pcMeasure();
        if (!pcPageH) return;
        if (offset) {
          var s = offset / pcPageH;
          if (s > 1) s = 1; else if (s < -1) s = -1;
          pcPages.forEach(function (el, i) { pcDragPose(el, i, s); });
          pcSnapshot(s);
        } else {
          pcPages.forEach(function (el, i) { pcRestPose(el, i); });
        }
      };

      /* 松手/切页：清掉 inline，交回 CSS 过渡。
         注意 transform 必须走 pcRestPose 显式写死「移出视口」，
         不能简单把 inline 清空 —— 清空等于回到 top:0，所有页会叠在同一格。 */
      var pcSettle = function () {
        if (!pcSized) pcMeasure();
        pcPages.forEach(function (el, i) {
          el.classList.toggle('is-current', i === pcAt);
          pcRestPose(el, i);
        });
        if (pcDotsEl) {
          Array.prototype.forEach.call(pcDotsEl.children, function (dot, i) {
            dot.classList.toggle('is-active', i === pcAt);
            dot.setAttribute('aria-current', i === pcAt ? 'true' : 'false');
          });
        }
        /* 到头了就把对应按钮压暗，别再让人白点 */
        if (pcNav) {
          pcNav.dataset.end = pcAt === 0 ? 'start' : (pcAt === pcCount - 1 ? 'end' : '');
        }
        if (pcScrollHint) {
          pcScrollHint.textContent = pcCount > 1
            ? '拖动封面翻页 · ' + (pcAt + 1) + '/' + pcCount
            : '拖动封面翻页';
        }
      };

      var pcGo = function (i) {
        var next = Math.max(0, Math.min(pcCount - 1, i));
        if (next === pcAt) { pcSettle(); return; }
        pcAt = next;
        pcSettle();
      };

      /* 圆点：按页数生成 */
      if (pcDotsEl) {
        pcPages.forEach(function (el, i) {
          var titleEl = el.querySelector('.pc-title');
          var name = titleEl ? titleEl.textContent.trim() : ('第 ' + (i + 1) + ' 部');
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'pc-dot' + (i === 0 ? ' is-active' : '');
          b.setAttribute('aria-label', '查看《' + name + '》');
          b.addEventListener('click', function () { pcGo(i); });
          pcDotsEl.appendChild(b);
        });
      }

      if (pcPrev) pcPrev.addEventListener('click', function () { pcGo(pcAt - 1); });
      if (pcNext) pcNext.addEventListener('click', function () { pcGo(pcAt + 1); });

      pcViewport.addEventListener('pointerdown', function (e) {
        if (e.target.closest('.pc-arrow')) return;
        pcDragging = true;
        pcMoved = false;
        pcStartY = e.clientY;
        pcLastY = e.clientY;
        pcLastT = e.timeStamp;
        pcVy = 0;
        pcDy = 0;
        pcViewport.classList.add('is-dragging');
        if (pcViewport.setPointerCapture) {
          try { pcViewport.setPointerCapture(e.pointerId); } catch (err) {}
        }
      });

      pcViewport.addEventListener('pointermove', function (e) {
        if (!pcDragging) return;
        pcDy = e.clientY - pcStartY;
        if (Math.abs(pcDy) > 6) pcMoved = true;
        var dt = e.timeStamp - pcLastT;
        if (dt > 0) pcVy = (e.clientY - pcLastY) / dt;   /* px per ms，带符号 */
        pcLastY = e.clientY;
        pcLastT = e.timeStamp;
        pcLayout(pcDy);
      });

      var pcEnd = function () {
        if (!pcDragging) return;
        pcDragging = false;
        pcViewport.classList.remove('is-dragging');
        var h = pcPageH || 1;
        /* 往上拖 = 看下一张；位移超过 1/6 页高，或者甩得够快，就翻一页 */
        var step = 0;
        if (pcDy < -h * 0.16 || pcVy < -0.45) step = 1;
        else if (pcDy > h * 0.16 || pcVy > 0.45) step = -1;
        if (!pcMoved) step = 0;
        pcAt = Math.max(0, Math.min(pcCount - 1, pcAt + step));
        pcDy = 0; pcVy = 0;
        pcSettle();
        /* 拖动结束后短时间内屏蔽一次点击，避免顺带触发链接 */
        if (pcMoved) {
          var swallow = function (ev) { ev.preventDefault(); ev.stopPropagation(); };
          pcViewport.addEventListener('click', swallow, { capture: true, once: true });
          setTimeout(function () {
            pcViewport.removeEventListener('click', swallow, { capture: true });
          }, 340);
        }
      };
      pcViewport.addEventListener('pointerup', pcEnd);
      pcViewport.addEventListener('pointercancel', pcEnd);
      pcViewport.addEventListener('lostpointercapture', pcEnd);

      /* 鼠标滚轮翻页。
         这里最容易踩的坑是「把页面滚动吃掉」—— 鼠标停在卡片上时用户滚不动页面。
         所以规则是：
           · 先判断这一滚会不会真的换页；不会（已经在头/尾）就完全不拦，让页面照常滚；
           · 会换页时，preventDefault 挡掉页面滚动，并在 520ms 内忽略后续滚轮事件 ——
             一个手势只翻一页，不会因为惯性一路翻到底。
         只在真有指针悬停的设备上挂（触屏靠拖动）。 */
      if (fine) {
        var pcWheelLock = 0;
        pcViewport.addEventListener('wheel', function (e) {
          var dir = e.deltaY;
          if (!dir) return;
          var step = dir > 0 ? 1 : -1;
          var next = Math.max(0, Math.min(pcCount - 1, pcAt + step));
          /* 已经在头/尾，这一滚换不了页 —— 交回给页面滚动 */
          if (next === pcAt) return;
          e.preventDefault();
          var now = Date.now();
          if (now < pcWheelLock) return;   /* 同一手势的余波，忽略 */
          pcWheelLock = now + 520;
          pcGo(next);
        }, { passive: false });
      }

      /* 方向键：上下翻页 */
      pcViewport.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp') { e.preventDefault(); pcGo(pcAt - 1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); pcGo(pcAt + 1); }
      });

      /* 尺寸变化（断点切换、旋转屏幕、字体加载完成）要重新量高度并摆位 */
      window.addEventListener('resize', frame(function () {
        if (!pcDragging) { pcMeasure(); pcSettle(); pcLayout(0); }
      }), { passive: true });
      if (window.ResizeObserver) {
        try {
          new ResizeObserver(frame(function () {
            if (!pcDragging) { pcMeasure(); pcLayout(0); }
          })).observe(pcPages[0]);
        } catch (err) {}
      }

      pcMeasure();
      pcSettle();
      pcLayout(0);

      /* 兜底：如果这一帧还没排好版（web font / 图片未就绪），
         下一帧再量一次。连试几帧，量到就把位置摆正。 */
      var pcTries = 0;
      (function pcRetry() {
        if (pcSized || pcTries++ > 6) return;
        requestAnimationFrame(function () {
          if (pcMeasure()) { pcSettle(); pcLayout(0); }
          else pcRetry();
        });
      })();

      /* 字体加载完宽度会变，行高跟着变 —— 重新量一次并摆位 */
      if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(function () {
          if (pcDragging) return;
          pcMeasure();
          pcSettle();
          pcLayout(0);
        });
      }
    }

    /* ====================================================================
       8. 细碎收尾：按钮水波纹 / 年份 / 锚点平滑定位
       ==================================================================== */
    if (fine && !reduce) {
      document.addEventListener('pointerdown', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.btn') : null;
        if (!btn) return;
        var r = btn.getBoundingClientRect();
        var size = Math.max(r.width, r.height) * 2.2;
        var ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - r.left) + 'px';
        ripple.style.top = (e.clientY - r.top) + 'px';
        btn.appendChild(ripple);
        setTimeout(function () { ripple.remove(); }, 640);
      }, { passive: true });
    }

    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    /* 只处理站内锚点：外链与裸 # 一律放行，交给浏览器默认行为 */
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var headerH = header ? header.offsetHeight : 0;
      var top = target.getBoundingClientRect().top + (window.pageYOffset || d.scrollTop) - headerH - 12;
      window.scrollTo({ top: top < 0 ? 0 : top, behavior: reduce ? 'auto' : 'smooth' });
      if (history.replaceState) history.replaceState(null, '', id);
    });

    window.addEventListener('beforeunload', cleanup);
  }

  /* ---------- 数字滚动（rAF 驱动，三次缓出） ---------- */
  function runCount(el, target, suffix) {
    if (isNaN(target)) return;
    var dur = 1100, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + (suffix || '');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ======================================================================
     诊断面板：只在 URL 带 ?diag=1 时出现。
     目的很单纯 —— 把卡片相关的「浏览器实际算出来的值」直接打在页面上，
     这样截一张图就能定位问题，不用靠猜。
     这段不参与正常渲染，平时完全不执行。
     ====================================================================== */
  function runDiagnostics() {
    var card = document.getElementById('collageCard');
    var vp = document.getElementById('collageViewport');
    if (!card || !vp) return;

    /* ?fit=cover|contain 用来临时切换封面取景方式，方便同屏对比，
       不必改 CSS 再刷新。不传就沿用样式表里的值。 */
    var fit = new URLSearchParams(location.search).get('fit');
    if (fit === 'cover' || fit === 'contain' || fit === 'fill') {
      [].slice.call(vp.querySelectorAll('.pc-cover img')).forEach(function (im) {
        im.style.objectFit = fit;
      });
    }

    var pages = [].slice.call(vp.querySelectorAll('.pc-page'));
    var cs = function (el, prop) { return getComputedStyle(el).getPropertyValue(prop) || '-'; };
    var rect = function (el) {
      var r = el.getBoundingClientRect();
      return Math.round(r.width) + 'x' + Math.round(r.height) +
        ' @' + Math.round(r.top - card.getBoundingClientRect().top);
    };
    var L = [];
    L.push('URL ' + location.href);
    L.push('viewport 存在: ' + !!vp + ' | pc-ready: ' + vp.classList.contains('pc-ready'));
    L.push('-- 卡片/视口 --');
    L.push('card    ' + rect(card) + '  max-width=' + cs(card, 'max-width'));
    L.push('viewport' + rect(vp) + '  overflow=' + cs(vp, 'overflow'));
    L.push('         inline-height="' + (vp.style.height || '(空)') + '"');
    L.push('-- 每一页 --');
    pages.forEach(function (p, i) {
      L.push('page' + i + '   ' + rect(p));
      L.push('         display=' + cs(p, 'display'));
      L.push('         opacity=' + cs(p, 'opacity'));
      L.push('         class="' + p.className + '"');
      L.push('         inline-transform="' + (p.style.transform || '(空)') + '"');
      var cov = p.querySelector('.pc-cover');
      L.push('         cover   ' + (cov ? rect(cov) + ' ar=' + cs(cov, 'aspect-ratio') : '缺失'));
    });
    L.push('-- JS 内部值 --');
    L.push('pcPages=' + pages.length + ' pcCount=' + (window.__pcDbg ? window.__pcDbg.count : '?') +
      ' pcAt=' + (window.__pcDbg ? window.__pcDbg.at : '?') +
      ' pcPageH=' + (window.__pcDbg ? window.__pcDbg.pageH : '?') +
      ' pcSized=' + (window.__pcDbg ? window.__pcDbg.sized : '?'));

    /* 拖动姿态记录：看 s（位移/页高）在哪些区间里两页同时可见。
       「两页 opacity 都 > 0.05」的采样就是重影区间。 */
    var rec = window.__pcDbg && window.__pcDbg.record;
    if (rec && rec.length) {
      L.push('-- 拖动姿态记录（共 ' + rec.length + ' 帧）--');
      var overlap = rec.filter(function (f) {
        return f.pages.filter(function (p) { return p.op > 0.05; }).length > 1;
      });
      L.push('两页同时可见的帧数: ' + overlap.length + ' / ' + rec.length +
        (overlap.length ? '  ← 这些帧就是重影' : '  ← 全程只有一页可见，正常'));
      var pick = function (f) {
        return 's=' + f.s + ' at=' + f.at + '  ' + f.pages.map(function (p, i) {
          return 'p' + i + '{op=' + p.op + ' tr=' + p.tr + '}';
        }).join(' ');
      };
      L.push('最早几帧:');
      rec.slice(0, 4).forEach(function (f) { L.push('  ' + pick(f)); });
      if (overlap.length) {
        L.push('重影区间首帧:');
        L.push('  ' + pick(overlap[0]));
        L.push('重影区间末帧:');
        L.push('  ' + pick(overlap[overlap.length - 1]));
      }
      L.push('最后一帧:');
      L.push('  ' + pick(rec[rec.length - 1]));
    } else {
      L.push('（拖动姿态记录为空 —— 你在这次打开后还没拖动过卡片。');
      L.push('  请先拖一下卡片，再刷新 ?diag=1 就看不到了；');
      L.push('  正确顺序是：打开 ?diag=1 → 拖动卡片几下 → 看这个框里的记录）');
    }

    var box = document.createElement('div');
    box.id = 'diagBox';
    box.style.cssText = 'position:fixed;z-index:99999;left:0;top:0;right:0;max-height:82vh;overflow:auto;' +
      'background:#fff;color:#111;font:12px/1.5 monospace;padding:10px;white-space:pre-wrap;' +
      'border-bottom:2px solid #2563eb';
    box.textContent = 'CENILLA DIAG\n' + L.join('\n');
    document.body.appendChild(box);
  }

  /* ---------- 启动：任何异常都退回到静态可见形态，绝不留下空白页 ---------- */
  try {
    init();
    if (new URLSearchParams(location.search).get('diag') === '1') runDiagnostics();
  } catch (err) {
    showAll();
    if (window.console && console.warn) console.warn('[cenilla] 动效初始化失败，已退回静态显示：', err);
  }

  /* 保险丝：无论 init 是否成功，只要正文还处于隐藏态就把元素放出来 */
  setTimeout(function () {
    var still = d.classList.contains('js-anim') &&
      !document.querySelector('.reveal.in, .hero-ready');
    if (still) showAll();
  }, 3000);

  /* 首屏在 1.2s 内没打开总开关，说明动效链路断了，直接显示 */
  setTimeout(function () {
    if (d.classList.contains('js-anim') && !body.classList.contains('hero-ready')) {
      body.classList.add('hero-ready');
    }
  }, 1200);
})();

