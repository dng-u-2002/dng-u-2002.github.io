/* 김동우 포트폴리오 — 영상 자동재생, 슬라이더, 확대 보기
   영상: assets/square/SQ-xx.mp4 같은 로컬 파일을 재생하고,
   파일이 없으면 data-drive-id 의 Google Drive 플레이어로 대체합니다. */
(function () {
  'use strict';

  /* ---------- 영상 자동재생: 화면에 보이는 동안만 소리 없이 반복 재생 ---------- */
  var autoVideos = Array.prototype.slice.call(document.querySelectorAll('video[data-autoplay]'));

  function playVideo(v) {
    if (v._userPaused || !v.isConnected) return;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  function pauseVideo(v) {
    if (v.paused) return;
    v._autoPausing = true;
    v.pause();
  }

  function isShown(v) {
    return v._inView && !v.closest('[hidden]') && document.visibilityState !== 'hidden';
  }

  autoVideos.forEach(function (v) {
    v.muted = true;
    v.playsInline = true;
    v.loop = true;
    /* 사용자가 컨트롤로 직접 멈춘 영상은 다시 자동재생하지 않습니다 */
    v.addEventListener('pause', function () {
      if (!v._autoPausing && !v.ended && v.controls) v._userPaused = true;
      v._autoPausing = false;
    });
    v.addEventListener('play', function () { v._userPaused = false; });
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        v._inView = en.isIntersecting;
        if (isShown(v)) playVideo(v); else pauseVideo(v);
      });
    }, { threshold: 0.2 });
    autoVideos.forEach(function (v) { io.observe(v); });
  } else {
    autoVideos.forEach(function (v) { v._inView = true; playVideo(v); });
  }

  document.addEventListener('visibilitychange', function () {
    autoVideos.forEach(function (v) { if (isShown(v)) playVideo(v); else pauseVideo(v); });
  });

  /* ---------- YouTube 임베드(data-yt-autoplay): 화면에 보이는 동안만 재생 ---------- */
  var ytFrames = Array.prototype.slice.call(document.querySelectorAll('iframe[data-yt-autoplay]'));

  function ytCmd(f, func) {
    try { f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: [] }), '*'); } catch (e) {}
  }

  function ytShown(f) {
    return f._inView && !f.closest('[hidden]') && document.visibilityState !== 'hidden' && !document.querySelector('dialog[data-lightbox][open]');
  }

  function ytSync(f) { ytCmd(f, ytShown(f) ? 'playVideo' : 'pauseVideo'); }

  if ('IntersectionObserver' in window) {
    var ytIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target._inView = en.isIntersecting; ytSync(en.target); });
    }, { threshold: 0.2 });
    ytFrames.forEach(function (f) { ytIo.observe(f); });
  } else {
    ytFrames.forEach(function (f) { f._inView = true; });
  }

  /* 플레이어가 준비되기 전 명령은 무시되므로, 불러온 뒤 한 번 더 맞춥니다 */
  ytFrames.forEach(function (f) {
    f.addEventListener('load', function () { setTimeout(function () { ytSync(f); }, 800); });
  });

  document.addEventListener('visibilitychange', function () { ytFrames.forEach(ytSync); });

  /* ---------- 영상: 로컬 mp4 → 실패 시 Google Drive 플레이어 ---------- */
  function driveFrame(id, title) {
    var f = document.createElement('iframe');
    f.src = 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview';
    f.title = title || '영상';
    f.className = 'media-fill';
    f.setAttribute('allow', 'autoplay; fullscreen');
    return f;
  }

  /* 페이지에 직접 넣은 영상: 로컬 파일이 없으면 Drive 플레이어로 교체 */
  function swapToDrive(v) {
    var id = v.getAttribute('data-drive-id');
    if (!id || !v.parentNode) return;
    var f = driveFrame(id, v.getAttribute('aria-label'));
    v.parentNode.replaceChild(f, v);
    var i = autoVideos.indexOf(v);
    if (i !== -1) autoVideos.splice(i, 1);
  }

  document.querySelectorAll('video[data-drive-id]').forEach(function (v) {
    var sources = v.querySelectorAll('source');
    var last = sources[sources.length - 1];
    if (v.networkState === 3) { swapToDrive(v); return; } /* NETWORK_NO_SOURCE: 이미 실패 */
    if (last) last.addEventListener('error', function () { swapToDrive(v); });
  });

  /* 확대 보기용 영상 (소리 있음, 컨트롤 표시) */
  function mountVideo(host, opts) {
    opts = opts || {};
    var v = document.createElement('video');
    v.className = 'media-fill';
    v.controls = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    if (host.getAttribute('data-poster')) v.poster = host.getAttribute('data-poster');
    var s = document.createElement('source');
    s.src = host.getAttribute('data-video-src');
    s.type = 'video/mp4';
    s.addEventListener('error', function () {
      var id = host.getAttribute('data-drive-id');
      if (id && v.parentNode === host) host.replaceChild(driveFrame(id, host.getAttribute('data-title')), v);
    });
    v.appendChild(s);
    host.appendChild(v);
    if (opts.play) {
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    return v;
  }

  /* ---------- 슬라이더 ---------- */
  document.querySelectorAll('[data-slider]').forEach(function (root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-slide]'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('[data-dot]'));
    var counter = root.querySelector('[data-counter]');
    var stage = root.querySelector('[data-stage]');
    var idx = 0;
    var n = slides.length;
    if (!n) return;

    function stopMedia(slide) {
      var v = slide.querySelector('video');
      if (v) pauseVideo(v);
      var f = slide.querySelector('iframe');
      if (f && f.hasAttribute('data-yt-autoplay')) ytCmd(f, 'pauseVideo');
      else if (f) { var src = f.src; f.src = src; }
    }

    function show(i) {
      var next = (i + n) % n;
      if (next !== idx) stopMedia(slides[idx]);
      idx = next;
      slides.forEach(function (s, k) {
        s.hidden = k !== idx;
        s.setAttribute('aria-hidden', k === idx ? 'false' : 'true');
      });
      dots.forEach(function (d, k) { d.setAttribute('aria-current', k === idx ? 'true' : 'false'); });
      if (counter) counter.textContent = (idx + 1) + ' / ' + n;
      var v = slides[idx].querySelector('video[data-autoplay]');
      if (v && isShown(v)) playVideo(v);
      var yf = slides[idx].querySelector('iframe[data-yt-autoplay]');
      if (yf) ytSync(yf);
    }

    var prev = root.querySelector('[data-prev]');
    var next = root.querySelector('[data-next]');
    if (prev) prev.addEventListener('click', function () { show(idx - 1); });
    if (next) next.addEventListener('click', function () { show(idx + 1); });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { show(k); }); });

    root.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('video, iframe')) return;
      if (e.key === 'ArrowLeft') { show(idx - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { show(idx + 1); e.preventDefault(); }
    });

    /* 터치 스와이프 */
    if (stage) {
      var x0 = null, y0 = null;
      stage.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
      }, { passive: true });
      stage.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0;
        var dy = e.changedTouches[0].clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) show(dx < 0 ? idx + 1 : idx - 1);
      });
    }

    show(0);
  });

  /* ---------- 설문 막대: 점수 글자("4.51 / 5")에 맞춰 길이를 맞춤 ---------- */
  document.querySelectorAll('.bar').forEach(function (bar) {
    var score = bar.querySelector('.bar-score');
    var track = bar.querySelector('.bar-track');
    var fill = track && track.querySelector('span');
    var m = score && score.textContent.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (!m || !fill || !+m[2]) return;
    fill.style.width = Math.max(0, Math.min(100, (+m[1] / +m[2]) * 100)) + '%';
    var name = bar.querySelector('.bar-name');
    var unit = bar.getAttribute('data-unit');
    track.setAttribute('aria-label', (name ? name.textContent.trim() + ' ' : '') +
      (unit ? m[1] + '/' + m[2] + unit : m[1] + '점, ' + m[2] + '점 만점'));
  });

  /* ---------- 확대 보기 (라이트박스) ---------- */
  var dlg = document.querySelector('[data-lightbox]');
  if (dlg && typeof dlg.showModal === 'function') {
    var media = dlg.querySelector('[data-lightbox-media]');
    var caption = dlg.querySelector('[data-lightbox-caption]');

    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-zoom]');
      if (!t) return;
      e.preventDefault();
      media.innerHTML = '';
      var isVideo = t.hasAttribute('data-video-src');
      media.classList.toggle('is-video', isVideo);
      if (isVideo) {
        var host = document.createElement('div');
        host.className = 'lightbox-video';
        host.setAttribute('data-video-src', t.getAttribute('data-video-src'));
        if (t.hasAttribute('data-drive-id')) host.setAttribute('data-drive-id', t.getAttribute('data-drive-id'));
        host.setAttribute('data-title', t.getAttribute('data-caption') || '영상');
        var thumbVideo = t.querySelector('video');
        if (thumbVideo && thumbVideo.poster) host.setAttribute('data-poster', thumbVideo.poster);
        media.appendChild(host);
        mountVideo(host, { play: true });
      } else {
        var src = t.querySelector('img');
        var img = new Image();
        /* 배포본은 작은 사본을 먼저 보여 주므로, 확대 보기는 data-full 의 큰 이미지를 씁니다 */
        img.src = (src && (src.getAttribute('data-full') || src.currentSrc || src.src)) || '';
        img.alt = (src && src.alt) || '';
        media.appendChild(img);
      }
      caption.textContent = t.getAttribute('data-caption') || '';
      autoVideos.forEach(pauseVideo);
      ytFrames.forEach(function (f) { ytCmd(f, 'pauseVideo'); });
      dlg.showModal();
    });

    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || (e.target.closest && e.target.closest('[data-lightbox-close]'))) dlg.close();
    });
    dlg.addEventListener('close', function () {
      media.innerHTML = '';
      autoVideos.forEach(function (v) { if (isShown(v)) playVideo(v); });
      ytFrames.forEach(ytSync);
    });
  }
})();
