// ============================================================
// ZERTIVA B2 — LESEN TEIL 1 MATCHING MODULE
// مستقل، معزول، يستخدم نفس Prototype كـ Source of Truth
// ============================================================

(function() {
  'use strict';

  // منع التحميل المتكرر
  if (window.__zertivaL1MatchingLoaded) {
    console.warn('Lesen Teil 1 Matching Module already loaded.');
    return;
  }
  window.__zertivaL1MatchingLoaded = true;

  // ============================================================
  // CONFIG
  // ============================================================
  const ROOT_ID = 'zl1m-matching-root';
  const STYLE_ID = 'zl1m-matching-style';

  // ============================================================
  // STATE (خاص بالوحدة)
  // ============================================================
  const state = {
    texts: [],            // [{ id, number, content, select }]
    titles: [],           // [{ id, value, text, letter }]
    matches: new Map(),   // textId -> titleId
    titleToText: new Map(), // titleId -> textId
    selectedText: null,
    selectedTitle: null,
    mounted: false,
    container: null,
    originalSelects: [],  // الـ5 selects الأصلية
    sharedOptions: [],    // العناوين الكاملة
    questionData: [],     // بيانات الأسئلة الأصلية
    onUpdate: null,       // callback لتحديث النظام الأصلي
  };

  // ============================================================
  // HELPERS (نفس الـPrototype)
  // ============================================================
  function clean(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\u00a0/g, ' ')
      .trim();
  }

  // ============================================================
  // BUILD CSS (نفس CSS من الـPrototype مع تغيير الـprefix فقط)
  // ============================================================
  function buildStyles() {
    const css = [];

    // Root
    css.push(
      '#' + ROOT_ID + '{' +
        'width:100%;' +
        'max-width:100%;' +
        'box-sizing:border-box;' +
        'margin:16px 0;' +
        'padding:clamp(9px,1vw,14px);' +
        'background:#ffffff;' +
        'border:1px solid rgba(100,120,140,.16);' +
        'border-radius:16px;' +
        'box-shadow:0 7px 25px rgba(20,35,50,.06);' +
        'color:#17212b;' +
        'font-family:inherit;' +
        'display:flex;' +
        'flex-direction:column;' +
        'height:min(760px,calc(100vh - 70px));' +
        'min-height:520px;' +
        'overflow:hidden;' +
        'position:relative;' +
        'z-index:10;' +
      '}'
    );

    // Header
    css.push(
      '#' + ROOT_ID + ' .zl1m-header{' +
        'flex:0 0 38px;' +
        'min-height:38px;' +
        'display:flex;' +
        'align-items:center;' +
        'justify-content:space-between;' +
        'gap:10px;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-main-title{' +
        'font-size:clamp(16px,1.35vw,21px);' +
        'font-weight:800;' +
        'letter-spacing:-.02em;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-progress{' +
        'display:flex;' +
        'align-items:center;' +
        'gap:7px;' +
        'padding:5px 9px;' +
        'border-radius:999px;' +
        'border:1px solid rgba(90,120,145,.16);' +
        'background:#f5f7fa;' +
        'color:#536170;' +
        'font-size:11px;' +
        'font-weight:750;' +
        'white-space:nowrap;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-progress-bar{' +
        'width:58px;' +
        'height:5px;' +
        'background:#e5ebf1;' +
        'border-radius:99px;' +
        'overflow:hidden;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-progress-fill{' +
        'width:0%;' +
        'height:100%;' +
        'background:#67afea;' +
        'border-radius:inherit;' +
        'transition:width .22s ease;' +
      '}'
    );

    // Text area
    css.push(
      '#' + ROOT_ID + ' .zl1m-text-area{' +
        'flex:1 1 0;' +
        'min-height:0;' +
        'width:100%;' +
        'overflow-x:auto;' +
        'overflow-y:hidden;' +
        'scrollbar-width:thin;' +
        'overscroll-behavior-x:contain;' +
        'overscroll-behavior-y:none;' +
        'touch-action:pan-x;' +
        'display:flex;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-text-grid{' +
        'display:flex;' +
        'flex-wrap:nowrap;' +
        'gap:clamp(7px,.8vw,11px);' +
        'min-width:100%;' +
        'height:100%;' +
        'align-items:stretch;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-text-card{' +
        'flex:0 0 calc(20% - 10px);' +
        'min-width:0;' +
        'min-height:0;' +
        'height:100%;' +
        'display:flex;' +
        'flex-direction:column;' +
        'border-radius:12px;' +
        'border:1px solid rgba(100,120,140,.18);' +
        'background:#ffffff;' +
        'overflow:hidden;' +
        'cursor:pointer;' +
        'transition:border-color .18s ease,box-shadow .18s ease,background .18s ease;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-text-card:hover{' +
        'box-shadow:0 5px 16px rgba(30,50,70,.06);' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-text-card.zl1m-selected,' +
      '#' + ROOT_ID + ' .zl1m-text-card.zl1m-linked{' +
        'border-color:#70b4eb;' +
        'background:#f7fbff;' +
        'box-shadow:0 0 0 2px rgba(112,180,235,.10);' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-text-head{' +
        'flex:0 0 35px;' +
        'min-height:35px;' +
        'display:flex;' +
        'align-items:center;' +
        'justify-content:space-between;' +
        'gap:6px;' +
        'padding:5px 8px;' +
        'box-sizing:border-box;' +
        'background:#f7f9fb;' +
        'border-bottom:1px solid rgba(100,120,140,.14);' +
        'cursor:pointer;' +
        'user-select:none;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-text-label{' +
        'font-size:10px;' +
        'font-weight:850;' +
        'letter-spacing:.03em;' +
        'white-space:nowrap;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-text-badge{' +
        'min-width:21px;' +
        'height:21px;' +
        'padding:0 5px;' +
        'box-sizing:border-box;' +
        'display:flex;' +
        'align-items:center;' +
        'justify-content:center;' +
        'border-radius:6px;' +
        'background:#67afea;' +
        'color:#ffffff;' +
        'font-size:10px;' +
        'font-weight:850;' +
        'opacity:0;' +
        'transform:scale(.92);' +
        'transition:.18s ease;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-linked .zl1m-text-badge{' +
        'opacity:1;' +
        'transform:scale(1);' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-text-body{' +
        'flex:1 1 auto;' +
        'min-height:0;' +
        'overflow-y:auto;' +
        'overflow-x:hidden;' +
        'padding:clamp(9px,.9vw,13px);' +
        'box-sizing:border-box;' +
        'font-size:clamp(11px,.82vw,13.5px);' +
        'line-height:1.62;' +
        'font-weight:500;' +
        'color:#273440;' +
        'word-break:normal;' +
        'overflow-wrap:break-word;' +
        'white-space:normal;' +
        'scrollbar-width:thin;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-text-body::-webkit-scrollbar{' +
        'width:5px;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-text-body::-webkit-scrollbar-thumb{' +
        'background:rgba(90,115,140,.27);' +
        'border-radius:99px;' +
      '}'
    );

    // Answer area
    css.push(
      '#' + ROOT_ID + ' .zl1m-answer-area{' +
        'flex:0 1 auto;' +
        'min-height:0;' +
        'max-height:55%;' +
        'box-sizing:border-box;' +
        'display:flex;' +
        'flex-direction:column;' +
        'border-radius:13px;' +
        'border:1px solid rgba(100,120,140,.16);' +
        'background:#f6f8fa;' +
        'padding:8px;' +
        'overflow:hidden;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-answer-header{' +
        'flex:0 0 30px;' +
        'min-height:30px;' +
        'display:flex;' +
        'align-items:center;' +
        'justify-content:space-between;' +
        'gap:8px;' +
        'padding:0 2px;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-answer-title{' +
        'font-size:11px;' +
        'font-weight:850;' +
        'letter-spacing:.02em;' +
        'white-space:nowrap;' +
      '}'
    );

    // Title area
    css.push(
      '#' + ROOT_ID + ' .zl1m-title-area{' +
        'flex:1 1 auto;' +
        'min-height:0;' +
        'width:100%;' +
        'overflow-x:hidden;' +
        'overflow-y:auto;' +
        'padding:2px 0;' +
        'scrollbar-width:thin;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-title-area::-webkit-scrollbar{' +
        'width:5px;' +
        'height:5px;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-title-area::-webkit-scrollbar-thumb{' +
        'background:rgba(90,115,140,.22);' +
        'border-radius:99px;' +
      '}'
    );

    // Title grid
    css.push(
      '#' + ROOT_ID + ' .zl1m-title-grid{' +
        'width:100%;' +
        'min-width:0;' +
        'display:grid;' +
        'grid-template-columns:repeat(auto-fit,minmax(135px,1fr));' +
        'grid-auto-rows:1fr;' +
        'gap:8px 12px;' +
        'box-sizing:border-box;' +
        'align-content:start;' +
      '}'
    );
    css.push(
      '@media (min-width:1041px){' +
        '#' + ROOT_ID + ' .zl1m-title-grid{' +
          'grid-template-columns:repeat(auto-fit,minmax(170px,1fr));' +
        '}' +
      '}'
    );
    css.push(
      '@media (max-width:1040px) and (min-width:641px){' +
        '#' + ROOT_ID + ' .zl1m-title-grid{' +
          'grid-template-columns:repeat(auto-fit,minmax(160px,1fr));' +
        '}' +
      '}'
    );
    css.push(
      '@media (max-width:640px) and (min-width:561px){' +
        '#' + ROOT_ID + ' .zl1m-title-grid{' +
          'grid-template-columns:repeat(2,1fr);' +
          'width:100%;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-title-area{' +
          'overflow-x:hidden;' +
          'overflow-y:auto;' +
        '}' +
      '}'
    );

    // Title card
    css.push(
      '#' + ROOT_ID + ' .zl1m-title-card{' +
        'width:100%;' +
        'min-width:0;' +
        'min-height:40px;' +
        'box-sizing:border-box;' +
        'padding:8px 12px;' +
        'border-radius:9px;' +
        'border:1px solid rgba(100,120,140,.17);' +
        'background:#ffffff;' +
        'cursor:pointer;' +
        'user-select:none;' +
        'display:grid;' +
        'grid-template-columns:26px minmax(0,1fr);' +
        'align-items:center;' +
        'gap:8px;' +
        'overflow:hidden;' +
        'transition:border-color .18s ease,background .18s ease,box-shadow .18s ease,transform .18s ease;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-title-card:hover{' +
        'transform:translateY(-1px);' +
        'box-shadow:0 3px 10px rgba(30,50,70,.05);' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-title-card.zl1m-selected,' +
      '#' + ROOT_ID + ' .zl1m-title-card.zl1m-linked{' +
        'border-color:#70b4eb;' +
        'background:#f2f9ff;' +
        'box-shadow:0 0 0 2px rgba(112,180,235,.08);' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-title-letter{' +
        'width:26px;' +
        'height:26px;' +
        'display:flex;' +
        'align-items:center;' +
        'justify-content:center;' +
        'border-radius:7px;' +
        'background:#edf2f6;' +
        'color:#526170;' +
        'font-size:11px;' +
        'font-weight:850;' +
        'flex-shrink:0;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-title-card.zl1m-selected .zl1m-title-letter,' +
      '#' + ROOT_ID + ' .zl1m-title-card.zl1m-linked .zl1m-title-letter{' +
        'background:#67afea;' +
        'color:#ffffff;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-title-content{' +
        'min-width:0;' +
        'width:100%;' +
        'display:flex;' +
        'flex-direction:column;' +
        'justify-content:center;' +
        'align-items:flex-start;' +
        'overflow:hidden;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-title-text{' +
        'display:block;' +
        'width:100%;' +
        'max-width:100%;' +
        'box-sizing:border-box;' +
        'font-size:clamp(9px,.8vw,12px);' +
        'line-height:1.3;' +
        'font-weight:650;' +
        'color:#273440;' +
        'white-space:normal;' +
        'overflow-wrap:anywhere;' +
        'word-break:normal;' +
        'overflow:hidden;' +
        'text-overflow:clip;' +
        'text-align:left;' +
      '}'
    );
    css.push(
      '#' + ROOT_ID + ' .zl1m-title-match{' +
        'margin-top:2px;' +
        'min-height:0;' +
        'max-width:100%;' +
        'font-size:8px;' +
        'color:#6c7885;' +
        'font-weight:750;' +
        'line-height:1.1;' +
        'overflow:hidden;' +
        'white-space:nowrap;' +
        'text-overflow:ellipsis;' +
      '}'
    );

    // إخفاء الأزرار والنتيجة
    css.push(
      '#' + ROOT_ID + ' .zl1m-actions,' +
      '#' + ROOT_ID + ' .zl1m-result{' +
        'display:none !important;' +
      '}'
    );

    // Responsive: under 1000px (fixed text width + horizontal scroll)
    css.push(
      '@media (max-width:1000px){' +
        '#' + ROOT_ID + ' .zl1m-text-area{' +
          'overflow-x:auto;' +
          'overflow-y:hidden;' +
          'touch-action:pan-x;' +
          'overscroll-behavior-x:contain;' +
          'overscroll-behavior-y:none;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-text-grid{' +
          'width:max-content;' +
          'min-width:max-content;' +
          'max-width:none;' +
          'flex-wrap:nowrap;' +
          'gap:8px;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-text-card{' +
          'flex:0 0 var(--zl1m-fixed-text-width,200px);' +
          'width:var(--zl1m-fixed-text-width,200px);' +
          'min-width:var(--zl1m-fixed-text-width,200px);' +
          'max-width:var(--zl1m-fixed-text-width,200px);' +
          'height:100%;' +
          'flex-shrink:0;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-text-area::-webkit-scrollbar{' +
          'width:0;' +
          'height:5px;' +
        '}' +
      '}'
    );

    // Mobile root
    css.push(
      '@media (max-width:650px){' +
        '#' + ROOT_ID + '{' +
          'margin:8px 0;' +
          'padding:8px;' +
          'border-radius:13px;' +
          'height:calc(100vh - 20px);' +
          'min-height:480px;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-header{' +
          'flex-basis:32px;' +
          'min-height:32px;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-main-title{' +
          'font-size:14px;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-progress{' +
          'font-size:9px;' +
          'padding:4px 7px;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-progress-bar{' +
          'width:38px;' +
          'height:4px;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-text-body{' +
          'font-size:12px;' +
          'line-height:1.58;' +
          'padding:10px;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-answer-header{' +
          'flex-basis:27px;' +
          'min-height:27px;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-answer-title{' +
          'font-size:10px;' +
        '}' +
      '}'
    );

    // Under 560px — titles 2 columns × 5 rows, fixed size, horizontal scroll only
    css.push(
      '@media (max-width:560px){' +
        '#' + ROOT_ID + ' .zl1m-title-area{' +
          'width:100%;' +
          'overflow-x:auto;' +
          'overflow-y:hidden;' +
          'scrollbar-width:thin;' +
          'overscroll-behavior-x:contain;' +
          'overscroll-behavior-y:none;' +
          'touch-action:pan-x;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-title-grid{' +
          'display:grid;' +
          'grid-template-columns:repeat(2,var(--zl1m-fixed-title-width,270px));' +
          'grid-template-rows:repeat(5,var(--zl1m-fixed-title-height,40px));' +
          'grid-auto-flow:row;' +
          'grid-auto-rows:unset;' +
          'gap:8px 12px;' +
          'width:max-content;' +
          'min-width:max-content;' +
          'max-width:none;' +
          'align-content:start;' +
          'align-items:stretch;' +
          'justify-content:start;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-title-card{' +
          'width:var(--zl1m-fixed-title-width,270px);' +
          'min-width:var(--zl1m-fixed-title-width,270px);' +
          'max-width:var(--zl1m-fixed-title-width,270px);' +
          'height:var(--zl1m-fixed-title-height,40px);' +
          'min-height:var(--zl1m-fixed-title-height,40px);' +
          'max-height:var(--zl1m-fixed-title-height,40px);' +
          'flex-shrink:0;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-title-area::-webkit-scrollbar{' +
          'width:0;' +
          'height:5px;' +
        '}' +
      '}'
    );

    // Above 850px — equal size for title cards
    css.push(
      '@media (min-width:851px){' +
        '#' + ROOT_ID + ' .zl1m-title-grid{' +
          'align-items:stretch;' +
          'align-content:stretch;' +
          'grid-auto-rows:1fr;' +
        '}' +
        '#' + ROOT_ID + ' .zl1m-title-card{' +
          'width:100%;' +
          'height:100%;' +
          'min-height:40px;' +
          'box-sizing:border-box;' +
        '}' +
      '}'
    );

    return css.join('\n');
  }

  // ============================================================
  // BUILD DOM
  // ============================================================
  function buildDOM() {
    const root = document.createElement('section');
    root.id = ROOT_ID;

    // Header
    const header = document.createElement('div');
    header.className = 'zl1m-header';

    const mainTitle = document.createElement('div');
    mainTitle.className = 'zl1m-main-title';
    mainTitle.textContent = 'Lesen Teil 1';

    const progress = document.createElement('div');
    progress.className = 'zl1m-progress';

    const progressText = document.createElement('span');
    const progressBar = document.createElement('span');
    progressBar.className = 'zl1m-progress-bar';
    const progressFill = document.createElement('span');
    progressFill.className = 'zl1m-progress-fill';
    progressBar.appendChild(progressFill);
    progress.append(progressText, progressBar);
    header.append(mainTitle, progress);
    root.appendChild(header);

    // Text area
    const textArea = document.createElement('div');
    textArea.className = 'zl1m-text-area';
    const textGrid = document.createElement('div');
    textGrid.className = 'zl1m-text-grid';
    textArea.appendChild(textGrid);
    root.appendChild(textArea);

    // Answer area
    const answerArea = document.createElement('div');
    answerArea.className = 'zl1m-answer-area';
    const answerHeader = document.createElement('div');
    answerHeader.className = 'zl1m-answer-header';
    const answerTitle = document.createElement('div');
    answerTitle.className = 'zl1m-answer-title';
    answerTitle.textContent = 'TITEL ZUORDNEN';
    answerHeader.appendChild(answerTitle);
    answerArea.appendChild(answerHeader);
    const titleArea = document.createElement('div');
    titleArea.className = 'zl1m-title-area';
    const titleGrid = document.createElement('div');
    titleGrid.className = 'zl1m-title-grid';
    titleArea.appendChild(titleGrid);
    answerArea.appendChild(titleArea);
    root.appendChild(answerArea);

    return {
      root,
      textGrid,
      titleGrid,
      progressText,
      progressFill,
    };
  }

  // ============================================================
  // MATCHING LOGIC (نفس الـPrototype مع ربط بالنظام الأصلي)
  // ============================================================
  function connect(textId, titleId) {
    // إذا كان نفس الربط، نفك
    if (state.matches.get(textId) === titleId) {
      disconnectText(textId);
      return;
    }

    // فك أي ربط سابق لهذا العنوان
    const oldText = state.titleToText.get(titleId);
    if (oldText && oldText !== textId) {
      state.matches.delete(oldText);
    }

    // فك أي ربط سابق لهذه الفقرة
    const oldTitle = state.matches.get(textId);
    if (oldTitle) {
      state.titleToText.delete(oldTitle);
    }

    // إنشاء الربط الجديد
    state.matches.set(textId, titleId);
    state.titleToText.set(titleId, textId);

    // تحديث الـselect الأصلي
    const textObject = state.texts.find(t => t.id === textId);
    const titleObject = state.titles.find(t => t.id === titleId);
    if (textObject && textObject.select && titleObject) {
      try {
        textObject.select.value = titleObject.value;
        textObject.select.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
    }

    // تحديث الـstate الأصلي (matchingSelectedAnswers)
    updateOriginalState();

    // تحديث الواجهة
    updateUI();
  }

  function disconnectText(textId) {
    const titleId = state.matches.get(textId);
    if (!titleId) return;

    state.titleToText.delete(titleId);
    state.matches.delete(textId);

    const textObject = state.texts.find(t => t.id === textId);
    if (textObject && textObject.select) {
      try {
        textObject.select.selectedIndex = 0;
        textObject.select.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
    }

    updateOriginalState();
    updateUI();
  }

  function disconnectTitle(titleId) {
    const textId = state.titleToText.get(titleId);
    if (!textId) return;
    disconnectText(textId);
  }

  function updateOriginalState() {
    // تحديث matchingSelectedAnswers و matchingAvailableOptions
    if (typeof window.matchingSelectedAnswers !== 'undefined') {
      // إعادة بناء matchingSelectedAnswers من state.matches
      const newAnswers = {};
      state.matches.forEach((titleId, textId) => {
        const titleObj = state.titles.find(t => t.id === titleId);
        if (titleObj) {
          // نستخرج رقم السؤال من textId (مثلاً text-1 → 0)
          const match = textId.match(/text-(\d+)/);
          if (match) {
            const idx = parseInt(match[1]) - 1;
            // نبحث عن قيمة الخيار الصحيحة من sharedOptions
            const titleValue = titleObj.value;
            // نحدد ما إذا كان هذا الخيار متاحاً في matchingAvailableOptions
            // ولكننا نعتمد على أن النظام الأصلي سيتولى إدارة matchingAvailableOptions
            // سنقوم بتحديث matchingSelectedAnswers مباشرة
            window.matchingSelectedAnswers[idx] = titleValue;
          }
        }
      });
      // إزالة الإجابات التي لم تعد موجودة
      for (let key in window.matchingSelectedAnswers) {
        const idx = parseInt(key);
        const textId = `text-${idx+1}`;
        if (!state.matches.has(textId)) {
          delete window.matchingSelectedAnswers[idx];
        }
      }
      // تحديث matchingAvailableOptions: نعيد بناء القائمة من sharedOptions الأصلية
      // نأخذ جميع الخيارات ونزيل المستخدمة
      if (typeof window.currentMatchingExamData !== 'undefined' && window.currentMatchingExamData.sharedOptions) {
        const allOptions = window.currentMatchingExamData.sharedOptions.slice();
        const used = Object.values(window.matchingSelectedAnswers).filter(v => v && v !== '');
        window.matchingAvailableOptions = allOptions.filter(opt => !used.includes(opt));
      }
    }
  }

  // ============================================================
  // UI UPDATE (نفس الـPrototype)
  // ============================================================
  function updateUI(domElements) {
    const total = state.texts.length;
    const count = state.matches.size;
    const percentage = total ? (count / total) * 100 : 0;

    if (domElements) {
      domElements.progressText.textContent = count + ' / ' + total + ' zugeordnet';
      domElements.progressFill.style.width = percentage + '%';
    }

    // تحديث البطاقات النصية
    const textCards = domElements.textGrid.querySelectorAll('.zl1m-text-card');
    textCards.forEach(card => {
      const textId = card.dataset.textId;
      const linkedTitle = state.matches.get(textId);
      card.classList.toggle('zl1m-selected', state.selectedText === textId);
      card.classList.toggle('zl1m-linked', Boolean(linkedTitle));
      const badge = card.querySelector('.zl1m-text-badge');
      if (badge) {
        badge.textContent = '';
        if (linkedTitle) {
          const title = state.titles.find(t => t.id === linkedTitle);
          if (title) badge.textContent = title.letter;
        }
      }
    });

    // تحديث بطاقات العناوين
    const titleCards = domElements.titleGrid.querySelectorAll('.zl1m-title-card');
    titleCards.forEach(card => {
      const titleId = card.dataset.titleId;
      const linkedText = state.titleToText.get(titleId);
      card.classList.toggle('zl1m-selected', state.selectedTitle === titleId);
      card.classList.toggle('zl1m-linked', Boolean(linkedText));
      const matchSpan = card.querySelector('.zl1m-title-match');
      if (matchSpan) {
        matchSpan.textContent = '';
        if (linkedText) {
          const textObj = state.texts.find(t => t.id === linkedText);
          if (textObj) matchSpan.textContent = 'TEXT ' + textObj.number;
        }
      }
    });
  }

  // ============================================================
  // MOUNT / DESTROY
  // ============================================================
  function mount(container, data) {
    if (state.mounted) {
      console.warn('Matching Mode already mounted.');
      return;
    }

    // data يجب أن يحتوي على:
    // - selects: مصفوفة الـ5 selects الأصلية
    // - questions: مصفوفة الأسئلة (مع النصوص)
    // - sharedOptions: مصفوفة العناوين
    // - currentAnswers: كائن matchingSelectedAnswers الحالي
    // - availableOptions: مصفوفة matchingAvailableOptions الحالية

    if (!data || !data.selects || data.selects.length !== 5) {
      console.error('Invalid data for Matching Mode. Need 5 selects.');
      return;
    }

    // حفظ المراجع
    state.originalSelects = data.selects;
    state.sharedOptions = data.sharedOptions || [];
    state.questionData = data.questions || [];

    // بناء النصوص من الأسئلة
    state.texts = [];
    data.questions.forEach((q, index) => {
      const select = data.selects[index];
      // استخراج النص من السؤال (نأخذ النص من q.text)
      let content = q.text || 'Text';
      // نحاول استخراج النص من DOM إذا كان select موجوداً
      if (select) {
        // نبحث عن النص في DOM (نفس منطق الـPrototype)
        let parent = select.parentElement;
        for (let level = 0; level < 7 && parent; level++) {
          const children = Array.from(parent.children);
          const idx = children.indexOf(select);
          if (idx > 0) {
            for (let i = idx - 1; i >= 0; i--) {
              const candidate = children[i];
              if (candidate === select || candidate.querySelector('select')) continue;
              const txt = clean(candidate.textContent);
              if (txt.length >= 80) {
                content = txt;
                break;
              }
            }
            if (content !== q.text) break;
          }
          parent = parent.parentElement;
        }
        if (content === q.text) {
          // محاولة الحصول من container
          const containerEl = select.closest('li, article, section, form, fieldset, .question, .task, div');
          if (containerEl) {
            const clone = containerEl.cloneNode(true);
            clone.querySelectorAll('select, option, button, input, textarea').forEach(el => el.remove());
            const txt = clean(clone.textContent);
            if (txt.length >= 50) content = txt;
          }
        }
      }
      state.texts.push({
        id: 'text-' + (index + 1),
        number: index + 1,
        content: content,
        select: select,
      });
    });

    // بناء العناوين من sharedOptions
    state.titles = [];
    data.sharedOptions.forEach((titleText, index) => {
      // نبحث عن القيمة التي ستُستخدم في الـselect (نحتاج إلى معرفة القيمة المناسبة)
      // في النظام الأصلي، الخيارات هي نصوص، والقيمة هي النص نفسه (لأن select يستخدم النص كقيمة)
      // لكن في بعض الحالات القيمة قد تكون مختلفة، لكننا نعتمد على أن قيمة الخيار هي النص نفسه
      state.titles.push({
        id: 'title-' + (index + 1),
        value: titleText,
        text: titleText,
        letter: String.fromCharCode(65 + index),
      });
    });

    // استعادة الإجابات الحالية من matchingSelectedAnswers
    if (data.currentAnswers) {
      for (let idx in data.currentAnswers) {
        const answer = data.currentAnswers[idx];
        if (answer) {
          const textId = 'text-' + (parseInt(idx) + 1);
          const titleObj = state.titles.find(t => t.value === answer);
          if (titleObj) {
            state.matches.set(textId, titleObj.id);
            state.titleToText.set(titleObj.id, textId);
          }
        }
      }
    }

    // بناء DOM
    const dom = buildDOM();
    state.container = dom.root;
    container.appendChild(dom.root);

    // إضافة CSS
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = buildStyles();
    document.head.appendChild(styleEl);

    // تخزين المراجع للـDOM
    dom.textGrid = dom.textGrid;
    dom.titleGrid = dom.titleGrid;
    dom.progressText = dom.progressText;
    dom.progressFill = dom.progressFill;
    state.dom = dom;

    // إنشاء بطاقات النصوص
    state.texts.forEach(textItem => {
      const card = document.createElement('div');
      card.className = 'zl1m-text-card';
      card.dataset.textId = textItem.id;

      const head = document.createElement('div');
      head.className = 'zl1m-text-head';
      const label = document.createElement('span');
      label.className = 'zl1m-text-label';
      label.textContent = 'TEXT ' + textItem.number;
      const badge = document.createElement('span');
      badge.className = 'zl1m-text-badge';
      head.append(label, badge);

      const body = document.createElement('div');
      body.className = 'zl1m-text-body';
      body.textContent = textItem.content;

      card.append(head, body);
      dom.textGrid.appendChild(card);

      // حدث النقر على الفقرة
      card.addEventListener('click', function() {
        if (state.matches.has(textItem.id)) {
          disconnectText(textItem.id);
          state.selectedText = null;
          state.selectedTitle = null;
          updateUI(dom);
          return;
        }
        if (state.selectedTitle) {
          connect(textItem.id, state.selectedTitle);
          state.selectedText = null;
          state.selectedTitle = null;
          updateUI(dom);
          return;
        }
        state.selectedText = (state.selectedText === textItem.id) ? null : textItem.id;
        state.selectedTitle = null;
        updateUI(dom);
      });

      // دعم السحب والإفلات
      card.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('zl1m-selected');
      });
      card.addEventListener('dragleave', function() {
        if (!state.matches.has(textItem.id)) {
          card.classList.remove('zl1m-selected');
        }
      });
      card.addEventListener('drop', function(e) {
        e.preventDefault();
        const titleId = e.dataTransfer.getData('text/plain');
        card.classList.remove('zl1m-selected');
        if (!titleId) return;
        connect(textItem.id, titleId);
        state.selectedText = null;
        state.selectedTitle = null;
        updateUI(dom);
      });
    });

    // إنشاء بطاقات العناوين
    state.titles.forEach(titleItem => {
      const card = document.createElement('div');
      card.className = 'zl1m-title-card';
      card.dataset.titleId = titleItem.id;
      card.draggable = true;

      const letter = document.createElement('span');
      letter.className = 'zl1m-title-letter';
      letter.textContent = titleItem.letter;

      const content = document.createElement('div');
      content.className = 'zl1m-title-content';
      const titleTextEl = document.createElement('span');
      titleTextEl.className = 'zl1m-title-text';
      titleTextEl.textContent = titleItem.text;
      const matchSpan = document.createElement('div');
      matchSpan.className = 'zl1m-title-match';
      content.append(titleTextEl, matchSpan);

      card.append(letter, content);
      dom.titleGrid.appendChild(card);

      // حدث النقر على العنوان
      card.addEventListener('click', function() {
        if (state.titleToText.has(titleItem.id)) {
          disconnectTitle(titleItem.id);
          state.selectedTitle = null;
          state.selectedText = null;
          updateUI(dom);
          return;
        }
        if (state.selectedText) {
          connect(state.selectedText, titleItem.id);
          state.selectedText = null;
          state.selectedTitle = null;
          updateUI(dom);
          return;
        }
        state.selectedTitle = (state.selectedTitle === titleItem.id) ? null : titleItem.id;
        state.selectedText = null;
        updateUI(dom);
      });

      // Drag start
      card.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', titleItem.id);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('zl1m-selected');
      });
      card.addEventListener('dragend', function() {
        card.classList.remove('zl1m-selected');
      });
    });

    // تحديث الواجهة الأولية
    updateUI(dom);

    // حفظ الحالة
    state.mounted = true;
    console.log('✅ Lesen Teil 1 Matching Mode mounted.');
  }

  function destroy() {
    if (!state.mounted) {
      console.warn('Matching Mode not mounted.');
      return;
    }

    // إزالة الـDOM
    if (state.container && state.container.parentNode) {
      state.container.parentNode.removeChild(state.container);
    }

    // إزالة الـCSS
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }

    // تنظيف الحالة
    state.texts = [];
    state.titles = [];
    state.matches.clear();
    state.titleToText.clear();
    state.selectedText = null;
    state.selectedTitle = null;
    state.originalSelects = [];
    state.sharedOptions = [];
    state.questionData = [];
    state.dom = null;
    state.container = null;
    state.mounted = false;

    console.log('✅ Lesen Teil 1 Matching Mode destroyed.');
  }

  // ============================================================
  // EXPOSE
  // ============================================================
  window.Lesen1Matching = {
    mount: mount,
    destroy: destroy,
    isMounted: function() { return state.mounted; },
  };

  console.log('✅ Lesen Teil 1 Matching Module loaded (Source of Truth preserved).');

})();
