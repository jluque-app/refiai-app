from __future__ import annotations
from refiai_engine_api.schemas_v1 import ModelId
from refiai_engine.models import (
    module1_property_v1,
    module2_levered_returns_v1,
    module3_mortgage_lab_v1,
    module4_capital_stack_waterfall_v1,
    barcelona_case_v1,
    legacy_fund_v1,
)

REGISTRY = {
    ModelId.module1_property_v1: ("v1", module1_property_v1.run),
    ModelId.module2_levered_returns_v1: ("v1", module2_levered_returns_v1.run),
    ModelId.module3_mortgage_lab_v1: ("v1", module3_mortgage_lab_v1.run),
    ModelId.module4_capital_stack_waterfall_v1: ("v1", module4_capital_stack_waterfall_v1.run),
    ModelId.barcelona_case_v1: ("v1", barcelona_case_v1.run),
    ModelId.legacy_fund_v1: ("v1", legacy_fund_v1.run),
}
