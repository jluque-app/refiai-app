from __future__ import annotations
import hashlib, json
from typing import Any, Dict

def _normalize(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _normalize(obj[k]) for k in sorted(obj.keys())}
    if isinstance(obj, list):
        return [_normalize(x) for x in obj]
    if isinstance(obj, float):
        return float(f"{obj:.12g}")
    return obj

def fingerprint_inputs(inputs: Dict[str, Any]) -> str:
    payload = json.dumps(_normalize(inputs), separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()
