function viewReports() {
  const ym = S.ym, prevYm = D.shiftMonth(ym, -1);
  const spent = D.calculateMonthlySpending(S.tx, ym), prev = D.calculateMonthlySpending(S.tx, prevYm);
  const bc = D.sumByCat(S.tx, ym), max = Math.max(1, ...Object.values(bc));
  const catList = Object.entries(bc).sort((a, b) => b[1] - a[1]);
  const dim = D.daysInMonth(ym), daily = Array(dim).fill(0);
  D.inMonth(S.tx, ym).filter(t => t.type === 'expense').forEach(t => daily[+t.date.slice(8) - 1] += t.amount);
  const dmax = Math.max(1, ...daily);
  const months = Array.from({ length: 12 }, (_, k) => D.shiftMonth(ym, k - 11));
  const mv = months.map(m => D.calculateMonthlySpending(S.tx, m)), mmax = Math.max(1, ...mv);
  const top = D.inMonth(S.tx, ym).filter(t => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5);
  const pa = D.paidBy(S.tx, ym, mA()), pb = mB() ? D.paidBy(S.tx, ym, mB()) : 0, ptot = Math.max(1, pa + pb);
  const monthShop = S.shop.filter(i => i.isPurchased && (i.purchasedAt || '').startsWith(ym));
  const pva = D.planVsActual(monthShop);
  const wk = D.weekly(S.tx, today());
  const s = summary(ym);
  const contribs = months.map(m => S.contrib.filter(c => (c.date || '').startsWith(m)).reduce((a, c) => a + c.amount, 0));
  let cum = 0; const cumv = contribs.map(v => cum += v), cmax = Math.max(1, ...cumv);
  const diff = spent - prev;
  return `${header('', { month: true, gear: true })}
  <section class="block"><h2>今月の支出 <span class="tag c">確定</span></h2><p class="kpi">${yen(spent)}</p>
    <p class="muted">先月 ${yen(prev)} から ${diff >= 0 ? `<span class="bad">+${yen(diff)}</span>` : `<span class="good">−${yen(-diff)}</span>`}</p>
    ${D.ym(today()) === ym ? `<p class="muted"><span class="tag f">予測</span> 月末の支出は ${yen(s.forecast)} 前後の見込み</p>` : ''}</section>
  <section class="block"><h2>カテゴリ別</h2>${catList.length ? catList.map(([k, v]) => `<div class="hb"><span>${cat(k).icon} ${esc(cat(k).name)}</span><div class="bar"><i style="width:${v / max * 100}%"></i></div><b>${yen(v)}</b></div>`).join('') : '<p class="muted">今月の支出はまだありません。</p>'}</section>
  <section class="block"><h2>日別の支出</h2><div class="cols">${daily.map((v, i) => `<i style="height:${v / dmax * 100}%" title="${i + 1}日 ${yen(v)}"></i>`).join('')}</div><div class="axis"><span>1日</span><span>${dim}日</span></div></section>
  <section class="block"><h2>ふたりの支払い</h2>${mB() ? `<div class="split"><i class="pa" style="width:${pa / ptot * 100}%"></i><i class="pb" style="width:${pb / ptot * 100}%"></i></div>
    <div class="duo"><div><small><span class="dot pa"></span>${esc(nick(mA()))}</small><b>${yen(pa)}</b></div><div><small><span class="dot pb"></span>${esc(nick(mB()))}</small><b>${yen(pb)}</b></div></div>` : '<p class="muted">パートナーの参加後に表示されます。</p>'}</section>
  <section class="block"><h2>大きな支出 上位5件</h2>${top.length ? top.map(txRow).join('') : '<p class="muted">まだありません。</p>'}</section>
  <section class="block"><h2>1年の推移</h2><div class="cols y">${mv.map((v, i) => `<i class="${months[i] === ym ? 'cur' : ''}" style="height:${v / mmax * 100}%" title="${months[i]} ${yen(v)}"></i>`).join('')}</div><div class="axis"><span>${months[0].replace('-', '/')}</span><span>${ym.replace('-', '/')}</span></div></section>
  <section class="block"><h2>貯金の積み上げ（入金額）</h2><div class="cols y g">${cumv.map(v => `<i style="height:${v / cmax * 100}%"></i>`).join('')}</div><p class="muted small">12か月の入金合計 ${yen(cum)}</p></section>
  <section class="block"><h2>買い物 予定と実績</h2>${monthShop.length ? `<div class="duo"><div><small>予定</small><b>${yen(pva.est)}</b></div><div><small>実際</small><b>${yen(pva.act)}</b></div></div><p class="muted">差額 ${diffStr(pva.diff)}（${monthShop.length}品）</p>` : '<p class="muted">この月に購入した予定品はまだありません。</p>'}</section>
  <section class="block"><h2>週のまとめ</h2><p>直近7日の支出は ${yen(wk.cur)}。その前の7日は ${yen(wk.prev)} でした。</p></section>`;
}

function viewSettings() {
  const c = S.cfg || {};
  const mine = mineFromSplitA(c.defaultSplitA ?? 50);
  return `${header('設定', { back: true })}
  <section class="block"><h2>プロフィール</h2><form data-form="profile" class="form inline"><label>表示名<input name="nickname" maxlength="12" value="${esc(nick(me()))}" required></label><button class="primary sm">保存</button></form></section>
  <section class="block"><h2>パートナー</h2>
    ${members().map(m => `<p><span class="dot ${m.id === mA() ? 'pa' : 'pb'}"></span>${esc(m.nickname)}${m.id === me() ? '（あなた）' : ''}</p>`).join('')}
    <p class="muted small">${mB() ? '機種変更したときは、この招待リンクを新しいスマホで開いてください。' : 'このリンクをパートナーにだけ送ってください。開いて表示名を入れると参加完了です。'}</p>
    <button class="primary wide" data-act="shareInvite">招待リンクを送る</button>
    <button class="ghost wide" data-act="copyInvite">招待リンクをコピー</button>
    <details><summary>リンクが他の人に知られたら</summary><p class="muted small">招待キーを作り直すと、古いリンクでは開けなくなります。パートナーのスマホも使えなくなるので、新しいリンクを送り直してください。</p><button class="danger" data-act="rotate">招待キーを作り直す</button></details>
    <button class="link" data-act="switchMember">この端末のメンバーを切り替える</button>
    <button class="link" data-act="leave">この端末から家計を外す</button>
  </section>
  <section class="block"><h2>家計の基本</h2><form data-form="basics" class="form">
    <label>月の予算<input name="budget" inputmode="numeric" value="${c.budget || ''}" required></label>
    <label>給料日<input name="payday" inputmode="numeric" value="${c.payday || 25}"></label>
    <label>共同支出のあなたの負担（%）<input name="mine" inputmode="numeric" value="${mine}"></label>
    <p class="muted small">集計は毎月1日〜月末、日本時間で行います。</p>
    <button class="primary">保存</button></form></section>
  <section class="block"><div class="bh"><h2>カテゴリと予算</h2><button class="link" data-act="addCat">＋ 追加</button></div>
    ${cats().map(k => `<button class="tx" data-act="editCat" data-id="${k.id}"><span class="ic">${k.icon}</span><span class="tm"><b>${esc(k.name)}</b><small>${k.income ? '収入' : '支出'}</small></span><span class="ta">${k.budget ? yen(k.budget) : '予算なし'}</span></button>`).join('')}</section>
  <section class="block"><div class="bh"><h2>固定費</h2><button class="link" data-act="addRec">＋ 追加</button></div>
    ${S.rec.length ? S.rec.map(r => `<button class="tx" data-act="editRec" data-id="${r.id}"><span class="ic">${cat(r.categoryId).icon}</span><span class="tm"><b>${esc(r.name)}${r.active === false ? '（停止中）' : ''}</b><small>毎月${r.day}日 ・ ${esc(nick(r.payerId))} ・ ${r.isShared ? '共同' : '個人'}</small></span><span class="ta">${yen(r.amount)}</span></button>`).join('') : '<p class="muted">家賃や通信費を登録すると、毎月の支払日に自動で家計簿へ入ります。</p>'}
    <p class="muted small">固定費の合計 ${yen(fixedMonthly())}／月</p></section>
  <section class="block"><h2>表示</h2><div class="seg">${[['system', '端末に合わせる'], ['light', 'ライト'], ['dark', 'ダーク']].map(([k, l]) => `<button class="${theme() === k ? 'on' : ''}" data-act="theme" data-v="${k}">${l}</button>`).join('')}</div></section>
  <section class="block"><h2>データ</h2><button class="ghost wide" data-act="csv">取引をCSVで書き出す</button><button class="ghost wide" data-act="backup">全データをバックアップ（JSON）</button></section>
  <section class="block"><h2>外部連携</h2>${['レシート読み取り', '音声入力', '銀行口座', 'クレジットカード', 'AIによる分析', '通知'].map(n => `<p class="int"><span>${n}</span><span class="tag">未接続</span></p>`).join('')}<p class="muted small">現在は手入力と、アプリ内の集計ルールによる気づきで動いています。</p></section>
  <section class="block"><h2>セキュリティ</h2><p class="muted small">データは招待キーを持つ端末だけが読み書きできます。キーはサーバーにハッシュ化して保存され、通信はHTTPSで暗号化されます。招待リンクは他人に送らないでください。</p></section>`;
}
const theme = () => { try { return localStorage.getItem('theme') || 'system'; } catch { return 'system'; } };
function applyTheme() { const t = theme(); if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
