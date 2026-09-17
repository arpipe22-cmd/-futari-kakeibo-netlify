function sheet(html) {
  const s = document.getElementById('sheet');
  s.querySelector('.sheet-body').innerHTML = html;
  s.classList.add('open');
  const f = s.querySelector('input:not([type=hidden]),select'); if (f && matchMedia('(pointer:fine)').matches) f.focus();
}
function closeSheet() { if (typeof window === 'undefined') return; document.getElementById('sheet').classList.remove('open'); render(); }
const catOptions = (sel, income) => cats().filter(c => !!c.income === !!income || c.id === sel).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('');
const memberOptions = (sel, allowNone) => (allowNone ? `<option value="">指定なし</option>` : '') + members().map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.nickname)}</option>`).join('');
const splitField = (mine) => `<label>あなたの負担（%）<input name="mine" inputmode="numeric" value="${mine}"><small class="muted">相手の負担は残り。例：70なら 70:30</small></label>`;

function txSheet(t) {
  const isNew = !t.id, inc = t.type === 'income';
  const mine = mineFromSplitA(t.splitA ?? S.cfg?.defaultSplitA ?? 50);
  sheet(`<h2>${isNew ? (inc ? '収入を追加' : '支出を追加') : '記録を編集'}</h2>
  <form data-form="tx" class="form">
    <input type="hidden" name="id" value="${t.id || ''}"><input type="hidden" name="type" value="${t.type}"><input type="hidden" name="updatedAt" value="${t.updatedAt || ''}">
    <div class="seg">${[['expense', '支出'], ['income', '収入']].map(([k, l]) => `<button type="button" class="${t.type === k ? 'on' : ''}" data-act="txType" data-v="${k}">${l}</button>`).join('')}</div>
    <label class="money">金額<input name="amount" inputmode="numeric" pattern="[0-9,]*" required value="${t.amount || ''}" placeholder="0" autocomplete="off"></label>
    <label>カテゴリ<select name="categoryId">${catOptions(t.categoryId || (inc ? 'salary' : 'food'), inc)}</select></label>
    <label>メモ<input name="memo" maxlength="40" value="${esc(t.memo || '')}"></label>
    <details ${isNew ? '' : 'open'}><summary>詳しく設定（支払った人・負担割合・日付）</summary>
      <label>日付<input type="date" name="date" value="${t.date || today()}"></label>
      <label>${inc ? '受け取った人' : '支払った人'}<select name="payerId">${memberOptions(t.payerId || me())}</select></label>
      ${inc ? '' : `<label class="sw"><input type="checkbox" name="isShared" ${t.isShared ?? true ? 'checked' : ''}> ふたりの共同支出</label>${splitField(mine)}`}
    </details>
    ${!isNew && t.shoppingItemId ? '<p class="muted small">買い物予定から登録された記録です。</p>' : ''}
    <button class="primary">${isNew ? '保存' : '変更を保存'}</button>
    ${isNew ? '' : `<button type="button" class="danger" data-act="delTx" data-id="${t.id}">この記録を削除</button>`}
  </form>`);
}
function shopSheet(i) {
  const isNew = !i.id;
  const names = [...new Set([...S.hist.map(h => h.name), ...S.inv.map(v => v.name)])];
  sheet(`<h2>${isNew ? '買うものを追加' : '買うものを編集'}</h2>
  <form data-form="shop" class="form">
    <input type="hidden" name="id" value="${i.id || ''}"><input type="hidden" name="updatedAt" value="${i.updatedAt || ''}">
    <label>商品名<input name="name" required maxlength="30" list="names" value="${esc(i.name || '')}" data-input="shopName"></label>
    <datalist id="names">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <p class="hint" id="priceHint">${priceHint(i.name)}</p>
    <div class="two"><label>数量<input name="quantity" inputmode="numeric" value="${i.quantity || 1}"></label><label>単位<input name="unit" maxlength="6" value="${esc(i.unit || '個')}"></label></div>
    <label class="money">予想単価<input name="estimatedUnitPrice" inputmode="numeric" value="${i.estimatedUnitPrice ?? ''}" placeholder="0"></label>
    <div class="seg">${[['required', '必須'], ['optional', '余裕があれば']].map(([k, l]) => `<label class="radio ${(i.priority || 'required') === k ? 'on' : ''}"><input type="radio" name="priority" value="${k}" ${(i.priority || 'required') === k ? 'checked' : ''}>${l}</label>`).join('')}</div>
    <details><summary>詳しく設定</summary>
      <label>カテゴリ<select name="categoryId">${catOptions(i.categoryId || 'food')}</select></label>
      <label>お店<input name="plannedStore" maxlength="20" value="${esc(i.plannedStore || '')}"></label>
      <label>買う日<input type="date" name="plannedDate" value="${i.plannedDate || ''}"></label>
      <label>担当<select name="assigneeId">${memberOptions(i.assigneeId, true)}</select></label>
      <label>在庫とつなぐ<select name="inventoryItemId"><option value="">なし</option>${S.inv.map(v => `<option value="${v.id}" ${v.id === i.inventoryItemId ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
    </details>
    <button class="primary">保存</button>
    ${isNew ? '' : `<button type="button" class="danger" data-act="delShop" data-id="${i.id}">予定から削除</button>`}
  </form>`);
}
function priceHint(name) {
  const st = name && D.priceStats(S.hist, name);
  return st ? `前回 ${yen(st.last)} ・ 過去平均 ${yen(st.avg)}${st.store ? ` ・ 前回店舗 ${esc(st.store)}` : ''} <button type="button" class="link" data-act="useAvg" data-v="${st.avg}">平均を入れる</button>` : '';
}
function buySheet(i) {
  sheet(`<h2>${esc(i.name)} を購入</h2>
  <form data-form="buy" class="form"><input type="hidden" name="id" value="${i.id}">
    <p class="muted">予想 ${i.quantity}${esc(i.unit || '')} × ${yen(i.estimatedUnitPrice)} = ${yen(i.estimatedUnitPrice * i.quantity)}</p>
    <label class="money">実際の単価<input name="actualUnitPrice" inputmode="numeric" value="${i.actualUnitPrice ?? i.estimatedUnitPrice ?? ''}" required></label>
    <label>数量<input name="quantity" inputmode="numeric" value="${i.quantity || 1}"></label>
    <label>買ったお店<input name="store" maxlength="20" value="${esc(i.actualStore || i.plannedStore || '')}"></label>
    <label>支払った人<select name="payerId">${memberOptions(i.payerId || me())}</select></label>
    <button class="primary">購入済みにする</button>
  </form>`);
}
function invSheet(v) {
