import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Building, AlertCircle, Bug } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import InputForm from "../components/module/InputForm";
import ResultsPanel from "../components/module/ResultsPanel";
import SaveScenarioDialog from "../components/module/SaveScenarioDialog";

const ENGINE_BASE_URL = "https://refiai-engine.onrender.com";
const ENGINE_TIMEOUT_MS = 60000;

function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return JSON.stringify({ error: "Could not stringify object" });
  }
}

async function readErrorBody(response) {
  try {
    const j = await response.json();
    if (j?.detail) return String(j.detail);
    return safeJsonStringify(j);
  } catch {
    try {
      const t = await response.text();
      return t || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }
}

function safeParseJson(maybeJson, fallback = null) {
  if (!maybeJson) return fallback;
  if (typeof maybeJson === "object") return maybeJson;
  try {
    return JSON.parse(maybeJson);
  } catch {
    return fallback;
  }
}

function isEmptyEngineResults(data) {
  const s = data?.scalars || {};
  const t = data?.tables || {};
  const r = data?.series || {};
  return (
    data &&
    Object.keys(s).length === 0 &&
    Object.keys(t).length === 0 &&
    Object.keys(r).length === 0
  );
}

export default function ModulePage() {
  const moduleId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  }, []);

  const [user, setUser] = useState(null);
  const [module, setModule] = useState(null);
  const [moduleLoading, setModuleLoading] = useState(true);

  const [inputs, setInputs] = useState({});
  const [results, setResults] = useState(null);

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Debug UI
  const [debugOpen, setDebugOpen] = useState(false);
  const [lastPayload, setLastPayload] = useState(null);
  const [lastRawResponse, setLastRawResponse] = useState(null);

  // Load user
  useEffect(() => {
    let mounted = true;
    base44.auth
      .me()
      .then((u) => mounted && setUser(u))
      .catch(() => mounted && setUser(null));
    return () => {
      mounted = false;
    };
  }, []);

  // Load module
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setModuleLoading(true);
      setError(null);
      try {
        if (!moduleId) {
          mounted && setModule(null);
          return;
        }
        const rows = await base44.entities.Module.filter({ module_id: moduleId });
        mounted && setModule(rows?.[0] || null);
      } catch (e) {
        mounted && setError(e?.message || "Failed to load module");
        mounted && setModule(null);
      } finally {
        mounted && setModuleLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [moduleId]);

  const inputSchema = useMemo(() => {
    return safeParseJson(module?.input_schema_json, null);
  }, [module?.input_schema_json]);

  // Initialize inputs with schema defaults on first load of module
  useEffect(() => {
    if (!module) return;
    if (!inputSchema?.defaults) return;
    setInputs((prev) => {
      const hasAny = prev && Object.keys(prev).length > 0;
      return hasAny ? prev : inputSchema.defaults || {};
    });
  }, [module, inputSchema]);

  const runModel = async (providedInputs) => {
    console.log("[runModel] Starting engine call with inputs:", providedInputs);
    if (!module) {
      console.error("[runModel] No module loaded");
      return;
    }

    setIsRunning(true);
    setError(null);
    setResults(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);

    try {
      const inputsToUse = providedInputs || inputs || {};
      const payload = {
        model_id: module.engine_model_id,
        inputs: inputsToUse,
        options: { include: { scalars: true, tables: true, series: true } },
      };

      setLastPayload(payload);
      setLastRawResponse(null);

      console.log("[runModel] Sending payload to engine:", payload);

      const response = await fetch(`${ENGINE_BASE_URL}/v1/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      console.log("[runModel] Engine response status:", response.status);

      if (!response.ok) {
        const details = await readErrorBody(response);
        console.error("[runModel] Engine error:", details);
        setLastRawResponse(`HTTP ${response.status} ERROR:\n${details}`);
        throw new Error(`Engine error (${response.status}): ${details}`);
      }

      const rawText = await response.text();
      setLastRawResponse(rawText);

      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error("Engine returned non-JSON response.");
      }

      console.log("[runModel] Engine success, results:", data);

      // If engine “succeeds” but returns empty results, treat as integration error
      if (isEmptyEngineResults(data)) {
        throw new Error(
          "Engine returned an empty results object (scalars/tables/series are all empty). This usually means the deployed model is a stub/old version or it crashed and the wrapper swallowed the error. Check Render logs for the model execution and redeploy the correct legacy_fund_v1.py."
        );
      }

      setResults(data);
    } catch (err) {
      console.error("[runModel] Caught error:", err);
      if (err?.name === "AbortError") {
        setError(`Engine request timed out after ${ENGINE_TIMEOUT_MS / 1000}s`);
      } else {
        setError(err?.message || "Failed to run model");
      }
    } finally {
      clearTimeout(timeout);
      setIsRunning(false);
    }
  };

  const handleSaveScenario = async (scenarioName) => {
    if (!user) {
      setError("You must be logged in to save scenarios.");
      return;
    }
    if (!results) {
      setError("Run the model first before saving.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await base44.entities.ScenarioRun.create({
        user_id: user.id,
        module_id: moduleId,
        scenario_name: scenarioName,
        inputs_json: safeJsonStringify(inputs),
        outputs_json: safeJsonStringify(results),
        input_fingerprint: results?.input_fingerprint || "",
      });
      setSaveDialogOpen(false);
    } catch (e) {
      setError(e?.message || "Failed to save scenario");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setInputs(inputSchema?.defaults || {});
    setResults(null);
    setError(null);
  };

  if (moduleLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || "Module not found"}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Link to={createPageUrl("Modules")}>
              <Button variant="outline">Back to Modules</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isExec = module.track === "exec";

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link to={createPageUrl("Modules")}>
              <Button
                variant="ghost"
                size="sm"
                className="mb-2 -ml-2 text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Modules
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${isExec ? "bg-amber-100" : "bg-indigo-100"}`}>
                <Building className={`h-6 w-6 ${isExec ? "text-amber-600" : "text-indigo-600"}`} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                  {module.title}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="secondary"
                    className={isExec ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}
                  >
                    {isExec ? "Executive" : "University"}
                  </Badge>
                  <span className="text-sm text-slate-500">Engine: {module.engine_model_id}</span>
                </div>
              </div>
            </div>
          </div>

          <Button variant="outline" onClick={() => setDebugOpen((v) => !v)}>
            <Bug className="h-4 w-4 mr-2" />
            {debugOpen ? "Hide debug" : "Run debug"}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {debugOpen && (
          <Card className="border-slate-200">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold text-slate-800">Run debug</CardTitle>
              <div className="text-xs text-slate-500 mt-1">
                This section is for debugging while the engine + UI integration is stabilizing.
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-slate-500">Last payload</div>
              <pre className="text-xs p-3 bg-white border rounded-md overflow-auto max-h-64">
                {lastPayload ? JSON.stringify(lastPayload, null, 2) : "—"}
              </pre>

              <div className="text-xs text-slate-500">Last response (raw) — check for Python traceback</div>
              <pre className="text-xs p-3 bg-white border rounded-md overflow-auto max-h-96 whitespace-pre-wrap break-words">
                {lastRawResponse || "—"}
              </pre>

              <div className="text-xs text-slate-400 mt-2 space-y-1">
                <div>💡 <b>If you see "Load fail":</b> The engine couldn't load your model.</div>
                <div>→ Check <b>Render → your engine service → Logs</b> for the Python traceback.</div>
                <div>→ Common causes: missing exports (MODEL_ID, input_schema_json, DEFAULT_INPUTS, run), import errors, wrong function signature.</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* INPUTS */}
        <InputForm
          moduleId={module.module_id}
          schema={inputSchema}
          inputs={inputs}
          onChange={setInputs}
          onRun={runModel}
          onReset={handleReset}
          isLoading={isRunning}
        />

        {/* RESULTS */}
        <ResultsPanel
          moduleId={module.module_id}
          results={results}
          onSave={() => setSaveDialogOpen(true)}
          isSaving={isSaving}
        />

        <SaveScenarioDialog
          open={saveDialogOpen}
          onClose={() => setSaveDialogOpen(false)}
          onSave={handleSaveScenario}
          isLoading={isSaving}
        />
      </div>
    </div>
  );
}