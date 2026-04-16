# backend/data_processing/veg_mapping.py
"""Maps Bushfire Fuel Classification (BFC) codes to frontend vegetation type indices (1–24)."""

BFC_TO_VEG: dict[int, int] = {
    110: 3,   # Tall, closed forest       → Tall closed forest
    120: 6,   # Closed forest             → Closed forest
    210: 2,   # Tall open forest          → Tall open forest
    220: 5,   # Open forest               → Open forest
    230: 8,   # Low open forest           → Low open forest
    310: 21,  # Broadleaf plantation      → Plantation
    321: 21,  # Radiata pine              → Plantation
    322: 21,  # Maritime pine             → Plantation
    323: 21,  # Southern pine             → Plantation
    324: 21,  # Other conifer             → Plantation
    330: 21,  # Other plantation          → Plantation
    411: 1,   # Tall woodland grassy      → Tall woodland
    421: 4,   # Woodland shrubby          → Woodland
    422: 4,   # Woodland spinifex         → Woodland
    423: 4,   # Woodland grassy           → Woodland
    424: 4,   # Woodland with sparse      → Woodland
    431: 7,   # Low woodland shrubby      → Low woodland
    432: 7,   # Low woodland spinifex     → Low woodland
    433: 7,   # Low woodland grassy       → Low woodland
    434: 7,   # Low woodland sparse       → Low woodland
    510: 9,   # Tall shrubland            → Tall shrubland
    520: 11,  # Shrubland                 → Shrubland
    531: 10,  # Open shrubland spinifex   → Open shrubland
    532: 10,  # Open shrubland grassy     → Open shrubland
    533: 10,  # Open shrubland sparse     → Open shrubland
    610: 17,  # Sedgeland                 → Sedgeland
    620: 13,  # Hummock grassland         → Hummock grassland
    631: 12,  # Grassland                 → Grassland
    632: 15,  # Open grassland            → Open grassland
    633: 14,  # Sparse grassland          → Sparse grassland
    640: 16,  # Croplands                 → Croplands
    700: 22,  # Horticulture              → Horticulture
    800: 19,  # Wetlands                  → Wetland
    910: 23,  # Water                     → Permanent water
    920: 20,  # WUI 1                     → Built-up
    930: 20,  # WUI 2                     → Built-up
    940: 20,  # WUI 3                     → Built-up
    950: 20,  # Built-up                  → Built-up
    960: 18,  # Bare ground               → Bare
}

DEFAULT_VEG_TYPE = 12  # Grassland — sensible fallback for unmapped codes


def bfc_to_veg(code: int) -> int:
    return BFC_TO_VEG.get(code, DEFAULT_VEG_TYPE)
