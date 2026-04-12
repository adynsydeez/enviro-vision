import numpy as np
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.simulator import GridFireSimulation

SIZE = 20

def make_sim(wind_speed=10, wind_dir=45):
    flammability = np.full((SIZE, SIZE), 0.7, dtype=np.float32)
    elevation    = np.zeros((SIZE, SIZE), dtype=np.float32)
    veg_grid     = np.ones((SIZE, SIZE), dtype=np.uint8) * 5
    return GridFireSimulation(
        origin_lon=None, origin_lat=None, size_m=None,
        wind_speed=wind_speed, wind_dir=wind_dir,
        flammability=flammability, elevation=elevation, veg_grid=veg_grid,
    )


def test_pre_loaded_constructor_sets_grid_size():
    sim = make_sim()
    assert sim.size == SIZE
    assert sim.state.shape == (SIZE, SIZE)
    assert sim.flammability.shape == (SIZE, SIZE)


def test_pre_loaded_constructor_exposes_veg_grid():
    sim = make_sim()
    assert sim.veg_grid is not None
    assert sim.veg_grid.shape == (SIZE, SIZE)
    assert sim.veg_grid[0, 0] == 5


def test_seed_fire_returns_changes():
    sim = make_sim()
    changes = sim.seed_fire()
    assert len(changes) > 0
    for c in changes:
        assert c['s'] == 1
        assert 0 <= c['x'] < SIZE
        assert 0 <= c['y'] < SIZE


def test_seed_fire_ignites_center_cluster():
    sim = make_sim()
    sim.seed_fire()
    cy, cx = SIZE // 2, SIZE // 2
    assert sim.state[cy, cx] == 1


def test_step_returns_changes_list():
    sim = make_sim()
    sim.seed_fire()
    changes = sim.step()
    assert isinstance(changes, list)


def test_step_increments_tick():
    sim = make_sim()
    sim.seed_fire()
    assert sim.tick == 0
    sim.step()
    assert sim.tick == 1
    sim.step()
    assert sim.tick == 2


def test_step_changes_reference_actual_state():
    sim = make_sim()
    sim.seed_fire()
    for _ in range(10):
        changes = sim.step()
        # Each change must match the state at the moment the step was taken
        for c in changes:
            assert sim.state[c['y'], c['x']] == c['s']


def test_set_wind_clamps_speed():
    sim = make_sim()
    sim.set_wind(45, 150)
    assert sim.wind_speed == 100.0


def test_set_wind_normalises_direction():
    sim = make_sim()
    sim.set_wind(400, 20)
    assert sim.wind_dir == 40.0


def test_set_wind_negative_direction():
    sim = make_sim()
    sim.set_wind(-10, 20)
    assert sim.wind_dir == 350.0


def test_get_stats_initial_state():
    sim = make_sim()
    stats = sim.get_stats()
    assert stats['burning'] == 0
    assert stats['burned'] == 0
    assert stats['tick'] == 0
    assert stats['score'] == 100
    assert stats['burnedHa'] == 0.0


def test_get_stats_after_seed():
    sim = make_sim()
    sim.seed_fire()
    stats = sim.get_stats()
    assert stats['burning'] > 0
    assert stats['score'] == 100


def test_get_stats_wind_values():
    sim = make_sim(wind_speed=25, wind_dir=90)
    stats = sim.get_stats()
    assert stats['windDir'] == 90
    assert stats['windSpd'] == 25


def test_add_water_drop_returns_changes():
    sim = make_sim()
    sim.seed_fire()
    cx, cy = SIZE // 2, SIZE // 2
    changes = sim.add_water_drop(cx, cy, radius=2)
    assert len(changes) > 0
    for c in changes:
        assert c['s'] == 4
