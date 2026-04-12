import numpy as np
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.preprocess_scenarios import map_fuel_codes_to_veg_ids


def test_wui_codes_map_to_wui_classification():
    codes = np.array([[920, 930, 940, 950]], dtype=np.int32)
    veg = map_fuel_codes_to_veg_ids(codes)
    assert veg.tolist() == [[24, 24, 24, 20]]
