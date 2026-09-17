async function onSubmit(e) {
  const form = e.target.closest('form[data-form]'); if (!form) return;
  e.preventDefault();
  const btn = form.querySelector('button.primary'); if (btn?.disabled) return; if (btn) btn.disabled = true;
  try { await handleForm(form.dataset.form, fd(form), form); } finally { if (btn) btn.disabled = false; }
}
async function handleForm(kind, f, form) {
  const pct = (v) => Math.max(0, Math.min(100, D.toInt(v)));
  if (kind === 'joinKey') {
    const k = parseKey(f.link);
    if (!k) return toast('招待リンクの形式が正しくありません');
    setKey(k); render(); await pull(); render();
    return;
  }
  if (kind === 'onboard') {
    const budget = D.toInt(f.budget); if (budget <= 0) return toast('予算は1円以上で入力してください');
    if (!S.key) {
      let r; try { r = await apiReq('POST', '/api/households'); } catch (e) { return toast(errMsg(e)); }
      setKey(r.key); S.ready = true;
    }
    const mid = S.uid || uid();
    LS.set('member', mid); S.uid = mid;
    if (!await put('config', 'main', { budget, payday: 25, defaultSplitA: pct(f.mine), categories: DEFAULT_CATS, createdAt: nowIso() })) return;
    if (!await put('members', mid, { nickname: f.nickname.trim(), joinedAt: nowIso() })) return;
    S.creating = false;
    recDone = true; render(); toast('家計を作成しました。設定から招待リンクを送れます');
    return;
  }
  if (kind === 'joinMember') {
    await pull();
    if (members().length >= 2) { render(); return toast('この家計はすでに2人で使われています'); }
    const mid = uid();
    LS.set('member', mid); S.uid = mid;
    if (await put('members', mid, { nickname: f.nickname.trim(), joinedAt: nowIso() })) { recDone = false; pull(); render(); } else { LS.del('member'); S.uid = null; }
    return;
  }
  if (kind === 'profile') { await patch('members', me(), { nickname: f.nickname.trim() }); return toast('保存しました'); }
  if (kind === 'basics') {
    const budget = D.toInt(f.budget); if (budget < 0) return toast('予算は0円以上で入力してください');
    await patch('config', 'main', { budget, payday: Math.min(31, Math.max(1, D.toInt(f.payday) || 25)), defaultSplitA: splitAFromMine(pct(f.mine)) });
    return toast('保存しました');
  }
  if (kind === 'tx') {
    const amount = D.toInt(f.amount);
    if (amount <= 0) return toast('金額を入力してください');
    if (amount > 100000000) return toast('金額が大きすぎます');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '')) f.date = today();
    const isNew = !f.id, id = f.id || uid();
    const prev = S.tx.find(t => t.id === id) || {};
    const inc = f.type === 'income';
    const isShared = !inc && (form.querySelector('[name=isShared]') ? !!f.isShared : true);
    const data = {
      ...prev, amount, type: inc ? 'income' : 'expense', date: f.date, categoryId: f.categoryId, memo: (f.memo || '').trim(),
      payerId: f.payerId || me(), expenseOwnerId: isShared ? null : (f.payerId || me()), isShared,
      splitA: inc ? 50 : splitAFromMine(f.mine === undefined ? mineFromSplitA(S.cfg?.defaultSplitA ?? 50) : pct(f.mine)),
      createdBy: prev.createdBy || me(), shoppingItemId: prev.shoppingItemId || null, recurringId: prev.recurringId || null, createdAt: prev.createdAt || nowIso(),
    };
    delete data.id;
    const ok = isNew ? await put('tx', id, { ...data, updatedAt: nowIso() }) : await saveEdit('tx', id, data, f.updatedAt);
    if (ok) { closeSheet(); toast(isNew ? `${yen(amount)} を記録しました` : '変更を保存しました'); }
    return;
  }
  if (kind === 'shop') {
    const id = f.id || uid(), prev = S.shop.find(s => s.id === id) || {};
    const data = { ...prev, name: f.name.trim(), categoryId: f.categoryId || prev.categoryId || 'food', quantity: Math.max(1, D.toInt(f.quantity) || 1), unit: f.unit || '個', estimatedUnitPrice: Math.max(0, D.toInt(f.estimatedUnitPrice)), plannedStore: f.plannedStore ?? prev.plannedStore ?? '', plannedDate: f.plannedDate ?? prev.plannedDate ?? '', assigneeId: f.assigneeId ?? prev.assigneeId ?? '', priority: f.priority === 'optional' ? 'optional' : 'required', inventoryItemId: (f.inventoryItemId ?? prev.inventoryItemId) || null, isPurchased: !!prev.isPurchased, actualUnitPrice: prev.actualUnitPrice ?? null, transactionId: prev.transactionId || null, createdBy: prev.createdBy || me(), createdAt: prev.createdAt || nowIso() };
    delete data.id;
    const ok = f.id ? await saveEdit('shop', id, data, f.updatedAt) : await put('shop', id, { ...data, updatedAt: nowIso() });
    if (ok) { closeSheet(); toast('買うもの予定を保存しました'); }
    return;
  }
  if (kind === 'buy') {
    const i = S.shop.find(s => s.id === f.id); if (!i) return closeSheet();
    if (i.transactionId) { closeSheet(); return toast('この商品はすでに家計簿へ反映済みです'); }
    const ok = await patch('shop', i.id, { isPurchased: true, actualUnitPrice: Math.max(0, D.toInt(f.actualUnitPrice)), quantity: Math.max(1, D.toInt(f.quantity) || 1), actualStore: (f.store || '').trim(), payerId: f.payerId || me(), purchasedAt: nowIso(), updatedAt: nowIso() });
    if (ok) { closeSheet(); toast('購入済みにしました。まとめて家計簿へ反映できます'); }
    return;
  }
  if (kind === 'inv') {
    const id = f.id || uid(), prev = S.inv.find(v => v.id === id) || {};
    const data = { ...prev, name: f.name.trim(), kind: f.kind || 'daily', quantity: Math.max(0, D.toInt(f.quantity)), unit: f.unit || '個', status: STATUS[f.status] ? f.status : 'in_stock', categoryId: f.categoryId, purchaseCycleDays: D.toInt(f.purchaseCycleDays) || null, expirationDate: f.expirationDate || null, lastPrice: prev.lastPrice ?? null, averagePrice: prev.averagePrice ?? null, lastStore: prev.lastStore || '', lastPurchasedAt: prev.lastPurchasedAt || null, createdAt: prev.createdAt || nowIso() };
    delete data.id;
    const ok = f.id ? await saveEdit('inv', id, data, f.updatedAt) : await put('inv', id, { ...data, updatedAt: nowIso() });
    if (ok) { closeSheet(); toast('保存しました'); }
    return;
  }
  if (kind === 'goal') {
    const id = f.id || uid(), prev = S.goals.find(g => g.id === id) || {};
    const target = D.toInt(f.target); if (target <= 0) return toast('金額を入力してください');
    const data = { ...prev, name: f.name.trim(), target, wish: !!f.wish, memo: f.memo || '', saved: f.wish ? 0 : Math.max(0, D.toInt(f.saved)), dueDate: f.dueDate || null, kind: f.kind || 'shared', ownerId: f.kind === 'personal' ? (prev.ownerId || me()) : null, createdAt: prev.createdAt || nowIso() };
    delete data.id;
    const ok = f.id ? await saveEdit('goals', id, data, f.updatedAt) : await put('goals', id, { ...data, updatedAt: nowIso() });
    if (ok) { closeSheet(); toast('保存しました'); }
    return;
  }
  if (kind === 'contrib') {
    const g = S.goals.find(x => x.id === f.id), amount = D.toInt(f.amount);
    if (!g || amount === 0) return toast('金額を入力してください');
    const cur = await col('goals').doc(g.id).get(); const saved = Math.max(0, (cur.data()?.saved || 0) + amount);
    const ok = await put('contrib', uid(), { goalId: g.id, amount, date: today(), by: me(), createdAt: nowIso() }) && await patch('goals', g.id, { saved, updatedAt: nowIso() });
    if (ok) { closeSheet(); toast(`${g.name}に${yen(amount)}入れました`); }
    return;
  }
  if (kind === 'rec') {
    const id = f.id || uid(), amount = D.toInt(f.amount); if (amount <= 0) return toast('金額を入力してください');
    const ok = await put('rec', id, { name: f.name.trim(), amount, day: Math.min(31, Math.max(1, D.toInt(f.day) || 1)), categoryId: f.categoryId, payerId: f.payerId || me(), isShared: !!f.isShared, splitA: splitAFromMine(pct(f.mine)), active: !!f.active, updatedAt: nowIso() });
    if (ok) { closeSheet(); await applyRecurring(); toast('固定費を保存しました'); }
    return;
  }
  if (kind === 'cat') {
    const list = cats().map(c => ({ ...c })), id = f.id || 'c' + uid();
    const item = { id, name: f.name.trim(), icon: f.icon || '📦', budget: Math.max(0, D.toInt(f.budget)), income: !!f.income };
    const k = list.findIndex(c => c.id === id); if (k >= 0) list[k] = item; else list.push(item);
    if (await patch('config', 'main', { categories: list })) { closeSheet(); toast('カテゴリを保存しました'); }
    return;
  }
  if (kind === 'meal') {
    const ingredients = (f.ingredients || '').split(/[、,，\n]/).map(s => s.trim()).filter(Boolean).slice(0, 30);
    if (await put('meals', f.id, { breakfast: f.breakfast || '', lunch: f.lunch || '', dinner: f.dinner || '', ingredients, updatedAt: nowIso() })) { closeSheet(); toast('献立を保存しました'); }
  }
}

async function onClick(e) {
  if (e.target.id === 'sheet') return closeSheet();
  const b = e.target.closest('[data-act]'); if (!b) return;
  const { act, id } = b.dataset;
  const inSheet = !!b.closest('#sheet');
  switch (act) {
    case 'close': return closeSheet();
    case 'retry': S.loadError = false; render(); return pull();
    case 'startCreate': S.creating = true; return render();
    case 'cancelCreate': S.creating = false; return render();
    case 'pickMember': LS.set('member', id); S.uid = id; recDone = false; S.view = 'home'; pull(); return render();
    case 'switchMember': if (confirm('この端末で使うメンバーを選び直しますか？')) { LS.del('member'); S.uid = null; render(); } return;
    case 'leave': if (confirm('この端末から家計を外しますか？データは消えません。もう一度使うには招待リンクが必要です。')) { LS.del('key'); LS.del('member'); LS.del('cache'); location.reload(); } return;
    case 'copyInvite': try { await navigator.clipboard.writeText(inviteUrl()); toast('招待リンクをコピーしました'); } catch { prompt('このリンクをコピーしてください', inviteUrl()); } return;
    case 'shareInvite': if (navigator.share) { try { await navigator.share({ title: 'ふたり家計', text: 'ふたりの家計簿に招待します。このリンクを開いてね', url: inviteUrl() }); } catch { } } else { try { await navigator.clipboard.writeText(inviteUrl()); toast('招待リンクをコピーしました'); } catch { prompt('このリンクをコピーしてください', inviteUrl()); } } return;
    case 'rotate': if (confirm('招待キーを作り直しますか？パートナーのスマホは、新しいリンクを開くまで使えなくなります。')) { try { const r = await apiReq('POST', '/api/rotate'); LS.set('key', r.key); S.key = r.key; toast('作り直しました。新しいリンクを送ってください'); render(); } catch (e) { toast(errMsg(e)); } } return;
    case 'go': if (inSheet) document.getElementById('sheet').classList.remove('open'); S.view = b.dataset.v; S.q = ''; S.filter = 'all'; scrollTo(0, 0); return render();
    case 'month': S.ym = D.shiftMonth(S.ym, +b.dataset.d); return render();
    case 'tab': S.tab[b.dataset.k] = b.dataset.v; if (b.dataset.k === 'history') S.q = ''; return render();
    case 'quick': return quickSheet();
    case 'addTx': return txSheet({ type: b.dataset.type, memo: b.dataset.memo || '', categoryId: b.dataset.cat, isShared: true });
    case 'txType': { const f = b.closest('form'); const cur = fd(f); return txSheet({ ...S.tx.find(t => t.id === cur.id), type: b.dataset.v, amount: D.toInt(cur.amount) || '', memo: cur.memo, id: cur.id || undefined, updatedAt: cur.updatedAt }); }
    case 'editTx': return txSheet(S.tx.find(t => t.id === id));
    case 'delTx': if (confirm('この記録を削除しますか？')) { const t = S.tx.find(x => x.id === id); if (await del('tx', id)) { if (t?.shoppingItemId) await patch('shop', t.shoppingItemId, { transactionId: null, updatedAt: nowIso() }); closeSheet(); toast('削除しました'); } } return;
    case 'dayFilter': S.q = b.dataset.d; return render();
    case 'addShop': return shopSheet({});
    case 'editShop': return shopSheet(S.shop.find(s => s.id === id));
    case 'delShop': if (confirm('買うもの予定から削除しますか？（家計簿の記録は残ります）')) { if (await del('shop', id)) { if (inSheet) closeSheet(); toast('削除しました'); } } return;
    case 'useAvg': { const inp = document.querySelector('#sheet [name=estimatedUnitPrice]'); if (inp) inp.value = b.dataset.v; return; }
    case 'buy': return buySheet(S.shop.find(s => s.id === id));
    case 'unbuy': { const i = S.shop.find(s => s.id === id); if (i && !i.transactionId) await patch('shop', id, { isPurchased: false, purchasedAt: null, updatedAt: nowIso() }); return; }
    case 'book': return bookPurchases();
    case 'settle': return settleNow();
    case 'addInv': return invSheet({ kind: b.dataset.kind || 'daily', status: 'in_stock' });
    case 'editInv': return invSheet(S.inv.find(v => v.id === id));
    case 'delInv': if (confirm('この在庫を削除しますか？')) { if (await del('inv', id)) closeSheet(); } return;
    case 'invStatus': { const v = S.inv.find(x => x.id === id); if (v && v.status !== b.dataset.s) await patch('inv', id, { status: b.dataset.s, updatedAt: nowIso() }); return; }
    case 'invToShop': return invToShop(id);
    case 'editMeal': return mealSheet(id);
    case 'mealToShop': return mealToShop(id);
    case 'addGoal': return goalSheet({ wish: !!b.dataset.wish });
    case 'editGoal': return goalSheet(S.goals.find(g => g.id === id));
    case 'delGoal': if (confirm('削除しますか？')) { if (await del('goals', id)) closeSheet(); } return;
    case 'contrib': { const g = S.goals.find(x => x.id === id); return sheet(`<h2>${esc(g.name)}に入金</h2><form data-form="contrib" class="form"><input type="hidden" name="id" value="${id}"><label class="money">金額（引き出しはマイナス）<input name="amount" inputmode="numeric" required></label><button class="primary">入金する</button></form>`); }
    case 'addRec': return recSheet({});
    case 'editRec': return recSheet(S.rec.find(r => r.id === id));
    case 'delRec': if (confirm('固定費を削除しますか？（登録済みの記録は残ります）')) { if (await del('rec', id)) closeSheet(); } return;
    case 'addCat': return catSheet({});
    case 'editCat': return catSheet(cats().find(c => c.id === id));
    case 'delCat': if (confirm('カテゴリを削除しますか？')) { if (await patch('config', 'main', { categories: cats().filter(c => c.id !== id) })) closeSheet(); } return;
    case 'theme': try { localStorage.setItem('theme', b.dataset.v); } catch { } applyTheme(); return render();
    case 'csv': return exportFile('csv');
    case 'backup': return exportFile('json');
  }
}
let qTimer;
function onInput(e) {
  const k = e.target.dataset.input; if (!k) return;
  if (k === 'shopName') { const h = document.getElementById('priceHint'); if (h) h.innerHTML = priceHint(e.target.value); const p = document.querySelector('#sheet [name=estimatedUnitPrice]'); const st = D.priceStats(S.hist, e.target.value); if (p && st && !p.value) p.value = st.avg; return; }
  if (k === 'q') { clearTimeout(qTimer); const v = e.target.value; qTimer = setTimeout(() => { S.q = v; render(); const i = document.querySelector('[data-input=q]'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 300); return; }
  if (k === 'filter') { S.filter = e.target.value; render(); }
}
function onChange(e) {
  if (e.target.name === 'priority') e.target.closest('.seg').querySelectorAll('label').forEach(l => l.classList.toggle('on', l.contains(e.target)));
  if (e.target.dataset.input === 'filter') onInput(e);
}
let tt;
function toast(msg) { if (typeof window === 'undefined') { (globalThis.__toasts ||= []).push(msg); return; } const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600); }

if (typeof window !== 'undefined') {
  applyTheme();
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('focusout', () => setTimeout(() => { if (deferred) schedule(); }, 0));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  boot();
}
if (typeof module !== 'undefined') module.exports = { S, Store, derive, viewHome, viewHistory, viewShop, viewInv, viewGoals, viewReports, viewSettings, viewWelcome, viewSetup, viewWho, summary, settlement, parseKey, col, handleForm, bookPurchases, applyRecurring, setKey, pull };
