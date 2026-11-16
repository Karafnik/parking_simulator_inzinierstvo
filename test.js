const L=require('./logic.js');const assert=require('assert');
L.newState(); let S=L.S(); const {at,MIN,H}=L;
// occupancy
console.log('occ',L.occupancy().toFixed(3));
// price
let q=L.quote(at(16,9,0),at(16,11,0),false);assert.equal(q.total,4);
q=L.quote(at(16,9,0),at(16,11,0),true);assert.equal(q.total,6);
L.fillGarage();assert(L.occupancy()>=0.8);q=L.quote(at(16,9,0),at(16,11,0),false);assert.equal(q.total,6);console.log('surcharge ok',q.total);
L.newState();S=L.S();
// overlap
let o={uid:'sona',ecv:'KE456CD',spot:21,from:at(16,10,0),to:at(16,12,0),ev:false};
assert(L.commit(o,{method:'brana'}).ok);
assert(!L.commit({...o,ecv:'XX11111'},{method:'brana'}).ok);        // spot overlap
assert(!L.commit({...o,spot:22},{method:'brana'}).ok);               // ecv overlap
assert(L.commit({...o,ecv:'XX11111',from:at(16,12,0),to:at(16,13,0)},{method:'brana'}).ok); // adjacent
// group
assert(L.validate({uid:'jakub',ecv:'BA123AB',spot:20,from:at(16,10,0),to:at(16,11,0)})==='Vyhradené pre skupinu VIP');
assert(!L.validate({uid:'sona',ecv:'KE456CD',spot:20,from:at(16,13,0),to:at(16,14,0)}));
// EV needs charger
L.setCharger(11,true);assert(L.validate({uid:'jakub',ecv:'BA123AB',spot:11,from:at(16,10,0),to:at(16,11,0),ev:true}));
// entry/exit
L.newState();S=L.S();
let r=L.commit({uid:'jakub',ecv:'TS123AB',spot:22,from:at(16,8,16),to:at(16,9,10),ev:false},{method:'brana'});assert(r.ok);
assert(!L.entry('TS123AB').ok); // 16 min early
L.advance(1);assert(L.entry('TS123AB').ok);
L.advance(2*60); // now 10:01, res ended 9:10 -> 51min over
let x=L.exitCar('TS123AB');assert.equal(x.over,51);assert.equal(x.fee,4);
console.log('over',x.over,x.fee);
// unknown ecv
assert(!L.entry('NOPE123').ok);
// relocation of Jakub res at spot 4
L.newState();S=L.S();L.advance(25);let j=S.res.find(z=>z.user==='martin'&&z.spot===4);assert(j,'still on 4');L.advance(5);
j=S.res.find(z=>z.user==='martin'&&z.status==='potvrdena');console.log('jakub spot now',j.spot);assert(j.spot!==4);
// package
L.newState();S=L.S();
let p=L.reserveWithPackage({uid:'jakub',ecv:'BA123AB',spot:21,from:at(17,9,0),to:at(17,12,0),ev:false},1);assert(p.ok);assert.equal(S.pkgs[0].left,2);
p=L.reserveWithPackage({uid:'jakub',ecv:'BA123AB',spot:21,from:at(17,13,0),to:at(17,16,0),ev:false},1);assert(!p.ok);console.log(p.err);assert.equal(S.pkgs[0].left,2);
// repeat
let plan=L.planRepeat('jakub','BA123AB',{days:[1,3],tFrom:'10:00',tTo:'16:00',start:'2026-11-16',weeks:2,ev:true});
console.log(plan.map(a=>a.ok?('ok sp'+a.spot):a.why));
// alert
L.newState();S=L.S();console.log(L.addAlert('jakub','ev','SMS'));
// race
console.log(L.raceTest(30));
console.log('ALL OK');
