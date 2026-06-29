from __future__ import annotations
from typing import Any, Dict

from refiai_engine.version import ENGINE_VERSION
from refiai_engine.fingerprint import fingerprint_inputs
from refiai_engine.registry import REGISTRY
from refiai_engine_api.schemas_v1 import ModelId, WarningMsg

def run_model(model_id: ModelId, inputs_dict: Dict[str, Any]) -> Dict[str, Any]:
    if model_id not in REGISTRY:
        raise ValueError(f"Unknown model_id: {model_id}")
    model_version, runner = REGISTRY[model_id]
    out = runner(inputs_dict) or {}

    warnings = out.get("warnings", [])
    warnings_norm = []
    for w in warnings:
        if isinstance(w, WarningMsg):
            warnings_norm.append(w.dict())
        elif isinstance(w, dict):
            warnings_norm.append(w)
        else:
            warnings_norm.append({"code":"WARNING","message":str(w),"severity":"warning","context":{}})

    return {
        "engine_version": ENGINE_VERSION,
        "model_id": model_id,
        "model_version": model_version,
        "input_fingerprint": fingerprint_inputs(inputs_dict),
        "warnings": warnings_norm,
        "scalars": out.get("scalars", {}),
        "tables": out.get("tables", {}),
        "series": out.get("series", {}),
    }
