/* Carcará FC — JavaScript puro, sem dependências.
 * 1) hero: o cartaz que rasga conforme a rolagem e revela o escudo
 * 2) reveal: entrada suave das seções
 * 3) camisas: alternar frente / costas
 */
(function () {
  "use strict"

  // ------------------------------------------------------------ helpers
  function rng(seed) {
    var a = seed >>> 0
    return function () {
      a = (a + 0x6d2b79f5) >>> 0
      var t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  var clamp01 = function (x) { return x <= 0 ? 0 : x > 1 ? 1 : x }
  function smooth(a, b, x) {
    var t = clamp01((x - a) / (b - a))
    return t * t * (3 - 2 * t)
  }
  function easeOutBack(t) {
    var c = 1.70158
    var u = clamp01(t) - 1
    return 1 + (c + 1) * u * u * u + c * u * u
  }
  function scrollProgress(top, height, viewport) {
    var range = height - viewport
    if (range <= 0) return top <= 0 ? 1 : 0
    return clamp01(-top / range)
  }
  function stages(p) {
    return {
      crack: smooth(0.03, 0.2, p),
      open: smooth(0.18, 0.62, p),
      rise: smooth(0.26, 0.74, p),
      pop: smooth(0.58, 0.88, p),
      shake: smooth(0.16, 0.22, p) * (1 - smooth(0.26, 0.36, p)),
    }
  }
  var f2 = function (n) { return n.toFixed(2) }
  var pathOf = function (pts, close) {
    return "M" + pts.map(function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1) }).join("L") + (close === false ? "" : "Z")
  }

  // ------------------------------------------------------------ the tear
  function tearLine(seed, from, to, step, cx, cy, angle) {
    var r = rng(seed)
    var slope = Math.tan((angle * Math.PI) / 180)
    var out = []
    for (var x = from; x <= to; x += step) {
      var fibre = (r() - 0.5) * 5
      var tooth = r() < 0.09 ? (r() - 0.5) * 26 : 0
      var wander = Math.sin(x * 0.019 + seed) * 10 + Math.sin(x * 0.053 + seed * 2) * 4
      out.push([x, cy + (x - cx) * slope + wander + fibre + tooth])
    }
    return out
  }
  function pieceMotion(open, gap) {
    return {
      top: { dx: -10 * open, dy: -82 * open * gap, rot: -2.6 * open },
      bottom: { dx: 12 * open, dy: 78 * open * gap, rot: 2.1 * open },
    }
  }
  function fibreWidths(n, open, seed) {
    var r = rng(seed)
    var k = Math.min(1, open * 4)
    var out = []
    for (var i = 0; i < n; i++) out.push(k * (2.5 + 6 * (0.5 + 0.5 * Math.sin(i * 0.37 + seed)) * (0.6 + r() * 0.8)))
    return out
  }

  // ------------------------------------------------------------ the scene behind the paper
  function band(x0, width, seed) {
    var r = rng(seed)
    function edge(offset) {
      var pts = []
      for (var y = -420; y <= 420; y += 28) {
        var tooth = r() < 0.22 ? (r() - 0.5) * 46 : 0
        pts.push([x0 + offset + (y + 420) * 0.34 + (r() - 0.5) * 12 + tooth, y])
      }
      return pts
    }
    return { left: edge(0), right: edge(width) }
  }
  function buildBands() {
    var defs = [[-1380, 210, 3], [-760, 140, 8], [-470, 60, 14], [300, 80, 21], [560, 190, 34], [1180, 120, 41]]
    return defs.map(function (b) {
      var e = band(b[0], b[1], b[2])
      var fill = pathOf(e.left, false) + "L" + e.right.slice().reverse().map(function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1) }).join("L") + "Z"
      return { fill: fill, left: pathOf(e.left, false), right: pathOf(e.right, false), thin: b[1] < 100 }
    })
  }
  function buildHatch() {
    var r = rng(97)
    var s = ""
    for (var i = 0; i < 900; i++) {
      var x = (r() - 0.5) * 2600
      var y = (r() - 0.5) * 840
      var len = 6 + r() * 20
      s += "M" + x.toFixed(0) + " " + y.toFixed(0) + "l" + (len * 0.3).toFixed(1) + " " + len.toFixed(1)
    }
    return s
  }

  // ------------------------------------------------------------ hero
  function initHero() {
    var root = document.querySelector("[data-hero]")
    var svg = root && root.querySelector("[data-hero-svg]")
    if (!root || !svg) return
    var stage = root.querySelector(".hero-stage")
    var hint = root.querySelector("[data-hero-hint]")

    var WORD = "CARCARÁ"
    var TAGLINE = "FUTSAL CLUB · 26/27"
    var INK = "#15120e", PAPER = "#ece3d0", TAGLINE_COLOR = "#2a241b"
    var VIEW_W = 1000, CX = 500, CY = 318, FAR = 4000

    var line = tearLine(11, -800, 1800, 9, CX, CY, -7)

    // curl sections: [x along the tear, half-width, depth]
    var CURLS = {
      top: [[300, 44, 30], [575, 30, 20], [790, 52, 34]],
      bottom: [[205, 50, 32], [470, 34, 22], [690, 40, 28]],
    }
    var curlPts = {}
    ;["top", "bottom"].forEach(function (side) {
      curlPts[side] = CURLS[side].map(function (c) {
        return { cx: c[0], hw: c[1], depth: c[2], pts: line.filter(function (q) { return Math.abs(q[0] - c[0]) <= c[1] }) }
      })
    })

    var last = line[line.length - 1][0], first = line[0][0]
    var topShape = [[first, -FAR], [last, -FAR]].concat(line.slice().reverse())
    var bottomShape = line.concat([[last, FAR], [first, FAR]])

    var sheet =
      '<rect x="' + -FAR + '" y="' + -FAR + '" width="' + (FAR * 2 + VIEW_W) + '" height="' + FAR * 2 + '" fill="' + PAPER + '"/>' +
      '<text x="' + CX + '" y="118" text-anchor="middle" fill="' + TAGLINE_COLOR + '" style="font:700 30px \'Helvetica Neue\',Helvetica,Arial,sans-serif;letter-spacing:.42em">' + TAGLINE + "</text>" +
      '<text x="' + CX + '" y="404" text-anchor="middle" textLength="880" lengthAdjust="spacingAndGlyphs" fill="' + INK + '" style="font-family:Anton,Impact,\'Arial Narrow\',sans-serif;font-size:250px;font-weight:400">' + WORD + "</text>"

    var bands = buildBands()
    var bandsSvg = bands.map(function (b) {
      return (
        '<path d="' + b.fill + '" fill="#15120e"/>' +
        '<path d="' + b.left + '" fill="none" stroke="#f3ead6" stroke-width="' + (b.thin ? 4 : 5) + '" stroke-linejoin="bevel"/>' +
        '<path d="' + b.left + '" fill="none" stroke="#b98a2c" stroke-width="2" stroke-linejoin="bevel" transform="translate(-9 0)"/>' +
        (b.thin ? "" : '<path d="' + b.right + '" fill="none" stroke="#f3ead6" stroke-width="3" stroke-linejoin="bevel" opacity=".85"/>')
      )
    }).join("")

    function half(side) {
      var curls = curlPts[side].map(function () { return '<path data-curl fill="url(#h-curl-' + side + ')" stroke="#fff" stroke-width="1"/>' }).join("")
      return (
        '<g data-half="' + side + '">' +
        '<path data-shadow d="' + pathOf(line, false) + '" fill="none" stroke="#000" stroke-width="22" transform="translate(0 ' + (side === "top" ? 10 : -10) + ')" filter="url(#h-soft)"/>' +
        '<g clip-path="url(#h-clip-' + side + ')">' + sheet + "</g>" +
        '<path data-core fill="#fff"/>' + curls +
        "</g>"
      )
    }

    svg.innerHTML =
      "<defs>" +
      '<linearGradient id="h-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a87a22"/><stop offset=".5" stop-color="#d6ad55"/><stop offset="1" stop-color="#8d6519"/></linearGradient>' +
      '<radialGradient id="h-vig" cx=".5" cy=".5" r=".5" gradientTransform="translate(.5 .5) scale(.22 1) translate(-.5 -.5)"><stop offset=".45" stop-color="#120e08" stop-opacity="0"/><stop offset="1" stop-color="#120e08" stop-opacity=".6"/></radialGradient>' +
      '<filter id="h-drop" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#120e08" flood-opacity=".55"/></filter>' +
      '<filter id="h-soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>' +
      '<linearGradient id="h-curl-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d9d4cb"/></linearGradient>' +
      '<linearGradient id="h-curl-bottom" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d9d4cb"/></linearGradient>' +
      '<clipPath id="h-clip-top"><path d="' + pathOf(topShape) + '"/></clipPath>' +
      '<clipPath id="h-clip-bottom"><path d="' + pathOf(bottomShape) + '"/></clipPath>' +
      "</defs>" +
      '<g data-shake>' +
      '<g data-behind style="display:none">' +
      '<rect x="-2600" y="-420" width="5200" height="840" fill="url(#h-gold)"/>' +
      '<path d="' + buildHatch() + '" stroke="#120e08" stroke-width="1.3" opacity=".14" stroke-linecap="round" fill="none"/>' +
      bandsSvg +
      '<rect x="-2600" y="-420" width="5200" height="840" fill="url(#h-vig)"/>' +
      '<g data-crest><image href="assets/escudo.png" x="-72" y="-88" width="144" height="176" preserveAspectRatio="xMidYMid meet" filter="url(#h-drop)"/></g>' +
      "</g>" +
      '<g data-whole>' + sheet + "</g>" +
      '<g data-halves style="display:none">' + half("top") + half("bottom") + "</g>" +
      '<path data-crack fill="none" stroke="#1d0f07" stroke-width="2.4" stroke-linejoin="bevel" style="display:none"/>' +
      "</g>"

    var q = function (sel) { return svg.querySelector(sel) }
    var elShake = q("[data-shake]"), elBehind = q("[data-behind]"), elCrest = q("[data-crest]")
    var elWhole = q("[data-whole]"), elHalves = q("[data-halves]"), elCrack = q("[data-crack]")
    var halves = {}
    ;["top", "bottom"].forEach(function (side) {
      var g = q('[data-half="' + side + '"]')
      halves[side] = { g: g, shadow: g.querySelector("[data-shadow]"), core: g.querySelector("[data-core]"), curls: g.querySelectorAll("[data-curl]") }
    })

    // ---- state
    var mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    var mqPortrait = window.matchMedia("(max-aspect-ratio: 1/1)")
    var reduced = mqMotion.matches, portrait = mqPortrait.matches
    mqMotion.addEventListener("change", function (e) { reduced = e.matches; dirty = true })
    mqPortrait.addEventListener("change", function (e) { portrait = e.matches; dirty = true })

    var pointer = null
    var squintAt = -1e9
    var p = 0, look = [0, 0], idle = [0, 0], nextIdle = 0
    var visible = true, raf = 0, dirty = true, lastKey = ""
    var lastS = stages(0)

    stage.addEventListener("pointermove", function (e) { pointer = { x: e.clientX, y: e.clientY } })
    stage.addEventListener("pointerleave", function () { pointer = null })
    stage.addEventListener("pointerdown", function () { if (lastS.pop > 0.5) squintAt = performance.now() })

    function render(now) {
      var s = lastS = stages(p)
      var gap = portrait ? 4 : 1.65
      var boost = portrait ? 2.3 : 1
      var pop = reduced ? s.pop : easeOutBack(s.pop)
      var squint = reduced ? 0 : Math.max(0, 1 - (now - squintAt) / 900)
      var opened = s.open > 0

      elBehind.style.display = opened ? "" : "none"
      elWhole.style.display = opened ? "none" : ""
      elHalves.style.display = opened ? "" : "none"

      var shake = reduced ? 0 : Math.sin(p * 900) * 6 * s.shake
      elShake.setAttribute("transform", "translate(" + f2(shake) + " " + f2(shake * 0.4) + ")")

      if (opened) {
        var rise = (1 - s.rise) * 150
        elBehind.setAttribute("transform", "translate(" + CX + " " + f2(CY + rise) + ") rotate(-7) scale(" + (1.34 - 0.06 * s.rise).toFixed(4) + ")")
        var tilt = reduced ? 0 : look[0] * 4
        var dx = reduced ? 0 : look[0] * 10
        var dy = reduced ? 0 : look[1] * 6
        var sc = (0.9 + 0.1 * pop) * (1 - squint * 0.04) * boost
        elCrest.setAttribute("transform", "translate(" + f2(dx) + " " + f2(dy + (1 - s.rise) * 30) + ") rotate(" + f2(7 + tilt) + ") scale(" + sc.toFixed(4) + ")")

        var motion = pieceMotion(s.open, gap)
        ;["top", "bottom"].forEach(function (side) {
          var up = side === "top"
          var m = motion[side], h = halves[side]
          h.g.setAttribute("transform", "translate(" + f2(m.dx) + " " + f2(m.dy) + ") rotate(" + m.rot.toFixed(3) + " " + CX + " " + CY + ")")
          h.shadow.setAttribute("stroke-opacity", (0.55 * Math.min(1, s.open * 3)).toFixed(3))
          var w = fibreWidths(line.length, s.open, up ? 5 : 8)
          var edge = line.map(function (pt, i) { return [pt[0], pt[1] + (up ? -w[i] : w[i])] })
          h.core.setAttribute("d", pathOf(line.concat(edge.reverse())))
          curlPts[side].forEach(function (c, i) {
            var back = c.pts.map(function (pt) {
              var cs = Math.cos(((pt[0] - c.cx) / c.hw) * (Math.PI / 2))
              return [pt[0] + (up ? 6 : -6) * cs * s.open, pt[1] + (up ? 1 : -1) * c.depth * cs * cs * Math.min(1, s.open * 2.5)]
            })
            h.curls[i].setAttribute("d", pathOf(c.pts.concat(back.reverse())))
          })
        })
      }

      // the crack, running out from the middle before the sheet gives way
      if (s.crack > 0 && s.open < 0.15) {
        var reach = s.crack * 620
        var crack = line.filter(function (pt) { return Math.abs(pt[0] - CX) <= reach })
        if (crack.length > 1) {
          elCrack.setAttribute("d", pathOf(crack, false))
          elCrack.setAttribute("opacity", (1 - s.open / 0.15).toFixed(3))
          elCrack.style.display = ""
        }
      } else {
        elCrack.style.display = "none"
      }

      if (hint) hint.style.opacity = Math.max(0, 0.7 - s.crack * 3).toFixed(3)
      stage.style.cursor = s.pop > 0.9 ? "crosshair" : ""
    }

    function tick(now) {
      raf = 0
      if (!visible) return
      var target = scrollProgress(root.getBoundingClientRect().top, root.offsetHeight, stage.offsetHeight)
      var np = reduced ? (target > 0.3 ? 1 : 0) : p + (target - p) * 0.14
      if (Math.abs(target - np) < 0.0005) np = target

      var want
      if (pointer) {
        var r = stage.getBoundingClientRect()
        want = [
          Math.max(-1, Math.min(1, (pointer.x - r.left - r.width / 2) / (r.width * 0.35))),
          Math.max(-1, Math.min(1, (pointer.y - r.top - r.height * 0.58) / (r.height * 0.35))),
        ]
      } else {
        if (now > nextIdle && !reduced) {
          var g = rng(Math.floor(now))
          idle = [(g() - 0.5) * 1.4, (g() - 0.5) * 0.8]
          nextIdle = now + 1400 + g() * 1800
        }
        want = reduced ? [0, 0] : idle
      }
      var nl = [look[0] + (want[0] - look[0]) * 0.14, look[1] + (want[1] - look[1]) * 0.14]
      var squinting = !reduced && now - squintAt < 900

      var key = [np.toFixed(4), nl[0].toFixed(3), nl[1].toFixed(3), squinting ? Math.round(now / 16) : 0, portrait, reduced].join("|")
      if (dirty || key !== lastKey) {
        p = np
        look = nl
        lastKey = key
        dirty = false
        render(now)
      }
      raf = requestAnimationFrame(tick)
    }

    var io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting
      if (visible && !raf) raf = requestAnimationFrame(tick)
    })
    io.observe(root)
    raf = requestAnimationFrame(tick)
  }

  // ------------------------------------------------------------ reveal on scroll
  function initReveal() {
    var els = document.querySelectorAll("[data-reveal]")
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("in") })
      return
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in")
            io.unobserve(e.target)
          }
        })
      },
      { rootMargin: "0px 0px -80px 0px" }
    )
    els.forEach(function (el) { io.observe(el) })
  }

  // ------------------------------------------------------------ kits: frente / costas
  function initKits() {
    document.querySelectorAll("[data-kit]").forEach(function (kit) {
      var imgs = kit.querySelectorAll("[data-side]")
      var btns = kit.querySelectorAll("[data-to]")
      btns.forEach(function (b) {
        b.addEventListener("click", function () {
          var to = b.getAttribute("data-to")
          imgs.forEach(function (img) { img.classList.toggle("on", img.getAttribute("data-side") === to) })
          btns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)) })
        })
      })
    })
  }

  initHero()
  initReveal()
  initKits()
})()
