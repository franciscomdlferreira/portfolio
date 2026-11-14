// Function golf, easy mode: no typing. Each hole gives you a function with
// a couple of knobs (sliders). Move them, watch the graph change live, then
// swing: the ball rides along the graph from left to right.
(function () {
  const GREEN = "#16b05a";
  const XMIN = -10, XMAX = 10, YMIN = -6, YMAX = 6;
  const TOL = 0.5;      // how close the graph must pass to the ball / flag
  const BALL_R = 0.22;  // ball radius, in graph units
  const SPEED = 7;      // units per second along x

  const fmt = (v) => (Math.round(v * 100) / 100).toString();

  // each hole: a family of functions with sliders, plus ball, flag and walls
  const HOLES = [
    {
      name: "straight line",
      params: { a: [-1, 1, 0.05, 0], b: [-5, 5, 0.5, 0] },
      f: ({ a, b }) => (x) => a * x + b,
      show: ({ a, b }) => `y = <span class="v">${fmt(a)}</span>·x + <span class="v">${fmt(b)}</span>`,
      ball: [-8, -2], flag: [8, 2], walls: [], par: 1,
    },
    {
      name: "over the wall",
      params: { a: [-2, 6, 0.5, 0], b: [-2, 2, 0.25, 0] },
      f: ({ a, b }) => (x) => a - b * x * x / 16,
      show: ({ a, b }) => `y = <span class="v">${fmt(a)}</span> − <span class="v">${fmt(b)}</span>·x²/16`,
      ball: [-8, 0], flag: [8, 0], walls: [[-1, -6, 1, 3]], par: 1,
    },
    {
      name: "under the wall",
      params: { a: [-2, 2, 0.25, 0], b: [-4, 4, 0.5, 0] },
      f: ({ a, b }) => (x) => a * x * x / 16 + b,
      show: ({ a, b }) => `y = <span class="v">${fmt(a)}</span>·x²/16 + <span class="v">${fmt(b)}</span>`,
      ball: [-8, 3], flag: [8, 3], walls: [[-1, -1, 1, 6]], par: 1,
    },
    {
      name: "the wave",
      params: { a: [-4, 4, 0.5, 1], b: [2, 12, 0.5, 6] },
      f: ({ a, b }) => (x) => a * Math.sin((Math.PI * x) / b),
      show: ({ a, b }) => `y = <span class="v">${fmt(a)}</span>·sin(πx / <span class="v">${fmt(b)}</span>)`,
      ball: [-9, 0], flag: [9, 0], walls: [[-6, -1, -3, 6], [3, -6, 6, 1]], par: 2,
    },
    {
      name: "the valley",
      params: { a: [-2, 2, 0.25, 0], b: [-6, 6, 0.5, 0] },
      f: ({ a, b }) => (x) => a * Math.abs(x) + b,
      show: ({ a, b }) => `y = <span class="v">${fmt(a)}</span>·|x| + <span class="v">${fmt(b)}</span>`,
      ball: [-8, 4], flag: [8, 4], walls: [[-0.5, -1, 0.5, 6], [-4.5, -6, -3.5, -1.5], [3.5, -6, 4.5, -1.5]], par: 2,
    },
  ];

  const canvas = document.getElementById("course");
  const ctx = canvas.getContext("2d");
  const panel = document.getElementById("panel");
  const formulaEl = document.getElementById("formula");
  const slidersEl = document.getElementById("sliders");
  const chkBall = document.getElementById("chkBall");
  const chkFlag = document.getElementById("chkFlag");
  const goBtn = document.getElementById("go");
  const nextBtn = document.getElementById("next");
  const msg = document.getElementById("msg");
  const scoreEl = document.getElementById("score");

  // ---------- state ----------
  let hole = 0, strokes = 0, total = 0;
  let vals = {};          // current slider values
  let f = null;           // current function
  let ballPos = null;
  let flight = null;
  let trail = [];
  let sunk = false;
  let finished = false;

  // ---------- coordinates ----------
  let W, H, S, OX, OY;
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const top = 90, bottom = panel.offsetHeight + 50;
    S = Math.min((W - 40) / (XMAX - XMIN), (H - top - bottom) / (YMAX - YMIN));
    OX = W / 2;
    OY = top + (H - top - bottom) / 2;
  }
  const px = (x) => OX + x * S;
  const py = (y) => OY - y * S;
  window.addEventListener("resize", resize);

  // ---------- holes ----------
  function load(n) {
    hole = n;
    strokes = 0;
    trail = [];
    flight = null;
    sunk = false;
    const h = HOLES[n];
    ballPos = h.ball.slice();

    slidersEl.innerHTML = "";
    vals = {};
    Object.entries(h.params).forEach(([name, [min, max, step, start]]) => {
      vals[name] = start;
      const row = document.createElement("label");
      row.className = "sl";
      row.innerHTML = `<span>${name}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${start}" aria-label="${name}"><output>${fmt(start)}</output>`;
      const input = row.querySelector("input");
      const out = row.querySelector("output");
      input.addEventListener("input", () => {
        vals[name] = parseFloat(input.value);
        out.textContent = fmt(vals[name]);
        if (!flight) trail = [];
        refresh();
      });
      slidersEl.appendChild(row);
    });

    nextBtn.classList.remove("on");
    nextBtn.textContent = "next hole →";
    goBtn.style.display = "";
    goBtn.disabled = false;
    say(n === 0 ? "Move the sliders until your graph touches the ball and the flag, then swing." : `Hole ${n + 1}: ${h.name}.`, "");
    refresh();
    resize();
  }

  // recompute the function and the live checks whenever a slider moves
  function refresh() {
    const h = HOLES[hole];
    f = h.f(vals);
    formulaEl.innerHTML = h.show(vals);
    const okBall = Math.abs(f(h.ball[0]) - h.ball[1]) <= TOL;
    const okFlag = Math.abs(f(h.flag[0]) - h.flag[1]) <= TOL;
    chkBall.textContent = (okBall ? "✓" : "○") + " touches the ball";
    chkFlag.textContent = (okFlag ? "✓" : "○") + " reaches the flag";
    chkBall.className = okBall ? "ok" : "";
    chkFlag.className = okFlag ? "ok" : "";
    updateScore();
  }

  function updateScore() {
    const h = HOLES[hole];
    scoreEl.innerHTML = `hole <b>${hole + 1}</b>/${HOLES.length} · par ${h.par}<br>strokes <b>${strokes}</b> · total <b>${total + strokes}</b>`;
  }

  function say(text, kind) {
    msg.textContent = text;
    msg.className = "msg" + (kind ? " " + kind : "");
  }

  function fail(text) {
    say(text, "bad");
    panel.classList.remove("shake");
    void panel.offsetWidth;
    panel.classList.add("shake");
    goBtn.disabled = false;
  }

  const hitsWall = (x, y) => HOLES[hole].walls.some(([x1, y1, x2, y2]) =>
    x > x1 - BALL_R && x < x2 + BALL_R && y > y1 - BALL_R && y < y2 + BALL_R);

  goBtn.addEventListener("click", () => {
    if (flight || sunk) return;
    const h = HOLES[hole];
    strokes++;
    updateScore();
    trail = [];
    ballPos = h.ball.slice();

    if (Math.abs(f(h.ball[0]) - h.ball[1]) > TOL) {
      return fail("Your graph doesn't touch the ball yet. Watch the ✓ below.");
    }
    goBtn.disabled = true;
    say("", "");
    flight = { x: h.ball[0], end: h.flag[0] };
  });

  nextBtn.addEventListener("click", () => {
    if (finished) {
      finished = false;
      total = 0;
      return load(0);
    }
    total += strokes;
    if (hole + 1 < HOLES.length) load(hole + 1);
    else finish();
  });

  function finish() {
    finished = true;
    const par = HOLES.reduce((s, h) => s + h.par, 0);
    const diff = total - par;
    const vs = diff === 0 ? "exactly par" : diff < 0 ? `${-diff} under par` : `${diff} over par`;
    say(`You won! Course done in ${total} strokes, ${vs}.`, "good");
    scoreEl.innerHTML = `course <b>done</b><br>total <b>${total}</b> · par ${par}`;
    goBtn.style.display = "none";
    nextBtn.textContent = "play again";
    nextBtn.classList.add("on");
  }

  // move the ball in small steps so it can't tunnel through walls
  function stepFlight(dt) {
    const h = HOLES[hole];
    let dist = SPEED * dt;
    while (dist > 0 && flight) {
      const dx = Math.min(0.02, dist);
      dist -= dx;
      const x = Math.min(flight.x + dx, flight.end);
      const y = f(x);
      flight.x = x;

      if (!isFinite(y) || y < YMIN - 1 || y > YMAX + 1) {
        flight = null;
        return fail("The ball flew off the course!");
      }
      ballPos = [x, y];
      trail.push([x, y]);

      if (hitsWall(x, y)) {
        flight = null;
        return fail("Bonk! The ball hit a wall. Try bending the graph around it.");
      }

      if (x >= flight.end) {
        flight = null;
        if (Math.abs(y - h.flag[1]) <= TOL) {
          sunk = true;
          const d = strokes - h.par;
          say(strokes === 1 ? "Hole in one!" : d < 0 ? "Birdie!" : d === 0 ? "Par!" : "In the hole!", "good");
          goBtn.disabled = true;
          nextBtn.textContent = hole + 1 < HOLES.length ? "next hole →" : "finish";
          nextBtn.classList.add("on");
        } else {
          fail("Missed the flag. Watch the ✓ below.");
        }
      }
    }
  }

  // ---------- drawing ----------
  function marker(x, y, ok) {
    ctx.strokeStyle = ok ? GREEN : "#ccc";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(px(x), py(y), TOL * S, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function draw() {
    const h = HOLES[hole];
    ctx.clearRect(0, 0, W, H);

    // grid + axes
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#f2f2f2";
    ctx.beginPath();
    for (let x = XMIN; x <= XMAX; x++) { ctx.moveTo(px(x), py(YMIN)); ctx.lineTo(px(x), py(YMAX)); }
    for (let y = YMIN; y <= YMAX; y++) { ctx.moveTo(px(XMIN), py(y)); ctx.lineTo(px(XMAX), py(y)); }
    ctx.stroke();
    ctx.strokeStyle = "#cfcfcf";
    ctx.beginPath();
    ctx.moveTo(px(XMIN), py(0)); ctx.lineTo(px(XMAX), py(0));
    ctx.moveTo(px(0), py(YMIN)); ctx.lineTo(px(0), py(YMAX));
    ctx.stroke();
    ctx.fillStyle = "#bbb";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.textAlign = "center";
    for (let x = XMIN + 2; x < XMAX; x += 2) if (x) ctx.fillText(x, px(x), py(0) + 14);
    ctx.textAlign = "right";
    for (let y = YMIN + 2; y < YMAX; y += 2) if (y) ctx.fillText(y, px(0) - 6, py(y) + 4);

    // walls
    h.walls.forEach(([x1, y1, x2, y2]) => {
      const rx = px(x1), ry = py(y2), rw = (x2 - x1) * S, rh = (y2 - y1) * S;
      ctx.fillStyle = "#f4f4f4";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
      ctx.strokeStyle = "#ddd";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = -H; k < W + H; k += 10) { ctx.moveTo(k, 0); ctx.lineTo(k + H, H); }
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);
    });

    // live preview of the graph
    ctx.strokeStyle = "rgba(22,176,90,.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let pen = false;
    for (let x = XMIN; x <= XMAX; x += 0.02) {
      const y = f(x);
      if (!isFinite(y) || y < YMIN - 2 || y > YMAX + 2) { pen = false; continue; }
      pen ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y));
      pen = true;
    }
    ctx.stroke();

    // target rings around ball and flag (go green when the graph passes through)
    marker(h.ball[0], h.ball[1], Math.abs(f(h.ball[0]) - h.ball[1]) <= TOL);
    marker(h.flag[0], h.flag[1], Math.abs(f(h.flag[0]) - h.flag[1]) <= TOL);

    // trail
    if (trail.length > 1) {
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(px(trail[0][0]), py(trail[0][1]));
      trail.forEach(([x, y]) => ctx.lineTo(px(x), py(y)));
      ctx.stroke();
    }

    // flag
    const [fx, fy] = h.flag;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px(fx), py(fy));
    ctx.lineTo(px(fx), py(fy) - 44);
    ctx.stroke();
    ctx.fillStyle = GREEN;
    ctx.beginPath();
    ctx.moveTo(px(fx), py(fy) - 44);
    ctx.lineTo(px(fx) + 24, py(fy) - 36);
    ctx.lineTo(px(fx), py(fy) - 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.ellipse(px(fx), py(fy), 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // ball
    const [bx, by] = sunk ? h.flag : ballPos;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px(bx), py(by), BALL_R * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (flight) stepFlight(dt);
    draw();
    requestAnimationFrame(frame);
  }

  load(0);
  requestAnimationFrame(frame);
})();
