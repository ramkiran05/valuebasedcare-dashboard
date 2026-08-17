"""
API Unit & Integration Tests
"""
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

def test_api():
    print("Testing /api/health ...")
    r = client.get("/api/health")
    assert r.status_code == 200
    print("Health OK:", r.json())

    print("Testing /api/overview ...")
    r = client.get("/api/overview")
    assert r.status_code == 200
    data = r.json()
    assert "kpis" in data
    assert data["kpis"]["total_acos"] > 0
    print("Overview OK. Total ACOs:", data["kpis"]["total_acos"], "Net Savings:", data["kpis"]["net_savings"])

    print("Testing /api/acos ...")
    r = client.get("/api/acos?page=1&page_size=5")
    assert r.status_code == 200
    acos = r.json()
    assert len(acos["acos"]) == 5
    sample_id = acos["acos"][0]["ACO_ID"]
    print("ACO list OK. Sample ACO:", sample_id)

    print(f"Testing /api/acos/{sample_id} ...")
    r = client.get(f"/api/acos/{sample_id}")
    assert r.status_code == 200
    detail = r.json()
    assert "aco" in detail
    assert "peer_benchmarks" in detail
    assert "care_settings" in detail
    assert "utilization" in detail
    print("ACO Detail OK. Recs count:", len(detail["recommendations"]))

    print("Testing /api/predictive/summary ...")
    r = client.get("/api/predictive/summary")
    assert r.status_code == 200
    pred = r.json()
    assert "trajectory_counts" in pred
    assert len(pred["drivers"]) > 0
    print("Predictive OK. Drivers count:", len(pred["drivers"]))

    print("Testing /api/simulate ...")
    sim_payload = {
        "aco_id": sample_id,
        "ed_reduction_pct": 10.0,
        "snf_reduction_pct": 15.0,
        "opd_reduction_pct": 5.0,
        "pcp_increase_pct": 10.0,
        "qual_improvement_pts": 2.5
    }
    r = client.post("/api/simulate", json=sim_payload)
    assert r.status_code == 200
    sim = r.json()
    assert "results" in sim
    print("Simulation OK. Net dollar gain:", sim["results"]["net_dollar_gain"])

    print("Testing /api/benchmarks/meta ...")
    r = client.get("/api/benchmarks/meta")
    assert r.status_code == 200
    meta = r.json()
    print("Benchmarks Meta OK. States:", len(meta["states"]), "Specialties:", len(meta["specialties"]))

    print("Testing /api/benchmarks/geo ...")
    r = client.get("/api/benchmarks/geo?geo_lvl=National&limit=5")
    assert r.status_code == 200
    geo = r.json()
    assert len(geo["benchmarks"]) == 5
    print("Geo Benchmarks OK. Total records:", geo["total"])

    print("Testing /api/report/{sample_id} ...")
    r = client.get(f"/api/report/{sample_id}")
    assert r.status_code == 200
    report = r.json()
    assert "executive_summary" in report
    print("Report OK. Title:", report["report_title"])

    print("\nALL API INTEGRATION TESTS PASSED SUCCESSFULLY! [SUCCESS]")

if __name__ == "__main__":
    test_api()
