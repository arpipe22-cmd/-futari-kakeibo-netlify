function invSheet(v) {
  const isNew = !v.id, food = (v.kind || 'daily') === 'food';
  sheet(`<h2>${isNew ? (food ? '食品を追加' : '日用品を追加') : '在庫を編集'}</h2>
  <form data-form="inv" class="form"><input type="hidden" name="id" value="${v.id || ''}"><input type="hidden" name="kind" value="${v.kind || 'daily'}"><input type="hidden" name="updatedAt" value="${v.updatedAt || ''}">
    <label>名前<input name="name" required maxlength="30" value="${esc(v.name || '')}"></label>
    <div class="two"><label>数量<input name="quantity" inputmode="numeric" value="${v.quantity ?? 1}"></label><label>単位<input name="unit" maxlength="6" value="${esc(v.unit || '個')}"></label></div>
    <label>状態<select name="status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>カテゴリ<select name="categoryId">${catOptions(v.categoryId || (food ? 'food' : 'daily'))}</select></label>
    <label>買い替えの目安（日）<input name="purchaseCycleDays" inputmode="numeric" value="${v.purchaseCycleDays || ''}"></label>
    ${food ? `<label>賞味・消費期限<input type="date" name="expirationDate" value="${v.expirationDate || ''}"></label>` : ''}
    <button class="primary">保存</button>
    ${isNew ? '' : `<button type="button" class="danger" data-act="delInv" data-id="${v.id}">削除</button>`}
  </form>`);
}
function goalSheet(g) {
  const isNew = !g.id;
  sheet(`<h2>${g.wish ? 'ほしい物' : '貯金目標'}${isNew ? 'を追加' : 'を編集'}</h2>
  <form data-form="goal" class="form"><input type="hidden" name="id" value="${g.id || ''}"><input type="hidden" name="wish" value="${g.wish ? 1 : ''}"><input type="hidden" name="updatedAt" value="${g.updatedAt || ''}">
    <label>名前<input name="name" required maxlength="30" value="${esc(g.name || '')}" placeholder="${g.wish ? '例：ソファ' : '例：沖縄旅行'}"></label>
    <label class="money">${g.wish ? '予算' : '目標金額'}<input name="target" inputmode="numeric" required value="${g.target || ''}"></label>
    ${g.wish ? `<label>メモ<input name="memo" maxlength="40" value="${esc(g.memo || '')}"></label>` : `
    <label class="money">いまの金額<input name="saved" inputmode="numeric" value="${g.saved || 0}"></label>
    <label>目標日<input type="date" name="dueDate" value="${g.dueDate || ''}"></label>
    <label>種類<select name="kind"><option value="shared">共同の貯金</option><option value="personal" ${g.kind === 'personal' ? 'selected' : ''}>自分の個人貯金</option></select></label>`}
    <button class="primary">保存</button>
    ${isNew ? '' : `<button type="button" class="danger" data-act="delGoal" data-id="${g.id}">削除</button>`}
  </form>`);
}
function recSheet(r) {
  const isNew = !r.id;
  sheet(`<h2>固定費${isNew ? 'を追加' : 'を編集'}</h2>
  <form data-form="rec" class="form"><input type="hidden" name="id" value="${r.id || ''}">
    <label>名前<input name="name" required maxlength="20" value="${esc(r.name || '')}" placeholder="例：家賃"></label>
    <label class="money">金額<input name="amount" inputmode="numeric" required value="${r.amount || ''}"></label>
    <label>毎月の支払日<input name="day" inputmode="numeric" value="${r.day || 27}"></label>
    <label>カテゴリ<select name="categoryId">${catOptions(r.categoryId || 'rent')}</select></label>
    <label>支払う人<select name="payerId">${memberOptions(r.payerId || me())}</select></label>
    <label class="sw"><input type="checkbox" name="isShared" ${r.isShared ?? true ? 'checked' : ''}> ふたりの共同支出</label>
    ${splitField(mineFromSplitA(r.splitA ?? S.cfg?.defaultSplitA ?? 50))}
    <label class="sw"><input type="checkbox" name="active" ${r.active !== false ? 'checked' : ''}> 毎月自動で登録する</label>
    <button class="primary">保存</button>
    ${isNew ? '' : `<button type="button" class="danger" data-act="delRec" data-id="${r.id}">削除</button>`}
  </form>`);
}
function catSheet(c) {
  sheet(`<h2>カテゴリ${c.id ? 'を編集' : 'を追加'}</h2>
  <form data-form="cat" class="form"><input type="hidden" name="id" value="${c.id || ''}">
    <div class="two"><label>絵文字<input name="icon" maxlength="2" value="${esc(c.icon || '📦')}"></label><label>名前<input name="name" required maxlength="10" value="${esc(c.name || '')}"></label></div>
    <label class="money">月の予算（0で予算なし）<input name="budget" inputmode="numeric" value="${c.budget || 0}"></label>
    <label class="sw"><input type="checkbox" name="income" ${c.income ? 'checked' : ''}> 収入のカテゴリ</label>
    <button class="primary">保存</button>
    ${c.id ? `<button type="button" class="danger" data-act="delCat" data-id="${c.id}">削除（記録は「未分類」になります）</button>` : ''}
  </form>`);
}
function mealSheet(d) {
  const m = S.meals.find(x => x.id === d) || {};
  sheet(`<h2>${d.slice(5).replace('-', '/')} の献立</h2>
  <form data-form="meal" class="form"><input type="hidden" name="id" value="${d}">
    <label>朝<input name="breakfast" maxlength="30" value="${esc(m.breakfast || '')}"></label>
    <label>昼<input name="lunch" maxlength="30" value="${esc(m.lunch || '')}"></label>
    <label>夜<input name="dinner" maxlength="30" value="${esc(m.dinner || '')}"></label>
    <label>材料（読点で区切る）<input name="ingredients" maxlength="200" value="${esc((m.ingredients || []).join('、'))}" placeholder="卵、玉ねぎ、豚肉"></label>
    <button class="primary">保存</button>
    ${m.ingredients?.length ? `<button type="button" class="ghost wide" data-act="mealToShop" data-id="${d}">在庫にない材料を買うもの予定へ</button>` : ''}
  </form>`);
}
function quickSheet() {
  sheet(`<h2>追加する</h2><div class="quick">
    <button data-act="addTx" data-type="expense"><span>−</span>支出</button>
    <button data-act="addTx" data-type="income"><span>+</span>収入</button>
    <button data-act="addShop"><span>🛒</span>買うもの</button>
    <button data-act="addInv" data-kind="daily"><span>🧻</span>日用品</button>
    <button data-act="addGoal"><span>◎</span>貯金目標</button>
    <button data-act="go" data-v="shop"><span>✓</span>買い物予定を見る</button></div>`);
}
