"""
UC08 - CMS MSSP Performance Year Financial & Quality Results
ETL Pipeline: API Fetch -> Raw Archive -> Schema Normalize -> Historical Panel

============================================================================
HOW TO USE
============================================================================

1) PASTE YOUR API ENDPOINTS below in API_ENDPOINTS, one per performance year.
   These are CMS data.cms.gov "data-api" endpoints, e.g.:
     https://data.cms.gov/data-api/v1/dataset/<uuid>/data
   Find them on each year's dataset page at:
     https://data.cms.gov/provider-data/ or the "Performance Year Financial
     and Quality Results" listing on data.cms.gov (each year is a separate
     dataset/distribution with its own uuid).

2) Run:
     python etl_pipeline.py fetch          # fetch all configured years from API
     python etl_pipeline.py ingest-folder  # process any new files dropped in incoming/
     python etl_pipeline.py build-panel    # rebuild the historical multi-year panel
     python etl_pipeline.py all            # do all three, in order

3) Every raw pull is archived (never overwritten) in raw_archive/, so old
   evidence is always kept even after re-fetching or reprocessing. Adding a
   new performance year later means either:
     a) adding one line to API_ENDPOINTS and rerunning, or
     b) dropping a CSV/JSON file into incoming/ and running ingest-folder
   Either path is picked up automatically without touching existing years'
   archived data.

============================================================================
"""
import requests
import pandas as pd
import numpy as np
import json
import os
import shutil
import hashlib
from datetime import datetime, timezone

# ----------------------------------------------------------------------
# 1. CONFIGURE YOUR API ENDPOINTS HERE (paste as you get them)
# ----------------------------------------------------------------------
# Format: {performance_year: api_url}
# Example (PY2024, confirmed working live endpoint):
API_ENDPOINTS = {
    2024: "https://data.cms.gov/data-api/v1/dataset/73b2ce14-351d-40ac-90ba-ec9e1f5ba80c/data",
    2023: "https://data.cms.gov/data-api/v1/dataset/7082a8f1-6d51-4723-853d-086bf254f5fb/data",
    2022: "https://data.cms.gov/data-api/v1/dataset/a5d74ce2-ba38-47be-8523-146e4ad41832/data",
    2021: "https://data.cms.gov/data-api/v1/dataset/bd6b766f-6fa3-43ae-8e9a-319da31dc374/data",
    2020: "https://data.cms.gov/data-api/v1/dataset/8f073013-9db0-4b12-9a34-5802bdabbdfe/data",
    2019: "https://data.cms.gov/data-api/v1/dataset/9c3a4c69-7d00-4307-9b6f-a080dc90417e/data",
    2018: "https://data.cms.gov/data-api/v1/dataset/80c86127-8839-4f35-b87b-aa37664afd19/data",
    2017: "https://data.cms.gov/data-api/v1/dataset/3b306450-1836-417b-b779-7d70fd2fc734/data",
    2016: "https://data.cms.gov/data-api/v1/dataset/a290fdd3-976a-4fc9-9139-a98193b3af82/data",
    2015: "https://data.cms.gov/data-api/v1/dataset/156c00e2-ab42-4923-b54f-09c031f5f28d/data",
    2014: "https://data.cms.gov/data-api/v1/dataset/0ef9b1e2-e23b-4a01-921c-1ac7290c814b/data",
    2020: "https://data.cms.gov/data-api/v1/dataset/bc90f498-76f4-4e75-8225-8aae30336059/data",
    # ... paste additional years here as you find their dataset uuids ...
}

BASE = os.path.dirname(os.path.abspath(__file__))
RAW_ARCHIVE = os.path.join(BASE, "raw_archive")
PROCESSED = os.path.join(BASE, "processed")
INCOMING = os.path.join(BASE, "incoming")
LOGS = os.path.join(BASE, "logs")
for d in (RAW_ARCHIVE, PROCESSED, INCOMING, LOGS):
    os.makedirs(d, exist_ok=True)

MANIFEST_PATH = os.path.join(LOGS, "ingestion_manifest.csv")


# ----------------------------------------------------------------------
# Schema normalization: PY Financial & Quality Results renamed several
# columns over the years (per CMS data dictionary). Map old -> current
# names so years can be stacked into one panel.
# ----------------------------------------------------------------------
RENAME_MAP = {
    # pre-2021 CAHPS naming -> current
    "ACO1": "CAHPS_1", "ACO2": "CAHPS_2", "ACO3": "CAHPS_3", "ACO4": "CAHPS_4",
    "ACO5": "CAHPS_5", "ACO6": "CAHPS_6", "ACO7": "CAHPS_7",
    "ACO34": "CAHPS_11", "ACO45": "CAHPS_9", "ACO46": "CAHPS_8",
    # pre-2021 QualityID naming -> current
    "ACO13": "QualityID_318", "ACO14": "QualityID_110", "ACO17": "QualityID_226",
    "ACO18": "QualityID_134_WI", "ACO19": "QualityID_113", "ACO20": "QualityID_112",
    "ACO42": "QualityID_438", "ACO40": "QualityID_370",
    "ACO27": "QualityID_001_WI", "ACO28": "QualityID_236_WI",
    # pre-2021 sharing-rate naming -> current
    "QualPerfShare": "MaxShareRate",
}

# Core columns we always want, if present, regardless of year
CORE_COLUMNS = [
    "ACO_ID", "ACO_Name", "Current_Track", "Risk_Model", "Agree_Type", "N_AB",
    "Rev_Exp_Cat", "BnchmkMinExp", "GenSaveLoss", "EarnSaveLoss", "Sav_rate",
    "UpdatedBnchmk", "Per_Capita_Exp_TOTAL_PY", "QualScore", "Met_QPS",
    "CapAnn_INP_All", "CapAnn_SNF", "CapAnn_OPD", "CapAnn_PB", "CapAnn_HHA", "CapAnn_HSP",
    "ADM", "P_EDV_Vis", "P_EDV_Vis_HOSP", "P_SNF_ADM", "P_EM_PCP_Vis",
    "N_PCP", "N_Spec", "N_NP", "N_PA", "N_Hosp", "N_CAH",
]


def _file_hash(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:12]


def _log_manifest(row: dict):
    """Append-only ingestion log so every fetch/ingest event is traceable evidence."""
    df_row = pd.DataFrame([row])
    if os.path.exists(MANIFEST_PATH):
        df_row.to_csv(MANIFEST_PATH, mode="a", header=False, index=False)
    else:
        df_row.to_csv(MANIFEST_PATH, index=False)


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.rename(columns={k: v for k, v in RENAME_MAP.items() if k in df.columns})
    return df


# ----------------------------------------------------------------------
# STEP 1: Fetch from configured API endpoints
# ----------------------------------------------------------------------
def fetch_all():
    if not API_ENDPOINTS:
        print("No API_ENDPOINTS configured. Paste endpoints into the script and rerun.")
        return

    for year, url in API_ENDPOINTS.items():
        print(f"Fetching PY{year} from {url} ...")
        try:
            resp = requests.get(url, timeout=60)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"  FAILED: {e}")
            _log_manifest({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "action": "fetch", "year": year, "source": url,
                "status": "failed", "error": str(e), "rows": None, "file_hash": None,
            })
            continue

        df = pd.DataFrame(data)
        df["source_performance_year"] = year

        # Archive raw, never overwrite - timestamped filename keeps every prior pull as evidence
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        raw_path = os.path.join(RAW_ARCHIVE, f"PY{year}_raw_{ts}.csv")
        df.to_csv(raw_path, index=False)
        fhash = _file_hash(raw_path)

        print(f"  OK: {len(df)} rows -> archived at {raw_path}")
        _log_manifest({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": "fetch", "year": year, "source": url,
            "status": "success", "error": None, "rows": len(df), "file_hash": fhash,
        })


# ----------------------------------------------------------------------
# STEP 2: Ingest any new files manually dropped into incoming/
#          (adaptive ingestion for files not available via API)
# ----------------------------------------------------------------------
def ingest_folder():
    files = [f for f in os.listdir(INCOMING) if f.lower().endswith((".csv", ".json"))]
    if not files:
        print("No new files in incoming/.")
        return

    for fname in files:
        fpath = os.path.join(INCOMING, fname)
        print(f"Ingesting {fname} ...")
        try:
            if fname.lower().endswith(".json"):
                with open(fpath) as f:
                    data = json.load(f)
                df = pd.DataFrame(data)
            else:
                df = pd.read_csv(fpath, low_memory=False)
        except Exception as e:
            print(f"  FAILED to parse {fname}: {e}")
            _log_manifest({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "action": "ingest_folder", "year": None, "source": fname,
                "status": "failed", "error": str(e), "rows": None, "file_hash": None,
            })
            continue

        # Try to infer performance year from filename (e.g. "PY2022...", "...2022...")
        year = None
        for token in fname.replace("_", " ").replace("-", " ").replace(".", " ").split():
            if token.isdigit() and len(token) == 4 and 2010 < int(token) < 2035:
                year = int(token)
                break
        df["source_performance_year"] = year

        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        archive_name = f"PY{year or 'UNK'}_incoming_{ts}_{fname}"
        archive_path = os.path.join(RAW_ARCHIVE, archive_name)
        shutil.copy(fpath, archive_path)  # keep the original as evidence
        df.to_csv(os.path.join(RAW_ARCHIVE, archive_name.rsplit(".", 1)[0] + "_parsed.csv"), index=False)
        fhash = _file_hash(fpath)

        # Move processed input out of incoming/ so it isn't reprocessed next run
        done_dir = os.path.join(INCOMING, "_processed")
        os.makedirs(done_dir, exist_ok=True)
        shutil.move(fpath, os.path.join(done_dir, fname))

        print(f"  OK: {len(df)} rows, inferred year={year} -> archived as {archive_name}")
        _log_manifest({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": "ingest_folder", "year": year, "source": fname,
            "status": "success", "error": None, "rows": len(df), "file_hash": fhash,
        })


# ----------------------------------------------------------------------
# STEP 3: Build the normalized multi-year historical panel from every
#          archived raw snapshot (always uses the LATEST snapshot per year)
# ----------------------------------------------------------------------
def build_panel():
    if not os.path.exists(MANIFEST_PATH):
        print("No manifest found - run fetch or ingest-folder first.")
        return

    manifest = pd.read_csv(MANIFEST_PATH)
    ok = manifest[manifest["status"] == "success"].copy()
    if ok.empty:
        print("No successful ingests recorded.")
        return

    # For each year, use the most recent successful ingest as the source of truth
    ok["timestamp"] = pd.to_datetime(ok["timestamp"])
    latest_per_year = ok.sort_values("timestamp").groupby("year").tail(1)

    frames = []
    for _, row in latest_per_year.iterrows():
        year = row["year"]
        # locate the archived file(s) for this event by matching hash-adjacent filename pattern
        candidates = [f for f in os.listdir(RAW_ARCHIVE)
                      if f.startswith(f"PY{int(year) if pd.notna(year) else 'UNK'}")
                      and (f.endswith(".csv"))]
        if not candidates:
            continue
        # prefer the most recently modified matching file
        candidates.sort(key=lambda f: os.path.getmtime(os.path.join(RAW_ARCHIVE, f)))
        fpath = os.path.join(RAW_ARCHIVE, candidates[-1])
        df = pd.read_csv(fpath, low_memory=False)
        df = normalize_columns(df)
        if "source_performance_year" not in df.columns:
            df["source_performance_year"] = year
        frames.append(df)

    if not frames:
        print("No raw files matched manifest entries.")
        return

    panel = pd.concat(frames, ignore_index=True, sort=False)

    # Coerce numeric columns used downstream (financial/quality/utilization)
    numeric_like = [c for c in CORE_COLUMNS if c in panel.columns and c not in
                     ("ACO_ID", "ACO_Name", "Current_Track", "Risk_Model", "Agree_Type",
                      "Rev_Exp_Cat", "Met_QPS")]
    for c in numeric_like:
        panel[c] = pd.to_numeric(panel[c], errors="coerce")

    panel = panel.sort_values(["ACO_ID", "source_performance_year"])
    out_path = os.path.join(PROCESSED, "aco_panel_multiyear.csv")
    panel.to_csv(out_path, index=False)
    print(f"Built historical panel: {len(panel)} rows across "
          f"{panel['source_performance_year'].nunique()} performance year(s) -> {out_path}")


if __name__ == "__main__":
    import sys
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd in ("fetch", "all"):
        fetch_all()
    if cmd in ("ingest-folder", "all"):
        ingest_folder()
    if cmd in ("build-panel", "all"):
        build_panel()
