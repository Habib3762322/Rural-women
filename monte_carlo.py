# ============================================
# مونت‌کارلو پیشرفته + تحلیل حساسیت + ۱۰ شیت
# خروجی: monte_carlo_results.xlsx + 2 CSV
# نسخه اصلاح‌شده — رفع باگ SmartPLS_Beta
# ============================================
import numpy as np
import pandas as pd
from datetime import datetime

np.random.seed(42)
K_MAIN = 10000

# ---------- ۱. ورودی‌ها ----------
paths = {
    'PR_DT':  {'beta': 0.2619, 'se': 0.0669},
    'DT_SUS': {'beta': 0.3735, 'se': 0.0519},
    'PR_SUS': {'beta': 0.2305, 'se': 0.0531},
    'HG_PR':  {'beta': 0.5424, 'se': 0.0477},
    'HG_DT':  {'beta': 0.2742, 'se': 0.0652},
    'HG_SUS': {'beta': 0.2096, 'se': 0.0595},
}
interactions = {
    'HGxPR_DT':  {'beta': 0.2563, 'se': 0.0727},
    'HGxPR_SUS': {'beta': 0.0960, 'se': 0.0310},
    'HGxDT_SUS': {'beta': 0.1765, 'se': 0.0601},
}
smartpls_indirect = {
    'H3a (PR→DT→SUS)': 0.098, 'H3b (HG→PR→DT)': 0.142,
    'H3c (HG→DT→SUS)': 0.102, 'H3d (HG→PR→SUS)': 0.125,
    'H3e (HG→PR→DT→SUS)': 0.053,
}
smartpls_mod = {
    'H4a (HG×PR→DT)': 0.256, 'H4b (HG×PR→SUS)': 0.096, 'H4c (HG×DT→SUS)': 0.177
}

# ---------- ۲. تابع شبیه‌سازی ----------
def simulate(K):
    local_rng = np.random.default_rng(42)
    samples = {n: local_rng.normal(p['beta'], p['se'], K) for n, p in {**paths, **interactions}.items()}
    indirect = {
        'H3a (PR→DT→SUS)':    samples['PR_DT'] * samples['DT_SUS'],
        'H3b (HG→PR→DT)':     samples['HG_PR'] * samples['PR_DT'],
        'H3c (HG→DT→SUS)':    samples['HG_DT'] * samples['DT_SUS'],
        'H3d (HG→PR→SUS)':    samples['HG_PR'] * samples['PR_SUS'],
        'H3e (HG→PR→DT→SUS)': samples['HG_PR'] * samples['PR_DT'] * samples['DT_SUS'],
    }
    moderator = {
        'H4a (HG×PR→DT)':  samples['HGxPR_DT'],
        'H4b (HG×PR→SUS)': samples['HGxPR_SUS'],
        'H4c (HG×DT→SUS)': samples['HGxDT_SUS'],
    }
    return indirect, moderator, samples

def effect_size_label(v):
    a = abs(v)
    if a < 0.10: return 'ناچیز'
    if a < 0.30: return 'کوچک'
    if a < 0.50: return 'متوسط'
    return 'بزرگ'

def p_value_from_samples(arr):
    p = 2 * min(float(np.mean(arr <= 0)), float(np.mean(arr >= 0)))
    return max(p, 1e-10)

# ---------- ۳. شبیه‌سازی اصلی ----------
print("="*60)
print(f"⏳ شبیه‌سازی اصلی K={K_MAIN:,}...")
print("="*60)
indirect_samples, moderator_samples, _ = simulate(K_MAIN)

# ---------- ۴. جدول اثرات ----------
def build_table(sd, sp, cat):
    rows = []
    for name, arr in sd.items():
        m = float(np.mean(arr)); s = float(np.std(arr, ddof=1))
        lo, hi = np.percentile(arr, [2.5, 97.5])
        p = p_value_from_samples(arr)
        sig = 'تأیید' if (lo > 0 or hi < 0) else 'رد'
        spv = sp[name]; diff = m - spv
        rel = (diff / spv * 100) if spv != 0 else 0
        rows.append({'Hypothesis': name.split(' ')[0], 'Effect': name.split(' ', 1)[1],
                     'Category': cat, 'MC_Mean': round(m, 4), 'SD': round(s, 4),
                     'CI_Low': round(lo, 4), 'CI_High': round(hi, 4),
                     'P_Value': round(p, 6), 'Effect_Size': effect_size_label(m),
                     'SmartPLS_Beta': spv, 'Abs_Diff': round(abs(diff), 6),
                     'Rel_Diff_Pct': round(rel, 4), 'Result': sig})
    return pd.DataFrame(rows)

indirect_df = build_table(indirect_samples, smartpls_indirect, 'غیرمستقیم (میانجی)')
moderator_df = build_table(moderator_samples, smartpls_mod, 'تعدیل‌گری')

# ---------- ۵. جدول مقایسه یکپارچه ----------
comparison_df = pd.concat([indirect_df, moderator_df], ignore_index=True)
comparison_df = comparison_df.sort_values('MC_Mean', ascending=False).reset_index(drop=True)
comparison_df['Rank'] = comparison_df.index + 1
# ✅ اصلاح: SmartPLS_Beta در لیست ستون‌ها حفظ شد
comparison_df = comparison_df[['Rank','Hypothesis','Effect','Category','MC_Mean','SD',
                                'CI_Low','CI_High','SmartPLS_Beta','Effect_Size','Result']]

# ---------- ۶. جدول درصدک‌ها ----------
perc_rows = []
for name, arr in {**indirect_samples, **moderator_samples}.items():
    pcts = np.percentile(arr, [1,5,10,25,50,75,90,95,99])
    s = pd.Series(arr)
    perc_rows.append({
        'Hypothesis': name.split(' ')[0], 'Effect': name.split(' ', 1)[1],
        'P1': round(pcts[0],4), 'P5': round(pcts[1],4), 'P10': round(pcts[2],4),
        'P25': round(pcts[3],4), 'P50_Median': round(pcts[4],4), 'P75': round(pcts[5],4),
        'P90': round(pcts[6],4), 'P95': round(pcts[7],4), 'P99': round(pcts[8],4),
        'IQR': round(pcts[5]-pcts[3],4),
        'Skewness': round(float(s.skew()),4),
        'Kurtosis': round(float(s.kurtosis()),4),
    })
percentile_df = pd.DataFrame(perc_rows)

# ---------- ۷. تحلیل حساسیت ----------
print("\n⏳ تحلیل حساسیت با K های مختلف...")
K_values = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000]
sens_rows = []
for K in K_values:
    ind, mod, _ = simulate(K)
    for name, arr in {**ind, **mod}.items():
        sens_rows.append({'K': K, 'Hypothesis': name.split(' ')[0],
                          'Effect': name.split(' ', 1)[1],
                          'Mean': round(float(np.mean(arr)), 6),
                          'SD': round(float(np.std(arr, ddof=1)), 6)})
sensitivity_df = pd.DataFrame(sens_rows)
sensitivity_pivot = sensitivity_df.pivot_table(
    index=['Hypothesis','Effect'], columns='K', values='Mean', aggfunc='first'
).reset_index()
sensitivity_pivot.columns = [c if isinstance(c, str) else f'K={c}' for c in sensitivity_pivot.columns]

# ---------- ۸. خلاصه استحکام ----------
rob_rows = []
for name, arr in {**indirect_samples, **moderator_samples}.items():
    hyp = name.split(' ')[0]
    subset = sensitivity_df[sensitivity_df['Hypothesis']==hyp].sort_values('K')
    means = subset['Mean'].values
    if len(means) == 0: continue
    m_early, m_main, m_final = means[0], means[5], means[-1]
    cv = float(np.std(means) / abs(np.mean(means))) if np.mean(means)!=0 else 0
    converged = abs(m_main - m_final) / abs(m_final) < 0.05 if m_final!=0 else True
    rel_chg = (abs(m_final - m_early) / abs(m_early) * 100) if m_early!=0 else 0
    rob_rows.append({'Hypothesis': hyp, 'Effect': name.split(' ',1)[1],
                     'Mean_K100': round(m_early,6), 'Mean_K10000': round(m_main,6),
                     'Mean_K50000': round(m_final,6),
                     'Abs_Change': round(abs(m_final-m_early),6),
                     'Rel_Change_Pct': round(rel_chg,4),
                     'CV_Across_K': round(cv,6),
                     'Convergence_Status': '✅ همگرا' if converged else '⚠ ناپایدار'})
robustness_df = pd.DataFrame(rob_rows)

# ---------- ۹. Overview ----------
n_ic = int((indirect_df['Result']=='تأیید').sum())
n_mc = int((moderator_df['Result']=='تأیید').sum())
max_i = float(indirect_df['Abs_Diff'].max())
max_m = float(moderator_df['Abs_Diff'].max())
mean_d = float(pd.concat([indirect_df, moderator_df])['Abs_Diff'].mean())
n_conv = int((robustness_df['Convergence_Status'].str.contains('همگرا')).sum())
n_tot = len(robustness_df)
size_dist = comparison_df['Effect_Size'].value_counts()

overview_df = pd.DataFrame({
    'Metric': ['K_Simulations','Method','Seed','Timestamp',
               'Indirect_Total','Indirect_Confirmed','Indirect_Confirmation_Rate',
               'Moderator_Total','Moderator_Confirmed','Moderator_Confirmation_Rate',
               'Total_Effects','Total_Confirmed','Overall_Confirmation_Rate',
               'Max_Abs_Diff_Indirect','Max_Abs_Diff_Moderator','Max_Abs_Diff_Overall',
               'Mean_Abs_Diff','Robustness_Converged','Robustness_Total',
               'Size_Big','Size_Medium','Size_Small','Size_Negligible'],
    'Value': [K_MAIN,'Percentile Bootstrap (95% CI)',42,
              datetime.now().strftime('%Y-%m-%d %H:%M'),
              len(indirect_df), n_ic, round(n_ic/len(indirect_df)*100,2),
              len(moderator_df), n_mc, round(n_mc/len(moderator_df)*100,2),
              len(indirect_df)+len(moderator_df), n_ic+n_mc,
              round((n_ic+n_mc)/(len(indirect_df)+len(moderator_df))*100,2),
              round(max_i,6), round(max_m,6), round(max(max_i,max_m),6),
              round(mean_d,6), n_conv, n_tot,
              int(size_dist.get('بزرگ',0)), int(size_dist.get('متوسط',0)),
              int(size_dist.get('کوچک',0)), int(size_dist.get('ناچیز',0))]
})

# ---------- ۱۰. Distribution Samples ----------
dist_rows = []
for name, arr in {**indirect_samples, **moderator_samples}.items():
    s = np.random.choice(arr, size=min(500,len(arr)), replace=False)
    for v in s: dist_rows.append({'Effect': name, 'Value': round(float(v),4)})
dist_df = pd.DataFrame(dist_rows)

# ---------- ۱۱. SmartPLS Comparison ----------
comp_rows = []
for _, r in comparison_df.iterrows():
    diff = abs(r['MC_Mean'] - r['SmartPLS_Beta'])
    if diff < 0.005: status = '✅ تطابق کامل'
    elif diff < 0.02: status = '✓ تطابق خوب'
    else: status = '⚠ اختلاف'
    comp_rows.append({'Hypothesis': r['Hypothesis'], 'Effect': r['Effect'],
                      'Category': r['Category'],
                      'SmartPLS_Beta': r['SmartPLS_Beta'], 'MC_Mean': r['MC_Mean'],
                      'Absolute_Difference': round(diff,6),
                      'Relative_Difference_Pct': round(diff/r['SmartPLS_Beta']*100,4) if r['SmartPLS_Beta']!=0 else 0,
                      'Agreement_Status': status})
smartpls_comparison_df = pd.DataFrame(comp_rows)

# ---------- ۱۲. نوشتن Excel ----------
print("\n⏳ نوشتن Excel...")
with pd.ExcelWriter('monte_carlo_results.xlsx', engine='openpyxl') as w:
    overview_df.to_excel(w, sheet_name='Overview', index=False)
    indirect_df.to_excel(w, sheet_name='Indirect_Effects', index=False)
    moderator_df.to_excel(w, sheet_name='Moderator_Effects', index=False)
    comparison_df.to_excel(w, sheet_name='Effect_Comparison', index=False)
    percentile_df.to_excel(w, sheet_name='Percentile_Table', index=False)
    sensitivity_df.to_excel(w, sheet_name='Sensitivity_Data', index=False)
    sensitivity_pivot.to_excel(w, sheet_name='Sensitivity_Analysis', index=False)
    robustness_df.to_excel(w, sheet_name='Robustness_Summary', index=False)
    smartpls_comparison_df.to_excel(w, sheet_name='SmartPLS_Comparison', index=False)
    dist_df.to_excel(w, sheet_name='Distribution_Samples', index=False)

# ---------- ۱۳. CSV ----------
indirect_df.to_csv("monte_carlo_indirect.csv", index=False, encoding='utf-8-sig')
moderator_df.to_csv("monte_carlo_moderator.csv", index=False, encoding='utf-8-sig')

# ---------- ۱۴. خلاصه ----------
print("\n" + "="*60)
print("📝 خلاصه مونت‌کارلو پیشرفته")
print("="*60)
print(f"K = {K_MAIN:,} شبیه‌سازی")
print(f"اثرات غیرمستقیم: {n_ic}/{len(indirect_df)} تأیید ({n_ic/len(indirect_df)*100:.0f}%)")
print(f"اثرات تعدیل‌گری: {n_mc}/{len(moderator_df)} تأیید ({n_mc/len(moderator_df)*100:.0f}%)")
print(f"بیشترین اختلاف با SmartPLS: {max(max_i,max_m):.6f}")
print(f"میانگین اختلاف مطلق: {mean_d:.6f}")
print(f"همگرایی: {n_conv}/{n_tot} همگرا")
print(f"توزیع اندازه اثر: {dict(size_dist)}")
print(f"\n✅ خروجی: monte_carlo_results.xlsx (10 شیت) + 2 CSV")
print("="*60)