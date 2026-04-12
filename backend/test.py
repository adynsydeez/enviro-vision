# test_ws.py
import asyncio
import json
import websockets
import requests
import time

WS_URL   = "ws://localhost:8000/ws/simulation/stream"
REST_URL = "http://localhost:8000"

def start_simulation():
    print("[1/3] Sending POST /simulation/start ...")
    print("      (this may take 30-120s while data is downloaded and interpolated)")
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
            timeout=(10, 120)
        )
        r.raise_for_status()
    except requests.exceptions.ConnectTimeout:
        print("✗ Could not connect to server — is uvicorn running on port 8000?")
        raise
    except requests.exceptions.ReadTimeout:
        print("✗ Server connected but took too long to respond — increase read timeout or check processing logs")
        raise
    except requests.exceptions.HTTPError as e:
        print(f"✗ Server returned error: {e.response.status_code} — {e.response.text}")
        raise

    elapsed = time.time() - t0
    print(f"✓ Simulation started in {elapsed:.1f}s")
    return r.json()


async def test():

    # ── 1. Start ──────────────────────────────────────────────────────────────
    loop = asyncio.get_event_loop()
    try:
        data = await loop.run_in_executor(None, start_simulation)
    except Exception:
        print("✗ Aborting — simulation failed to start.")
        return

    print(f"  scenario_id = {data['scenario_id']}")
    print(f"  grid        = {data['grid_size']} x {data['grid_size']} cells")
    print(f"  resolution  = {data['cell_res_m']}m per cell")
    print(f"  message     = {data['message']}")

    # ── 2. Connect WebSocket ──────────────────────────────────────────────────
    print("\n[2/3] Connecting to WebSocket ...")
    try:
        async with websockets.connect(
            f"{WS_URL}?scenario_id=1&tick_interval_ms=100&max_ticks=20",
            open_timeout=10
        ) as ws:
            print("✓ WebSocket connected\n")
            print("[3/3] Receiving frames ...\n")

            t_start    = time.time()
            tick_times = []

            while True:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=30)
                except asyncio.TimeoutError:
                    print("✗ No frame received for 30s — server may have stalled")
                    break

                frame = json.loads(raw)

                # ── Init ──────────────────────────────────────────────────────
                if frame["type"] == "init":
                    print(f"  [INIT]  grid={frame['grid_size']}x{frame['grid_size']} "
                          f"res={frame['cell_res_m']}m | "
                          f"wind={frame['wind_speed']}m/s @ {frame['wind_dir']}° | "
                          f"bounds=({frame['x_min']:.0f}, {frame['y_min']:.0f})"
                          f" → ({frame['x_max']:.0f}, {frame['y_max']:.0f})")
                    
                    # Sanity checks
                    assert len(frame["state"])        == frame["grid_size"] ** 2, "✗ state length mismatch"
                    assert len(frame["elevation"])    == frame["grid_size"] ** 2, "✗ elevation length mismatch"
                    assert len(frame["flammability"]) == frame["grid_size"] ** 2, "✗ flammability length mismatch"
                    print("  ✓ Init frame payload lengths verified\n")

                # ── Tick ──────────────────────────────────────────────────────
                elif frame["type"] == "tick":
                    tick_times.append(time.time())
                    avg_tick_ms = (
                        (tick_times[-1] - tick_times[0]) / len(tick_times) * 1000
                        if len(tick_times) > 1 else 0
                    )

                    print(f"  [TICK {frame['tick']:>3}] "
                          f"burning={frame['burning_count']:>5} | "
                          f"burned={frame['burned_pct']:>5}% | "
                          f"watered={frame['watered_count']:>4} | "
                          f"control={frame['control_count']:>4} | "
                          f"sim_time={frame['sim_time_s']}s | "
                          f"~{avg_tick_ms:.0f}ms/tick")

                    if frame["tick"] == 5:
                        print("\n  >>> Testing pause ...")
                        await ws.send(json.dumps({"cmd": "pause"}))
                        await asyncio.sleep(2)
                        print("  >>> Testing resume ...")
                        await ws.send(json.dumps({"cmd": "resume"}))
                        print()

                    if frame["tick"] == 8:
                        print("\n  >>> Testing water_drop at (50, 50) r=5 ...")
                        await ws.send(json.dumps({"cmd": "water_drop", "x": 50, "y": 50, "radius": 5}))

                    if frame["tick"] == 10:
                        print("\n  >>> Testing control_line (40,40) → (60,40) ...")
                        await ws.send(json.dumps({"cmd": "control_line", "x0": 40, "y0": 40, "x1": 60, "y1": 40}))

                    if frame["tick"] == 12:
                        print("\n  >>> Testing env update: 20m/s @ 90° ...")
                        await ws.send(json.dumps({"cmd": "env", "wind_speed": 20.0, "wind_dir": 90.0}))

                # ── Interact ──────────────────────────────────────────────────
                elif frame["type"] == "interact":
                    print(f"  ✓ [INTERACT] action={frame['action']} "
                          f"tick={frame['tick']} "
                          f"state_cells={len(frame['state'])}")
                    assert len(frame["state"]) == data["grid_size"] ** 2, "✗ interact state length mismatch"

                # ── Env ───────────────────────────────────────────────────────
                elif frame["type"] == "env":
                    print(f"  ✓ [ENV] wind={frame['wind_speed']}m/s @ {frame['wind_dir']}°")

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

    except websockets.exceptions.ConnectionRefusedError:
        print("✗ WebSocket connection refused — is the server running?")
    except websockets.exceptions.InvalidHandshake as e:
        print(f"✗ WebSocket handshake failed: {e}")

asyncio.run(test())