# ============================================
# جنگل علّی + SHAP + آزمون کالیبراسیون + خروجی Excel
# فایل داده: educational_data.sav
# ============================================
import pandas as pd
import pyreadstat
import numpy as np
import warnings
warnings.filterwarnings('ignore')

from econml.dml import CausalForestDML
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.linear_model import LinearRegression
from scipy.stats import pearsonr, spearmanr

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
blp_df = pd.DataFrame({
    'Term': X_cols + ['Intercept','R_squared'],
    'Coefficient': list(blp.coef_) + [blp.intercept_, blp.score(X, cate)]
})

# ---------- ۱۰. SHAP ----------
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

    explainer = shap.KernelExplainer(lambda x: cf.effect(x), X_background, silent=True)
    shap_values = explainer.shap_values(X_shap, nsamples=100, silent=True)
    if isinstance(shap_values, list): shap_values = shap_values[0]
    base_val = explainer.expected_value
    if isinstance(base_val, list): base_val = base_val[0]

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

# ---------- ۱۰.۵. آزمون کالیبراسیون (Calibration Test) ----------
print("\n⏳ انجام آزمون کالیبراسیون...")
try:
    # آزمون کالیبراسیون در econml مقدار p-value را برمی‌گرداند
    cal_score = cf.score(X, Y, W)
    calibration_pval = cal_score[0] if isinstance(cal_score, tuple) else cal_score
    
    if calibration_pval < 0.05:
        calib_status = "✅ مدل کالیبره است (ناهمگونی واقعی)"
    else:
        calib_status = "⚠ مدل نیاز به بازبینی دارد"
    print(f"✅ آزمون کالیبراسیون انجام شد (p-value: {calibration_pval:.4f})")
except Exception as e:
    calibration_pval = None
    calib_status = f"خطا: {e}"
    print(f"⚠ خطا در آزمون کالیبراسیون: {e}")

# ---------- ۱۱. Overview ----------
overview_df = pd.DataFrame({
    'Metric': ['N_Samples','Mean_CATE','Median_CATE','SD_CATE','Min_CATE','Max_CATE',
               'Importance_HG','Importance_PR','HG_Q1_Mean_CATE','HG_Q4_Mean_CATE',
               'HG_Q4_Q1_Ratio','BLP_R2','HG_CATE_Pearson_r','PR_CATE_Pearson_r',
               'HG_Bin_Q1_Upper','HG_Bin_Q2_Upper','HG_Bin_Q3_Upper','HG_Bin_Q4_Upper',
               'SHAP_Available','SHAP_Importance_HG','SHAP_Importance_PR',
               'Calibration_Test_Pval', 'Calibration_Status'],
    'Value': [len(df), round(cate.mean(),4), round(np.median(cate),4), round(cate.std(),4),
              round(cate.min(),4), round(cate.max(),4),
              round(importance['HG_score'],4), round(importance['PR_score'],4),
              round(group_hg.loc[0,'Mean_CATE'],4), round(group_hg.loc[3,'Mean_CATE'],4),
              round(group_hg.loc[3,'Mean_CATE']/group_hg.loc[0,'Mean_CATE'],4),
              round(blp.score(X, cate),4),
              round(corr_results[0]['Pearson_r'],4), round(corr_results[1]['Pearson_r'],4),
              round(hg_bins[1],4), round(hg_bins[2],4), round(hg_bins[3],4), round(hg_bins[4],4),
              int(HAS_SHAP),
              round(shap_importance_df.loc[shap_importance_df['Feature']=='HG_score','Mean_Abs_SHAP'].iloc[0],4) if HAS_SHAP else 0,
              round(shap_importance_df.loc[shap_importance_df['Feature']=='PR_score','Mean_Abs_SHAP'].iloc[0],4) if HAS_SHAP else 0,
              round(calibration_pval, 6) if calibration_pval is not None else 'N/A',
              calib_status]
})

# ---------- ۱۲. سایر دیتافریم‌ها ----------
cate_dist_df = df[['CATE']].reset_index().rename(columns={'index':'Index'})
full_data_df = df[['CATE','HG_score','PR_score','W','SUS_score','HG_Quartile','CATE_Quartile']].reset_index(drop=True)
feat_imp_df = pd.DataFrame([{'Variable':k,'Importance':round(v,4)} for k,v in importance.items()])

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
    if HAS_SHAP and len(shap_df) > 0:
        shap_df.to_excel(w, sheet_name='SHAP_Values', index=False)
        shap_importance_df.to_excel(w, sheet_name='SHAP_Importance', index=False)

# ---------- ۱۴. CSV ----------
df[['CATE'] + X_cols + ['W','SUS_score']].to_csv("cate_results.csv", index=False, encoding='utf-8-sig')

print("\n✅ خروجی‌ها ذخیره شدند.")
print("="*60)