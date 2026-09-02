# ICT Bridge Sidecar

FastAPI sidecar bridging `IIT/ICT-Series/ict/*.py` for `@deepseek-ai/dsh-enterprise-guards-iit`.

## Runtime

- `pyphi==1.2.0` requires `Python ==3.9.*` and `numpy<2` per `IIT/ICT-Series/pyproject.toml:10` (`collections.Iterable` removed in 3.10, `pyemd` compat).
- `ict/*.py` modules are **MIT** licensed at `IIT/ICT-Series/ict/*.py` (same repo, `pyproject.toml` license MIT).
- Install via `uv sync --locked` (`uv` managed). `PYTHONPATH=IIT/ICT-Series` when running without install.

## Endpoints

- `POST /catastrophe/fit` → `ict.catastrophe.fit_cusp(traj)`
- `GET /health` → `{"ok": true}`

## Usage

```sh
DSH_ENTERPRISE_ICT_SIDECAR=1 uv run uvicorn main:app --port 8787
# TS client: callIctBridge('/catastrophe/fit', { traj })
```

Fallback when `DSH_ENTERPRISE_ICT_SIDECAR !== '1'`: TS `bridge.ts` spawns `uv run python` with `PYTHONPATH=IIT/ICT-Series` and 5s timeout.

## Docker

```sh
docker build -t dsh-enterprise-ict-bridge -f services/ict-bridge/Dockerfile .
docker run -p 8787:8787 dsh-enterprise-ict-bridge
```
