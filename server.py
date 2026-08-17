"""
FastAPI Analytics Backend for Value-Based Care (VBC) Command Center
"""

import os
import json
import sqlite3
import numpy as np
import pandas as pd
from typing import Optional, List
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROCESSED_DIR = os.path.join(BASE_DIR, "processed")
DB_PATH = os.path.join(PROCESSED_DIR, "vbc_cache.db")

app = FastAPI(
    title="VBC Contract Performance Analytics API",
    description="High-performance analytical engine for CMS MSSP ACO performance, predictive risk modeling, and provider benchmarks.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# In-Memory Cache for Core ACO Performance & Predictive Datasets
# -----------------------------------------------------------------------------
aco_df: pd.DataFrame = None
pred_df: pd.DataFrame = None
importance_df: pd.DataFrame = None
recommendations_data: dict = {}


def get_db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def load_datasets():
    global aco_df, pred_df, importance_df, recommendations_data
    
    perf_path = os.path.join(PROCESSED_DIR, "aco_performance.csv")
    if os.path.exists(perf_path):
        aco_df = pd.read_csv(perf_path, low_memory=False)
        # Ensure numerical types
        num_cols = [
            "N_AB", "BnchmkMinExp", "GenSaveLoss", "EarnSaveLoss", "Sav_rate",
            "UpdatedBnchmk", "Per_Capita_Exp_TOTAL_PY", "CapAnn_INP_All", "CapAnn_SNF",
            "CapAnn_OPD", "CapAnn_PB", "CapAnn_HHA", "CapAnn_HSP", "ADM",
            "P_EDV_Vis", "P_EDV_Vis_HOSP", "P_SNF_ADM", "P_EM_PCP_Vis", "QualScore",
            "N_PCP", "N_Spec", "N_NP", "N_PA", "N_Hosp", "N_CAH"
        ]
        for col in num_cols:
            if col in aco_df.columns:
                aco_df[col] = pd.to_numeric(aco_df[col], errors="coerce").fillna(0)

    pred_path = os.path.join(PROCESSED_DIR, "aco_predictions.csv")
    if os.path.exists(pred_path):
        pred_df = pd.read_csv(pred_path, low_memory=False)

    imp_path = os.path.join(PROCESSED_DIR, "model_feature_importance.csv")
    if os.path.exists(imp_path):
        importance_df = pd.read_csv(imp_path, low_memory=False)

    rec_path = os.path.join(PROCESSED_DIR, "aco_recommendations.json")
    if os.path.exists(rec_path):
        with open(rec_path, "r", encoding="utf-8") as f:
            recommendations_data = json.load(f)


@app.on_event("startup")
def startup_event():
    load_datasets()

# Initialize immediately on module import
load_datasets()


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class SimulationRequest(BaseModel):
    aco_id: str
    ed_reduction_pct: float = 0.0
    snf_reduction_pct: float = 0.0
    opd_reduction_pct: float = 0.0
    pcp_increase_pct: float = 0.0
    qual_improvement_pts: float = 0.0


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "aco_records": len(aco_df) if aco_df is not None else 0,
        "predictions_loaded": pred_df is not None,
        "sqlite_db_ready": os.path.exists(DB_PATH)
    }


@app.get("/api/overview")
def get_overview_kpis():
    if aco_df is None:
        raise HTTPException(status_code=500, detail="ACO performance data not loaded")

    total_acos = len(aco_df)
    total_benes = int(aco_df["N_AB"].sum())
    earned_savings = float(aco_df.loc[aco_df["EarnSaveLoss"] > 0, "EarnSaveLoss"].sum())
    total_losses = float(abs(aco_df.loc[aco_df["EarnSaveLoss"] < 0, "EarnSaveLoss"].sum()))
    net_savings = float(aco_df["EarnSaveLoss"].sum())
    avg_savings_rate = float(aco_df["Sav_rate"].mean())
    avg_quality = float(aco_df["QualScore"].mean())
    avg_per_capita_exp = float(aco_df["Per_Capita_Exp_TOTAL_PY"].mean())
    avg_benchmark = float(aco_df["UpdatedBnchmk"].mean())

    # Status distribution
    status_counts = aco_df["Savings_Status"].value_counts().to_dict()

    # Track breakdown
    track_summary = []
    for track, grp in aco_df.groupby("Current_Track"):
        track_summary.append({
            "track": track,
            "count": len(grp),
            "total_benes": int(grp["N_AB"].sum()),
            "total_earned": float(grp.loc[grp["EarnSaveLoss"] > 0, "EarnSaveLoss"].sum()),
            "total_losses": float(abs(grp.loc[grp["EarnSaveLoss"] < 0, "EarnSaveLoss"].sum())),
            "avg_savings_rate": float(grp["Sav_rate"].mean()),
            "avg_quality": float(grp["QualScore"].mean())
        })

    # Revenue Category breakdown
    rev_summary = []
    for rev, grp in aco_df.groupby("Rev_Exp_Cat"):
        rev_summary.append({
            "category": rev,
            "count": len(grp),
            "avg_savings_rate": float(grp["Sav_rate"].mean()),
            "total_earned": float(grp.loc[grp["EarnSaveLoss"] > 0, "EarnSaveLoss"].sum()),
            "avg_quality": float(grp["QualScore"].mean())
        })

    # Predictive risk flags summary
    risk_summary = {}
    if pred_df is not None and "risk_flag" in pred_df.columns:
        risk_summary = pred_df["risk_flag"].value_counts().to_dict()

    return {
        "kpis": {
            "total_acos": total_acos,
            "total_beneficiaries": total_benes,
            "total_earned_savings": earned_savings,
            "total_losses": total_losses,
            "net_savings": net_savings,
            "avg_savings_rate": round(avg_savings_rate, 2),
            "avg_quality_score": round(avg_quality, 1),
            "avg_per_capita_exp": round(avg_per_capita_exp, 2),
            "avg_benchmark": round(avg_benchmark, 2)
        },
        "status_distribution": status_counts,
        "track_breakdown": track_summary,
        "revenue_breakdown": rev_summary,
        "risk_distribution": risk_summary
    }


@app.get("/api/acos")
def get_acos(
    track: Optional[str] = None,
    rev_cat: Optional[str] = None,
    status: Optional[str] = None,
    risk_flag: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "EarnSaveLoss",
    sort_desc: bool = True,
    page: int = 1,
    page_size: int = 50
):
    if aco_df is None:
        raise HTTPException(status_code=500, detail="ACO performance data not loaded")

    df = aco_df.copy()

    # Join predictions if available
    if pred_df is not None:
        pred_sub = pred_df[["ACO_ID", "projected_pct_change", "trend_direction", "residual", "risk_flag"]]
        df = df.merge(pred_sub, on="ACO_ID", how="left")

    # Filters
    if track and track != "All":
        df = df[df["Current_Track"] == track]
    if rev_cat and rev_cat != "All":
        df = df[df["Rev_Exp_Cat"] == rev_cat]
    if status and status != "All":
        df = df[df["Savings_Status"] == status]
    if risk_flag and risk_flag != "All" and "risk_flag" in df.columns:
        df = df[df["risk_flag"] == risk_flag]
    if search:
        s = search.strip().lower()
        df = df[df["ACO_Name"].str.lower().str.contains(s, na=False) | df["ACO_ID"].str.lower().str.contains(s, na=False)]

    total_matching = len(df)

    # Sorting
    if sort_by in df.columns:
        df = df.sort_values(by=sort_by, ascending=not sort_desc)

    # Pagination
    start = (page - 1) * page_size
    end = start + page_size
    paginated_df = df.iloc[start:end]

    cols_to_return = [
        "ACO_ID", "ACO_Name", "Current_Track", "Rev_Exp_Cat", "N_AB",
        "Sav_rate", "EarnSaveLoss", "GenSaveLoss", "UpdatedBnchmk",
        "Per_Capita_Exp_TOTAL_PY", "QualScore", "Savings_Status", "Met_Quality_Gate"
    ]
    if "risk_flag" in paginated_df.columns:
        cols_to_return += ["risk_flag", "projected_pct_change", "trend_direction", "residual"]

    records = paginated_df[[c for c in cols_to_return if c in paginated_df.columns]].to_dict(orient="records")

    return {
        "total": total_matching,
        "page": page,
        "page_size": page_size,
        "acos": records
    }


@app.get("/api/acos/{aco_id}")
def get_aco_detail(aco_id: str):
    if aco_df is None:
        raise HTTPException(status_code=500, detail="ACO performance data not loaded")

    matches = aco_df[aco_df["ACO_ID"] == aco_id]
    if matches.empty:
        raise HTTPException(status_code=404, detail=f"ACO with ID {aco_id} not found")

    row = matches.iloc[0].to_dict()

    # Predictions & Risk
    pred_data = {}
    if pred_df is not None:
        p_matches = pred_df[pred_df["ACO_ID"] == aco_id]
        if not p_matches.empty:
            pred_data = p_matches.iloc[0].to_dict()

    # Peer benchmarks (same track & revenue category)
    track = row.get("Current_Track")
    rev_cat = row.get("Rev_Exp_Cat")
    peers = aco_df[(aco_df["Current_Track"] == track) & (aco_df["Rev_Exp_Cat"] == rev_cat)]
    if len(peers) < 5:
        peers = aco_df

    peer_stats = {
        "peer_count": len(peers),
        "peer_avg_savings_rate": round(float(peers["Sav_rate"].mean()), 2),
        "peer_avg_per_capita_exp": round(float(peers["Per_Capita_Exp_TOTAL_PY"].mean()), 2),
        "peer_avg_quality_score": round(float(peers["QualScore"].mean()), 1),
        "peer_avg_ed_visits": round(float(peers["P_EDV_Vis"].mean()), 1),
        "peer_avg_snf_adm": round(float(peers["P_SNF_ADM"].mean()), 1),
        "peer_avg_inp_adm": round(float(peers["ADM"].mean()), 1),
        "peer_avg_pcp_visits": round(float(peers["P_EM_PCP_Vis"].mean()), 1),
        "peer_avg_inp_spend": round(float(peers["CapAnn_INP_All"].mean()), 2),
        "peer_avg_snf_spend": round(float(peers["CapAnn_SNF"].mean()), 2),
        "peer_avg_opd_spend": round(float(peers["CapAnn_OPD"].mean()), 2),
        "peer_avg_pb_spend": round(float(peers["CapAnn_PB"].mean()), 2),
    }

    # Care setting breakdown
    setting_map = {
        "CapAnn_INP_All": "Inpatient",
        "CapAnn_SNF": "Skilled Nursing (SNF)",
        "CapAnn_OPD": "Hospital Outpatient",
        "CapAnn_PB": "Physician & Supplier",
        "CapAnn_HHA": "Home Health",
        "CapAnn_HSP": "Hospice"
    }
    care_settings = [
        {"setting": label, "amount": float(row.get(col, 0)), "key": col}
        for col, label in setting_map.items()
    ]

    # Utilization metrics
    util_map = {
        "ADM": "Inpatient Admissions",
        "P_EDV_Vis": "Emergency Dept Visits",
        "P_EDV_Vis_HOSP": "ED Resulting in Admission",
        "P_SNF_ADM": "SNF Admissions",
        "P_EM_PCP_Vis": "Primary Care Visits"
    }
    utilization = [
        {
            "metric": label,
            "rate": float(row.get(col, 0)),
            "peer_rate": float(peers[col].mean()) if col in peers.columns else 0.0,
            "key": col
        }
        for col, label in util_map.items()
    ]

    # Provider Composition
    prov_map = {
        "N_PCP": "Primary Care Physicians",
        "N_Spec": "Specialists",
        "N_NP": "Nurse Practitioners",
        "N_PA": "Physician Assistants",
        "N_Hosp": "Hospitals",
        "N_CAH": "Critical Access Hospitals"
    }
    provider_mix = [
        {"role": label, "count": int(row.get(col, 0)), "key": col}
        for col, label in prov_map.items()
    ]

    # CAHPS patient experience scores
    cahps_names = {
        "CAHPS_1": "Getting Timely Care",
        "CAHPS_2": "Provider Communication",
        "CAHPS_3": "Patient Rating of Provider",
        "CAHPS_4": "Access to Specialists",
        "CAHPS_5": "Health Promotion & Education",
        "CAHPS_6": "Shared Decision Making",
        "CAHPS_7": "Health Status / Functional",
        "CAHPS_8": "Stewardship / Care Coordination",
        "CAHPS_9": "Courteous Office Staff"
    }
    cahps_scores = [
        {"measure": cahps_names.get(col, col), "score": float(row.get(col, 0)), "key": col}
        for col in sorted(cahps_names.keys()) if col in row and pd.notna(row[col])
    ]

    # AI Action Recommendations
    recs = recommendations_data.get(aco_id, [])

    return {
        "aco": row,
        "predictions": pred_data,
        "peer_benchmarks": peer_stats,
        "care_settings": care_settings,
        "utilization": utilization,
        "provider_mix": provider_mix,
        "cahps_scores": cahps_scores,
        "recommendations": recs
    }


@app.get("/api/predictive/summary")
def get_predictive_summary():
    if pred_df is None or importance_df is None:
        raise HTTPException(status_code=500, detail="Predictive artifacts not available")

    # Counts
    rising_count = int((pred_df["projected_pct_change"] > 0.5).sum())
    falling_count = int((pred_df["projected_pct_change"] < -0.5).sum())
    stable_count = int(len(pred_df) - rising_count - falling_count)

    # Risk tiers
    risk_tiers = pred_df["risk_flag"].value_counts().to_dict()

    # Top rising & top falling cost trajectories
    top_rising = pred_df.nlargest(10, "projected_pct_change")[
        ["ACO_ID", "ACO_Name", "current_py_expenditure", "projected_next_year_expenditure", "projected_pct_change", "risk_flag"]
    ].to_dict(orient="records")

    top_falling = pred_df.nsmallest(10, "projected_pct_change")[
        ["ACO_ID", "ACO_Name", "current_py_expenditure", "projected_next_year_expenditure", "projected_pct_change", "risk_flag"]
    ].to_dict(orient="records")

    # Top drivers / Feature importances
    drivers = importance_df.head(12).to_dict(orient="records")

    return {
        "trajectory_counts": {
            "rising": rising_count,
            "falling": falling_count,
            "stable": stable_count
        },
        "risk_tiers": risk_tiers,
        "top_rising_trend": top_rising,
        "top_falling_trend": top_falling,
        "drivers": drivers
    }


@app.post("/api/simulate")
def simulate_scenario(req: SimulationRequest):
    if aco_df is None:
        raise HTTPException(status_code=500, detail="ACO performance data not loaded")

    matches = aco_df[aco_df["ACO_ID"] == req.aco_id]
    if matches.empty:
        raise HTTPException(status_code=404, detail=f"ACO with ID {req.aco_id} not found")

    row = matches.iloc[0].to_dict()

    from train_model import calculate_what_if_simulation
    sim_result = calculate_what_if_simulation(
        aco_row=row,
        ed_reduction_pct=req.ed_reduction_pct,
        snf_reduction_pct=req.snf_reduction_pct,
        opd_reduction_pct=req.opd_reduction_pct,
        pcp_increase_pct=req.pcp_increase_pct,
        qual_improvement_pts=req.qual_improvement_pts
    )

    return {
        "aco_id": req.aco_id,
        "aco_name": row.get("ACO_Name"),
        "inputs": req.dict(),
        "results": sim_result
    }


@app.get("/api/benchmarks/meta")
def get_benchmarks_meta():
    if not os.path.exists(DB_PATH):
        return {"states": [], "specialties": []}

    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT Rndrng_Prvdr_Geo_Desc FROM geo_benchmarks WHERE Rndrng_Prvdr_Geo_Lvl = 'State' ORDER BY Rndrng_Prvdr_Geo_Desc")
        states = [r[0] for r in cur.fetchall() if r[0]]

        cur.execute("SELECT DISTINCT Rndrng_Prvdr_Type FROM provider_summary WHERE Rndrng_Prvdr_Type IS NOT NULL ORDER BY Rndrng_Prvdr_Type")
        specialties = [r[0] for r in cur.fetchall() if r[0]]

        return {"states": states, "specialties": specialties}
    finally:
        conn.close()


@app.get("/api/benchmarks/geo")
def get_geo_benchmarks(
    geo_lvl: str = "National",
    state: Optional[str] = None,
    query: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="Benchmark SQLite cache not built")

    conn = get_db_conn()
    try:
        cur = conn.cursor()
        conditions = ["Rndrng_Prvdr_Geo_Lvl = ?"]
        params = [geo_lvl]

        if geo_lvl == "State" and state:
            conditions.append("Rndrng_Prvdr_Geo_Desc = ?")
            params.append(state)

        if query:
            q_clean = f"%{query.strip()}%"
            conditions.append("(HCPCS_Cd LIKE ? OR HCPCS_Desc LIKE ?)")
            params.extend([q_clean, q_clean])

        where_clause = " AND ".join(conditions)

        count_sql = f"SELECT COUNT(*) FROM geo_benchmarks WHERE {where_clause}"
        cur.execute(count_sql, params)
        total = cur.fetchone()[0]

        sql = f"""
            SELECT HCPCS_Cd, HCPCS_Desc, Place_Of_Srvc, Tot_Rndrng_Prvdrs, Tot_Benes,
                   Tot_Srvcs, Avg_Sbmtd_Chrg, Avg_Mdcr_Alowd_Amt, Avg_Mdcr_Pymt_Amt, Avg_Mdcr_Stdzd_Amt
            FROM geo_benchmarks
            WHERE {where_clause}
            ORDER BY Tot_Srvcs DESC
            LIMIT ? OFFSET ?
        """
        cur.execute(sql, params + [limit, offset])
        rows = [dict(r) for r in cur.fetchall()]

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "benchmarks": rows
        }
    finally:
        conn.close()


@app.get("/api/benchmarks/providers")
def get_provider_benchmarks(
    specialty: Optional[str] = None,
    state: Optional[str] = None,
    search_name: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="Benchmark SQLite cache not built")

    conn = get_db_conn()
    try:
        cur = conn.cursor()
        conditions = []
        params = []

        if specialty and specialty != "All":
            conditions.append("Rndrng_Prvdr_Type = ?")
            params.append(specialty)

        if state and state != "All":
            conditions.append("Rndrng_Prvdr_State_Abrvtn = ?")
            params.append(state)

        if search_name:
            s_clean = f"%{search_name.strip()}%"
            conditions.append("(Rndrng_Prvdr_Last_Org_Name LIKE ? OR Rndrng_Prvdr_First_Name LIKE ?)")
            params.extend([s_clean, s_clean])

        where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""

        count_sql = f"SELECT COUNT(*) FROM provider_summary {where_clause}"
        cur.execute(count_sql, params)
        total = cur.fetchone()[0]

        sql = f"""
            SELECT Rndrng_NPI, Rndrng_Prvdr_Last_Org_Name, Rndrng_Prvdr_First_Name,
                   Rndrng_Prvdr_City, Rndrng_Prvdr_State_Abrvtn, Rndrng_Prvdr_Type,
                   Tot_Benes, Tot_Srvcs, Tot_Mdcr_Pymt_Amt, Tot_Mdcr_Alowd_Amt, Bene_Avg_Risk_Scre
            FROM provider_summary
            {where_clause}
            ORDER BY Tot_Mdcr_Pymt_Amt DESC
            LIMIT ? OFFSET ?
        """
        cur.execute(sql, params + [limit, offset])
        rows = [dict(r) for r in cur.fetchall()]

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "providers": rows
        }
    finally:
        conn.close()


@app.get("/api/report/{aco_id}")
def get_executive_report(aco_id: str):
    detail = get_aco_detail(aco_id)
    aco = detail["aco"]
    preds = detail["predictions"]
    peers = detail["peer_benchmarks"]

    return {
        "report_title": f"VBC Contract Performance Executive Briefing — {aco.get('ACO_Name')}",
        "generated_timestamp": pd.Timestamp.now().strftime("%B %d, %Y"),
        "executive_summary": {
            "aco_id": aco_id,
            "aco_name": aco.get("ACO_Name"),
            "track": aco.get("Current_Track"),
            "revenue_tier": aco.get("Rev_Exp_Cat"),
            "attributed_lives": int(aco.get("N_AB", 0)),
            "financial_status": aco.get("Savings_Status"),
            "savings_rate": f"{aco.get('Sav_rate', 0):.2f}%",
            "earned_savings_loss": f"${aco.get('EarnSaveLoss', 0):,.0f}",
            "quality_score": f"{aco.get('QualScore', 0):.1f}",
            "risk_classification": preds.get("risk_flag", "N/A"),
            "cost_momentum": f"{preds.get('projected_pct_change', 0):+.1f}% projected next period"
        },
        "peer_comparison_matrix": [
            {
                "metric": "Per-Capita Total Expenditure",
                "aco_value": f"${aco.get('Per_Capita_Exp_TOTAL_PY', 0):,.0f}",
                "peer_benchmark": f"${peers.get('peer_avg_per_capita_exp', 0):,.0f}",
                "variance": f"{((aco.get('Per_Capita_Exp_TOTAL_PY', 0) - peers.get('peer_avg_per_capita_exp', 1)) / peers.get('peer_avg_per_capita_exp', 1) * 100):+.1f}%"
            },
            {
                "metric": "Savings Rate",
                "aco_value": f"{aco.get('Sav_rate', 0):.2f}%",
                "peer_benchmark": f"{peers.get('peer_avg_savings_rate', 0):.2f}%",
                "variance": f"{(aco.get('Sav_rate', 0) - peers.get('peer_avg_savings_rate', 0)):+.2f}%"
            },
            {
                "metric": "Quality Score",
                "aco_value": f"{aco.get('QualScore', 0):.1f}",
                "peer_benchmark": f"{peers.get('peer_avg_quality_score', 0):.1f}",
                "variance": f"{(aco.get('QualScore', 0) - peers.get('peer_avg_quality_score', 0)):+.1f} pts"
            },
            {
                "metric": "ED Visit Rate (per 1k)",
                "aco_value": f"{aco.get('P_EDV_Vis', 0):.1f}",
                "peer_benchmark": f"{peers.get('peer_avg_ed_visits', 0):.1f}",
                "variance": f"{((aco.get('P_EDV_Vis', 0) - peers.get('peer_avg_ed_visits', 1)) / peers.get('peer_avg_ed_visits', 1) * 100):+.1f}%"
            },
            {
                "metric": "SNF Admission Rate (per 1k)",
                "aco_value": f"{aco.get('P_SNF_ADM', 0):.1f}",
                "peer_benchmark": f"{peers.get('peer_avg_snf_adm', 0):.1f}",
                "variance": f"{((aco.get('P_SNF_ADM', 0) - peers.get('peer_avg_snf_adm', 1)) / peers.get('peer_avg_snf_adm', 1) * 100):+.1f}%"
            }
        ],
        "action_interventions": detail["recommendations"]
    }


from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

DIST_DIR = os.path.join(BASE_DIR, "frontend", "dist")
if os.path.exists(DIST_DIR):
    assets_dir = os.path.join(DIST_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        # Don't catch /api routes
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = os.path.join(DIST_DIR, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False)
