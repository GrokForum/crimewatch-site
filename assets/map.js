/* CrimeWatch SA heat map. No network requests: data comes from map-data.js. */
(function () {
  "use strict";
  var D = window.CW_DATA;
  var svg = document.getElementById("map");
  if (!D || !svg) { return; }
  var tools = document.querySelector(".map-tools");
  var select = document.getElementById("layer");
  var legend = document.getElementById("legend");
  var nodata = document.getElementById("nodata");
  var detail = document.getElementById("detail");
  var base = svg.getAttribute("data-viewbox").split(" ").map(Number);
  var vb = base.slice();
  var selected = null;
  tools.hidden = false;

  function layerInfo(key) {
    for (var i = 0; i < D.layers.length; i++) { if (D.layers[i].key === key) { return D.layers[i]; } }
    return null;
  }
  function num(n) { return Number(n).toLocaleString("en-ZA"); }
  function el(tag, text, cls) {
    var x = document.createElement(tag);
    if (text !== undefined && text !== null) { x.textContent = text; }
    if (cls) { x.className = cls; }
    return x;
  }
  function change(a, b) {
    if (!b) { return a ? "new" : "0"; }
    var p = (a - b) / b * 100;
    return (p > 0 ? "+" : "") + p.toFixed(1) + "%";
  }
  function setViewBox(v) {
    vb = v;
    svg.setAttribute("viewBox", v.map(function (n) { return n.toFixed(1); }).join(" "));
  }
  function zoom(f, cx, cy) {
    var w = vb[2] * f, h = vb[3] * f;
    if (w > base[2] * 1.2) { setViewBox(base.slice()); return; }
    if (w < base[2] / 40) { return; }
    if (cx === undefined) { cx = vb[0] + vb[2] / 2; cy = vb[1] + vb[3] / 2; }
    setViewBox([cx - (cx - vb[0]) * f, cy - (cy - vb[1]) * f, w, h]);
  }
  function toSvg(evt) {
    var r = svg.getBoundingClientRect();
    return [vb[0] + (evt.clientX - r.left) / r.width * vb[2], vb[1] + (evt.clientY - r.top) / r.height * vb[3]];
  }

  function paint() {
    var key = select.value, info = layerInfo(key);
    var paths = svg.querySelectorAll(".prov");
    legend.textContent = "";
    if (!info.available) {
      paths.forEach(function (p) { p.setAttribute("class", "prov cx" + (p.getAttribute("data-province") === selected ? " sel" : "")); });
      nodata.hidden = false;
      nodata.textContent = info.label + ": no station-level SAPS data in this release. Shown empty, not as zero.";
      legend.textContent = D.noData;
      renderDetail();
      return;
    }
    nodata.hidden = true;
    var rates = Object.keys(D.provinces).map(function (k) { return D.provinces[k].values[key][2]; }).sort(function (a, b) { return a - b; });
    var lo = rates[0], hi = rates[rates.length - 1];
    function cls(r) { if (hi === lo) { return 2; } return Math.min(4, Math.floor((r - lo) / (hi - lo) * 5)); }
    paths.forEach(function (p) {
      var name = p.getAttribute("data-province");
      var v = D.provinces[name].values[key];
      p.setAttribute("class", "prov c" + cls(v[2]) + (name === selected ? " sel" : ""));
      var t = p.querySelector("title") || p.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "title"));
      t.textContent = name + ": " + num(v[0]) + " recorded (" + v[2] + " per 100,000, arithmetic)";
    });
    legend.appendChild(el("strong", "Per 100,000 (arithmetic) "));
    for (var i = 0; i < 5; i++) {
      legend.appendChild(el("span", "", "c" + i));
    }
    legend.appendChild(el("em", " " + lo + " – " + hi));
    renderDetail();
  }

  function table(headers, rows) {
    var t = el("table"), th = el("thead"), tr = el("tr"), tb = el("tbody");
    headers.forEach(function (h, i) { tr.appendChild(el("th", h, i ? "n" : "")); });
    th.appendChild(tr); t.appendChild(th);
    rows.forEach(function (r) {
      var row = el("tr");
      r.forEach(function (c, i) { row.appendChild(el("td", c, i ? "n" : "")); });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    return t;
  }

  function renderDetail() {
    detail.textContent = "";
    var key = select.value, info = layerInfo(key);
    var head = el("h2", selected ? selected + ": " + info.label : "South Africa: " + info.label + " by province");
    detail.appendChild(head);
    if (!info.available) {
      detail.appendChild(el("p", D.noData + " for this crime type. See the high-profile page for official provincial or national figures and civil-society counts."));
      return;
    }
    if (!selected) {
      var rows = Object.keys(D.provinces).sort().map(function (n) {
        var v = D.provinces[n].values[key];
        return [n, num(v[0]), num(v[1]), change(v[0], v[1]), String(v[2])];
      });
      detail.appendChild(table(["Province", "Jul–Sep 2026", "Jul–Sep 2025", "Change", "Per 100,000 (arithmetic)"], rows));
      detail.appendChild(el("p", "Click a province on the map to see its police districts and stations.", "note"));
      return;
    }
    var dists = D.districts.filter(function (d) { return d.p === selected; })
      .sort(function (a, b) { return b.v[key][0] - a.v[key][0]; });
    detail.appendChild(el("h3", "Police districts"));
    detail.appendChild(table(["District", "Jul–Sep 2026", "Jul–Sep 2025", "Change", "Note"],
      dists.map(function (d) {
        var disp = D.districtDisputes[d.d + "|" + key];
        var note = disp ? "Disputed: district row " + num(disp[0]) + ", station rows sum " + num(disp[1]) : "";
        return [d.d, num(d.v[key][0]), num(d.v[key][1]), change(d.v[key][0], d.v[key][1]), note];
      })));
    var sts = D.stations.filter(function (s) { return s.p === selected; })
      .sort(function (a, b) { return b.v[key][0] - a.v[key][0] || (a.s < b.s ? -1 : 1); });
    detail.appendChild(el("h3", "Police stations (" + sts.length + ")"));
    var wrap = el("div", null, "detail-tools");
    var lab = el("label", "Filter stations ");
    var inp = el("input");
    inp.type = "search"; inp.id = "station-filter";
    lab.htmlFor = "station-filter";
    wrap.appendChild(lab); wrap.appendChild(inp);
    detail.appendChild(wrap);
    var holder = el("div");
    detail.appendChild(holder);
    function draw() {
      var q = inp.value.trim().toLowerCase();
      holder.textContent = "";
      holder.appendChild(table(["Station", "District", "Jul–Sep 2026", "Jul–Sep 2025", "Change"],
        sts.filter(function (s) { return !q || s.s.toLowerCase().indexOf(q) >= 0 || s.d.toLowerCase().indexOf(q) >= 0; })
          .map(function (s) { return [s.s, s.d, num(s.v[key][0]), num(s.v[key][1]), change(s.v[key][0], s.v[key][1])]; })));
    }
    inp.addEventListener("input", draw);
    draw();
    detail.appendChild(el("p", "Counts are crimes recorded by SAPS at each station (charges counted, not court findings). Source: SAPS Q2 2026/27 workbook, RAW Data sheet.", "note"));
  }

  function selectProvince(p) {
    selected = p.getAttribute("data-province");
    var b = p.getBBox(), pad = Math.max(b.width, b.height) * 0.1;
    var w = b.width + 2 * pad, h = b.height + 2 * pad, ratio = base[2] / base[3];
    if (w / h > ratio) { h = w / ratio; } else { w = h * ratio; }
    setViewBox([b.x + b.width / 2 - w / 2, b.y + b.height / 2 - h / 2, w, h]);
    paint();
  }

  svg.querySelectorAll(".prov").forEach(function (p) {
    p.addEventListener("click", function () { if (!dragged) { selectProvince(p); } });
    p.addEventListener("keydown", function (evt) { if (evt.key === "Enter" || evt.key === " ") { evt.preventDefault(); selectProvince(p); } });
  });
  select.addEventListener("change", paint);
  document.getElementById("zoom-in").addEventListener("click", function () { zoom(0.7); });
  document.getElementById("zoom-out").addEventListener("click", function () { zoom(1 / 0.7); });
  document.getElementById("zoom-reset").addEventListener("click", function () { selected = null; setViewBox(base.slice()); paint(); });
  svg.addEventListener("wheel", function (evt) {
    evt.preventDefault();
    var pt = toSvg(evt);
    zoom(evt.deltaY < 0 ? 0.85 : 1 / 0.85, pt[0], pt[1]);
  }, { passive: false });
  var drag = null, dragged = false;
  svg.addEventListener("pointerdown", function (evt) { drag = [evt.clientX, evt.clientY, vb.slice()]; dragged = false; });
  window.addEventListener("pointermove", function (evt) {
    if (!drag) { return; }
    var r = svg.getBoundingClientRect();
    var dx = (evt.clientX - drag[0]) / r.width * vb[2], dy = (evt.clientY - drag[1]) / r.height * vb[3];
    if (Math.abs(evt.clientX - drag[0]) + Math.abs(evt.clientY - drag[1]) > 4) { dragged = true; }
    if (dragged) { setViewBox([drag[2][0] - dx, drag[2][1] - dy, vb[2], vb[3]]); }
  });
  window.addEventListener("pointerup", function () { drag = null; });
  paint();
}());
