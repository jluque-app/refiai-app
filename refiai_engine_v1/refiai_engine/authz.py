from __future__ import annotations
from typing import Dict
from refiai_engine_api.schemas_v1 import ModelId

EXEC_ONLY = {ModelId.barcelona_case_v1, ModelId.legacy_fund_v1}

def authorize_model(model_id: ModelId, claims: Dict) -> None:
    tier = (claims or {}).get("tier", "university")
    role = (claims or {}).get("role", "student")
    if role == "admin":
        return
    if model_id in EXEC_ONLY and tier != "exec":
        raise PermissionError(f"Forbidden: model '{model_id}' requires exec tier.")
