# ============================================
# جنگل علّی + SHAP + آزمون کالیبراسیون + خروجی Excel
# فایل داده: educational_data.sav
# نسخهٔ نهایی: اصلاح آزمون کالیبراسیون + Simple Slopes + سخت‌سازی SHAP
# ============================================
import pandas as pd
import pyreadstat
import numpy as np
import warnings
warnings.filterwarnings('ignore')

from econml.dml import CausalForestDML
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import KFold
from scipy.stats import pearsonr, spearmanr, f as f_dist, t as t_dist

# ---------- ۱. خواندن فایل sav ----------
FILE_PATH = "educational_data.sav"
df, meta = pyreadstat.read_sav(FILE_PATH)
print("="*60)
print("✅ فایل خوانده شد. تعداد نمونه‌ها:", len(df))

# ---------- ۲. ساخت امتیاز سازه‌ها ----------
df['PR_score']  = df[[f'Q{i}' for i in range(1, 12)]].mean(axis=1)
df['DT_score']  = df[[f'Q{i}' for i in range(12, 21)]].mean(axis=1)
df['SUS_score'] = df[[f'Q{i}' for i in range(21, 31)]].mean(axis=1)
df['HG_score']  = df[[f'Q{i}' for i in range(31, 47)]].mean(axis=1)

# ---------- ۳. تعریف X، W، Y ----------
median_dt = df['DT_score'].median()
df['W'] = (df['DT_score'] > median_dt).astype(int)
X_cols = ['HG_score', 'PR_score']
X = df[X_cols].values
Y = df['SUS_score'].values
W = df['W'].values

# ---------- ۴. برازش جنگل علّی ----------
print("\n⏳ در حال برازش جنگل علّی...")
cf = CausalForestDML(
    model_y=RandomForestRegressor(n_estimators=200, min_samples_leaf=10, random_state=42, n_jobs=-1),
    model_t=RandomForestClassifier(n_estimators=200, min_samples_leaf=10, random_state=42, n_jobs=-1),
    n_estimators=1000, min_samples_leaf=20,
    discrete_treatment=True, random_state=42
)
cf.fit(Y, W, X=X)
print("✅ برازش کامل شد.")

# ---------- ۵. CATE ----------
cate = cf.effect(X)
df['CATE'] = cate

# ---------- ۶. اهمیت و همبستگی ----------
importance = dict(zip(X_cols, cf.feature_importances_))
corr_results = []
for var in X_cols:
    r_p, p_p = pearsonr(df[var].values, cate)
    r_s, p_s = spearmanr(df[var].values, cate)
    corr_results.append({
        'Variable': var, 'Pearson_r': round(r_p, 4), 'Pearson_p': f"{p_p:.4e}",
        'Spearman_rho': round(r_s, 4), 'Spearman_p': f"{p_s:.4e}"
    })

# ---------- ۷. چارک‌های HG ----------
hg_bins = pd.qcut(df['HG_score'], 4, retbins=True)[1]
df['HG_Quartile'] = pd.qcut(df['HG_score'], 4, labels=['HG-Q1','HG-Q2','HG-Q3','HG-Q4'])
group_hg = df.groupby('HG_Quartile', observed=True).agg(
    Mean_HG=('HG_score','mean'), Mean_CATE=('CATE','mean'),
    SD_CATE=('CATE','std'), N=('CATE','count')
).reset_index()
group_hg['HG_Quartile'] = group_hg['HG_Quartile'].astype(str)

# ---------- ۸. چارک‌های CATE ----------
df['CATE_Quartile'] = pd.qcut(cate, 4, labels=['Q1','Q2','Q3','Q4'])
group_cate = df.groupby('CATE_Quartile', observed=True).agg(
    Mean_CATE=('CATE','mean'), N=('CATE','count')
).reset_index()
group_cate['CATE_Quartile'] = group_cate['CATE_Quartile'].astype(str)

# ---------- ۹. BLP ----------
blp = LinearRegression().fit(X, cate)
blp_r2 = float(blp.score(X, cate))
blp_df = pd.DataFrame({
    'Term': X_cols + ['Intercept','R_squared'],
    'Coefficient': list(blp.coef_) + [blp.intercept_, blp_r2]
})

# ---------- ۹.۵. آزمون کالیبراسیون (اصلاح‌شده، بدون econml) ----------
print("\n⏳ انجام آزمون کالیبراسیون...")
calibration_pval = None
calib_status = "N/A"
calibration_detail = {
    'BLP_F_stat': None, 'BLP_F_pval': None, 'BLP_R2': round(blp_r2, 4),
    'OOS_Slope': None, 'OOS_Intercept': None, 'OOS_Slope_pval': None,
    'OOS_R2': None, 'Calibration_Verdict': 'N/A'
}
try:
    n, p = X.shape
    # (الف) F-test روی BLP: H0 = R² = 0 (ناهمگونی توسط HG و PR توضیح داده نمی‌شود)
    cate_pred_in = blp.predict(X)
    ss_res = float(np.sum((cate - cate_pred_in) ** 2))
    ss_tot = float(np.sum((cate - cate.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
    if (1 - r2) > 1e-12:
        f_stat = (r2 / p) / ((1 - r2) / max(n - p - 1, 1))
    else:
        f_stat = float('inf')
    f_pval = float(1 - f_dist.cdf(f_stat, p, n - p - 1)) if np.isfinite(f_stat) else 0.0

    # (ب) کالیبراسیون out-of-sample با K-Fold
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    oos_pred = np.zeros_like(cate)
    for train_idx, test_idx in kf.split(X):
        blp_cv = LinearRegression().fit(X[train_idx], cate[train_idx])
        oos_pred[test_idx] = blp_cv.predict(X[test_idx])
    cal_reg = LinearRegression().fit(oos_pred.reshape(-1, 1), cate)
    cal_slope = float(cal_reg.coef_[0])
    cal_intercept = float(cal_reg.intercept_)
    resid = cate - cal_reg.predict(oos_pred.reshape(-1, 1))
    denom = float(np.sum((oos_pred - oos_pred.mean()) ** 2))
    if denom > 1e-12 and n > 2:
        se_slope = float(np.sqrt(np.sum(resid**2) / (n - 2) / denom))
        t_slope = (cal_slope - 1) / se_slope if se_slope > 1e-12 else 0.0
        slope_pval = float(2 * (1 - t_dist.cdf(abs(t_slope), n - 2)))
    else:
        slope_pval = float('nan')
    oos_r2 = float(1 - np.sum(resid**2) / ss_tot) if ss_tot > 0 else 0.0

    # تصمیم نهایی (F-test معیار اصلی)
    calibration_pval = f_pval
    if f_pval < 0.05 and abs(cal_slope - 1) < 0.3:
        calib_status = "✅ کالیبره (ناهمگونی واقعی)"
    elif f_pval < 0.05:
        calib_status = "⚠ معنادار اما کالیبراسیون ضعیف"
    else:
        calib_status = "❌ ناهمگونی معنادار نیست"

    calibration_detail = {
        'BLP_F_stat': round(f_stat, 4) if np.isfinite(f_stat) else 'inf',
        'BLP_F_pval': f_pval if f_pval >= 1e-6 else float(f"{f_pval:.3e}"),
        'BLP_R2': round(r2, 4),
        'OOS_Slope': round(cal_slope, 4),
        'OOS_Intercept': round(cal_intercept, 4),
        'OOS_Slope_pval': round(slope_pval, 6) if not np.isnan(slope_pval) else 'N/A',
        'OOS_R2': round(oos_r2, 4),
        'Calibration_Verdict': calib_status
    }
    print(f"✅ F-test: F={f_stat:.3f}, p={f_pval:.6e}, OOS slope={cal_slope:.3f}")
except Exception as e:
    calibration_pval = None
    calib_status = f"خطا: {e}"
    print(f"⚠ خطا در آزمون کالیبراسیون: {e}")

# ---------- ۹.۶. تحلیل شیب ساده (Simple Slopes) — نسخهٔ کامل با SE، T، P ----------
# برای H4c/H6c: اثر DT بر SUS در سطوح مختلف HG (با PR ثابت روی میانگین)
print("\n⏳ محاسبه تحلیل شیب ساده (Simple Slopes)...")
simple_slopes = []
try:
    hg_mean = float(df['HG_score'].mean())
    hg_sd = float(df['HG_score'].std())
    pr_mean = float(df['PR_score'].mean())
    levels = [('کم (-1SD)', hg_mean - hg_sd),
              ('متوسط (Mean)', hg_mean),
              ('زیاد (+1SD)', hg_mean + hg_sd)]
    for level_name, hg_val in levels:
        X_new = np.array([[hg_val, pr_mean]], dtype=float)
        eff = se = t_stat = pval = ci_lo = ci_hi = float('nan')

        # ---- ۱. برآورد اثر ----
        try:
            eff = float(cf.effect(X_new)[0])
        except Exception as e:
            print(f"   ⚠ effect() در سطح {level_name}: {e}")

        # ---- ۲. روش اول: effect_inference (دقیق‌ترین، econml >= 0.14) ----
        try:
            inf = cf.effect_inference(X_new)
            sf = inf.summary_frame(alpha=0.05)
            se    = float(sf['std_err'].iloc[0])
            ci_lo = float(sf['ci_lower'].iloc[0])
            ci_hi = float(sf['ci_upper'].iloc[0])
            pval  = float(sf['pvalue'].iloc[0])
            t_stat = eff / se if se > 1e-9 else float('nan')
        except Exception:
            # ---- ۳. روش دوم: effect_interval + استخراج تقریبی SE ----
            try:
                lo, hi = cf.effect_interval(X_new, alpha=0.05)
                ci_lo = float(lo[0]); ci_hi = float(hi[0])
                # SE ≈ (CI_upper − CI_lower) / (2 × 1.96)
                if not (np.isnan(ci_lo) or np.isnan(ci_hi)):
                    se = (ci_hi - ci_lo) / (2 * 1.96)
                    t_stat = eff / se if se > 1e-9 else float('nan')
                    if not np.isnan(t_stat):
                        pval = float(2 * (1 - t_dist.cdf(abs(t_stat), df=len(X) - 2)))
            except Exception as e:
                print(f"   ⚠ effect_interval() در سطح {level_name}: {e}")

        # ---- ۴. تصمیم معناداری ----
        if not (np.isnan(ci_lo) or np.isnan(ci_hi)):
            significant = 'بله' if (ci_lo > 0 or ci_hi < 0) else 'خیر'
        elif not np.isnan(pval):
            significant = 'بله' if pval < 0.05 else 'خیر'
        else:
            significant = 'N/A'

        simple_slopes.append({
            'Moderator': 'HG',
            'Level': level_name,
            'HG_Value': round(hg_val, 4),
            'DT_Effect_on_SUS': round(eff, 4) if not np.isnan(eff) else 'N/A',
            'SE': round(se, 4) if not np.isnan(se) else 'N/A',
            'T_Value': round(t_stat, 3) if not np.isnan(t_stat) else 'N/A',
            'P_Value': round(pval, 6) if not np.isnan(pval) else 'N/A',
            'CI_Lower': round(ci_lo, 4) if not np.isnan(ci_lo) else 'N/A',
            'CI_Upper': round(ci_hi, 4) if not np.isnan(ci_hi) else 'N/A',
            'Significant': significant
        })
    print(f"✅ Simple Slopes محاسبه شد ({len(simple_slopes)} سطح)")
except Exception as e:
    print(f"⚠ خطا در Simple Slopes: {e}")

simple_slopes_df = pd.DataFrame(simple_slopes) if simple_slopes else pd.DataFrame(
    columns=['Moderator','Level','HG_Value','DT_Effect_on_SUS','SE','T_Value','P_Value','CI_Lower','CI_Upper','Significant']
)

# ---------- ۱۰. SHAP — با سخت‌سازی (پچ A) ----------
print("\n⏳ محاسبه SHAP...")
try:
    import shap
    np.random.seed(42)
    n_shap = min(100, len(X))
    idx_shap = np.random.choice(len(X), size=n_shap, replace=False)
    X_shap = X[idx_shap]
    n_bg = min(50, len(X))
    idx_bg = np.random.choice(len(X), size=n_bg, replace=False)
    X_background = X[idx_bg]

    # 🔧 سخت‌سازی: شکل X را قبل از پاس دادن به econml اجباری می‌کنیم
    n_features = len(X_cols)
    explainer = shap.KernelExplainer(
        lambda x: cf.effect(np.asarray(x, dtype=float).reshape(-1, n_features)),
        X_background,
        silent=True
    )
    shap_values = explainer.shap_values(X_shap, nsamples=100, silent=True)
    if isinstance(shap_values, list):
        shap_values = shap_values[0]
    base_val = explainer.expected_value
    if isinstance(base_val, list):
        base_val = base_val[0]

    shap_long = []
    for i, idx in enumerate(idx_shap):
        for j, feat in enumerate(X_cols):
            shap_long.append({
                'Sample_Idx': int(idx), 'Feature': feat,
                'Feature_Value': float(X[idx, j]), 'SHAP_Value': float(shap_values[i, j]),
                'Base_Value': float(base_val), 'CATE': float(cate[idx]),
            })
    shap_df = pd.DataFrame(shap_long)
    shap_importance_df = pd.DataFrame({
        'Feature': X_cols,
        'Mean_Abs_SHAP': [float(np.abs(shap_values[:, j]).mean()) for j in range(len(X_cols))]
    }).sort_values('Mean_Abs_SHAP', ascending=False).reset_index(drop=True)
    HAS_SHAP = True
    print("✅ SHAP محاسبه شد.")
except Exception as e:
    HAS_SHAP = False
    shap_df = shap_importance_df = pd.DataFrame()
    print(f"⚠ خطای SHAP: {e}")

# ---------- ۱۱. Overview ----------
cal_pval_for_overview = 'N/A'
if calibration_pval is not None:
    try:
        cal_pval_for_overview = float(calibration_pval)
    except Exception:
        cal_pval_for_overview = 'N/A'

overview_df = pd.DataFrame({
    'Metric': ['N_Samples','Mean_CATE','Median_CATE','SD_CATE','Min_CATE','Max_CATE',
               'Importance_HG','Importance_PR','HG_Q1_Mean_CATE','HG_Q4_Mean_CATE',
               'HG_Q4_Q1_Ratio','BLP_R2','HG_CATE_Pearson_r','PR_CATE_Pearson_r',
               'HG_Bin_Q1_Upper','HG_Bin_Q2_Upper','HG_Bin_Q3_Upper','HG_Bin_Q4_Upper',
               'SHAP_Available','SHAP_Importance_HG','SHAP_Importance_PR',
               'Calibration_Test_Pval', 'Calibration_Status'],
    'Value': [len(df), round(float(cate.mean()),4), round(float(np.median(cate)),4),
              round(float(cate.std()),4), round(float(cate.min()),4), round(float(cate.max()),4),
              round(importance['HG_score'],4), round(importance['PR_score'],4),
              round(float(group_hg.loc[0,'Mean_CATE']),4), round(float(group_hg.loc[3,'Mean_CATE']),4),
              round(float(group_hg.loc[3,'Mean_CATE'])/float(group_hg.loc[0,'Mean_CATE']),4),
              round(blp_r2,4),
              round(corr_results[0]['Pearson_r'],4), round(corr_results[1]['Pearson_r'],4),
              round(float(hg_bins[1]),4), round(float(hg_bins[2]),4),
              round(float(hg_bins[3]),4), round(float(hg_bins[4]),4),
              int(HAS_SHAP),
              round(float(shap_importance_df.loc[shap_importance_df['Feature']=='HG_score','Mean_Abs_SHAP'].iloc[0]),4) if HAS_SHAP and len(shap_importance_df)>0 else 0,
              round(float(shap_importance_df.loc[shap_importance_df['Feature']=='PR_score','Mean_Abs_SHAP'].iloc[0]),4) if HAS_SHAP and len(shap_importance_df)>0 else 0,
              cal_pval_for_overview,
              calib_status]
})

# ---------- ۱۲. سایر دیتافریم‌ها ----------
cate_dist_df = df[['CATE']].reset_index().rename(columns={'index':'Index'})
full_data_df = df[['CATE','HG_score','PR_score','W','SUS_score','HG_Quartile','CATE_Quartile']].reset_index(drop=True)
feat_imp_df = pd.DataFrame([{'Variable':k,'Importance':round(float(v),4)} for k,v in importance.items()])

# ---------- ۱۳. نوشتن Excel ----------
print("\n⏳ نوشتن Excel...")
with pd.ExcelWriter('causal_forest_results.xlsx', engine='openpyxl') as w:
    overview_df.to_excel(w, sheet_name='Overview', index=False)
    cate_dist_df.to_excel(w, sheet_name='CATE_Distribution', index=False)
    group_hg.to_excel(w, sheet_name='HG_Quartiles', index=False)
    group_cate.to_excel(w, sheet_name='CATE_Quartiles', index=False)
    feat_imp_df.to_excel(w, sheet_name='Feature_Importance', index=False)
    pd.DataFrame(corr_results).to_excel(w, sheet_name='Correlation', index=False)
    blp_df.to_excel(w, sheet_name='BLP', index=False)
    full_data_df.to_excel(w, sheet_name='Full_Data', index=False)
    # شیت‌های جدید:
    pd.DataFrame([calibration_detail]).to_excel(w, sheet_name='Calibration_Test', index=False)
    simple_slopes_df.to_excel(w, sheet_name='Simple_Slopes', index=False)
    if HAS_SHAP and len(shap_df) > 0:
        shap_df.to_excel(w, sheet_name='SHAP_Values', index=False)
        shap_importance_df.to_excel(w, sheet_name='SHAP_Importance', index=False)

# ---------- ۱۴. CSV ----------
df[['CATE'] + X_cols + ['W','SUS_score']].to_csv("cate_results.csv", index=False, encoding='utf-8-sig')

# ---------- ۱۵. خلاصهٔ نهایی ----------
print("\n" + "="*60)
print("📊 خلاصهٔ نتایج:")
print(f"  • N = {len(df)}")
print(f"  • CATE میانگین = {float(cate.mean()):.4f} (SD = {float(cate.std()):.4f})")
print(f"  • BLP R² = {blp_r2:.4f}")
if calibration_pval is not None:
    print(f"  • F-test p-value = {float(calibration_pval):.6e}")
print(f"  • وضعیت کالیبراسیون: {calib_status}")
print(f"  • Simple Slopes: {len(simple_slopes)} سطح")
print("="*60)
print("✅ خروجی‌ها ذخیره شدند: causal_forest_results.xlsx + cate_results.csv")
print("="*60)
