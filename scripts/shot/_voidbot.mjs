// THE VOID's scripted player, shared by shot/void-record.mjs (films it) and
// verify/void-run.mjs (plays a whole run in Firefox). It plays through the
// real input path (keyboard and mouse, never the game's internals) and only
// READS the game's state through the __void hook to decide: it walks to the
// nearest enemy and clicks it (the mouse aims), sidesteps chargers' lines,
// dashes through bolts, rides a seal's ring gaps, hits in its window, and
// walks through an open doorway. A death is answered with R (fall again).
//
//   const bot = createVoidBot(page, { trace });
//   while (...) { const s = await bot.tick(); ... }   // s: the state it acted on
//   await bot.release();
//   bot.stats: { deaths, deathsByRoom: [r1, r2, r3], deathsAtSeal, rooms, sealTimes, wonAt, boons: [{ room, offered, took }] }
// A boon offer is answered with the key 1 (the first boon offered).

export function createVoidBot(page, { trace = false } = {}) {
  const keys = new Set();
  let mouseDown = false;
  let lastRoom = null, lastHearts = 3, sealFrom = null;
  let counted = false; // this death already counted
  const stats = { deaths: 0, deathsByRoom: [0, 0, 0], deathsAtSeal: 0, rooms: 0, sealTimes: [], wonAt: 0, boons: [] };

  async function hold(want) {
    for (const k of keys) if (!want.has(k)) { await page.keyboard.up(k); keys.delete(k); }
    for (const k of want) if (!keys.has(k)) { await page.keyboard.down(k); keys.add(k); }
  }
  async function up() {
    if (mouseDown) { await page.mouse.up(); mouseDown = false; }
  }
  async function release() {
    await hold(new Set());
    await up();
  }

  async function tick() {
    const s = await page.evaluate(() => {
      const v = window.__void;
      if (!v) return null;
      const w = v.world, p = w.player;
      // Logical (480 x 270) -> CSS px, read every tick: the scale and offset
      // are re-fitted to each room's island
      const c = document.querySelector(".archive-root canvas");
      const r = c.getBoundingClientRect();
      const k = r.width / c.width;
      const view = { s: v.view.s * k, dx: r.left + v.view.dx * k, dy: r.top + v.view.dy * k };
      // [x, y, kind, state, ax, ay]
      const ds = w.enemies.filter((d) => d.alive && d.arrive <= 0).map((d) => [d.x, d.y, d.kind, d.state, d.ax, d.ay]);
      const bs = w.bolts.filter((b) => b.alive).map((b) => [b.x, b.y, b.vx, b.vy]);
      const sl = w.seal;
      const seal = sl.state === 0 || sl.state === 7 ? null : { x: sl.x, y: sl.y, gap: sl.gap, state: sl.state, rings: w.rings.filter((q) => q.alive).map((q) => [q.r, q.gapA, q.spin]) };
      return { x: p.x, y: p.y, cd: p.dashCd, ds, bs, phase: w.phase, hearts: p.hearts, open: w.doorOpen, room: w.roomIndex, moving: w.transition >= 0,
        seal, sealState: sl.state, t: w.t, freed: [...w.freed], view, offer: w.offer ? [...w.offer] : null };
    });
    if (!s) return null;
    const sx = (x) => s.view.dx + x * s.view.s;
    const sy = (y) => s.view.dy + y * s.view.s;
    if (lastRoom !== null && s.room > lastRoom) stats.rooms++;
    lastRoom = s.room;

    // Won: the run is over and the page wakes at Contact; just watch it
    if (s.phase === "won") {
      if (!stats.wonAt) stats.wonAt = Date.now();
      await release();
      await page.waitForTimeout(100);
      return s;
    }
    // A boon on offer (the run is paused): take the first, by its key
    if (s.offer) {
      await release();
      if (!stats.boons.some((b) => b.room === s.room + 1)) stats.boons.push({ room: s.room + 1, offered: s.offer, took: s.offer[0] });
      await page.waitForTimeout(400);
      await page.keyboard.press("Digit1");
      await page.waitForTimeout(100);
      return s;
    }
    // Dead: counted once, the card shown, then R (fall again)
    if (s.phase !== "play") {
      if (!counted) {
        stats.deaths++;
        stats.deathsByRoom[s.room]++;
        if (s.sealState !== 0) stats.deathsAtSeal++;
        counted = true;
      }
      sealFrom = null; // that attempt does not count
      await release();
      await page.waitForTimeout(700);
      await page.keyboard.press("KeyR");
      return s;
    }
    counted = false;
    if (trace && s.hearts < lastHearts) {
      const near = s.bs.map(([bx, by]) => Math.hypot(bx - s.x, by - s.y + 6)).sort((a, b) => a - b)[0];
      const at = s.seal
        ? `seal state ${s.seal.state}, gem ${Math.hypot(s.x - s.seal.x, s.y - 6 - (s.seal.y - 8)).toFixed(0)} px from it, rings ${JSON.stringify(s.seal.rings.map(([r, g]) => [Math.round(r), +g.toFixed(2)]))}`
        : `${s.ds.length} enemies`;
      console.log(`hurt (room ${s.room + 1}, hearts ${s.hearts}): ${at}, nearest bolt ${near?.toFixed(0) ?? "-"} px, dash cd ${s.cd.toFixed(2)}`);
    }
    lastHearts = s.hearts;
    const want = new Set();
    if (s.moving) { await hold(want); await page.waitForTimeout(40); return s; }
    // Seal timing: from its rising to its freeing, in game time
    if (s.sealState === 1 && sealFrom === null) sealFrom = s.t;
    if (s.sealState === 7 && sealFrom !== null) { stats.sealTimes.push(s.t - sealFrom); sealFrom = null; }
    if (s.seal) {
      const cx = s.seal.x, cy = s.seal.y - 8;
      const gx = s.x - cx, gy = s.y - 6 - cy, pd = Math.hypot(gx, gy);
      // A ring about to sweep over us outside its gap: dash through it, or back off
      let sting = null;
      for (const [rr, gapA] of s.seal.rings) {
        let da = Math.atan2(gy, gx) - gapA;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (rr < pd + 2 && pd - rr < 11 && Math.abs(da) > s.seal.gap / 2 - 0.08) sting = da;
      }
      if (sting !== null) {
        // Dash ready: through the band (it travels outward, and is then
        // behind us), mostly SIDEWAYS toward its gap and ~30 deg inward. A
        // dash covers ~75 px: straight inward it went through the seal and
        // landed where the next ring is born. The i-frames (0.12 s) only need
        // the radial part to cross the band. Cooling: outrun it outward
        // (95 vs 34 px/s), cross later
        const ux = gx / (pd || 1), uy = gy / (pd || 1);
        let dx, dy;
        if (s.cd === 0) {
          const side = sting > 0 ? -1 : 1; // turn toward the gap
          const tx = -uy * side, ty = ux * side;
          dx = tx * 0.87 - ux * 0.5;
          dy = ty * 0.87 - uy * 0.5;
        } else {
          dx = ux; dy = uy;
        }
        if (dx > 0.3) want.add("KeyD"); else if (dx < -0.3) want.add("KeyA");
        if (dy > 0.3) want.add("KeyS"); else if (dy < -0.3) want.add("KeyW");
        await hold(want);
        if (s.cd === 0) await page.keyboard.press("Space");
        await up();
        await page.waitForTimeout(30);
        return s;
      }
    }
    // Wave cleared, the doorway open: walk to it (a path over the ice tiles)
    if (s.open && s.ds.length === 0) {
      await up();
      const step = await page.evaluate(() => {
        const w = window.__void.world, p = w.player, room = w.room, COLS = 48, ROWS = 27, T = 10;
        const start = Math.floor(p.y / T) * COLS + Math.floor(p.x / T);
        const goal = (room.door.y / T) * COLS + room.door.x / T;
        const prev = new Int32Array(COLS * ROWS).fill(-1);
        const q = [start]; prev[start] = start;
        while (q.length) { const k = q.shift(); if (k === goal || k === goal + 1) { let n = k; while (prev[n] !== start && n !== start) n = prev[n]; return { tx: (n % COLS) * T + 5, ty: Math.floor(n / COLS) * T + 5, gx: room.door.x + room.door.w / 2, gy: room.door.y + 4 }; }
          for (const n of [k - 1, k + 1, k - COLS, k + COLS]) if (n >= 0 && n < COLS * ROWS && room.ice[n] && prev[n] < 0) { prev[n] = k; q.push(n); } }
        return null; });
      if (step) {
        const near = Math.hypot(step.gx - s.x, step.gy - s.y) < 14;
        const tx = near ? step.gx : step.tx, ty = near ? step.gy : step.ty;
        if (tx - s.x > 2) want.add("KeyD"); else if (tx - s.x < -2) want.add("KeyA");
        if (ty - s.y > 2) want.add("KeyS"); else if (ty - s.y < -2) want.add("KeyW");
      }
      await hold(want);
      await page.waitForTimeout(40);
      return s;
    }
    // A charger winding up or charging along a line through us: get off the
    // line sideways (dash if it is ready). Its tell (0.4 s) is the warning
    let threat = null;
    for (const [x, y, kind, state, ax, ay] of s.ds) {
      if (kind !== 1 || (state !== 1 && state !== 2)) continue;
      const along = (s.x - x) * ax + (s.y - y) * ay;
      const perp = Math.abs((s.x - x) * ay - (s.y - y) * ax);
      if (along > -4 && along < 150 && perp < 14) threat = [ax, ay, (s.x - x) * ay - (s.y - y) * ax];
    }
    // A bolt about to hit: dash THROUGH it (toward where it came from), or sidestep
    for (const [bx, by, vx, vy] of s.bs) {
      const l = Math.hypot(vx, vy) || 1, ux = vx / l, uy = vy / l;
      const along = (s.x - bx) * ux + (s.y - 6 - by) * uy;
      const perp = Math.abs((s.x - bx) * uy - (s.y - 6 - by) * ux);
      if (along > 0 && along < 26 && perp < 9) { threat = s.cd === 0 ? [-uy, ux, 0, -ux, -uy] : [ux, uy, perp]; break; }
    }
    if (threat && threat.length === 5) {
      // Into the bolt: the dash's i-frames carry the gem through it
      const [, , , tx, ty] = threat;
      if (tx > 0.3) want.add("KeyD"); else if (tx < -0.3) want.add("KeyA");
      if (ty > 0.3) want.add("KeyS"); else if (ty < -0.3) want.add("KeyW");
      await hold(want);
      await page.keyboard.press("Space");
      await up();
      await page.waitForTimeout(40);
      return s;
    }
    if (threat) {
      const [ax, ay, side] = threat;
      // Perpendicular to its line, on the side we already stand
      const px = side >= 0 ? ay : -ay, py = side >= 0 ? -ax : ax;
      if (px > 0.3) want.add("KeyD"); else if (px < -0.3) want.add("KeyA");
      if (py > 0.3) want.add("KeyS"); else if (py < -0.3) want.add("KeyW");
      await hold(want);
      if (s.cd === 0) await page.keyboard.press("Space");
      await up();
      await page.waitForTimeout(40);
      return s;
    }
    // Its window: once the fan's bolts are past our post, close to the edge of
    // reach (~30 px; the burst reaches ~43) and hit; never into the muzzle
    const fanOut = s.seal && s.bs.some(([bx, by]) => Math.hypot(bx - s.seal.x, by - (s.seal.y - 8)) < 70);
    // Posts round the seal on the side we already stand (never through its body)
    const around = (d) => {
      const ax = s.x - s.seal.x, ay = s.y - (s.seal.y - 2);
      const l = Math.hypot(ax, ay) || 1;
      return [s.seal.x + (ax / l) * d, s.seal.y - 2 + (ay / l) * d];
    };
    if (s.seal && s.seal.state === 5 && !fanOut) {
      const [tx, ty] = around(28);
      if (tx - s.x > 3) want.add("KeyD"); else if (tx - s.x < -3) want.add("KeyA");
      if (ty - s.y > 3) want.add("KeyS"); else if (ty - s.y < -3) want.add("KeyW");
      await hold(want);
      await page.mouse.move(sx(s.seal.x), sy(s.seal.y - 10));
      if (Math.hypot(tx - s.x, ty - s.y) < 16) { await page.mouse.down(); await page.mouse.up(); }
      await page.waitForTimeout(30);
      return s;
    }
    if (s.seal && s.ds.length === 0) {
      // A post ~66 px out: a ring gives over a second's notice, the fan room to read.
      // With a ring coming, circle the post to where its GAP will be when it
      // arrives (gap angle + spin x arrival time): it passes us through the gap
      const gx0 = s.x - s.seal.x, gy0 = s.y - 6 - (s.seal.y - 8), pd0 = Math.hypot(gx0, gy0);
      // Never walk back out INTO a ring just dashed through: it is just
      // outside us, slower (34 px/s) than our walk (95), and stings from
      // behind. Stay inside it until it is gone
      let post = 66;
      for (const [rr] of s.seal.rings) if (rr >= pd0 && rr < pd0 + 40) post = Math.min(post, rr - 10);
      post = Math.max(post, 24);
      let [tx, ty] = around(post);
      let next = null;
      for (const [rr, gapA, spin] of s.seal.rings) if (rr < pd0 && (!next || rr > next[0])) next = [rr, gapA, spin];
      if (next) {
        const ta = next[1] + next[2] * Math.max(0, (pd0 - next[0]) / 34);
        tx = s.seal.x + Math.cos(ta) * post;
        ty = s.seal.y - 2 + Math.sin(ta) * post;
      }
      if (tx - s.x > 4) want.add("KeyD"); else if (tx - s.x < -4) want.add("KeyA");
      if (ty - s.y > 4) want.add("KeyS"); else if (ty - s.y < -4) want.add("KeyW");
      await hold(want);
      await up();
      await page.waitForTimeout(30);
      return s;
    }
    let near = null, nd = 1e9;
    for (const [x, y, kind, state] of s.ds) {
      // A recovering charger is the opening: go for it first
      const d = Math.hypot(x - s.x, y - s.y) - (kind === 1 && state === 3 ? 40 : 0);
      if (d < nd) { nd = d; near = [x, y]; }
    }
    if (near) nd = Math.hypot(near[0] - s.x, near[1] - s.y);
    if (near) {
      const dx = near[0] - s.x, dy = near[1] - s.y;
      // Too close: dash away, sideways from it (the i-frames carry us through if not)
      if (nd < 14 && s.cd === 0) {
        want.add(Math.abs(dx) > Math.abs(dy) ? (dy > 0 ? "KeyW" : "KeyS") : dx > 0 ? "KeyA" : "KeyD");
        await hold(want);
        await page.keyboard.press("Space");
      } else {
        // Close in to burst range, keeping a little distance
        if (nd > 22) {
          if (dx > 6) want.add("KeyD"); else if (dx < -6) want.add("KeyA");
          if (dy > 6) want.add("KeyS"); else if (dy < -6) want.add("KeyW");
        }
        // Occasionally dash in on a far one: the dash is the verb to show
        if (nd > 70 && s.cd === 0 && Math.random() < 0.15) {
          await hold(want);
          await page.keyboard.press("Space");
        }
        await hold(want);
        // Attack with the mouse, aimed at it, when in reach
        await page.mouse.move(sx(near[0]), sy(near[1] - 6));
        if (nd < 34 && !mouseDown) { await page.mouse.down(); mouseDown = true; }
        if (nd >= 34 && mouseDown) { await up(); }
      }
    } else {
      await hold(want);
      await up();
    }
    await page.waitForTimeout(40);
    return s;
  }

  return { tick, release, stats };
}
