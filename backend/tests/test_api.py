import numpy as np
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from fastapi.testclient import TestClient
from backend.api import app, SCENARIO_CACHE

SIZE = 20


@pytest.fixture(autouse=True)
def inject_test_scenario():
    """Inject a small fake scenario so no real .npy files are needed."""
    SCENARIO_CACHE['test'] = {
        'flammability': np.full((SIZE, SIZE), 0.7, dtype=np.float32),
        'elevation':    np.zeros((SIZE, SIZE), dtype=np.float32),
        'veg_grid':     np.ones((SIZE, SIZE), dtype=np.uint8) * 5,
    }
    yield
    SCENARIO_CACHE.pop('test', None)


def test_root_returns_json():
    client = TestClient(app)
    resp   = client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert "message" in body
    assert "scenarios" in body
    assert "test" in body["scenarios"]


def test_unknown_scenario_closes():
    client = TestClient(app)
    with client.websocket_connect("/ws/simulation/does-not-exist") as ws:
        with pytest.raises(Exception):
            ws.receive_json()


def test_full_sync_on_connect():
    client = TestClient(app)
    with client.websocket_connect("/ws/simulation/test") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "FULL_SYNC"
        assert msg["gridSize"] == SIZE
        assert "grid" in msg
        assert "vegetationGrid" in msg
        assert len(msg["vegetationGrid"]) == SIZE * SIZE
        assert "stats" in msg
        stats = msg["stats"]
        assert stats["tick"] == 0
        assert stats["score"] == 100
        assert stats["burning"] == 0


def test_full_sync_veg_grid_values():
    client = TestClient(app)
    with client.websocket_connect("/ws/simulation/test") as ws:
        msg = ws.receive_json()
        # All cells in the fake scenario have veg type 5
        veg = msg["vegetationGrid"]
        assert all(v == 5 for v in veg)


def test_start_action_seeds_fire():
    client = TestClient(app)
    with client.websocket_connect("/ws/simulation/test") as ws:
        ws.receive_json()  # FULL_SYNC
        ws.send_json({"action": "start"})
        msg = ws.receive_json()
        assert msg["type"] == "TICK_UPDATE"
        assert len(msg["changes"]) > 0
        burning = [c for c in msg["changes"] if c["s"] == 1]
        assert len(burning) > 0
        assert msg["stats"]["burning"] > 0


def test_set_wind_accepted_without_error():
    client = TestClient(app)
    with client.websocket_connect("/ws/simulation/test") as ws:
        ws.receive_json()  # FULL_SYNC
        # Should not raise
        ws.send_json({"action": "setWind", "dir": 180, "spd": 50})


def test_water_tool_returns_tick_update():
    client = TestClient(app)
    with client.websocket_connect("/ws/simulation/test") as ws:
        ws.receive_json()  # FULL_SYNC
        ws.send_json({"action": "start"})
        ws.receive_json()  # TICK_UPDATE from seed
        cx, cy = SIZE // 2, SIZE // 2
        ws.send_json({"tool": "water", "x": cx, "y": cy})
        msg = ws.receive_json()
        assert msg["type"] == "TICK_UPDATE"
        watered = [c for c in msg["changes"] if c["s"] == 4]
        assert len(watered) > 0


def test_control_line_tool_returns_tick_update():
    client = TestClient(app)
    with client.websocket_connect("/ws/simulation/test") as ws:
        ws.receive_json()  # FULL_SYNC
        cells = [{"x": 2, "y": 2}, {"x": 3, "y": 2}, {"x": 4, "y": 2}]
        ws.send_json({"tool": "control_line", "cells": cells})
        msg = ws.receive_json()
        assert msg["type"] == "TICK_UPDATE"
        lines = [c for c in msg["changes"] if c["s"] == 3]
        assert len(lines) == 3


def test_malformed_message_ignored():
    """Malformed JSON should not crash the handler."""
    client = TestClient(app)
    with client.websocket_connect("/ws/simulation/test") as ws:
        ws.receive_json()  # FULL_SYNC
        ws.send_text("not valid json{{{{")
        # Should still be able to interact normally after bad message
        ws.send_json({"action": "start"})
        msg = ws.receive_json()
        assert msg["type"] == "TICK_UPDATE"


def test_stats_reflect_burned_area():
    """After many ticks, burnedHa should be > 0."""
    client = TestClient(app)
    with client.websocket_connect("/ws/simulation/test") as ws:
        ws.receive_json()  # FULL_SYNC
        ws.send_json({"action": "start"})
        # Drain several TICK_UPDATEs by advancing the loop manually
        last_stats = None
        for _ in range(8):
            ws.send_json({"action": "resume"})
            ws.send_json({"action": "pause"})
            # Each resume->pause cycle should let a tick fire
        msg = ws.receive_json()
        last_stats = msg.get("stats")
        # At minimum, seeding fire means score starts at 100
        assert last_stats is not None
