function viewShop() {
  const items = S.shop, open = openShop();
  const all = D.calculateShoppingEstimate(items), req = D.calculateRequiredShoppingEstimate(items);
  const rem = summary(D.ym(today())).remaining;
  const done = items.filter(i => i.isPurchased && !i.transactionId);
  const booked = items.filter(i => i.transactionId).sort((a, b) => (b.purchasedAt || '').localeCompare(a.purchasedAt || '')).slice(0, 15);
  const pva = D.planVsActual(done);
  const row = (i) => {
    const st = D.priceStats(S.hist, i.name);
    return `<div class="si ${i.priority}">
      <button class="check" data-act="buy" data-id="${i.id}" aria-label="購入済みにする"></button>
      <button class="sm-body" data-act="editShop" data-id="${i.id}"><b>${esc(i.name)}</b><small>${i.quantity}${esc(i.unit || '')} × ${yen(i.estimatedUnitPrice)}${i.plannedStore ? ' ・ ' + esc(i.plannedStore) : ''}${i.assigneeId ? ' ・ ' + esc(nick(i.assigneeId)) : ''}${st ? ` ・ 前回${yen(st.last)}` : ''}</small></button>
      <span class="amt">${yen(i.estimatedUnitPrice * i.quantity)}</span></div>`;
  };
  const req_ = open.filter(i => i.priority === 'required'), opt = open.filter(i => i.priority !== 'required');
  return `${header('買い物予定', { back: true })}
  <section class="hero small">
    <p class="lead">今回の買い物 予想合計</p><p class="amount">${yen(all)}</p>
    <div class="duo"><div><small>必須だけ</small><b>${yen(req)}</b></div><div><small>余裕があれば</small><b>${yen(all - req)}</b></div></div>
    <div class="sim">
      <p><span>いまの月予算残り</span><b>${yen(rem)}</b></p>
      <p><span>全部買ったら</span><b class="${rem - all < 0 ? 'bad' : ''}">残り ${yen(rem - all)}</b></p>
      <p><span>必須だけなら</span><b class="${rem - req < 0 ? 'bad' : ''}">残り ${yen(rem - req)}</b></p>
    </div>
  </section>
  <div class="actions"><button class="primary" data-act="addShop">＋ 買うものを追加</button></div>
  ${open.length ? '' : `<div class="empty"><p>買う予定のものはありません。日用品の「残り少ない」から追加すると価格も自動で入ります。</p></div>`}
  ${req_.length ? `<section class="block"><h2>必須</h2>${req_.map(row).join('')}</section>` : ''}
  ${opt.length ? `<section class="block"><h2>余裕があれば</h2>${opt.map(row).join('')}</section>` : ''}
  ${done.length ? `<section class="block"><div class="bh"><h2>購入済み（未反映）</h2></div>
    ${done.map(i => `<div class="si done"><button class="check on" data-act="unbuy" data-id="${i.id}" aria-label="未購入に戻す"></button><button class="sm-body" data-act="buy" data-id="${i.id}"><b>${esc(i.name)}</b><small>予想 ${yen(i.estimatedUnitPrice * i.quantity)} → 実際 ${yen(D.actualAmount(i))} <span class="${D.actualAmount(i) > i.estimatedUnitPrice * i.quantity ? 'bad' : 'good'}">${diffStr(D.actualAmount(i) - i.estimatedUnitPrice * i.quantity)}</span></small></button></div>`).join('')}
    <p class="muted small">予想 ${yen(pva.est)} / 実際 ${yen(pva.act)}（${diffStr(pva.diff)}）</p>
    <button class="primary wide" data-act="book">購入した${done.length}件を家計簿へ反映</button>
    <p class="muted small">家計簿への登録・価格履歴の保存・在庫の補充を一度に行います。同じ商品が二重に登録されることはありません。</p></section>` : ''}
  ${booked.length ? `<section class="block"><h2>反映済み</h2>${booked.map(i => `<div class="si done"><span class="check on" aria-hidden="true"></span><span class="sm-body"><b>${esc(i.name)}</b><small>${(i.purchasedAt || '').slice(0, 10)} ・ ${yen(D.actualAmount(i))}</small></span><button class="link" data-act="delShop" data-id="${i.id}">消す</button></div>`).join('')}</section>` : ''}`;
}
const diffStr = (d) => d === 0 ? '±0' : (d > 0 ? '+' : '−') + yen(Math.abs(d)).slice(0);

function viewInv() {
  const tab = S.tab.inv || 'daily';
  const seg = `<div class="seg">${[['daily', '日用品'], ['food', '食品'], ['meal', '献立']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-k="inv" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (tab === 'meal') return header('日用品・食品', { gear: true }) + seg + viewMeals();
  const list = S.inv.filter(i => (i.kind || 'daily') === tab).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return `${header('日用品・食品', { gear: true })}${seg}
  <div class="actions"><button class="primary" data-act="addInv" data-kind="${tab}">＋ ${tab === 'food' ? '食品' : '日用品'}を追加</button></div>
  ${list.length ? `<section class="block flat">${list.map(invRow).join('')}</section>` : `<div class="empty"><p>${tab === 'food' ? '米や卵など、切らしたくない食品を登録しましょう。' : 'トイレットペーパーや洗剤など、切らしたくない物を登録しましょう。'}</p></div>`}`;
}
const rank = (i) => ({ out_of_stock: 0, low: 1, in_stock: 2 }[i.status] ?? 2);
function invRow(i) {
  const pending = S.shop.some(s => s.inventoryItemId === i.id && !s.isPurchased);
  const exp = i.expirationDate ? ` ・ 期限 ${i.expirationDate.slice(5).replace('-', '/')}` : '';
  return `<div class="inv ${i.status}">
    <button class="sm-body" data-act="editInv" data-id="${i.id}"><b>${esc(i.name)}</b><small>${i.lastPrice ? `前回 ${yen(i.lastPrice)}${i.lastStore ? '（' + esc(i.lastStore) + '）' : ''}` : '価格記録なし'}${i.lastPurchasedAt ? ' ・ ' + i.lastPurchasedAt.slice(5).replace('-', '/') + '購入' : ''}${exp}</small></button>
    <div class="st">${Object.entries(STATUS).map(([k, l]) => `<button class="${i.status === k ? 'on ' + k : ''}" data-act="invStatus" data-id="${i.id}" data-s="${k}">${l.replace('残り', '')}</button>`).join('')}</div>
    ${i.status !== 'in_stock' ? (pending ? '<span class="muted small">予定に追加済み</span>' : `<button class="link" data-act="invToShop" data-id="${i.id}">買うもの予定へ追加</button>`) : ''}
  </div>`;
}
function viewMeals() {
  const t = today(), days = Array.from({ length: 7 }, (_, k) => { const d = new Date(Date.parse(t + 'T00:00:00Z') + k * 86400000); return d.toISOString().slice(0, 10); });
  return `<p class="muted small">献立の材料のうち、在庫にないものを買うもの予定へ追加できます。</p>${days.map(d => {
    const m = S.meals.find(x => x.id === d) || {};
    const w = '日月火水木金土'[new Date(d + 'T00:00:00Z').getUTCDay()];
    return `<button class="meal" data-act="editMeal" data-id="${d}"><b>${d.slice(5).replace('-', '/')}（${w}）</b>
      <span>朝 ${esc(m.breakfast || '—')}</span><span>昼 ${esc(m.lunch || '—')}</span><span>夜 ${esc(m.dinner || '—')}</span>
      ${m.ingredients?.length ? `<small class="muted">材料：${esc(m.ingredients.join('、'))}</small>` : ''}</button>`;
  }).join('')}`;
}

function viewGoals() {
  const goals = S.goals.filter(g => !g.wish), wish = S.goals.filter(g => g.wish);
  const shared = goals.filter(g => g.kind !== 'personal').reduce((s, g) => s + (g.saved || 0), 0);
  const mine = goals.filter(g => g.kind === 'personal' && g.ownerId === me()).reduce((s, g) => s + (g.saved || 0), 0);
  return `${header('貯金・目標', { gear: true })}
  <section class="hero small"><p class="lead">共同の貯金</p><p class="amount">${yen(shared)}</p><div class="duo"><div><small>${esc(nick(me()))}の個人貯金</small><b>${yen(mine)}</b></div><div><small>目標の数</small><b>${goals.length}</b></div></div></section>
  <div class="actions"><button class="primary" data-act="addGoal">＋ 貯金目標</button><button class="ghost" data-act="addGoal" data-wish="1">＋ ほしい物</button></div>
  <section class="block">${goals.length ? goals.map(g => goalRow(g) + `<div class="gact"><button class="ghost sm" data-act="contrib" data-id="${g.id}">入金する</button></div>`).join('') : `<div class="empty"><p>旅行や引っ越しなど、ふたりの目標を登録しましょう。</p></div>`}</section>
  ${wish.length ? `<section class="block"><h2>ほしい物リスト</h2>${wish.map(g => `<button class="tx" data-act="editGoal" data-id="${g.id}"><span class="ic">✨</span><span class="tm"><b>${esc(g.name)}</b><small>${esc(g.memo || '')}</small></span><span class="ta">${yen(g.target)}</span></button>`).join('')}</section>` : ''}`;
}
