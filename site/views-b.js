function viewHome() {
  const s = summary(), st = settlement(), t = today();
  const over = s.remaining < 0, used = s.budget ? Math.min(100, Math.round(s.spent / s.budget * 100)) : 0;
  const recent = S.tx.filter(x => x.date?.startsWith(S.ym)).sort(byDateDesc).slice(0, 5);
  const low = S.inv.filter(i => i.status !== 'in_stock');
  const shopEst = D.calculateShoppingEstimate(S.shop), shopN = openShop().length;
  const fbc = forecastByCat(S.ym);
  const catRows = cats().filter(c => c.budget > 0).map(c => catBudgetRow(c, S.ym));
  const ins = D.insights({ txs: S.tx, ym: S.ym, today: t, categories: cats(), forecastByCat: fbc });
  const isNow = D.ym(t) === S.ym;
  return `${header('', { month: true, gear: true })}
  <section class="hero ${over ? 'over' : ''}">
    <p class="lead">${over ? '今月は予算を' : '今月あと'}</p>
    <p class="amount">${yen(Math.abs(s.remaining))}${over ? '<span> オーバー</span>' : ''}</p>
    ${isNow ? `<p class="per">1日あたり <b>${yen(s.daily)}</b><span>残り${s.left}日</span></p>` : ''}
    <div class="track" role="img" aria-label="予算の使用${used}%、月の経過${s.elapsedPct}%">
      <div class="fill" style="width:${used}%"></div>${isNow ? `<div class="tick" style="left:${s.elapsedPct}%"></div>` : ''}
    </div>
    <div class="trackl"><span>予算 ${yen(s.budget)} の${used}%を使用</span>${isNow ? `<span>月の${s.elapsedPct}%が経過</span>` : ''}</div>
    ${isNow ? `<p class="forecast"><span class="tag f">予測</span>このペースなら月末 ${s.endBalance >= 0 ? `<b>${yen(s.endBalance)}</b> 残る見込み` : `<b class="bad">${yen(-s.endBalance)}</b> 超える見込み`}</p>` : ''}
  </section>
  <div class="actions">
    <button class="primary" data-act="addTx" data-type="expense">＋ 支出</button>
    <button class="ghost" data-act="go" data-v="shop">買い物予定<small>${shopN ? `${shopN}件・約${yen(shopEst)}` : 'なし'}</small></button>
  </div>
  <section class="block">
    <div class="row3">
      <div><small>収入</small><b>${yen(s.income)}</b></div>
      <div><small>支出</small><b>${yen(s.spent)}</b></div>
      <div><small>月末予想支出</small><b class="fc">${yen(s.forecast)}</b></div>
    </div>
  </section>
  ${settleBlock(st)}
  ${templatesBlock()}
  <section class="block">
    <div class="bh"><h2>最近の記録</h2><button class="link" data-act="go" data-v="history">すべて見る</button></div>
    ${recent.length ? recent.map(txRow).join('') : `<div class="empty"><p>今月の記録はまだありません。</p><button class="primary sm" data-act="addTx" data-type="expense">最初の支出を登録する</button></div>`}
  </section>
  ${catRows.length ? `<section class="block"><div class="bh"><h2>カテゴリ予算</h2><button class="link" data-act="go" data-v="settings">編集</button></div>${catRows.join('')}</section>` : ''}
  ${low.length ? `<section class="block"><div class="bh"><h2>足りない日用品</h2><button class="link" data-act="go" data-v="inv">在庫を見る</button></div>
    <div class="chips">${low.map(i => `<button class="chip ${i.status}" data-act="invToShop" data-id="${i.id}">${esc(i.name)}<small>${STATUS[i.status]}・予定に追加</small></button>`).join('')}</div></section>` : ''}
  ${S.goals.filter(g => !g.wish).length ? `<section class="block"><div class="bh"><h2>貯金目標</h2><button class="link" data-act="go" data-v="goals">すべて見る</button></div>${S.goals.filter(g => !g.wish).slice(0, 2).map(goalRow).join('')}</section>` : ''}
  ${ins.length ? `<section class="block"><h2>気づき</h2>${ins.slice(0, 4).map(i => `<p class="ins ${i.tone}">${esc(i.text)}</p>`).join('')}</section>` : ''}`;
}
function settleBlock(st) {
  if (!st) return `<section class="block settle"><h2>ふたりの精算</h2><p class="muted">パートナーが参加すると、誰が誰にいくら払うかがここに出ます。設定の「パートナー」から招待方法を確認できます。</p></section>`;
  const paidMe = D.paidBy(S.tx, S.ym, me()), paidP = D.paidBy(S.tx, S.ym, partner());
  return `<section class="block settle">
    <div class="bh"><h2>ふたりの精算</h2>${st.amount ? `<button class="link" data-act="settle">精算済みにする</button>` : ''}</div>
    ${st.amount ? `<p class="flow"><span class="p ${st.from === mA() ? 'pa' : 'pb'}">${esc(nick(st.from))}</span><span class="arr">→</span><span class="p ${st.to === mA() ? 'pa' : 'pb'}">${esc(nick(st.to))}</span><b>${yen(st.amount)}</b></p>` : '<p class="flow ok">いまは精算の必要はありません</p>'}
    <div class="duo"><div><small>${esc(nick(me()))}が今月払った</small><b>${yen(paidMe)}</b></div><div><small>${esc(nick(partner()))}が今月払った</small><b>${yen(paidP)}</b></div></div>
  </section>`;
}
function templatesBlock() {
  return `<section class="block"><h2>よく使う支出</h2><div class="chips">${TEMPLATES.map(([n, c]) => `<button class="chip" data-act="addTx" data-type="expense" data-memo="${n}" data-cat="${c}">${cat(c).icon} ${n}</button>`).join('')}</div></section>`;
}
function catBudgetRow(c, ym) {
  const spent = D.sumByCat(S.tx, ym)[c.id] || 0, pct = c.budget ? Math.round(spent / c.budget * 100) : 0;
  return `<div class="cb"><div class="cbh"><span>${c.icon} ${esc(c.name)}</span><span class="${pct > 100 ? 'bad' : ''}">${yen(spent)} / ${yen(c.budget)}</span></div>
    <div class="bar"><i style="width:${Math.min(100, pct)}%" class="${pct > 100 ? 'over' : pct > 80 ? 'warn' : ''}"></i></div>
    <small class="muted">${pct > 100 ? `${yen(spent - c.budget)} オーバー` : `残り ${yen(c.budget - spent)}（${pct}%使用）`}</small></div>`;
}
const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '');
function txRow(t) {
  const c = cat(t.categoryId), inc = t.type === 'income';
  const who = t.payerId ? `<span class="dot ${t.payerId === mA() ? 'pa' : 'pb'}"></span>${esc(nick(t.payerId))}` : '';
  return `<button class="tx" data-act="editTx" data-id="${t.id}">
    <span class="ic">${c.icon}</span>
    <span class="tm"><b>${esc(t.memo || c.name)}</b><small>${t.date.slice(5).replace('-', '/')} ・ ${who}${t.isShared ? ' ・ 共同' : ' ・ 個人'}${t.recurringId ? ' ・ 固定費' : ''}${t.shoppingItemId ? ' ・ 買い物' : ''}</small></span>
    <span class="ta ${inc ? 'inc' : ''}">${inc ? '+' : '−'}${yen(t.amount)}</span></button>`;
}
function goalRow(g) {
  const p = D.calculateSavingsProgress(g, today());
  return `<button class="goal" data-act="editGoal" data-id="${g.id}">
    <div class="gh"><b>${esc(g.name)}</b><span>${p.rate}%</span></div>
    <div class="bar"><i style="width:${p.rate}%" class="g"></i></div>
    <small class="muted">${yen(g.saved)} / ${yen(g.target)} ・ 残り ${yen(p.remaining)}${p.perMonth ? ` ・ 毎月 ${yen(p.perMonth)} 必要` : ''}${g.kind === 'personal' ? ` ・ ${esc(nick(g.ownerId))}の個人` : ' ・ 共同'}</small></button>`;
}

function viewHistory() {
  const mode = S.tab.history || 'list';
  let list = S.tx.filter(t => t.date?.startsWith(S.ym));
  if (S.filter === 'expense' || S.filter === 'income') list = list.filter(t => t.type === S.filter);
  if (S.filter === 'mine') list = list.filter(t => t.payerId === me());
  if (S.filter === 'partner') list = list.filter(t => t.payerId === partner());
  if (S.filter === 'shared') list = list.filter(t => t.isShared);
  if (S.filter.startsWith('cat:')) list = list.filter(t => t.categoryId === S.filter.slice(4));
  if (/^\d{4}-\d{2}-\d{2}$/.test(S.q)) list = list.filter(t => t.date === S.q);
  else if (S.q) { const q = S.q.toLowerCase(); list = list.filter(t => (t.memo || '').toLowerCase().includes(q) || cat(t.categoryId).name.includes(S.q) || String(t.amount).includes(q)); }
  list.sort(byDateDesc);
  const opts = [['all', 'すべて'], ['expense', '支出'], ['income', '収入'], ['shared', '共同'], ['mine', '自分が支払い'], ['partner', '相手が支払い'], ...cats().map(c => ['cat:' + c.id, c.icon + ' ' + c.name])];
  let body;
  if (mode === 'cal') {
    const dim = D.daysInMonth(S.ym), first = new Date(Date.UTC(+S.ym.slice(0, 4), +S.ym.slice(5) - 1, 1)).getUTCDay();
    const byDay = {}; list.filter(t => t.type === 'expense').forEach(t => byDay[t.date] = (byDay[t.date] || 0) + t.amount);
    const cells = Array(first).fill('<div></div>').concat(Array.from({ length: dim }, (_, i) => { const d = `${S.ym}-${String(i + 1).padStart(2, '0')}`; const v = byDay[d]; return `<button class="cd ${d === today() ? 'today' : ''}" data-act="dayFilter" data-d="${d}"><span>${i + 1}</span>${v ? `<small>${v >= 10000 ? Math.round(v / 1000) + 'k' : v.toLocaleString()}</small>` : ''}</button>`; }));
    body = `<div class="cal">${'日月火水木金土'.split('').map(w => `<b>${w}</b>`).join('')}${cells.join('')}</div>`;
    if (S.q && /^\d{4}-\d{2}-\d{2}$/.test(S.q)) body += list.map(txRow).join('');
  } else {
    body = list.length ? list.map(txRow).join('') : `<div class="empty"><p>該当する記録はありません。</p></div>`;
  }
  const tot = list.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return `${header('', { month: true, back: true })}
  <div class="seg">${[['list', '一覧'], ['cal', 'カレンダー']].map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-act="tab" data-k="history" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="filters"><input type="search" placeholder="メモ・金額で検索" value="${esc(S.q)}" data-input="q"><select data-input="filter">${opts.map(([k, l]) => `<option value="${k}" ${S.filter === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
  <p class="muted small">表示中の支出合計 ${yen(tot)}</p>
  <section class="block flat">${body}</section>`;
}
