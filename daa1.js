(function () {
  "use strict";

  /* ---------- Dataset: 20 topics x 5 angles = 100 documents ---------- */
  const TOPICS = [
    ["Machine Learning", "Algorithms that learn patterns from data to make predictions.", ["machine", "learning", "model", "training"]],
    ["Deep Learning", "Layered neural networks that learn features automatically.", ["deep", "learning", "neural", "network"]],
    ["Data Structures", "Ways of organising data such as arrays and trees for fast access.", ["data", "structures", "array", "tree"]],
    ["Database Systems", "Storing, indexing and querying data with SQL.", ["database", "sql", "query", "index"]],
    ["Operating Systems", "Managing processes, memory and hardware resources.", ["operating", "system", "process", "memory"]],
    ["Computer Networks", "Protocols and routing that connect machines together.", ["computer", "network", "protocol", "routing"]],
    ["Cyber Security", "Protecting systems with encryption and firewalls.", ["cyber", "security", "encryption", "firewall"]],
    ["Cloud Computing", "Renting virtual servers and services over the internet.", ["cloud", "computing", "server", "virtual"]],
    ["Web Development", "Building sites with HTML that run in the browser.", ["web", "development", "html", "browser"]],
    ["Artificial Intelligence", "Agents that perceive, reason and act toward goals.", ["artificial", "intelligence", "agent", "reasoning"]],
    ["Natural Language Processing", "Teaching computers to read and generate text.", ["natural", "language", "text", "token"]],
    ["Computer Vision", "Detecting and understanding objects in an image.", ["computer", "vision", "image", "detection"]],
    ["Big Data", "Analytics on huge data sets using clusters of machines.", ["big", "data", "analytics", "cluster"]],
    ["Blockchain", "A shared ledger secured by hash links and consensus.", ["blockchain", "ledger", "hash", "consensus"]],
    ["Internet of Things", "Connected devices that report sensor readings.", ["internet", "things", "sensor", "device"]],
    ["Software Engineering", "Planning, design and testing of reliable software.", ["software", "engineering", "testing", "design"]],
    ["Graph Theory", "Studying node and edge structures and the shortest path.", ["graph", "node", "edge", "path"]],
    ["Sorting Algorithms", "Ordering items with merge sort, quick sort and more.", ["sorting", "algorithm", "merge", "quick"]],
    ["Search Engines", "Crawling pages and ranking results for a query.", ["search", "engine", "ranking", "crawler"]],
    ["Compiler Design", "Turning source code into machine code with a parser.", ["compiler", "parser", "syntax", "code"]]
  ];
  const ANGLES = [
    ["Introduction", "An introduction to", "basics"],
    ["Applications", "Real-world applications of", "applications"],
    ["Core Algorithms", "The core algorithms behind", "algorithms"],
    ["Case Study", "A worked case study on", "case"],
    ["Future Trends", "Where the field is heading in", "future"]
  ];

  const DOCS = [];
  TOPICS.forEach(function (t) {
    ANGLES.forEach(function (a) {
      DOCS.push({
        id: DOCS.length,
        title: t[0] + " – " + a[0],
        desc: a[1] + " " + t[0].toLowerCase() + ". " + t[1],
        kw: t[2].concat(a[2])
      });
    });
  });

  /* ---------- Index building (done once, timed separately) ---------- */
  function buildPostings() {
    const p = {};
    DOCS.forEach(function (d) {
      d.kw.forEach(function (k) { (p[k] = p[k] || []).push(d.id); });
    });
    return p;
  }

  // Sorted array index for Binary Search
  let SORTED = [];
  let sortedBuildMs = 0;
  (function () {
    const t0 = performance.now();
    const p = buildPostings();
    SORTED = Object.keys(p).sort().map(function (k) { return { key: k, ids: p[k] }; });
    sortedBuildMs = performance.now() - t0;
  })();

  // Chained hash table for Hash Search
  const BUCKETS = 64;
  let TABLE = [];
  let hashBuildMs = 0;
  function hashFn(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h % BUCKETS;
  }
  (function () {
    const t0 = performance.now();
    const p = buildPostings();
    TABLE = Array.from({ length: BUCKETS }, function () { return []; });
    Object.keys(p).forEach(function (k) { TABLE[hashFn(k)].push({ key: k, ids: p[k] }); });
    hashBuildMs = performance.now() - t0;
  })();

  /* ---------- The three algorithms ----------
     Each returns { hits: Map(docId -> {terms:[], comps:n}), comps: total } */
  function record(hits, id, term, comps) {
    const e = hits.get(id) || { terms: [], comps: 0 };
    e.terms.push(term);
    e.comps += comps;
    hits.set(id, e);
  }

  // Scans every keyword of every document; one comparison per (keyword, term) pair.
  function linearSearch(terms) {
    const hits = new Map();
    let comps = 0;
    for (let i = 0; i < DOCS.length; i++) {
      const d = DOCS[i];
      for (let j = 0; j < d.kw.length; j++) {
        for (let q = 0; q < terms.length; q++) {
          comps++;
          if (d.kw[j] === terms[q]) record(hits, d.id, terms[q], 0);
        }
      }
      if (hits.has(d.id)) hits.get(d.id).comps = d.kw.length * terms.length;
    }
    return { hits: hits, comps: comps };
  }

  // Halves the sorted keyword index each step; one comparison per step.
  function binarySearch(terms) {
    const hits = new Map();
    let comps = 0;
    terms.forEach(function (t) {
      let lo = 0, hi = SORTED.length - 1, used = 0, found = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        used++;
        const k = SORTED[mid].key;
        if (k === t) { found = SORTED[mid]; break; }
        if (k < t) lo = mid + 1; else hi = mid - 1;
      }
      comps += used;
      if (found) found.ids.forEach(function (id) { record(hits, id, t, used); });
    });
    return { hits: hits, comps: comps };
  }

  // Hashes the term to a bucket, then compares only along that bucket's chain.
  function hashSearch(terms) {
    const hits = new Map();
    let comps = 0;
    terms.forEach(function (t) {
      const chain = TABLE[hashFn(t)];
      let used = 0, found = null;
      for (let i = 0; i < chain.length; i++) {
        used++;
        if (chain[i].key === t) { found = chain[i]; break; }
      }
      comps += used;
      if (found) found.ids.forEach(function (id) { record(hits, id, t, used); });
    });
    return { hits: hits, comps: comps };
  }

  const ALGOS = {
    linear: { name: "Linear Search", fn: linearSearch, cx: "O(n·k·q) – scans every keyword of every document", build: function () { return null; } },
    binary: { name: "Binary Search", fn: binarySearch, cx: "O(q·log m) per query, after an O(m log m) sort", build: function () { return sortedBuildMs; } },
    hash: { name: "Hash Search", fn: hashSearch, cx: "O(q) on average per query, after an O(m) table build", build: function () { return hashBuildMs; } }
  };

  /* ---------- UI ---------- */
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  const fmtMs = function (ms) { return (ms < 1 ? ms.toFixed(4) : ms.toFixed(2)) + " ms"; };

  function runSearch() {
    const raw = $("query").value.toLowerCase();
    const terms = Array.from(new Set(raw.split(/[^a-z0-9]+/).filter(Boolean)));
    const msg = $("message");

    if (!terms.length) {
      msg.textContent = "Enter at least one keyword to search.";
      msg.hidden = false;
      return;
    }
    msg.hidden = true;

    const algo = ALGOS[$("algo").value];

    // Timing: average of many runs, since one run is far below timer resolution.
    const RUNS = 300;
    const t0 = performance.now();
    for (let i = 0; i < RUNS; i++) algo.fn(terms);
    const avgMs = (performance.now() - t0) / RUNS;

    const out = algo.fn(terms); // one counted run for results and comparisons

    // Rank: score = percentage of query terms matched; ties sorted by title.
    const ranked = [];
    out.hits.forEach(function (e, id) {
      const uniq = Array.from(new Set(e.terms));
      ranked.push({
        doc: DOCS[id],
        matched: uniq,
        score: Math.round(uniq.length / terms.length * 100),
        comps: e.comps
      });
    });
    ranked.sort(function (a, b) {
      return b.score - a.score || (a.doc.title < b.doc.title ? -1 : 1);
    });

    $("statDocs").textContent = DOCS.length;
    $("statResults").textContent = ranked.length;
    $("statComps").textContent = out.comps;
    $("statTime").textContent = fmtMs(avgMs);

    const build = algo.build();
    let html = '<div class="meta"><b>' + algo.name + "</b> · Time complexity: " + algo.cx +
      (build === null ? "" : "<br>Index build (one-time, not included in execution time): " + fmtMs(build)) +
      "<br>Execution time is the average of " + RUNS + " runs. Terms searched: " +
      terms.map(function (t) { return '<span class="chip">' + esc(t) + "</span>"; }).join(" ") + "</div>";

    if (!ranked.length) {
      html += '<p class="empty">No documents matched. Try a different keyword.</p>';
    } else {
      const LIMIT = 30;
      ranked.slice(0, LIMIT).forEach(function (r) {
        html += '<article class="result"><div class="top"><h3>' + esc(r.doc.title) +
          '</h3><span class="score">Match score: ' + r.score + '%</span></div><p>' + esc(r.doc.desc) +
          '</p><div class="foot">Matched keywords: ' +
          r.matched.map(function (k) { return '<span class="chip">' + esc(k) + "</span>"; }).join("") +
          "<span>· Comparisons: " + r.comps + "</span></div></article>";
      });
      if (ranked.length > LIMIT) {
        html += '<p class="note">Showing the top ' + LIMIT + " of " + ranked.length + " results.</p>";
      }
    }
    $("results").innerHTML = html;
  }

  /* ---------- Search inside an uploaded file ---------- */
  const FILE = { name: "", text: "", words: [], sorted: null, sortedMs: 0, table: null, tableMs: 0 };
  const TABLE_SIZE = 4096;
  const MAX_BYTES = 5 * 1024 * 1024;

  const tokenize = function (s) { return s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []; };
  function hashStr(s, m) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h % m;
  }

  // One-time preparation (cached per file, timed separately from the search)
  function ensureSorted() {
    if (FILE.sorted) return;
    const t0 = performance.now();
    FILE.sorted = FILE.words.slice().sort();
    FILE.sortedMs = performance.now() - t0;
  }
  function ensureTable() {
    if (FILE.table) return;
    const t0 = performance.now();
    const tb = Array.from({ length: TABLE_SIZE }, function () { return []; });
    FILE.words.forEach(function (w) {
      const chain = tb[hashStr(w, TABLE_SIZE)];
      for (let i = 0; i < chain.length; i++) {
        if (chain[i].key === w) { chain[i].count++; return; }
      }
      chain.push({ key: w, count: 1 });
    });
    FILE.table = tb;
    FILE.tableMs = performance.now() - t0;
  }

  // Compares every word of the file with every keyword.
  function fileLinear(terms) {
    const W = FILE.words;
    let comps = 0;
    const counts = terms.map(function (t) {
      let c = 0;
      for (let i = 0; i < W.length; i++) { comps++; if (W[i] === t) c++; }
      return c;
    });
    return { counts: counts, comps: comps };
  }

  // Two binary searches on the sorted words: first and last position of the keyword.
  function fileBinary(terms) {
    const A = FILE.sorted;
    let comps = 0;
    const counts = terms.map(function (t) {
      let lo = 0, hi = A.length;
      while (lo < hi) { const m = (lo + hi) >> 1; comps++; if (A[m] < t) lo = m + 1; else hi = m; }
      const first = lo;
      hi = A.length;
      while (lo < hi) { const m = (lo + hi) >> 1; comps++; if (A[m] <= t) lo = m + 1; else hi = m; }
      return lo - first;
    });
    return { counts: counts, comps: comps };
  }

  // Looks the keyword up in a hash table of word frequencies.
  function fileHash(terms) {
    let comps = 0;
    const counts = terms.map(function (t) {
      const chain = FILE.table[hashStr(t, TABLE_SIZE)];
      for (let i = 0; i < chain.length; i++) {
        comps++;
        if (chain[i].key === t) return chain[i].count;
      }
      return 0;
    });
    return { counts: counts, comps: comps };
  }

  const FILE_ALGOS = {
    linear: { name: "Linear Search", fn: fileLinear, prep: null, ms: null, cx: "O(n·q) – checks every word of the file for each keyword" },
    binary: { name: "Binary Search", fn: fileBinary, prep: ensureSorted, ms: function () { return FILE.sortedMs; }, cx: "O(q·log n) per query, after an O(n log n) sort of the words" },
    hash: { name: "Hash Search", fn: fileHash, prep: ensureTable, ms: function () { return FILE.tableMs; }, cx: "O(q) on average per query, after an O(n) table build" }
  };

  // Shows up to `max` places where the keyword appears, with surrounding text.
  function snippets(term, max) {
    const re = new RegExp("(?<![\\p{L}\\p{N}])" + term + "(?![\\p{L}\\p{N}])", "giu");
    const text = FILE.text, list = [];
    let m;
    while ((m = re.exec(text)) && list.length < max) {
      const s = Math.max(0, m.index - 40), e = Math.min(text.length, m.index + m[0].length + 40);
      const clean = function (x) { return esc(x.replace(/\s+/g, " ")); };
      list.push('<div class="snip">' + (s > 0 ? "…" : "") + clean(text.slice(s, m.index)) +
        "<mark>" + esc(m[0]) + "</mark>" + clean(text.slice(m.index + m[0].length, e)) + (e < text.length ? "…" : "") + "</div>");
    }
    return list.join("");
  }

  function fileNotice(text) {
    const el = $("fileMessage");
    el.textContent = text;
    el.hidden = !text;
  }

  function resetFileStats() {
    $("fileCount").textContent = "0";
    $("fileComps").textContent = "0";
    $("fileTime").textContent = "0 ms";
    $("fileResults").innerHTML = "";
  }

  function loadFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > MAX_BYTES) { fileNotice("This file is larger than 5 MB. Choose a smaller file."); return; }
    const reader = new FileReader();
    reader.onload = function () {
      const text = String(reader.result);
      const words = tokenize(text);
      if (!words.length) { fileNotice("No readable text found. Use a plain-text file such as .txt."); return; }
      FILE.name = f.name; FILE.text = text; FILE.words = words;
      FILE.sorted = null; FILE.table = null;
      $("fileLabel").textContent = f.name;
      $("fileWords").textContent = words.length;
      resetFileStats();
      fileNotice("");
    };
    reader.onerror = function () { fileNotice("The file could not be read. Try another file."); };
    reader.readAsText(f);
  }

  function runFileSearch() {
    if (!FILE.name) { fileNotice("Choose a file first."); return; }
    const terms = Array.from(new Set(tokenize($("fileQuery").value)));
    if (!terms.length) { fileNotice("Enter at least one keyword to search for."); return; }
    fileNotice("");

    const algo = FILE_ALGOS[$("fileAlgo").value];
    if (algo.prep) algo.prep();

    // Average several runs (fewer for big files) so the time is readable.
    const runs = Math.max(1, Math.min(200, Math.floor(2000000 / (FILE.words.length * terms.length))));
    const t0 = performance.now();
    for (let i = 0; i < runs; i++) algo.fn(terms);
    const avgMs = (performance.now() - t0) / runs;

    const out = algo.fn(terms);
    const total = out.counts.reduce(function (a, b) { return a + b; }, 0);

    $("fileWords").textContent = FILE.words.length;
    $("fileCount").textContent = total;
    $("fileComps").textContent = out.comps;
    $("fileTime").textContent = fmtMs(avgMs);

    let html = '<div class="meta"><b>' + algo.name + "</b> · Time complexity: " + algo.cx +
      (algo.ms ? "<br>Preparation (one-time, not included in execution time): " + fmtMs(algo.ms()) : "") +
      "<br>File: " + esc(FILE.name) + " · Execution time is the average of " + runs + (runs === 1 ? " run." : " runs.") + "</div>";

    terms.forEach(function (t, i) {
      const c = out.counts[i];
      html += '<article class="result"><div class="term-head"><h3>' + esc(t) + "</h3>" +
        (c ? '<span class="count">Found ' + c + (c === 1 ? " time" : " times") + "</span>"
           : '<span class="count none">Not found in this file</span>') + "</div>" +
        (c ? snippets(t, 5) + (c > 5 ? '<p class="note">Showing the first 5 of ' + c + " matches.</p>" : "") : "") +
        "</article>";
    });
    $("fileResults").innerHTML = html;
  }

  $("fileInput").addEventListener("change", loadFile);
  $("fileBtn").addEventListener("click", runFileSearch);
  $("fileQuery").addEventListener("keydown", function (e) { if (e.key === "Enter") runFileSearch(); });

  document.querySelectorAll(".tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (b) {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      $("viewDocs").hidden = btn.dataset.view !== "docs";
      $("viewFile").hidden = btn.dataset.view !== "file";
    });
  });

  $("searchBtn").addEventListener("click", runSearch);
  $("query").addEventListener("keydown", function (e) { if (e.key === "Enter") runSearch(); });
})();
