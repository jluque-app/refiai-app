# ReFiAI Engine API (v1)

## Run locally
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn refiai_engine_api.app:app --reload --port 8000
```

Open:
- http://localhost:8000/v1/models
- POST http://localhost:8000/v1/run

## Docker
```bash
docker build -t refiai-engine:0.1.0 .
docker run --rm -p 8000:8000 refiai-engine:0.1.0
```

## Base44 integration
Call:
- `GET /v1/models` to populate module list
- `POST /v1/run` with `model_id` and `inputs` from the schemas in `refiai_engine_api/schemas_v1.py`.

Exec-only:
- `legacy_fund_v1`
- `barcelona_case_v1`
