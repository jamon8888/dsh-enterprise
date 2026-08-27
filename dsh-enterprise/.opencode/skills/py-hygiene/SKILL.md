---
name: py-hygiene
description: Python hygiene for dsh/python + dsh-enterprise — ruff format/lint, pyright, pytest. Use for any Python edit, dependency, or test question.
---

# Python Hygiene

- `dsh/python/sdk/pyproject.toml` — SDK tests `pytest.ini:2` `testpaths=python/sdk/tests`
- `dsh-enterprise/pyproject.toml:5` — `requires-python=="3.9.*"` + `uv` managed, `pyphi==1.2.0`

## Gates

```sh
uv run ruff check . --fix
uv run ruff format --check
uv run pyright                    # or ty
uv run pytest
# enterprise
uv --project dsh-enterprise run pytest
```

`opencode.json:11` enables `formatter.ruff` (`ruff format $FILE`) and `lsp.pyright` — auto on write, but `ruff check` is gate.

## Conventions

- Use `uv` not `pip` — `pyproject.toml:14` `[tool.uv] managed=true`.
- Pin `requires-python` narrowly; `uv` enforces.
- `norecursedirs = node_modules .git dist-exe` in `pytest.ini` — prevents venv/worktree collisions.
- Add new deps via `uv add` so `uv.lock` stays in sync.
