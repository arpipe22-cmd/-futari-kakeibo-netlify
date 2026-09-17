async function invToShop(id) {
  const v = S.inv.find(x => x.id === id); if (!v) return;
  if (S.shop.some(s => s.inventoryItemId === id && !s.isPurchased)) return toast('すでに買うもの予定にあります');
  const st = D.priceStats(S.hist, v.name);
  const sid = uid();
  const ok = await put('shop', sid, {
    name: v.name, categoryId: v.categoryId || 'daily', quantity: 1, unit: v.unit || '個', estimatedUnitPrice: st?.avg ?? v.averagePrice ?? v.lastPrice ?? 0,
    plannedStore: st?.store || v.lastStore || '', plannedDate: '', assigneeId: '', priority: v.status === 'out_of_stock' ? 'required' : 'optional',
    isPurchased: false, actualUnitPrice: null, inventoryItemId: id, transactionId: null, createdBy: me(), createdAt: nowIso(), updatedAt: nowIso(),
  });
  if (ok) toast(`${v.name}を買うもの予定に追加しました`);
}
let booking = false;
async function bookPurchases() {
  if (booking) return; booking = true;
  try {
    const items = D.bookableItems(S.shop); let n = 0;
    for (const i of items) {
      const txId = D.txIdForShopItem(i.id), date = D.tokyoToday(i.purchasedAt ? new Date(i.purchasedAt) : new Date());
      {
        const ok = await create('tx', txId, {
          amount: D.actualAmount(i), type: 'expense', date, categoryId: i.categoryId || 'food', memo: i.name, payerId: i.payerId || me(),
          expenseOwnerId: null, isShared: true, splitA: S.cfg?.defaultSplitA ?? 50, createdBy: me(), shoppingItemId: i.id, recurringId: null, createdAt: nowIso(), updatedAt: nowIso(),
        });
        if (ok === null) break;
      }
      const hist = { name: i.name, quantity: i.quantity, unitPrice: i.actualUnitPrice ?? i.estimatedUnitPrice, total: D.actualAmount(i), store: i.actualStore || '', date, shoppingItemId: i.id };
      await put('hist', 'h-' + i.id, hist);
      if (i.inventoryItemId && !i.restocked) {
        const v = S.inv.find(x => x.id === i.inventoryItemId);
        if (v) {
          const next = D.restock(v, { unitPrice: hist.unitPrice, quantity: i.quantity, store: hist.store, date, history: [...S.hist.filter(h => h.id !== 'h-' + i.id), hist] });
          const { id, ...body } = next; await put('inv', v.id, { ...body, updatedAt: nowIso() });
        }
      }
      await patch('shop', i.id, { transactionId: txId, restocked: true, updatedAt: nowIso() });
      n++;
    }
    toast(n ? `${n}件を家計簿へ反映し、在庫を補充しました` : '反映するものはありません');
  } finally { booking = false; }
}
async function settleNow() {
  const st = settlement(); if (!st?.amount) return;
  if (!confirm(`${nick(st.from)} → ${nick(st.to)} ${yen(st.amount)} を精算済みにしますか？`)) return;
  const ok = await put('settle', uid(), { from: st.from, to: st.to, amount: st.amount, date: today(), createdBy: me(), createdAt: nowIso() });
  if (ok) toast('精算済みにしました');
}
async function mealToShop(d) {
  const m = S.meals.find(x => x.id === d); if (!m) return;
  const have = new Set(S.inv.filter(v => v.status !== 'out_of_stock').map(v => D.normName(v.name)));
  const planned = new Set(openShop().map(s => D.normName(s.name)));
  let n = 0;
  for (const name of m.ingredients) {
    const k = D.normName(name); if (!k || have.has(k) || planned.has(k)) continue;
    const st = D.priceStats(S.hist, name);
    await put('shop', uid(), { name, categoryId: 'food', quantity: 1, unit: '個', estimatedUnitPrice: st?.avg ?? 0, plannedStore: st?.store || '', plannedDate: d, assigneeId: '', priority: 'required', isPurchased: false, actualUnitPrice: null, inventoryItemId: S.inv.find(v => D.normName(v.name) === k)?.id || null, transactionId: null, createdBy: me(), createdAt: nowIso(), updatedAt: nowIso() });
    planned.add(k); n++;
  }
  toast(n ? `${n}品を買うもの予定に追加しました` : '足りない材料はありません');
}
function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
async function exportFile(kind) {
  let data, filename;
  if (kind === 'csv') {
    const rows = [['日付', '種類', '金額', 'カテゴリ', 'メモ', '支払った人', '共同', `${nick(mA())}の負担%`]];
    [...S.tx].sort(byDateDesc).forEach(t => rows.push([t.date, t.type === 'income' ? '収入' : '支出', t.amount, cat(t.categoryId).name, t.memo, nick(t.payerId), t.isShared ? 'はい' : 'いいえ', t.splitA ?? '']));
    data = '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\n'); filename = `futari-kakeibo-${today()}.csv`;
  } else {
    const out = { exportedAt: nowIso(), config: S.cfg }; COLS.filter(c => c !== 'members').forEach(c => out[c] = S[c]);
    data = JSON.stringify(out, null, 2); filename = `futari-backup-${today()}.json`;
  }
  const url = URL.createObjectURL(new Blob([data], { type: kind === 'csv' ? 'text/csv' : 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const fd = (form) => Object.fromEntries(new FormData(form).entries());
