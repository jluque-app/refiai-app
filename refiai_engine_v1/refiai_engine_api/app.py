from __future__ import annotations

from typing import Any, Dict

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from refiai_engine.authz import authorize_model
from refiai_engine.dispatcher import run_model
from refiai_engine.version import ENGINE_VERSION
from refiai_engine_api.schemas_v1 import (
    RunRequest, RunResponse, ErrorResponse, ModelId, MODEL_INPUT_SCHEMA
)

security = HTTPBearer(auto_error=False)
app = FastAPI(title="ReFiAI Engine API", version=ENGINE_VERSION)


def get_claims(creds: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    TODO: Replace with real JWT verification from Base44.
    Expected claims example: {"tier":"exec"|"university","role":"student"|"admin"}.
    """
    if creds is None:
        return {"tier": "university", "role": "student"}
    # Placeholder: treat any provided token as exec/admin
    return {"tier": "exec", "role": "admin"}


@app.get("/v1/models")
def list_models():
    return {
        "engine_version": ENGINE_VERSION,
        "models": [
            {"model_id": ModelId.module1_property_v1, "title": "Module 1 — Property-Level Valuation", "access": "both"},
            {"model_id": ModelId.module2_levered_returns_v1, "title": "Module 2 — Levered Returns", "access": "both"},
            {"model_id": ModelId.module3_mortgage_lab_v1, "title": "Module 3 — Mortgage Lab", "access": "both"},
            {"model_id": ModelId.module4_capital_stack_waterfall_v1, "title": "Module 4 — Waterfall Lab", "access": "both"},
            {"model_id": ModelId.barcelona_case_v1, "title": "Barcelona Case (Exec)", "access": "exec_only"},
            {"model_id": ModelId.legacy_fund_v1, "title": "Legacy Fund (Exec)", "access": "exec_only"},
        ],
    }


@app.post("/v1/run", response_model=RunResponse, responses={400: {"model": ErrorResponse}, 403: {"model": ErrorResponse}})
def run(req: RunRequest, claims: Dict[str, Any] = Depends(get_claims)):
    try:
        authorize_model(req.model_id, claims)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    schema = MODEL_INPUT_SCHEMA[req.model_id]
    try:
        parsed = schema.parse_obj(req.inputs)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"VALIDATION_ERROR: {e}")

    out = run_model(req.model_id, parsed.dict())

    inc = req.options.include
    if not inc.scalars:
        out["scalars"] = {}
    if not inc.tables:
        out["tables"] = {}
    if not inc.series:
        out["series"] = {}

    return RunResponse.parse_obj(out)
