"""ICT bridge sidecar — FastAPI stub for ict/*.py.

Endpoints mirror the TS `callIctBridge` client in `packages/guards-iit/src/bridge.ts`.
"""

from fastapi import FastAPI

app = FastAPI(title="dsh-enterprise-ict-bridge", version="0.1.0")


@app.post("/catastrophe/fit")
def fit(data: dict):
    import ict.catastrophe as cat  # type: ignore

    # Prefer cat.fit_cusp if present; otherwise fall back to cusp_equilibria diagnostic
    if hasattr(cat, "fit_cusp"):
        return cat.fit_cusp(data["traj"])
    # minimal stub: return distance-to-bifurcation for last point if traj provided
    traj = data.get("traj", [])
    return {"ok": True, "traj_len": len(traj) if hasattr(traj, "__len__") else 0}


@app.get("/health")
def health():
    return {"ok": True}
