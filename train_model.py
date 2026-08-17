"""
UC08 - Predictive Analytics & Risk Modeling Engine for VBC Command Center

Key capabilities:
1. Multi-Period & Benchmark Trend Forecasting:
   - Evaluates multi-period trajectory & momentum across baseline years or peer cohort distributions.
   - Computes forward-looking per-capita expenditure projection and growth trajectory.
2. Gradient Boosting Cross-Sectional Driver & Residual Risk Model:
   - High-dimensional GBDT model trained across financial, utilization, quality, and provider-mix features.
   - Computes expected savings, residuals (performance gap relative to peer risk profile), and assigns 4-tier risk categorizations.
3. What-If Intervention Simulation Engine:
   - Dynamic simulation of care-setting shifts (ED visits, SNF admissions, Outpatient, PCP touchpoints, Quality Score).
   - Projects net impact on benchmark savings rate and earned savings payout.
4. Intelligent Clinical & Operational Recommendation Engine:
   - Generates ranked, auditable, high-impact clinical and financial focus areas for executive JOC meetings.
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

BASE = os.path.dirname(os.path.abspath(__file__))
PROCESSED = os.path.join(BASE, "processed")
ACO_PERF_PATH = os.path.join(PROCESSED, "aco_performance.csv")
PANEL_PATH = os.path.join(PROCESSED, "aco_panel_multiyear.csv")


def load_dataset():
    if os.path.exists(PANEL_PATH):
        df = pd.read_csv(PANEL_PATH, low_memory=False)
    else:
        df = pd.read_csv(ACO_PERF_PATH, low_memory=False)
    return df


def compute_trend_forecast(df: pd.DataFrame) -> pd.DataFrame:
    """Computes cost trend projections. If multi-period BY1..BY3/PY columns exist,
    fits linear extrapolation; otherwise projects based on baseline benchmark to PY momentum."""
    results = []
    has_by_cols = all(f"Per_Capita_Exp_ALL_AGND_BY{i}" in df.columns for i in (1, 2, 3)) and "Per_Capita_Exp_ALL_AGND_PY" in df.columns

    for idx, row in df.iterrows():
        aco_id = row.get("ACO_ID")
        name = row.get("ACO_Name")
        curr_exp = row.get("Per_Capita_Exp_TOTAL_PY", np.nan)
        bnchmk = row.get("UpdatedBnchmk", curr_exp)

        slope = np.nan
        next_exp = np.nan
        pct_change = np.nan

        if has_by_cols:
            y_vals = [row.get(f"Per_Capita_Exp_ALL_AGND_BY{i}") for i in (1, 2, 3)] + [row.get("Per_Capita_Exp_ALL_AGND_PY")]
            y_clean = pd.to_numeric(pd.Series(y_vals), errors="coerce").values
            if not np.isnan(y_clean).any():
                x = np.array([1, 2, 3, 4])
                slope_val, intercept = np.polyfit(x, y_clean, 1)
                slope = float(slope_val)
                next_exp = float(slope_val * 5 + intercept)
                if curr_exp and curr_exp > 0:
                    pct_change = float((next_exp - curr_exp) / curr_exp * 100)

        # Fallback extrapolation if multi-year column sequence is not present
        if np.isnan(pct_change) or np.isnan(next_exp):
            # Use benchmark vs actual gap momentum + track trend factor
            gap = (curr_exp - bnchmk) / bnchmk if (bnchmk and bnchmk > 0) else 0.0
            annual_growth_rate = 0.025 + (gap * 0.15)  # industry baseline inflation + efficiency drag
            next_exp = float(curr_exp * (1 + annual_growth_rate))
            slope = float(curr_exp * annual_growth_rate)
            pct_change = float(annual_growth_rate * 100)

        direction = "Rising" if pct_change > 0.5 else ("Falling" if pct_change < -0.5 else "Stable")

        results.append({
            "ACO_ID": aco_id,
            "ACO_Name": name,
            "trend_slope_per_year": round(slope, 2) if pd.notna(slope) else 0.0,
            "current_py_expenditure": round(curr_exp, 2) if pd.notna(curr_exp) else 0.0,
            "projected_next_year_expenditure": round(next_exp, 2) if pd.notna(next_exp) else 0.0,
            "projected_pct_change": round(pct_change, 2) if pd.notna(pct_change) else 0.0,
            "trend_direction": direction,
        })

    return pd.DataFrame(results)


def train_gradient_boosting_driver_model(df: pd.DataFrame):
    """Trains Gradient Boosting Regressor on comprehensive feature matrix to determine
    expected savings, residual performance, feature importances, and risk tier."""
    feature_cols = [
        "N_AB", "Per_Capita_Exp_TOTAL_PY", "CapAnn_INP_All", "CapAnn_SNF",
        "CapAnn_OPD", "CapAnn_PB", "CapAnn_HHA", "CapAnn_HSP",
        "ADM", "P_EDV_Vis", "P_EDV_Vis_HOSP", "P_SNF_ADM", "P_EM_PCP_Vis",
        "QualScore", "N_PCP", "N_Spec", "N_NP", "N_PA", "N_Hosp", "N_CAH",
    ]
    avail_cols = [c for c in feature_cols if c in df.columns]
    target_col = "EarnSaveLoss"

    model_df = df[["ACO_ID"] + avail_cols + [target_col]].copy().dropna()

    X = model_df[avail_cols]
    y = model_df[target_col]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    gbm = GradientBoostingRegressor(n_estimators=250, max_depth=4, learning_rate=0.04, random_state=42)
    gbm.fit(X_train, y_train)

    pred_test = gbm.predict(X_test)
    mae = mean_absolute_error(y_test, pred_test)
    r2 = r2_score(y_test, pred_test)
    print(f"Gradient Boosting Holdout Evaluation: MAE = ${mae:,.0f}, R2 = {r2:.3f}")

    # Full dataset expectations
    expected = gbm.predict(X)
    model_df["model_expected_EarnSaveLoss"] = np.round(expected, 2)
    model_df["residual"] = np.round(model_df[target_col] - model_df["model_expected_EarnSaveLoss"], 2)

    # Risk tier classification
    q25 = model_df["residual"].quantile(0.25)
    q75 = model_df["residual"].quantile(0.75)

    def assign_risk(row):
        res = row["residual"]
        actual = row[target_col]
        if res < q25 and actual < 0:
            return "High Risk Underperformer"
        elif res < q25:
            return "Underperforming vs. peer profile"
        elif res > q75 and actual > 0:
            return "Top Performer / Outperformer"
        elif res > q75:
            return "Outperforming vs. peer profile"
        else:
            return "In line with peer profile"

    model_df["risk_flag"] = model_df.apply(assign_risk, axis=1)

    # Human-friendly feature labels & categories
    category_map = {
        "N_AB": "Beneficiary Scale",
        "Per_Capita_Exp_TOTAL_PY": "Overall Cost",
        "CapAnn_INP_All": "Inpatient Spend",
        "CapAnn_SNF": "SNF Spend",
        "CapAnn_OPD": "Outpatient Spend",
        "CapAnn_PB": "Physician & Supplier Spend",
        "CapAnn_HHA": "Home Health Spend",
        "CapAnn_HSP": "Hospice Spend",
        "ADM": "Inpatient Admissions",
        "P_EDV_Vis": "Emergency Dept Visits",
        "P_EDV_Vis_HOSP": "ED to Hospital Admissions",
        "P_SNF_ADM": "SNF Admissions",
        "P_EM_PCP_Vis": "Primary Care Visits",
        "QualScore": "Quality Performance",
        "N_PCP": "PCP Provider Network",
        "N_Spec": "Specialist Network",
        "N_NP": "Nurse Practitioner Staffing",
        "N_PA": "Physician Assistant Staffing",
        "N_Hosp": "Hospital Count",
        "N_CAH": "Critical Access Hospitals",
    }

    importance_df = pd.DataFrame({
        "feature": avail_cols,
        "feature_label": [category_map.get(c, c) for c in avail_cols],
        "importance": np.round(gbm.feature_importances_, 4),
    }).sort_values("importance", ascending=False)

    return model_df[["ACO_ID", "model_expected_EarnSaveLoss", "residual", "risk_flag"]], importance_df


def generate_intelligent_recommendations(df: pd.DataFrame, predictions: pd.DataFrame) -> dict:
    """Builds a rich structured clinical and financial intervention playbook for each ACO."""
    merged = df.merge(predictions, on="ACO_ID", how="left")
    rec_dict = {}

    for _, row in merged.iterrows():
        aco_id = row["ACO_ID"]
        track = row.get("Current_Track", "")
        rev_cat = row.get("Rev_Exp_Cat", "")
        n_ab = row.get("N_AB", 1) or 1

        # Peer cohort
        peers = df[(df["Current_Track"] == track) & (df["Rev_Exp_Cat"] == rev_cat)]
        if len(peers) < 5:
            peers = df

        items = []

        # 1. Financial & Contract Status
        earn_save = row.get("EarnSaveLoss", 0)
        sav_rate = row.get("Sav_rate", 0)
        if earn_save < 0:
            items.append({
                "category": "Contract Risk",
                "severity": "CRITICAL",
                "finding": f"Contract is currently incurring a shared loss of ${abs(earn_save):,.0f} (Savings Rate: {sav_rate:.2f}%).",
                "action": "Convene an emergency Joint Operating Committee (JOC) meeting to audit inpatient unit costs and post-acute discharge pathways.",
                "potential_impact_estimate": f"Mitigate up to ${abs(earn_save) * 0.5:,.0f} in downside penalty exposure."
            })

        # 2. Emergency Department & Redirection Opportunity
        ed_vis = row.get("P_EDV_Vis", 0)
        peer_ed = peers["P_EDV_Vis"].mean()
        if peer_ed > 0 and ed_vis > peer_ed * 1.08:
            gap_pct = (ed_vis - peer_ed) / peer_ed * 100
            excess_ed_visits = ((ed_vis - peer_ed) / 1000) * n_ab
            est_ed_savings = excess_ed_visits * 750  # estimated avg avoidable ED cost
            items.append({
                "category": "ED Utilization",
                "severity": "HIGH" if gap_pct > 20 else "MEDIUM",
                "finding": f"Emergency Dept visit rate ({ed_vis:.1f}/k) is {gap_pct:.1f}% above peer average ({peer_ed:.1f}/k).",
                "action": "Deploy rapid nurse triage hotlines, expand same-day urgent primary care slots, and launch high-utilizer care-management outreach.",
                "potential_impact_estimate": f"${est_ed_savings:,.0f} potential gross cost reduction."
            })

        # 3. Skilled Nursing Facility (SNF) Steerage & Post-Acute Pathway
        snf_adm = row.get("P_SNF_ADM", 0)
        peer_snf = peers["P_SNF_ADM"].mean()
        cap_snf = row.get("CapAnn_SNF", 0)
        peer_cap_snf = peers["CapAnn_SNF"].mean()
        if (peer_snf > 0 and snf_adm > peer_snf * 1.10) or (peer_cap_snf > 0 and cap_snf > peer_cap_snf * 1.10):
            gap_pct = (snf_adm - peer_snf) / peer_snf * 100 if peer_snf > 0 else 10
            est_snf_savings = (max(0, cap_snf - peer_cap_snf) * n_ab) * 0.35
            items.append({
                "category": "Post-Acute Care",
                "severity": "HIGH",
                "finding": f"SNF admission rate ({snf_adm:.1f}/k) is {gap_pct:.1f}% higher than peers with ${cap_snf:,.0f} per-capita SNF spend.",
                "action": "Implement a preferred high-performing SNF narrow network, embed post-acute transition navigators, and protocolize discharge-to-home-health alternatives.",
                "potential_impact_estimate": f"${est_snf_savings:,.0f} in avoidable post-acute expenditures."
            })

        # 4. Inpatient & Ambulatory Care Sensitive Admissions
        inp_spend = row.get("CapAnn_INP_All", 0)
        peer_inp = peers["CapAnn_INP_All"].mean()
        if peer_inp > 0 and inp_spend > peer_inp * 1.12:
            gap_pct = (inp_spend - peer_inp) / peer_inp * 100
            items.append({
                "category": "Inpatient Efficiency",
                "severity": "HIGH",
                "finding": f"Per-capita Inpatient spend (${inp_spend:,.0f}) exceeds peer average (${peer_inp:,.0f}) by {gap_pct:.1f}%.",
                "action": "Audit readmission drivers within 30 days of discharge, focus on CHF/COPD care coordination protocols, and enhance outpatient specialty comanagement.",
                "potential_impact_estimate": f"Potential savings of ${(inp_spend - peer_inp) * n_ab * 0.25:,.0f}."
            })

        # 5. Quality Performance & CAHPS Score Gaps
        qual_score = row.get("QualScore", 100)
        peer_qual = peers["QualScore"].mean()
        if qual_score < peer_qual - 2.0 or qual_score < 80:
            items.append({
                "category": "Quality & Experience",
                "severity": "MEDIUM",
                "finding": f"Quality score of {qual_score:.1f} trails peer cohort average ({peer_qual:.1f}) by {peer_qual - qual_score:.1f} points.",
                "action": "Close open clinical gaps in Diabetes HbA1c control and Colorectal Screening; target patient communication workflows to boost CAHPS domain scores.",
                "potential_impact_estimate": "Protects maximum shared savings payout tier and prevents quality gate penalties."
            })

        # 6. Primary Care Engagement & Prevention
        pcp_vis = row.get("P_EM_PCP_Vis", 0)
        peer_pcp = peers["P_EM_PCP_Vis"].mean()
        if peer_pcp > 0 and pcp_vis < peer_pcp * 0.90:
            items.append({
                "category": "Primary Care Access",
                "severity": "MEDIUM",
                "finding": f"PCP visit rate ({pcp_vis:.1f}/k) is {(peer_pcp - pcp_vis)/peer_pcp * 100:.1f}% below peer cohort.",
                "action": "Incentivize Annual Wellness Visits (AWVs), expand telehealth access for chronic disease check-ins, and assign dedicated medical assistants to recall delinquent patients.",
                "potential_impact_estimate": "Improves early detection, reducing downstream high-cost acute admissions."
            })

        # 7. Projected Forward Trend Warning
        proj_pct = row.get("projected_pct_change", 0)
        if pd.notna(proj_pct) and proj_pct > 3.5:
            items.append({
                "category": "Cost Momentum",
                "severity": "WARNING",
                "finding": f"Predictive model projects per-capita expenditure rising {proj_pct:.1f}% next cycle under current baseline momentum.",
                "action": "Initiate quarterly risk-adjustment reviews and tighten specialist referral out-of-network leakage tracking.",
                "potential_impact_estimate": "Averts projected cost escalations."
            })

        if not items:
            items.append({
                "category": "Excellence",
                "severity": "INFO",
                "finding": "Performing at or above benchmark across cost, utilization, and clinical quality measures.",
                "action": "Maintain high-touch care coordination protocols and evaluate advancing to higher two-sided risk sharing track for greater shared-savings upside.",
                "potential_impact_estimate": "Opportunity to scale attributed beneficiary panel."
            })

        rec_dict[aco_id] = items

    return rec_dict


def calculate_what_if_simulation(
    aco_row: dict,
    ed_reduction_pct: float = 0.0,
    snf_reduction_pct: float = 0.0,
    opd_reduction_pct: float = 0.0,
    pcp_increase_pct: float = 0.0,
    qual_improvement_pts: float = 0.0,
) -> dict:
    """Simulates the financial impact of clinical and operational interventions."""
    n_ab = float(aco_row.get("N_AB", 10000)) or 10000
    curr_exp = float(aco_row.get("Per_Capita_Exp_TOTAL_PY", 12000))
    bnchmk = float(aco_row.get("UpdatedBnchmk", curr_exp * 1.05))
    curr_earned = float(aco_row.get("EarnSaveLoss", 0))
    curr_qual = float(aco_row.get("QualScore", 85.0))

    cap_inp = float(aco_row.get("CapAnn_INP_All", curr_exp * 0.35))
    cap_snf = float(aco_row.get("CapAnn_SNF", curr_exp * 0.12))
    cap_opd = float(aco_row.get("CapAnn_OPD", curr_exp * 0.22))
    cap_pb = float(aco_row.get("CapAnn_PB", curr_exp * 0.25))

    # Calculate per-capita savings from operational adjustments
    snf_savings_pc = cap_snf * (snf_reduction_pct / 100.0)
    ed_opd_savings_pc = (cap_opd * 0.40) * (ed_reduction_pct / 100.0) + (cap_opd * 0.60) * (opd_reduction_pct / 100.0)
    inp_avoidance_pc = cap_inp * (ed_reduction_pct / 100.0 * 0.25)  # Avoided ED visits prevent some avoidable admissions
    pcp_investment_pc = (cap_pb * 0.30) * (pcp_increase_pct / 100.0)  # Primary care visit cost investment

    total_pc_net_savings = snf_savings_pc + ed_opd_savings_pc + inp_avoidance_pc - pcp_investment_pc
    sim_exp = max(1000.0, curr_exp - total_pc_net_savings)
    sim_qual = min(100.0, curr_qual + qual_improvement_pts)

    # Recompute Benchmark Savings Rate
    gen_savings_loss_total = (bnchmk - sim_exp) * n_ab
    sim_savings_rate = ((bnchmk - sim_exp) / bnchmk) * 100.0 if bnchmk > 0 else 0.0

    # Sharing rate formula approximation based on Track and Quality Score
    sharing_rate = (sim_qual / 100.0) * 0.50  # standard 50% max share scaled by quality
    if sim_savings_rate > 2.0:  # Minimum Savings Rate threshold
        sim_earned_savings = gen_savings_loss_total * sharing_rate
    elif sim_savings_rate < -2.0:
        sim_earned_savings = gen_savings_loss_total * 0.30  # downside loss share
    else:
        sim_earned_savings = 0.0

    net_dollar_improvement = sim_earned_savings - curr_earned

    return {
        "original_per_capita_exp": round(curr_exp, 2),
        "simulated_per_capita_exp": round(sim_exp, 2),
        "per_capita_savings": round(total_pc_net_savings, 2),
        "total_gross_savings": round(total_pc_net_savings * n_ab, 2),
        "original_savings_rate": round(aco_row.get("Sav_rate", 0), 2),
        "simulated_savings_rate": round(sim_savings_rate, 2),
        "original_earned_savings": round(curr_earned, 2),
        "simulated_earned_savings": round(sim_earned_savings, 2),
        "net_dollar_gain": round(net_dollar_improvement, 2),
        "simulated_quality_score": round(sim_qual, 1),
    }


def main():
    print("Executing VBC Predictive Analytics & Risk Modeling Pipeline...")
    df = load_dataset()
    print(f"Dataset loaded: {len(df)} ACO records.")

    # 1. Cost Trend Projections
    print("Computing multi-period cost trend projections...")
    trend_df = compute_trend_forecast(df)

    # 2. Gradient Boosting Risk & Driver Model
    print("Training Gradient Boosting Risk Driver Model...")
    driver_df, importance_df = train_gradient_boosting_driver_model(df)

    # 3. Merge predictions
    predictions = trend_df.merge(driver_df, on="ACO_ID", how="left")

    pred_out_path = os.path.join(PROCESSED, "aco_predictions.csv")
    predictions.to_csv(pred_out_path, index=False)
    print(f"Saved: {pred_out_path}")

    # Save feature importances
    imp_out_path = os.path.join(PROCESSED, "model_feature_importance.csv")
    importance_df.to_csv(imp_out_path, index=False)
    print(f"Saved: {imp_out_path}")

    # 4. Generate Structured AI Recommendations
    print("Generating Intelligent Clinical & Operational Interventions...")
    recommendations = generate_intelligent_recommendations(df, predictions)
    rec_out_path = os.path.join(PROCESSED, "aco_recommendations.json")
    with open(rec_out_path, "w", encoding="utf-8") as f:
        json.dump(recommendations, f, indent=2)
    print(f"Saved: {rec_out_path} ({len(recommendations)} ACOs profiled)")

    print("Predictive Analytics Engine update completed successfully.")


if __name__ == "__main__":
    main()
