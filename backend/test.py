# test_ws.py
import asyncio
import json
import websockets
import requests
import time
import base64
import zlib
import numpy as np

WS_URL   = "ws://localhost:8000/ws/simulation/stream"
REST_URL = "http://localhost:8000"

# ── Decoding ──────────────────────────────────────────────────────────────────

def decode_array(encoded: str, dtype) -> np.ndarray:
    """Base64 decode → zlib decompress → numpy array."""
    raw = zlib.decompress(base64.b64decode(encoded))
    return np.frombuffer(raw, dtype=dtype)

def decode_frame_arrays(frame: dict, grid_size: int) -> dict:
    """
    Decode all compressed arrays in a frame and reshape to (grid_size, grid_size).
    Returns a dict of decoded arrays — only keys present in the frame are decoded.
    """
    decoded = {}
    dtype_map = {
        "state":        np.int8,
        "elevation":    np.float32,
        "flammability": np.float32,
    }
    for key, dtype in dtype_map.items():
        if key in frame:
            arr = decode_array(frame[key], dtype)
            decoded[key] = arr.reshape(grid_size, grid_size)
    return decoded

# ── REST ──────────────────────────────────────────────────────────────────────

def health_check():
    print("[0/3] Health check ...")
    try:
        r = requests.get(f"{REST_URL}/docs", timeout=5)
        r.raise_for_status()
        print("✓ Server is reachable\n")
    except requests.exceptions.ConnectionError:
        print("✗ Server is not reachable — is uvicorn running on port 8000?")
        raise
    except requests.exceptions.Timeout:
        print("✗ Server did not respond to health check in 5s")
        raise

def start_simulation():
    print("[1/3] Sending POST /simulation/start ...")
    print("      Waiting for data download + interpolation (no hard timeout) ...")
    t0 = time.time()

    try:
        r = requests.post(
            f"{REST_URL}/simulation/start?scenario_id=1",
            json={
                "origin_lon":    153.02,
                "origin_lat":   -27.47,
                "size_m":        5000,
                "wind_speed":    10.0,
                "wind_dir":      45.0,
                "cell_res_m":    5.0,
                "burn_duration": 5,
            },
            timeout=(10, None)
        )
        r.raise_for_status()
    except requests.exceptions.ConnectTimeout:
        print("✗ Could not connect to server — is uvicorn running on port 8000?")
        raise
    except requests.exceptions.HTTPError as e:
        print(f"✗ Server returned error {e.response.status_code}: {e.response.text}")
        raise

    elapsed = time.time() - t0
    print(f"✓ Simulation started in {elapsed:.1f}s")
    return r.json()

# ── WebSocket ─────────────────────────────────────────────────────────────────

async def test():

    # ── 0. Health check ───────────────────────────────────────────────────────
    try:
        health_check()
    except Exception:
        return

    # ── 1. Start simulation ───────────────────────────────────────────────────
    loop = asyncio.get_event_loop()
    try:
        data = await loop.run_in_executor(None, start_simulation)
    except Exception:
        print("✗ Aborting — simulation failed to start.")
        return

    grid_size = data["grid_size"]
    print(f"  scenario_id = {data['scenario_id']}")
    print(f"  grid        = {grid_size} x {grid_size} cells")
    print(f"  resolution  = {data['cell_res_m']}m per cell")
    print(f"  message     = {data['message']}")

    # ── 2. Connect WebSocket ──────────────────────────────────────────────────
    print("\n[2/3] Connecting to WebSocket ...")
    try:
        async with websockets.connect(
            f"{WS_URL}?scenario_id=1&tick_interval_ms=100&max_ticks=20",
            open_timeout=10,
            max_size=10 * 1024 * 1024   # Match server 10MB limit
        ) as ws:
            print("✓ WebSocket connected\n")
            print("[3/3] Receiving frames ...\n")

            t_start    = time.time()
            tick_times = []

            while True:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=60)
                except asyncio.TimeoutError:
                    print("✗ No frame received for 60s — server may have stalled")
                    break

                frame = json.loads(raw)

                # ── Init ──────────────────────────────────────────────────────
                if frame["type"] == "init":
                    decoded = decode_frame_arrays(frame, grid_size)

                    state        = decoded["state"]
                    elevation    = decoded["elevation"]
                    flammability = decoded["flammability"]

                    print(f"  [INIT]  grid={frame['grid_size']}x{frame['grid_size']} "
                          f"res={frame['cell_res_m']}m | "
                          f"wind={frame['wind_speed']}m/s @ {frame['wind_dir']}° | "
                          f"bounds=({frame['x_min']:.0f}, {frame['y_min']:.0f})"
                          f" → ({frame['x_max']:.0f}, {frame['y_max']:.0f})")

                    # Verify shapes
                    assert state.shape        == (grid_size, grid_size), "✗ state shape mismatch"
                    assert elevation.shape    == (grid_size, grid_size), "✗ elevation shape mismatch"
                    assert flammability.shape == (grid_size, grid_size), "✗ flammability shape mismatch"

                    # Sanity check values
                    print(f"  ✓ state:        shape={state.shape}        unique_values={np.unique(state).tolist()}")
                    print(f"  ✓ elevation:    shape={elevation.shape}    min={elevation.min():.1f}m max={elevation.max():.1f}m")
                    print(f"  ✓ flammability: shape={flammability.shape} min={flammability.min():.2f} max={flammability.max():.2f}\n")

                # ── Tick ──────────────────────────────────────────────────────
                elif frame["type"] == "tick":
                    tick_times.append(time.time())
                    avg_tick_ms = (
                        (tick_times[-1] - tick_times[0]) / len(tick_times) * 1000
                        if len(tick_times) > 1 else 0
                    )

                    decoded = decode_frame_arrays(frame, grid_size)
                    state   = decoded["state"]

                    assert state.shape == (grid_size, grid_size), "✗ tick state shape mismatch"

                    print(f"  [TICK {frame['tick']:>3}] "
                          f"burning={frame['burning_count']:>5} | "
                          f"burned={frame['burned_pct']:>5}% | "
                          f"watered={frame['watered_count']:>4} | "
                          f"control={frame['control_count']:>4} | "
                          f"sim_time={frame['sim_time_s']}s | "
                          f"~{avg_tick_ms:.0f}ms/tick | "
                          f"state_unique={np.unique(state).tolist()}")

                    if frame["tick"] == 5:
                        print("\n  >>> Testing pause ...")
                        await ws.send(json.dumps({"cmd": "pause"}))
                        await asyncio.sleep(2)
                        print("  >>> Testing resume ...")
                        await ws.send(json.dumps({"cmd": "resume"}))
                        print()


                

                # ── Terminal ──────────────────────────────────────────────────
                elif frame["type"] in ("complete", "max_ticks", "stopped"):
                    elapsed = time.time() - t_start
                    print(f"\n  [{frame['type'].upper()}] "
                          f"tick={frame['tick']} | "
                          f"burned={frame['burned_pct']}% | "
                          f"reason='{frame['reason']}'")
                    print(f"\n✓ Test complete in {elapsed:.1f}s")
                    break

                else:
                    print(f"  ? Unknown frame type: {frame['type']}")

    except websockets.exceptions.InvalidHandshake as e:
        print(f"✗ WebSocket handshake failed: {e}")

asyncio.run(test())