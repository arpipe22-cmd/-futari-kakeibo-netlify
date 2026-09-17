function render() {
  const app = $app(); if (!app) return;
  deferred = false;
  if (!S.key || S.keyInvalid) { app.innerHTML = S.creating ? viewSetup() : viewWelcome(); return; }
  if (!S.ready) {
    app.innerHTML = S.loadError
      ? `<main class="center"><div class="state"><p class="big">📡</p><p>データを読み込めませんでした。電波の良い場所で再試行してください。</p><button class="primary" data-act="retry">再試行</button></div></main>`
      : `<main class="center"><div class="state"><div class="spinner"></div><p>ふたりの家計を読み込み中…</p></div></main>`;
    return;
  }
  if (!S.cfg) { app.innerHTML = viewSetup(); return; }
  if (!me() || !S.members.some(m => m.id === me())) { app.innerHTML = viewWho(); return; }
  if (!members().some(m => m.id === me())) { app.innerHTML = `<main class="center"><div class="state"><p class="big">👥</p><p>この家計はすでに2人で使われています。</p><button class="ghost" data-act="switchMember">メンバーを選び直す</button></div></main>`; return; }
  const views = { home: viewHome, history: viewHistory, reports: viewReports, shop: viewShop, inv: viewInv, goals: viewGoals, settings: viewSettings };
  app.innerHTML = `${S.offline ? '<div class="banner">オフラインです。表示は最後に同期した内容です。</div>' : ''}<main>${(views[S.view] || viewHome)()}</main>${nav()}`;
}

function header(title, { back = false, month = false, gear = false } = {}) {
  return `<header class="top">
    ${back ? `<button class="icon" data-act="go" data-v="home" aria-label="戻る">‹</button>` : ''}
    ${month ? `<div class="month"><button class="icon" data-act="month" data-d="-1" aria-label="前の月">‹</button><h1>${Number(S.ym.slice(5))}月<small>${S.ym.slice(0, 4)}</small></h1><button class="icon" data-act="month" data-d="1" aria-label="次の月">›</button></div>` : `<h1>${esc(title)}</h1>`}
    <span class="sync ${S.pending ? 'on' : ''}" title="同期状態"></span>
    ${gear ? `<button class="icon" data-act="go" data-v="settings" aria-label="設定">⚙︎</button>` : ''}
  </header>`;
}
function nav() {
  const it = (v, ic, l) => `<button class="${S.view === v ? 'on' : ''}" data-act="go" data-v="${v}"><span>${ic}</span>${l}</button>`;
  return `<nav class="bottom">${it('home', '⌂', 'ホーム')}${it('reports', '◔', 'レポート')}<button class="plus" data-act="quick" aria-label="追加">＋</button>${it('inv', '▤', '日用品')}${it('goals', '◎', '目標')}</nav>`;
}

function viewWelcome() {
  return `<main class="onb">
    <p class="big">🏡</p>
    <h1>ふたり家計</h1>
    ${S.keyInvalid ? '<p class="bad">この招待リンクは使えなくなりました。パートナーから新しいリンクをもらってください。</p>' : '<p class="muted">パートナーから届いた招待リンクを開くと、そのまま参加できます。</p>'}
    <form data-form="joinKey" class="form">
      <label>招待リンクを貼り付けて参加<input name="link" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…/#k=…"></label>
      <button class="primary">参加する</button>
    </form>
    <p class="muted small">LINEで開いた場合は、右下のメニューから「ブラウザで開く」を選ぶと、次回からもそのまま使えます。ホーム画面に追加したアプリで初めて開くときは、ここにリンクを貼り付けてください。</p>
    <hr class="sep">
    <button class="ghost wide" data-act="startCreate">新しく家計を作る</button>
    ${S.storageBlocked ? '<p class="bad small">このブラウザでは端末にデータを保存できません（プライベートブラウズなど）。通常モードで開いてください。</p>' : ''}
  </main>`;
}
function viewSetup() {
  return `<main class="onb">
    <p class="big">🏡</p>
    <h1>ふたりの家計をはじめる</h1>
    <p class="muted">表示名と、ひと月に使うお金の目安を決めましょう。あとから設定で変えられます。</p>
    <form data-form="onboard" class="form">
      <label>あなたの表示名<input name="nickname" required maxlength="12" placeholder="例：ゆうと"></label>
      <label>月の予算<input name="budget" inputmode="numeric" required placeholder="250000"></label>
      <label>共同支出のあなたの負担<select name="mine">${[50, 60, 70, 40, 30].map(v => `<option value="${v}">${v}%（相手 ${100 - v}%）</option>`).join('')}</select></label>
      <button class="primary">家計を作成</button>
    </form>
    ${S.key ? '' : '<button class="link" data-act="cancelCreate">招待リンクで参加する場合はこちら</button>'}
  </main>`;
}
function viewWho() {
  const ms = members();
  return `<main class="onb">
    <p class="big">👋</p>
    <h1>${ms.length ? 'あなたはどちら？' : 'ふたりの家計に参加'}</h1>
    ${ms.length ? `<div class="who">${ms.map(m => `<button class="ghost wide" data-act="pickMember" data-id="${m.id}"><span class="dot ${m.id === mA() ? 'pa' : 'pb'}"></span>${esc(m.nickname)} として使う</button>`).join('')}</div>
      <p class="muted small">機種変更したときや、別のブラウザで開いたときは自分の名前を選んでください。</p>` : ''}
    ${ms.length < 2 ? `<form data-form="joinMember" class="form">
      <label>${ms.length ? 'はじめて参加する人の表示名' : 'あなたの表示名'}<input name="nickname" required maxlength="12" placeholder="例：あや"></label>
      <button class="primary">参加する</button></form>` : ''}
  </main>`;
}
