'use strict';
/* ===== Logika systému (bez DOM): pravidlá z DNR v1.1 ===== */
const MIN = 60000, H = 3600000, DAY = 86400000;
const RULE = { rate: 2, thr: 0.8, sur: 1.5, over: 4, ev: 1 }; // ilustračné hodnoty z kap. 6
const EARLY = 15 * MIN; // vjazd najskôr 15 min pred začiatkom (F.11)
const PKG_TYPES = {
  h10: { name: 'Balík 10 hodín', unit: 'h', range: 10, months: 3, price: 18 },
  d3:  { name: 'Balík 3 dni', unit: 'd', range: 3, months: 1, price: 30 },
  m:   { name: 'Mesačné predplatné (40 h)', unit: 'h', range: 40, months: 1, price: 60 },
  y:   { name: 'Ročné predplatné (400 h)', unit: 'h', range: 400, months: 12, price: 500 }
};
const USERS = [
  { id: 'jakub', name: 'Jakub Karaffa', ecv: 'BA123AB', group: null },
  { id: 'sona', name: 'Soňa Štefanová', ecv: 'KE456CD', group: 'VIP' },
  { id: 'martin', name: 'Martin Sarybekian', ecv: 'NR789EF', group: 'zamestnanci' }
];
const LARGE = [1, 2, 3, 13, 14, 15], EVSPOTS = [11, 12, 23, 24];
let S;

const r2 = x => Math.round(x * 100) / 100;
const eur = x => r2(x).toFixed(2).replace('.', ',') + ' €';
const at = (d, h, m) => new Date(2026, 10, d, h, m || 0).getTime();
const overlap = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
const user = id => USERS.find(u => u.id === id);

function newState() {
  const spots = [];
  for (let i = 1; i <= 24; i++) {
    const col = (i - 1) % 12, ev = EVSPOTS.includes(i);
    spots.push({ id: i, row: i <= 12 ? 0 : 1, col, large: LARGE.includes(i), ev,
      distExit: 5 + col * 3, nearLift: col >= 4 && col <= 7,
      available: true, reserved: null, sensor: false, sensorT: null, chargerOut: false });
  }
  S = { now: at(16, 8, 0), spots, res: [], inside: [], pay: [], pkgs: [], use: [], alerts: [], notif: [], log: [], passages: [], seq: 100, userId: 'jakub' };
  seed();
  return S;
}
function seed() {
  const sp = id => S.spots[id - 1];
  const add = (spot, ecv, from, to, occupied, uid) => {
    S.res.push({ id: ++S.seq, spot, ecv, user: uid || null, from, to, status: occupied ? 'aktivna' : 'potvrdena', price: 0, occ: 0, ev: sp(spot).ev, paid: 'brana', hist: [] });
    if (occupied) { sp(spot).sensor = true; sp(spot).sensorT = S.now - 20 * MIN; S.inside.push({ ecv, resId: S.seq, t: S.now - 30 * MIN }); }
  };
  [1,2,3,5,6,7,8,9,10,13,14,16,17].forEach((s, i) => add(s, 'ZA' + (100 + i) + 'XX', at(16, 7, 30), at(16, 12 + (i % 4) * 2, 0), true));
  add(4, 'BA999ZZ', at(16, 7, 40), at(16, 8, 30), true);          // dlhšie stojaci, uvoľní až po konci rezervácie
  add(15, 'TT321AA', at(16, 7, 45), at(16, 15, 0), false);
  add(18, 'PO777BB', at(16, 7, 50), at(16, 13, 0), false);
  S.res.push({ id: ++S.seq, spot: 4, ecv: 'NR789EF', user: 'martin', from: at(16, 8, 40), to: at(16, 12, 0), status: 'potvrdena', price: 8, occ: 0.71, ev: false, paid: 'brana', hist: [] });
  EVSPOTS.forEach((s, i) => S.res.push({ id: ++S.seq, spot: s, ecv: 'EV' + (500 + i) + 'ZZ', user: null, from: at(18, 10, 0), to: at(18, 18, 0), status: 'potvrdena', price: 0, occ: 0, ev: true, paid: 'brana', hist: [] }));
  sp(20).reserved = { group: 'VIP', from: at(16, 0, 0), to: at(23, 0, 0) };
  sp(19).reserved = { group: 'zamestnanci', from: at(16, 0, 0), to: at(23, 0, 0) };
  S.pkgs.push({ id: 1, user: 'jakub', type: 'h10', unit: 'h', orig: 10, left: 5, from: at(1, 0, 0), to: at(31, 23, 59) });
  log('Systém', 'Simulácia spustená. Garáž má 24 miest, 4 majú nabíjaciu stanicu.');
}
function log(tag, text) { S.log.unshift({ t: S.now, tag, text }); if (S.log.length > 300) S.log.pop(); }
function notify(uid, type, text, channel) {
  if (!uid) return;
  S.notif.unshift({ user: uid, type, text, channel: channel || 'push', t: S.now, status: 'doručené' });
  log('Notifikácia', (channel || 'push').toUpperCase() + ' pre ' + user(uid).name + ': ' + text);
}

/* ---- stav miest a obsadenosť ---- */
const live = r => r.status === 'potvrdena' || r.status === 'aktivna';
function resAt(spotId, t) { return S.res.find(r => r.spot === spotId && live(r) && r.from <= t && t < r.to); }
function spotState(sp) {
  if (!sp.available) return 'off';
  if (sp.sensor) return 'occ';
  if (resAt(sp.id, S.now)) return 'res';
  return 'free';
}
function occupancy(t) {
  t = t == null ? S.now : t;
  const n = S.spots.filter(sp => sp.available && (sp.sensor || resAt(sp.id, t))).length;
  return n / S.spots.length;
}
function chargerState(sp) { return sp.chargerOut ? 'out' : (sp.sensor ? 'busy' : 'free'); }

/* ---- vyhľadávanie (F.01) ---- */
function spotCheck(sp, from, to, u, o) {
  o = o || {};
  if (!sp.available) return 'Miesto je nedostupné';
  if (o.ev && !sp.ev) return 'Miesto nemá nabíjaciu stanicu';
  if (o.ev && sp.chargerOut) return 'Nabíjacia stanica je mimo prevádzky';
  if (o.large && !sp.large) return 'Miesto nie je veľké';
  if (sp.reserved && overlap(from, to, sp.reserved.from, sp.reserved.to) && (!u || sp.reserved.group !== u.group)) return 'Vyhradené pre skupinu ' + sp.reserved.group;
  if (S.res.some(r => r.spot === sp.id && live(r) && overlap(from, to, r.from, r.to))) return 'Miesto má v tom čase inú rezerváciu';
  if (from <= S.now && S.now < to && sp.sensor) return 'Senzor hlási miesto ako obsadené';
  return null;
}
function search(p, u) {
  return S.spots.filter(sp => !spotCheck(sp, p.from, p.to, u, p) &&
    (!p.exit || sp.distExit <= 17) && (!p.lift || sp.nearLift));
}
/* ---- automatický výber (F.03): najviac splnených kritérií, pri rovnosti najnižšie číslo ---- */
function autoPick(p, u, exclude) {
  const c = search({ from: p.from, to: p.to, large: p.large, ev: p.ev }, u).filter(sp => sp.id !== exclude);
  let best = null, bs = -1;
  c.forEach(sp => {
    const sc = (p.exit && sp.distExit <= 17 ? 1 : 0) + (p.lift && sp.nearLift ? 1 : 0) + (p.evNear && sp.ev ? 1 : 0)
      - (sp.ev && !p.ev && !p.evNear ? 0.4 : 0) - (sp.large && !p.large ? 0.2 : 0); // vzácne miesta až naposledy
    if (sc > bs) { bs = sc; best = sp; }
  });
  return best;
}

/* ---- cena (F.05) ---- */
function quote(from, to, ev) {
  const occ = occupancy(), hours = (to - from) / H;
  const rate = RULE.rate * (occ >= RULE.thr ? RULE.sur : 1);
  const base = r2(hours * rate), evc = ev ? r2(hours * RULE.ev) : 0;
  return { occ, hours, rate, surcharge: occ >= RULE.thr, base, evc, total: r2(base + evc) };
}
/* ---- rezervácie (F.02, I.01, I.02, I.04, I.05, I.07, I.08) ---- */
function validate(o) {
  const u = user(o.uid), sp = S.spots[o.spot - 1];
  if (!sp) return 'Neznáme miesto';
  if (!(o.from < o.to)) return 'Začiatok musí predchádzať koncu rezervácie (I.04)';
  if (o.from < S.now) return 'Rezerváciu nemožno vytvoriť do minulosti';
  if (!/^[A-Z0-9]{5,8}$/.test(o.ecv)) return 'Zadaj EČV bez medzier (5 až 8 znakov)';
  const why = spotCheck(sp, o.from, o.to, u, { ev: o.ev });
  if (why) return why;
  if (S.res.some(r => live(r) && r.ecv === o.ecv && overlap(o.from, o.to, r.from, r.to))) return 'Vozidlo ' + o.ecv + ' už má v tom čase inú rezerváciu (I.02)';
  return null;
}
function commit(o, payInfo) {
  const err = validate(o);                      // znovu pri zápise, aby súbeh nevytvoril dve rezervácie
  if (err) return { ok: false, err };
  const q = quote(o.from, o.to, o.ev);
  const r = { id: ++S.seq, spot: o.spot, ecv: o.ecv, user: o.uid, from: o.from, to: o.to, status: 'potvrdena',
    price: q.total, occ: q.occ, ev: !!o.ev, paid: payInfo.method, hist: [] };
  S.res.push(r);
  S.pay.push({ id: ++S.seq, res: r.id, pkg: null, amount: q.total, purpose: 'rezervácia', status: payInfo.method === 'balik' ? 'z balíka' : 'úspešná', t: S.now, txn: payInfo.txn || '—' });
  log('Systém', 'Rezervácia č. ' + r.id + ': miesto ' + o.spot + ', ' + o.ecv + ', cena ' + eur(q.total) + ' (obsadenosť ' + Math.round(q.occ * 100) + ' %).');
  notify(o.uid, 'potvrdenie rezervácie', 'Rezervácia č. ' + r.id + ' potvrdená, miesto ' + o.spot + '.', 'push');
  return { ok: true, res: r };
}
function failedPayment(o, amount, purpose, txn) {
  S.pay.push({ id: ++S.seq, res: null, pkg: null, amount, purpose, status: 'neúspešná', t: S.now, txn });
  log('Platba', 'Platba ' + eur(amount) + ' (' + purpose + ') bola zamietnutá. Rezervácia ani balík nevznikli.');
}
let txnSeq = 7000;
const newTxn = () => 'TX-' + (++txnSeq);

/* ---- predplatné (F.06, I.09) ---- */
const pkgNeed = (p, from, to) => p.unit === 'd' ? Math.ceil((to - from) / H / 24) : r2((to - from) / H);
function pkgCheck(p, from, to) {
  if (!p) return 'Balík neexistuje';
  if (from < p.from || to > p.to) return 'Rezervácia je mimo platnosti balíka';
  const need = pkgNeed(p, from, to);
  if (p.left < need) return 'Zostávajúci rozsah balíka (' + p.left + (p.unit === 'd' ? ' d' : ' h') + ') nestačí, treba ' + need + (p.unit === 'd' ? ' d' : ' h');
  return null;
}
function reserveWithPackage(o, pkgId) {
  const p = S.pkgs.find(x => x.id === pkgId && x.user === o.uid);
  const e1 = validate(o); if (e1) return { ok: false, err: e1 };
  const e2 = pkgCheck(p, o.from, o.to); if (e2) return { ok: false, err: e2 };
  const res = commit(o, { method: 'balik' });
  if (!res.ok) return res;
  const need = pkgNeed(p, o.from, o.to);
  p.left = r2(p.left - need);
  S.use.push({ pkg: p.id, res: res.res.id, amount: need, t: S.now });
  S.pay[S.pay.length - 1].pkg = p.id;
  log('Platba', 'Úhrada z balíka č. ' + p.id + ': odpočítaných ' + need + (p.unit === 'd' ? ' d' : ' h') + ', zostáva ' + p.left + '.');
  return res;
}
function buyPackage(uid, type, paid, txn) {
  const t = PKG_TYPES[type];
  if (!paid) { failedPayment(null, t.price, 'predplatený balík', txn); return { ok: false, err: 'Platba bola zamietnutá, balík nevznikol.' }; }
  const d = new Date(S.now), to = new Date(d.getFullYear(), d.getMonth() + t.months, d.getDate(), 23, 59).getTime();
  const p = { id: ++S.seq, user: uid, type, unit: t.unit, orig: t.range, left: t.range, from: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), to };
  S.pkgs.push(p);
  S.pay.push({ id: ++S.seq, res: null, pkg: p.id, amount: t.price, purpose: 'predplatený balík', status: 'úspešná', t: S.now, txn });
  log('Platba', user(uid).name + ' kúpil(a) ' + t.name + ' za ' + eur(t.price) + '.');
  return { ok: true, pkg: p };
}

/* ---- opakovaná rezervácia (F.04, I.03) ---- */
function planRepeat(uid, ecv, p) {
  const u = user(uid), out = [], start = new Date(p.start + 'T00:00:00').getTime();
  const [fh, fm] = p.tFrom.split(':').map(Number), [th, tm] = p.tTo.split(':').map(Number);
  for (let i = 0; i < p.weeks * 7; i++) {
    const d = new Date(start + i * DAY);
    if (!p.days.includes(d.getDay())) continue;
    const from = new Date(d.getFullYear(), d.getMonth(), d.getDate(), fh, fm).getTime();
    const to = new Date(d.getFullYear(), d.getMonth(), d.getDate(), th, tm).getTime();
    const o = { uid, ecv, from, to, ev: p.ev, spot: 0 };
    if (!(from < to)) { out.push({ from, to, ok: false, why: 'Začiatok nepredchádza koncu' }); continue; }
    if (from < S.now) { out.push({ from, to, ok: false, why: 'Výskyt je v minulosti' }); continue; }
    if (S.res.some(r => live(r) && r.ecv === ecv && overlap(from, to, r.from, r.to))) { out.push({ from, to, ok: false, why: 'Vozidlo už má v tom čase rezerváciu' }); continue; }
    const sp = autoPick({ from, to, ev: p.ev }, u);
    if (!sp) { out.push({ from, to, ok: false, why: p.ev ? 'Žiadne voľné miesto s nabíjaním' : 'Žiadne voľné miesto' }); continue; }
    o.spot = sp.id; out.push({ from, to, ok: true, spot: sp.id, price: quote(from, to, p.ev).total, o });
  }
  return out;
}
/* ---- automatizovaný vjazd a výjazd (UC12, UC13, F.11, I.06) ---- */
function entry(ecv, o) {
  o = o || {};
  const add = (res, result, why) => S.passages.unshift({ t: S.now, dir: 'vjazd', ecv: ecv || '?', res, result, why });
  if (o.camFail || !ecv) { add(null, 'zamietnutý', 'EČV sa nepodarilo rozpoznať'); log('Prejazd', 'Vjazd: EČV nebolo rozpoznané, rampa sa neotvorí.'); return { ok: false, why: 'EČV nebolo rozpoznané' }; }
  if (S.inside.some(v => v.ecv === ecv)) { add(null, 'zamietnutý', 'Vozidlo je už v garáži'); log('Prejazd', 'Vjazd ' + ecv + ' zamietnutý: vozidlo je už v garáži.'); return { ok: false, why: 'Vozidlo je už v garáži' }; }
  const r = S.res.find(x => x.ecv === ecv && x.status === 'potvrdena' && x.from - EARLY <= S.now && S.now < x.to);
  if (!r) {
    const early = S.res.find(x => x.ecv === ecv && x.status === 'potvrdena' && x.from - EARLY > S.now && S.now < x.to);
    const why = early ? 'Príchod je viac ako 15 minút pred začiatkom rezervácie' : 'Pre EČV neexistuje platná rezervácia';
    add(null, 'zamietnutý', why); log('Prejazd', 'Vjazd ' + ecv + ' zamietnutý: ' + why + '.'); return { ok: false, why };
  }
  if (o.rampFault) { log('Prejazd', 'Vjazd ' + ecv + ': rampa nepotvrdila otvorenie, vjazd sa nezaznamenal.'); return { ok: false, why: 'Rampa nepotvrdila otvorenie', fault: true }; }
  r.status = 'aktivna';
  S.inside.push({ ecv, resId: r.id, t: S.now });
  const sp = S.spots[r.spot - 1]; sp.sensor = true; sp.sensorT = S.now;
  add(r.id, 'povolený', 'Platná rezervácia č. ' + r.id);
  log('Prejazd', 'Vjazd ' + ecv + ' povolený, rezervácia č. ' + r.id + ', miesto ' + r.spot + '.');
  return { ok: true, res: r };
}
function exitCar(ecv, o) {
  o = o || {};
  const add = (res, result, why, over, fee) => S.passages.unshift({ t: S.now, dir: 'výjazd', ecv: ecv || '?', res, result, why, over, fee });
  if (o.camFail || !ecv) { add(null, 'zamietnutý', 'EČV sa nepodarilo rozpoznať'); log('Prejazd', 'Výjazd: EČV nebolo rozpoznané. Rampu otvorí prevádzkovateľ mimo systému.'); return { ok: false, why: 'EČV nebolo rozpoznané' }; }
  const v = S.inside.find(x => x.ecv === ecv);
  if (!v) { add(null, 'zamietnutý', 'Vjazd vozidla sa nenašiel'); log('Prejazd', 'Výjazd ' + ecv + ': vjazd sa nenašiel, rampu otvorí prevádzkovateľ mimo systému.'); return { ok: false, why: 'Vjazd vozidla sa nenašiel' }; }
  if (o.rampFault) { log('Prejazd', 'Výjazd ' + ecv + ': rampa nepotvrdila otvorenie, výjazd sa nezaznamenal.'); return { ok: false, why: 'Rampa nepotvrdila otvorenie', fault: true }; }
  const r = S.res.find(x => x.id === v.resId);
  const over = S.now > r.to ? Math.ceil((S.now - r.to) / MIN) : 0, fee = over ? Math.ceil(over / 60) * RULE.over : 0;
  S.inside = S.inside.filter(x => x !== v);
  const sp = S.spots[r.spot - 1]; sp.sensor = false; sp.sensorT = S.now;
  if (r.status === 'aktivna') r.status = 'ukoncena';
  add(r.id, 'povolený', fee ? 'Prekročený čas ' + over + ' min' : 'Bez prekročenia', over, fee);
  log('Prejazd', 'Výjazd ' + ecv + ' povolený' + (fee ? ', prekročený čas ' + over + ' min, doplatok ' + eur(fee) : '') + '.');
  checkAlerts();
  return { ok: true, res: r, over, fee };
}
function payOvertime(ecv, fee, paid, txn) {
  S.pay.push({ id: ++S.seq, res: null, pkg: null, amount: fee, purpose: 'prekročený čas', status: paid ? 'úspešná' : 'neúspešná', t: S.now, txn });
  log('Platba', 'Doplatok ' + eur(fee) + ' za prekročený čas (' + ecv + '): ' + (paid ? 'uhradený.' : 'neuhradený, výjazd tým nie je dotknutý.'));
}

/* ---- ukončenie rezervácie a presun na iné miesto (UC19, F.12) ---- */
function relocate(r) {
  const u = r.user ? user(r.user) : null;
  const old = S.spots[r.spot - 1];
  const alt = autoPick({ from: r.from, to: r.to, ev: r.ev, large: false }, u, r.spot);
  if (!alt) { log('Systém', 'Rezervácia č. ' + r.id + ': miesto ' + r.spot + ' je obsadené a náhradné miesto sa nenašlo.'); return; }
  r.hist.push(r.spot); r.spot = alt.id;
  log('Systém', 'Miesto ' + old.id + ' ostalo obsadené, rezervácia č. ' + r.id + ' presunutá na miesto ' + alt.id + '.');
  notify(r.user, 'zmena miesta', 'Miesto ' + old.id + ' je ešte obsadené. Nové miesto: ' + alt.id + '.', 'push');
}
function tick() {
  S.res.filter(r => live(r) && r.to <= S.now).forEach(r => {
    r.status = 'ukoncena'; log('Systém', 'Rezervácia č. ' + r.id + ' (' + r.ecv + ') ukončená, miesto ' + r.spot + ' je uvoľnené pre ďalšie rezervácie.');
  });
  S.res.filter(r => r.status === 'potvrdena' && r.from - EARLY <= S.now && S.now < r.to).forEach(r => {
    const sp = S.spots[r.spot - 1];
    const legit = S.res.some(x => x !== r && x.spot === r.spot && x.status === 'aktivna' && x.from <= S.now && S.now < x.to);
    if (sp.sensor && !legit) relocate(r);
  });
  checkAlerts();
}
function advance(minutes) {
  const target = S.now + minutes * MIN;
  while (S.now < target) { S.now = Math.min(S.now + 5 * MIN, target); tick(); }
}

/* ---- upozornenia na voľné miesto (F.07, UC7, UC18) ---- */
function freeNow(sp, type, u) {
  if (!sp.available || sp.sensor || resAt(sp.id, S.now)) return false;
  if (sp.reserved && sp.reserved.from <= S.now && S.now < sp.reserved.to && (!u || sp.reserved.group !== u.group)) return false;
  return type === 'ev' ? sp.ev && !sp.chargerOut : sp.large;
}
function addAlert(uid, type, channel) {
  const u = user(uid);
  if (S.spots.some(sp => freeNow(sp, type, u))) return { ok: false, err: 'Voľné miesto tohto typu už existuje, upozornenie netreba.' };
  S.alerts.push({ id: ++S.seq, user: uid, type, channel, active: true, firedAt: null });
  log('Systém', u.name + ' nastavil(a) upozornenie: ' + (type === 'ev' ? 'miesto s nabíjaním' : 'veľké miesto') + ' (' + channel + ').');
  return { ok: true };
}
function describe(sp) {
  return [sp.large ? 'veľké' : 'štandardné', sp.distExit + ' m od východu', sp.nearLift ? 'pri výťahu' : 'ďaleko od výťahu', sp.ev ? 's nabíjacou stanicou' : 'bez nabíjania'].join(', ');
}
function checkAlerts() {
  S.alerts.filter(a => a.active).forEach(a => {
    const u = user(a.user), sp = S.spots.find(s => freeNow(s, a.type, u));
    if (!sp) return;
    a.active = false; a.firedAt = S.now;
    notify(a.user, 'upozornenie na voľné miesto', 'Uvoľnilo sa miesto ' + sp.id + ' (' + describe(sp) + ').', a.channel);
  });
}

/* ---- zariadenia a správa (UC10, UC11, UC14, UC15) ---- */
function setSensor(id, occupied) {
  const sp = S.spots[id - 1]; sp.sensor = occupied; sp.sensorT = S.now;
  log('Senzor', 'Miesto ' + id + ': ' + (occupied ? 'obsadené' : 'voľné') + ' (údaj zo senzora).');
  tick();
}
function setCharger(id, out) {
  S.spots[id - 1].chargerOut = out;
  log('Senzor', 'Nabíjacia stanica pri mieste ' + id + ': ' + (out ? 'mimo prevádzky' : 'v prevádzke') + '.');
  checkAlerts();
}
function setAvailable(id, on) {
  S.spots[id - 1].available = on;
  log('Audit', 'Správca zmenil dostupnosť miesta ' + id + ': ' + (on ? 'dostupné' : 'nedostupné') + '. Existujúce rezervácie ostávajú nezmenené.');
  checkAlerts();
}
function reserveGroup(ids, group, from, to) {
  if (!(from < to)) return { ok: false, err: 'Začiatok musí predchádzať koncu' };
  const bad = ids.filter(i => !(i >= 1 && i <= 24));
  if (!ids.length || bad.length) return { ok: false, err: 'Zadaj čísla miest 1 až 24, oddelené čiarkou' };
  ids.forEach(i => { S.spots[i - 1].reserved = { group, from, to }; });
  log('Audit', 'Správca vyhradil miesta ' + ids.join(', ') + ' pre skupinu ' + group + '. Existujúce rezervácie ostávajú nezmenené.');
  return { ok: true };
}
function clearGroup(id) { S.spots[id - 1].reserved = null; log('Audit', 'Správca zrušil vyhradenie miesta ' + id + '.'); checkAlerts(); }
function fillGarage() {
  S.spots.filter(sp => sp.available && !sp.sensor && !resAt(sp.id, S.now) && !sp.reserved).forEach(sp => { if (occupancy() < 0.85) { sp.sensor = true; sp.sensorT = S.now; } });
  log('Senzor', 'Garáž zaplnená, obsadenosť ' + Math.round(occupancy() * 100) + ' %.');
}
function raceTest(n) { // N.05: viac súbežných žiadostí o to isté miesto a čas
  const from = S.now + 2 * H, to = S.now + 3 * H, spot = S.spots.find(sp => !spotCheck(sp, from, to, user('jakub'), {}) && !spotCheck(sp, from, to, user('sona'), {}) && !sp.reserved);
  if (!spot) return { ok: 0, fail: 0, spot: null };
  let ok = 0, fail = 0;
  for (let i = 0; i < n; i++) { const r = commit({ uid: null, ecv: 'RC' + String(1000 + i), spot: spot.id, from, to, ev: false }, { method: 'brana', txn: newTxn() }); r.ok ? ok++ : fail++; }
  log('Systém', 'Test súbehu: ' + n + ' žiadostí o miesto ' + spot.id + ', vznikla ' + ok + ' rezervácia, ' + fail + ' zamietnutých (PREKRYTIE).');
  return { ok, fail, spot: spot.id };
}
if (typeof module !== 'undefined') module.exports = { newState, S: () => S, quote, validate, commit, reserveWithPackage, buyPackage, planRepeat, entry, exitCar, advance, addAlert, setSensor, setCharger, search, autoPick, occupancy, raceTest, USERS, at, MIN, H, fillGarage, setAvailable, reserveGroup, pkgCheck };
