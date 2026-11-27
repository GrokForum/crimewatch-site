/* Daily sweeps: day drop-down and handle search. No network requests. */
(function () {
  "use strict";

  function text(el, value) {
    el.textContent = value == null ? "" : String(value);
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    var key, i;
    if (attrs) {
      for (key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key) && attrs[key] != null) {
          node.setAttribute(key, attrs[key]);
        }
      }
    }
    if (children) {
      for (i = 0; i < children.length; i += 1) {
        if (typeof children[i] === "string") {
          node.appendChild(document.createTextNode(children[i]));
        } else if (children[i]) {
          node.appendChild(children[i]);
        }
      }
    }
    return node;
  }

  function normHandle(value) {
    return String(value || "").replace(/^@+/, "").trim().toLowerCase();
  }

  function itemMatches(item, query) {
    if (!query) {
      return true;
    }
    var handles = item.handles || [];
    var i, h;
    for (i = 0; i < handles.length; i += 1) {
      h = handles[i];
      if (normHandle(h.handle) === query || normHandle(h.display) === query) {
        return true;
      }
      if (normHandle(h.handle).indexOf(query) === 0 || normHandle(h.display).indexOf(query) === 0) {
        return true;
      }
    }
    return false;
  }

  function sourceList(item) {
    var list = el("ul", {"class": "sweep-sources"});
    var i, src, link;
    var sources = item.sources || [];
    for (i = 0; i < sources.length; i += 1) {
      src = sources[i];
      link = el("a", {href: src.url, rel: "noopener noreferrer"});
      text(link, src.title);
      list.appendChild(el("li", null, [link]));
    }
    return list;
  }

  function renderItem(item) {
    var article = el("article", {"class": "sweep-item", "data-id": item.id});
    var heading = el("h3");
    text(heading, item.title);
    article.appendChild(heading);
    if (item.place) {
      var place = el("p", {"class": "note"});
      text(place, item.place);
      article.appendChild(place);
    }
    if (item.label) {
      var slug = String(item.label).toLowerCase().replace(/ /g, "-");
      var lab = el("span", {"class": "label label-" + slug, "data-label": item.label});
      text(lab, item.label);
      article.appendChild(lab);
    }
    var summary = el("p");
    text(summary, item.summary);
    article.appendChild(summary);
    var handles = item.handles || [];
    if (handles.length) {
      var p = el("p", {"class": "sweep-handles"});
      p.appendChild(document.createTextNode("Handles: "));
      var i, disp;
      for (i = 0; i < handles.length; i += 1) {
        if (i) {
          p.appendChild(document.createTextNode(", "));
        }
        disp = handles[i].display || ("@" + handles[i].handle);
        p.appendChild(el("span", {"class": "sweep-handle"}, [disp]));
      }
      article.appendChild(p);
    }
    article.appendChild(el("p", {"class": "src"}, ["Source:"]));
    article.appendChild(sourceList(item));
    return article;
  }

  function renderDay(day, query) {
    var section = el("section", {"class": "sweep-day", "aria-labelledby": "sweep-day-" + day.date});
    var h2 = el("h2", {id: "sweep-day-" + day.date});
    text(h2, day.date + (day.compiled_sast ? " (" + day.compiled_sast + ")" : ""));
    section.appendChild(h2);
    var summary = el("p", {"class": "lede"});
    text(summary, day.summary);
    section.appendChild(summary);
    var items = day.items || [];
    var shown = 0;
    var i;
    for (i = 0; i < items.length; i += 1) {
      if (itemMatches(items[i], query)) {
        section.appendChild(renderItem(items[i]));
        shown += 1;
      }
    }
    if (items.length === 0 && !query) {
      var empty = el("p", {"class": "note"});
      text(empty, "No cited items in this edition.");
      section.appendChild(empty);
    } else if (shown === 0 && query) {
      var none = el("p", {"class": "note"});
      text(none, "No items in this edition mention that handle.");
      section.appendChild(none);
    }
    return {node: section, shown: shown, total: items.length};
  }

  function uniqueHandles(data) {
    var seen = {};
    var list = [];
    var d, i, j, day, item, h, key;
    var days = data.days || [];
    for (i = 0; i < days.length; i += 1) {
      day = days[i];
      for (j = 0; j < (day.items || []).length; j += 1) {
        item = day.items[j];
        for (d = 0; d < (item.handles || []).length; d += 1) {
          h = item.handles[d];
          key = normHandle(h.handle);
          if (key && !seen[key]) {
            seen[key] = true;
            list.push(h.display || ("@" + h.handle));
          }
        }
      }
    }
    list.sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    return list;
  }

  function init() {
    var data = window.CW_SWEEPS;
    var daySelect = document.getElementById("sweep-day");
    var handleInput = document.getElementById("sweep-handle");
    var handleList = document.getElementById("sweep-handles");
    var results = document.getElementById("sweep-results");
    var status = document.getElementById("sweep-status");
    if (!data || !daySelect || !handleInput || !results || !status) {
      return;
    }
    var days = data.days || [];
    var i, opt, handles;
    for (i = 0; i < days.length; i += 1) {
      opt = el("option", {value: days[i].date});
      text(opt, days[i].date);
      daySelect.appendChild(opt);
    }
    if (days.length) {
      daySelect.value = days[0].date;
    }
    handles = uniqueHandles(data);
    if (handleList) {
      for (i = 0; i < handles.length; i += 1) {
        handleList.appendChild(el("option", {value: handles[i]}));
      }
    }

    function dayByDate(date) {
      var k;
      for (k = 0; k < days.length; k += 1) {
        if (days[k].date === date) {
          return days[k];
        }
      }
      return null;
    }

    function redraw() {
      var query = normHandle(handleInput.value);
      var selected = daySelect.value;
      var frag = document.createDocumentFragment();
      var shown = 0;
      var scanned = 0;
      var i, day, part;
      while (results.firstChild) {
        results.removeChild(results.firstChild);
      }
      if (!query) {
        day = dayByDate(selected);
        if (day) {
          part = renderDay(day, "");
          frag.appendChild(part.node);
          shown = part.shown;
          scanned = part.total;
        }
        text(status, shown === 1 ? "1 cited item on " + selected + "." : shown + " cited items on " + selected + ".");
      } else {
        for (i = 0; i < days.length; i += 1) {
          part = renderDay(days[i], query);
          scanned += part.total;
          if (part.shown > 0) {
            frag.appendChild(part.node);
            shown += part.shown;
          }
        }
        if (shown === 0) {
          var none = el("p", {"class": "note"});
          text(none, "No sweep items mention that handle.");
          frag.appendChild(none);
          text(status, "No matches for " + handleInput.value.trim() + " across " + days.length + " days.");
        } else {
          text(status, shown === 1
            ? "1 match for " + handleInput.value.trim() + " across all days."
            : shown + " matches for " + handleInput.value.trim() + " across all days.");
        }
      }
      results.appendChild(frag);
    }

    daySelect.addEventListener("change", redraw);
    handleInput.addEventListener("input", redraw);
    redraw();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
