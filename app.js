/* ================================================================
   داشبورد جامع SmartPLS — app.js
   نسخهٔ نهایی: دوزبانه + فاز ۲ + ۲۰ تفسیر فرضیه + اصلاح خطاها
   ================================================================ */

const state={
  lang:'fa',theme:'dark',
  selected:new Set(DATA.indicators.map((_,i)=>i)),
  highlighted:null, loaded:null,
  sortCol:null,sortAsc:true,searchTerm:'',
  hypFilter:'all', hypSearch:'',
  vifFilter:'all', vifSearch:'',
  reliabilityFilter:'all', descFilter:'all'
};

const FONT_FA='Vazirmatn, Tahoma, sans-serif';
const $=(id)=>document.getElementById(id);
const t=(key)=>(I18N[state.lang][key]||key);
const isMobile = () => window.innerWidth < 900;

/* ================================================================
   BILINGUAL INTERPRETATION HELPERS
   ================================================================ */
const INTERP_I18N = {
  show_btn:      { fa: 'مشاهده تفسیر',                     en: 'View interpretation' },
  hide_btn:      { fa: 'بستن تفسیر',                        en: 'Close interpretation' },
  title_chart:   { fa: 'تفسیر نمودار',                      en: 'Chart Interpretation' },
  title_table:   { fa: 'تفسیر جدول',                        en: 'Table Interpretation' },
  test_label:    { fa: 'نوع آزمون',                         en: 'Test type' },
  hyp_show_btn:  { fa: 'مشاهده تفسیر و تحلیل چرایی',         en: 'View interpretation & reasoning' },
  hyp_hide_btn:  { fa: 'بستن تفسیر',                        en: 'Close interpretation' },
  hyp_header:    { fa: 'راهنمای خواندن و تحلیل کلی جدول فرضیه‌ها', en: 'Guide to reading and analyzing the hypothesis table' },
  hyp_hint:      { fa: '💡 راهنمای استفاده: برای دیدن توضیح تحلیل چرایی (چرا قوی، چرا متوسط، چرا ضعیف، چرا رد) برای هر فرضیه، موس را روی ردیف مورد نظر نگه دارید.', en: '💡 Usage hint: Hover over any row to see a detailed explanation of the result (why strong, why medium, why weak, why rejected).' },
  hyp_tooltip:   { fa: 'تحلیل فرضیه',                       en: 'Hypothesis analysis' },
  badge_methods: { fa: '🧪 آزمون/روش:',                      en: '🧪 Test/Method:' }
};
function ti(key) {
  const e = INTERP_I18N[key];
  return e ? (e[state.lang] || e.fa || key) : key;
}
function getChartInt(id) {
  if (state.lang === 'en' && typeof MAIN_CHART_INTS_EN !== 'undefined' && MAIN_CHART_INTS_EN[id]) return MAIN_CHART_INTS_EN[id];
  return MAIN_CHART_INTS[id] || '';
}
function getTableInt(id) {
  if (state.lang === 'en' && typeof MAIN_TABLE_INTS_EN !== 'undefined' && MAIN_TABLE_INTS_EN[id]) return MAIN_TABLE_INTS_EN[id];
  return MAIN_TABLE_INTS[id] || null;
}
function getHypInt(id) {
  if (state.lang === 'en' && typeof HYP_DETAILS_EN !== 'undefined' && HYP_DETAILS_EN[id]) return HYP_DETAILS_EN[id];
  return HYP_DETAILS[id] || '';
}
function getTestName(id) {
  if (state.lang === 'en' && typeof CHART_TEST_NAMES_EN !== 'undefined' && CHART_TEST_NAMES_EN[id]) return CHART_TEST_NAMES_EN[id];
  return CHART_TEST_NAMES[id] || '';
}

/* ================================================================
   FILE HELPERS
   ================================================================ */
function isFileProtocol(){ return location.protocol === 'file:'; }
function fileAccessHint(){
  if(isFileProtocol()){ return 'داشبورد از محیط file:// باز شده است. مرورگرها به دلایل امنیتی اجازهٔ خواندن فایل‌های محلی از این محیط را نمی‌دهند.\n\nراه‌حل: داشبورد را از طریق یک وب‌سرور محلی باز کنید.\n\nمثال (Python):\n  cd مسیر پوشه\n  python -m http.server 8000\n\nسپس در مرورگر باز کنید: http://localhost:8000'; }
  return null;
}
async function fetchWithFallback(filename, asArrayBuffer){
  const variants = [filename, encodeURI(filename)];
  try{ variants.push(encodeURIComponent(filename)); }catch(e){}
  try{ variants.push(filename.normalize('NFC')); }catch(e){}
  try{ variants.push(encodeURI(filename.normalize('NFC'))); }catch(e){}
  let lastError = null;
  for(const v of variants){
    try{ const resp = await fetch(v, {cache:'no-store'}); if(resp.ok){ return asArrayBuffer ? await resp.arrayBuffer() : await resp.blob(); } lastError = new Error('HTTP '+resp.status); }
    catch(e){ lastError = e; }
  }
  throw lastError || new Error('Fetch failed');
}
function showFileError(area, filename, err){
  const hint = fileAccessHint();
  const msg = hint ? `<div style="padding:20px;background:rgba(243,156,18,.10);border:1px solid rgba(243,156,18,.4);border-radius:10px;text-align:right;color:var(--text);line-height:2"><div style="font-size:16px;font-weight:800;color:var(--orange);margin-bottom:10px">⚠ خطای دسترسی به فایل</div><div style="font-size:13px;margin-bottom:14px"><b>فایل:</b> <code>${filename}</code></div><div style="font-size:13px;white-space:pre-wrap;font-family:inherit">${hint}</div></div>` : `<div style="padding:20px;background:rgba(231,76,60,.10);border:1px solid rgba(231,76,60,.4);border-radius:10px;text-align:center;color:var(--red)"><div style="font-size:15px;font-weight:800;margin-bottom:8px">خطا در بارگذاری</div><div style="font-size:13px"><b>فایل:</b> ${filename}</div><div style="font-size:12px;color:var(--text-muted);margin-top:8px">${err.message||err}</div></div>`;
  if(area) area.innerHTML = msg;
}

/* ================================================================
   THEME HELPERS
   ================================================================ */
function themeColors(){
  const dark=state.theme==='dark';
  return{ paper:dark?'#1e2433':'#fff',plot:dark?'#1e2433':'#fff', text:dark?'#e8ecf1':'#2c3e50',grid:dark?'#2d3446':'#e8ecf1', zero:dark?'#555':'#ccc',bg:dark?'#12161f':'#f0f2f5' };
}
function plotlyLayout(extra={}){
  const c=themeColors();
  return Object.assign({
    paper_bgcolor:c.paper,plot_bgcolor:c.plot, font:{family:FONT_FA,size:12,color:c.text},
    hoverlabel:{bgcolor:state.theme==='dark'?'#0a0e18':'#fff',bordercolor:'#3498db',font:{family:FONT_FA,size:14,color:state.theme==='dark'?'#fff':'#000'}},
    margin:{l:60,r:30,b:50,t:50}
  },extra);
}
const PLOTLY_CFG={ responsive:true, displaylogo:false, modeBarButtonsToRemove:['lasso2d','select2d'], toImageButtonOptions:{format:'png',scale:3,filename:'smartpls_chart'} };
const HT={template:(s)=>s+'<extra></extra>'};
function plasmaRGB(v,vmin,vmax){
  const tt=Math.max(0,Math.min(1,(v-vmin)/(vmax-vmin+1e-9)));
  const stops=[[0.05,0.03,0.53],[0.35,0,0.66],[0.62,0.13,0.62],[0.84,0.31,0.45],[0.96,0.53,0.30],[0.99,0.75,0.16],[0.94,0.98,0.13]];
  const idx=tt*(stops.length-1),i=Math.floor(idx),f=idx-i;
  const a=stops[i],b=stops[Math.min(i+1,stops.length-1)];
  return `rgb(${Math.round((a[0]+(b[0]-a[0])*f)*255)},${Math.round((a[1]+(b[1]-a[1])*f)*255)},${Math.round((a[2]+(b[2]-a[2])*f)*255)})`;
}

/* ================================================================
   DESCRIPTIVE STATISTICS
   ================================================================ */
function renderDescriptiveStatistics(){
  const D = (state.loaded && state.loaded.descriptive) || FALLBACK_DESCRIPTIVE;
  const LIGHT_TEXT = themeColors().text, GRID = themeColors().grid, CARD = themeColors().plot;
  const commonLayout = { paper_bgcolor: CARD, plot_bgcolor: CARD, font:{family:FONT_FA, size:11, color:LIGHT_TEXT}, margin:{l:50, r:20, t:20, b:80}, showlegend:false, hoverlabel:{bgcolor:'#fff', bordercolor:'#3498db', font:{family:FONT_FA, size:12, color:'#000'}} };
  const kpiEl = document.getElementById('desc-kpi-grid');
  if(kpiEl){
    const total = D.gender.stats.N;
    const allSD = [D.gender.stats.SD, D.age.stats.SD, D.education.stats.SD, D.distance.stats.SD, D.cost.stats.SD];
    const meanSD = (allSD.reduce((a,b)=>a+b,0)/allSD.length).toFixed(3);
    const maxSD = Math.max(...allSD).toFixed(3);
    kpiEl.innerHTML = `<div class="kpi-card green"><div class="kpi-label">${t('desc_kpi_total')}</div><div class="kpi-value">${total}</div></div><div class="kpi-card purple"><div class="kpi-label">${t('desc_kpi_missing')}</div><div class="kpi-value">0</div></div><div class="kpi-card orange"><div class="kpi-label">${t('desc_kpi_mean_sd')}</div><div class="kpi-value">${meanSD}</div></div><div class="kpi-card red"><div class="kpi-label">${t('desc_kpi_max_sd')}</div><div class="kpi-value">${maxSD}</div></div>`;
  }
  const g = D.gender;
  Plotly.newPlot('chart-desc-gender', [{type:'pie', labels:g.labels, values:g.values, hole:0.55, marker:{colors:g.colors, line:{color:'#fff', width:3}}, textinfo:'label+percent', textfont:{family:FONT_FA, size:15, color:'#fff'}, hovertemplate:'<b>%{label}</b><br>فراوانی: %{value}<br>درصد: %{percent}<extra></extra>'}], Object.assign({}, commonLayout, {height:360}), PLOTLY_CFG);
  const a = D.age;
  Plotly.newPlot('chart-desc-age', [{type:'bar', x:a.labels, y:a.values, marker:{color:a.colors, line:{color:'#fff', width:1.5}}, text:a.values.map((v,i)=>`${v}<br>(${a.percent[i]}%)`), textposition:'outside', textfont:{family:FONT_FA, size:10, color:LIGHT_TEXT}, hovertemplate:'<b>%{x}</b><br>فراوانی: %{y}<extra></extra>'}], Object.assign({}, commonLayout, {height:360, xaxis:{gridcolor:GRID, tickfont:{family:FONT_FA, size:10}}, yaxis:{gridcolor:GRID, tickfont:{family:FONT_FA, size:10}}}), PLOTLY_CFG);
  const e = D.education;
  Plotly.newPlot('chart-desc-edu', [{type:'bar', orientation:'h', y:e.labels, x:e.values, marker:{color:e.colors, line:{color:'#fff', width:1.5}}, text:e.values.map((v,i)=>`${v} (${e.percent[i]}%)`), textposition:'outside', textfont:{family:FONT_FA, size:11, color:LIGHT_TEXT}, hovertemplate:'<b>%{y}</b><br>فراوانی: %{x}<extra></extra>'}], Object.assign({}, commonLayout, {height:360, xaxis:{gridcolor:GRID, tickfont:{family:FONT_FA, size:10}}, yaxis:{gridcolor:GRID, tickfont:{family:FONT_FA, size:11}}}), PLOTLY_CFG);
  const d = D.distance;
  Plotly.newPlot('chart-desc-distance', [{type:'bar', x:d.labels, y:d.values, marker:{color:d.colors, line:{color:'#fff', width:1.5}}, text:d.values.map((v,i)=>`${v}<br>(${d.percent[i]}%)`), textposition:'outside', textfont:{family:FONT_FA, size:10, color:LIGHT_TEXT}, hovertemplate:'<b>%{x} کیلومتر</b><br>فراوانی: %{y}<extra></extra>'}], Object.assign({}, commonLayout, {height:360, xaxis:{gridcolor:GRID, tickfont:{family:FONT_FA, size:10}}, yaxis:{gridcolor:GRID, tickfont:{family:FONT_FA, size:10}}}), PLOTLY_CFG);
  const c = D.cost;
  Plotly.newPlot('chart-desc-cost', [{type:'bar', x:c.labels, y:c.values, marker:{color:c.colors, line:{color:'#fff', width:1.5}}, text:c.values.map((v,i)=>`${v}<br>(${c.percent[i]}%)`), textposition:'outside', textfont:{family:FONT_FA, size:10, color:LIGHT_TEXT}, hovertemplate:'<b>%{x} هزار تومان</b><br>فراوانی: %{y}<extra></extra>'}], Object.assign({}, commonLayout, {height:360, xaxis:{gridcolor:GRID, tickfont:{family:FONT_FA, size:10}}, yaxis:{gridcolor:GRID, tickfont:{family:FONT_FA, size:10}}}), PLOTLY_CFG);
  const sdNames = ['جنسیت', 'سن', 'تحصیلات', 'فاصله مکانی', 'هزینه'];
  const sdValues = [D.gender.stats.SD, D.age.stats.SD, D.education.stats.SD, D.distance.stats.SD, D.cost.stats.SD];
  const sdColors = ['#e91e63', '#9b59b6', '#27ae60', '#f39c12', '#e74c3c'];
  Plotly.newPlot('chart-desc-sd', [{type:'barpolar', r:sdValues, theta:sdNames, marker:{color:sdColors, line:{color:'#fff', width:1.5}}, text:sdValues.map(v=>v.toFixed(3)), hovertemplate:'<b>%{theta}</b><br>انحراف معیار = %{r:.3f}<extra></extra>'}], Object.assign({}, commonLayout, {height:360, polar:{bgcolor:CARD, radialaxis:{gridcolor:GRID, tickfont:{size:10, color:LIGHT_TEXT}, range:[0, Math.max(...sdValues)*1.2]}, angularaxis:{gridcolor:GRID, tickfont:{family:FONT_FA, size:11, color:LIGHT_TEXT}}}}), PLOTLY_CFG);
  const tableEl = document.getElementById('desc-stats-table-container');
  if(tableEl){
    const rows = [{name:t('desc_chart_gender'), ...D.gender.stats},{name:t('desc_chart_age'), ...D.age.stats},{name:t('desc_chart_edu'), ...D.education.stats},{name:t('desc_chart_distance'), ...D.distance.stats},{name:t('desc_chart_cost'), ...D.cost.stats}];
    let html = `<div class="desc-table-wrap"><table class="desc-table"><thead><tr><th>${t('desc_col_variable')}</th><th>${t('desc_col_n')}</th><th>${t('desc_col_missing')}</th><th>${t('desc_col_mean')}</th><th>${t('desc_col_sd')}</th><th>${t('desc_col_skew')}</th><th>${t('desc_col_kurt')}</th><th>${t('desc_col_range')}</th></tr></thead><tbody>`;
    rows.forEach(r=>{ html += `<tr><td class="desc-var-cell">${r.name}</td><td>${r.N}</td><td>${r.Missing}</td><td>${r.Mean.toFixed(2)}</td><td>${r.SD.toFixed(3)}</td><td>${r.Skew === null ? '—' : r.Skew.toFixed(3)}</td><td>${r.Kurt === null ? '—' : r.Kurt.toFixed(3)}</td><td>${r.Range}</td></tr>`; });
    html += '</tbody></table></div>';
    tableEl.innerHTML = html;
  }
}

/* ================================================================
   HYPOTHESES
   ================================================================ */
function typeLabel(type){
  const map={direct:'hyp_type_direct', mediation:'hyp_type_mediation', chained:'hyp_type_chained', moderator:'hyp_type_moderator', nonlinear:'hyp_type_nonlinear', interaction:'hyp_type_interaction'};
  return t(map[type]||'hyp_type_direct');
}
function effectLabel(f2){
  if(f2==null) return '—';
  if(f2>=0.35) return t('hyp_effect_strong');
  if(f2>=0.15) return t('hyp_effect_medium');
  if(f2>=0.02) return t('hyp_effect_small');
  return t('hyp_effect_weak');
}
function betaHeatColor(beta){
  const v=Math.min(1,Math.abs(beta)/0.55);
  const hue=210-180*v, sat=55+30*v;
  const lit=state.theme==='dark'?(28+18*(1-v)):(90-22*v);
  return `hsl(${hue}, ${sat}%, ${lit}%)`;
}

/* ─── HYP_DETAILS (FA) — 20 hypotheses ─── */
const HYP_DETAILS = {
  'H1a': `
    <strong>مسیر:</strong> PR → DT (پیش‌نیازها به تحول دیجیتال)<br>
    <strong>β = 0.262 | p < 0.001 | f² = 0.068 (اثر ضعیف)</strong><br><br>
    <em>چرا تأیید شد اما اثر آن ضعیف است؟</em><br>
    پیش‌نیازها بستر اولیه برای پذیرش فناوری هستند — اما داشتن منابع و مهارت به‌تنهایی باعث دیجیتال‌سازی نمی‌شود. طبق نظریهٔ پذیرش فناوری (TAM)، «ادراک سودمندی» و «سهولت استفاده» متغیرهای واسطی هستند که فراتر از منابع صرف، بر پذیرش اثر می‌گذارند. اثر ضعیف (f² = 0.068) نشان می‌دهد پیش‌نیازها لازم‌اند اما کافی نیستند.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> پیش‌نیازها «در ورودی» ضروری‌اند اما به‌تنهایی دیجیتال‌سازی را فعال نمی‌کنند. سیاست‌گذار باید علاوه بر تأمین منابع، انگیزه و آموزش استفاده از فناوری را نیز تقویت کند.</div>
  `,
  'H1b': `
    <strong>مسیر:</strong> PR → SUS (پیش‌نیازها به پایداری)<br>
    <strong>β = 0.230 | p < 0.001 | f² = 0.066 (اثر ضعیف تا متوسط)</strong><br><br>
    <em>چرا تأیید شد و اثر آن متوسط است؟</em><br>
    برخی پیش‌نیازها (سرمایهٔ مالی، شبکهٔ حمایتی، خودکارآمدی) مستقیماً پایداری کسب‌وکار را تقویت می‌کنند — مستقل از دیجیتال. زنی که پس‌انداز مالی دارد یا به شبکهٔ حمایتی متصل است، در برابر شوک‌های اقتصادی مقاوم‌تر است، حتی اگر از فناوری دیجیتال استفاده نکند. اثر متوسط است چون بخش دیگری از تأثیر پیش‌نیازها از مسیر غیرمستقیم (از طریق DT) اعمال می‌شود.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> پیش‌نیازها هم «بالشتک امنیتی» فراهم می‌کنند و هم «سوخت دیجیتال» — یعنی مسیر مستقیم و غیرمستقیم هر دو فعال‌اند. این یعنی تقویت پیش‌نیازها، حتی بدون دیجیتال، ارزش عملی دارد.</div>
  `,
  'H1c': `
    <strong>مسیر:</strong> DT → SUS (تحول دیجیتال به پایداری)<br>
    <strong>β = 0.374 | p < 0.001 | اثر قوی</strong><br><br>
    <em>چرا تأیید و قوی است؟</em><br>
    تحول دیجیتال مستقیماً بر پایداری کارآفرینی تأثیر می‌گذارد. این اثر قوی است چون دیجیتال‌سازی، دسترسی به بازار و کارایی عملیات را به‌طور مستقیم افزایش می‌دهد.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> این فرضیه نشان می‌دهد که دیجیتال‌سازی یک محرک مستقیم و قدرتمند برای پایداری است و بدون آن، سایر مسیرها به نتیجه مطلوب نمی‌رسند.</div>
  `,
  'H2a': `
    <strong>مسیر:</strong> HG → PR (جغرافیا به پیش‌نیازها)<br>
    <strong>β = 0.542 | p < 0.001 | اثر قوی</strong><br><br>
    <em>چرا تأیید و قوی‌ترین فرضیه است؟</em><br>
    جغرافیای انسانی (دسترسی، شبکه اجتماعی، سرمایه فرهنگی) مستقیم‌ترین تأثیر را بر ایجاد پیش‌نیازهای کارآفرینی دارد. زنان روستایی نزدیک به شهر، منابع و فرصت‌های بیشتری برای کسب مهارت و سرمایه در اختیار دارند.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> این بالاترین ضریب مدل است و نشان می‌دهد که جغرافیا «زیربنای» کارآفرینی است. یعنی بدون دسترسی جغرافیایی، حتی با وجود فناوری، پیش‌نیازها شکل نمی‌گیرند.</div>
  `,
  'H2b': `
    <strong>مسیر:</strong> HG → DT (جغرافیا به تحول دیجیتال)<br>
    <strong>β = 0.274 | p < 0.001 | f² = 0.072 (اثر ضعیف)</strong><br><br>
    <em>چرا تأیید شد اما اثر آن ضعیف است؟</em><br>
    دسترسی به زیرساخت دیجیتال (اینترنت پرسرعت، مراکز آموزش، پلتفرم‌های آنلاین) به‌شدت به فاصلهٔ مکانی وابسته است. زنان نزدیک شهر به‌طور سیستماتیک بیشتر در معرض فناوری قرار می‌گیرند. با این حال، اثر ضعیف است چون «داشتن دسترسی» به‌تنهایی کافی نیست — انگیزه، سواد دیجیتال و اعتماد به فناوری هم نقش دارند.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> این مسیر نشان می‌دهد «شکاف دیجیتال» ریشهٔ جغرافیایی دارد، نه صرفاً نگرش فردی. سیاست‌گذاری فناوری بدون توجه به جغرافیا، نیمی از جمعیت هدف را جا می‌گذارد — همان یافته‌ای که در تحلیل Causal Forest و CATE ۰.۳۳ تا ۰.۵۳ تأیید شد.</div>
  `,
  'H2c': `
    <strong>مسیر:</strong> HG → SUS (جغرافیا به پایداری)<br>
    <strong>β = 0.210 | p < 0.001 | f² = 0.055 (اثر ضعیف)</strong><br><br>
    <em>چرا تأیید شد اما اثر آن ضعیف است؟</em><br>
    دسترسی جغرافیایی مستقیماً بر بقای کسب‌وکار اثر می‌گذارد: نزدیکی به بازار، شبکهٔ اجتماعی قوی‌تر، سرمایهٔ فرهنگی بیشتر و پشتیبانی نهادی مؤثرتر. اما بخش عمدهٔ اثر جغرافیا بر پایداری، غیرمستقیم (از طریق PR و DT) اعمال می‌شود — به همین دلیل اثر مستقیم، ضعیف اما معنادار است.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> جغرافیا علاوه بر اثر غیرمستقیم بزرگش (از طریق پیش‌نیازها و دیجیتال)، یک مسیر «مستقیم» هم به پایداری دارد. این یعنی اگر فقط PR و DT را تقویت کنیم و جغرافیا را نادیده بگیریم، بخشی از پایداری از دست می‌رود.</div>
  `,
  'H3a': `
    <strong>مسیر:</strong> PR → DT → SUS (میانجی‌گری جزئی)<br>
    <strong>β = 0.098 | p = 0.001 | VAF = 29.81٪</strong><br><br>
    <em>چرا تأیید شد؟</em><br>
    حدود ۳۰٪ از اثر پیش‌نیازها بر پایداری، از طریق تحول دیجیتال منتقل می‌شود (میانجی‌گری جزئی). بقیهٔ ۷۰٪ مسیر مستقیم است. این یعنی دیجیتال یک «کانال» مهم برای انتقال اثر پیش‌نیازها به پایداری است، اما تنها کانال نیست — و این با β مستقیم H1b (۰.۲۳۰) کاملاً سازگار است.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> سرمایه‌گذاری در پیش‌نیازها هم از مسیر مستقیم و هم از مسیر دیجیتال بازدهی دارد. سیاست‌گذار با تقویت پیش‌نیازها، هم‌زمان دو مسیر پایداری را فعال می‌کند — بازدهی «دوطرفه».</div>
  `,
  'H3b': `
    <strong>مسیر:</strong> HG → PR → DT (میانجی‌گری جزئی)<br>
    <strong>β = 0.142 | p < 0.001 | VAF = 34.13٪</strong><br><br>
    <em>چرا تأیید شد و VAF نسبتاً بالا است؟</em><br>
    بیش از یک‌سوم (۳۴٪) از اثر جغرافیا بر تحول دیجیتال، از طریق پیش‌نیازهای کارآفرینی منتقل می‌شود. مکانیسم روشن است: جغرافیا اول پیش‌نیازها را می‌سازد (دسترسی به منابع، شبکه، سرمایهٔ فرهنگی)، سپس این پیش‌نیازها دیجیتال‌سازی را فعال می‌کنند. VAF بالای ۳۴٪ نشان می‌دهد این «زنجیره» یک مسیر مهم و غالب است.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> زنجیرهٔ «جغرافیا → پیش‌نیاز → دیجیتال» مسیر اصلی سیاست‌گذاری برای توسعهٔ فناوری در مناطق روستایی است. اگر پیش‌نیازها تقویت نشوند، جغرافیا به‌تنهایی نمی‌تواند دیجیتال‌سازی را فعال کند.</div>
  `,
  'H3c': `
    <strong>مسیر:</strong> HG → DT → SUS (میانجی‌گری جزئی)<br>
    <strong>β = 0.102 | p < 0.001 | VAF = 20.92٪</strong><br><br>
    <em>چرا تأیید شد اما VAF پایین است؟</em><br>
    حدود ۲۱٪ از اثر جغرافیا بر پایداری، از طریق دیجیتال منتقل می‌شود. این یعنی دیجیتال یک میانجی «کوچک‌تر» است — بخش عمدهٔ اثر جغرافیا بر پایداری از مسیر مستقیم (β=۰.۲۱۰ در H2c) و از مسیر پیش‌نیازها (H3d با VAF=۲۵٪) اعمال می‌شود. با این حال، معناداری مسیر تأیید می‌کند که «سرمایه‌گذاری در زیرساخت دیجیتال مناطق دورافتاده» منطق علمی دارد.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> توسعهٔ زیرساخت دیجیتال در مناطق دورافتاده، بازدهی مثبت اما محدود دارد. اگر فقط این مسیر را تقویت کنیم و مسیرهای دیگر (پیش‌نیازها و جغرافیای مستقیم) را نادیده بگیریم، اثر کل ناقص می‌ماند.</div>
  `,
  'H3d': `
    <strong>مسیر:</strong> HG → PR → SUS (میانجی‌گری جزئی)<br>
    <strong>β = 0.125 | p < 0.001 | VAF = 25.53٪</strong><br><br>
    <em>چرا تأیید شد؟</em><br>
    حدود ۲۶٪ از اثر جغرافیا بر پایداری، از طریق پیش‌نیازها منتقل می‌شود. مکانیسم روشن است: زن روستایی که در منطقه‌ای با دسترسی بهتر زندگی می‌کند، پیش‌نیازهای قوی‌تری (سرمایه، مهارت، شبکه) به دست می‌آورد؛ این پیش‌نیازها مستقیماً پایداری کسب‌وکار را تقویت می‌کنند. VAF بالای ۲۵٪ نشان می‌دهد این «پل میانجی» یک مسیر عملی مهم است.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> تقویت پیش‌نیازها در مناطق دورافتاده، «جبران‌کنندهٔ» ضعف جغرافیایی است. این یعنی حتی اگر نتوان فاصله را کاهش داد، می‌توان با تقویت منابع و شبکه، اثر منفی جغرافیا را کاهش داد.</div>
  `,
  'H3e': `
    <strong>مسیر:</strong> HG → PR → DT → SUS (زنجیره‌ای)<br>
    <strong>β = 0.053 | p = 0.002 | اثر ضعیف</strong><br><br>
    <em>چرا تأیید شد اما اثر آن ضعیف است؟</em><br>
    اثر غیرمستقیم زنجیره‌ای همیشه ضعیف‌تر از اثرات مستقیم است، زیرا اثر جغرافیا در هر مرحله (PR و DT) تضعیف می‌شود. با این حال، معناداری آن (p=0.002) نشان می‌دهد که مسیر همچنان معتبر است.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> این فرضیه تأیید می‌کند که جغرافیا فقط اثر مستقیم ندارد، بلکه از طریق یک زنجیره طولانی از متغیرها نیز بر پایداری اثر می‌گذارد. ضعف اثر، نشان‌دهنده «اصطکاک» در مسیر است.</div>
  `,
  'H4a': `
    <strong>مسیر:</strong> HG × PR → DT (تعامل جغرافیا و پیش‌نیازها)<br>
    <strong>β = 0.256 | p < 0.001 | اثر متوسط</strong><br><br>
    <em>چرا تأیید شد و اثر آن متوسط است؟</em><br>
    این فرضیه نشان می‌دهد که HG و PR «هم‌افزا» عمل می‌کنند. اثر متوسط است چون تعامل دو متغیر همیشه بخشی از واریانس را تبیین می‌کند، اما به اندازه اثر مستقیم قوی نیست.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> این یافته کلیدی است: سیاست‌گذار باید هم‌زمان به جغرافیا و پیش‌نیازها توجه کند. اگر فقط یکی را تقویت کند، اثر دیجیتال‌سازی نصفه می‌ماند.</div>
  `,
  'H4b': `
    <strong>مسیر:</strong> HG × PR → SUS (تعامل تعدیل‌گر)<br>
    <strong>β = 0.096 | p = 0.002 (اثر ضعیف)</strong><br><br>
    <em>چرا تأیید شد اما اثر آن ضعیف است؟</em><br>
    جغرافیا و پیش‌نیازها به‌صورت هم‌افزا بر پایداری اثر می‌گذارند: وقتی هر دو بالا باشند، پایداری بیشتر از «جمع خطی» آن‌هاست. اما اثر تعاملی ضعیف است چون پایداری از مسیرهای متعدد (PR→SUS، DT→SUS، HG→SUS) تغذیه می‌شود و تعامل فقط یک قطعه از پازل است.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> تقویت هم‌زمان جغرافیا و پیش‌نیازها، پایداری را بیشتر از جمع جداگانهٔ آن‌ها افزایش می‌دهد — یعنی سیاست‌های ترکیبی (نه تک‌بعدی) بازدهی بیشتری دارند. این یافته مبنای توصیهٔ سیاستی «هم‌زمانی» در مقاله است.</div>
  `,
  'H4c': `
    <strong>مسیر:</strong> HG × DT → SUS (تعامل تعدیل‌گر)<br>
    <strong>β = 0.177 | p = 0.003 | f² = 0.049 (اثر متوسط)</strong><br><br>
    <em>چرا تأیید شد و اثر آن متوسط است؟</em><br>
    این یکی از مهم‌ترین یافته‌های تعدیل‌گری: اثر تحول دیجیتال بر پایداری، بسته به سطح جغرافیا متفاوت است. در زنان نزدیک شهر، DT اثر قوی‌تری بر پایداری دارد؛ در مناطق دورافتاده، اثر DT به‌شدت کاهش می‌یابد. اثر متوسط (نه قوی) چون DT فقط یکی از چند مسیر پایداری است — اما همین اثر متوسط، پیام سیاستی بزرگ دارد.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> مستقیم‌ترین پیام سیاستی مقاله: «دیجیتال به‌تنهایی کافی نیست — بدون جغرافیا، اثر نصفه است». سرمایه‌گذاری در زیرساخت دیجیتال مناطق دورافتاده، بدون بهبود دسترسی جغرافیایی، بازدهی محدودی دارد.</div>
  `,
  'H5a': `
    <strong>مسیر:</strong> QE → PR (اثر درجه دوم)<br>
    <strong>β = 0.032 | p = 0.382 | اثر ناچیز</strong><br><br>
    <em class="interp-reason">چرا رد شد؟</em><br>
    فرضیه H5a به دنبال یک رابطه غیرخطی بین QE و PR بود. اما داده‌ها نشان می‌دهند که این رابطه <strong>کاملاً خطی</strong> است. افزودن جمله درجه دوم، هیچ بهبودی در تبیین مدل ایجاد نکرد (p-value بسیار بالاتر از 0.05).
    <div class="reason-text"><strong>ارتباط با هدف:</strong> رد این فرضیه یک یافته ارزشمند است: نشان می‌دهد که اثر جغرافیا بر پیش‌نیازها، اثر یکنواخت و خطی است و «آستانه» یا «نقطه شکست» ندارد. این یعنی سیاست‌ها باید پیوسته و بدون وقفه اجرا شوند.</div>
  `,
  'H5b': `
    <strong>مسیر:</strong> QE → DT (اثر درجه دوم)<br>
    <strong>β = −0.105 | p = 0.034 | f² = 0.017 (اثر ضعیف، منفی)</strong><br><br>
    <em>چرا تأیید شد و چرا علامت منفی دارد؟</em><br>
    این تنها اثر غیرخطی معنادار در مدل است و علامت آن منفی است. تفسیر: هرچه سطح جغرافیا بالاتر می‌رود، اثر اضافی آن بر دیجیتال «کمتر» می‌شود — یک پدیدهٔ «بازده نزولی» یا «اشباع». در مناطق نزدیک شهر، فناوری از قبل از کانال‌های دیگر (مدارس، رسانه، شبکه‌ها) تأمین شده؛ افزایش بیشتر جغرافیا، سود اضافی کمی دارد. در مناطق دورافتاده، برعکس: هر واحد افزایش جغرافیا، جهش بزرگی در دسترسی دیجیتال ایجاد می‌کند.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> این یافته مهم‌ترین پیام غیرخطی مقاله است: مداخلات دیجیتال باید «هدفمند» و متمرکز بر مناطق «محروم» باشند، نه یکنواخت. توزیع یکسان منابع در مناطق برخوردار و محروم، بازدهی کمتری از تمرکز بر مناطق محروم دارد.</div>
  `,
  'H5c': `
    <strong>مسیر:</strong> QE → SUS (اثر درجه دوم)<br>
    <strong>β = 0.026 | p = 0.571 | اثر ناچیز</strong><br><br>
    <em class="interp-reason">چرا رد شد؟</em><br>
    مشابه H5a، فرضیه H5c انتظار داشت که QE به صورت غیرخطی بر پایداری کارآفرینی اثر بگذارد. اما اثر QE بر SUS از طریق مسیرهای خطی و میانجی (PR و DT) اعمال می‌شود، نه به صورت مستقیم و غیرخطی. عدم معناداری نشان می‌دهد که QE یک اثر مستقیم غیرخطی بر SUS ندارد.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> این یافته تأیید می‌کند که مکانیسم اثر جغرافیا بر پایداری، «غیرمستقیم» و از طریق پیش‌نیازها و دیجیتال‌سازی است. بنابراین، سرمایه‌گذاری در PR و DT، مؤثرتر از مداخلات مستقیم جغرافیایی است.</div>
  `,
  'H6a': `
    <strong>مسیر:</strong> HG × PR → DT (تعامل دوگانه)<br>
    <strong>β = 0.256 | p < 0.001 | f² = 0.065 (اثر متوسط)</strong><br><br>
    <em>چرا تأیید شد و اثر آن چرا متوسط است؟</em><br>
    این فرضیه از منظر «تعامل دوگانه» مطرح شده و <strong>همان مسیر H4a</strong> را آزمون می‌کند (β یکسان، ۰.۲۵۶). نشان می‌دهد HG و PR به‌صورت هم‌افزا بر DT اثر می‌گذارند. اثر بالاتر از انتظار (β>۰.۲۵) یعنی تعامل این دو متغیر «بیش از جمع» است: وقتی هر دو بالا باشند، اثر بر DT از جمع خطی آن‌ها بیشتر می‌شود.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> تأکید مجدد بر اینکه سیاست‌های تک‌بعدی (فقط جغرافیا یا فقط پیش‌نیاز) بازدهی کمتری از سیاست‌های ترکیبی دارند. برای تسریع دیجیتال‌سازی، باید هر دو اهرم را هم‌زمان فشار داد.</div>
  `,
  'H6b': `
    <strong>مسیر:</strong> HG × PR → SUS (تعامل دوگانه)<br>
    <strong>β = 0.096 | p = 0.002 (اثر ضعیف)</strong><br><br>
    <em>چرا تأیید شد اما ضعیف است؟</em><br>
    این فرضیه همان مسیر H4b را با برچسب «تعاملی» آزمون می‌کند. تعامل HG×PR بر پایداری، ضعیف اما معنادار است. یعنی پایداری، بیشتر از هر چیز، از مسیرهای مستقیم (PR→SUS، DT→SUS) تغذیه می‌شود، نه از تعامل. اثر تعاملی، «اثر افزوده» است نه «اثر غالب».
    <div class="reason-text"><strong>ارتباط با هدف:</strong> تقویت هم‌زمان جغرافیا و پیش‌نیاز، اثری افزوده بر پایداری دارد — اما نه انقلابی. این یعنی مسیرهای مستقیم، اولویت بالاتری برای سیاست‌گذاری دارند.</div>
  `,
  'H6c': `
    <strong>مسیر:</strong> HG × DT → SUS (تعامل دوگانه)<br>
    <strong>β = 0.177 | p = 0.003 | f² = 0.049 (اثر متوسط)</strong><br><br>
    <em>چرا تأیید شد و اثر آن متوسط است؟</em><br>
    این فرضیه همان مسیر H4c را با برچسب «تعاملی» آزمون می‌کند. مهم‌ترین یافتهٔ تعاملی: HG و DT با هم بر پایداری اثر می‌گذارند. اثر DT بر پایداری، در سطوح بالای HG قوی‌تر و در سطوح پایین HG ضعیف‌تر است.
    <div class="reason-text"><strong>ارتباط با هدف:</strong> تأکید بر اینکه دیجیتال بدون جغرافیا، اثرگذاری محدودی بر پایداری دارد. این یافته، هم‌راستا با H4c و H5b، تصویر منسجمی از «شکاف دیجیتال-جغرافیایی» ارائه می‌دهد.</div>
  `
};
/* ─── HYP_DETAILS_EN (English) — 20 hypotheses ─── */
const HYP_DETAILS_EN = {
  'H1a': `
    <strong>Path:</strong> PR → DT (Prerequisites to Digital Transformation)<br>
    <strong>β = 0.262 | p < 0.001 | f² = 0.068 (small effect)</strong><br><br>
    <em>Why confirmed but small?</em><br>
    Prerequisites are the initial foundation for technology adoption — but having resources and skills alone does not trigger digitalization. According to the Technology Acceptance Model (TAM), "perceived usefulness" and "ease of use" are mediating variables that go beyond mere resources. The small effect (f² = 0.068) shows prerequisites are necessary but not sufficient.
    <div class="reason-text"><strong>Link to research goal:</strong> Prerequisites are essential "at the input", but they alone do not activate digitalization. Policymakers must also strengthen motivation and training in technology use, in addition to providing resources.</div>
  `,
  'H1b': `
    <strong>Path:</strong> PR → SUS (Prerequisites to Sustainability)<br>
    <strong>β = 0.230 | p < 0.001 | f² = 0.066 (small-to-medium effect)</strong><br><br>
    <em>Why confirmed with medium effect?</em><br>
    Some prerequisites (financial capital, support networks, self-efficacy) directly strengthen business sustainability — independently of digitalization. A woman with savings or a support network is more resilient to economic shocks, even without using digital technology. The effect is medium because another part of prerequisites' influence operates through the indirect path (via DT).
    <div class="reason-text"><strong>Link to research goal:</strong> Prerequisites provide both a "safety buffer" and "digital fuel" — direct and indirect paths are both active. This means strengthening prerequisites, even without digitalization, has practical value.</div>
  `,
  'H1c': `
    <strong>Path:</strong> DT → SUS (Digital Transformation to Sustainability)<br>
    <strong>β = 0.374 | p < 0.001 | strong effect</strong><br><br>
    <em>Why confirmed and strong?</em><br>
    Digital transformation directly increases entrepreneurial sustainability. The effect is strong because digitalization directly improves market access and operational efficiency.
    <div class="reason-text"><strong>Link to research goal:</strong> This hypothesis shows that digitalization is a direct and powerful driver of sustainability; without it, other paths cannot reach their full outcome.</div>
  `,
  'H2a': `
    <strong>Path:</strong> HG → PR (Geography to Prerequisites)<br>
    <strong>β = 0.542 | p < 0.001 | strongest effect</strong><br><br>
    <em>Why confirmed and the strongest hypothesis?</em><br>
    Human geography (access, social network, cultural capital) has the most direct influence on building entrepreneurial prerequisites. Rural women closer to the city have more resources and opportunities.
    <div class="reason-text"><strong>Link to research goal:</strong> This is the highest coefficient in the model, indicating that geography is the "foundation" of entrepreneurship. Without geographic access, prerequisites do not form even with technology.</div>
  `,
  'H2b': `
    <strong>Path:</strong> HG → DT (Geography to Digital Transformation)<br>
    <strong>β = 0.274 | p < 0.001 | f² = 0.072 (small effect)</strong><br><br>
    <em>Why confirmed but small?</em><br>
    Access to digital infrastructure (high-speed internet, training centers, online platforms) is strongly tied to spatial distance. Women closer to the city are systematically more exposed to technology. The effect is small because "having access" is not enough — motivation, digital literacy, and trust in technology also matter.
    <div class="reason-text"><strong>Link to research goal:</strong> This path shows that the "digital divide" has geographic roots, not just individual attitudes. Technology policy that ignores geography leaves half the target population behind — the same finding confirmed by the Causal Forest and CATE of 0.33 to 0.53.</div>
  `,
  'H2c': `
    <strong>Path:</strong> HG → SUS (Geography to Sustainability)<br>
    <strong>β = 0.210 | p < 0.001 | f² = 0.055 (small effect)</strong><br><br>
    <em>Why confirmed but small?</em><br>
    Geographic access directly affects business survival: proximity to markets, stronger social networks, greater cultural capital, and more effective institutional support. But the bulk of geography's effect on sustainability operates indirectly (via PR and DT) — which is why the direct effect is small yet significant.
    <div class="reason-text"><strong>Link to research goal:</strong> In addition to its large indirect effect (through prerequisites and digitalization), geography has a "direct" path to sustainability. If we strengthen only PR and DT while ignoring geography, part of sustainability is lost.</div>
  `,
  'H3a': `
    <strong>Path:</strong> PR → DT → SUS (partial mediation)<br>
    <strong>β = 0.098 | p = 0.001 | VAF = 29.81%</strong><br><br>
    <em>Why confirmed?</em><br>
    About 30% of the effect of prerequisites on sustainability is transmitted through digital transformation (partial mediation). The remaining 70% is direct. This means digitalization is an important "channel" for translating prerequisites into sustainability, but not the only one — fully consistent with the direct effect β = 0.230 in H1b.
    <div class="reason-text"><strong>Link to research goal:</strong> Investment in prerequisites yields returns both through the direct path and through digitalization. Policymakers activate two sustainability channels simultaneously by strengthening prerequisites — a "dual-track" return.</div>
  `,
  'H3b': `
    <strong>Path:</strong> HG → PR → DT (partial mediation)<br>
    <strong>β = 0.142 | p < 0.001 | VAF = 34.13%</strong><br><br>
    <em>Why confirmed with relatively high VAF?</em><br>
    More than one-third (34%) of the effect of geography on digital transformation is transmitted through entrepreneurial prerequisites. The mechanism is clear: geography first builds prerequisites (access to resources, networks, cultural capital), then these prerequisites activate digitalization. VAF above 34% shows this "chain" is a major and dominant path.
    <div class="reason-text"><strong>Link to research goal:</strong> The chain "geography → prerequisites → digitalization" is the main policy pathway for technology development in rural areas. Without strengthening prerequisites, geography alone cannot activate digitalization.</div>
  `,
  'H3c': `
    <strong>Path:</strong> HG → DT → SUS (partial mediation)<br>
    <strong>β = 0.102 | p < 0.001 | VAF = 20.92%</strong><br><br>
    <em>Why confirmed but with low VAF?</em><br>
    About 21% of the effect of geography on sustainability is transmitted through digitalization. This means digitalization is a "smaller" mediator — most of geography's effect on sustainability operates through the direct path (β=0.210 in H2c) and through prerequisites (H3d with VAF=25%). Yet the path's significance confirms that "investing in digital infrastructure in remote areas" has scientific logic.
    <div class="reason-text"><strong>Link to research goal:</strong> Developing digital infrastructure in remote areas yields a positive but limited return. Strengthening only this path while ignoring the others (prerequisites and direct geography) leaves the total effect incomplete.</div>
  `,
  'H3d': `
    <strong>Path:</strong> HG → PR → SUS (partial mediation)<br>
    <strong>β = 0.125 | p < 0.001 | VAF = 25.53%</strong><br><br>
    <em>Why confirmed?</em><br>
    About 26% of the effect of geography on sustainability is transmitted through prerequisites. The mechanism is clear: a rural woman living in a better-access region acquires stronger prerequisites (capital, skills, networks); these prerequisites directly strengthen business sustainability. VAF above 25% shows this "mediating bridge" is a practically important path.
    <div class="reason-text"><strong>Link to research goal:</strong> Strengthening prerequisites in remote areas "compensates for" geographic disadvantage. Even if distance cannot be reduced, the negative effect of geography can be mitigated by strengthening resources and networks.</div>
  `,
  'H3e': `
    <strong>Path:</strong> HG → PR → DT → SUS (chained)<br>
    <strong>β = 0.053 | p = 0.002 | weak effect</strong><br><br>
    <em>Why confirmed but weak?</em><br>
    A chained indirect effect is always weaker than direct effects because the geography effect attenuates at each stage (PR and DT). However, p=0.002 confirms the path is still valid.
    <div class="reason-text"><strong>Link to research goal:</strong> This confirms that geography also influences sustainability through a long chain of variables. The weak effect indicates "friction" along the path.</div>
  `,
  'H4a': `
    <strong>Path:</strong> HG × PR → DT (geography × prerequisites interaction)<br>
    <strong>β = 0.256 | p < 0.001 | moderate effect</strong><br><br>
    <em>Why confirmed with moderate effect?</em><br>
    This shows HG and PR act synergistically. The moderate effect arises because the interaction of two variables always explains only part of the variance, less than the direct effects.
    <div class="reason-text"><strong>Link to research goal:</strong> Key finding for policy: government must address geography and prerequisites simultaneously. Strengthening only one leaves digital transformation half-effective.</div>
  `,
  'H4b': `
    <strong>Path:</strong> HG × PR → SUS (moderator interaction)<br>
    <strong>β = 0.096 | p = 0.002 (small effect)</strong><br><br>
    <em>Why confirmed with small effect?</em><br>
    Geography and prerequisites act synergistically on sustainability: when both are high, sustainability exceeds the "linear sum" of their individual effects. The interaction effect is small because sustainability is fed by multiple paths (PR→SUS, DT→SUS, HG→SUS), and the interaction is only one piece of the puzzle.
    <div class="reason-text"><strong>Link to research goal:</strong> Strengthening geography and prerequisites simultaneously raises sustainability more than the sum of individual effects — combined (not one-dimensional) policies yield higher returns. This finding underpins the paper's "simultaneity" policy recommendation.</div>
  `,
  'H4c': `
    <strong>Path:</strong> HG × DT → SUS (moderator interaction)<br>
    <strong>β = 0.177 | p = 0.003 | f² = 0.049 (medium effect)</strong><br><br>
    <em>Why confirmed with medium effect?</em><br>
    One of the most important moderation findings: the effect of digital transformation on sustainability differs by geography level. For women near the city, DT has a stronger effect on sustainability; in remote areas, DT's effect drops sharply. The effect is medium (not strong) because DT is only one of several sustainability paths — but even this medium effect carries a big policy message.
    <div class="reason-text"><strong>Link to research goal:</strong> The paper's most direct policy message: "digital alone is not enough — without geography, the effect is halved". Investing in digital infrastructure in remote areas without improving geographic access yields limited returns.</div>
  `,
  'H5a': `
    <strong>Path:</strong> QE → PR (quadratic effect)<br>
    <strong>β = 0.032 | p = 0.382 | negligible effect</strong><br><br>
    <em class="interp-reason">Why rejected?</em><br>
    H5a sought a nonlinear relationship between QE and PR. Data show the relationship is <strong>purely linear</strong>. Adding the quadratic term did not improve model fit (p-value well above 0.05).
    <div class="reason-text"><strong>Link to research goal:</strong> Rejecting this hypothesis is valuable — it shows that the effect of geography on prerequisites is uniform and linear, with no "threshold" or "breakpoint". Policies should therefore be continuous, not stepped.</div>
  `,
  'H5b': `
    <strong>Path:</strong> QE → DT (quadratic effect)<br>
    <strong>β = −0.105 | p = 0.034 | f² = 0.017 (small effect, negative)</strong><br><br>
    <em>Why confirmed and why is the sign negative?</em><br>
    This is the only significant nonlinear effect in the model, and its sign is negative. Interpretation: as the level of geography rises, its additional effect on digitalization "shrinks" — a "diminishing returns" or "saturation" pattern. In areas near the city, technology is already supplied through other channels (schools, media, networks); further increases in geography yield little extra benefit. In remote areas, the opposite is true: each unit of increased geography triggers a large jump in digital access.
    <div class="reason-text"><strong>Link to research goal:</strong> This is the paper's most important nonlinear finding: digital interventions must be "targeted" and concentrated in "deprived" areas, not spread uniformly. Distributing resources equally across well-off and deprived regions yields lower returns than focusing on deprived regions.</div>
  `,
  'H5c': `
    <strong>Path:</strong> QE → SUS (quadratic effect)<br>
    <strong>β = 0.026 | p = 0.571 | negligible effect</strong><br><br>
    <em class="interp-reason">Why rejected?</em><br>
    Similar to H5a, H5c expected a nonlinear effect of QE on sustainability. Instead, QE operates through linear and mediating paths (PR and DT), not directly and nonlinearly. Non-significance confirms QE has no direct nonlinear effect on SUS.
    <div class="reason-text"><strong>Link to research goal:</strong> This confirms that the mechanism from geography to sustainability is <em>indirect</em>, through prerequisites and digitalization. Investment in PR and DT is therefore more effective than direct geographic interventions.</div>
  `,
  'H6a': `
    <strong>Path:</strong> HG × PR → DT (dual interaction)<br>
    <strong>β = 0.256 | p < 0.001 | f² = 0.065 (medium effect)</strong><br><br>
    <em>Why confirmed with medium effect?</em><br>
    This hypothesis is framed as a "dual interaction" and tests <strong>the same path as H4a</strong> (identical β, 0.256). It shows HG and PR act synergistically on DT. The effect above expectation (β > 0.25) means their interaction "exceeds the sum": when both are high, the effect on DT is more than the linear sum.
    <div class="reason-text"><strong>Link to research goal:</strong> Reaffirms that one-dimensional policies (geography only or prerequisites only) yield less than combined policies. To accelerate digitalization, both levers must be pushed simultaneously.</div>
  `,
  'H6b': `
    <strong>Path:</strong> HG × PR → SUS (dual interaction)<br>
    <strong>β = 0.096 | p = 0.002 (small effect)</strong><br><br>
    <em>Why confirmed but small?</em><br>
    This hypothesis tests the same path as H4b with an "interaction" label. The HG×PR interaction on sustainability is small but significant. Sustainability is fed mainly by direct paths (PR→SUS, DT→SUS), not by the interaction. The interaction effect is an "added effect", not the dominant one.
    <div class="reason-text"><strong>Link to research goal:</strong> Simultaneous strengthening of geography and prerequisites adds to sustainability — but not revolutionarily. Direct paths have higher priority for policy.</div>
  `,
  'H6c': `
    <strong>Path:</strong> HG × DT → SUS (dual interaction)<br>
    <strong>β = 0.177 | p = 0.003 | f² = 0.049 (medium effect)</strong><br><br>
    <em>Why confirmed with medium effect?</em><br>
    This hypothesis tests the same path as H4c with an "interaction" label. The key interaction finding: HG and DT jointly influence sustainability. DT's effect on sustainability is stronger at high HG levels and weaker at low HG levels.
    <div class="reason-text"><strong>Link to research goal:</strong> Emphasizes that digitalization without geography has limited impact on sustainability. Alongside H4c and H5b, it paints a coherent picture of the "digital-geographic divide".</div>
  `
};

function renderHypotheses(){
  const cont=$('hypotheses-container'); if(!cont) return;
  if(typeof HYPOTHESES==='undefined'){ cont.innerHTML=''; return; }
  const total=HYPOTHESES.length;
  const confirmed=HYPOTHESES.filter(h=>h.result==='confirmed').length;
  const rejected=HYPOTHESES.filter(h=>h.result==='rejected').length;
  const ratio=Math.round((confirmed/total)*100);
  const kpiEl=$('hyp-kpi-grid');
  if(kpiEl){
    kpiEl.innerHTML=`<div class="hyp-kpi hyp-kpi-total"><div class="hyp-kpi-icon">📚</div><div class="hyp-kpi-label">${t('hyp_kpi_total')}</div><div class="hyp-kpi-value">${total}</div></div><div class="hyp-kpi hyp-kpi-conf"><div class="hyp-kpi-icon">✅</div><div class="hyp-kpi-label">${t('hyp_kpi_confirmed')}</div><div class="hyp-kpi-value">${confirmed}</div></div><div class="hyp-kpi hyp-kpi-rej"><div class="hyp-kpi-icon">❌</div><div class="hyp-kpi-label">${t('hyp_kpi_rejected')}</div><div class="hyp-kpi-value">${rejected}</div></div><div class="hyp-kpi hyp-kpi-ratio"><div class="hyp-kpi-icon">📈</div><div class="hyp-kpi-label">${t('hyp_kpi_ratio')}</div><div class="hyp-kpi-value">${ratio}%</div><div class="hyp-kpi-bar"><span style="width:${ratio}%"></span></div></div>`;
  }
  const f=state.hypFilter, s=state.hypSearch.trim().toLowerCase();
  let rows=HYPOTHESES.slice();
  if(f==='confirmed'||f==='rejected') rows=rows.filter(h=>h.result===f);
  else if(f!=='all'){
    if(f==='mediation') rows=rows.filter(h=>h.type==='mediation'||h.type==='chained');
    else if(f==='moderator') rows=rows.filter(h=>h.type==='moderator'||h.type==='interaction');
    else rows=rows.filter(h=>h.type===f);
  }
  if(s) rows=rows.filter(h=>h.id.toLowerCase().includes(s)||h.path.toLowerCase().includes(s));

  const isFa = state.lang === 'fa';
  const interpHTML = `
    <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
      <button class="btn-interpretation" id="hyp-btn-toggle">
        <span class="icon-bulb">💡</span>
        <span id="hyp-btn-text">${ti('hyp_show_btn')}</span>
      </button>
    </div>
    <div class="interpretation-panel" id="hyp-interp-panel">
      <div class="interpretation-content">
        <div class="interp-header">
          <span class="interp-header-icon">📊</span>
          <span class="interp-title">${ti('hyp_header')}</span>
        </div>
        <div class="interp-body">
          <div class="interp-item">
            <span class="interp-label">${isFa ? 'نوع آزمون:' : 'Test type:'}</span>
            ${isFa ? 'مدل‌سازی معادلات ساختاری (PLS-SEM) با ۵,۰۰۰ زیرنمونه بوت‌استرپ.' : 'Structural Equation Modeling (PLS-SEM) with 5,000 bootstrap subsamples.'}
          </div>
          <div class="interp-item">
            <span class="interp-label">${isFa ? 'هدف:' : 'Goal:'}</span>
            ${isFa ? 'آزمون هم‌زمان ۲۰ فرضیه پژوهش شامل مسیرهای مستقیم، میانجی، تعدیل‌گر و غیرخطی.' : 'Simultaneous testing of 20 research hypotheses covering direct, mediation, moderator, and nonlinear paths.'}
          </div>
          <div class="interp-item">
            <span class="interp-label">${isFa ? 'نتیجه کلی:' : 'Overall result:'}</span>
            <span class="interp-highlight">${isFa ? '۱۸ فرضیه از ۲۰ فرضیه تأیید شدند.' : '18 of 20 hypotheses were confirmed.'}</span>
            ${isFa ? ' دو فرضیه غیرخطی (H5a و H5c) رد شدند.' : ' Two nonlinear hypotheses (H5a and H5c) were rejected.'}
          </div>
          <div class="interp-item" style="border-right-color: #e74c3c; background: rgba(231,76,60,0.1);">
            <span class="interp-label" style="color: #ec7063;">${isFa ? 'تحلیل چرایی رد H5a و H5c:' : 'Analysis: why were H5a and H5c rejected?'}</span>
            ${isFa ? 'این دو فرضیه مربوط به <span class="interp-reason">اثر درجه دوم (غیرخطی) متغیر QE</span> بودند.' : 'These two hypotheses tested the <span class="interp-reason">quadratic (nonlinear) effect of QE</span>.'}
            <br>• <strong>H5a (QE → PR):</strong> ${isFa ? 'چرا رد شد؟ چون در داده‌های این پژوهش، اثر غیرخطی متغیر QE بر پیش‌نیازهای کارآفرینی بسیار ناچیز بود (β=0.032) و از نظر آماری معنادار نبود (p=0.382).' : 'Why rejected? The nonlinear effect of QE on entrepreneurial prerequisites was negligible (β=0.032) and not statistically significant (p=0.382).'}
            <br>• <strong>H5c (QE → SUS):</strong> ${isFa ? 'به همین ترتیب، اثر غیرخطی QE بر پایداری کارآفرینی نیز معنادار نبود (p=0.571).' : 'Similarly, the nonlinear effect of QE on entrepreneurial sustainability was not significant (p=0.571).'}
          </div>
          <div class="interp-item" style="font-size: 12px;">
            ${ti('hyp_hint')}
          </div>
        </div>
      </div>
    </div>
  `;

  if(rows.length===0){ cont.innerHTML=`${interpHTML}<div class="hyp-empty">${t('hyp_empty')}</div>`; bindHypInterp(); return; }

  let html=interpHTML;
  html+=`<div class="hyp-hint">💡 ${t('hyp_click_hint')}</div><div class="hyp-table-wrap"><table class="hyp-table"><thead><tr><th>${t('hyp_col_hyp')}</th><th>${t('hyp_col_type')}</th><th>${t('hyp_col_path')}</th><th>${t('hyp_col_sd')}</th><th>${t('hyp_col_beta')}</th><th>${t('hyp_col_t')}</th><th>${t('hyp_col_p')}</th><th>${t('hyp_col_f2')}</th><th>${t('hyp_col_var')}</th><th>${t('hyp_col_result')}</th></tr></thead><tbody>`;
  rows.forEach(h=>{
    const typeCls=`hyp-type hyp-type-${h.type}`;
    const resultCls=h.result==='confirmed'?'hyp-res-confirmed':'hyp-res-rejected';
    const resultIcon=h.result==='confirmed'?'✓':'✕';
    const betaColor=betaHeatColor(h.beta);
    const betaTxt=(h.beta>=0?'':'−')+Math.abs(h.beta).toFixed(3);
    const pSig=h.pval<0.05;
    const pCell=`<span class="hyp-p ${pSig?'hyp-p-sig':'hyp-p-ns'}">${h.p}</span>`;
    const f2Cell=h.f2==null?'<span class="hyp-dash">—</span>':`<div class="hyp-f2-cell"><span class="hyp-f2-val">${h.f2.toFixed(3)}</span><span class="hyp-f2-tag">${effectLabel(h.f2)}</span></div>`;
    const varCell=h.variance==null?'<span class="hyp-dash">—</span>':`<span class="hyp-var">${h.variance.toFixed(2)}%</span>`;
    const pathParts=h.path.split(/\s*(?:→|->|×)\s*/);
    const pathHtml=pathParts.map((p,i)=>{ const chip=`<span class="hyp-node">${p}</span>`; return i===0?chip:((h.path.includes('×')?'<span class="hyp-op">×</span>':'<span class="hyp-arrow">→</span>')+chip); }).join('');

    html+=`<tr class="hyp-row" data-hyp="${h.id}"><td class="hyp-id"><span class="hyp-id-chip">${h.id}</span></td><td><span class="${typeCls}">${typeLabel(h.type)}</span></td><td class="hyp-path">${pathHtml}</td><td class="hyp-num">${h.sd.toFixed(3)}</td><td class="hyp-num"><span class="hyp-beta" style="background:${betaColor}">${betaTxt}</span></td><td class="hyp-num hyp-t"><span class="hyp-t-chip">${h.t.toFixed(2)}</span></td><td class="hyp-num">${pCell}</td><td class="hyp-num">${f2Cell}</td><td class="hyp-num">${varCell}</td><td><span class="hyp-res ${resultCls}"><span class="hyp-res-icon">${resultIcon}</span>${t(h.result==='confirmed'?'hyp_result_confirmed':'hyp_result_rejected')}</span></td></tr>`;
  });

  html+=`</tbody></table></div>`;
  cont.innerHTML=html;
  bindHypInterp();
}

function bindHypInterp(){
  const btn = document.getElementById('hyp-btn-toggle');
  const panel = document.getElementById('hyp-interp-panel');
  const btnText = document.getElementById('hyp-btn-text');
  if(btn && panel && btnText) {
    let isOpen = false;
    btn.onclick = () => {
      isOpen = !isOpen;
      if (isOpen) {
        panel.classList.add('open');
        btnText.textContent = ti('hyp_hide_btn');
        btn.style.background = 'linear-gradient(135deg, rgba(231,76,60,.15), rgba(231,76,60,.05))';
        btn.style.color = '#ec7063';
        btn.style.borderColor = '#e74c3c';
      } else {
        panel.classList.remove('open');
        btnText.textContent = ti('hyp_show_btn');
        btn.style.background = 'linear-gradient(135deg, rgba(52,152,219,.15), rgba(52,152,219,.05))';
        btn.style.color = '#5dade2';
        btn.style.borderColor = '#3498db';
      }
    };
  }
  let tooltip = document.getElementById('hyp-row-tooltip');
  if(!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'hyp-row-tooltip';
    tooltip.className = 'table-tooltip';
    document.body.appendChild(tooltip);
  }
  document.querySelectorAll('#hypotheses-container tbody tr').forEach(row => {
    row.addEventListener('mouseenter', (e) => {
      const hypId = row.dataset.hyp;
      if (hypId && (HYP_DETAILS[hypId] || (typeof HYP_DETAILS_EN !== 'undefined' && HYP_DETAILS_EN[hypId]))) {
        tooltip.innerHTML = `<span class="tooltip-title">${ti('hyp_tooltip')} ${hypId}</span><div>${getHypInt(hypId)}</div>`;
        tooltip.style.display = 'block';
      }
    });
    row.addEventListener('mousemove', (e) => {
      let x = e.clientX + 15;
      let y = e.clientY + 15;
      if (x + tooltip.offsetWidth > window.innerWidth) x = e.clientX - tooltip.offsetWidth - 15;
      if (y + tooltip.offsetHeight > window.innerHeight) y = e.clientY - tooltip.offsetHeight - 15;
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    });
    row.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}
function bindHypothesisFilters(){
  document.querySelectorAll('.hyp-chip[data-hyp-filter]').forEach(btn=>{
    btn.onclick=()=>{ document.querySelectorAll('.hyp-chip[data-hyp-filter]').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); state.hypFilter=btn.dataset.hypFilter; renderHypotheses(); };
  });
  const search=$('hyp-search');
  if(search){ search.oninput=e=>{ state.hypSearch=e.target.value; renderHypotheses(); }; }
}
/* ================================================================
   VIF TABLE
   ================================================================ */
function vifColor(v){
  if(v>=5)    return {bg:'linear-gradient(135deg,#c0392b,#e74c3c)', text:'#fff',     label:'vif_status_critical',   cls:'vif-status-critical'};
  if(v>=3.3)  return {bg:'linear-gradient(135deg,#e67e22,#f39c12)', text:'#fff',     label:'vif_status_warning',    cls:'vif-status-warning'};
  if(v>=3.0)  return {bg:'linear-gradient(135deg,#f1c40f,#f7dc6f)', text:'#2c3e50',  label:'vif_status_acceptable', cls:'vif-status-acceptable'};
  if(v>=2.0)  return {bg:'linear-gradient(135deg,#27ae60,#58d68d)', text:'#fff',     label:'vif_status_good',       cls:'vif-status-good'};
  return            {bg:'linear-gradient(135deg,#16a085,#1abc9c)', text:'#fff',     label:'vif_status_excellent',  cls:'vif-status-excellent'};
}
function vifBarColor(v){ if(v>=5) return '#e74c3c'; if(v>=3.3) return '#f39c12'; if(v>=3.0) return '#f1c40f'; if(v>=2.0) return '#27ae60'; return '#1abc9c'; }

function renderVIFTable(){
  const cont = document.getElementById('vif-table-container'); if(!cont) return;
  const V = (state.loaded && state.loaded.vifTable) || FALLBACK_VIF_TABLE;
  const src = (state.loaded && state.loaded.sources && state.loaded.sources.vifTable) || 'fallback';
  const total = V.length;
  const vals = V.map(x=>x.vif);
  const mean = vals.reduce((a,b)=>a+b,0)/total;
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const warnCount = V.filter(x=>x.vif>=3.3 && x.vif<5).length;
  const critCount = V.filter(x=>x.vif>=5).length;
  const kpiEl = document.getElementById('vif-kpi-grid');
  if(kpiEl){
    kpiEl.innerHTML = `<div class="vif-kpi vif-kpi-total"><div class="vif-kpi-icon">📊</div><div class="vif-kpi-label">${t('vif_kpi_total')}</div><div class="vif-kpi-value">${total}</div></div><div class="vif-kpi vif-kpi-mean"><div class="vif-kpi-icon">📈</div><div class="vif-kpi-label">${t('vif_kpi_mean')}</div><div class="vif-kpi-value">${mean.toFixed(3)}</div></div><div class="vif-kpi vif-kpi-min"><div class="vif-kpi-icon">✅</div><div class="vif-kpi-label">${t('vif_kpi_min')}</div><div class="vif-kpi-value">${minV.toFixed(3)}</div></div><div class="vif-kpi vif-kpi-max"><div class="vif-kpi-icon">⚠</div><div class="vif-kpi-label">${t('vif_kpi_max')}</div><div class="vif-kpi-value">${maxV.toFixed(3)}</div></div><div class="vif-kpi vif-kpi-warning"><div class="vif-kpi-icon">🔶</div><div class="vif-kpi-label">${t('vif_kpi_warning')}</div><div class="vif-kpi-value">${warnCount}</div></div><div class="vif-kpi vif-kpi-critical"><div class="vif-kpi-icon">🔴</div><div class="vif-kpi-label">${t('vif_kpi_critical')}</div><div class="vif-kpi-value">${critCount}</div></div>`;
  }
  const f = state.vifFilter || 'all', s = (state.vifSearch || '').trim().toLowerCase();
  let rows = V.slice();
  if(f === 'warning') rows = rows.filter(x=>x.vif>=3.3);
  else if(f === 'excellent') rows = rows.filter(x=>x.vif<3.3);
  else if(f !== 'all'){ if(f === 'QE') rows = rows.filter(x=>x.construct==='QE'||x.construct==='HG×PR'||x.construct==='HG×DT'); else rows = rows.filter(x=>x.construct===f); }
  if(s) rows = rows.filter(x=>x.id.toLowerCase().includes(s));
  rows.sort((a,b)=>{ const am=a.id.match(/^Q(\d+)$/i), bm=b.id.match(/^Q(\d+)$/i); if(am && bm) return parseInt(am[1]) - parseInt(bm[1]); if(am) return -1; if(bm) return 1; return a.id.localeCompare(b.id); });
  if(rows.length === 0){ cont.innerHTML = `<div class="vif-empty">${t('vif_empty')}</div>`; return; }
  const badge = src === 'excel' ? `<span class="vif-source vif-source-excel">${t('vif_badge_excel')}</span>` : `<span class="vif-source vif-source-fallback">${t('vif_badge_fallback')}</span>`;
  const maxForBar = Math.max(5, maxV);
  let html = `<div class="vif-hint">${badge}<span style="margin-inline-start:12px">💡 ${t('vif_threshold_hint')}</span></div><div class="vif-table-wrap"><table class="vif-table"><thead><tr><th>${t('vif_col_indicator')}</th><th>${t('vif_col_construct')}</th><th>${t('vif_col_vif')}</th><th>${t('vif_col_bar')}</th><th>${t('vif_col_status')}</th></tr></thead><tbody>`;
  rows.forEach(item=>{
    const c = vifColor(item.vif);
    const barW = Math.min(100, (item.vif / maxForBar) * 100);
    const barC = vifBarColor(item.vif);
    let constructCls = 'vif-construct';
    if(item.construct === 'PR') constructCls += ' vif-construct-pr'; else if(item.construct === 'DT') constructCls += ' vif-construct-dt'; else if(item.construct === 'SUS') constructCls += ' vif-construct-sus'; else if(item.construct === 'HG') constructCls += ' vif-construct-hg'; else if(item.construct === 'QE') constructCls += ' vif-construct-qe'; else if(item.construct && item.construct.startsWith('HG×')) constructCls += ' vif-construct-inter';
    const isHi = state.highlighted === item.id ? 'vif-row-hi' : '';
    html += `<tr class="vif-row ${isHi}"><td class="vif-cell-ind"><span class="vif-ind-chip">${item.id}</span></td><td class="vif-cell-con"><span class="${constructCls}">${item.construct||'—'}</span></td><td class="vif-cell-val"><span class="vif-val-chip" style="background:${c.bg};color:${c.text}">${item.vif.toFixed(3)}</span></td><td class="vif-cell-bar"><div class="vif-bar-track"><div class="vif-bar-fill" style="width:${barW}%;background:${barC}"></div></div></td><td class="vif-cell-status"><span class="vif-status ${c.cls}">${item.vif < 3.3 ? '✓' : (item.vif < 5 ? '⚠' : '✕')} ${t(c.label)}</span></td></tr>`;
  });
  html += `</tbody></table></div>`;
  cont.innerHTML = html;
}
function bindVIFTableFilters(){
  document.querySelectorAll('.vif-chip[data-vif-filter]').forEach(btn=>{
    btn.onclick = ()=>{ document.querySelectorAll('.vif-chip[data-vif-filter]').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); state.vifFilter = btn.dataset.vifFilter; renderVIFTable(); };
  });
  const search = document.getElementById('vif-search');
  if(search){ search.oninput = e => { state.vifSearch = e.target.value; renderVIFTable(); }; }
}

/* ================================================================
   RELIABILITY & VALIDITY
   ================================================================ */
function relLoadingColor(v){ if(v>=0.85) return {bg:'linear-gradient(135deg,#16a085,#1abc9c)', text:'#fff'}; if(v>=0.80) return {bg:'linear-gradient(135deg,#27ae60,#58d68d)', text:'#fff'}; if(v>=0.70) return {bg:'linear-gradient(135deg,#f1c40f,#f7dc6f)', text:'#2c3e50'}; return {bg:'linear-gradient(135deg,#e67e22,#f39c12)', text:'#fff'}; }
function relQualityColor(v, threshold){ if(v>=threshold+0.05) return {bg:'linear-gradient(135deg,#16a085,#1abc9c)', text:'#fff', status:'ok'}; if(v>=threshold) return {bg:'linear-gradient(135deg,#27ae60,#58d68d)', text:'#fff', status:'ok'}; return {bg:'linear-gradient(135deg,#e74c3c,#ec7063)', text:'#fff', status:'warn'}; }
function relCrossColor(own_min, cross_max){ const diff = own_min - cross_max; if(diff>=0.25) return {bg:'linear-gradient(135deg,#16a085,#1abc9c)', text:'#fff'}; if(diff>=0.10) return {bg:'linear-gradient(135deg,#27ae60,#58d68d)', text:'#fff'}; if(diff>=0) return {bg:'linear-gradient(135deg,#f1c40f,#f7dc6f)', text:'#2c3e50'}; return {bg:'linear-gradient(135deg,#e74c3c,#ec7063)', text:'#fff'}; }

function renderReliabilityTables(){
  const cont = document.getElementById('reliability-container'); if(!cont) return;
  const R = (state.loaded && state.loaded.reliability) || FALLBACK_RELIABILITY;
  const src = (state.loaded && state.loaded.sources && state.loaded.sources.reliability) || 'fallback';
  const badgeEl = document.getElementById('rel-source-badge');
  if(badgeEl){ const cls = src==='excel' ? 'vif-source-excel' : 'vif-source-fallback'; const txt = src==='excel' ? t('rel_source_excel') : t('rel_source_fallback'); badgeEl.innerHTML = `<span class="vif-source ${cls}">${txt}</span><span style="margin-inline-start:12px">💡 ${t('rel_threshold_note')}</span>`; }
  const constructChip = (c)=>{ const map={'PR':'vif-construct-pr','DT':'vif-construct-dt','SUS':'vif-construct-sus','HG':'vif-construct-hg','QE':'vif-construct-qe','HG×PR':'vif-construct-inter','HG×DT':'vif-construct-inter'}; return `<span class="vif-construct ${map[c]||''}">${c}</span>`; };
  let html = '';
  html += `<div class="rel-card"><div class="rel-card-head"><div class="rel-card-icon">۱</div><div><div class="rel-card-title">${t('rel_table1_title')}</div><div class="rel-card-sub">${t('rel_table1_sub')}</div></div></div><div class="rel-table-wrap"><table class="rel-table"><thead><tr><th>${t('rel_col_construct')}</th><th>${t('rel_col_items')}</th><th>${t('rel_col_loading')}</th><th>${t('rel_col_reliability')}</th><th>${t('rel_col_communal')}</th></tr></thead><tbody>`;
  (R.indicatorReliability||[]).forEach(row=>{
    const cLo = relLoadingColor(row.loading_min), cHi = relLoadingColor(row.loading_max);
    html += `<tr class="rel-row"><td class="rel-cell-con">${constructChip(row.construct)}<span class="rel-con-label">${row.label}</span></td><td><span class="rel-items-chip">${row.items}</span></td><td><div class="rel-range"><span class="rel-range-chip" style="background:${cLo.bg};color:${cLo.text}">${row.loading_min.toFixed(3)}</span><span class="rel-range-dash">–</span><span class="rel-range-chip" style="background:${cHi.bg};color:${cHi.text}">${row.loading_max.toFixed(3)}</span></div></td><td><div class="rel-range"><span class="rel-range-chip rel-range-sub">${row.rel_min.toFixed(3)}</span><span class="rel-range-dash">–</span><span class="rel-range-chip rel-range-sub">${row.rel_max.toFixed(3)}</span></div></td><td><div class="rel-range"><span class="rel-range-chip rel-range-sub">${row.comm_min.toFixed(3)}</span><span class="rel-range-dash">–</span><span class="rel-range-chip rel-range-sub">${row.comm_max.toFixed(3)}</span></div></td></tr>`;
  });
  html += `</tbody></table></div></div>`;
  html += `<div class="rel-card"><div class="rel-card-head"><div class="rel-card-icon">۲</div><div><div class="rel-card-title">${t('rel_table2_title')}</div></div></div><div class="rel-table-wrap"><table class="rel-table"><thead><tr><th>${t('rel_col_construct')}</th><th>${t('rel_col_cronbach')}</th><th>${t('rel_col_rho_a')}</th><th>${t('rel_col_rho_c')}</th><th>${t('rel_col_ave')}</th></tr></thead><tbody>`;
  (R.convergent||[]).forEach(row=>{
    const cCron = relQualityColor(row.cronbach,0.7), cRhoA = relQualityColor(row.rho_a,0.7), cRhoC = relQualityColor(row.rho_c,0.7), cAve = relQualityColor(row.ave,0.5);
    html += `<tr class="rel-row"><td class="rel-cell-con">${constructChip(row.construct)}<span class="rel-con-label">${row.label}</span></td><td><span class="rel-val-chip" style="background:${cCron.bg};color:${cCron.text}">${row.cronbach.toFixed(3)}</span></td><td><span class="rel-val-chip" style="background:${cRhoA.bg};color:${cRhoA.text}">${row.rho_a.toFixed(3)}</span></td><td><span class="rel-val-chip" style="background:${cRhoC.bg};color:${cRhoC.text}">${row.rho_c.toFixed(3)}</span></td><td><span class="rel-val-chip" style="background:${cAve.bg};color:${cAve.text}">${row.ave.toFixed(3)}</span></td></tr>`;
  });
  html += `</tbody></table></div><div class="rel-notes"><div class="rel-note">📘 ${t('rel_note_rho_a')}</div><div class="rel-note">📘 ${t('rel_note_rho_c')}</div></div></div>`;
  html += `<div class="rel-card"><div class="rel-card-head"><div class="rel-card-icon">۳</div><div><div class="rel-card-title">${t('rel_table3_title')}</div></div></div><div class="rel-table-wrap"><table class="rel-table"><thead><tr><th>${t('rel_col_construct')}</th><th>${t('rel_col_items')}</th><th>${t('rel_col_own')}</th><th>${t('rel_col_cross')}</th><th>${t('rel_col_result')}</th></tr></thead><tbody>`;
  (R.crossLoadings||[]).forEach(row=>{
    const cOwn = relLoadingColor(row.own_min), cOwnHi = relLoadingColor(row.own_max), cCross = relCrossColor(row.own_min, row.cross_max);
    const resCls = row.result==='confirmed' ? 'hyp-res-confirmed' : 'hyp-res-rejected';
    const resIcon = row.result==='confirmed' ? '✓' : '✕';
    html += `<tr class="rel-row"><td class="rel-cell-con">${constructChip(row.construct)}<span class="rel-con-label">${row.label}</span></td><td><span class="rel-items-chip">${row.items}</span></td><td><div class="rel-range"><span class="rel-range-chip" style="background:${cOwn.bg};color:${cOwn.text}">${row.own_min.toFixed(3)}</span><span class="rel-range-dash">–</span><span class="rel-range-chip" style="background:${cOwnHi.bg};color:${cOwnHi.text}">${row.own_max.toFixed(3)}</span></div></td><td><div class="rel-range"><span class="rel-range-chip" style="background:${cCross.bg};color:${cCross.text}">${row.cross_min.toFixed(3)}</span><span class="rel-range-dash">–</span><span class="rel-range-chip" style="background:${cCross.bg};color:${cCross.text}">${row.cross_max.toFixed(3)}</span></div></td><td><span class="hyp-res ${resCls}"><span class="hyp-res-icon">${resIcon}</span>${t(row.result==='confirmed'?'rel_result_confirmed':'rel_result_rejected')}</span></td></tr>`;
  });
  html += `</tbody></table></div></div>`;
  const FL = R.fornellLarcker || {constructs:[], labels:[], matrix:[]};
  html += `<div class="rel-card"><div class="rel-card-head"><div class="rel-card-icon">۴</div><div><div class="rel-card-title">${t('rel_table4_title')}</div><div class="rel-card-sub">${t('rel_fl_hint')}</div></div></div><div class="rel-table-wrap"><table class="rel-table rel-fl-table"><thead><tr><th></th>`;
  (FL.constructs||[]).forEach(c=>{ html += `<th>${c}</th>`; });
  html += `</tr></thead><tbody>`;
  (FL.matrix||[]).forEach((row, i)=>{
    const cName = FL.constructs[i]||'';
    html += `<tr class="rel-row rel-fl-row"><td class="rel-cell-con rel-fl-head">${constructChip(cName)}<span class="rel-con-label">${FL.labels[i]||cName}</span></td>`;
    for(let j=0;j<(FL.constructs||[]).length;j++){
      const v = row[j];
      if(v==null){ html += `<td class="rel-fl-empty">—</td>`; }
      else if(i===j){ html += `<td class="rel-fl-diag"><span class="rel-fl-chip rel-fl-chip-diag">${v.toFixed(3)}</span></td>`; }
      else { const diagVal = row[i]; const ok = diagVal!=null && diagVal > Math.abs(v); html += `<td class="rel-fl-cor"><span class="rel-fl-chip ${ok?'rel-fl-chip-ok':'rel-fl-chip-warn'}">${v.toFixed(3)}</span></td>`; }
    }
    html += `</tr>`;
  });
  html += `</tbody></table></div></div>`;
  cont.innerHTML = html;
}

/* ================================================================
   SMARTPLS GRAPHICAL
   ================================================================ */
async function extractImagesFromExcel(filename){
  try{ const buf = await fetchWithFallback(filename, true); const wb=XLSX.read(buf,{type:'array',bookFiles:true}); const out=[];
    if(wb && wb.files){ for(const file of wb.files){ if(/\.(png|jpe?g|gif|bmp|tiff)$/i.test(file.name||'')){ const bytes=file.content||file.data; if(!bytes) continue; let bin=''; const u8=new Uint8Array(bytes); for(let i=0;i<u8.length;i++) bin+=String.fromCharCode(u8[i]); const ext=(file.name.split('.').pop()||'png').toLowerCase(); const mime='image/'+(ext==='jpg'?'jpeg':ext); out.push({name:file.name, dataUrl:`data:${mime};base64,${btoa(bin)}`}); } } }
    return out; }catch(e){ return []; }
}
async function tryLoadImage(path){ try{ const blob = await fetchWithFallback(path, false); return URL.createObjectURL(blob); } catch(e){ return null; } }
function drawSmartPLSReplica(containerId, variant){
  const el=document.getElementById(containerId); if(!el) return;
  const BG='#ffffff', YELLOW='#FFF200', BLACK='#000000', BLUE='#2E75B6';
  const ORANGE_QE='#F5B041', ORANGE_LINE='#E67E22', WHITE='#ffffff', GREY_TEXT='#333333';
  const constructs={ PR:{x:0.095,y:0.55,label:'پیش‌نیازهای کارآفرینی',short:'PR',r2:0.2883,size:64}, DT:{x:0.500,y:0.855,label:'تحول دیجیتال',short:'DT',r2:0.2775,size:64}, SUS:{x:0.905,y:0.55,label:'پایداری کارآفرینی',short:'SUS',r2:0.4892,size:64}, HG:{x:0.500,y:0.145,label:'جغرافیای انسانی',short:'HG',r2:null,size:64}, QE:{x:0.170,y:0.275,label:'QE',short:'QE',r2:null,size:34} };
  const indicators=[];
  for(let i=0;i<11;i++) indicators.push({id:`Q${i+1}`,x:0.030,y:0.895-i*0.070,parent:'PR'});
  for(let i=0;i<9;i++) indicators.push({id:`Q${12+i}`,x:0.275+i*0.0575,y:0.975,parent:'DT'});
  for(let i=0;i<10;i++) indicators.push({id:`Q${21+i}`,x:0.970,y:0.895-i*0.076,parent:'SUS'});
  for(let i=0;i<16;i++) indicators.push({id:`Q${31+i}`,x:0.145+i*0.051,y:0.022,parent:'HG'});
  const paths=[{from:'HG',to:'PR',beta:0.542,t:11.37,midOff:{x:-0.045,y:0.015}},{from:'HG',to:'DT',beta:0.274,t:4.21,midOff:{x:-0.030,y:-0.035}},{from:'HG',to:'SUS',beta:0.210,t:3.52,midOff:{x:0.040,y:0.040}},{from:'PR',to:'DT',beta:0.262,t:3.92,midOff:{x:-0.045,y:0.010}},{from:'PR',to:'SUS',beta:0.230,t:4.34,midOff:{x:-0.020,y:0.045}},{from:'DT',to:'SUS',beta:0.374,t:7.21,midOff:{x:0.020,y:0.015}}];
  const qePaths=[{from:'QE',to:'PR',beta:0.032},{from:'QE',to:'DT',beta:-0.105},{from:'QE',to:'SUS',beta:0.026}];
  const traces=[]; const annotations=[];
  indicators.forEach(ind=>{ const p=constructs[ind.parent]; if(!p) return; const dx=p.x-ind.x, dy=p.y-ind.y, len=Math.sqrt(dx*dx+dy*dy)||1; const ux=dx/len, uy=dy/len; annotations.push({x:p.x-ux*0.048,y:p.y-uy*0.048,ax:ind.x+ux*0.030,ay:ind.y+uy*0.020,xref:'x',yref:'y',axref:'x',ayref:'y',showarrow:true,arrowhead:2,arrowsize:0.75,arrowwidth:0.9,arrowcolor:BLACK,text:''}); });
  paths.forEach(p=>{ const a=constructs[p.from], b=constructs[p.to]; const dx=b.x-a.x, dy=b.y-a.y, len=Math.sqrt(dx*dx+dy*dy)||1; const ux=dx/len, uy=dy/len; const startX=a.x+ux*0.046, startY=a.y+uy*0.046; const endX=b.x-ux*0.046, endY=b.y-uy*0.046;
    annotations.push({x:endX,y:endY,ax:startX,ay:startY,xref:'x',yref:'y',axref:'x',ayref:'y',showarrow:true,arrowhead:3,arrowsize:1.35,arrowwidth:2.4,arrowcolor:BLACK,text:''});
    if(variant !== 'measurement'){ const midX=(startX+endX)/2 + (p.midOff?.x||0); const midY=(startY+endY)/2 + (p.midOff?.y||0); const txt=(variant==='bootstrap') ? `t = ${p.t.toFixed(2)}` : p.beta.toFixed(3); annotations.push({x:midX,y:midY,xref:'x',yref:'y',showarrow:false,text:txt,bgcolor:WHITE,bordercolor:BLACK,borderwidth:1,borderpad:3,font:{size:11.5,color:BLACK,family:'Arial, sans-serif'},align:'center'}); } });
  qePaths.forEach(p=>{ const a=constructs[p.from], b=constructs[p.to]; const dx=b.x-a.x, dy=b.y-a.y, len=Math.sqrt(dx*dx+dy*dy)||1; const ux=dx/len, uy=dy/len; annotations.push({x:b.x-ux*0.048,y:b.y-uy*0.048,ax:a.x+ux*0.030,ay:a.y+uy*0.030,xref:'x',yref:'y',axref:'x',ayref:'y',showarrow:true,arrowhead:3,arrowsize:1.1,arrowwidth:1.6,arrowcolor:ORANGE_LINE,text:''}); });
  indicators.forEach(ind=>{ annotations.push({x:ind.x,y:ind.y,xref:'x',yref:'y',showarrow:false,text:ind.id,bgcolor:YELLOW,bordercolor:BLACK,borderwidth:1,borderpad:3,font:{size:10,color:BLACK,family:'Arial Black, Arial, sans-serif'},align:'center'}); });
  const cKeys=Object.keys(constructs);
  traces.push({type:'scatter',x:cKeys.map(k=>constructs[k].x),y:cKeys.map(k=>constructs[k].y),mode:'markers',marker:{size:cKeys.map(k=>constructs[k].size),color:cKeys.map(k=>constructs[k].short==='QE'?ORANGE_QE:BLUE),line:{color:BLACK,width:1.8}},hoverinfo:'skip',showlegend:false});
  cKeys.forEach(k=>{ const c=constructs[k];
    if(k==='QE'){ annotations.push({x:c.x,y:c.y,xref:'x',yref:'y',showarrow:false,text:'QE',font:{size:12,color:BLACK,family:'Arial Black'},align:'center'}); return; }
    annotations.push({x:c.x,y:c.y,xref:'x',yref:'y',showarrow:false,text:c.short,font:{size:13,color:WHITE,family:'Arial Black'},align:'center'});
    const offY = (k==='DT'||k==='HG') ? 0.065 : -0.055;
    annotations.push({x:c.x,y:c.y+offY,xref:'x',yref:'y',showarrow:false,text:c.label,font:{size:11,color:BLACK,family:'Tahoma, Vazirmatn, sans-serif'},align:'center'});
    if(c.r2 !== null){ const r2OffY = (k==='DT'||k==='HG') ? 0.098 : -0.088; annotations.push({x:c.x,y:c.y+r2OffY,xref:'x',yref:'y',showarrow:false,text:`R² = ${c.r2.toFixed(3)}`,font:{size:10,color:GREY_TEXT,family:'Tahoma, sans-serif'},align:'center'}); }
  });
  Plotly.newPlot(el, traces, {paper_bgcolor:BG,plot_bgcolor:BG,font:{family:'Arial, Tahoma, Vazirmatn, sans-serif',color:BLACK},margin:{l:8,r:8,b:8,t:8},height:670,showlegend:false,xaxis:{showgrid:false,zeroline:false,showticklabels:false,range:[0,1],fixedrange:true},yaxis:{showgrid:false,zeroline:false,showticklabels:false,range:[0,1],fixedrange:true},annotations:annotations,hovermode:false}, Object.assign({}, PLOTLY_CFG, {displayModeBar:false}));
}
async function renderSmartPLSGraphics(){
  const variants=['measurement','structural','bootstrap'];
  const targets=['smartpls-graphic-1','smartpls-graphic-2','smartpls-graphic-3'];
  const imageFiles=['SmartPLS_Graphical_1.png','SmartPLS_Graphical_2.png','SmartPLS_Graphical_3.png'];
  let excelImages=[];
  try{ excelImages=await extractImagesFromExcel('PLS Algorithm.xlsx'); }catch(e){}
  if(excelImages.length===0){ try{ excelImages=await extractImagesFromExcel('PLS Predict.xlsx'); }catch(e){} }
  for(let i=0;i<3;i++){
    const target=targets[i]; const el=document.getElementById(target); if(!el) continue;
    if(excelImages[i]){ el.innerHTML=`<div class="smartpls-img-wrap"><img src="${excelImages[i].dataUrl}" alt="SmartPLS Graphic ${i+1}" class="smartpls-img"><div class="smartpls-badge smartpls-badge-ok">${t('smartpls_found_in_excel')}</div></div>`; continue; }
    const url=await tryLoadImage(imageFiles[i]);
    if(url){ el.innerHTML=`<div class="smartpls-img-wrap"><img src="${url}" alt="SmartPLS Graphic ${i+1}" class="smartpls-img"><div class="smartpls-badge smartpls-badge-ok">${t('smartpls_found_in_excel')}</div></div>`; continue; }
    drawSmartPLSReplica(target, variants[i]);
    const badge=document.createElement('div'); badge.className='smartpls-badge smartpls-badge-warn'; badge.textContent=t('smartpls_recreated'); el.appendChild(badge);
  }
}
/* ================================================================
   LAYER 1 CHARTS (PLS Algorithm)
   ================================================================ */
function drawL1PathDiagram(){
  const pos = { PR:[0.08,0.50], DT:[0.50,0.88], SUS:[0.95,0.50], HG:[0.50,0.10], QE:[0.10,0.18] };
  const labels = {PR:'پیش‌نیازهای کارآفرینی', DT:'تحول دیجیتال', SUS:'پایداری کارآفرینی', HG:'جغرافیای انسانی', QE:'QE'};
  const labelsEN = {PR:'Prerequisites', DT:'Digital Transformation', SUS:'Sustainability', HG:'Human Geography', QE:'QE'};
  const L = state.lang === 'fa' ? labels : labelsEN;
  const colors = {PR:'#2980b9', DT:'#9b59b6', SUS:'#2ecc71', HG:'#3498db', QE:'#f39c12'};
  const get = (p, def) => {
    let f = state.loaded.paths.find(x => x.Path === p);
    if(!f && typeof normalizePathKey === 'function'){ const k = normalizePathKey(p); f = state.loaded.paths.find(x => normalizePathKey(x.Path) === k); }
    return f ? f.Original : def;
  };
  const mainEdges = [
    { s:'PR', d:'DT',  c: get('PR→DT', 0.262),  color: '#2c3e50', dash: 'solid', curve: 0,     width: 2.5 },
    { s:'PR', d:'SUS', c: get('PR→SUS', 0.230), color: '#2c3e50', dash: 'solid', curve: 0.08,  width: 2.5 },
    { s:'DT', d:'SUS', c: get('DT→SUS', 0.374), color: '#2c3e50', dash: 'solid', curve: 0,     width: 2.5 },
    { s:'HG', d:'PR',  c: get('HG→PR', 0.542),  color: '#2c3e50', dash: 'solid', curve: 0,     width: 2.5 },
    { s:'HG', d:'DT',  c: get('HG→DT', 0.274),  color: '#2c3e50', dash: 'solid', curve: -0.08, width: 2.5 },
    { s:'HG', d:'SUS', c: get('HG→SUS', 0.210), color: '#2c3e50', dash: 'solid', curve: 0,     width: 2.5 }
  ];
  const qeEdges = [
    { s:'QE', d:'PR',  c: get('QE→PR', 0.032),  color: '#e74c3c', dash: 'dot', curve: 0, width: 1.5 },
    { s:'QE', d:'DT',  c: get('QE→DT', -0.105), color: '#e74c3c', dash: 'dot', curve: 0, width: 1.5 },
    { s:'QE', d:'SUS', c: get('QE→SUS', 0.026), color: '#e74c3c', dash: 'dot', curve: 0, width: 1.5 }
  ];
  const traces = []; const annotations = [];
  const NODE_RADIUS = 0.055; const QE_RADIUS = 0.048;
  const ARROW_LENGTH = 0.028; const ARROW_WIDTH = 0.018;
  function drawArrowhead(tipX, tipY, dirX, dirY, color) {
    const perpX = -dirY, perpY = dirX;
    const baseX = tipX - dirX * ARROW_LENGTH; const baseY = tipY - dirY * ARROW_LENGTH;
    const corner1X = baseX + perpX * ARROW_WIDTH; const corner1Y = baseY + perpY * ARROW_WIDTH;
    const corner2X = baseX - perpX * ARROW_WIDTH; const corner2Y = baseY - perpY * ARROW_WIDTH;
    traces.push({type:'scatter', mode:'lines', x:[tipX,corner1X,corner2X,tipX], y:[tipY,corner1Y,corner2Y,tipY], fill:'toself', fillcolor:color, line:{color:color,width:0.5}, hoverinfo:'skip', showlegend:false});
  }
  function processEdge(e, isQE) {
    const p1 = pos[e.s], p2 = pos[e.d]; if(!p1 || !p2) return;
    const srcRadius = isQE ? QE_RADIUS : NODE_RADIUS; const dstRadius = NODE_RADIUS;
    const dx = p2[0]-p1[0], dy = p2[1]-p1[1]; const len = Math.sqrt(dx*dx+dy*dy);
    const perpX = -dy/len, perpY = dx/len;
    const ctrlX = (p1[0]+p2[0])/2 + perpX*e.curve; const ctrlY = (p1[1]+p2[1])/2 + perpY*e.curve;
    const N = 80; const allX=[], allY=[];
    for(let i=0;i<N;i++){ const t=i/(N-1); allX.push((1-t)*(1-t)*p1[0]+2*(1-t)*t*ctrlX+t*t*p2[0]); allY.push((1-t)*(1-t)*p1[1]+2*(1-t)*t*ctrlY+t*t*p2[1]); }
    let startIdx=0; for(let i=0;i<N;i++){ if(Math.hypot(allX[i]-p1[0],allY[i]-p1[1])>srcRadius){ startIdx=i; break; } }
    let endIdx=N-1; for(let i=N-1;i>=0;i--){ if(Math.hypot(allX[i]-p2[0],allY[i]-p2[1])>(dstRadius+ARROW_LENGTH)){ endIdx=i; break; } }
    if(endIdx<=startIdx) return;
    const lineX = allX.slice(startIdx,endIdx+1); const lineY = allY.slice(startIdx,endIdx+1);
    traces.push({type:'scatter', mode:'lines', x:lineX, y:lineY, line:{color:e.color, width:e.width, dash:e.dash, shape:'spline'}, hoverinfo:'skip', showlegend:false});
    const lastIdx = lineX.length-1;
    const tdx = lineX[lastIdx]-lineX[lastIdx-2]; const tdy = lineY[lastIdx]-lineY[lastIdx-2];
    const tlen = Math.sqrt(tdx*tdx+tdy*tdy); const ux = tdx/tlen, uy = tdy/tlen;
    const tipX = p2[0]-ux*dstRadius; const tipY = p2[1]-uy*dstRadius;
    drawArrowhead(tipX, tipY, ux, uy, e.color);
    let midIdx = Math.floor(lineX.length/2);
    if (e.s==='PR' && e.d==='SUS') midIdx = Math.floor(lineX.length*0.6);
    if (e.s==='HG' && e.d==='DT')  midIdx = Math.floor(lineX.length*0.4);
    const betaText = e.c<0 ? `−${Math.abs(e.c).toFixed(3)}` : e.c.toFixed(3);
    annotations.push({x:lineX[midIdx], y:lineY[midIdx], xref:'x', yref:'y', showarrow:false, text:`<b>${betaText}</b>`, bgcolor:'rgba(255,255,255,0.95)', bordercolor:e.color, borderwidth:1, borderpad:4, font:{size:isQE?10:11, color:isQE?'#c0392b':'#000', family:'Tahoma, Vazirmatn'}});
  }
  qeEdges.forEach(e => processEdge(e, true));
  mainEdges.forEach(e => processEdge(e, false));
  Object.entries(pos).forEach(([n, [px, py]]) => {
    const isQE = (n === 'QE');
    const nodeSize = isQE ? 55 : 60;
    traces.push({type:'scatter', x:[px], y:[py], mode:'markers+text', marker:{size:nodeSize, color:colors[n], line:{color:'#fff', width:isQE?2:2.5}, symbol:'circle'}, text:[isQE?'QE':L[n]], textposition:'middle center', textfont:{size:isQE?11:8.5, color:'#fff', family:'Vazirmatn, Tahoma', weight:'bold'}, hovertext:[`<b>${L[n]}</b>`], hoverinfo:'text', showlegend:false});
  });
  Plotly.newPlot('chart-l1-path', traces, plotlyLayout({ xaxis:{showgrid:false,zeroline:false,showticklabels:false,range:[-0.05,1.05],fixedrange:true}, yaxis:{showgrid:false,zeroline:false,showticklabels:false,range:[-0.05,1.05],fixedrange:true}, annotations:annotations, height:620, showlegend:false, hovermode:'closest', margin:{l:20,r:20,t:20,b:20} }), PLOTLY_CFG);
}
function drawL1BetaBar(){
  const paths=state.loaded.paths;
  const sorted=[...paths].sort((a,b)=>a.Original-b.Original);
  const markers=sorted.map(p=>{ const sig=(p.CI_low>0)||(p.CI_high<0); return sig?'#2ca02c':'#7f8c8d'; });
  Plotly.newPlot('chart-l1-beta-bar',[{type:'bar',orientation:'h',y:sorted.map(p=>p.Path),x:sorted.map(p=>p.Original),marker:{color:markers,line:{color:'#000',width:0.6}},text:sorted.map(p=>p.Original.toFixed(3)),textposition:'outside',textfont:{size:10},customdata:sorted.map(p=>[p.Path,p.Original,p.T,p.P]),hovertemplate:HT.template(`<b>%{customdata[0]}</b><br>β = <b>%{customdata[1]:.3f}</b><br>T = %{customdata[2]:.2f}<br>p = %{customdata[3]:.2e}`)}],plotlyLayout({xaxis:{title:t('col_beta'),gridcolor:themeColors().grid},yaxis:{title:'',tickfont:{size:11}},height:400,margin:{l:130,r:40,t:30,b:50}}),PLOTLY_CFG);
}
function drawL1R2(){
  const r2=state.loaded.r2;
  const constructs=r2.map(r=>r.Construct);
  const Z=[[...r2.map(r=>r.R2)],[...r2.map(r=>r.R2_Adj)]];
  const metrics=['R²','R² Adj'];
  Plotly.newPlot('chart-l1-r2',[{type:'surface',x:constructs,y:metrics,z:Z,colorscale:'RdYlGn',cmin:0,cmax:0.6,colorbar:{title:'R²',thickness:15,x:1.02,tickfont:{color:themeColors().text}},text:Z.map((row,j)=>row.map((v,i)=>`سازه: ${constructs[i]}<br>${metrics[j]} = ${v.toFixed(4)}`)),hovertemplate:HT.template('%{text}')}],plotlyLayout({height:600,scene:{xaxis:{title:t('col_indicator'),gridcolor:themeColors().grid},yaxis:{title:'',gridcolor:themeColors().grid},zaxis:{title:'R²',range:[0,0.6],gridcolor:themeColors().grid},camera:{eye:{x:1.6,y:-1.6,z:1.0}}}}),PLOTLY_CFG);
}
function drawL1F2(){
  const f2=state.loaded.f2;
  const vals=f2.map(x=>x.f2), names=f2.map(x=>x.Path);
  Plotly.newPlot('chart-l1-f2',[{type:'bar',x:names,y:vals,marker:{color:vals,colorscale:[[0,'#d62728'],[0.35,'#ff7f0e'],[1,'#2ca02c']],cmin:0,cmax:Math.max(...vals),line:{color:'#000',width:0.6},colorbar:{title:'f²',thickness:15}},text:vals.map(v=>v.toFixed(3)),textposition:'outside',textfont:{size:9},customdata:names.map((p,i)=>[p,vals[i],vals[i]>=0.35?'قوی':vals[i]>=0.15?'متوسط':vals[i]>=0.02?'ضعیف':'ناچیز']),hovertemplate:HT.template(`<b>%{customdata[0]}</b><br>f² = <b>%{customdata[1]:.4f}</b><br>اندازه اثر: %{customdata[2]}`)}],plotlyLayout({height:520,xaxis:{title:'',tickangle:-40,gridcolor:themeColors().grid},yaxis:{title:'f²',gridcolor:themeColors().grid},margin:{l:60,r:40,t:30,b:150}}),PLOTLY_CFG);
}
function drawL1Quality(){
  const q=state.loaded.quality;
  const constructs=Object.keys(q);
  const metrics=['Cronbach','rho_a','rho_c','AVE'];
  const metricLabels=['آلفای کرونباخ','rho_a','rho_c','AVE'];
  const n_c=constructs.length,n_m=metrics.length;
  const Z=[];
  for(let j=0;j<n_m;j++){ const row=[]; for(let i=0;i<n_c;i++)row.push(q[constructs[i]][metrics[j]]); Z.push(row); }
  const thresholds={Cronbach:0.7,rho_a:0.7,rho_c:0.7,AVE:0.5};
  Plotly.newPlot('chart-l1-quality',[{type:'surface',x:constructs,y:metricLabels,z:Z,colorscale:'Viridis',cmin:0.5,cmax:1.0,colorbar:{title:'',thickness:15,x:1.02,tickfont:{color:themeColors().text}},text:Z.map((row,j)=>row.map((v,i)=>{const m=metrics[j],th=thresholds[m];return `سازه: ${constructs[i]}<br>${metricLabels[j]} = ${v.toFixed(4)}<br>${v>=th?'✅ بالای آستانه':'⚠ زیر آستانه'}`;})),hovertemplate:HT.template('%{text}')}],plotlyLayout({height:600,scene:{xaxis:{title:'سازه',gridcolor:themeColors().grid},yaxis:{title:'شاخص',gridcolor:themeColors().grid},zaxis:{title:'مقدار',range:[0.4,1.05],gridcolor:themeColors().grid},camera:{eye:{x:1.6,y:-1.6,z:1.0}}}}),PLOTLY_CFG);
}
function drawL1Loadings(){
  const L=state.loaded.loadings;
  const constructs=Object.keys(L);
  const maxInd=Math.max(...constructs.map(c=>Object.keys(L[c]).length));
  const Z=[];
  for(const c of constructs){ const qs=Object.keys(L[c]).sort(); const row=[]; for(let i=0;i<maxInd;i++)row.push(i<qs.length?L[c][qs[i]]:null); Z.push(row); }
  const qLabels=Array.from({length:maxInd},(_,i)=>`Q${i+1}`);
  Plotly.newPlot('chart-l1-loadings',[{type:'surface',x:qLabels,y:constructs,z:Z,colorscale:'RdYlGn',cmin:0.6,cmax:1.0,colorbar:{title:'بار',thickness:15,x:1.02,tickfont:{color:themeColors().text}},text:Z.map((row,i)=>row.map((v,j)=>{if(v==null)return '';const qs=Object.keys(L[constructs[i]]).sort();return `سازه: ${constructs[i]}<br>شاخص: ${qs[j]}<br>بار = ${v.toFixed(3)}<br>${v>=0.7?'✅':'⚠'}`;})),hovertemplate:HT.template('%{text}')}],plotlyLayout({height:600,scene:{xaxis:{title:'شاخص',gridcolor:themeColors().grid},yaxis:{title:'سازه',gridcolor:themeColors().grid},zaxis:{title:'بار عاملی',range:[0.6,1.0],gridcolor:themeColors().grid},camera:{eye:{x:1.6,y:-1.6,z:1.0}}}}),PLOTLY_CFG);
}
function drawL1VIF(){
  const el=document.getElementById('chart-l1-vif'); if(!el) return;
  const V=state.loaded.vif||FALLBACK_VIF;
  const constructs=Object.keys(V);
  const maxInd=Math.max(...constructs.map(c=>Object.keys(V[c]).length));
  const Z=[];
  for(const c of constructs){ const qs=Object.keys(V[c]).sort((a,b)=>{const na=parseInt(a.replace(/\D/g,''))||0;const nb=parseInt(b.replace(/\D/g,''))||0;return na-nb;}); const row=[]; for(let i=0;i<maxInd;i++) row.push(i<qs.length?V[c][qs[i]]:null); Z.push(row); }
  const qLabels=Array.from({length:maxInd},(_,i)=>`Q${i+1}`);
  Plotly.newPlot('chart-l1-vif',[{type:'surface',x:qLabels,y:constructs,z:Z,colorscale:[[0,'#2ca02c'],[0.5,'#ffd700'],[1,'#d62728']],cmin:1,cmax:5,colorbar:{title:'VIF',thickness:15,x:1.02,tickfont:{color:themeColors().text}},text:Z.map((row,i)=>row.map((v,j)=>{if(v==null)return '';const qs=Object.keys(V[constructs[i]]).sort();let status='✅ عالی';if(v>=5) status='❌ بحرانی';else if(v>=3.3) status='⚠ قابل قبول';else if(v>=3) status='✅ خوب';return `سازه: ${constructs[i]}<br>شاخص: ${qs[j]}<br>VIF = ${v.toFixed(3)}<br>${status}`;})),hovertemplate:HT.template('%{text}')}],plotlyLayout({height:600,scene:{xaxis:{title:'شاخص',gridcolor:themeColors().grid},yaxis:{title:'سازه',gridcolor:themeColors().grid},zaxis:{title:'VIF',range:[1,5],gridcolor:themeColors().grid},camera:{eye:{x:1.6,y:-1.6,z:1.0}}}}),PLOTLY_CFG);
}
function drawL1HTMT(){
  const h=state.loaded.htmt;
  const labels=h.labels,n=labels.length;
  const mat=Array.from({length:n},()=>Array(n).fill(null));
  Object.entries(h.data).forEach(([key,v])=>{const [i,j]=key.split('-').map(Number);mat[i][j]=v;mat[j][i]=v;});
  const z=mat.map((row,i)=>row.map((v,j)=>j>=i?v:null));
  const txt=z.map(row=>row.map(v=>v!=null?v.toFixed(3):''));
  Plotly.newPlot('chart-l1-htmt',[{type:'heatmap',z:z,x:labels,y:labels,colorscale:'RdYlGn_r',zmin:0,zmax:1,text:txt,texttemplate:'%{text}',textfont:{size:11,color:'#000',family:'Tahoma'},hovertemplate:HT.template('HTMT(%{y},%{x}) = <b>%{z:.3f}</b>'),colorbar:{title:'HTMT',thickness:15,tickfont:{color:themeColors().text}}}],plotlyLayout({height:600,xaxis:{side:'top',gridcolor:themeColors().grid},yaxis:{autorange:'reversed',gridcolor:themeColors().grid},margin:{l:80,r:40,t:80,b:50}}),PLOTLY_CFG);
}
function drawL1Slopes(){
  const x=Array.from({length:100},(_,i)=>-2+4*i/99);
  const get=(p,def)=>{ let f=state.loaded.paths.find(y=>y.Path===p); if(!f && typeof normalizePathKey==='function'){ const k=normalizePathKey(p); f=state.loaded.paths.find(y=>normalizePathKey(y.Path)===k); } return f?f.Original:def; };
  const b1=get('HG→DT',0.274),b2=get('PR→DT',0.262),b3=get('HG×PR→DT',0.256);
  const b4=get('HG→SUS',0.210),b5=get('DT→SUS',0.374),b6=get('HG×DT→SUS',0.177);
  const styles=[['کم (-1SD)',-1,'#e74c3c','dash'],['متوسط',0,'#7f8c8d','solid'],['زیاد (+1SD)',1,'#27ae60','dashdot']];
  const traces=[];
  styles.forEach(([lb,v,c,ls])=>{ traces.push({type:'scatter',x:x,y:x.map(xv=>b1*xv+b2*v+b3*xv*v),mode:'lines',name:lb,legendgroup:lb,line:{color:c,width:2.5,dash:ls},hovertemplate:HT.template(`PR=${v>=0?'+':''}${v}<br>HG=%{x:.2f}<br>DT=%{y:.3f}`),xaxis:'x',yaxis:'y'}); });
  styles.forEach(([lb,v,c,ls])=>{ traces.push({type:'scatter',x:x,y:x.map(xv=>b4*xv+b5*v+b6*xv*v),mode:'lines',name:lb,legendgroup:lb,showlegend:false,line:{color:c,width:2.5,dash:ls},hovertemplate:HT.template(`DT=${v>=0?'+':''}${v}<br>HG=%{x:.2f}<br>SUS=%{y:.3f}`),xaxis:'x2',yaxis:'y2'}); });
  Plotly.newPlot('chart-l1-slopes',traces,plotlyLayout({height:520, grid:{rows:1,columns:2,pattern:'independent'},xaxis:{title:'HG',gridcolor:themeColors().grid}, yaxis:{title:'DT',gridcolor:themeColors().grid},xaxis2:{title:'HG',gridcolor:themeColors().grid}, yaxis2:{title:'SUS',gridcolor:themeColors().grid},annotations:[{text:'HG × PR → DT',x:0.22,y:1.08,xref:'paper',yref:'paper',showarrow:false,font:{size:12}},{text:'HG × DT → SUS',x:0.78,y:1.08,xref:'paper',yref:'paper',showarrow:false,font:{size:12}}],legend:{x:0,y:1.15,orientation:'h',font:{color:themeColors().text}}}),PLOTLY_CFG);
}
function drawL1Raincloud(){
  const latent=state.loaded.latent;
  const nameMap={DT:'تحول دیجیتال',SUS:'پایداری کارآفرینی',PR:'پیش‌نیازها'};
  const nameMapEN={DT:'DT',SUS:'SUS',PR:'PR'};
  const colors={DT:'#9b59b6',SUS:'#2ecc71',PR:'#e67e22'};
  const traces=[];
  Object.entries(latent).forEach(([con,vals])=>{ const nm=state.lang==='fa'?nameMap[con]:nameMapEN[con]; traces.push({type:'violin',y:vals,name:nm,line:{color:colors[con]},fillcolor:colors[con],opacity:0.45,box:{visible:true},meanline:{visible:true},points:'all',pointpos:0,jitter:0.3,marker:{size:3.5,color:colors[con],opacity:0.4},hovertemplate:HT.template(`<b>${nm}</b><br>score = %{y:.3f}`)}); });
  Plotly.newPlot('chart-l1-raincloud',traces,plotlyLayout({height:520,yaxis:{title:'امتیاز استاندارد',gridcolor:themeColors().grid},xaxis:{title:'',gridcolor:themeColors().grid},showlegend:false}),PLOTLY_CFG);
}

/* ================================================================
   LAYER 2 CHARTS (Bootstrapping)
   ================================================================ */
function drawL2Forest(){
  const paths=[...state.loaded.paths].sort((a,b)=>a.Original-b.Original);
  const y=paths.map(p=>p.Path), x=paths.map(p=>p.Original);
  const errPlus=paths.map(p=>Math.max(0,p.CI_high-p.Original));
  const errMinus=paths.map(p=>Math.max(0,p.Original-p.CI_low));
  const sig=paths.map(p=>(p.CI_low>0)||(p.CI_high<0));
  const colors=sig.map(s=>s?'#c0392b':'#7f8c8d');
  const cd=paths.map((p,i)=>[p.Path,p.Original,p.CI_low,p.CI_high,p.STDEV,p.T,p.P,sig[i]?t('badge_sig'):t('badge_nosig')]);
  Plotly.newPlot('chart-l2-forest',[{type:'scatter',x:x,y:y,error_x:{type:'data',symmetric:false,array:errPlus,arrayminus:errMinus,color:'#2c3e50',thickness:2.2,width:7},mode:'markers', marker:{size:15,color:'#fff',line:{color:colors,width:3}},customdata:cd,hovertemplate:HT.template(`<b>%{customdata[0]}</b><br>──────────<br>β = <b>%{customdata[1]:.3f}</b><br>CI 95%% = [%{customdata[2]:.3f} , %{customdata[3]:.3f}]<br>SE = %{customdata[4]:.3f}<br>t = %{customdata[5]:.2f}<br>p = %{customdata[6]:.2e}<br>%{customdata[7]}`),showlegend:false}],plotlyLayout({height:560,xaxis:{title:'β',gridcolor:themeColors().grid},yaxis:{title:'',tickfont:{size:11},gridcolor:themeColors().grid},shapes:[{type:'line',x0:0,x1:0,y0:-0.5,y1:y.length-0.5,line:{color:'red',dash:'dash',width:1.5}}],margin:{l:140,r:40,t:30,b:50}}),PLOTLY_CFG);
}
function drawL2Sig(){
  const paths=state.loaded.paths;
  const coefs=paths.map(p=>p.Original), tVals=paths.map(p=>Number(p.T)), pVals=paths.map(p=>Number(p.P));
  const valid=coefs.map((c,i)=>!isNaN(c) && !isNaN(tVals[i]) && !isNaN(pVals[i]));
  if(!valid.some(v=>v)){ const el=document.getElementById('chart-l2-sig'); if(el) el.innerHTML='<div style="text-align:center;padding:60px;color:#888;">داده‌های T/P در فایل Excel یافت نشد.</div>'; return; }
  const idxValid=valid.map((v,i)=>v?i:-1).filter(i=>i>=0);
  const x=idxValid.map(i=>coefs[i]), y=idxValid.map(i=>tVals[i]), z=idxValid.map(i=>-Math.log10(pVals[i]+1e-10));
  const colors=idxValid.map(i=>pVals[i]<0.05?'#2ca02c':'#d62728');
  const sig=idxValid.map(i=>pVals[i]<0.05);
  const cd=idxValid.map((i,k)=>[paths[i].Path,coefs[i],tVals[i],pVals[i],-Math.log10(pVals[i]+1e-10),sig[k]?t('badge_sig'):t('badge_nosig')]);
  const xRange=[Math.min(...x)-0.1,Math.max(...x)+0.1];
  const yRange=[0,Math.max(...y)*1.15];
  const zRange=[0,Math.max(...z)*1.15];
  Plotly.newPlot('chart-l2-sig',[{type:'scatter3d',x:x,y:y,z:z,mode:'markers',marker:{size:sig.map(s=>s?11:8),color:colors,line:{color:'#000',width:1.5},symbol:sig.map(s=>s?'circle':'x')},customdata:cd,hovertemplate:HT.template(`<b>%{customdata[0]}</b><br>──────────<br>β = <b>%{customdata[1]:.3f}</b><br>T = %{customdata[2]:.2f}<br>p = %{customdata[3]:.4f}<br>%{customdata[5]}`),showlegend:false}],plotlyLayout({height:620,scene:{xaxis:{title:'β',range:xRange,gridcolor:themeColors().grid},yaxis:{title:'T',range:yRange,gridcolor:themeColors().grid},zaxis:{title:'−log10(p)',range:zRange,gridcolor:themeColors().grid},camera:{eye:{x:1.7,y:1.5,z:1.0}},aspectmode:'cube'}}),PLOTLY_CFG);
}
function drawL2Landscape(){
  const paths=state.loaded.paths;
  const coefs=paths.map(p=>p.Original), tVals=paths.map(p=>p.T), names=paths.map(p=>p.Path);
  Plotly.newPlot('chart-l2-landscape',[{type:'bar',x:names,y:coefs,marker:{color:tVals,colorscale:'RdYlGn',cmin:Math.min(...tVals),cmax:Math.max(...tVals),line:{color:'#000',width:0.6},colorbar:{title:'T',thickness:15,tickfont:{color:themeColors().text}}},text:coefs.map((c,i)=>`${c.toFixed(3)}<br>T=${tVals[i].toFixed(1)}`),textposition:'outside',textfont:{size:9},customdata:paths.map(p=>[p.Path,p.Original,p.T,p.P]),hovertemplate:HT.template(`<b>%{customdata[0]}</b><br>β = <b>%{customdata[1]:.3f}</b><br>T = %{customdata[2]:.2f}<br>p = %{customdata[3]:.2e}`)}],plotlyLayout({height:520,xaxis:{title:'',tickangle:-40,gridcolor:themeColors().grid},yaxis:{title:'β',gridcolor:themeColors().grid},margin:{l:60,r:40,t:30,b:150}}),PLOTLY_CFG);
}

/* ================================================================
   LAYER 3 CHARTS (PLS Predict)
   ================================================================ */
function activeIndices(){return [...state.selected].sort((a,b)=>a-b);}
function drawL3Q2Columns(targetId){
  const idx=activeIndices();
  const xs=[],ys=[],zs=[];
  idx.forEach(i=>{xs.push(i,i,null);ys.push(0,0,null);zs.push(0,DATA.Q2[i],null);});
  const colors=idx.map(i=>DATA.Q2[i]>0.10?'#2ca02c':(DATA.Q2[i]>0?'#ff7f0e':'#d62728'));
  const sizes=idx.map(i=>state.highlighted===i?16:8);
  const outlines=idx.map(i=>state.highlighted===i?'#ffd700':'#000');
  const traces=[{type:'scatter3d',x:xs,y:ys,z:zs,mode:'lines',line:{color:'#7f8c9c',width:9},hoverinfo:'skip',showlegend:false},{type:'scatter3d',x:idx,y:idx.map(()=>0),z:idx.map(i=>DATA.Q2[i]),mode:'markers',marker:{size:sizes,color:colors,line:{color:outlines,width:1.2}},customdata:idx.map(i=>[DATA.indicators[i],DATA.Q2[i]]),hovertemplate:HT.template(`<b>${t('col_indicator')}: %{customdata[0]}</b><br>Q² = <b>%{customdata[1]:.4f}</b>`),showlegend:false}];
  const n=DATA.indicators.length;
  traces.push({type:'surface',x:[[-1,n],[-1,n]],y:[[-1,-1],[1,1]],z:[[0.10,0.10],[0.10,0.10]],colorscale:[[0,'rgba(44,160,44,0.20)'],[1,'rgba(44,160,44,0.20)']],showscale:false,hoverinfo:'skip',showlegend:false});
  Plotly.newPlot(targetId,traces,plotlyLayout({margin:{l:0,r:0,b:0,t:30},height:600,scene:{xaxis:{title:'',tickmode:'array',tickvals:idx.filter(i=>i%2===0),ticktext:idx.filter(i=>i%2===0).map(i=>DATA.indicators[i]),tickfont:{size:10},gridcolor:themeColors().grid},yaxis:{showticklabels:false,range:[-1,1],gridcolor:themeColors().grid},zaxis:{title:'Q²predict',range:[0,Math.max(...DATA.Q2)*1.2],gridcolor:themeColors().grid},camera:{eye:{x:1.7,y:-1.6,z:0.9}}}}),PLOTLY_CFG);
  $(targetId).on('plotly_click',d=>{ if(d.points[0].customdata)selectIndicator(d.points[0].customdata[0]); });
}
function drawL3Stems(){
  const idx=activeIndices();
  const methods=['PLS-SEM','LM','IA'];
  const rmse=[DATA.PLS_RMSE,DATA.LM_RMSE,DATA.IA_RMSE];
  const allVals=idx.flatMap(i=>[DATA.PLS_RMSE[i],DATA.LM_RMSE[i],DATA.IA_RMSE[i]]);
  const vmin=Math.min(...allVals),vmax=Math.max(...allVals);
  const xs=[],ys=[],zs=[];
  for(let j=0;j<3;j++) idx.forEach(i=>{xs.push(i,i,null);ys.push(j,j,null);zs.push(0,rmse[j][i],null);});
  const traces=[{type:'scatter3d',x:xs,y:ys,z:zs,mode:'lines',line:{color:'#7f8c9c',width:5},hoverinfo:'skip',showlegend:false}];
  for(let j=0;j<3;j++){ traces.push({type:'scatter3d',x:idx,y:idx.map(()=>j),z:idx.map(i=>rmse[j][i]),mode:'markers',name:methods[j],legendgroup:methods[j],marker:{size:6,color:idx.map(i=>plasmaRGB(rmse[j][i],vmin,vmax)),line:{color:'#000',width:1}},customdata:idx.map(i=>[DATA.indicators[i],methods[j],rmse[j][i]]),hovertemplate:HT.template(`<b>${t('col_indicator')}: %{customdata[0]}</b><br>${t('info_best')}: %{customdata[1]}<br>RMSE = <b>%{customdata[2]:.4f}</b>`)}); }
  Plotly.newPlot('chart-l3-stems',traces,plotlyLayout({margin:{l:0,r:0,b:0,t:30},height:600,showlegend:true,legend:{x:0,y:1,bgcolor:state.theme==='dark'?'rgba(30,36,51,0.9)':'rgba(255,255,255,0.9)',font:{color:themeColors().text}},scene:{xaxis:{title:'',tickmode:'array',tickvals:idx.filter(i=>i%2===0),ticktext:idx.filter(i=>i%2===0).map(i=>DATA.indicators[i]),tickfont:{size:10},gridcolor:themeColors().grid},yaxis:{title:'',tickmode:'array',tickvals:[0,1,2],ticktext:methods,gridcolor:themeColors().grid},zaxis:{title:'RMSE',range:[0,vmax*1.15],gridcolor:themeColors().grid},camera:{eye:{x:1.7,y:-1.6,z:0.9}}}}),PLOTLY_CFG);
  $('chart-l3-stems').on('plotly_click',d=>{ if(d.points[0].customdata)selectIndicator(d.points[0].customdata[0]); });
}
function drawL3Landscape(){
  const idx=activeIndices();
  if(idx.length<2){Plotly.purge('chart-l3-landscape');return;}
  const n=DATA.indicators.length;
  const rmse=[DATA.PLS_RMSE,DATA.LM_RMSE,DATA.IA_RMSE];
  const NX=100,NY=30;
  const xg=Array.from({length:NX},(_,k)=>k*(n-1)/(NX-1));
  const yg=Array.from({length:NY},(_,k)=>k*2/(NY-1));
  const Z=yg.map(y=>xg.map(x=>{ let s=0; for(const i of idx){ for(let j=0;j<3;j++){ const gx=Math.exp(-Math.pow(x-i,2)/(2*0.9*0.9)); const gy=Math.exp(-Math.pow(y-j,2)/(2*0.55*0.55)); s+=rmse[j][i]*gx*gy; } } return s; }));
  Plotly.newPlot('chart-l3-landscape',[{type:'surface',x:xg,y:yg,z:Z,colorscale:'Turbo',colorbar:{title:'RMSE',len:0.6,tickfont:{color:themeColors().text}},hovertemplate:HT.template(`شاخص ≈ %{x:.1f}<br>روش = %{y:.2f}<br>RMSE = <b>%{z:.4f}</b>`)}],plotlyLayout({margin:{l:0,r:0,b:0,t:30},height:600,scene:{xaxis:{title:'شاخص',gridcolor:themeColors().grid},yaxis:{title:'روش',gridcolor:themeColors().grid},zaxis:{title:'RMSE',gridcolor:themeColors().grid},camera:{eye:{x:1.5,y:-1.7,z:1.1}}}}),PLOTLY_CFG);
}
function drawL3Ridge(){
  const idx=activeIndices();
  const n=DATA.indicators.length;
  const NX=150,NY=22;
  const xg=Array.from({length:NX},(_,k)=>-0.5+k*n/(NX-1));
  const yg=Array.from({length:NY},(_,k)=>-0.6+k*1.2/(NY-1));
  const Z=yg.map(y=>xg.map(x=>{ let s=0; for(const i of idx){ const gx=Math.exp(-Math.pow(x-i,2)/(2*0.55*0.55)); const gy=Math.exp(-Math.pow(y,2)/(2*0.2*0.2)); s+=DATA.Q2[i]*gx*gy; } return s; }));
  const traces=[{type:'surface',x:xg,y:yg,z:Z,colorscale:'Viridis',colorbar:{title:'Q²',len:0.6,tickfont:{color:themeColors().text}},hovertemplate:HT.template(`شاخص ≈ %{x:.1f}<br>Q² = <b>%{z:.4f}</b>`)}];
  Plotly.newPlot('chart-l3-ridge',traces,plotlyLayout({margin:{l:0,r:0,b:0,t:30},height:600,scene:{xaxis:{title:'شاخص',tickmode:'array',tickvals:idx.filter(i=>i%3===0),ticktext:idx.filter(i=>i%3===0).map(i=>DATA.indicators[i]),gridcolor:themeColors().grid},yaxis:{showticklabels:false,gridcolor:themeColors().grid},zaxis:{title:'Q²predict',gridcolor:themeColors().grid},camera:{eye:{x:1.7,y:-1.5,z:1.0}}}}),PLOTLY_CFG);
}
function drawL3CVPAT(){
  const z=CVPAT.Diff;
  Plotly.newPlot('chart-l3-cvpat',[{type:'surface',x:[0,1,2,3],y:[0,1],z:z,colorscale:'RdYlGn',cmin:-0.20,cmax:0.02,colorbar:{title:'Δ',thickness:15,x:1.02,tickfont:{color:themeColors().text}},text:z.map((row,i)=>row.map((v,j)=>`سازه: ${CVPAT.entities[j]}<br>مقایسه: ${CVPAT.comparisons[i]}<br>Δ = ${v.toFixed(4)}`)),hovertemplate:HT.template('%{text}')}],plotlyLayout({margin:{l:0,r:0,b:0,t:30},height:600,scene:{xaxis:{title:'',tickmode:'array',tickvals:[0,1,2,3],ticktext:CVPAT.entities,gridcolor:themeColors().grid},yaxis:{title:'',tickmode:'array',tickvals:[0,1],ticktext:CVPAT.comparisons,gridcolor:themeColors().grid},zaxis:{title:'Δ',gridcolor:themeColors().grid},camera:{eye:{x:1.7,y:-1.7,z:0.9}}}}),PLOTLY_CFG);
}
function drawL3Ridgeline(){
  const idx=activeIndices();
  const xg=Array.from({length:90},(_,k)=>-0.35+k*0.4/89);
  const traces=[];
  for(const i of idx){ const mu=DATA.errors_mean[i],sig=DATA.SD[i]*0.08; const z=xg.map(x=>Math.exp(-Math.pow(x-mu,2)/(2*sig*sig))); const tt=i/Math.max(1,DATA.indicators.length-1); const isHi=state.highlighted===i; const color=isHi?'#ffd700':`rgb(${Math.round(253*tt)},${Math.round(231*tt+30)},${Math.round(37*tt+50)})`; traces.push({type:'scatter3d',x:xg,y:Array(xg.length).fill(i),z,mode:'lines',line:{color,width:isHi?8:4},name:DATA.indicators[i],showlegend:false,hovertemplate:HT.template(`<b>${DATA.indicators[i]}</b><br>μ=${mu.toFixed(4)}<br>σ=${DATA.SD[i].toFixed(4)}`)}); }
  Plotly.newPlot('chart-l3-ridgeline',traces,plotlyLayout({margin:{l:0,r:0,b:0,t:30},height:600,scene:{xaxis:{title:'خطا',gridcolor:themeColors().grid},yaxis:{title:'شاخص',tickmode:'array',tickvals:idx.filter(i=>i%3===0),ticktext:idx.filter(i=>i%3===0).map(i=>DATA.indicators[i]),gridcolor:themeColors().grid},zaxis:{title:'PDF',gridcolor:themeColors().grid},camera:{eye:{x:1.5,y:-1.9,z:1.0}}}}),PLOTLY_CFG);
  $('chart-l3-ridgeline').on('plotly_click',d=>{ if(d.points[0]&&d.points[0].data&&d.points[0].data.name)selectIndicator(d.points[0].data.name); });
}
function drawL3Scatter(){
  const idx=activeIndices();
  const lim=[0.7,1.05];
  const x=idx.map(i=>DATA.LM_RMSE[i]);
  const y=idx.map(i=>DATA.PLS_RMSE[i]);
  const q2=idx.map(i=>DATA.Q2[i]);
  const sizes=idx.map(i=>12+22*(DATA.SD[i]-0.72)/(0.9-0.72));
  const outlines=idx.map(i=>state.highlighted===i?'#ffd700':'#000');
  Plotly.newPlot('chart-l3-scatter',[{type:'scatter',x,y,mode:'markers',marker:{size:sizes,color:q2,colorscale:'Plasma',colorbar:{title:'Q²',len:0.7,tickfont:{color:themeColors().text}},line:{color:outlines,width:1.5}},customdata:idx.map(i=>[DATA.indicators[i],DATA.Q2[i],DATA.SD[i]]),hovertemplate:HT.template(`<b>%{customdata[0]}</b><br>RMSE LM = %{x:.4f}<br>RMSE PLS = %{y:.4f}<br>Q² = <b>%{customdata[1]:.4f}</b>`)},{type:'scatter',x:lim,y:lim,mode:'lines',line:{color:themeColors().text,dash:'dash',width:2},name:'y=x',hoverinfo:'skip'}],plotlyLayout({height:500,xaxis:{title:'RMSE (LM)',range:lim,gridcolor:themeColors().grid},yaxis:{title:'RMSE (PLS)',range:lim,scaleanchor:'x',gridcolor:themeColors().grid}}),PLOTLY_CFG);
  $('chart-l3-scatter').on('plotly_click',d=>{ if(d.points[0].customdata)selectIndicator(d.points[0].customdata[0]); });
}
function drawL3Forest(){
  const colors={'PLS vs IA':'#1f77b4','PLS vs LM':'#ff7f0e'};
  const markers={'PLS vs IA':'circle','PLS vs LM':'square'};
  const traces=CVPAT.comparisons.map((comp,ci)=>({ type:'scatter',x:CVPAT.Diff[ci],y:[0,1,2,3],mode:'markers',name:comp, marker:{size:14,symbol:markers[comp],color:colors[comp],line:{color:'#000',width:1.2}}, error_x:{type:'data',array:CVPAT.Diff[ci].map((d,i)=>1.96*Math.abs(d)/CVPAT.t[ci][i]),thickness:2,width:6,color:colors[comp]}, customdata:CVPAT.entities.map((e,i)=>[e,comp,CVPAT.Diff[ci][i],CVPAT.p[ci][i],CVPAT.t[ci][i]]), hovertemplate:HT.template(`<b>%{customdata[0]}</b><br>%{customdata[1]}<br>Δ = <b>%{customdata[2]:.4f}</b><br>t = %{customdata[4]:.3f}<br>p = %{customdata[3]:.2e}`) }));
  Plotly.newPlot('chart-l3-forest',traces,plotlyLayout({height:460,xaxis:{title:'Δ',gridcolor:themeColors().grid},yaxis:{title:'',tickmode:'array',tickvals:[0,1,2,3],ticktext:CVPAT.entities,gridcolor:themeColors().grid},shapes:[{type:'line',x0:0,x1:0,y0:-0.5,y1:3.5,line:{color:'red',dash:'dash',width:2}}],legend:{bgcolor:state.theme==='dark'?'rgba(30,36,51,0.9)':'rgba(255,255,255,0.9)',font:{color:themeColors().text}}}),PLOTLY_CFG);
}

/* ================================================================
   KPI, TABLE, INFO
   ================================================================ */
function renderKPIs(){
  const paths=state.loaded.paths;
  const sig=paths.filter(p=>p.P<0.05).length;
  const r2=state.loaded.r2;
  const maxR2=Math.max(...r2.map(r=>r.R2));
  const q=state.loaded.quality;
  const minAVE=Math.min(...Object.values(q).map(v=>v.AVE));
  const idx=activeIndices();
  const q2=idx.map(i=>DATA.Q2[i]);
  const strong=q2.filter(v=>v>0.10).length;
  const mid=q2.filter(v=>v>0&&v<=0.10).length;
  const weak=q2.filter(v=>v<=0).length;
  $('kpi-grid').innerHTML=`<div class="kpi-card purple"><div class="kpi-label">${t('kpi_paths')}</div><div class="kpi-value">${sig}/${paths.length}</div></div><div class="kpi-card green"><div class="kpi-label">${t('kpi_r2_max')}</div><div class="kpi-value">${maxR2.toFixed(3)}</div></div><div class="kpi-card orange"><div class="kpi-label">${t('kpi_ave_min')}</div><div class="kpi-value">${minAVE.toFixed(3)}</div></div><div class="kpi-card"><div class="kpi-label">${t('kpi_constructs')}</div><div class="kpi-value">${Object.keys(q).length}</div></div>`;
  if($('kpi-grid-l3')){ $('kpi-grid-l3').innerHTML=`<div class="kpi-card green"><div class="kpi-label">${t('kpi_strong')}</div><div class="kpi-value">${strong}</div></div><div class="kpi-card orange"><div class="kpi-label">${t('kpi_mid')}</div><div class="kpi-value">${mid}</div></div><div class="kpi-card red"><div class="kpi-label">${t('kpi_weak')}</div><div class="kpi-value">${weak}</div></div><div class="kpi-card"><div class="kpi-label">${t('kpi_mean_q2')}</div><div class="kpi-value">${(q2.reduce((a,b)=>a+b,0)/(q2.length||1)).toFixed(3)}</div></div>`; }
}
function renderTable(){
  const idx=activeIndices().filter(i=>DATA.indicators[i].toLowerCase().includes(state.searchTerm.toLowerCase()));
  const arrow=(c)=>state.sortCol===c?(state.sortAsc?' sort-asc':' sort-desc'):'';
  let html=`<table class="data-table"><thead><tr><th class="${arrow('ind')}" onclick="setSort('ind')">${t('col_indicator')}</th><th class="${arrow('q2')}" onclick="setSort('q2')">${t('col_q2')}</th><th class="${arrow('pls')}" onclick="setSort('pls')">${t('col_pls')}</th><th class="${arrow('lm')}" onclick="setSort('lm')">${t('col_lm')}</th><th class="${arrow('ia')}" onclick="setSort('ia')">${t('col_ia')}</th><th>${t('col_status')}</th></tr></thead><tbody>`;
  for(const i of idx){ const qv=DATA.Q2[i]; const badge=qv>0.10?`<span class="badge badge-good">${t('badge_good')}</span>`:qv>0?`<span class="badge badge-mid">${t('badge_mid')}</span>`:`<span class="badge badge-bad">${t('badge_bad')}</span>`; const cls=state.highlighted===DATA.indicators[i]?'selected':''; html+=`<tr class="${cls}" onclick="selectIndicator('${DATA.indicators[i]}')"><td><b>${DATA.indicators[i]}</b></td><td>${qv.toFixed(4)}</td><td>${DATA.PLS_RMSE[i].toFixed(4)}</td><td>${DATA.LM_RMSE[i].toFixed(4)}</td><td>${DATA.IA_RMSE[i].toFixed(4)}</td><td>${badge}</td></tr>`; }
  html+='</tbody></table>';
  $('data-table-wrapper').innerHTML=html;
}
function setSort(c){ if(state.sortCol===c)state.sortAsc=!state.sortAsc; else{state.sortCol=c;state.sortAsc=true;} renderTable(); }
function selectIndicator(name){ state.highlighted=state.highlighted===name?null:name; renderAll(); if(state.highlighted)showInfoPanel(state.highlighted); else $('info-panel').classList.add('hidden'); }
function showInfoPanel(name){
  const i=DATA.indicators.indexOf(name); if(i<0)return;
  const best=Math.min(DATA.PLS_RMSE[i],DATA.LM_RMSE[i],DATA.IA_RMSE[i]);
  const bestM=best===DATA.PLS_RMSE[i]?'PLS':best===DATA.LM_RMSE[i]?'LM':'IA';
  $('info-title').textContent=name;
  $('info-body').innerHTML=`<div class="row"><span class="label">${t('info_q2')}</span><span class="value">${DATA.Q2[i].toFixed(4)}</span></div><div class="row"><span class="label">${t('info_pls')}</span><span class="value">${DATA.PLS_RMSE[i].toFixed(4)}</span></div><div class="row"><span class="label">${t('info_lm')}</span><span class="value">${DATA.LM_RMSE[i].toFixed(4)}</span></div><div class="row"><span class="label">${t('info_ia')}</span><span class="value">${DATA.IA_RMSE[i].toFixed(4)}</span></div><div class="row"><span class="label">${t('info_best')}</span><span class="value" style="color:#27ae60">${bestM}</span></div>`;
  $('info-panel').classList.remove('hidden');
}
$('info-close').onclick=()=>$('info-panel').classList.add('hidden');
function renderMultiSelect(){
  const dd=$('ms-dropdown');
  let html='';
  DATA.indicators.forEach((ind,i)=>{ html+=`<label class="ms-item"><input type="checkbox" data-idx="${i}" ${state.selected.has(i)?'checked':''}><span>${ind}</span></label>`; });
  html+=`<div class="ms-actions"><button onclick="selectAllInd()">${t('select_all')}</button><button onclick="selectNoneInd()">${t('select_none')}</button></div>`;
  dd.innerHTML=html;
  dd.querySelectorAll('input[type=checkbox]').forEach(cb=>{ cb.onchange=()=>{ const i=+cb.dataset.idx; if(cb.checked)state.selected.add(i);else state.selected.delete(i); renderAll(); }; });
}
function selectAllInd(){DATA.indicators.forEach((_,i)=>state.selected.add(i));renderAll();}
function selectNoneInd(){state.selected.clear();renderAll();}
$('ms-toggle').onclick=e=>{e.stopPropagation();$('ms-dropdown').classList.toggle('open');};
document.addEventListener('click',e=>{if(!e.target.closest('.multi-select'))$('ms-dropdown').classList.remove('open');});

/* ================================================================
   EXCEL VIEWER
   ================================================================ */
function renderExcelViewer(){
  const container=document.getElementById('excel-viewer-container'); if(!container) return;
  const isFa = state.lang === 'fa';
  const files=[
    {name:'Bootstrapping.xlsx', label:t('excel_bootstrap'), type:'excel', icon:'📊'},
    {name:'PLS Algorithm.xlsx', label:t('excel_pls_algo'), type:'excel', icon:'📊'},
    {name:'PLS Predict.xlsx', label:t('excel_pls_predict'), type:'excel', icon:'📊'},
    {name:'causal_forest_results.xlsx', label: isFa ? 'خروجی یادگیری ماشین علّی' : 'Causal ML Output', type:'excel', icon:'🌲'},
    {name:'monte_carlo_results.xlsx', label: isFa ? 'خروجی مونت‌کارلو' : 'Monte Carlo Output', type:'excel', icon:'🎲'},
    {name:'پرسشنامه.docx', label:t('excel_questionnaire'), type:'docx', icon:'📄'},
    {name:'educational_data.sav', label:t('excel_educational_data'), type:'sav', icon:'🗂'}
  ];
  let html=`<h4>${t('excel_viewer_title')}</h4>`;
  if(isFileProtocol()){ html += `<div class="file-protocol-warning">⚠ <b>هشدار محیط:</b> داشبورد در محیط <code>file://</code> باز شده است. برای دسترسی به فایل‌ها، داشبورد را از طریق یک وب‌سرور محلی باز کنید.<div style="margin-top:8px;font-size:11.5px;color:var(--text-muted)"><code style="background:var(--bg2);padding:2px 6px;border-radius:4px">python -m http.server 8000</code> — سپس باز کنید: <code>http://localhost:8000</code></div></div>`; }
  html += `<div class="excel-file-list">`;
  files.forEach(f=>{ let previewBtn = ''; if(f.type === 'excel') previewBtn = `<button onclick="previewExcel('${f.name}')">${t('excel_preview_btn')}</button>`; else if(f.type === 'docx') previewBtn = `<button onclick="previewDocx('${f.name}')">${t('excel_preview_btn')}</button>`; html+=`<div class="excel-file-item excel-file-${f.type}"><div class="file-name"><span class="file-icon file-icon-${f.type}">${f.icon}</span> ${f.label} <span class="excel-status">(${f.name})</span></div><div class="file-actions">${previewBtn}<button class="download" onclick="downloadExcel('${f.name}')">${t('excel_download_btn')}</button></div></div>`; });
  html+='</div><div id="excel-preview-area"></div>';
  container.innerHTML=html;
}
async function downloadExcel(filename){
  try{ const blob = await fetchWithFallback(filename, false); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url), 2000); }
  catch(e){ try{ const a = document.createElement('a'); a.href = filename; a.download = filename; a.rel = 'noopener'; a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a); } catch(err2){ const hint = fileAccessHint(); alert((hint ? hint + '\n\n' : '') + t('excel_not_found') + '\n' + filename); } }
}
async function previewExcel(filename){
  const area=document.getElementById('excel-preview-area'); if(!area) return;
  area.innerHTML=`<div style="padding:20px;text-align:center;color:var(--text-muted)">${t('excel_loading')}</div>`;
  try{ const buf = await fetchWithFallback(filename, true); const wb=XLSX.read(buf,{type:'array'}); window._excelWB=wb; window._excelFile=filename; renderSheetPreview(filename, wb.SheetNames[0]); }
  catch(e){ showFileError(area, filename, e); }
}
async function previewDocx(filename){
  const area=document.getElementById('excel-preview-area'); if(!area) return;
  area.innerHTML=`<div style="padding:20px;text-align:center;color:var(--text-muted)">${t('excel_loading')}</div>`;
  try{ if(typeof mammoth === 'undefined') throw new Error('Mammoth.js not loaded'); const buf = await fetchWithFallback(filename, true); const result = await mammoth.convertToHtml({arrayBuffer: buf}); area.innerHTML = `<div class="docx-preview"><div class="docx-preview-head"><span class="docx-preview-icon">📄</span><span class="docx-preview-title">${t('excel_questionnaire')}</span><span class="docx-preview-file">${filename}</span></div><div class="docx-preview-body">${result.value || '<p style="text-align:center;color:var(--text-muted)">محتوایی یافت نشد</p>'}</div></div>`; }
  catch(e){ showFileError(area, filename, e); }
}
function renderSheetPreview(filename, sheetName){
  const area=document.getElementById('excel-preview-area'); if(!area) return;
  const wb=window._excelWB; if(!wb) return;
  let sheetTabs='';
  if(wb.SheetNames.length>1){ sheetTabs='<div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap">'+ wb.SheetNames.map(n=>{ const active=n===sheetName; return `<button onclick="renderSheetPreview('${filename.replace(/'/g,"\\'")}','${n.replace(/'/g,"\\'")}')" style="padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:${active?'var(--accent)':'var(--bg2)'};color:${active?'#fff':'var(--text)'};cursor:pointer;font-size:11.5px;font-family:inherit">${n}</button>`; }).join('')+'</div>'; }
  const ws=wb.Sheets[sheetName];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  const display=rows.slice(0,40);
  let tableHtml='<div class="excel-preview"><table>';
  display.forEach((row,i)=>{ tableHtml+='<tr>'; row.forEach(cell=>{ const val=cell==null?'':String(cell); if(i===0) tableHtml+=`<th>${val}</th>`; else tableHtml+=`<td>${val}</td>`; }); tableHtml+='</tr>'; });
  tableHtml+='</table></div>';
  tableHtml+=`<div style="margin-top:8px;font-size:11px;color:var(--text-muted)">${t('excel_showing_rows')} ${Math.min(40,rows.length)} / ${rows.length} — Sheet: <b>${sheetName}</b></div>`;
  area.innerHTML=sheetTabs+tableHtml;
}

/* ================================================================
   MOBILE CHARTS
   ================================================================ */
function renderMobileCharts(id){
  switch(id){
    case 'descriptive': renderDescriptiveStatistics(); break;
    case 'l1-path': drawL1PathDiagramMobile(); drawL1BetaBar(); break;
    case 'l1-quality': drawL1R2Mobile(); drawL1F2(); drawL1QualityMobile(); break;
    case 'l1-loadings': drawL1LoadingsMobile(); drawL1VIFMobile(); break;
    case 'l1-vif-table': renderVIFTable(); break;
    case 'l1-reliability': renderReliabilityTables(); break;
    case 'l1-htmt': drawL1HTMT(); break;
    case 'l1-moderation': drawL1Slopes(); drawL1Raincloud(); break;
    case 'l2-forest': drawL2Forest(); break;
    case 'l2-significance': drawL2SigMobile(); break;
    case 'l2-landscape': drawL2Landscape(); break;
    case 'l3-overview': drawL3Q2ColumnsMobile('chart-l3-q2'); break;
    case 'l3-charts': drawL3Q2ColumnsMobile('chart-l3-q2-2'); drawL3StemsMobile(); drawL3LandscapeMobile(); drawL3RidgeMobile(); drawL3CVPATMobile(); drawL3RidgelineMobile(); drawL3Scatter(); drawL3Forest(); break;
    case 'hypotheses': renderHypotheses(); break;
    case 'smartpls-graphical': renderSmartPLSGraphics(); break;
    case 'causal-ml': renderCausalMLSection(); break;
    case 'shap': renderSHAPSection(); break;
    case 'monte-carlo': renderMonteCarloSection(); break;
  }
}
function drawL1PathDiagramMobile(){
  const el = document.getElementById('chart-l1-path'); if(!el) return;
  const labels = ['HG→PR','HG→DT','HG→SUS','PR→DT','PR→SUS','DT→SUS','HG×PR→DT','HG×DT→SUS'];
  const values = [0.542, 0.274, 0.210, 0.262, 0.230, 0.374, 0.256, 0.177];
  const colors = ['#3498db','#9b59b6','#2ecc71','#e67e22','#f39c12','#27ae60','#e74c3c','#8e44ad'];
  const c = themeColors();
  Plotly.newPlot(el, [{type:'bar', orientation:'h', y: labels, x: values, marker:{ color: colors, line:{ color:'#fff', width:1 } }, text: values.map(v => v.toFixed(3)), textposition:'outside', textfont:{ size:11, color:c.text }}], { margin:{ l:110, r:40, t:20, b:30 }, height:420, paper_bgcolor:c.paper, plot_bgcolor:c.plot, font:{ color:c.text, family:FONT_FA, size:11 }, xaxis:{ gridcolor:c.grid }, yaxis:{ gridcolor:c.grid }, showlegend:false }, { responsive:true, displayModeBar:false });
}
function drawL1R2Mobile(){ const el = document.getElementById('chart-l1-r2'); if(!el) return; const r2 = state.loaded.r2; const c = themeColors(); Plotly.newPlot(el, [{ type:'bar', name:'R²', x: r2.map(r=>r.Construct), y: r2.map(r=>r.R2), marker:{ color:'#3498db' } },{ type:'bar', name:'R² Adj', x: r2.map(r=>r.Construct), y: r2.map(r=>r.R2_Adj), marker:{ color:'#9b59b6' } }], { barmode:'group', height:360, margin:{ l:50, r:20, t:30, b:40 }, paper_bgcolor:c.paper, plot_bgcolor:c.plot, font:{ color:c.text, family:FONT_FA, size:11 }, xaxis:{ gridcolor:c.grid }, yaxis:{ title:'R²', gridcolor:c.grid, range:[0,0.6] }, legend:{ font:{ color:c.text } } }, { responsive:true, displayModeBar:false }); }
function drawL1QualityMobile(){ const el = document.getElementById('chart-l1-quality'); if(!el) return; const q = state.loaded.quality; const constructs = Object.keys(q); const c = themeColors(); const metrics = [{ name:'Cronbach α', key:'Cronbach', color:'#3498db' },{ name:'rho_a', key:'rho_a', color:'#9b59b6' },{ name:'rho_c', key:'rho_c', color:'#f39c12' },{ name:'AVE', key:'AVE', color:'#27ae60' }]; Plotly.newPlot(el, metrics.map(m => ({ type:'bar', name: m.name, x: constructs, y: constructs.map(k => q[k][m.key]), marker:{ color: m.color } })), { barmode:'group', height:380, margin:{ l:50, r:20, t:30, b:40 }, paper_bgcolor:c.paper, plot_bgcolor:c.plot, font:{ color:c.text, family:FONT_FA, size:11 }, xaxis:{ gridcolor:c.grid }, yaxis:{ title:'مقدار', gridcolor:c.grid, range:[0,1] }, legend:{ font:{ color:c.text } } }, { responsive:true, displayModeBar:false }); }
function drawL1LoadingsMobile(){ const el = document.getElementById('chart-l1-loadings'); if(!el) return; const L = state.loaded.loadings; const c = themeColors(); const constructs = Object.keys(L); const maxInd = Math.max(...constructs.map(k => Object.keys(L[k]).length)); const z = constructs.map(k => { const qs = Object.keys(L[k]).sort(); const row = []; for(let i=0; i<maxInd; i++) row.push(i < qs.length ? L[k][qs[i]] : null); return row; }); Plotly.newPlot(el, [{ type:'heatmap', z: z, x: Array.from({length:maxInd},(_,i)=>'Q'+(i+1)), y: constructs, colorscale:'RdYlGn', zmin:0.6, zmax:1.0, colorbar:{ title:'بار', thickness:12, tickfont:{ color:c.text } }, hovertemplate:'سازه: %{y}<br>شاخص: %{x}<br>بار: %{z:.3f}<extra></extra>' }], { height:360, margin:{ l:60, r:20, t:20, b:50 }, paper_bgcolor:c.paper, plot_bgcolor:c.plot, font:{ color:c.text, family:FONT_FA, size:11 }, xaxis:{ gridcolor:c.grid, side:'top' }, yaxis:{ gridcolor:c.grid } }, { responsive:true, displayModeBar:false }); }
function drawL1VIFMobile(){ const el = document.getElementById('chart-l1-vif'); if(!el) return; const V = state.loaded.vif || FALLBACK_VIF; const c = themeColors(); const constructs = Object.keys(V); const maxInd = Math.max(...constructs.map(k => Object.keys(V[k]).length)); const z = constructs.map(k => { const qs = Object.keys(V[k]).sort((a,b)=>(parseInt(a.replace(/\D/g,''))||0)-(parseInt(b.replace(/\D/g,''))||0)); const row = []; for(let i=0; i<maxInd; i++) row.push(i < qs.length ? V[k][qs[i]] : null); return row; }); Plotly.newPlot(el, [{ type:'heatmap', z: z, x: Array.from({length:maxInd},(_,i)=>'Q'+(i+1)), y: constructs, colorscale:[[0,'#2ca02c'],[0.5,'#ffd700'],[1,'#d62728']], zmin:1, zmax:5, colorbar:{ title:'VIF', thickness:12, tickfont:{ color:c.text } }, hovertemplate:'سازه: %{y}<br>شاخص: %{x}<br>VIF: %{z:.3f}<extra></extra>' }], { height:360, margin:{ l:60, r:20, t:20, b:50 }, paper_bgcolor:c.paper, plot_bgcolor:c.plot, font:{ color:c.text, family:FONT_FA, size:11 }, xaxis:{ gridcolor:c.grid, side:'top' }, yaxis:{ gridcolor:c.grid } }, { responsive:true, displayModeBar:false }); }
function drawL2SigMobile(){ const el = document.getElementById('chart-l2-sig'); if(!el) return; const c = themeColors(); const paths = state.loaded.paths; const x = paths.map(p => p.Original); const y = paths.map(p => Number(p.T)); const pv = paths.map(p => Number(p.P)); const colors = pv.map(v => v < 0.05 ? '#2ca02c' : '#d62728'); const sizes = pv.map(v => v < 0.05 ? 14 : 10); const labels = paths.map(p => p.Path); Plotly.newPlot(el, [{ type:'scatter', mode:'markers', x: x, y: y, marker:{ color: colors, size: sizes, line:{ color:'#000', width:1 } }, text: labels, hovertemplate:'<b>%{text}</b><br>β = %{x:.3f}<br>T = %{y:.2f}<extra></extra>' }], { height:420, margin:{ l:50, r:20, t:30, b:50 }, paper_bgcolor:c.paper, plot_bgcolor:c.plot, font:{ color:c.text, family:FONT_FA, size:11 }, xaxis:{ title:'β', gridcolor:c.grid, zeroline:true, zerolinecolor:'#888' }, yaxis:{ title:'T', gridcolor:c.grid }, shapes:[{ type:'line', x0:0, x1:0, y0:Math.min(...y)*0.9, y1:Math.max(...y)*1.1, line:{ color:'red', dash:'dash', width:1.5 } }], showlegend:false }, { responsive:true, displayModeBar:false }); }
function drawL3Q2ColumnsMobile(targetId){ const el = document.getElementById(targetId); if(!el) return; const c = themeColors(); const idx = activeIndices(); const labels = idx.map(i => DATA.indicators[i]); const values = idx.map(i => DATA.Q2[i]); const colors = values.map(v => v > 0.10 ? '#2ca02c' : (v > 0 ? '#ff7f0e' : '#d62728')); Plotly.newPlot(el, [{ type:'bar', x: labels, y: values, marker:{ color: colors, line:{ color:'#000', width:0.5 } }, hovertemplate:'<b>%{x}</b><br>Q² = %{y:.4f}<extra></extra>' }], { height:380, margin:{ l:50, r:20, t:30, b:90 }, paper_bgcolor:c.paper, plot_bgcolor:c.plot, font:{ color:c.text, family:FONT_FA, size:10 }, xaxis:{ gridcolor:c.grid, tickangle:-60, tickfont:{ size:9 } }, yaxis:{ title:'Q²predict', gridcolor:c.grid }, shapes:[{ type:'line', x0:-0.5, x1:labels.length-0.5, y0:0.10, y1:0.10, line:{ color:'green', dash:'dash', width:1.5 } }], showlegend:false }, { responsive:true, displayModeBar:false }); }
function drawL3StemsMobile(){ const el = document.getElementById('chart-l3-stems'); if(!el) return; const c = themeColors(); const idx = activeIndices(); const labels = idx.map(i => DATA.indicators[i]); Plotly.newPlot(el, [{ type:'bar', name:'PLS', x: labels, y: idx.map(i=>DATA.PLS_RMSE[i]), marker:{ color:'#2ca02c' } },{ type:'bar', name:'LM', x: labels, y: idx.map(i=>DATA.LM_RMSE[i]), marker:{ color:'#f39c12' } },{ type:'bar', name:'IA', x: labels, y: idx.map(i=>DATA.IA_RMSE[i]), marker:{ color:'#e74c3c' } }], { barmode:'group', height:380, margin:{ l:50, r:20, t:30, b:90 }, paper_bgcolor:c.paper, plot_bgcolor:c.plot, font:{ color:c.text, family:FONT_FA, size:10 }, xaxis:{ gridcolor:c.grid, tickangle:-60, tickfont:{ size:9 } }, yaxis:{ title:'RMSE', gridcolor:c.grid }, legend:{ font:{ color:c.text } } }, { responsive:true, displayModeBar:false }); }
function drawL3LandscapeMobile(){ const el = document.getElementById('chart-l3-landscape'); if(!el) return; const c = themeColors(); const idx = activeIndices(); const labels = idx.map(i => DATA.indicators[i]); const z = [idx.map(i => DATA.PLS_RMSE[i]), idx.map(i => DATA.LM_RMSE[i]), idx.map(i => DATA.IA_RMSE[i])]; Plotly.newPlot(el, [{ type:'heatmap', z: z, x: labels, y: ['PLS','LM','IA'], colorscale:'Turbo', colorbar:{ title:'RMSE', thickness:12, tickfont:{ color:c.text } }, hovertemplate:'روش: %{y}<br>شاخص: %{x}<br>RMSE: %{z:.4f}<extra></extra>' }], { height:280, margin:{ l:60, r:20, t:20, b:80 }, paper_bgcolor:c.paper, plot_bgcolor:c.plot, font:{ color:c.text, family:FONT_FA, size:10 }, xaxis:{ tickangle:-60, tickfont:{ size:9 } }, yaxis:{ gridcolor:c.grid } }, { responsive:true, displayModeBar:false }); }
function drawL3RidgeMobile(){ const el = document.getElementById('chart-l3-ridge'); if(!el) return; const c = themeColors(); const idx = activeIndices(); const labels = idx.map(i => DATA.indicators[i]); const values = idx.map(i => DATA.Q2[i]); Plotly.newPlot(el, [{ type:'bar', x: labels, y: values, marker:{ color: values, colorscale:'Viridis', line:{ color:'#000', width:0.5 } }, hovertemplate:'<b>%{x}</b><br>Q² = %{y:.4f}<extra></extra>' }], { height:340, margin:{ l:50, r:20, t:30, b:90 }, paper_bgcolor:c.paper, plot_bgcolor:c.plot, font:{ color:c.text, family:FONT_FA, size:10 }, xaxis:{ tickangle:-60, tickfont:{ size:9 }, gridcolor:c.grid }, yaxis:{ title:'Q²predict', gridcolor:c.grid }, showlegend:false }, { responsive:true, displayModeBar:false }); }
function drawL3CVPATMobile(){ const el = document.getElementById('chart-l3-cvpat'); if(!el) return; const c = themeColors(); Plotly.newPlot(el, CVPAT.comparisons.map((comp, ci) => ({ type:'bar', name: comp, x: CVPAT.entities, y: CVPAT.Diff[ci], marker:{ color: ci === 0 ? '#e74c3c' : '#3498db' }, hovertemplate:'<b>%{x}</b><br>Δ = %{y:.4f}<extra></extra>' })), { barmode:'group', height:340, margin:{ l:50, r:20, t:30, b:40 }, paper_bgcolor:c.paper, plot_bgcolor:c.plot, font:{ color:c.text, family:FONT_FA, size:11 }, xaxis:{ gridcolor:c.grid }, yaxis:{ title:'Δ', gridcolor:c.grid, zeroline:true, zerolinecolor:'#888' }, legend:{ font:{ color:c.text } } }, { responsive:true, displayModeBar:false }); }
function drawL3RidgelineMobile(){ const el = document.getElementById('chart-l3-ridgeline'); if(!el) return; const c = themeColors(); const idx = activeIndices(); const labels = idx.map(i => DATA.indicators[i]); const means = idx.map(i => DATA.errors_mean[i]); const sds = idx.map(i => DATA.SD[i]); Plotly.newPlot(el, [{ type:'bar', x: labels, y: means, error_y:{ type:'data', array: sds.map(s=>s*0.1), visible:true, color:'#3498db' }, marker:{ color:'#3498db' }, hovertemplate:'<b>%{x}</b><br>μ = %{y:.4f}<extra></extra>' }], { height:340, margin:{ l:50, r:20, t:30, b:90 }, paper_bgcolor:c.paper, plot_bgcolor:c.plot, font:{ color:c.text, family:FONT_FA, size:10 }, xaxis:{ tickangle:-60, tickfont:{ size:9 }, gridcolor:c.grid }, yaxis:{ title:'خطای میانگین', gridcolor:c.grid }, showlegend:false }, { responsive:true, displayModeBar:false }); }
/* ================================================================
   MAIN_CHART_INTS (FA) — 28 charts — Persian interpretations
   ================================================================ */
const MAIN_CHART_INTS = {

  /* ========== آمار توصیفی ========== */
  'chart-desc-gender': `
    <strong>نوع نمودار:</strong> نمودار دایره‌ای (Pie) توزیع جنسیت — فراوانی مطلق و نسبی<br>
    <strong>n = ۲۵۰</strong> · داده گمشده: صفر<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    ۱۰۰٪ نمونه (۲۵۰ نفر) زن است. این نتیجه طبیعی است، چون جامعهٔ هدف پژوهش «زنان کارآفرین روستایی فرش‌باف مشهد و حومه» تعریف شده است.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این ترکیب تک‌جنسیتی، ناهمگونی مشاهده‌شده در CATE را از «تفاوت جنسیتی» منتفی می‌کند. یعنی هر ناهمگونی که در تحلیل Causal Forest کشف شد، منشأ جغرافیایی-اقتصادی دارد و نه جنسیتی. این شفافیت برای تفسیر نتایج «یادگیری ماشین علّی» حیاتی است.</div>
  `,

  'chart-desc-age': `
    <strong>نوع نمودار:</strong> نمودار میله‌ای توزیع فراوانی سن در ۴ طبقه<br>
    <strong>توزیع:</strong> زیر ۲۹ = ۶ (۲.۴٪) · ۳۰-۳۹ = ۹۰ (۳۶٪) · ۴۰-۴۹ = ۱۱۱ (۴۴.۴٪) · بالای ۵۰ = ۴۳ (۱۷.۲٪)<br>
    <strong>آماره‌ها:</strong> Mean=۲.۷۶ · SD=۰.۷۵۸ · Skew=۰.۰۸۹ · Kurt=-۰.۶۷۶<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    ۸۰٪ نمونه در بازهٔ ۳۰-۴۹ سال قرار دارند — یعنی «زنان در اوج فعالیت کارآفرینی». توزیع متقارن است (Skew≈۰) و کشیدگی منفی ملایم (Kurt=-۰.۶۷۶) نشان‌دهندهٔ دامنهٔ پهن و بدون داده پرت است.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> تمرکز سنی در اوج فعالیت اقتصادی، تعمیم‌پذیری نتایج به جمعیت واقعی زنان فرش‌باف را تقویت می‌کند. اگر نمونه عمدتاً از زنان جوان یا سالمند بود، اثر تحول دیجیتال بر پایداری کارآفرینی احتمالاً متفاوت گزارش می‌شد.</div>
  `,

  'chart-desc-edu': `
    <strong>نوع نمودار:</strong> نمودار میله‌ای افقی توزیع تحصیلات<br>
    <strong>توزیع:</strong> کاردانی و کمتر = ۱۵۱ (۶۰.۴٪) · کارشناسی = ۸۸ (۳۵.۲٪) · کارشناسی ارشد = ۱۱ (۴.۴٪)<br>
    <strong>آماره‌ها:</strong> Mean=۱.۴۴ · SD=۰.۵۷۹ · Skew=۰.۹۲۳<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    ۶۰٪ نمونه تحصیلات کاردانی یا پایین‌تر دارند و تنها ۱۱ نفر (۴.۴٪) تحصیلات تکمیلی دارند. چولگی مثبت (Skew=۰.۹۲۳) نشان می‌دهد توده اصلی در سمت «تحصیلات پایین» است.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> تحصیلات پایین، نقش «سرمایهٔ فرهنگی» (یکی از چهار بُعد HG) را تعیین‌کننده‌تر می‌کند. چون سطح آموزش رسمی پایین است، شبکه‌های اجتماعی محلی و سرمایهٔ فرهنگی غیررسمی — که در HG تجمیع شده‌اند — به محرک اصلی کارآفرینی تبدیل می‌شوند. این یافته، β=۰.۵۴۲ مسیر HG→PR را از منظر زمینه‌ای توجیه می‌کند.</div>
  `,

  'chart-desc-distance': `
    <strong>نوع نمودار:</strong> نمودار میله‌ای توزیع فاصلهٔ مکانی روستا تا مشهد (کیلومتر)<br>
    <strong>توزیع:</strong> زیر ۳۹=۳۱ (۱۲.۴٪) · ۴۰-۵۹=۱۲۰ (۴۸٪) · ۶۰-۷۹=۳۹ (۱۵.۶٪) · ۸۰-۹۹=۲۵ (۱۰٪) · ۱۰۰-۱۱۹=۱۵ (۶٪) · بالای ۱۲۰=۲۰ (۸٪)<br>
    <strong>آماره‌ها:</strong> Mean=۲.۷۳ · SD=۱.۴۰۴ (بالاترین پراکندگی) · Skew=۱.۰۴۸<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    بیشترین فراوانی در بازهٔ ۴۰-۵۹ کیلومتر (۴۸٪) است — یعنی نیمی از نمونه در «حاشیهٔ نزدیک شهر». تنها ۸٪ در فاصلهٔ بالای ۱۲۰ کیلومتر. چولگی مثبت (۱.۰۴۸) تأیید می‌کند که نمونه به سمت «نزدیک شهر» متمایل است.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> فاصلهٔ مکانی، بُعد اصلی HG است. توزیع ناهمگون و پراکندهٔ این متغیر (SD=۱.۴) دقیقاً پیش‌نیاز کشف ناهمگونی CATE است: اگر همه نمونه‌ها فاصلهٔ یکسان داشتند، Causal Forest نمی‌توانست اثر تعدیل‌گری HG را آشکار کند. پراکندگی بالا یعنی «تنوع کافی برای یادگیری ماشین».</div>
  `,

  'chart-desc-cost': `
    <strong>نوع نمودار:</strong> نمودار میله‌ای توزیع هزینهٔ رفت‌وآمد (هزار تومان)<br>
    <strong>توزیع:</strong> زیر ۱۰۰=۳۱ (۱۲.۴٪) · ۱۰۰-۲۰۰=۱۲۰ (۴۸٪) · ۲۰۰-۳۰۰=۳۹ (۱۵.۶٪) · ۳۰۰-۴۰۰=۲۵ (۱۰٪) · ۴۰۰-۵۰۰=۲۱ (۸.۴٪) · بالای ۵۰۰=۱۴ (۵.۶٪)<br>
    <strong>آماره‌ها:</strong> Mean=۲.۷۱ · SD=۱.۳۵۶ · Skew=۰.۹۹۱<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    توزیع هزینه تقریباً آینهٔ توزیع فاصله است (r≈۰.۹۸). ۶۰٪ نمونه هزینهٔ ماهانه زیر ۲۰۰ هزار تومان دارند و ۵.۶٪ بالای ۵۰۰ هزار تومان.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> همبستگی بسیار بالای هزینه و فاصله، تأیید می‌کند که این دو شاخص «ابعاد یکسان HG» هستند. در تحلیل تعدیل‌گری و Causal Forest، این همبستگی با VIFهای پایین (زیر ۵) مدیریت شده و از تورم واریانس جلوگیری شده است.</div>
  `,

  'chart-desc-sd': `
    <strong>نوع نمودار:</strong> نمودار قطبی (Barpolar) مقایسهٔ انحراف معیار ۵ متغیر زمینه‌ای<br>
    <strong>مقادیر SD:</strong> جنسیت=۰.۰۰۰ · سن=۰.۷۵۸ · تحصیلات=۰.۵۷۹ · فاصله=۱.۴۰۴ · هزینه=۱.۳۵۶<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    فاصله (۱.۴۰۴) و هزینه (۱.۳۵۶) بالاترین پراکندگی را دارند — یعنی نمونه از نظر «دسترسی جغرافیایی» بسیار ناهمگون است. سن و تحصیلات پراکندگی متوسط، و جنسیت (چون تک‌جنس است) صفر دارند.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار، «پیش‌نیاز آماری» تحلیل ناهمگونی را نمایش می‌دهد: پراکندگی بالای HG یعنی «دامنهٔ کافی برای کشف CATE». اگر SD فاصله کوچک بود، Causal Forest نمی‌توانست چارک‌های HG را با تفاوت معنادار تفکیک کند.</div>
  `,

  /* ========== دیاگرام مسیر ========== */
  'chart-l1-path': `
    <strong>نوع نمودار:</strong> دیاگرام مسیر مدل ساختاری — PLS Algorithm (برازش مدل)<br>
    <strong>سازه‌ها:</strong> PR (پیش‌نیازها)، DT (تحول دیجیتال)، SUS (پایداری)، HG (جغرافیای انسانی) + QE (اثر درجه دوم) + دو تعامل HG×PR و HG×DT<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    قوی‌ترین مسیر <strong>HG→PR با β=۰.۵۴۲</strong> است؛ ضعیف‌ترین مسیر <strong>QE→SUS با β=۰.۰۲۶ (غیرمعنادار)</strong>. مسیرهای QE با نقطه‌چین قرمز از مسیرهای خطی متمایز شده‌اند تا خواننده بلافاصله ببیند این‌ها «اثر درجه دوم» هستند.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این دیاگرام «نقشهٔ راه کل مدل» است. خواننده در یک نگاه می‌بیند که: (۱) HG هم بر PR و هم بر DT و هم بر SUS اثر مستقیم دارد، (۲) DT نقش میانجی بین PR و SUS را ایفا می‌کند، (۳) دو تعامل HG×PR و HG×DT معتبرند، و (۴) اثر غیرخطی QE بر PR و SUS رد شده است.</div>
  `,

  'chart-l1-beta-bar': `
    <strong>نوع نمودار:</strong> نمودار میله‌ای افقی ضرایب مسیر (β) — ۱۱ مسیر ساختاری<br>
    <strong>رنگ:</strong> سبز = معنادار (CI ۹۵٪ بدون صفر) · خاکستری = غیرمعنادار<br>
    <strong>مقادیر کلیدی:</strong> HG→PR=۰.۵۴۲ (قوی‌ترین) · DT→SUS=۰.۳۷۴ · HG→DT=۰.۲۷۴ · PR→SUS=۰.۲۳۱ · QE→SUS=۰.۰۲۶ (ضعیف‌ترین)<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    ترتیب صعودی β نشان می‌دهد که مسیرهای HG و DT و PR در بالای نمودار (β>۰.۲) قرار دارند و مسیرهای QE در پایین (نزدیک صفر). دو مسیر QE→PR (CI: -۰.۰۳۵ تا ۰.۱۰۸) و QE→SUS (CI: -۰.۰۶۴ تا ۰.۱۱۶) خط صفر را قطع می‌کنند و خاکستری‌اند.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار «سلسله‌مراتب اثرات» را در یک تصویر خلاصه می‌کند: HG قوی‌ترین محرک است، بعد DT، و اثر غیرخطی QE عملاً حذف می‌شود. این یافته مبنای توصیهٔ سیاستی «هدف‌گیری جغرافیایی» است: سیاست‌گذار باید اول HG را تقویت کند، چون هم بزرگ‌ترین اثر مستقیم و هم بزرگ‌ترین اثر تعدیل‌گری را دارد.</div>
  `,

  /* ========== لایهٔ PLS Algorithm ========== */
  'chart-l1-r2': `
    <strong>نوع نمودار:</strong> سطح سه‌بعدی R² و R²-Adjusted — سه سازهٔ درون‌زا (DT، SUS، PR)<br>
    <strong>مقادیر:</strong> R²(DT)=۰.۲۷۸ · R²(SUS)=۰.۴۸۹ · R²(PR)=۰.۲۸۸ · تفاضل R² و R²-Adj همه زیر ۰.۰۲<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    SUS بالاترین R² را دارد (۰.۴۸۹) چون سه مسیر مستقیم (PR، DT، HG) و دو مسیر تعاملی به آن منتهی می‌شوند. DT و PR هر دو حدود ۰.۲۸ هستند.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> طبق Chin (1998)، R²>۰.۶۷ قوی، ۰.۳۳-۰.۶۷ متوسط، ۰.۱۹-۰.۳۳ ضعیف است. مدل ما برای SUS «متوسط تا قوی» (۰.۴۸۹) و برای DT و PR «ضعیف تا متوسط» است. یعنی مدل بخش قابل توجهی از واریانس پایداری را تبیین می‌کند — این یعنی متغیرهای ما (HG، PR، DT) واقعاً «پیش‌بین‌های معنادار» پایداری هستند.</div>
  `,

  'chart-l1-f2': `
    <strong>نوع نمودار:</strong> اندازهٔ اثر f² کوهن برای ۱۱ مسیر ساختاری<br>
    <strong>آستانه‌ها (Cohen 1988):</strong> ۰.۰۲ = ضعیف · ۰.۱۵ = متوسط · ۰.۳۵ = قوی<br>
    <strong>مقادیر:</strong> HG→PR=۰.۴۰۳ (قوی) · DT→SUS=۰.۲۱۰ (متوسط) · HG→DT=۰.۰۷۲ (ضعیف) · HG×PR→DT=۰.۰۶۵ · QE→SUS=۰.۰۰۲ (ناچیز)<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    تنها یک مسیر (HG→PR) «اثر قوی» و یک مسیر (DT→SUS) «اثر متوسط» دارد. هفت مسیر «ضعیف» و دو مسیر QE «ناچیز»اند. یعنی از ۱۱ مسیر، فقط ۲ مسیر اثر عملی قابل توجه دارند.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> f² مکمل p-value است: p می‌گوید «اثر وجود دارد یا نه»، اما f² می‌گوید «اثر چقدر بزرگ است». این یافته به سیاست‌گذار می‌گوید تمرکز منابع بر HG→PR و DT→SUS بیشترین بازدهی عملی را دارد. سایر مسیرها هرچند معنادارند، اثر عملی کمی دارند و نباید اولویت بودجه‌ای باشند.</div>
  `,

  'chart-l1-quality': `
    <strong>نوع نمودار:</strong> سطح سه‌بعدی ۴ شاخص پایایی/روایی (Cronbach α، rho_a، rho_c، AVE) برای ۴ سازه<br>
    <strong>آستانه‌ها:</strong> Cronbach ≥ ۰.۷ · rho_a ≥ ۰.۷ · rho_c ≥ ۰.۷ · AVE ≥ ۰.۵<br>
    <strong>مقادیر:</strong> همهٔ ۱۶ خانه بالای آستانه‌اند. کمترین AVE: SUS=۰.۶۸۹ · بیشترین rho_c: HG=۰.۹۷۳<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    هر ۴ سازه دارای Cronbach α بالای ۰.۹۴ و AVE بالای ۰.۶۸ هستند. یعنی (۱) گویه‌های هر سازه به‌شدت با هم همبسته‌اند (پایایی درونی عالی)، و (۲) هر سازه بیش از ۶۸٪ واریانس گویه‌های خودش را تبیین می‌کند (روایی همگرای قوی).<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> بدون پایایی و روایی، هیچ نتیجه‌ای از مدل ساختاری قابل اعتماد نیست. این نمودار «مجوز ورود» به تحلیل‌های بعدی را صادر می‌کند: چون همهٔ سازه‌ها بالای آستانه هستند، می‌توانیم به β و p-value و R² اعتماد کنیم.</div>
  `,

  'chart-l1-loadings': `
    <strong>نوع نمودار:</strong> سطح سه‌بعدی Outer Loadings — بار عاملی ۴۶ شاخص روی سازه‌های مربوطه<br>
    <strong>آستانه:</strong> λ ≥ ۰.۷ (Hair et al. 2022)<br>
    <strong>مقادیر:</strong> کمترین Q39=۰.۷۶۶ (HG) · بیشترین Q4=۰.۸۹۳ (PR) · میانه ≈۰.۸۴<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    تمام ۴۶ شاخص بار عاملی بالای ۰.۷۶ دارند — هیچ شاخصی نیاز به حذف ندارد. سازهٔ HG (با ۱۶ شاخص) و PR (با ۱۱ شاخص) بالاترین بارها را دارند. PR کمترین پراکندگی را دارد (همه بین ۰.۷۸۶ تا ۰.۸۹۳).<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> بارهای عاملی بالا یعنی «ابزار اندازه‌گیری دقیق است». اگر شاخصی بار زیر ۰.۷ داشت، باید حذف می‌شد و پرسشنامه بازنگری می‌شد. چون هیچ شاخصی حذف نشد، تمام ۴۶ گویهٔ پرسشنامه در مدل نهایی حفظ شدند — یعنی ابزار پژوهش از نظر روان‌سنجی معتبر و قابل استفاده در پژوهش‌های آتی است.</div>
  `,

  'chart-l1-vif': `
    <strong>نوع نمودار:</strong> سطح سه‌بعدی VIF — عامل تورم واریانس ۴۹ شاخص<br>
    <strong>آستانه:</strong> VIF < ۵ (Hair et al. 2022) · ۳.۳ تا ۵ = هشدار · ≥ ۵ = مشکل جدی<br>
    <strong>مقادیر:</strong> کمترین Q28=۲.۲۲۵ (SUS) · بیشترین Q36=۴.۱۶۷ (HG) · میانگین=۳.۰۷<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    هیچ شاخصی VIF بالای ۵ ندارد. Q36 (VIF=۴.۱۶۷) و Q4 (VIF=۴.۱۴۲) نزدیک‌ترین به آستانه‌اند اما هنوز زیر ۵. بیش از ۹۰٪ شاخص‌ها VIF زیر ۴ دارند.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> هم‌خطی چندگانه باعث «تورم خطای استاندارد β» و «کاهش دقت p-value» می‌شود. چون همهٔ VIFها زیر ۵ هستند، می‌توانیم به β=۰.۵۴۲ و p<۰.۰۰۱ مسیر HG→PR کاملاً اعتماد کنیم. اگر VIF بالای ۵ داشتیم، باید شاخص‌های هم‌پوشان حذف می‌شدند و نتایج تغییر می‌کردند.</div>
  `,

  'chart-l1-htmt': `
    <strong>نوع نمودار:</strong> ماتریس HTMT — نسبت هتروتریت-مونوتریت (Henseler et al. 2015)<br>
    <strong>آستانه:</strong> HTMT < ۰.۸۵ (محافظه‌کارانه) یا < ۰.۹۰ (لیبرال)<br>
    <strong>بیشترین مقدار:</strong> QE ↔ HG×PR = ۰.۶۷۹ (زیر هر دو آستانه)<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    بالاترین HTMT بین QE و HG×PR است (۰.۶۷۹) که انتظار می‌رود چون هر دو سازه‌های مشتق‌شده از HG و PR هستند. سایر مقادیر زیر ۰.۶ هستند. هیچ خانه‌ای بالای ۰.۷ نیست.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> HTMT روایی واگرا را می‌سنجد: آیا سازه‌ها واقعاً از هم متمایزند یا همدیگر را «می‌بلعند»؟ چون همهٔ مقادیر زیر ۰.۸۵ هستند، پاسخ بله است. یعنی PR، DT، SUS، HG چهار سازهٔ مستقل‌اند. این تأیید، «مجوز تفسیر βها به‌عنوان اثرات متمایز» را صادر می‌کند.</div>
  `,

  'chart-l1-slopes': `
    <strong>نوع نمودار:</strong> شیب‌های ساده (Simple Slopes) — نمایش بصری تعدیل‌گری HG×PR→DT (پنل چپ) و HG×DT→SUS (پنل راست)<br>
    <strong>۳ خط در هر پنل:</strong> متغیر تعدیل‌گر در سطح کم (-1SD)، متوسط (میانگین)، زیاد (+1SD)<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    <strong>پنل چپ (HG×PR→DT):</strong> شیب خط «PR زیاد» به‌طور محسوسی از شیب «PR کم» بیشتر است — یعنی وقتی PR بالا باشد، اثر HG بر DT قوی‌تر است.<br>
    <strong>پنل راست (HG×DT→SUS):</strong> همان الگو — وقتی DT بالا باشد، اثر HG بر SUS قوی‌تر است.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> شیب‌های واگرا اثبات بصری «تعدیل‌گری» هستند: اثر HG بر پیامد ثابت نیست بلکه به سطح PR (یا DT) بستگی دارد. این دقیقاً همان یافته H4a و H4c است. اگر شیب‌ها موازی بودند، تعدیل‌گری وجود نداشت. این نمودار به سیاست‌گذار می‌گوید: «تقویت HG را با تقویت PR هم‌زمان انجام دهید، نه جداگانه».</div>
  `,

  'chart-l1-raincloud': `
    <strong>نوع نمودار:</strong> نمودار Raincloud — توزیع امتیازهای پنهان ۳ سازه (DT، SUS، PR)<br>
    <strong>اجزا:</strong> نیم‌ویولن (چگالی) + جعبه (چارک‌ها) + نقاط پراکنده (تک‌تک مشاهدات)<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    هر سه سازه توزیع زنگی و متقارن دارند. میانه همه نزدیک صفر است. دامنهٔ هر سه تقریباً یکسان (-۳ تا +۳). هیچ Outlier شدیدی مشاهده نمی‌شود.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار «سلامت توزیع» را نشان می‌دهد. توزیع متقارن یعنی فرض‌های بوت‌استرپ (توزیع نرمال نمونه‌گیری) برقرار است و CIها معتبرند. اگر توزیع‌ها چولهٔ شدید بودند، استفاده از Percentile Bootstrap با احتیاط بیشتری انجام می‌شد.</div>
  `,

  /* ========== لایهٔ Bootstrapping ========== */
  'chart-l2-forest': `
    <strong>نوع نمودار:</strong> Forest Plot — ضرایب مسیر با فاصلهٔ اطمینان ۹۵٪ (Percentile Bootstrap، ۵,۰۰۰ زیرنمونه)<br>
    <strong>مسیرها:</strong> ۱۱ مسیر مرتب‌شده بر اساس β<br>
    <strong>قاعدهٔ تصمیم:</strong> اگر CI خط صفر را قطع نکند → مسیر معنادار<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    ۹ مسیر از ۱۱ مسیر CI خط صفر را قطع نمی‌کنند (معنادار). دو مسیر QE→PR (CI: -۰.۰۳۵ تا ۰.۱۰۸) و QE→SUS (CI: -۰.۰۶۴ تا ۰.۱۱۶) خط صفر را قطع می‌کنند (غیرمعنادار). عرض CI متفاوت است: HG→PR باریک‌ترین (دقیق‌ترین) و HG×PR→DT پهن‌ترین.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> Forest Plot استاندارد طلایی «گزارش شفاف» است. عرض CI نشان‌دهندهٔ دقت برآورد است: CI باریک (HG→PR) = برآورد دقیق؛ CI پهن (تعامل‌ها) = عدم قطعیت بیشتر ولی همچنان معنادار. این نمودار به خواننده اجازه می‌دهد بدون دیدن جدول، مستقیماً ببیند کدام فرضیه‌ها تأیید شده‌اند (۹ مسیر) و کدام رد شده‌اند (۲ مسیر QE).</div>
  `,

  'chart-l2-sig': `
    <strong>نوع نمودار:</strong> چشم‌انداز سه‌بعدی معناداری — هم‌زمان β × T × -log10(p)<br>
    <strong>نقاط سبز دایره:</strong> معنادار (p<۰.۰۵) · <strong>نقاط قرمز ضربدر:</strong> غیرمعنادار<br>
    <strong>محور Z:</strong> −log10(p) — مقدار بالاتر = معناداری بیشتر<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    HG→PR بالاترین موقعیت را در هر سه محور دارد (β=۰.۵۴۲، T=۱۱.۳۷، −log10(p)≈۱۳). مسیرهای QE در پایین محور Z قرار دارند (p>۰.۰۵) و با علامت × مشخص‌اند.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار «سه‌گانهٔ تصمیم» را در یک تصویر جمع می‌کند: نه فقط «آیا معنادار است؟» (p)، بلکه «چقدر بزرگ است؟» (β) و «چقدر اطمینان داریم؟» (T). سیاست‌گذار با یک نگاه می‌بیند که HG→PR در «گوشهٔ طلایی» (β بالا، T بالا، p پایین) قرار دارد، در حالی که QE→SUS در «گوشهٔ مرده» است.</div>
  `,

  'chart-l2-landscape': `
    <strong>نوع نمودار:</strong> نمودار میله‌ای رنگی بر اساس T — ضرایب مسیر با شدت رنگ T<br>
    <strong>مقیاس رنگ:</strong> سبز تیره = T بالا (معنادار قوی) · قرمز = T پایین (غیرمعنادار)<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    میله‌های بلند (β بالا) رنگ سبز تیره دارند — هم‌راستایی β و T. اما استثنا: HG×PR→DT میلهٔ متوسط با رنگ سبز نسبتاً تیره دارد چون T=۳.۵، در حالی که PR→SUS (β مشابه) T پایین‌تری دارد.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار مکمل Forest Plot است: به‌جای بازه‌های اطمینان، «قدرت شاهد» را نمایش می‌دهد. مسیرهای تعاملی (HG×PR→DT، HG×DT→SUS) با وجود β متوسط، T بالایی دارند چون اثر آن‌ها با وجود پیچیدگی، بسیار پایدار است — این تأیید می‌کند تعدیل‌گری HG «اثر واقعی» است نه نویز.</div>
  `,

  /* ========== لایهٔ PLS Predict ========== */
  'chart-l3-q2': `
    <strong>نوع نمودار:</strong> ستون‌های سه‌بعدی Q²predict برای ۳۰ شاخص<br>
    <strong>آستانه (Hair et al. 2022):</strong> Q²>۰.۱۰ = قوی · ۰<Q²<۰.۱۰ = متوسط · Q²<۰ = ضعیف<br>
    <strong>مقادیر کلیدی:</strong> کمترین Q13=۰.۰۸۳ · بیشترین Q4=۰.۲۴۷ · میانگین=۰.۱۵۸<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    تمام ۳۰ شاخص Q²>۰.۰۸ دارند — یعنی «قدرت پیش‌بینی برون‌نمونه‌ای» مثبت دارند. ۲۷ شاخص Q²>۰.۱۰ (قوی) و ۳ شاخص (Q13، Q14، Q18، Q19) بین ۰.۰۸ تا ۰.۱۰ (متوسط). خط سبز آستانه ۰.۱۰ را نشان می‌دهد.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> Q² معیار «پیش‌بینی» است، نه «تبیین». حتی اگر R² بالا باشد، اگر Q² پایین باشد یعنی مدل روی داده جدید کار نمی‌کند. چون Q² همه شاخص‌ها مثبت و اکثراً >۰.۱۰ هستند، مدل ما «تعمیم‌پذیر» است و می‌تواند در پژوهش‌های آینده روی داده‌های جدید استفاده شود. Q4 (β بالای PR) بالاترین Q² را دارد — یعنی «قوی‌ترین شاخص PR» دقیق‌ترین پیش‌بینی را هم دارد.</div>
  `,

  'chart-l3-q2-2': `
    <strong>نوع نمودار:</strong> نسخهٔ فیلترشدهٔ Q² — کاربر می‌تواند شاخص‌های منتخب را از فیلتر بالای صفحه انتخاب کند<br>
    <strong>همان منطق نمودار قبل:</strong> آستانه ۰.۱۰ و ۰<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    با تغییر فیلتر شاخص‌ها، ستون‌های Q² به‌روز می‌شوند. این امکان به پژوهشگر اجازه می‌دهد فقط روی شاخص‌های یک سازه خاص (مثلاً فقط PR: Q1-Q11) تمرکز کند و توزیع Q² درون آن سازه را ببیند.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این «تحلیل حساسیت» (Sensitivity Analysis) است: آیا قدرت پیش‌بینی مدل به شاخص خاصی وابسته است یا توزیع Q² درون هر سازه یکنواخت است؟ اگر Q² درون PR یکنواخت باشد، یعنی تمام ۱۱ گویه PR به یک اندازه در پیش‌بینی SUS نقش دارند — این نشانهٔ «سازهٔ یکپارچه» است.</div>
  `,

  'chart-l3-stems': `
    <strong>نوع نمودار:</strong> جنگل سه‌بعدی RMSE — مقایسهٔ ۳ روش (PLS-SEM، LM، IA) در ۳۰ شاخص<br>
    <strong>قاعده:</strong> RMSE کمتر = پیش‌بینی دقیق‌تر<br>
    <strong>یافته:</strong> در تمام ۳۰ شاخص، PLS کمترین RMSE را دارد<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    برای هر شاخص (محور X)، سه نقطه در سه ردیف (محور Y) دیده می‌شود. نقطهٔ ردیف PLS-SEM همیشه پایین‌ترین (کمترین RMSE) است. IA بالاترین RMSE را دارد. LM در وسط قرار می‌گیرد.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> طبق استاندارد Shmueli et al. (2019)، اگر PLS در تمام شاخص‌ها RMSE کمتری از LM داشته باشد، مدل «قدرت پیش‌بینی متوسط تا قوی» دارد. این یافته یعنی PLS-SEM ما در پیش‌بینی داده‌های جدید از رگرسیون خطی و میانگین ساده بهتر عمل می‌کند — توجیه قوی برای استفاده از PLS به‌جای روش‌های ساده‌تر.</div>
  `,

  'chart-l3-landscape': `
    <strong>نوع نمودار:</strong> چشم‌انداز RMSE — نمایش پیوستهٔ RMSE در ۳۰ شاخص × ۳ روش<br>
    <strong>مقیاس رنگ:</strong> تیره = RMSE کم (دقیق) · روشن = RMSE زیاد (غیردقیق)<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    ردیف PLS-SEM (y=۰) تیره‌ترین است — بهترین پیش‌بینی. ردیف IA (y=۲) روشن‌ترین است — بدترین پیش‌بینی. ردیف LM (y=۱) در وسط قرار دارد. چند «قلهٔ روشن» در ردیف IA (شاخص‌های ۲ و ۴) دیده می‌شود — یعنی IA در این شاخص‌ها خطای بسیار بالایی دارد.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار نشان می‌دهد که «برتری PLS» در همهٔ شاخص‌ها یکنواخت است، نه اینکه فقط در چند شاخص برنده باشد. اگر PLS فقط در بخشی از شاخص‌ها برنده بود، تفسیر «برتری کلی» مشکل می‌شد. یکنواختی رنگ تیره در ردیف PLS = «برتری سیستماتیک».</div>
  `,

  'chart-l3-ridge': `
    <strong>نوع نمودار:</strong> پشتهٔ Q² — توزیع چگالی Q² در ۳۰ شاخص به‌صورت سطح سه‌بعدی<br>
    <strong>قله‌ها:</strong> نواحی روشن‌تر = Q² بالاتر<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    دو «قله» اصلی در نمودار دیده می‌شود: یکی در اطراف شاخص‌های PR (Q1-Q11) و یکی در اطراف شاخص‌های SUS (Q21-Q30). سازهٔ DT (Q12-Q20) Q² پایین‌تری دارد.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این «توپوگرافی Q²» نشان می‌دهد که کدام خانواده‌های شاخص «قدرت پیش‌بینی هم‌خانواده» دارند. یعنی Q² بین شاخص‌های یک سازه همبسته است — این نتیجه از همبستگی درونی سازه (پایایی بالا) می‌آید. اگر Q² بین شاخص‌های یک سازه پراکنده بود، به معنی ناهمگونی درون‌سازه‌ای بود که با Cronbach α بالای ۰.۹۴ سازگار نیست.</div>
  `,

  'chart-l3-cvpat': `
    <strong>نوع نمودار:</strong> سطح CVPAT — آزمون توان پیش‌بینی متقابل (Cross-Validated Predictive Ability Test)<br>
    <strong>ردیف ۱:</strong> Δ PLS − IA · <strong>ردیف ۲:</strong> Δ PLS − LM<br>
    <strong>تفسیر Δ:</strong> Δ منفی = PLS خطای کمتری دارد (برنده) · Δ مثبت = رقیب برنده<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    تمام ۸ خانه (۴ سازه × ۲ مقایسه) رنگ قرمز/نارنجی دارند یعنی Δ منفی. بیشترین برتری: PR با Δ=−۰.۱۷۸ در برابر IA و Δ=−۰.۰۵۷ در برابر LM. کمترین برتری: DT با Δ=−۰.۰۸۵ (در برابر IA).<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> CVPAT آزمون رسمی «آیا PLS واقعاً بهتر است؟» است. طبق Liengaard et al. (2021)، Δ منفی + p<۰.۰۵ = «برتری معنادار». تمام ۸ خانه Δ<۰ و p<۰.۰۵ دارند — یعنی PLS-SEM ما در پیش‌بینی همهٔ ۴ سازه از IA و LM معنادار بهتر است. این «تأیید نهایی» برای استفاده از PLS به‌جای رگرسیون است.</div>
  `,

  'chart-l3-ridgeline': `
    <strong>نوع نمودار:</strong> توزیع خطا — منحنی چگالی خطای پیش‌بینی برای ۳۰ شاخص<br>
    <strong>پارامترها:</strong> μ (میانگین خطا) و σ (پهنای منحنی)<br>
    <strong>منحنی باریک:</strong> خطای کم (دقیق) · منحنی پهن: خطای زیاد<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    همهٔ منحنی‌ها مرکز خود را نزدیک صفر دارند (μ≈−۰.۰۲) — یعنی «خطای سیستماتیک» وجود ندارد. برخی منحنی‌ها (Q21-Q30 و Q22-Q26) پهن‌ترند و برخی (Q13-Q14) باریک‌تر — یعنی دقت پیش‌بینی درون سازه‌ها یکنواخت نیست.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> منحنی‌های باریک = «پیش‌بینی دقیق و قابل اعتماد» (شاخص‌های آماده برای تصمیم‌گیری سیاستی). منحنی‌های پهن = «پیش‌بینی با عدم قطعیت بیشتر» (نیاز به داده بیشتر یا مدل دقیق‌تر). مرکز همه نزدیک صفر بودن یعنی «بایاس سیستماتیک» نداریم — ویژگی کلیدی برای اعتبار پیش‌بینی.</div>
  `,

  'chart-l3-scatter': `
    <strong>نوع نمودار:</strong> پراکندگی RMSE — PLS (محور Y) در برابر LM (محور X)<br>
    <strong>خط y=x:</strong> اگر نقطه‌ای زیر خط باشد، PLS بهتر است<br>
    <strong>اندازه نقطه:</strong> نسبی با SD · رنگ: Q²<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    تمام ۳۰ نقطه زیر خط y=x هستند — یعنی در هیچ شاخصی LM بهتر از PLS نیست. نقاط با Q² بالاتر (رنگ تیره‌تر) معمولاً در سمت چپ-پایین (RMSE کمتر در هر دو روش) قرار دارند — یعنی Q² بالا با RMSE کم همبسته است.<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار «برتری یکنواخت PLS» را بصری اثبات می‌کند. اگر حتی یک نقطه بالای خط y=x بود، یعنی در آن شاخص LM بهتر بود و باید به‌صورت موردی بررسی می‌شد. نبود چنین نقطه‌ای = «برتری قطعی PLS در تمام حوزه‌ها».</div>
  `,

  'chart-l3-forest': `
    <strong>نوع نمودار:</strong> Forest Plot CVPAT — Δ PLS در برابر IA و LM با بازهٔ اطمینان ۹۵٪<br>
    <strong>خط قرمز صفر:</strong> اگر CI صفر را قطع نکند → Δ معنادار است<br><br>
    <em>چه می‌بینیم و چرا؟</em><br>
    هر ۸ بازهٔ اطمینان (۴ سازه × ۲ مقایسه) کاملاً سمت چپ صفر هستند — یعنی PLS در همهٔ ۸ مقایسه معنادار برنده است. PR با Δ≈−۰.۱۸ و −۰.۰۶ بیشترین فاصله از صفر را دارد (برتری قوی‌تر).<br>
    <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> Forest Plot CVPAT «مهم‌ترین نمودار» برای توصیهٔ روش‌شناسی است: نه‌تنها Δ منفی است، بلکه «کل بازهٔ اطمینان» منفی است — یعنی حتی در بدترین سناریو (بالای CI)، PLS همچنان بهتر است. این سطح از اطمینان، توصیه به استفاده از PLS-SEM را برای پژوهش‌های آتی در همین حوزه توجیه می‌کند.</div>
  `
};

/* ================================================================
   MAIN_CHART_INTS_EN — 28 charts — English
   ================================================================ */
const MAIN_CHART_INTS_EN = {
  'chart-desc-gender': `
    <strong>Chart type:</strong> Pie chart — gender distribution (absolute and relative frequency)<br>
    <strong>n = 250</strong> · Missing: zero<br><br>
    <em>What we see and why:</em><br>
    100% of the sample (250 individuals) are women. This is natural because the target population is defined as "rural women carpet weavers in Mashhad and its surroundings".<br>
    <div class="reason-text"><strong>Link to research goal:</strong> This single-gender composition eliminates gender as a source of CATE heterogeneity. Any heterogeneity discovered by the Causal Forest therefore comes from geographic-economic factors, not gender. This transparency is critical for interpreting the causal-ML findings.</div>
  `,

  'chart-desc-age': `
    <strong>Chart type:</strong> Bar chart — age distribution in 4 categories<br>
    <strong>Distribution:</strong> Under 29 = 6 (2.4%) · 30-39 = 90 (36%) · 40-49 = 111 (44.4%) · Over 50 = 43 (17.2%)<br>
    <strong>Statistics:</strong> Mean=2.76 · SD=0.758 · Skew=0.089 · Kurt=-0.676<br><br>
    <em>What we see and why:</em><br>
    80% of the sample is in the 30-49 age range — the "peak entrepreneurial activity window". The distribution is symmetric (Skew≈0), and the mild negative kurtosis (Kurt=-0.676) indicates a wide range without outliers.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> Concentration in the peak economic activity range strengthens generalizability of the results to the actual population of carpet weavers. If the sample were dominated by very young or elderly women, the effect of digital transformation on sustainability would likely differ.</div>
  `,

  'chart-desc-edu': `
    <strong>Chart type:</strong> Horizontal bar chart — education distribution<br>
    <strong>Distribution:</strong> Vocational or lower = 151 (60.4%) · Bachelor = 88 (35.2%) · Master = 11 (4.4%)<br>
    <strong>Statistics:</strong> Mean=1.44 · SD=0.579 · Skew=0.923<br><br>
    <em>What we see and why:</em><br>
    60% of the sample has vocational education or lower, and only 11 individuals (4.4%) have graduate education. Positive skew (0.923) indicates the main mass lies on the "lower education" side.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> Low formal education makes "cultural capital" (one of the four dimensions of HG) more determining. Because formal education is low, local social networks and informal cultural capital — embedded in HG — become the primary drivers of entrepreneurship. This contextually justifies the β=0.542 on HG→PR.</div>
  `,

  'chart-desc-distance': `
    <strong>Chart type:</strong> Bar chart — spatial distance from village to Mashhad (km)<br>
    <strong>Distribution:</strong> Under 39=31 (12.4%) · 40-59=120 (48%) · 60-79=39 (15.6%) · 80-99=25 (10%) · 100-119=15 (6%) · Over 120=20 (8%)<br>
    <strong>Statistics:</strong> Mean=2.73 · SD=1.404 (highest dispersion) · Skew=1.048<br><br>
    <em>What we see and why:</em><br>
    The most frequent category is 40-59 km (48%) — half of the sample lives near the city. Only 8% live beyond 120 km. Positive skew (1.048) confirms the sample leans toward "near city".<br>
    <div class="reason-text"><strong>Link to research goal:</strong> Spatial distance is the core dimension of HG. The dispersion (SD=1.4) is exactly the prerequisite for discovering CATE heterogeneity: if all women had the same distance, Causal Forest could not reveal HG's moderating effect. High dispersion = "sufficient variety for machine learning".</div>
  `,

  'chart-desc-cost': `
    <strong>Chart type:</strong> Bar chart — commuting cost distribution (thousand tomans)<br>
    <strong>Distribution:</strong> Under 100=31 (12.4%) · 100-200=120 (48%) · 200-300=39 (15.6%) · 300-400=25 (10%) · 400-500=21 (8.4%) · Over 500=14 (5.6%)<br>
    <strong>Statistics:</strong> Mean=2.71 · SD=1.356 · Skew=0.991<br><br>
    <em>What we see and why:</em><br>
    Cost distribution closely mirrors distance (r≈0.98). 60% of the sample pays under 200 thousand tomans monthly, and 5.6% pay over 500 thousand.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> The very high correlation with distance confirms both are dimensions of the same HG construct. In moderation and Causal Forest analyses, this correlation is managed through low VIF values (<5), avoiding variance inflation.</div>
  `,

  'chart-desc-sd': `
    <strong>Chart type:</strong> Barpolar — standard deviation comparison of 5 background variables<br>
    <strong>SD values:</strong> Gender=0.000 · Age=0.758 · Education=0.579 · Distance=1.404 · Cost=1.356<br><br>
    <em>What we see and why:</em><br>
    Distance (1.404) and cost (1.356) have the highest dispersion — meaning the sample is highly heterogeneous in "geographic access". Age and education are moderate, and gender is zero (single-gender sample).<br>
    <div class="reason-text"><strong>Link to research goal:</strong> This chart displays the "statistical prerequisite" for heterogeneity analysis: high HG dispersion means "sufficient range for CATE discovery". If SD of distance were small, Causal Forest could not separate HG quartiles with significant differences.</div>
  `,

  'chart-l1-path': `
    <strong>Chart type:</strong> Structural path diagram — PLS Algorithm (model fit)<br>
    <strong>Constructs:</strong> PR (prerequisites), DT (digital transformation), SUS (sustainability), HG (human geography) + QE (quadratic effect) + two interactions HG×PR and HG×DT<br><br>
    <em>What we see and why:</em><br>
    The strongest path is <strong>HG→PR with β=0.542</strong>; the weakest is <strong>QE→SUS with β=0.026 (non-significant)</strong>. QE paths use red dotted lines to visually distinguish them as quadratic effects.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> This diagram is the "road map" of the whole model. At a glance: (1) HG directly affects PR, DT, and SUS; (2) DT mediates PR→SUS; (3) both HG×PR and HG×DT interactions are valid; (4) the quadratic QE effect on PR and SUS is rejected. This layout is the basis for all later analyses.</div>
  `,

  'chart-l1-beta-bar': `
    <strong>Chart type:</strong> Horizontal bar — path coefficients (β) for 11 structural paths<br>
    <strong>Color:</strong> Green = significant (CI excludes zero) · Gray = non-significant<br>
    <strong>Key values:</strong> HG→PR=0.542 (strongest) · DT→SUS=0.374 · HG→DT=0.274 · PR→SUS=0.231 · QE→SUS=0.026 (weakest)<br><br>
    <em>What we see and why:</em><br>
    Ascending β order shows HG, DT, PR paths at the top (β>0.2), while QE paths stay near zero. Two QE paths (QE→PR: CI -0.035 to 0.108; QE→SUS: CI -0.064 to 0.116) cross zero and are gray.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> This chart summarizes the "hierarchy of effects": HG is the strongest driver, DT next, and the QE nonlinear effect is effectively dismissed. Policy implication: target geography first, because HG has both the largest direct and moderating effects.</div>
  `,

  'chart-l1-r2': `
    <strong>Chart type:</strong> 3D surface — R² and R²-Adjusted for three endogenous constructs<br>
    <strong>Values:</strong> R²(DT)=0.278 · R²(SUS)=0.489 · R²(PR)=0.288 · All R²-R²Adj differences <0.02<br><br>
    <em>What we see and why:</em><br>
    SUS has the highest R² (0.489) because three direct paths (PR, DT, HG) and two interaction paths converge on it. DT and PR are both around 0.28.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> By Chin (1998), R²>0.67 is substantial, 0.33-0.67 moderate, 0.19-0.33 weak. SUS is "moderate to substantial" (0.489) and DT/PR "weak to moderate". The model explains a meaningful portion of sustainability variance — meaning HG, PR, DT are genuine predictors of sustainability.</div>
  `,

  'chart-l1-f2': `
    <strong>Chart type:</strong> Bar chart — Cohen's f² effect size for 11 structural paths<br>
    <strong>Thresholds (Cohen 1988):</strong> 0.02 = small · 0.15 = medium · 0.35 = large<br>
    <strong>Values:</strong> HG→PR=0.403 (large) · DT→SUS=0.210 (medium) · HG→DT=0.072 (small) · HG×PR→DT=0.065 · QE→SUS=0.002 (negligible)<br><br>
    <em>What we see and why:</em><br>
    Only one path (HG→PR) has a "large" effect and one (DT→SUS) a "medium" effect. Seven paths are "small" and two QE paths "negligible". Of 11 paths, only 2 have substantial practical effect.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> f² complements p-value: p tells "whether an effect exists", f² tells "how large it is". Policy should focus resources on HG→PR and DT→SUS. Other paths are significant but practically small and should not be the funding priority.</div>
  `,

  'chart-l1-quality': `
    <strong>Chart type:</strong> 3D surface — 4 reliability/validity metrics (Cronbach α, rho_a, rho_c, AVE) for 4 constructs<br>
    <strong>Thresholds:</strong> Cronbach ≥0.7 · rho_a ≥0.7 · rho_c ≥0.7 · AVE ≥0.5<br>
    <strong>Values:</strong> All 16 cells above thresholds. Minimum AVE: SUS=0.689 · Maximum rho_c: HG=0.973<br><br>
    <em>What we see and why:</em><br>
    All 4 constructs have Cronbach α above 0.94 and AVE above 0.68, meaning (1) items are strongly inter-correlated (excellent internal reliability) and (2) each construct explains over 68% of its items' variance (strong convergent validity).<br>
    <div class="reason-text"><strong>Link to research goal:</strong> Without reliability and validity, no structural model results are trustworthy. This chart is the "entry pass" to later analyses: because all constructs pass thresholds, we can trust β, p-values, and R².</div>
  `,

  'chart-l1-loadings': `
    <strong>Chart type:</strong> 3D surface — outer loadings of 46 indicators on their constructs<br>
    <strong>Threshold:</strong> λ ≥ 0.7 (Hair et al. 2022)<br>
    <strong>Values:</strong> Minimum Q39=0.766 (HG) · Maximum Q4=0.893 (PR) · Median ≈0.84<br><br>
    <em>What we see and why:</em><br>
    All 46 indicators have loadings above 0.76 — none requires removal. HG (16 items) and PR (11 items) have the highest loadings. PR has the smallest dispersion (0.786-0.893).<br>
    <div class="reason-text"><strong>Link to research goal:</strong> High loadings mean the instrument is precise. If any indicator had loading <0.7, it would have been removed and the questionnaire revised. Since none was removed, all 46 items remain in the final model — the instrument is psychometrically sound and reusable in future research.</div>
  `,

  'chart-l1-vif': `
    <strong>Chart type:</strong> 3D surface — VIF for 49 indicators<br>
    <strong>Threshold:</strong> VIF <5 (Hair et al. 2022) · 3.3-5 = warning · ≥5 = critical<br>
    <strong>Values:</strong> Minimum Q28=2.225 (SUS) · Maximum Q36=4.167 (HG) · Mean=3.07<br><br>
    <em>What we see and why:</em><br>
    No indicator has VIF above 5. Q36 (VIF=4.167) and Q4 (VIF=4.142) are closest to the threshold but still below. Over 90% of indicators have VIF under 4.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> Multicollinearity inflates standard errors of β and reduces precision of p-values. Since all VIFs are under 5, we can fully trust β=0.542 and p<0.001 on HG→PR. If VIF were >5, overlapping indicators would need removal and results would change.</div>
  `,

  'chart-l1-htmt': `
    <strong>Chart type:</strong> HTMT matrix — Heterotrait-Monotrait ratio (Henseler et al. 2015)<br>
    <strong>Threshold:</strong> HTMT <0.85 (conservative) or <0.90 (liberal)<br>
    <strong>Maximum value:</strong> QE ↔ HG×PR = 0.679 (below both thresholds)<br><br>
    <em>What we see and why:</em><br>
    The highest HTMT is between QE and HG×PR (0.679), which is expected since both are derived constructs of HG and PR. All other values are below 0.6. No cell exceeds 0.7.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> HTMT tests discriminant validity: are constructs truly distinct or do they "consume" each other? All values below 0.85 confirm distinctness. This licenses interpreting βs as "distinct effects".</div>
  `,

  'chart-l1-slopes': `
    <strong>Chart type:</strong> Simple slopes — visual moderation of HG×PR→DT (left) and HG×DT→SUS (right)<br>
    <strong>3 lines per panel:</strong> Moderator at low (-1SD), mean, and high (+1SD)<br><br>
    <em>What we see and why:</em><br>
    <strong>Left panel (HG×PR→DT):</strong> The slope for "high PR" is clearly steeper than "low PR" — when PR is high, the effect of HG on DT is stronger.<br>
    <strong>Right panel (HG×DT→SUS):</strong> The same pattern — when DT is high, HG's effect on SUS is stronger.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> Divergent slopes are visual proof of moderation: HG's effect is not constant but depends on PR (or DT). This is the same finding as H4a and H4c. If slopes were parallel, no moderation would exist. Policy implication: strengthen HG and PR simultaneously, not separately.</div>
  `,

  'chart-l1-raincloud': `
    <strong>Chart type:</strong> Raincloud — latent score distribution of 3 constructs (DT, SUS, PR)<br>
    <strong>Components:</strong> Half-violin (density) + box (quartiles) + scatter (individual observations)<br><br>
    <em>What we see and why:</em><br>
    All three constructs have symmetric bell-shaped distributions. Medians are near zero. All three span approximately -3 to +3. No severe outliers.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> This chart shows "distributional health". Symmetric distributions confirm bootstrap assumptions (normal sampling distribution) and validate confidence intervals. If distributions were severely skewed, Percentile Bootstrap would need more caution.</div>
  `,

  'chart-l2-forest': `
    <strong>Chart type:</strong> Forest Plot — path coefficients with 95% CI (Percentile Bootstrap, 5,000 subsamples)<br>
    <strong>Paths:</strong> 11 paths sorted by β<br>
    <strong>Decision rule:</strong> If CI does not cross zero → significant<br><br>
    <em>What we see and why:</em><br>
    9 of 11 paths have CIs not crossing zero (significant). Two QE paths (QE→PR: CI -0.035 to 0.108; QE→SUS: CI -0.064 to 0.116) cross zero (non-significant). CI width varies: HG→PR narrowest, HG×PR→DT widest.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> Forest Plot is the gold standard for transparent reporting. Narrow CI (HG→PR) = precise estimate; wide CI (interactions) = more uncertainty yet still significant. The chart shows at a glance which hypotheses are confirmed (9 paths) and which are rejected (2 QE paths), without needing the table.</div>
  `,

  'chart-l2-sig': `
    <strong>Chart type:</strong> 3D significance landscape — β × T × -log10(p)<br>
    <strong>Green circles:</strong> significant (p<0.05) · <strong>Red X:</strong> non-significant<br>
    <strong>Z-axis:</strong> −log10(p) — higher = more significant<br><br>
    <em>What we see and why:</em><br>
    HG→PR has the highest position on all three axes (β=0.542, T=11.37, −log10(p)≈13). QE paths are at the bottom of the Z-axis (p>0.05) and marked with X.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> This chart combines the "decision triad" into a single view: not just "is it significant?" (p), but "how large?" (β) and "how confident?" (T). Policy sees at a glance that HG→PR sits in the "golden corner" (high β, high T, low p), while QE→SUS is in the "dead corner".</div>
  `,

  'chart-l2-landscape': `
    <strong>Chart type:</strong> Colored bar chart based on T — path coefficients with T intensity coloring<br>
    <strong>Color scale:</strong> Dark green = high T (strongly significant) · Red = low T (non-significant)<br><br>
    <em>What we see and why:</em><br>
    Tall bars (high β) are dark green — β and T align. Exception: HG×PR→DT has a medium bar with relatively dark green since T=3.5, while PR→SUS (similar β) has a lower T.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> This chart complements the Forest Plot: instead of confidence intervals, it displays "strength of evidence". Interaction paths (HG×PR→DT, HG×DT→SUS) have medium β but high T because their effect, despite complexity, is very stable — confirming that HG moderation is a "real effect", not noise.</div>
  `,

  'chart-l3-q2': `
    <strong>Chart type:</strong> 3D column chart of Q²predict for 30 indicators<br>
    <strong>Thresholds (Hair et al. 2022):</strong> Q²>0.10 strong · 0<Q²<0.10 moderate · Q²<0 weak<br>
    <strong>Key values:</strong> Minimum Q13=0.083 · Maximum Q4=0.247 · Mean=0.158<br><br>
    <em>What we see and why:</em><br>
    All 30 indicators have Q²>0.08 — positive out-of-sample predictive power. 27 indicators have Q²>0.10 (strong) and 4 (Q13, Q14, Q18, Q19) are between 0.08 and 0.10 (moderate). The green line marks the 0.10 threshold.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> Q² measures prediction, not explanation. Even with high R², if Q² is low, the model fails on new data. Because Q² is positive and mostly >0.10, the model is generalizable and usable in future research. Q4 (the strongest PR indicator) has the highest Q² — the strongest PR item also has the most precise prediction.</div>
  `,

  'chart-l3-q2-2': `
    <strong>Chart type:</strong> Filtered version of Q² — user can select indicators from the filter above<br>
    <strong>Same logic as before:</strong> thresholds at 0.10 and 0<br><br>
    <em>What we see and why:</em><br>
    Changing the indicator filter updates the Q² columns. This lets the researcher focus on a single construct (e.g., only PR: Q1-Q11) and see the Q² distribution within it.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> This is a sensitivity analysis: is predictive power dependent on a specific indicator, or is Q² uniform within each construct? If Q² is uniform within PR, all 11 PR items contribute equally to predicting SUS — evidence of an "integrated construct".</div>
  `,

  'chart-l3-stems': `
    <strong>Chart type:</strong> 3D RMSE forest — 3 methods (PLS-SEM, LM, IA) across 30 indicators<br>
    <strong>Rule:</strong> Lower RMSE = more accurate prediction<br>
    <strong>Finding:</strong> PLS has the lowest RMSE in all 30 indicators<br><br>
    <em>What we see and why:</em><br>
    For each indicator (X axis), three points appear in three rows (Y axis). The PLS-SEM row is always at the bottom (lowest RMSE). IA has the highest RMSE. LM sits in between.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> By Shmueli et al. (2019), if PLS has lower RMSE than LM in all indicators, the model has "moderate to strong predictive power". This finding means PLS-SEM outperforms linear regression and simple mean in predicting new data — strong justification for using PLS over simpler methods.</div>
  `,

  'chart-l3-landscape': `
    <strong>Chart type:</strong> RMSE landscape — continuous view of RMSE across 30 indicators × 3 methods<br>
    <strong>Color scale:</strong> Dark = low RMSE (accurate) · Light = high RMSE (inaccurate)<br><br>
    <em>What we see and why:</em><br>
    The PLS-SEM row (y=0) is darkest — best predictions. The IA row (y=2) is lightest — worst predictions. The LM row (y=1) is in between. Several "bright peaks" in the IA row (indicators 2 and 4) show IA has extremely high errors there.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> The chart shows that "PLS superiority" is uniform across all indicators, not driven by a few. If PLS won only in some indicators, interpreting "overall superiority" would be difficult. Uniform darkness in the PLS row = "systematic superiority".</div>
  `,

  'chart-l3-ridge': `
    <strong>Chart type:</strong> Q² ridge — density distribution of Q² across 30 indicators in 3D surface<br>
    <strong>Peaks:</strong> Brighter regions = higher Q²<br><br>
    <em>What we see and why:</em><br>
    Two main peaks appear: one around PR indicators (Q1-Q11) and one around SUS indicators (Q21-Q30). The DT construct (Q12-Q20) has lower Q².<br>
    <div class="reason-text"><strong>Link to research goal:</strong> This "Q² topography" shows which indicator families have "same-family predictive power" — Q² is correlated within each construct, a result of high internal reliability. If Q² were scattered within a construct, that would signal within-construct heterogeneity inconsistent with Cronbach α above 0.94.</div>
  `,

  'chart-l3-cvpat': `
    <strong>Chart type:</strong> CVPAT surface — Cross-Validated Predictive Ability Test<br>
    <strong>Row 1:</strong> Δ PLS − IA · <strong>Row 2:</strong> Δ PLS − LM<br>
    <strong>Interpretation of Δ:</strong> Negative = PLS has lower loss (winner) · Positive = competitor wins<br><br>
    <em>What we see and why:</em><br>
    All 8 cells (4 constructs × 2 comparisons) are red/orange, i.e., Δ negative. Largest advantage: PR with Δ=-0.178 vs IA and Δ=-0.057 vs LM. Smallest advantage: DT with Δ=-0.085 (vs IA).<br>
    <div class="reason-text"><strong>Link to research goal:</strong> CVPAT is the formal test "is PLS really better?". By Liengaard et al. (2021), Δ negative + p<0.05 = significant superiority. All 8 cells have Δ<0 and p<0.05 — PLS-SEM significantly outperforms IA and LM in predicting all 4 constructs. This is the final confirmation to use PLS over regression.</div>
  `,

  'chart-l3-ridgeline': `
    <strong>Chart type:</strong> Error distribution — density curves of prediction error for 30 indicators<br>
    <strong>Parameters:</strong> μ (mean error) and σ (curve width)<br>
    <strong>Narrow curve:</strong> low error (accurate) · Wide curve: high error<br><br>
    <em>What we see and why:</em><br>
    All curves center near zero (μ≈-0.02) — no systematic bias. Some curves (Q21-Q30, Q22-Q26) are wider and others (Q13-Q14) narrower — prediction accuracy varies within constructs.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> Narrow curves = "accurate and reliable prediction" (indicators ready for policy decisions). Wide curves = "prediction with more uncertainty" (need more data or better model). All centers near zero = no systematic bias, a key validity property of prediction.</div>
  `,

  'chart-l3-scatter': `
    <strong>Chart type:</strong> RMSE scatter — PLS (Y) vs LM (X)<br>
    <strong>y=x line:</strong> A point below the line means PLS is better<br>
    <strong>Point size:</strong> Proportional to SD · Color: Q²<br><br>
    <em>What we see and why:</em><br>
    All 30 points are below y=x — LM never beats PLS. Points with higher Q² (darker color) tend toward the lower-left (lower RMSE in both methods) — high Q² correlates with low RMSE.<br>
    <div class="reason-text"><strong>Link to research goal:</strong> This chart visually proves "uniform PLS superiority". If even one point were above the y=x line, that indicator would require case-by-case review. The absence of such a point = "unambiguous PLS dominance across all domains".</div>
  `,

  'chart-l3-forest': `
    <strong>Chart type:</strong> CVPAT Forest Plot — Δ PLS vs IA and LM with 95% CI<br>
    <strong>Red line at zero:</strong> If CI excludes zero → Δ is significant<br><br>
    <em>What we see and why:</em><br>
    All 8 confidence intervals (4 constructs × 2 comparisons) lie entirely left of zero — PLS significantly wins in all 8 comparisons. PR with Δ≈-0.18 and -0.06 has the largest distance from zero (stronger advantage).<br>
    <div class="reason-text"><strong>Link to research goal:</strong> CVPAT Forest Plot is the most important chart for the methodological recommendation: not only is Δ negative, but the entire CI is negative — even in the worst case (CI upper bound), PLS is still better. This level of confidence justifies recommending PLS-SEM for future research in this domain.</div>
  `
};

/* ================================================================
   MAIN_TABLE_INTS (FA) — 3 tables — Persian
   ================================================================ */
const MAIN_TABLE_INTS = {
  'vif-table-container': {
    title: 'جدول VIF — عامل تورم واریانس',
    text: `
      <strong>نوع آزمون:</strong> VIF (Variance Inflation Factor) برای بررسی هم‌خطی چندگانه بین ۴۹ شاخص و ۳ سازهٔ تعاملی<br>
      <strong>آستانه‌ها:</strong> VIF < ۵ (Hair et al. 2022) — زیر ۵ = بدون مشکل · ۳.۳ تا ۵ = هشدار · ≥ ۵ = بحرانی<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      تمام ۴۹ شاخص VIF زیر ۵ دارند — هیچ‌کدام در ناحیهٔ «هشدار» یا «بحرانی» نیستند. بالاترین مقدار مربوط به Q36=۴.۱۶۷ (سازهٔ HG) و Q4=۴.۱۴۲ (سازهٔ PR) است. میانگین VIF=۳.۰۷ که در محدودهٔ «قابل قبول تا خوب» قرار دارد. سازه‌های تعاملی (QE، HG×PR، HG×DT) با VIF=۱.۰۰۰ در پایین جدول قرار دارند چون اثرات درجه دوم و تعاملی معمولاً کمترین هم‌خطی را با شاخص‌های خطی دارند.<br><br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> هم‌خطی چندگانه باعث «تورم خطای استاندارد β» و «بی‌ثباتی ضرایب» می‌شود. اگر VIF بالای ۵ داشتیم، نمی‌توانستیم به βها به‌عنوان «اثرات متمایز» اعتماد کنیم. چون تمام VIFها زیر ۵ هستند، تفسیر βها (مثلاً HG→PR=۰.۵۴۲ به‌عنوان «قوی‌ترین محرک») از نظر آماری معتبر است. بیشترین VIF در Q36 و Q4 نشان می‌دهد این دو گویه بیشترین هم‌پوشانی محتوایی را با سایر گویه‌های سازه دارند — در پژوهش‌های آتی شاید بازنگری محتوایی این دو گویه مفید باشد، اما حذف آن‌ها ضروری نیست.</div>
    `
  },
  'reliability-container': {
    title: 'جداول پایایی و روایی (۴ جدول تلفیقی)',
    text: `
      <strong>نوع آزمون:</strong> چهار معیار استاندارد ارزیابی مدل اندازه‌گیری در PLS-SEM<br>
      <strong>جدول ۱:</strong> پایایی شاخص (λ و λ²) · <strong>جدول ۲:</strong> پایایی و روایی همگرا (Cronbach، rho_a، rho_c، AVE)<br>
      <strong>جدول ۳:</strong> روایی واگرا با بارهای متقابل · <strong>جدول ۴:</strong> معیار فرنل-لارکر<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      <strong>جدول ۱:</strong> همهٔ ۴۶ بار عاملی بالای ۰.۷۶ هستند (بالاتر از آستانهٔ ۰.۷). سازهٔ PR کمترین پراکندگی (۰.۷۸۶-۰.۸۹۳) و HG بیشترین دامنه (۰.۷۶۶-۰.۸۸۱) را دارد.<br>
      <strong>جدول ۲:</strong> Cronbach α بین ۰.۹۴۷ تا ۰.۹۷۱ · rho_a بین ۰.۹۴۸ تا ۰.۹۷۲ · rho_c بین ۰.۹۵۵ تا ۰.۹۷۳ · AVE بین ۰.۶۸۹ تا ۰.۷۳۹. همه بسیار بالاتر از آستانه‌ها (۰.۷ و ۰.۵).<br>
      <strong>جدول ۳:</strong> در تمام ۷ سازه، بار خودی حداقل > بار متقابل حداکثر — یعنی هر گویه به سازهٔ خودی خود بیشتر از سایر سازه‌ها تعلق دارد.<br>
      <strong>جدول ۴:</strong> √AVE روی قطر (۰.۸۳۰ تا ۰.۸۵۹) همگی بزرگ‌تر از همبستگی‌های زیرین خودشان هستند.<br><br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این چهار جدول «چک‌لیست کیفیت ابزار اندازه‌گیری» هستند. سه شرط اساسی: (۱) پایایی — Cronbach α > ۰.۷ ✅ (همه > ۰.۹۴) · (۲) روایی همگرا — AVE > ۰.۵ ✅ (همه > ۰.۶۸) · (۳) روایی واگرا — √AVE > همبستگی ✅ (جدول ۴). یعنی ابزار پژوهش از نظر روان‌سنجی «بی‌نقص» است. بدون این تأیید، تفسیر βها و CATE معنادار نبود. اکنون می‌توان با اطمینان گفت: «سازه‌های PR، DT، SUS و HG واقعاً چهار سازهٔ مستقل با اندازه‌گیری دقیق هستند».</div>
    `
  },
  'desc-stats-table-container': {
    title: 'جدول آماره‌های توصیفی متغیرهای زمینه‌ای',
    text: `
      <strong>نوع آزمون:</strong> آمار توصیفی — میانگین، انحراف معیار، چولگی، کشیدگی، دامنه<br>
      <strong>متغیرها:</strong> ۵ متغیر زمینه‌ای (جنسیت، سن، تحصیلات، فاصله، هزینه)<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      <strong>جنسیت:</strong> N=۲۵۰، Mean=۱.۰۰، SD=۰ (نمونهٔ تک‌جنس) · Skew و Kurt نامشخص<br>
      <strong>سن:</strong> Mean=۲.۷۶، SD=۰.۷۵۸، Skew=۰.۰۸۹ (متقارن)، Kurt=-۰.۶۷۶ (دامنهٔ پهن)<br>
      <strong>تحصیلات:</strong> Mean=۱.۴۴، SD=۰.۵۷۹، Skew=۰.۹۲۳ (چولگی مثبت به سمت تحصیلات پایین)<br>
      <strong>فاصله:</strong> Mean=۲.۷۳، SD=۱.۴۰۴ (بالاترین پراکندگی)، Skew=۱.۰۴۸<br>
      <strong>هزینه:</strong> Mean=۲.۷۱، SD=۱.۳۵۶، Skew=۰.۹۹۱ (توزیع آینه‌وار با فاصله)<br>
      در هیچ متغیری داده گمشده گزارش نشده (Missing=۰).<br><br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> سه یافتهٔ کلیدی از این جدول برای تحلیل‌های بعدی: (۱) پراکندگی بالای فاصله و هزینه (SD>۱.۳) پیش‌نیاز کشف ناهمگونی CATE است — اگر این SD کوچک بود، Causal Forest نمی‌توانست چارک‌های HG را تفکیک کند. (۲) چولگی مثبت تحصیلات و فاصله نشان می‌دهد نمونه به سمت «تحصیلات پایین» و «نزدیک شهر» متمایل است که در تفسیر نتایج باید لحاظ شود. (۳) تقارن سن (Skew≈۰) تأیید می‌کند نمونه از نظر سنی نمایندهٔ جامعه است. این جدول، «پایهٔ آماری» تمام تحلیل‌های استنباطی (PLS، Causal Forest، مونت‌کارلو) را می‌سازد.</div>
    `
  }
};

/* ================================================================
   MAIN_TABLE_INTS_EN — 3 tables — English
   ================================================================ */
const MAIN_TABLE_INTS_EN = {
  'vif-table-container': {
    title: 'VIF Table — Variance Inflation Factor',
    text: `
      <strong>Test type:</strong> VIF (Variance Inflation Factor) for detecting multicollinearity among 49 indicators and 3 interaction constructs<br>
      <strong>Thresholds:</strong> VIF <5 (Hair et al. 2022) — under 5 = no issue · 3.3-5 = warning · ≥5 = critical<br><br>
      <em>What we see and why:</em><br>
      All 49 indicators have VIF below 5 — none fall in the "warning" or "critical" zone. The highest values are Q36=4.167 (HG) and Q4=4.142 (PR). Mean VIF=3.07, in the "acceptable to good" range. Interaction constructs (QE, HG×PR, HG×DT) with VIF=1.000 appear at the bottom because quadratic and interaction effects typically have the least collinearity with linear indicators.<br><br>
      <div class="reason-text"><strong>Link to research goal:</strong> Multicollinearity inflates β standard errors and destabilizes coefficients. If VIF were >5, we could not interpret βs as "distinct effects". Because all VIFs are under 5, interpreting βs (e.g., HG→PR=0.542 as "strongest driver") is statistically valid. Q36 and Q4 have the highest VIFs — these two items share the most content overlap with other items of the same construct. Future research might revisit their content, but removal is not required.</div>
    `
  },
  'reliability-container': {
    title: 'Reliability & Validity Tables (4 combined tables)',
    text: `
      <strong>Test type:</strong> Four standard criteria for assessing the measurement model in PLS-SEM<br>
      <strong>Table 1:</strong> Indicator reliability (λ and λ²) · <strong>Table 2:</strong> Reliability & convergent validity (Cronbach, rho_a, rho_c, AVE)<br>
      <strong>Table 3:</strong> Discriminant validity via cross-loadings · <strong>Table 4:</strong> Fornell-Larcker criterion<br><br>
      <em>What we see and why:</em><br>
      <strong>Table 1:</strong> All 46 factor loadings are above 0.76 (well above the 0.7 threshold). PR has the smallest dispersion (0.786-0.893) and HG the widest (0.766-0.881).<br>
      <strong>Table 2:</strong> Cronbach α between 0.947 and 0.971 · rho_a between 0.948 and 0.972 · rho_c between 0.955 and 0.973 · AVE between 0.689 and 0.739. All far above thresholds (0.7 and 0.5).<br>
      <strong>Table 3:</strong> In all 7 constructs, minimum own loading > maximum cross-loading — each item belongs to its own construct more than to others.<br>
      <strong>Table 4:</strong> Diagonal √AVE values (0.830-0.859) all exceed their underlying correlations.<br><br>
      <div class="reason-text"><strong>Link to research goal:</strong> These four tables form the "quality checklist" of the instrument. Three essential conditions: (1) reliability — Cronbach α>0.7 ✅ (all >0.94) · (2) convergent validity — AVE>0.5 ✅ (all >0.68) · (3) discriminant validity — √AVE>correlations ✅ (Table 4). The instrument is psychometrically flawless. Without this confirmation, interpreting β and CATE would be meaningless. Now we can assert with confidence: "PR, DT, SUS, HG are truly four independent, precisely-measured constructs."</div>
    `
  },
  'desc-stats-table-container': {
    title: 'Descriptive Statistics of Background Variables',
    text: `
      <strong>Test type:</strong> Descriptive statistics — mean, SD, skewness, kurtosis, range<br>
      <strong>Variables:</strong> 5 background variables (gender, age, education, distance, cost)<br><br>
      <em>What we see and why:</em><br>
      <strong>Gender:</strong> N=250, Mean=1.00, SD=0 (single-gender sample) · Skew and Kurt undefined<br>
      <strong>Age:</strong> Mean=2.76, SD=0.758, Skew=0.089 (symmetric), Kurt=-0.676 (wide range)<br>
      <strong>Education:</strong> Mean=1.44, SD=0.579, Skew=0.923 (positive skew toward lower education)<br>
      <strong>Distance:</strong> Mean=2.73, SD=1.404 (highest dispersion), Skew=1.048<br>
      <strong>Cost:</strong> Mean=2.71, SD=1.356, Skew=0.991 (mirror distribution of distance)<br>
      No variable reports missing data (Missing=0).<br><br>
      <div class="reason-text"><strong>Link to research goal:</strong> Three key findings feed into later analyses: (1) high dispersion of distance and cost (SD>1.3) is the prerequisite for discovering CATE heterogeneity — small SD would prevent Causal Forest from distinguishing HG quartiles; (2) positive skew in education and distance indicates the sample leans toward "low education" and "near city", which must be considered when interpreting results; (3) age symmetry (Skew≈0) confirms the sample is age-representative. This table is the "statistical foundation" of all inferential analyses (PLS, Causal Forest, Monte Carlo).</div>
    `
  }
};
/* ================================================================
   ADVANCED ANALYTICS — SHARED BUILDERS
   ================================================================ */
function downloadChart(elId, filename){
  const el = document.getElementById(elId);
  if (!el || !el.data) { alert(state.lang==='fa' ? 'چارت هنوز آماده نیست' : 'Chart not ready'); return; }
  Plotly.downloadImage(el, { format: 'png', filename: filename || elId, width: 1600, height: 1000, scale: 2 });
}
function buildAdvancedChartCard(opts){
  const badgesHtml = (opts.badges || []).map(b => `<span class="chart-badge badge-${b.type}">${b.label}</span>`).join('');
  const legendHtml = opts.legend ? `<div class="legend-table">${opts.legend}</div>` : '';
  const panelId = opts.id + '-panel';
  return `
    <div class="chart-card">
      <div class="chart-title"><span>${opts.title}</span><div>${badgesHtml}</div></div>
      <div id="${opts.id}" class="plot ${opts.height || ''}"></div>
      <div class="chart-toolbar">
        <button class="btn-interpretation" onclick="togglePanel('${panelId}', this)">
          <span class="icon-bulb">💡</span><span>${ti('show_btn')}</span>
        </button>
        <button class="dl-btn" onclick="downloadChart('${opts.id}', '${opts.id}')">${state.lang === 'fa' ? '⬇ دانلود PNG' : '⬇ Download PNG'}</button>
      </div>
      <div class="interpretation-panel" id="${panelId}">
        <div class="interpretation-content">
          <div class="interp-header"><span class="interp-header-icon">📊</span><span class="interp-title">${ti('title_chart')}</span></div>
          <div class="interp-body">
            <div class="interp-item">${opts.interp}</div>
            <div class="interp-item" style="border-right-color: #8e44ad;"><span class="interp-label">${ti('test_label')}:</span> ${opts.test}</div>
          </div>
        </div>
      </div>
      ${legendHtml}
      <div class="data-source"><strong>${state.lang === 'fa' ? '📁 منبع:' : '📁 Source:'}</strong> ${opts.source}</div>
    </div>
  `;
}
/* ================================================================
   DETAILED INTERPRETATIONS — Causal ML (CM 1-12)
   ================================================================ */
function cmInterp(n){
  const fa = {
    1: `
      <strong>نوع نمودار:</strong> هیستوگرام سه‌بعدی توزیع CATE (Conditional Average Treatment Effect) — ۲۵۰ تخمین اثر علّی شرطی<br>
      <strong>مقادیر کلیدی:</strong> دامنهٔ CATE = [۰.۲۷ , ۰.۵۶] · میانگین = ۰.۴۲ · انحراف معیار = ۰.۱۱<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      توزیع CATE <strong>دوقطبی (bimodal)</strong> است، نه زنگی. دو قلهٔ مشخص: یکی در حدود ۰.۲۷ (اثر ضعیف) و دیگری در حدود ۰.۵۶ (اثر قوی). بین این دو قله، «درهٔ» خالی وجود دارد — یعنی هیچ مشاهده‌ای دقیقاً «اثر متوسط ۰.۴۲» ندارد.<br>
      این یعنی نمونهٔ ۲۵۰ نفره به دو زیرگروه طبیعی تقسیم می‌شود: زنانی که تحول دیجیتال بر پایداری‌شان اثر <em>ضعیف</em> دارد و زنانی که اثر <em>قوی</em> دارد.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> «اثر متوسط ۰.۴۲» که در تحلیل‌های سنتی گزارش می‌شود، <strong>گمراه‌کننده</strong> است — چون هیچ‌کس واقعاً این اثر را تجربه نمی‌کند. این نمودار مهم‌ترین پیام مقاله را می‌رساند: <em>«میانگین، دروغ می‌گوید»</em>. سیاست‌گذاری مبتنی بر میانگین، نیمی از زنان را با مداخلهٔ اشتباه هدف می‌گیرد. باید به‌جای ATE (Average Treatment Effect)، به CATE (Conditional ATE) توجه کرد.</div>
    `,
    2: `
      <strong>نوع نمودار:</strong> نمودار CATE مرتب‌شده — ۲۵۰ تخمین به ترتیب صعودی<br>
      <strong>مقادیر کلیدی:</strong> پایین‌ترین = ۰.۲۷ · بالاترین = ۰.۵۶ · میانه = ۰.۴۲ · دامنه = ۰.۲۹<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      شکل <strong>پلکانی (stepwise)</strong> نمودار — نه یک منحنی نرم — نشان می‌دهد نمونه به‌طور طبیعی در دو یا سه گروه تجمع می‌کند. حدود ۱۳۰ نفر در بخش پایین (اثر ۰.۲۷ تا ۰.۴۰) و ۱۲۰ نفر در بخش بالا (اثر ۰.۴۵ تا ۰.۵۶) قرار دارند.<br>
      شیب تند در میانه نشان می‌دهد که «مرز» بین دو گروه تقریباً در CATE ≈ ۰.۴۲ است. این مرز، یک <em>آستانهٔ واقعی</em> است — نه مصنوعی.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این «پله» امکان <strong>هدف‌گیری دقیق</strong> را فراهم می‌کند: اگر بودجهٔ محدودی برای مداخلهٔ دیجیتال دارید، به‌جای توزیع یکنواخت، بر ۱۲۰ نفر بالای نمودار تمرکز کنید — چون هر ریال سرمایه‌گذاری روی آن‌ها ۲ برابر بازدهی دارد.</div>
    `,
    3: `
      <strong>نوع نمودار:</strong> ستون‌های سه‌بعدی CATE بر اساس چارک‌های HG (Human Geography)<br>
      <strong>مقادیر کلیدی:</strong> HG-Q1 = ۰.۳۳۳ · HG-Q2 = ۰.۳۸۷ · HG-Q3 = ۰.۴۵۰ · HG-Q4 = ۰.۵۳۳ · نسبت Q4/Q1 = <strong>۱.۶۰×</strong><br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      روند <strong>صعودی یکنوا</strong> است: هرچه HG بالاتر می‌رود، CATE به‌طور پیوسته افزایش می‌یابد. میله‌های رنگی از قرمز (Q1) به سبز (Q4) تغییر می‌کنند تا این روند بصری شود. نوارهای خطای سفید (SD) روی هر ستون نشان می‌دهد که تفاوت Q1 تا Q4 از نظر آماری معنادار است.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار، <strong>مستقیم‌ترین شاهد بر تعدیل‌گری HG</strong> است. اگر HG تعدیل‌گر نبود، چهار ستون باید ارتفاع یکسان می‌داشتند. تفاوت ۱.۶۰ برابری بین زنان دورافتاده (Q1) و نزدیک به شهر (Q4) یعنی «جغرافیا تعیین‌کنندهٔ اثر تحول دیجیتال است». این یافته مبنای توصیهٔ سیاستی مقاله است: مداخلات دیجیتال در مناطق دورافتاده بازدهی <em>نصف</em> مناطق نزدیک شهر را دارند.</div>
    `,
    4: `
      <strong>نوع نمودار:</strong> نمودار خطی CATE در ۱۰ بازهٔ HG با بازهٔ اطمینان ۹۵٪<br>
      <strong>مقادیر کلیدی:</strong> ۱۰ نقطه (میانهٔ هر بازه) · نوارهای CI روی هر نقطه · روند صعودی یکنوا<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      روند صعودی خطی-تقریبی است. مهم‌ترین نکته: <strong>بازهٔ اطمینان دو انتها همپوشانی ندارند</strong> — یعنی CI بازهٔ اول (HG پایین) و بازهٔ دهم (HG بالا) کاملاً جدا هستند. این «شاهد قطعی» است که تفاوت اثر در دو انتها، ناشی از نویز نمونه‌گیری نیست.<br>
      عرض CI در میانه‌ها باریک‌تر است (چون تعداد نمونهٔ بیشتر) و در انتها پهن‌تر — این طبیعی است.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> اگر فقط نمودار ۳ را داشتیم، ممکن بود کسی بگوید «تفاوت Q1 و Q4 تصادفی است». اما عدم همپوشانی CI در این نمودار، آن استدلال را رد می‌کند. این یعنی «ناهمگونی CATE از نظر آماری <em>سیستماتیک</em> است، نه تصادفی» — توجیه علمی برای پذیرش یافتهٔ تعدیل‌گری HG.</div>
    `,
    5: `
      <strong>نوع نمودار:</strong> PDP (Partial Dependence Plot) — اثر خالص HG بر CATE در حالی که PR (پیش‌نیازها) روی میانه ثابت است<br>
      <strong>مقادیر کلیدی:</strong> دامنهٔ HG = [۱ , ۵] · دامنهٔ اثر = [۰.۳۰ , ۰.۵۰] · روند صعودی نرم<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      این نمودار <strong>اثر خالص HG</strong> را نشان می‌دهد، بدون آلودگی با PR. یعنی «اگر همهٔ زنان در سطح PR میانگین بودند، اثر HG چقدر می‌بود؟» منحنی از ۰.۳۰ در HG=۱ شروع می‌شود و به ۰.۵۰ در HG=۵ می‌رسد — شیب مثبت و یکنوا.<br>
      این نتیجه با «اثر HG در حضور PR» تفاوت دارد: در نمودار ۳، HG به‌تنهایی (بدون کنترل PR) اثر بزرگ‌تری نشان می‌داد. اما اینجا که PR کنترل شده، اثر HG کاهش یافته — یعنی بخشی از اثر HG قبلاً از طریق PR منتقل می‌شد.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار <strong>مستقل‌ترین شاهد</strong> بر این است که HG نقش علّی مستقل دارد — نه فقط اثر «غیرمستقیم از طریق PR». اگر HG تنها از طریق PR اثر می‌گذاشت، این منحنی باید افقی می‌بود. شیب مثبت و نرم آن یعنی HG حتی پس از کنترل PR، همچنان اثرگذار است. یعنی سیاست‌گذاری نمی‌تواند «به‌جای تقویت HG، فقط PR را تقویت کند» — هر دو باید هم‌زمان باشند.</div>
    `,
    6: `
      <strong>نوع نمودار:</strong> جعبه‌ای CATE بر اساس چارک‌های PR (پیش‌نیازها)<br>
      <strong>مقادیر کلیدی:</strong> PR-Q1 (میانه ≈ ۰.۳۰) · PR-Q2 (≈ ۰.۳۷) · PR-Q3 (≈ ۰.۴۳) · PR-Q4 (≈ ۰.۵۰)<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      جعبه‌ها از Q1 تا Q4 <strong>یکنوا صعودی</strong> هستند. این یعنی PR نیز — به‌طور مستقل از HG — تعدیل‌گر است. میانهٔ CATE در PR-Q1 حدود ۰.۳۰ و در PR-Q4 حدود ۰.۵۰ است.<br>
      عرض جعبه‌ها (IQR) نسبتاً یکسان است، یعنی پراکندگی درون هر چارک مشابه است — ناهمگونی درون‌گروهی ناشی از HG است، نه ناشی از نویز PR.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این یافته با نمودار ۵ مکمل است: هر دو HG و PR به‌طور <strong>مستقل</strong> تعدیل‌گرند. سیاست‌گذار باید هر دو را در نظر بگیرد. اگر فقط HG را تقویت کند و PR را نادیده بگیرد، نیمی از ناهمگونی را توضیح نداده است. به همین دلیل مقاله بر «هم‌زمانی» تأکید می‌کند.</div>
    `,
    7: `
      <strong>نوع نمودار:</strong> پراکندگی سه‌بعدی CATE بر اساس HG و PR<br>
      <strong>مقادیر کلیدی:</strong> ۲۵۰ نقطه · رنگ = CATE · دامنه از (HG پایین، PR پایین) → ۰.۲۷ تا (HG بالا، PR بالا) → ۰.۵۶<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      الگوی روشن: نقاط آبی (CATE پایین) در سمت چپ-پایین (HG پایین، PR پایین) متمرکزند، و نقاط نارنجی-قرمز (CATE بالا) در سمت راست-بالا (HG بالا، PR بالا). این <strong>الگوی قطری</strong> نشان می‌دهد که HG و PR با هم عمل می‌کنند.<br>
      نکتهٔ کلیدی: در گوشهٔ راست-بالا (هر دو متغیر بالا)، CATE تقریباً ۰.۵۶ است — بیشتر از «جمع» اثر HG تنها (۰.۵۳ در نمودار ۳) و PR تنها (۰.۵۰ در نمودار ۶). این یعنی HG و PR <strong>هم‌افزا (synergistic)</strong> عمل می‌کنند.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار <strong>مستقیم‌ترین نمایش تعامل HG×PR</strong> است. اگر HG و PR فقط اثرات اصلی مستقل داشتند، پراکندگی یک «صفحهٔ شیب‌دار» ساده می‌بود. اما اینجا می‌بینیم که شیب در گوشهٔ بالا-راست تندتر است — این <em>اثر تعاملی</em> است. پیام سیاستی: «تقویت هم‌زمان HG و PR» از «تقویت تک‌تک» بازدهی بیشتری دارد.</div>
    `,
    8: `
      <strong>نوع نمودار:</strong> سطح پیوستهٔ CATE با درون‌یابی IDW (Inverse Distance Weighting)<br>
      <strong>مقادیر کلیدی:</strong> سطح یکنوا · حداکثر در (HG≈۵، PR≈۵) · حداقل در (HG≈۱، PR≈۱)<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      این همان داده‌های نمودار ۷ است، اما با درون‌یابی به یک <strong>سطح پیوسته</strong> تبدیل شده. خطوط تراز (contour) نشان می‌دهد CATE در نواحی مختلف چگونه تغییر می‌کند. شکل «صفحه شیب‌دار» یکنوا تأیید می‌کند که ناهمگونی <strong>سیستماتیک</strong> است، نه ناشی از پراکندگی نقاط.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این سطح پیوسته <strong>پیش‌بین</strong> است — یعنی برای هر زوج (HG , PR) می‌توان CATE را تخمین زد. این به سیاست‌گذار اجازه می‌دهد با پرسیدن دو سؤال ساده («فاصلهٔ روستا از شهر چقدر است؟ سطح پیش‌نیازها چقدر است؟») CATE را برای هر زن جدید تخمین بزند و تصمیم بگیرد که آیا مداخلهٔ دیجیتال برای او بازدهی دارد یا نه.</div>
    `,
    9: `
      <strong>نوع نمودار:</strong> اهمیت ویژگی‌ها — میانگین |SHAP| یا importance از مدل Causal Forest<br>
      <strong>مقادیر کلیدی:</strong> PR = ۰.۵۹۱ · HG = ۰.۴۰۹ · مجموع = ۱.۰۰۰<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      PR کمی مهم‌تر از HG است (۵۹٪ در برابر ۴۱٪)، اما هر دو بالای ۰.۳ هستند — یعنی هر دو نقش <em>اساسی</em> دارند، نه «یکی اصلی و یکی فرعی». این با یافتهٔ نمودار ۵ و ۶ سازگار است (هر دو تعدیل‌گرند).<br>
      اگر یک متغیر اهمیت بسیار پایین (مثلاً ۰.۰۵) داشت، می‌شد آن را از مدل حذف کرد. اما ۰.۴۰۹ و ۰.۵۹۱ هر دو «سهم معنادار» دارند.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار یک <strong>رتبه‌بندی سیاستی</strong> ارائه می‌دهد: PR کمی مهم‌تر است، اما HG قابل چشم‌پوشی نیست. برخلاف تصور رایج که «جغرافیا فقط پس‌زمینه است»، این یافته نشان می‌دهد HG ۴۱٪ از ناهمگونی را توضیح می‌دهد — عددی که هیچ سیاست‌گذاری نمی‌تواند نادیده بگیرد.</div>
    `,
    10: `
      <strong>نوع نمودار:</strong> گیج (Gauge) کیفیت مدل BLP — R² مدل Best Linear Predictor<br>
      <strong>مقادیر کلیدی:</strong> R² = ۰.۸۰۹ · Calibration p-value = ۰.۰۳۱ (زیر ۰.۰۵ = مدل کالیبره) · ۸۱٪ از ناهمگونی توضیح داده شده<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      گیج در ناحیهٔ سبز (بالای ۰.۷) قرار دارد — یعنی مدل BLP (Best Linear Predictor) کیفیت بالایی دارد. این مدل بررسی می‌کند که «آیا HG و PR واقعاً CATE را پیش‌بینی می‌کنند؟». R² = ۰.۸۰۹ یعنی ۸۱٪ از تغییرات CATE توسط HG و PR توضیح داده می‌شود — عدد بسیار بالا.<br>
      آزمون کالیبراسیون (p = ۰.۰۳۱ < ۰.۰۵) تأیید می‌کند که ناهمگونی کشف‌شده «واقعی» است، نه نویز تصادفی. یعنی مدل ما «بیش‌برازش» نکرده.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار <strong>مهم‌ترین تأیید آماری کل بخش Causal ML</strong> است. ادعای «ناهمگونی ساختاریافته» فقط زمانی معتبر است که: (۱) مدل BLP بتواند CATE را پیش‌بینی کند (R² بالا) و (۲) مدل کالیبره باشد (p<۰.۰۵). هر دو شرط برقرارند. بدون این دو، تمام یافته‌های CATE ممکن بود «توهم آماری» باشند. اکنون می‌دانیم که HG و PR «محرک‌های واقعی ناهمگونی» هستند.</div>
    `,
    11: `
      <strong>نوع نمودار:</strong> منحنی TOC (Targeting Operator Characteristic) — مقایسهٔ مدل هدف‌گیری با تخصیص تصادفی<br>
      <strong>مقادیر کلیدی:</strong> منحنی سبز (مدل) بالای منحنی قرمز (تصادفی) · در ۵۰٪ هدف‌گیری، اثر تجمعی ۱۵-۲۰٪ بیشتر<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      خط سبز (مدل) در تمام طول بالای خط قرمز (تصادفی) است. در نقطهٔ ۵۰٪ (نیمهٔ نمونه)، مدل توانسته اثر تجمعی ۱۵-۲۰٪ بیشتری نسبت به انتخاب تصادفی به دست آورد. این یعنی مدل «می‌داند چه کسی را هدف بگیرد».<br>
      هرچه شکاف بین دو خط بیشتر باشد، مدل هدف‌گیری دقیق‌تر است. در اینجا شکاف متوسط تا بزرگ است — نشانهٔ مدل خوب.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار <strong>پیام سیاستی مستقیم</strong> دارد: اگر بودجه‌ای برای مداخلهٔ دیجیتال دارید، به‌جای توزیع یکنواخت بین همه، بر ۵۰٪ برتر نمونه (که مدل مشخص می‌کند) تمرکز کنید. هر ریال سرمایه‌گذاری در این گروه، ۲۰٪ بیشتر از توزیع تصادفی بازدهی دارد. این «هدف‌گیری هوشمند» بر پایهٔ CATE است، نه ویژگی‌های سطحی.</div>
    `,
    12: `
      <strong>نوع نمودار:</strong> منحنی Qini — معیار استاندارد «کیفیت رتبه‌بندی» در Uplift Modeling<br>
      <strong>مقادیر کلیدی:</strong> ضریب Qini = مساحت بین منحنی مدل (بنفش) و خط تصادفی (قرمز)<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      منحنی مدل (بنفش) کاملاً بالای خط تصادفی (قرمز) است. مساحت بین این دو، <strong>ضریب Qini</strong> نامیده می‌شود — هرچه بزرگ‌تر، مدل رتبه‌بندی بهتری دارد. اینجا ضریب Qini معنادار و مثبت است.<br>
      تفاوت Qini با TOC: TOC «اثر تجمعی» را نشان می‌دهد، Qini «کیفیت رتبه‌بندی» را. اگر مدل بتواند افراد را به‌درستی از «بالا-اثر» به «پایین-اثر» مرتب کند، Qini بالا خواهد بود.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> Qini استاندارد طلایی <em>Uplift Modeling</em> در بازاریابی و سیاست‌گذاری است. Qini مثبت یعنی مدل ما می‌تواند «زنانی که از مداخله سود می‌برند» را از «زنانی که سود نمی‌برند» تفکیک کند. این یعنی سیاست‌گذاری هدفمند <em>ممکن</em> است — نه فقط از نظر تئوری، بلکه با یک مدل عملی که در داشبورد پیاده شده.</div>
    `
  };
  const en = {
    1: `
      <strong>Chart type:</strong> 3D histogram of CATE distribution (Conditional Average Treatment Effect) — 250 conditional causal effect estimates<br>
      <strong>Key values:</strong> CATE range = [0.27 , 0.56] · Mean = 0.42 · SD = 0.11<br><br>
      <em>What we see and why:</em><br>
      The CATE distribution is <strong>bimodal</strong>, not bell-shaped. Two clear peaks: one at ~0.27 (weak effect) and another at ~0.56 (strong effect). Between the two peaks, there is an empty "valley" — no observation has exactly the "average effect of 0.42".<br>
      This means the 250-woman sample naturally splits into two subgroups: women for whom digital transformation has a <em>weak</em> effect on sustainability, and women for whom it has a <em>strong</em> effect.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> The "average effect of 0.42" reported in traditional analyses is <strong>misleading</strong> — because no one actually experiences that effect. This chart delivers the paper's most important message: <em>"the average lies"</em>. Policy based on the mean will target half of women with the wrong intervention. Policy must focus on CATE (Conditional ATE), not ATE.</div>
    `,
    2: `
      <strong>Chart type:</strong> Ranked CATE — 250 estimates sorted in ascending order<br>
      <strong>Key values:</strong> Lowest = 0.27 · Highest = 0.56 · Median = 0.42 · Range = 0.29<br><br>
      <em>What we see and why:</em><br>
      The <strong>stepwise</strong> shape of the curve — not a smooth curve — shows that the sample naturally clusters into two or three groups. About 130 individuals occupy the lower section (effect 0.27 to 0.40) and 120 occupy the upper section (effect 0.45 to 0.56).<br>
      The steep slope in the middle shows that the "boundary" between the two groups lies at CATE ≈ 0.42. This boundary is a <em>real threshold</em> — not artificial.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This "step" enables <strong>precision targeting</strong>: if you have limited budget for digital intervention, instead of distributing uniformly, focus on the 120 individuals at the top of the curve — because each dollar invested in them yields double the return.</div>
    `,
    3: `
      <strong>Chart type:</strong> 3D columns of CATE across HG (Human Geography) quartiles<br>
      <strong>Key values:</strong> HG-Q1 = 0.333 · HG-Q2 = 0.387 · HG-Q3 = 0.450 · HG-Q4 = 0.533 · Q4/Q1 ratio = <strong>1.60×</strong><br><br>
      <em>What we see and why:</em><br>
      The trend is <strong>monotonically increasing</strong>: as HG rises, CATE increases continuously. The columns change color from red (Q1) to green (Q4) to visualize this trend. White error bars (SD) on each column show that the difference from Q1 to Q4 is statistically significant.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart provides the <strong>most direct evidence of HG moderation</strong>. If HG were not a moderator, the four columns would all have the same height. The 1.60× difference between remote women (Q1) and near-city women (Q4) means "geography determines the effect of digital transformation." This finding underpins the paper's policy recommendation: digital interventions in remote areas yield <em>half</em> the return of near-city areas.</div>
    `,
    4: `
      <strong>Chart type:</strong> Line plot of CATE across 10 HG bins with 95% confidence intervals<br>
      <strong>Key values:</strong> 10 points (bin midpoints) · CI bands around each point · Monotone increasing trend<br><br>
      <em>What we see and why:</em><br>
      The trend is approximately linear. The most important feature: <strong>the confidence intervals of the two extremes do not overlap</strong> — the CI of the first bin (low HG) and the tenth bin (high HG) are completely disjoint. This is "decisive evidence" that the difference in effect at the two extremes is not due to sampling noise.<br>
      CI width is narrower in the middle (more samples) and wider at the extremes — this is natural.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> If we only had Chart 3, someone could say "the Q1 vs Q4 difference is random". But the non-overlapping CIs in this chart refute that argument. This means "CATE heterogeneity is <em>systematic</em>, not random" — scientific justification for accepting the HG moderation finding.</div>
    `,
    5: `
      <strong>Chart type:</strong> PDP (Partial Dependence Plot) — net effect of HG on CATE with PR held at its median<br>
      <strong>Key values:</strong> HG range = [1 , 5] · Effect range = [0.30 , 0.50] · Smooth monotone trend<br><br>
      <em>What we see and why:</em><br>
      This chart shows the <strong>net effect of HG</strong> without contamination from PR. In other words: "if everyone were at the average PR level, what would HG's effect be?" The curve starts at 0.30 when HG=1 and reaches 0.50 when HG=5 — positive and monotone slope.<br>
      This differs from "HG's effect in the presence of PR": in Chart 3, HG alone (without controlling PR) showed a larger effect. But once PR is controlled, HG's effect drops — meaning part of HG's effect was previously transmitted through PR.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart provides the <strong>most independent evidence</strong> that HG has a direct causal role — not just an "indirect effect through PR". If HG only operated through PR, this curve would be flat. Its positive and smooth slope means HG remains influential even after controlling for PR. This means policy cannot say "instead of strengthening HG, just strengthen PR" — both must occur simultaneously.</div>
    `,
    6: `
      <strong>Chart type:</strong> Box plot of CATE by PR (Prerequisites) quartiles<br>
      <strong>Key values:</strong> PR-Q1 (median ≈ 0.30) · PR-Q2 (≈ 0.37) · PR-Q3 (≈ 0.43) · PR-Q4 (≈ 0.50)<br><br>
      <em>What we see and why:</em><br>
      Boxes from Q1 to Q4 are <strong>monotonically ascending</strong>. This means PR — independently of HG — is also a moderator. Median CATE in PR-Q1 is about 0.30 and in PR-Q4 about 0.50.<br>
      Box widths (IQR) are relatively uniform, meaning within-quartile variance is similar — heterogeneity within groups comes from HG, not PR noise.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This finding complements Chart 5: both HG and PR are <strong>independent</strong> moderators. Policy must address both. If policy strengthens HG and ignores PR, it accounts for only half of the heterogeneity. This is why the paper emphasizes "simultaneity".</div>
    `,
    7: `
      <strong>Chart type:</strong> 3D scatter of CATE by HG and PR<br>
      <strong>Key values:</strong> 250 points · Color = CATE · Range from (low HG, low PR) → 0.27 to (high HG, high PR) → 0.56<br><br>
      <em>What we see and why:</em><br>
      Pattern is clear: blue points (low CATE) cluster in the lower-left (low HG, low PR), and orange-red points (high CATE) cluster in the upper-right (high HG, high PR). This <strong>diagonal pattern</strong> shows that HG and PR act together.<br>
      Key insight: in the upper-right corner (both variables high), CATE is about 0.56 — greater than the "sum" of HG alone (0.53 in Chart 3) and PR alone (0.50 in Chart 6). This means HG and PR are <strong>synergistic</strong>.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart <strong>directly displays the HG×PR interaction</strong>. If HG and PR were just independent main effects, the scatter would be a simple "sloped plane". But we see the slope is steeper in the upper-right corner — this is a <em>synergistic effect</em>. Policy message: "strengthening HG and PR simultaneously" yields more than "strengthening them one at a time".</div>
    `,
    8: `
      <strong>Chart type:</strong> Continuous CATE surface with IDW (Inverse Distance Weighting) interpolation<br>
      <strong>Key values:</strong> Monotone surface · Max at (HG≈5, PR≈5) · Min at (HG≈1, PR≈1)<br><br>
      <em>What we see and why:</em><br>
      Same data as Chart 7, but interpolated into a <strong>continuous surface</strong>. Contour lines show how CATE varies across regions. The "sloped plane" shape confirms heterogeneity is <strong>systematic</strong>, not driven by scattered points.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This continuous surface is <strong>predictive</strong> — for any (HG , PR) pair, CATE can be estimated. This lets policymakers ask two simple questions ("What is the village's distance from the city? What is the prerequisite level?") and estimate CATE for any new woman, deciding whether digital intervention is worth it for her.</div>
    `,
    9: `
      <strong>Chart type:</strong> Feature importance — mean |SHAP| or importance from the Causal Forest model<br>
      <strong>Key values:</strong> PR = 0.591 · HG = 0.409 · Total = 1.000<br><br>
      <em>What we see and why:</em><br>
      PR is slightly more important than HG (59% vs 41%), but both are above 0.3 — meaning each has a <em>fundamental</em> role, not "one main and one secondary". This is consistent with Charts 5 and 6 (both are moderators).<br>
      If a variable had very low importance (e.g., 0.05), it could be dropped from the model. But 0.409 and 0.591 both represent "significant contribution".<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart gives a <strong>policy ranking</strong>: PR is slightly more important, but HG cannot be ignored. Contrary to the common assumption that "geography is just background", this finding shows HG explains 41% of heterogeneity — a number no policymaker can dismiss.</div>
    `,
    10: `
      <strong>Chart type:</strong> Gauge of BLP model quality — Best Linear Predictor R²<br>
      <strong>Key values:</strong> R² = 0.809 · Calibration p-value = 0.031 (below 0.05 = calibrated model) · 81% of heterogeneity explained<br><br>
      <em>What we see and why:</em><br>
      The gauge sits in the green zone (above 0.7) — the BLP (Best Linear Predictor) model has high quality. This model tests "do HG and PR really predict CATE?". R² = 0.809 means 81% of CATE variance is explained by HG and PR — a very high number.<br>
      The calibration test (p = 0.031 < 0.05) confirms that the discovered heterogeneity is "real", not random noise. In other words, the model is not overfitted.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart is <strong>the single most important statistical confirmation of the entire Causal ML section</strong>. The claim of "structured heterogeneity" is only valid when: (1) the BLP model can predict CATE (high R²) and (2) the model is calibrated (p<0.05). Both conditions hold. Without these two, all CATE findings might be a "statistical illusion". Now we know HG and PR are "genuine drivers of heterogeneity".</div>
    `,
    11: `
      <strong>Chart type:</strong> TOC (Targeting Operator Characteristic) curve — model targeting vs random allocation<br>
      <strong>Key values:</strong> Green curve (model) above red curve (random) · At 50% targeting, cumulative effect 15-20% greater<br><br>
      <em>What we see and why:</em><br>
      The green line (model) is above the red line (random) throughout. At the 50% mark (half of the sample), the model achieves 15-20% more cumulative effect compared to random selection. This means the model "knows whom to target".<br>
      The larger the gap between the two lines, the more precise the targeting model. Here the gap is moderate-to-large — sign of a good model.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart delivers a <strong>direct policy message</strong>: if you have budget for digital intervention, instead of distributing it uniformly across everyone, concentrate it on the top 50% (which the model identifies). Each dollar invested in this group yields 20% more than random allocation. This is "smart targeting" based on CATE, not surface features.</div>
    `,
    12: `
      <strong>Chart type:</strong> Qini curve — standard benchmark for "ranking quality" in Uplift Modeling<br>
      <strong>Key values:</strong> Qini coefficient = area between model curve (purple) and random line (red)<br><br>
      <em>What we see and why:</em><br>
      The model curve (purple) is entirely above the random line (red). The area between these two is the <strong>Qini coefficient</strong> — the larger, the better the ranking model. Here the Qini coefficient is positive and significant.<br>
      Difference between Qini and TOC: TOC shows "cumulative effect", Qini shows "ranking quality". If the model can correctly order individuals from "high-effect" to "low-effect", the Qini will be high.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> Qini is the gold standard for <em>Uplift Modeling</em> in marketing and policy. A positive Qini means our model can separate "women who benefit from the intervention" from "women who don't". This means targeted policy is <em>possible</em> — not just in theory, but with a practical model implemented in the dashboard.</div>
    `
  };
  return (state.lang === 'fa' ? fa : en)[n] || '';
}

/* ================================================================
   DETAILED INTERPRETATIONS — SHAP (13-14)
   ================================================================ */
function shapInterp(n){
  const fa = {
    13: `
      <strong>نوع نمودار:</strong> نمودار میله‌ای اهمیت SHAP — میانگین قدر مطلق SHAP هر متغیر<br>
      <strong>مقادیر کلیدی:</strong> PR ≈ ۰.۰۶۲ · HG ≈ ۰.۰۴۱ (نسبت PR/HG ≈ ۱.۵۱)<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      این نمودار، <strong>سهم واقعی</strong> هر متغیر را در توضیح CATE نشان می‌دهد — این بار با روش SHAP (بر پایهٔ ارزش شپلی از نظریهٔ بازی‌های همکارانه)، نه با روش BLP. هر دو متغیر سهم قابل توجهی دارند.<br>
      نکته: ترتیب و نسبت مشابه با نمودار ۹ (Feature Importance) است — PR حدود ۱.۵ برابر HG. این <strong>هم‌خوانی بین دو روش مستقل</strong> (BLP و SHAP) تأیید می‌کند که نتیجه پایدار است، نه ناشی از انتخاب روش.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> SHAP یک <em>اعتبارسنجی متقاطع</em> برای یافتهٔ اصلی است. اگر فقط BLP می‌گفت PR مهم‌تر است، ممکن بود کسی شک کند که «شاید روش BLP سوگیری داشته». اما وقتی SHAP (که یک چارچوب کاملاً متفاوت است) همان نتیجه را می‌دهد، اطمینان ما چند برابر می‌شود. این یعنی «ادعای اهمیت PR و HG» از دو زاویهٔ مستقل تأیید شده است.</div>
    `,
    14: `
      <strong>نوع نمودار:</strong> SHAP Summary (Beeswarm) — توزیع اثر SHAP هر متغیر در ۲۵۰ مشاهده<br>
      <strong>مقادیر کلیدی:</strong> هر نقطه = یک زن · محور X = اثر SHAP بر CATE · رنگ = مقدار ویژگی (آبی = کم، قرمز = زیاد)<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      برای هر دو متغیر، الگوی «<strong>رنگ‌های قطبی</strong>» دیده می‌شود: نقاط قرمز (مقدار بالای ویژگی) در سمت راست متمرکزند و نقاط آبی (مقدار پایین) در سمت چپ. این یعنی رابطهٔ <strong>یکنوا و مثبت</strong> است: HG بالاتر → CATE بالاتر، PR بالاتر → CATE بالاتر.<br>
      پراکندگی عمودی نقاط نشان‌دهندهٔ تنوع اثر است: حتی در سطح HG بالا، برخی زنان CATE پایین دارند (به دلیل PR پایین). این یعنی «هیچ متغیری به‌تنهایی تعیین‌کننده نیست» — تعامل HG و PR مهم است.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار «چرا»ی نمودار ۷ (تعامل HG×PR) را توضیح می‌دهد: اثر HG بر CATE بسته به سطح PR متفاوت است و بالعکس. SHAP این را در <em>سطح تک‌تک مشاهدات</em> نشان می‌دهد — نه فقط به‌طور میانگین. پیام سیاستی: «سیاست‌گذاری نمی‌تواند فقط به HG یا فقط به PR نگاه کند — باید هر دو را هم‌زمان ببیند».</div>
    `
  };
  const en = {
    13: `
      <strong>Chart type:</strong> SHAP importance bar chart — mean absolute SHAP per variable<br>
      <strong>Key values:</strong> PR ≈ 0.062 · HG ≈ 0.041 (PR/HG ratio ≈ 1.51)<br><br>
      <em>What we see and why:</em><br>
      This chart shows the <strong>true contribution</strong> of each variable in explaining CATE — this time using the SHAP method (based on Shapley values from cooperative game theory), not the BLP method. Both variables have substantial contributions.<br>
      Note: order and ratio match Chart 9 (Feature Importance) — PR is about 1.5× HG. This <strong>cross-validation between two independent methods</strong> (BLP and SHAP) confirms the result is robust, not driven by method choice.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> SHAP provides a <em>cross-validation</em> of the main finding. If only BLP said PR was more important, someone might suspect "maybe BLP has a bias". But when SHAP (a completely different framework) gives the same result, our confidence multiplies. This means "the claim of PR and HG importance" is confirmed from two independent angles.</div>
    `,
    14: `
      <strong>Chart type:</strong> SHAP Summary (Beeswarm) — distribution of SHAP effect for each variable across 250 observations<br>
      <strong>Key values:</strong> Each dot = one woman · X-axis = SHAP effect on CATE · Color = feature value (blue = low, red = high)<br><br>
      <em>What we see and why:</em><br>
      For both variables, a "<strong>polarized color</strong>" pattern appears: red points (high feature value) cluster on the right, blue points (low value) cluster on the left. This means the relationship is <strong>monotone and positive</strong>: higher HG → higher CATE, higher PR → higher CATE.<br>
      Vertical dispersion indicates effect variability: even at high HG, some women have low CATE (due to low PR). This means "no single variable is deterministic alone" — the HG×PR interaction matters.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart explains the "why" behind Chart 7 (HG×PR interaction): the effect of HG on CATE depends on PR level, and vice versa. SHAP shows this at the <em>individual observation level</em> — not just on average. Policy message: "policy cannot look only at HG or only at PR — it must see both simultaneously".</div>
    `
  };
  return (state.lang === 'fa' ? fa : en)[n] || '';
}

/* ================================================================
   DETAILED INTERPRETATIONS — Monte Carlo (15-22)
   ================================================================ */
function mcInterp(n){
  const fa = {
    15: `
      <strong>نوع نمودار:</strong> نمودار میله‌ای مقایسهٔ اثرات MC — مقایسهٔ مستقیم اثرات غیرمستقیم (H3) و تعدیل‌گر (H4)<br>
      <strong>مقادیر کلیدی:</strong> H4a = ۰.۲۵۷ (بزرگ‌ترین) · H3b = ۰.۱۴۲ · H3d = ۰.۱۲۵ · H3c = ۰.۱۰۲ · H3a = ۰.۰۹۸ · H3e = ۰.۰۵۳ (کوچک‌ترین)<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      میله‌های آبی (H3 = غیرمستقیم) در دامنهٔ ۰.۰۵ تا ۰.۱۴ و میله‌های نارنجی (H4 = تعدیل‌گر) در دامنهٔ ۰.۰۹ تا ۰.۲۶. <strong>H4a بزرگ‌ترین اثر کل مدل</strong> است. H3e (زنجیره‌ای) کوچک‌ترین است — همان‌طور که انتظار می‌رود چون از سه مرحله عبور می‌کند.<br>
      این نمودار <strong>همان مقادیر SmartPLS</strong> را بازتولید می‌کند (تفاوت‌ها در حدود ۰.۰۰۱).<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار «<strong>مقایسه بصری همهٔ فرضیه‌های اثر غیرمستقیم و تعدیل‌گری</strong>» را فراهم می‌کند. سیاست‌گذار در یک نگاه می‌بیند که تعامل HG×PR بر DT (H4a) بزرگ‌ترین اهرم است و زنجیرهٔ HG→PR→DT→SUS (H3e) کوچک‌ترین. یعنی «یک مداخلهٔ هم‌زمان روی HG و PR» بازدهی بیشتری از «مداخلهٔ مرحله‌ای» دارد.</div>
    `,
    16: `
      <strong>نوع نمودار:</strong> Forest Plot — اثرات غیرمستقیم با بازهٔ اطمینان ۹۵٪ (K=۱۰,۰۰۰ شبیه‌سازی مونت‌کارلو)<br>
      <strong>قیمت‌های کلیدی:</strong> پنج مسیر H3a تا H3e · تمام CIها کاملاً سمت راست صفر<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      این نمودار <strong>استاندارد طلایی متاآنالیز</strong> برای گزارش اثرات است. هر نقطه = یک اثر متوسط MC، هر خط افقی = بازهٔ اطمینان ۹۵٪. همه پنج خط <strong>کاملاً سمت راست صفر</strong> هستند — یعنی هیچ‌کدام خط صفر را قطع نمی‌کنند.<br>
      H3b (۰.۱۴۲) بالاترین اثر با CI باریک‌تر (دقت بیشتر) است. H3e (۰.۰۵۳) پایین‌ترین است اما همچنان CI سمت راست صفر دارد.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار <strong>استحکام (robustness) کامل</strong> همهٔ مسیرهای میانجی را تأیید می‌کند. حتی اگر بوت‌استرپ SmartPLS را با یک روش کاملاً مستقل (MC) جایگزین کنیم، همان نتیجه گرفته می‌شود. یعنی «یافته‌های میانجی ما به روش آماری وابسته نیستند» — یک ویژگی حیاتی برای اعتبار علمی.</div>
    `,
    17: `
      <strong>نوع نمودار:</strong> ستون‌های سه‌بعدی اثرات غیرمستقیم — نمایش بصری مقایسهٔ H3a تا H3e<br>
      <strong>مقادیر کلیدی:</strong> H3b = ۰.۱۴۲ (بزرگ‌ترین) · H3d = ۰.۱۲۵ · H3c = ۰.۱۰۲ · H3a = ۰.۰۹۸ · H3e = ۰.۰۵۳ (کوچک‌ترین)<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      همان داده‌های نمودار ۱۶، اما در فضای سه‌بعدی. نوارهای سفید روی هر ستون، بازهٔ اطمینان ۹۵٪ را نشان می‌دهند. ارتفاع ستون‌ها تفاوت رتبه‌ای اثرات را روشن می‌کند.<br>
      تفاوت H3b (۰.۱۴۲) و H3e (۰.۰۵۳) تقریباً <strong>۲.۷ برابر</strong> است — یعنی مسیر HG→PR→DT قوی‌تر از مسیر زنجیره‌ای کامل است.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار «<strong>رتبه‌بندی مسیرهای میانجی</strong>» را برای سیاست‌گذاری فراهم می‌کند: مسیر HG→PR→DT (H3b) قوی‌ترین زنجیره است — پس تقویت هم‌زمان HG و PR بازدهی بیشتری از تقویت PR به‌تنهایی (H3a) یا زنجیرهٔ طولانی (H3e) دارد. این یعنی «مداخلهٔ دو مرحله‌ای» بهینه‌ترین استراتژی است.</div>
    `,
    18: `
      <strong>نوع نمودار:</strong> ستون‌های سه‌بعدی اثرات تعدیل‌گری — نمایش بصری مقایسهٔ H4a تا H4c<br>
      <strong>مقادیر کلیدی:</strong> H4a = ۰.۲۵۷ (HG×PR→DT) · H4c = ۰.۱۷۷ (HG×DT→SUS) · H4b = ۰.۰۹۶ (HG×PR→SUS)<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      هر سه اثر تعدیل‌گری با MI (نوارهای سفید) معنادارند. <strong>H4a بزرگ‌ترین</strong> است (۰.۲۵۷) — یعنی «تعامل HG و PR بر DT» قوی‌ترین اثر تعاملی مدل است. H4c (۰.۱۷۷) در رتبهٔ دوم است — تعامل HG×DT بر SUS. H4b (۰.۰۹۶) کوچک‌ترین است اما همچنان معنادار.<br>
      نکتهٔ مهم: <strong>همهٔ اثرات H4 بزرگ‌تر از میانگین اثرات H3</strong> (میانگین H3 ≈ ۰.۱۰) هستند. یعنی «تعدیل‌گری» بزرگ‌تر از «میانجی‌گری» است.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار پیام مهمی برای سیاست‌گذار دارد: «تعامل HG و PR (H4a) از هر مسیر میانجی به‌تنهایی مهم‌تر است». یعنی سرمایه‌گذاری هم‌زمان در جغرافیا و پیش‌نیازها، بازدهی بیشتری از سرمایه‌گذاری تک‌بعدی (فقط HG یا فقط PR) دارد. این تأیید عددی مستقیمی برای توصیهٔ «هم‌زمانی» است.</div>
    `,
    19: `
      <strong>نوع نمودار:</strong> پراکندگی سه‌بعدی MC vs SmartPLS — بررسی استحکام (Robustness Check)<br>
      <strong>مقادیر کلیدی:</strong> محور X = β SmartPLS · محور Y = MC Mean · محور Z = Δ (تفاضل)<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      همهٔ نقاط تقریباً روی صفحهٔ z=۰ (نزدیک به صفر) قرار دارند. این یعنی <strong>تفاوت بین تخمین MC و SmartPLS بسیار ناچیز</strong> است (|Δ| < ۰.۰۰۲). نقاط نزدیک به خط قطری نیز نشان می‌دهد MC و SmartPLS هر دو به یک نتیجه می‌رسند.<br>
      این <strong>قوی‌ترین شاهد بر استحکام</strong> است: اگر روش MC (که یک روش کاملاً متفاوت با SmartPLS است) همان مقادیر را بازتولید کند، نتیجه «واقعی» است، نه محصول یک روش خاص.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار «<strong>بررسی استحکام (Robustness)</strong>» را انجام می‌دهد. یافته‌های SmartPLS — که از ۵,۰۰۰ زیرنمونهٔ بوت‌استرپ آمده‌اند — با یافته‌های MC (که از ۱۰,۰۰۰ شبیه‌سازی آمده‌اند) مطابقت کامل دارند. این یعنی: «اگر پژوهش را با روش دیگری تکرار کنیم، همان نتیجه را می‌گیریم» — تعریف دقیق «استحکام علمی». برای مقاله، این یکی از قوی‌ترین شواهد اعتبار است.</div>
    `,
    20: `
      <strong>نوع نمودار:</strong> چگالی توزیع نمونه‌های شبیه‌سازی — توزیع احتمال ۴ اثر کلیدی<br>
      <strong>مقادیر کلیدی:</strong> چهار منحنی چگالی روی هم · شکل زنگی · مرکز همه نزدیک مقادیر SmartPLS<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      هر منحنی، توزیع احتمال یک اثر را در ۱۰,۰۰۰ شبیه‌سازی نشان می‌دهد. همه منحنی‌ها <strong>شکل زنگی و متقارن</strong> دارند — یعنی توزیع نمونه‌گیری نرمال است.<br>
      عرض منحنی‌ها متفاوت است: منحنی باریک‌تر (H3c) = دقت بیشتر برآورد؛ منحنی پهن‌تر (H4a) = عدم قطعیت بیشتر ولی همچنان معنادار.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار «<strong>فرض نرمال بودن</strong>» را تأیید می‌کند — یعنی CIهایی که از روش Percentile Bootstrap ساختیم، معتبرند. اگر منحنی‌ها چولهٔ شدید یا دو‌قله‌ای می‌بودند، CI ما ممکن بود گمراه‌کننده باشد. تقارن منحنی‌ها اطمینان می‌دهد که «هر نتیجه‌گیری بر پایهٔ CI، از نظر آماری معتبر است».</div>
    `,
    21: `
      <strong>نوع نمودار:</strong> Ridgeplot سه‌بعدی توزیع — ۸ منحنی چگالی روی هم برای همهٔ اثرات<br>
      <strong>مقادیر کلیدی:</strong> ۸ منحنی چگالی · هر کدام در محور Z جدا · رنگ متفاوت برای تمایز<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      این نمایش «<strong>مقایسه چندگانه</strong>» توزیع‌ها است: هر منحنی چگالی در یک ردیف جدا. اگر منحنی‌ها چوله یا دوقله‌ای داشتند، توزیع نمونه‌گیری مشکل داشت. اما همه <strong>زنگی، متقارن و تک‌قله</strong> هستند.<br>
      تفاوت عرض منحنی‌ها نشان می‌دهد که «عدم قطعیت» در همهٔ مسیرها یکسان نیست — مسیرهای تعاملی (H4) پهن‌ترند (چون پیچیده‌ترند)، مسیرهای مستقیم باریک‌تر (چون ساده‌ترند).<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار <strong>تأیید نهایی فرض نرمال بودن</strong> را فراهم می‌کند — اما این بار برای همهٔ ۸ اثر هم‌زمان. اگر یکی از مسیرها توزیع چولهٔ شدید داشت، باید از روش‌های non-parametric استفاده می‌کردیم. اما چون همه نرمال هستند، روش‌های پارامتریک (CI بر پایهٔ Percentile) کاملاً معتبرند.</div>
    `,
    22: `
      <strong>نوع نمودار:</strong> Q-Q Plot — بررسی نرمال بودن توزیع H3a<br>
      <strong>مقادیر کلیدی:</strong> نقاط آبی = نمونه‌های MC · خط قرمز = توزیع نرمال نظری · انحراف از خط = نقض نرمال بودن<br><br>
      <em>چه می‌بینیم و چرا؟</em><br>
      نقاط آبی تقریباً کاملاً روی خط قرمز قرار دارند — این یعنی توزیع H3a (اثر میانجی PR→DT→SUS) <strong>نرمال است</strong>. انحرافات جزئی در انتها (گوشه‌های چپ-بالا و راست-پایین) در حد نویز نمونه‌گیری است و نگران‌کننده نیست.<br>
      Q-Q Plot «<strong>استاندارد طلایی</strong>» بررسی نرمال بودن در آمار است. اگر نقاط به‌شکل «S» یا «U» از خط منحرف می‌شدند، توزیع چوله یا پهن‌دم بود.<br>
      <div class="reason-text"><strong>ارتباط با هدف پژوهش:</strong> این نمودار <strong>آخرین تأیید آماری</strong> برای بخش MC است. حتی اگر پژوهشگران دیگر به «بررسی چشمی منحنی چگالی» اعتماد نکنند، Q-Q Plot شاهد ریاضی قطعی است. نتیجه: «توزیع نمونه‌گیری H3a نرمال است → CI آن معتبر است → نتیجه‌گیری از H3a قابل اعتماد است». این یکی از دقیق‌ترین روش‌های اعتبارسنجی آماری است.</div>
    `
  };
  const en = {
    15: `
      <strong>Chart type:</strong> MC effects comparison bar chart — direct comparison of indirect (H3) vs moderator (H4) effects<br>
      <strong>Key values:</strong> H4a = 0.257 (largest) · H3b = 0.142 · H3d = 0.125 · H3c = 0.102 · H3a = 0.098 · H3e = 0.053 (smallest)<br><br>
      <em>What we see and why:</em><br>
      Blue bars (H3 = indirect) in the 0.05-0.14 range, orange bars (H4 = moderator) in the 0.09-0.26 range. <strong>H4a is the largest effect in the entire model</strong>. H3e (chained) is the smallest — as expected since it passes through three stages.<br>
      This chart <strong>reproduces the SmartPLS values</strong> (differences around 0.001).<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart provides a <strong>visual comparison of all indirect and moderating hypothesis effects</strong>. Policymakers see at a glance that the HG×PR→DT interaction (H4a) is the largest lever, while the chain HG→PR→DT→SUS (H3e) is the smallest. This means "a simultaneous intervention on HG and PR" yields higher returns than "staged intervention".</div>
    `,
    16: `
      <strong>Chart type:</strong> Forest Plot — indirect effects with 95% CI (K=10,000 Monte Carlo simulations)<br>
      <strong>Key values:</strong> Five paths H3a to H3e · All CIs strictly right of zero<br><br>
      <em>What we see and why:</em><br>
      This is the <strong>gold standard for meta-analysis reporting</strong>. Each dot = an MC mean effect, each horizontal line = 95% CI. All five lines lie <strong>entirely right of zero</strong> — no path crosses zero.<br>
      H3b (0.142) has the highest effect with the narrowest CI (most precise). H3e (0.053) is the lowest but its CI still lies right of zero.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart confirms <strong>complete robustness</strong> of all mediation paths. Even if we replace SmartPLS bootstrap with a completely independent method (MC), the same conclusion emerges. This means "our mediation findings do not depend on statistical method" — a critical property for scientific credibility.</div>
    `,
    17: `
      <strong>Chart type:</strong> 3D columns of indirect effects — visual comparison of H3a to H3e<br>
      <strong>Key values:</strong> H3b = 0.142 (largest) · H3d = 0.125 · H3c = 0.102 · H3a = 0.098 · H3e = 0.053 (smallest)<br><br>
      <em>What we see and why:</em><br>
      Same data as Chart 16, but in 3D space. White bars on each column show the 95% CI. Column heights clarify effect rankings.<br>
      The difference between H3b (0.142) and H3e (0.053) is about <strong>2.7×</strong> — meaning the HG→PR→DT path is stronger than the full chained path.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart provides a <strong>ranking of mediation paths</strong> for policy: the HG→PR→DT path (H3b) is the strongest chain — so simultaneously strengthening HG and PR yields more than strengthening PR alone (H3a) or the long chain (H3e). This means "two-stage intervention" is the optimal strategy.</div>
    `,
    18: `
      <strong>Chart type:</strong> 3D columns of moderator effects — visual comparison of H4a to H4c<br>
      <strong>Key values:</strong> H4a = 0.257 (HG×PR→DT) · H4c = 0.177 (HG×DT→SUS) · H4b = 0.096 (HG×PR→SUS)<br><br>
      <em>What we see and why:</em><br>
      All three moderator effects are significant (white bars). <strong>H4a is the largest</strong> (0.257) — the "HG×PR interaction on DT" is the strongest interaction effect in the model. H4c (0.177) is second. H4b (0.096) is smallest but still significant.<br>
      Key insight: <strong>all H4 effects are larger than the average H3 effect</strong> (avg H3 ≈ 0.10). This means "moderation" is larger than "mediation".<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart carries an important message for policy: "the HG×PR interaction (H4a) is more important than any mediation path alone". This means investing simultaneously in geography and prerequisites yields more than one-dimensional investment (only HG or only PR). This is direct numerical confirmation for the "simultaneity" recommendation.</div>
    `,
    19: `
      <strong>Chart type:</strong> 3D scatter MC vs SmartPLS — Robustness Check<br>
      <strong>Key values:</strong> X-axis = SmartPLS β · Y-axis = MC Mean · Z-axis = Δ (difference)<br><br>
      <em>What we see and why:</em><br>
      All points lie almost exactly on the z=0 plane (near zero). This means the <strong>difference between MC and SmartPLS estimates is negligible</strong> (|Δ| < 0.002). Points close to the diagonal line also show MC and SmartPLS converge to the same result.<br>
      This is the <strong>strongest evidence of robustness</strong>: if the MC method (a completely different approach from SmartPLS) reproduces the same values, the result is "real", not an artifact of one method.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart performs the <strong>Robustness Check</strong>. SmartPLS findings — from 5,000 bootstrap subsamples — match MC findings (from 10,000 simulations) perfectly. This means: "if the study were repeated with another method, the same conclusion would emerge" — the definition of scientific robustness. For the paper, this is one of the strongest validity evidences.</div>
    `,
    20: `
      <strong>Chart type:</strong> Density of simulation samples — probability distribution of 4 key effects<br>
      <strong>Key values:</strong> Four density curves overlaid · Bell shape · Centers near SmartPLS values<br><br>
      <em>What we see and why:</em><br>
      Each curve shows the probability distribution of one effect across 10,000 simulations. All curves are <strong>bell-shaped and symmetric</strong> — meaning the sampling distribution is normal.<br>
      Curve width varies: narrower curve (H3c) = more precise estimate; wider curve (H4a) = more uncertainty yet still significant.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart confirms the <strong>normality assumption</strong> — meaning the CIs we built from Percentile Bootstrap are valid. If curves were severely skewed or bimodal, our CIs might be misleading. Symmetric curves confirm that "every conclusion based on CIs is statistically valid".</div>
    `,
    21: `
      <strong>Chart type:</strong> 3D ridgeplot of distributions — 8 density curves stacked for all effects<br>
      <strong>Key values:</strong> 8 density curves · Each separated on Z-axis · Different colors for distinction<br><br>
      <em>What we see and why:</em><br>
      This is a "<strong>multi-comparison</strong>" display of distributions: each density curve in its own row. If curves were skewed or bimodal, sampling distribution would have a problem. But all are <strong>bell-shaped, symmetric, and unimodal</strong>.<br>
      Width variation shows that "uncertainty" is not uniform across paths — interaction paths (H4) are wider (more complex), direct paths are narrower (simpler).<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart provides <strong>final confirmation of normality</strong> — but for all 8 effects simultaneously. If one path had a severely skewed distribution, we'd need non-parametric methods. But since all are normal, parametric methods (CI based on Percentile) are fully valid.</div>
    `,
    22: `
      <strong>Chart type:</strong> Q-Q Plot — normality check of H3a distribution<br>
      <strong>Key values:</strong> Blue points = MC samples · Red line = theoretical normal · Deviation from line = normality violation<br><br>
      <em>What we see and why:</em><br>
      Blue points lie almost entirely on the red line — meaning the H3a distribution (mediation effect PR→DT→SUS) is <strong>normal</strong>. Minor deviations at the tails (upper-left and lower-right corners) are within sampling noise and not concerning.<br>
      Q-Q Plot is the "<strong>gold standard</strong>" for normality testing in statistics. If points had deviated in an "S" or "U" shape, the distribution would be skewed or heavy-tailed.<br>
      <div class="reason-text"><strong>Link to research goal:</strong> This chart provides the <strong>final statistical confirmation</strong> for the MC section. Even if other researchers distrust "visual inspection of density curves", Q-Q Plot is decisive mathematical evidence. Result: "The sampling distribution of H3a is normal → its CI is valid → conclusions from H3a are reliable". This is one of the most rigorous statistical validation methods.</div>
    `
  };
  return (state.lang === 'fa' ? fa : en)[n] || '';
}

/* ================================================================
   CAUSAL ML (CM 1-12)
   ================================================================ */
function renderCausalMLSection(){
  const container = document.getElementById('cm-charts-container'); if(!container) return;
  const cf = (state.loaded && state.loaded.causalForest) || FALLBACK_CAUSAL_FOREST;
  const isFa = state.lang === 'fa';
  const b3d = [{type:'3d', label: isFa ? '۳بعدی' : '3D'}];
  const b2d = [{type:'2d', label: isFa ? '۲بعدی' : '2D'}];
  const star = [{type:'star', label:'⭐'}];
  const sources = [
    'causal_forest_results.xlsx → CATE_Distribution',
    'causal_forest_results.xlsx → CATE_Distribution (sorted)',
    'causal_forest_results.xlsx → HG_Quartiles',
    'causal_forest_results.xlsx → Full_Data (HG, CATE)',
    'causal_forest_results.xlsx → Full_Data (HG, PR, CATE)',
    'causal_forest_results.xlsx → Full_Data (PR, CATE)',
    'causal_forest_results.xlsx → Full_Data (HG, PR, CATE)',
    'causal_forest_results.xlsx → Full_Data (IDW interpolation)',
    'causal_forest_results.xlsx → Feature_Importance',
    'causal_forest_results.xlsx → Overview (BLP_R2 + Calibration)',
    'causal_forest_results.xlsx → Full_Data (CATE)',
    'causal_forest_results.xlsx → Full_Data (CATE)'
  ];
  const cards = [{id:'cm-1',n:1,badges:[...b3d,...star],height:'tall'},{id:'cm-2',n:2,badges:b2d},{id:'cm-3',n:3,badges:b3d,height:'tall'},{id:'cm-4',n:4,badges:b2d},{id:'cm-5',n:5,badges:b2d},{id:'cm-6',n:6,badges:b2d},{id:'cm-7',n:7,badges:[...b3d,...star],height:'xtall'},{id:'cm-8',n:8,badges:b3d,height:'xtall'},{id:'cm-9',n:9,badges:b2d},{id:'cm-10',n:10,badges:b2d},{id:'cm-11',n:11,badges:[...b2d,...star]},{id:'cm-12',n:12,badges:b2d}];
  const legends = {1:'<span class="legend-item"><span class="legend-color" style="background:linear-gradient(135deg,#0d0887,#f0f921)"></span>Plasma</span><span class="legend-item"><span class="legend-line" style="background:#e74c3c"></span>Mean CATE</span>',3:'<span class="legend-item"><span class="legend-color" style="background:#e74c3c"></span>HG-Q1</span><span class="legend-item"><span class="legend-color" style="background:#f39c12"></span>HG-Q2</span><span class="legend-item"><span class="legend-color" style="background:#3498db"></span>HG-Q3</span><span class="legend-item"><span class="legend-color" style="background:#27ae60"></span>HG-Q4</span>',6:'<span class="legend-item"><span class="legend-color" style="background:#e74c3c"></span>PR-Q1</span><span class="legend-item"><span class="legend-color" style="background:#f39c12"></span>PR-Q2</span><span class="legend-item"><span class="legend-color" style="background:#3498db"></span>PR-Q3</span><span class="legend-item"><span class="legend-color" style="background:#27ae60"></span>PR-Q4</span>',9:'<span class="legend-item"><span class="legend-color" style="background:#e67e22"></span>PR</span><span class="legend-item"><span class="legend-color" style="background:#9b59b6"></span>HG</span>',11:'<span class="legend-item"><span class="legend-line" style="background:#27ae60"></span>Model</span><span class="legend-item"><span class="legend-line" style="background:#e74c3c"></span>Random</span>',12:'<span class="legend-item"><span class="legend-line" style="background:#9b59b6"></span>Model</span><span class="legend-item"><span class="legend-line" style="background:#e74c3c"></span>Random</span>'};
  let html = '<div class="cm-grid">';
  cards.forEach(card => {
    const title = (I18N[state.lang] && I18N[state.lang]['cm_chart_' + card.n + '_title']) || ('Chart ' + card.n);
    html += buildAdvancedChartCard({ id: card.id, title: title, badges: card.badges, height: card.height, interp: cmInterp(card.n), source: sources[card.n - 1] || '', test: 'Causal Forest DML', legend: legends[card.n] || null });
  });
  html += '</div>';
  container.innerHTML = html;
  plotCM1_3DHist(cf); plotCM2_Ranked(cf); plotCM3_3DHG(cf); plotCM4_Binned(cf);
  plotCM5_PDP(cf); plotCM6_BoxPR(cf); plotCM7_3DScatter(cf); plotCM8_3DSurface(cf);
  plotCM9_FeatImp(cf); plotCM10_BLP(cf); plotCM11_TOC(cf); plotCM12_Qini(cf);
}function plotCM1_3DHist(cf){ const r=cf.CATE_Distribution||[]; const vals=r.map(d=>d.CATE).filter(v=>v!=null); if(!vals.length)return; const NB=20,min=Math.min(...vals),max=Math.max(...vals),bw=(max-min)/NB; const bins=Array(NB).fill(0); vals.forEach(v=>{const i=Math.min(Math.floor((v-min)/bw),NB-1); bins[i]++;}); const mean=vals.reduce((a,b)=>a+b,0)/vals.length; const xs=[],ys=[],zs=[]; bins.forEach((c,i)=>{const xc=min+bw*(i+0.5); xs.push(xc,xc,null); ys.push(0,0,null); zs.push(0,c,null);}); const sc={xaxis:{title:'CATE',gridcolor:themeColors().grid},yaxis:{showticklabels:false,range:[-1,1],gridcolor:themeColors().grid},zaxis:{title:'Freq',gridcolor:themeColors().grid},camera:{eye:{x:1.6,y:-1.6,z:0.9}}}; Plotly.newPlot('cm-1',[{type:'scatter3d',mode:'lines',x:xs,y:ys,z:zs,line:{color:'#3498db',width:6},hoverinfo:'skip',showlegend:false},{type:'scatter3d',mode:'markers',x:bins.map((_,i)=>min+bw*(i+0.5)),y:bins.map(()=>0),z:bins,marker:{size:bins.map(c=>8+c*0.5),color:bins.map((_,i)=>min+bw*(i+0.5)),colorscale:'Plasma',line:{color:'#fff',width:1}},hovertemplate:'CATE: %{x:.3f}<br>Freq: %{z}<extra></extra>',showlegend:false},{type:'scatter3d',mode:'lines',x:[mean,mean],y:[0,0],z:[0,Math.max(...bins)*1.1],line:{color:'#e74c3c',width:6,dash:'dash'},hoverinfo:'skip',showlegend:false}],plotlyLayout({scene:sc,showlegend:false,margin:{l:0,r:0,t:10,b:0}}),PLOTLY_CFG); }
function plotCM2_Ranked(cf){ const r=cf.CATE_Distribution||[]; const vals=r.map(d=>d.CATE).filter(v=>v!=null).sort((a,b)=>a-b); if(!vals.length)return; Plotly.newPlot('cm-2',[{type:'scatter',mode:'lines',x:vals.map((_,i)=>i+1),y:vals,line:{color:'#3498db',width:2},fill:'tozeroy',fillcolor:'rgba(52,152,219,0.15)',hovertemplate:'Rank: %{x}<br>CATE: %{y:.4f}<extra></extra>'}],plotlyLayout({xaxis:{title:'Rank',gridcolor:themeColors().grid},yaxis:{title:'CATE',gridcolor:themeColors().grid},shapes:[{type:'line',x0:0,x1:vals.length,y0:0.333,y1:0.333,line:{color:'#e74c3c',dash:'dash',width:2}},{type:'line',x0:0,x1:vals.length,y0:0.533,y1:0.533,line:{color:'#27ae60',dash:'dash',width:2}}]}),PLOTLY_CFG); }
function plotCM3_3DHG(cf){ const r=cf.HG_Quartiles||[]; if(!r.length)return; const vals=r.map(d=>d.Mean_CATE),sds=r.map(d=>d.SD_CATE),labels=r.map(d=>d.HG_Quartile); const colors=['#e74c3c','#f39c12','#3498db','#27ae60']; const xs=[],ys=[],zs=[]; vals.forEach((v,i)=>{xs.push(i,i,null); ys.push(0,0,null); zs.push(0,v,null);}); const sc={xaxis:{title:'',tickvals:[0,1,2,3],ticktext:labels,gridcolor:themeColors().grid},yaxis:{showticklabels:false,range:[-1,1],gridcolor:themeColors().grid},zaxis:{title:'CATE',gridcolor:themeColors().grid},camera:{eye:{x:1.6,y:-1.6,z:0.9}}}; Plotly.newPlot('cm-3',[{type:'scatter3d',mode:'lines',x:xs,y:ys,z:zs,line:{color:'#7f8c9c',width:8},hoverinfo:'skip',showlegend:false},{type:'scatter3d',mode:'markers',x:vals.map((_,i)=>i),y:vals.map(()=>0),z:vals,marker:{size:22,color:colors,line:{color:'#fff',width:2}},text:labels,customdata:r.map(d=>[d.N,d.SD_CATE]),hovertemplate:'<b>%{text}</b><br>CATE: %{z:.4f}<br>N: %{customdata[0]}<extra></extra>',showlegend:false},{type:'scatter3d',mode:'lines',x:vals.flatMap((_,i)=>[i,i,null]),y:vals.flatMap(()=>[0,0,null]),z:vals.flatMap((v,i)=>[v-sds[i],v+sds[i],null]),line:{color:'#e8ecf1',width:3},hoverinfo:'skip',showlegend:false}],plotlyLayout({scene:sc,showlegend:false,margin:{l:0,r:0,t:10,b:0}}),PLOTLY_CFG); }
function plotCM4_Binned(cf){ const r=cf.Full_Data||[]; if(!r.length)return; const hg=r.map(d=>d.HG_score),cate=r.map(d=>d.CATE); const bins=10,min=Math.min(...hg),max=Math.max(...hg),bw=(max-min)/bins,bd=[]; for(let i=0;i<bins;i++){const lo=min+i*bw,hi=min+(i+1)*bw,inB=[]; cate.forEach((c,j)=>{if(hg[j]>=lo&&hg[j]<hi)inB.push(c);}); if(inB.length>0){const mean=inB.reduce((a,b)=>a+b,0)/inB.length; const sd=Math.sqrt(inB.reduce((a,b)=>a+(b-mean)**2,0)/inB.length); bd.push({x:(lo+hi)/2,mean,se:1.96*sd/Math.sqrt(inB.length),n:inB.length});}} Plotly.newPlot('cm-4',[{type:'scatter',mode:'lines+markers',x:bd.map(b=>b.x),y:bd.map(b=>b.mean),marker:{size:12,color:'#3498db'},line:{color:'#3498db',width:2},error_y:{type:'data',array:bd.map(b=>b.se),color:'#e8ecf1',thickness:2,width:6},customdata:bd.map(b=>b.n),hovertemplate:'HG: %{x:.2f}<br>CATE: %{y:.4f}<br>N: %{customdata}<extra></extra>'}],plotlyLayout({xaxis:{title:'HG',gridcolor:themeColors().grid},yaxis:{title:'CATE (95% CI)',gridcolor:themeColors().grid}}),PLOTLY_CFG); }
function plotCM5_PDP(cf){ const r=cf.Full_Data||[]; if(!r.length)return; const hg=r.map(d=>d.HG_score),pr=r.map(d=>d.PR_score),cate=r.map(d=>d.CATE); const medPR=[...pr].sort((a,b)=>a-b)[Math.floor(pr.length/2)]; const minHG=Math.min(...hg),maxHG=Math.max(...hg); const grid=Array.from({length:30},(_,i)=>minHG+(maxHG-minHG)*i/29); const pdp=grid.map(h=>{let ws=0,vs=0; for(let i=0;i<hg.length;i++){const dHg=Math.abs(hg[i]-h),dPr=Math.abs(pr[i]-medPR); if(dHg<0.5){const w=1/(1+dHg*dHg+dPr*dPr); ws+=w; vs+=w*cate[i];}} return ws>0?vs/ws:null;}); Plotly.newPlot('cm-5',[{type:'scatter',mode:'lines+markers',x:grid,y:pdp,line:{color:'#27ae60',width:3},marker:{size:6,color:'#27ae60'},fill:'tozeroy',fillcolor:'rgba(39,174,96,0.15)',hovertemplate:'HG: %{x:.2f}<br>Effect: %{y:.4f}<extra></extra>'}],plotlyLayout({xaxis:{title:'HG (PR at median)',gridcolor:themeColors().grid},yaxis:{title:'PDP Effect',gridcolor:themeColors().grid}}),PLOTLY_CFG); }
function plotCM6_BoxPR(cf){ const r=cf.Full_Data||[]; if(!r.length)return; const pr=r.map(d=>d.PR_score).sort((a,b)=>a-b); const q1=pr[Math.floor(pr.length*0.25)],q2=pr[Math.floor(pr.length*0.5)],q3=pr[Math.floor(pr.length*0.75)]; const groups={'PR-Q1':[],'PR-Q2':[],'PR-Q3':[],'PR-Q4':[]}; r.forEach(d=>{if(d.PR_score<=q1)groups['PR-Q1'].push(d.CATE);else if(d.PR_score<=q2)groups['PR-Q2'].push(d.CATE);else if(d.PR_score<=q3)groups['PR-Q3'].push(d.CATE);else groups['PR-Q4'].push(d.CATE);}); const colors=['#e74c3c','#f39c12','#3498db','#27ae60']; Plotly.newPlot('cm-6',Object.entries(groups).map(([n,v],i)=>({type:'box',y:v,name:n,boxmean:'sd',marker:{color:colors[i]}})),plotlyLayout({yaxis:{title:'CATE',gridcolor:themeColors().grid},xaxis:{title:'PR Quartile',gridcolor:themeColors().grid},showlegend:false}),PLOTLY_CFG); }
function plotCM7_3DScatter(cf){ const r=cf.Full_Data||[]; if(!r.length)return; const sc={xaxis:{title:'HG',gridcolor:themeColors().grid},yaxis:{title:'PR',gridcolor:themeColors().grid},zaxis:{title:'CATE',gridcolor:themeColors().grid},camera:{eye:{x:1.6,y:-1.6,z:0.9}}}; Plotly.newPlot('cm-7',[{type:'scatter3d',mode:'markers',x:r.map(d=>d.HG_score),y:r.map(d=>d.PR_score),z:r.map(d=>d.CATE),marker:{size:4,color:r.map(d=>d.CATE),colorscale:'Plasma',colorbar:{title:'CATE',thickness:15,tickfont:{color:themeColors().text}}},text:r.map(d=>d.HG_Quartile),hovertemplate:'HG: %{x:.2f}<br>PR: %{y:.2f}<br>CATE: %{z:.3f}<extra></extra>'}],plotlyLayout({scene:sc,showlegend:false,margin:{l:0,r:0,t:10,b:0}}),PLOTLY_CFG); }
function plotCM8_3DSurface(cf){ const r=cf.Full_Data||[]; if(!r.length)return; const hg=r.map(d=>d.HG_score),pr=r.map(d=>d.PR_score),cate=r.map(d=>d.CATE); const NX=30,NY=30,xg=[],yg=[]; const hgMin=Math.min(...hg),hgMax=Math.max(...hg),prMin=Math.min(...pr),prMax=Math.max(...pr); for(let i=0;i<NX;i++)xg.push(hgMin+(hgMax-hgMin)*i/(NX-1)); for(let j=0;j<NY;j++)yg.push(prMin+(prMax-prMin)*j/(NY-1)); const Z=yg.map(y=>xg.map(x=>{let ws=0,vs=0; for(let i=0;i<hg.length;i++){const d2=(hg[i]-x)**2+(pr[i]-y)**2+0.01,w=1/d2; ws+=w; vs+=w*cate[i];} return vs/ws;})); const sc={xaxis:{title:'HG',gridcolor:themeColors().grid},yaxis:{title:'PR',gridcolor:themeColors().grid},zaxis:{title:'CATE',gridcolor:themeColors().grid},camera:{eye:{x:1.6,y:-1.6,z:0.9}}}; Plotly.newPlot('cm-8',[{type:'surface',x:xg,y:yg,z:Z,colorscale:'Plasma',colorbar:{title:'CATE',thickness:15,tickfont:{color:themeColors().text}},contours:{z:{show:true,usecolormap:true,highlightcolor:'#fff',project:{z:true}}}}],plotlyLayout({scene:sc,showlegend:false,margin:{l:0,r:0,t:10,b:0}}),PLOTLY_CFG); }
function plotCM9_FeatImp(cf){ const r=cf.Feature_Importance||[]; if(!r.length)return; Plotly.newPlot('cm-9',[{type:'bar',orientation:'h',y:r.map(d=>d.Variable),x:r.map(d=>d.Importance),marker:{color:['#e67e22','#9b59b6'],line:{color:'#fff',width:2}},text:r.map(d=>d.Importance.toFixed(3)),textposition:'outside',hovertemplate:'<b>%{y}</b><br>Importance: %{x:.4f}<extra></extra>'}],plotlyLayout({xaxis:{title:'Importance',gridcolor:themeColors().grid,range:[0,0.75]},yaxis:{title:'',gridcolor:themeColors().grid},margin:{l:120,r:60,t:10,b:50}}),PLOTLY_CFG); }
function plotCM10_BLP(cf){
  const ov = cf.OverviewObj || (cf.Overview || []).reduce((o,r)=>{o[r.Metric]=r.Value; return o;}, {});
  const r2 = parseFloat(ov.BLP_R2 || 0.809);
  const calibP = parseFloat(ov.Calibration_Test_Pval != null ? ov.Calibration_Test_Pval : 0.031);
  const calibStatus = ov.Calibration_Status || (calibP < 0.05 ? '✅ Well-calibrated (p < 0.05)' : '⚠ Not calibrated');
  const calibColor = calibP < 0.05 ? '#27ae60' : '#e74c3c';
  Plotly.newPlot('cm-10',[{type:'indicator',mode:'gauge+number',value:r2,number:{font:{size:44,color:themeColors().text},valueformat:'.4f'},gauge:{axis:{range:[0,1],tickwidth:1,tickcolor:themeColors().text,tickfont:{color:themeColors().text}},bar:{color:'#27ae60',thickness:0.7},bgcolor:themeColors().plot,borderwidth:1,bordercolor:themeColors().grid,steps:[{range:[0,0.5],color:'rgba(231,76,60,.2)'},{range:[0.5,0.7],color:'rgba(243,156,18,.2)'},{range:[0.7,0.85],color:'rgba(39,174,96,.2)'},{range:[0.85,1],color:'rgba(39,174,96,.4)'}],threshold:{line:{color:'#e74c3c',width:3},thickness:0.75,value:0.7}}}],plotlyLayout({margin:{l:20,r:20,t:40,b:20},annotations:[{text:`Calibration p-value: ${calibP.toFixed(4)}<br><span style="color:${calibColor};font-weight:bold">${calibStatus}</span>`,x:0.5,y:0.05,xref:'paper',yref:'paper',showarrow:false,font:{size:12,color:themeColors().text}}]}),PLOTLY_CFG);
}
function plotCM11_TOC(cf){ const r=cf.Full_Data||[]; if(!r.length)return; const cate=r.map(d=>d.CATE); const n=cate.length,ate=cate.reduce((a,b)=>a+b,0)/n; const sorted=[...cate].sort((a,b)=>b-a); const cum=[]; let s=0; for(let i=0;i<n;i++){s+=sorted[i]; cum.push(s/n);} const frac=cum.map((_,i)=>(i+1)/n); const rand=frac.map(f=>f*ate); Plotly.newPlot('cm-11',[{type:'scatter',mode:'lines',x:frac,y:cum,name:'Model',line:{color:'#27ae60',width:3}},{type:'scatter',mode:'lines',x:frac,y:rand,name:'Random',line:{color:'#e74c3c',width:3,dash:'dash'}}],plotlyLayout({xaxis:{title:'Target fraction',gridcolor:themeColors().grid,tickformat:'.0%'},yaxis:{title:'Cumulative CATE',gridcolor:themeColors().grid},legend:{x:0.6,y:0.05}}),PLOTLY_CFG); }
function plotCM12_Qini(cf){ const r=cf.Full_Data||[]; if(!r.length)return; const cate=r.map(d=>d.CATE); const sorted=[...cate].sort((a,b)=>b-a); const cum=[]; let s=0; for(const v of sorted){s+=v; cum.push(s);} const total=cum[cum.length-1]; const frac=cum.map((_,i)=>(i+1)/cum.length); const rand=frac.map(f=>f*total); Plotly.newPlot('cm-12',[{type:'scatter',mode:'lines',x:frac,y:cum,name:'Model',line:{color:'#9b59b6',width:3},fill:'tozeroy',fillcolor:'rgba(155,89,182,0.15)'},{type:'scatter',mode:'lines',x:frac,y:rand,name:'Random',line:{color:'#e74c3c',width:2,dash:'dash'}}],plotlyLayout({xaxis:{title:'Sample fraction',gridcolor:themeColors().grid,tickformat:'.0%'},yaxis:{title:'Cumulative effect',gridcolor:themeColors().grid},legend:{x:0.6,y:0.05}}),PLOTLY_CFG); }

/* ================================================================
   SHAP (13-14)
   ================================================================ */
function renderSHAPSection(){
  const container = document.getElementById('shap-charts-container'); if(!container) return;
  const cf = (state.loaded && state.loaded.causalForest) || FALLBACK_CAUSAL_FOREST;
  const isFa = state.lang === 'fa';
  const b2d = [{type:'2d', label: isFa ? '۲بعدی' : '2D'}];
  const shapSources = ['causal_forest_results.xlsx → SHAP_Importance', 'causal_forest_results.xlsx → SHAP_Values'];
  let html = '<div class="cm-grid">';
  [13,14].forEach((n, idx) => {
    const title = (I18N[state.lang] && I18N[state.lang]['shap_chart_' + n + '_title']) || ('Chart '+n);
    html += buildAdvancedChartCard({ id: 'shap-' + n, title: title, badges: b2d, height: n === 14 ? 'tall' : '', interp: shapInterp(n), source: shapSources[idx] || '', test: 'SHAP (KernelExplainer)', legend: n === 13 ? '<span class="legend-item"><span class="legend-color" style="background:#e67e22"></span>PR</span><span class="legend-item"><span class="legend-color" style="background:#9b59b6"></span>HG</span>' : '<span class="legend-item"><span class="legend-color" style="background:linear-gradient(90deg,#3498db,#e74c3c)"></span>Blue=low, Red=high</span>' });
  });
  html += '</div>';
  container.innerHTML = html;
  plotSHAP13_Bar(cf);
  plotSHAP14_Summary(cf);
}function plotSHAP13_Bar(cf){ const imp=cf.SHAP_Importance||[]; if(!imp.length)return; Plotly.newPlot('shap-13',[{type:'bar',orientation:'h',y:imp.map(d=>d.Feature),x:imp.map(d=>d.Mean_Abs_SHAP),marker:{color:['#e67e22','#9b59b6'],line:{color:'#fff',width:2}},text:imp.map(d=>d.Mean_Abs_SHAP.toFixed(4)),textposition:'outside',hovertemplate:'<b>%{y}</b><br>|SHAP|: %{x:.4f}<extra></extra>'}],plotlyLayout({xaxis:{title:'Mean |SHAP|',gridcolor:themeColors().grid},yaxis:{title:'',gridcolor:themeColors().grid},margin:{l:120,r:60,t:10,b:50}}),PLOTLY_CFG); }
function plotSHAP14_Summary(cf){ const r=cf.SHAP_Values||[]; if(!r.length)return; const byF={}; r.forEach(d=>{if(!byF[d.Feature])byF[d.Feature]=[]; byF[d.Feature].push(d);}); const feats=Object.keys(byF).sort((a,b)=>{const ma=byF[a].reduce((s,d)=>s+Math.abs(d.SHAP_Value),0)/byF[a].length; const mb=byF[b].reduce((s,d)=>s+Math.abs(d.SHAP_Value),0)/byF[b].length; return mb-ma;}); const traces=feats.map((f,i)=>({type:'scatter',mode:'markers',x:byF[f].map(d=>d.SHAP_Value),y:byF[f].map(()=>i+(Math.random()-0.5)*0.3),marker:{color:byF[f].map(d=>d.Feature_Value),colorscale:'RdBu',reversescale:true,size:7,showscale:i===0,colorbar:{title:'Value',thickness:15,tickfont:{color:themeColors().text}}},name:f,hovertemplate:'<b>'+f+'</b><br>SHAP: %{x:.4f}<br>Value: %{marker.color:.2f}<extra></extra>'})); Plotly.newPlot('shap-14',traces,plotlyLayout({xaxis:{title:'SHAP Value',gridcolor:themeColors().grid,zeroline:true,zerolinecolor:'#e74c3c',zerolinewidth:2},yaxis:{title:'',tickvals:feats.map((_,i)=>i),ticktext:feats,gridcolor:themeColors().grid},showlegend:false,margin:{l:120,r:60,t:20,b:60}}),PLOTLY_CFG); }

/* ================================================================
   MONTE CARLO (15-22)
   ================================================================ */
function renderMonteCarloSection(){
  const container = document.getElementById('mc-charts-container'); if(!container) return;
  const mc = (state.loaded && state.loaded.monteCarlo) || FALLBACK_MONTE_CARLO;
  const isFa = state.lang === 'fa';
  const b3d = [{type:'3d', label: isFa?'۳بعدی':'3D'}];
  const b2d = [{type:'2d', label: isFa?'۲بعدی':'2D'}];
  const star = [{type:'star', label:'⭐'}];
  const mcSources = [
    'monte_carlo_results.xlsx → Indirect_Effects + Moderator_Effects',
    'monte_carlo_results.xlsx → Indirect_Effects',
    'monte_carlo_results.xlsx → Indirect_Effects',
    'monte_carlo_results.xlsx → Moderator_Effects',
    'monte_carlo_results.xlsx → Indirect_Effects + Moderator_Effects',
    'monte_carlo_results.xlsx → Distribution_Samples (4 effects)',
    'monte_carlo_results.xlsx → Distribution_Samples (8 effects)',
    'monte_carlo_results.xlsx → Distribution_Samples filtered H3a'
  ];
  const cards = [{id:'mc-15',n:15,badges:[...b2d,...star]},{id:'mc-16',n:16,badges:[...b2d,...star],height:'tall'},{id:'mc-17',n:17,badges:b3d,height:'tall'},{id:'mc-18',n:18,badges:b3d,height:'tall'},{id:'mc-19',n:19,badges:[...b3d,...star],height:'xtall'},{id:'mc-20',n:20,badges:b2d},{id:'mc-21',n:21,badges:b3d,height:'xtall'},{id:'mc-22',n:22,badges:b2d}];
  const legends = {15:'<span class="legend-item"><span class="legend-color" style="background:#3498db"></span>H3</span><span class="legend-item"><span class="legend-color" style="background:#e67e22"></span>H4</span>',16:'<span class="legend-item"><span class="legend-color" style="background:#3498db;border-radius:50%"></span>MC Mean</span><span class="legend-item"><span class="legend-line" style="background:#e8ecf1"></span>CI 95%</span><span class="legend-item"><span class="legend-line" style="background:#e74c3c"></span>Zero</span>',17:'<span class="legend-item"><span class="legend-color" style="background:#3498db"></span>H3a</span><span class="legend-item"><span class="legend-color" style="background:#e67e22"></span>H3b</span><span class="legend-item"><span class="legend-color" style="background:#27ae60"></span>H3c</span><span class="legend-item"><span class="legend-color" style="background:#9b59b6"></span>H3d</span><span class="legend-item"><span class="legend-color" style="background:#e74c3c"></span>H3e</span>',18:'<span class="legend-item"><span class="legend-color" style="background:#3498db"></span>H4a</span><span class="legend-item"><span class="legend-color" style="background:#e67e22"></span>H4b</span><span class="legend-item"><span class="legend-color" style="background:#27ae60"></span>H4c</span>',19:'<span class="legend-item"><span class="legend-color" style="background:#3498db"></span>H3</span><span class="legend-item"><span class="legend-color" style="background:#e67e22"></span>H4</span>',20:'<span class="legend-item"><span class="legend-color" style="background:#3498db"></span>H3a</span><span class="legend-item"><span class="legend-color" style="background:#e67e22"></span>H3b</span><span class="legend-item"><span class="legend-color" style="background:#27ae60"></span>H3c</span><span class="legend-item"><span class="legend-color" style="background:#9b59b6"></span>H3d</span>',22:'<span class="legend-item"><span class="legend-color" style="background:#3498db;border-radius:50%"></span>Sample</span><span class="legend-item"><span class="legend-line" style="background:#e74c3c"></span>Normal</span>'};
  let html = '<div class="cm-grid">';
  cards.forEach((card, idx) => {
    const title = (I18N[state.lang] && I18N[state.lang]['mc_chart_' + card.n + '_title']) || ('Chart '+card.n);
    html += buildAdvancedChartCard({ id: card.id, title: title, badges: card.badges, height: card.height, interp: mcInterp(card.n), source: mcSources[idx] || '', test: 'Monte Carlo Simulation', legend: legends[card.n] || null });
  });
  html += '</div>';
  container.innerHTML = html;
  plotMC15_EffectsBar(mc); plotMC16_Forest(mc); plotMC17_3DIndirect(mc);
  plotMC18_3DMod(mc); plotMC19_Compare(mc); plotMC20_Density(mc);
  plotMC21_Ridge(mc); plotMC22_QQ(mc);
}function plotMC15_EffectsBar(mc){ const ind=mc.Indirect_Effects||[],mod=mc.Moderator_Effects||[]; const all=[...ind,...mod]; if(!all.length)return; Plotly.newPlot('mc-15',[{type:'bar',x:all.map(d=>d.Hypothesis),y:all.map(d=>d.MC_Mean),marker:{color:all.map(d=>d.Hypothesis.startsWith('H3')?'#3498db':'#e67e22'),line:{color:'#fff',width:2}},text:all.map(d=>d.MC_Mean.toFixed(3)),textposition:'outside',customdata:all.map(d=>d.Result),hovertemplate:'<b>%{x}</b><br>%{y:.4f}<br>%{customdata}<extra></extra>'}],plotlyLayout({xaxis:{title:'Hypothesis',gridcolor:themeColors().grid},yaxis:{title:'Effect',gridcolor:themeColors().grid,range:[0,0.32]},showlegend:false}),PLOTLY_CFG); }
function plotMC16_Forest(mc){ const rows=mc.Indirect_Effects||[]; if(!rows.length)return; Plotly.newPlot('mc-16',[{type:'scatter',mode:'markers',x:rows.map(d=>d.MC_Mean),y:rows.map(d=>d.Hypothesis+' — '+d.Effect),marker:{size:14,color:'#3498db',line:{color:'#fff',width:2}},error_x:{type:'data',symmetric:false,array:rows.map(d=>d.CI_High-d.MC_Mean),arrayminus:rows.map(d=>d.MC_Mean-d.CI_Low),color:'#e8ecf1',thickness:2,width:8},customdata:rows.map(d=>[d.CI_Low,d.CI_High,d.SmartPLS_Beta]),hovertemplate:'<b>%{y}</b><br>MC: %{x:.4f}<br>CI: (%{customdata[0]:.4f}, %{customdata[1]:.4f})<extra></extra>'}],plotlyLayout({xaxis:{title:'Effect',gridcolor:themeColors().grid,zeroline:true,zerolinecolor:'#e74c3c',zerolinewidth:2},yaxis:{title:'',gridcolor:themeColors().grid},margin:{l:200,r:40,t:10,b:50},showlegend:false}),PLOTLY_CFG); }
function plotMC17_3DIndirect(mc){ const rows=mc.Indirect_Effects||[]; if(!rows.length)return; const labels=rows.map(d=>d.Hypothesis),vals=rows.map(d=>d.MC_Mean); const colors=['#3498db','#e67e22','#27ae60','#9b59b6','#e74c3c']; const xs=[],ys=[],zs=[]; vals.forEach((v,i)=>{xs.push(i,i,null); ys.push(0,0,null); zs.push(0,v,null);}); const sc={xaxis:{title:'',tickvals:vals.map((_,i)=>i),ticktext:labels,gridcolor:themeColors().grid},yaxis:{showticklabels:false,range:[-1,1],gridcolor:themeColors().grid},zaxis:{title:'Effect',gridcolor:themeColors().grid},camera:{eye:{x:1.6,y:-1.6,z:0.9}}}; Plotly.newPlot('mc-17',[{type:'scatter3d',mode:'lines',x:xs,y:ys,z:zs,line:{color:'#7f8c9c',width:8},hoverinfo:'skip',showlegend:false},{type:'scatter3d',mode:'markers',x:vals.map((_,i)=>i),y:vals.map(()=>0),z:vals,marker:{size:20,color:vals.map((_,i)=>colors[i%colors.length]),line:{color:'#fff',width:2}},text:labels,customdata:rows.map(d=>[d.CI_Low,d.CI_High,d.SmartPLS_Beta,d.Result]),hovertemplate:'<b>%{text}</b><br>MC: %{z:.4f}<br>CI: (%{customdata[0]:.4f}, %{customdata[1]:.4f})<extra></extra>',showlegend:false},{type:'scatter3d',mode:'lines',x:vals.flatMap((_,i)=>[i,i,null]),y:vals.flatMap(()=>[0,0,null]),z:vals.flatMap((v,i)=>[rows[i].CI_Low,rows[i].CI_High,null]),line:{color:'#e8ecf1',width:3},hoverinfo:'skip',showlegend:false}],plotlyLayout({scene:sc,showlegend:false,margin:{l:0,r:0,t:10,b:0}}),PLOTLY_CFG); }
function plotMC18_3DMod(mc){ const rows=mc.Moderator_Effects||[]; if(!rows.length)return; const labels=rows.map(d=>d.Hypothesis),vals=rows.map(d=>d.MC_Mean); const colors=['#3498db','#e67e22','#27ae60']; const xs=[],ys=[],zs=[]; vals.forEach((v,i)=>{xs.push(i,i,null); ys.push(0,0,null); zs.push(0,v,null);}); const sc={xaxis:{title:'',tickvals:vals.map((_,i)=>i),ticktext:labels,gridcolor:themeColors().grid},yaxis:{showticklabels:false,range:[-1,1],gridcolor:themeColors().grid},zaxis:{title:'Effect',gridcolor:themeColors().grid},camera:{eye:{x:1.6,y:-1.6,z:0.9}}}; Plotly.newPlot('mc-18',[{type:'scatter3d',mode:'lines',x:xs,y:ys,z:zs,line:{color:'#7f8c9c',width:8},hoverinfo:'skip',showlegend:false},{type:'scatter3d',mode:'markers',x:vals.map((_,i)=>i),y:vals.map(()=>0),z:vals,marker:{size:20,color:vals.map((_,i)=>colors[i%colors.length]),line:{color:'#fff',width:2}},text:labels,customdata:rows.map(d=>[d.CI_Low,d.CI_High,d.SmartPLS_Beta,d.Result]),hovertemplate:'<b>%{text}</b><br>MC: %{z:.4f}<extra></extra>',showlegend:false},{type:'scatter3d',mode:'lines',x:vals.flatMap((_,i)=>[i,i,null]),y:vals.flatMap(()=>[0,0,null]),z:vals.flatMap((v,i)=>[rows[i].CI_Low,rows[i].CI_High,null]),line:{color:'#e8ecf1',width:3},hoverinfo:'skip',showlegend:false}],plotlyLayout({scene:sc,showlegend:false,margin:{l:0,r:0,t:10,b:0}}),PLOTLY_CFG); }
function plotMC19_Compare(mc){ const all=[...(mc.Indirect_Effects||[]),...(mc.Moderator_Effects||[])]; if(!all.length)return; const sc={xaxis:{title:'SmartPLS β',gridcolor:themeColors().grid},yaxis:{title:'MC Mean',gridcolor:themeColors().grid},zaxis:{title:'Δ',gridcolor:themeColors().grid},camera:{eye:{x:1.6,y:-1.6,z:0.9}}}; Plotly.newPlot('mc-19',[{type:'scatter3d',mode:'markers+text',x:all.map(d=>d.SmartPLS_Beta),y:all.map(d=>d.MC_Mean),z:all.map(d=>d.MC_Mean-d.SmartPLS_Beta),marker:{size:16,color:all.map(d=>d.Hypothesis.startsWith('H3')?'#3498db':'#e67e22'),line:{color:'#fff',width:2}},text:all.map(d=>d.Hypothesis),textposition:'top center',textfont:{size:9,color:themeColors().text},hovertemplate:'<b>%{text}</b><br>SmartPLS: %{x:.4f}<br>MC: %{y:.4f}<br>Δ: %{z:.5f}<extra></extra>',showlegend:false}],plotlyLayout({scene:sc,showlegend:false,margin:{l:0,r:0,t:10,b:0}}),PLOTLY_CFG); }
function plotMC20_Density(mc){ const r=mc.Distribution_Samples||[]; if(!r.length)return; const byE={}; r.forEach(d=>{if(!byE[d.Effect])byE[d.Effect]=[]; byE[d.Effect].push(d.Value);}); const colors=['#3498db','#e67e22','#27ae60','#9b59b6']; const traces=Object.entries(byE).slice(0,4).map(([n,v],i)=>({type:'histogram',x:v,name:n,opacity:0.7,histnorm:'probability density',marker:{color:colors[i]}})); Plotly.newPlot('mc-20',traces,plotlyLayout({xaxis:{title:'Value',gridcolor:themeColors().grid},yaxis:{title:'Density',gridcolor:themeColors().grid},barmode:'overlay',legend:{x:0.7,y:0.95}}),PLOTLY_CFG); }
function plotMC21_Ridge(mc){ const r=mc.Distribution_Samples||[]; if(!r.length)return; const byE={}; r.forEach(d=>{if(!byE[d.Effect])byE[d.Effect]=[]; byE[d.Effect].push(d.Value);}); const effs=Object.keys(byE); const allV=Object.values(byE).flat(); const min=Math.min(...allV),max=Math.max(...allV); const g=Array.from({length:80},(_,i)=>min+(max-min)*i/79); const colors=['#3498db','#e67e22','#27ae60','#9b59b6','#e74c3c','#f39c12','#1abc9c','#e91e63']; const traces=effs.map((eff,idx)=>{const v=byE[eff],m=v.reduce((a,b)=>a+b,0)/v.length; const sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length)||0.01; const pdf=g.map(x=>Math.exp(-((x-m)**2)/(2*sd*sd))/(sd*Math.sqrt(2*Math.PI))); return {type:'scatter3d',mode:'lines',x:g,y:Array(g.length).fill(idx),z:pdf,line:{color:colors[idx%colors.length],width:6},showlegend:false,hovertemplate:'<b>'+eff+'</b><br>%{x:.4f}<br>%{z:.4f}<extra></extra>'};}); const sc={xaxis:{title:'Value',gridcolor:themeColors().grid},yaxis:{title:'',tickvals:effs.map((_,i)=>i),ticktext:effs,gridcolor:themeColors().grid},zaxis:{title:'Density',gridcolor:themeColors().grid},camera:{eye:{x:1.8,y:-1.6,z:0.8}}}; Plotly.newPlot('mc-21',traces,plotlyLayout({scene:sc,showlegend:false,margin:{l:0,r:0,t:10,b:0}}),PLOTLY_CFG); }
function invNormPlot(p){ const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00]; const b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01]; const c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00]; const d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00]; const pl=0.02425,ph=1-pl; if(p<pl){const q=Math.sqrt(-2*Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);} else if(p<=ph){const q=p-0.5,r=q*q; return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);} else {const q=Math.sqrt(-2*Math.log(1-p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);} }
function plotMC22_QQ(mc){ const r=mc.Distribution_Samples||[]; const eff='H3a (PR→DT→SUS)'; const v=r.filter(d=>d.Effect===eff).map(d=>d.Value).sort((a,b)=>a-b); if(v.length<3)return; const n=v.length,m=v.reduce((a,b)=>a+b,0)/n; const sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/n)||0.01; const theo=v.map((_,i)=>m+sd*invNormPlot((i+0.5)/n)); Plotly.newPlot('mc-22',[{type:'scatter',mode:'markers',x:theo,y:v,marker:{color:'#3498db',size:5}},{type:'scatter',mode:'lines',x:[Math.min(...theo),Math.max(...theo)],y:[Math.min(...theo),Math.max(...theo)],line:{color:'#e74c3c',dash:'dash',width:2}}],plotlyLayout({xaxis:{title:'Theoretical normal',gridcolor:themeColors().grid},yaxis:{title:'Sample',gridcolor:themeColors().grid},showlegend:false}),PLOTLY_CFG); }

/* ================================================================
   TEST NAMES + togglePanel
   ================================================================ */
const CHART_TEST_NAMES = {
  'chart-desc-gender':'آمار توصیفی — توزیع فراوانی','chart-desc-age':'آمار توصیفی — توزیع فراوانی','chart-desc-edu':'آمار توصیفی — توزیع فراوانی','chart-desc-distance':'آمار توصیفی — توزیع فراوانی','chart-desc-cost':'آمار توصیفی — توزیع فراوانی','chart-desc-sd':'آمار توصیفی — مقایسه پراکندگی',
  'chart-l1-path':'PLS Algorithm — Path Coefficients','chart-l1-beta-bar':'Bootstrapping — Path Coefficients (95% CI)','chart-l1-r2':'PLS Algorithm — R² و R²-Adjusted','chart-l1-f2':"PLS Algorithm — Cohen's f² Effect Size",'chart-l1-quality':'PLS Algorithm — پایایی و روایی همگرا','chart-l1-loadings':'PLS Algorithm — Outer Loadings','chart-l1-vif':'PLS Algorithm — VIF (هم‌خطی چندگانه)','chart-l1-htmt':'PLS Algorithm — HTMT (روایی واگرا)','chart-l1-slopes':'PLS Algorithm — Simple Slopes (تعدیل‌گری)','chart-l1-raincloud':'PLS Algorithm — توزیع امتیازهای پنهان',
  'chart-l2-forest':'Bootstrapping — Forest Plot (95% CI)','chart-l2-sig':'Bootstrapping — چشم‌انداز معناداری','chart-l2-landscape':'Bootstrapping — ضرایب مسیر بر اساس T',
  'chart-l3-q2':'PLS Predict — Q²predict','chart-l3-q2-2':'PLS Predict — Q²predict (فیلترشده)','chart-l3-stems':'PLS Predict — RMSE مقایسه PLS vs LM vs IA','chart-l3-landscape':'PLS Predict — چشم‌انداز RMSE','chart-l3-ridge':'PLS Predict — پشته Q²','chart-l3-cvpat':'CVPAT — آزمون توان پیش‌بینی متقابل','chart-l3-ridgeline':'PLS Predict — توزیع خطا','chart-l3-scatter':'PLS Predict — PLS vs LM Scatter','chart-l3-forest':'CVPAT — Forest Plot'
};
const CHART_TEST_NAMES_EN = {
  'chart-desc-gender':'Descriptive — Frequency Distribution','chart-desc-age':'Descriptive — Frequency Distribution','chart-desc-edu':'Descriptive — Frequency Distribution','chart-desc-distance':'Descriptive — Frequency Distribution','chart-desc-cost':'Descriptive — Frequency Distribution','chart-desc-sd':'Descriptive — Dispersion Comparison',
  'chart-l1-path':'PLS Algorithm — Path Coefficients','chart-l1-beta-bar':'Bootstrapping — Path Coefficients (95% CI)','chart-l1-r2':'PLS Algorithm — R² & R²-Adjusted','chart-l1-f2':"PLS Algorithm — Cohen's f²",'chart-l1-quality':'PLS Algorithm — Reliability & Convergent Validity','chart-l1-loadings':'PLS Algorithm — Outer Loadings','chart-l1-vif':'PLS Algorithm — VIF (Multicollinearity)','chart-l1-htmt':'PLS Algorithm — HTMT (Discriminant Validity)','chart-l1-slopes':'PLS Algorithm — Simple Slopes (Moderation)','chart-l1-raincloud':'PLS Algorithm — Latent Score Distribution',
  'chart-l2-forest':'Bootstrapping — Forest Plot (95% CI)','chart-l2-sig':'Bootstrapping — Significance Landscape','chart-l2-landscape':'Bootstrapping — Path Coefficients by T',
  'chart-l3-q2':'PLS Predict — Q²predict','chart-l3-q2-2':'PLS Predict — Q²predict (filtered)','chart-l3-stems':'PLS Predict — RMSE: PLS vs LM vs IA','chart-l3-landscape':'PLS Predict — RMSE Landscape','chart-l3-ridge':'PLS Predict — Q² Ridge','chart-l3-cvpat':'CVPAT — Cross-Validated Predictive Ability Test','chart-l3-ridgeline':'PLS Predict — Error Distribution','chart-l3-scatter':'PLS Predict — PLS vs LM Scatter','chart-l3-forest':'CVPAT — Forest Plot'
};
function injectTestNames(){
  document.querySelectorAll('.plot').forEach(plotEl => {
    if(plotEl.closest('.cm-grid')) return;
    const id = plotEl.id;
    if(!CHART_TEST_NAMES[id]) return;
    const card = plotEl.closest('.chart-card');
    if(!card) return;
    card.querySelectorAll('.test-name-badge').forEach(b => b.remove());
    const testName = getTestName(id);
    const badge = document.createElement('div');
    badge.className = 'test-name-badge';
    badge.innerHTML = `<strong>${ti('badge_methods')}</strong> ${testName}`;
    badge.style.cssText = 'margin-top:10px; padding:8px 14px; background:rgba(155,89,182,.08); border-right:3px solid #8e44ad; border-radius:6px; font-size:11.5px; color:var(--text-muted); direction:rtl; line-height:1.7;';
    const title = card.querySelector('.chart-title');
    if(title && title.nextSibling) { card.insertBefore(badge, title.nextSibling); }
    else { card.appendChild(badge); }
  });
}
function togglePanel(panelId, btn) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    panel.classList.remove('open');
    btn.innerHTML = `<span class="icon-bulb">💡</span><span>${ti('show_btn')}</span>`;
    btn.style.background = 'linear-gradient(135deg, rgba(52,152,219,.15), rgba(52,152,219,.05))';
    btn.style.color = '#5dade2';
    btn.style.borderColor = '#3498db';
  } else {
    panel.classList.add('open');
    btn.innerHTML = `<span class="icon-bulb">💡</span><span>${ti('hide_btn')}</span>`;
    btn.style.background = 'linear-gradient(135deg, rgba(231,76,60,.15), rgba(231,76,60,.05))';
    btn.style.color = '#ec7063';
    btn.style.borderColor = '#e74c3c';
  }
}

/* ================================================================
   INJECT MAIN INTERPRETATIONS — با اصلاح ?.prop = value
   ================================================================ */
function injectMainInterpretations() {
  document.querySelectorAll('.chart-card').forEach(card => {
    const plot = card.querySelector('.plot');
    if (!plot) return;
    const id = plot.id;
    if (!MAIN_CHART_INTS[id]) return;
    card.querySelectorAll('.btn-interpretation').forEach(b => b.remove());
    card.querySelectorAll('.interpretation-panel').forEach(p => p.remove());
    const title = card.querySelector('.chart-title');
    if (!title) return;
    const panelId = id + '-panel';
    title.insertAdjacentHTML('beforeend',
      `<button class="btn-interpretation" onclick="togglePanel('${panelId}', this)" style="margin-right:8px;">
         <span class="icon-bulb">💡</span><span>${ti('show_btn')}</span>
       </button>`
    );
    card.insertAdjacentHTML('beforeend',
      `<div class="interpretation-panel" id="${panelId}">
         <div class="interpretation-content">
           <div class="interp-header">
             <span class="interp-header-icon">📊</span>
             <span class="interp-title">${ti('title_chart')}</span>
           </div>
           <div class="interp-body">${getChartInt(id)}</div>
         </div>
       </div>`
    );
  });

  Object.keys(MAIN_TABLE_INTS).forEach(id => {
    const cont = document.getElementById(id);
    if (!cont) return;
    const panelId = id + '-panel';
    const oldPanel = document.getElementById(panelId);
    if (oldPanel) oldPanel.remove();
    const oldBtn = document.getElementById(panelId + '-btn');
    if (oldBtn) oldBtn.remove();
    const data = getTableInt(id);
    if (!data) return;
    const btnHtml = `
      <button id="${panelId}-btn" class="btn-interpretation" onclick="togglePanel('${panelId}', this)" style="margin-bottom:12px; display:flex; margin-right:auto; margin-left:0;">
        <span class="icon-bulb">💡</span><span>${ti('show_btn')}</span>
      </button>
      <div class="interpretation-panel" id="${panelId}" style="margin-bottom:12px;">
        <div class="interpretation-content">
          <div class="interp-header">
            <span class="interp-header-icon">📊</span>
            <span class="interp-title">${data.title}</span>
          </div>
          <div class="interp-body">${data.text}</div>
        </div>
      </div>
    `;
    cont.insertAdjacentHTML('beforebegin', btnHtml);
  });

  setTimeout(() => {
    document.querySelectorAll('.vif-row').forEach(row => {
      if (row.dataset.hasTooltip) return;
      row.dataset.hasTooltip = "true";
      row.addEventListener('mouseenter', (e) => {
        const ind = row.querySelector('.vif-ind-chip')?.textContent || '?';
        const val = parseFloat(row.querySelector('.vif-val-chip')?.textContent || '0');
        let msg = state.lang === 'fa' ? `<strong>شاخص ${ind}:</strong> مقدار VIF = ${val}. ` : `<strong>Indicator ${ind}:</strong> VIF = ${val}. `;
        if (val > 5) msg += state.lang === 'fa' ? '<span style="color:#ec7063">هم‌خطی شدید (نیاز به بازبینی).</span>' : '<span style="color:#ec7063">Severe multicollinearity (needs review).</span>';
        else if (val > 3.3) msg += state.lang === 'fa' ? '<span style="color:#f39c12">هم‌خطی متوسط (قابل قبول).</span>' : '<span style="color:#f39c12">Moderate multicollinearity (acceptable).</span>';
        else msg += state.lang === 'fa' ? '<span style="color:#2ecc71">بدون مشکل جدی.</span>' : '<span style="color:#2ecc71">No serious issue.</span>';
        let tooltip = document.getElementById('vif-row-tooltip');
        if (!tooltip) { tooltip = document.createElement('div'); tooltip.id = 'vif-row-tooltip'; tooltip.className = 'table-tooltip'; document.body.appendChild(tooltip); }
        tooltip.innerHTML = msg;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
      });
      row.addEventListener('mousemove', (e) => {
        const tooltip = document.getElementById('vif-row-tooltip');
        if (tooltip) { tooltip.style.left = (e.clientX + 15) + 'px'; tooltip.style.top = (e.clientY + 15) + 'px'; }
      });
      // 🔧 FIX: جایگزینی ?.style.display = 'none' با if
      row.addEventListener('mouseleave', () => {
        const tip = document.getElementById('vif-row-tooltip');
        if (tip) tip.style.display = 'none';
      });
    });
  }, 500);
}

/* ================================================================
   RENDER ALL
   ================================================================ */
function renderChartsForActiveTab(){
  const active = document.querySelector('.page.active'); if(!active) return;
  const id = active.id.replace('section-','');
  document.querySelectorAll('.plot').forEach(el => { if(el.children && el.children.length) { try { Plotly.purge(el); } catch(e){} } });
  try{
    if(id === 'causal-ml'){ renderCausalMLSection(); return; }
    if(id === 'shap'){ renderSHAPSection(); return; }
    if(id === 'monte-carlo'){ renderMonteCarloSection(); return; }
    if (isMobile()) { renderMobileCharts(id); }
    else {
      switch(id){
        case 'descriptive': renderDescriptiveStatistics(); break;
        case 'l1-path': drawL1PathDiagram(); drawL1BetaBar(); break;
        case 'l1-quality': drawL1R2(); drawL1F2(); drawL1Quality(); break;
        case 'l1-loadings': drawL1Loadings(); drawL1VIF(); break;
        case 'l1-vif-table': renderVIFTable(); break;
        case 'l1-reliability': renderReliabilityTables(); break;
        case 'l1-htmt': drawL1HTMT(); break;
        case 'l1-moderation': drawL1Slopes(); drawL1Raincloud(); break;
        case 'l2-forest': drawL2Forest(); break;
        case 'l2-significance': drawL2Sig(); break;
        case 'l2-landscape': drawL2Landscape(); break;
        case 'l3-overview': drawL3Q2Columns('chart-l3-q2'); break;
        case 'l3-charts': drawL3Q2Columns('chart-l3-q2-2'); drawL3Stems(); drawL3Landscape(); drawL3Ridge(); drawL3CVPAT(); drawL3Ridgeline(); drawL3Scatter(); drawL3Forest(); break;
        case 'hypotheses': renderHypotheses(); break;
        case 'smartpls-graphical': renderSmartPLSGraphics(); break;
      }
    }
    setTimeout(injectTestNames, 300);
  }catch(e){ console.error('Chart draw error:', e); }
  setTimeout(injectMainInterpretations, 400);
}
function renderAll(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.innerHTML=t(el.dataset.i18n);});
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{el.placeholder=t(el.dataset.i18nPh);});
  document.documentElement.lang=state.lang; document.documentElement.dir=state.lang==='fa'?'rtl':'ltr'; document.documentElement.dataset.theme=state.theme;
  if(!state.loaded)return;
  renderKPIs(); renderMultiSelect(); renderTable(); updateStatus();
  renderChartsForActiveTab(); renderExcelViewer();
  bindHypothesisFilters(); bindVIFTableFilters(); renderReliabilityTables();
  setTimeout(injectMainInterpretations, 400);
}
function updateStatus(){
  const n=state.selected.size,total=DATA.indicators.length;
  const txt=n===total?`${t('status_ready')} · ${total}`:`${t('status_filtered')} · ${n}/${total}`;
  $('status-text').textContent=txt; $('status-dot').style.background=n===total?'#27ae60':'#f39c12'; $('ms-label').textContent=n===total?t('all_indicators'):`${n} ${t('indicators_selected')}`;
}
function downloadCSV(){
  let csv='Layer,Entity,Metric,Value1,Value2,Value3\n';
  DATA.indicators.forEach((ind,i)=>{ csv+=`PLS_Predict,${ind},Q2,${DATA.Q2[i]},,\n`; csv+=`PLS_Predict,${ind},RMSE_PLS,${DATA.PLS_RMSE[i]},,\n`; csv+=`PLS_Predict,${ind},RMSE_LM,${DATA.LM_RMSE[i]},,\n`; csv+=`PLS_Predict,${ind},RMSE_IA,${DATA.IA_RMSE[i]},,\n`; });
  state.loaded.paths.forEach(p=>{ csv+=`Bootstrapping,${p.Path},Path,${p.Original},${p.T},${p.P}\n`; });
  state.loaded.r2.forEach(r=>{ csv+=`PLS_Algorithm,${r.Construct},R2,${r.R2},${r.R2_Adj},\n`; });
  state.loaded.f2.forEach(f=>{ csv+=`PLS_Algorithm,${f.Path},f2,${f.f2},,\n`; });
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='smartpls_data.csv'; a.click();
}

/* ================================================================
   EVENT BINDINGS
   ================================================================ */
$('lang-btn').onclick=()=>{ state.lang=state.lang==='fa'?'en':'fa'; $('lang-btn').textContent=state.lang==='fa'?'EN':'FA'; renderAll(); };
$('theme-btn').onclick=()=>{ state.theme=state.theme==='dark'?'light':'dark'; $('theme-btn').textContent=state.theme==='dark'?'🌙':'☀️'; renderAll(); };
$('print-btn').onclick=()=>window.print();
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active'); const sec=$('section-'+btn.dataset.section); if(sec)sec.classList.add('active');
    const inL3=['l3-overview','l3-charts'].includes(btn.dataset.section); $('filter-bar').style.display=inL3?'flex':'none';
    renderChartsForActiveTab(); renderExcelViewer(); bindHypothesisFilters(); bindVIFTableFilters();
    setTimeout(()=>window.dispatchEvent(new Event('resize')),100);
  };
});
$('table-search').oninput=e=>{state.searchTerm=e.target.value;renderTable();};
$('reset-filter').onclick=()=>{ state.selected=new Set(DATA.indicators.map((_,i)=>i)); state.highlighted=null; renderAll(); $('info-panel').classList.add('hidden'); };

/* ================================================================
   BOOTSTRAP
   ================================================================ */
window.addEventListener('DOMContentLoaded', async ()=>{
  $('theme-btn').textContent='🌙';
  state.loaded={
    paths:FALLBACK_PATHS, r2:FALLBACK_R2, f2:FALLBACK_F2,
    loadings:FALLBACK_LOADINGS, quality:FALLBACK_QUALITY,
    vif:FALLBACK_VIF, vifTable:FALLBACK_VIF_TABLE,
    reliability:FALLBACK_RELIABILITY, descriptive:FALLBACK_DESCRIPTIVE,
    htmt:FALLBACK_HTMT, latent:FALLBACK_LATENT,
    causalForest:FALLBACK_CAUSAL_FOREST, monteCarlo:FALLBACK_MONTE_CARLO,
    sources:{}
  };
  renderAll();
  const src=$('data-source'); src.textContent=t('ds_loading');
  try{
    const loaded=await loadAllData();
    const useExcel=Object.values(loaded.sources).some(s=>s==='excel');
    if(useExcel){ state.loaded=loaded; src.textContent=t('ds_loaded'); src.classList.add('loaded'); renderAll(); }
    else{ src.textContent=t('ds_fallback'); }
  }catch(e){ console.log('Excel load failed:',e); src.textContent=t('ds_fallback'); }
});