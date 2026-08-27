---
name: rust-hygiene
description: Rust hygiene for dsh-enterprise — cargo fmt, clippy pedantic, nextest, unsafe review. Use for any Rust edit, crate, or FFI question.
---

# Rust Hygiene

Workspace `dsh-enterprise/Cargo.toml:2` — `edition="2024"`, `rust-version="1.85"`.

```toml
[lints.rust]
unsafe_code = "warn"
[lints.clippy]
all = "warn"
pedantic = "warn"
```

## Gates

```sh
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace              # or cargo nextest run (faster, sharded)
cargo llvm-cov --workspace          # coverage when gate added
```

## Skills routing

- `rust-router` is master — it routes to `m01-m15`.
- Ownership/borrow `m01-ownership`, mutability `m03`, generics/traits `m04-zero-cost`, error `m06`, concurrency `m07`, perf `m10`, unsafe/FFI `unsafe-checker`.
- New crate? `rust-learner` for version/features, `m11-ecosystem` for Cargo.toml, `core-dynamic-skills` to generate crate skill.

## Conventions

- No `unsafe` without `unsafe-checker` review — `SAFETY:` comment required.
- `rust-analyzer` via `opencode.json:10` `lsp.rust` — diagnostics only, CLI clippy is gate.
- `cargo fmt` via `formatter.rustfmt` auto-formats on write.
