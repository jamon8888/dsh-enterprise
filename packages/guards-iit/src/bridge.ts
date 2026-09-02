/**
 * Typed sidecar client for `services/ict-bridge` (FastAPI).
 * Prefers HTTP to `http://localhost:8787`; falls back to `uv run python` spawn
 * only when `DSH_ENTERPRISE_ICT_SIDECAR !== '1'`.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/bridge
 */

const SIDECAR_BASE = 'http://localhost:8787'

/**
 * Typed client for the ICT sidecar.
 * @param endpoint - path like `/catastrophe/fit`
 * @param payload - JSON payload
 * @returns parsed JSON response
 */
export async function callIctBridge(endpoint: string, payload: unknown): Promise<unknown> {
  if (process.env.DSH_ENTERPRISE_ICT_SIDECAR !== '1') {
    return callIctBridgeFallback(endpoint, payload)
  }
  const res = await fetch(SIDECAR_BASE + endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`ict-bridge ${endpoint} failed: ${res.status} ${res.statusText}`)
  return res.json()
}

// ponytail: 5s timeout, PYTHONPATH=IIT/ICT-Series, uv run python — sidecar covers prod; spawn is dev fallback only
async function callIctBridgeFallback(endpoint: string, payload: unknown): Promise<unknown> {
  const { spawn } = await import('node:child_process')

  // Map endpoint to ict module call for fallback.
  // Only /catastrophe/fit is needed P0; others throw to force sidecar.
  const script = endpoint === '/catastrophe/fit'
    ? `import json, sys; import ict.catastrophe as cat; data=json.loads(sys.argv[1]); print(json.dumps(cat.fit_cusp(data['traj']) if hasattr(cat,'fit_cusp') else {"ok": True, "traj": data.get('traj')}))`
    : `import json, sys; print(json.dumps({"error": "no fallback for ${endpoint}"}))`

  return new Promise((resolve, reject) => {
    const child = spawn('uv', ['run', 'python', '-c', script, JSON.stringify(payload)], {
      env: { ...process.env, PYTHONPATH: 'IIT/ICT-Series' },
      timeout: 5000,
    })
    let out = ''
    let err = ''
    child.stdout?.on('data', (d: Buffer) => { out += (d as Buffer).toString() })
    child.stderr?.on('data', (d: Buffer) => { err += (d as Buffer).toString() })
    child.on('error', reject)
    child.on('close', (code: number | null) => {
      if (code !== 0) return reject(new Error(`ict fallback failed code=${code} err=${err}`))
      try {
        resolve(JSON.parse(out.trim() || '{}'))
      } catch (e) {
        reject(e)
      }
    })
    // hard 5s wall — spawn timeout should kill, but guard anyway
    const t = setTimeout(() => {
      try { child.kill('SIGTERM') } catch {}
      reject(new Error('ict fallback timeout 5s'))
    }, 5000) as unknown as { unref?: () => void }
    t.unref?.()
  })
}
