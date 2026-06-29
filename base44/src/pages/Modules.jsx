import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Building, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

function normTier(t) {
  const v = String(t || "").toLowerCase().trim();
  if (v === "exec" || v === "executive") return "exec";
  return "university";
}

function normTrack(t) {
  const v = String(t || "").toLowerCase().trim();
  if (v === "exec" || v === "executive" || v === "exec_only") return "exec";
  return "university";
}

function pickBestEnrollment(enrollments) {
  const list = Array.isArray(enrollments) ? enrollments : [];
  if (list.length === 0) return null;

  const active = list.filter((e) => (e?.status || "active") === "active");
  const activeExec = active.filter((e) => normTier(e?.tier) === "exec");
  if (activeExec.length > 0) return activeExec[0];
  if (active.length > 0) return active[0];
  return list[0];
}

export default function Modules() {
  const [user, setUser] = useState(null);
  const [tier, setTier] = useState("university");
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Remove once stable
  const [dbgMeId, setDbgMeId] = useState(null);
  const [dbgEnrollments, setDbgEnrollments] = useState([]);
  const [dbgPicked, setDbgPicked] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setErr(null);

      try {
        const me = await base44.auth.me();
        if (!mounted) return;

        setUser(me);
        setDbgMeId(me?.id || null);

        // Admin users see all modules - bypass enrollment check
        if (me.role === 'admin') {
          setTier('exec'); // Give admin full access
          const all = await base44.entities.Module.filter({ active: true });
          if (!mounted) return;
          all.sort((a, b) => {
            const ta = normTrack(a.track);
            const tb = normTrack(b.track);
            if (ta !== tb) return ta === "university" ? -1 : 1;
            return String(a.title || "").localeCompare(String(b.title || ""));
          });
          setModules(all);
          setLoading(false);
          return;
        }

        // Enrollment should store the real user id in user_id
        const enrollments = await base44.entities.Enrollment.filter({ user_id: me.id });
        if (!mounted) return;

        setDbgEnrollments(enrollments || []);

        const best = pickBestEnrollment(enrollments);
        setDbgPicked(best || null);

        const userTier = normTier(best?.tier);
        setTier(userTier);

        // Redirect exec-only users directly to Legacy Fund module
        if (userTier === 'exec' && best) {
          window.location.href = createPageUrl('ModulePage?id=legacy_fund');
          return;
        }

        // Load modules (prefer active:true if field exists)
        let all = [];
        try {
          all = await base44.entities.Module.filter({ active: true });
        } catch {
          all = await base44.entities.Module.list();
        }
        if (!mounted) return;

        const visible = (all || []).filter((m) => {
          const track = normTrack(m?.track);
          if (userTier === "exec") return true;
          return track === "university";
        });

        visible.sort((a, b) => {
          const ta = normTrack(a.track);
          const tb = normTrack(b.track);
          if (ta !== tb) return ta === "university" ? -1 : 1;
          return String(a.title || "").localeCompare(String(b.title || ""));
        });

        setModules(visible);
      } catch (e) {
        const msg =
          e?.message ||
          (typeof e === "string" ? e : null) ||
          JSON.stringify(e, null, 2) ||
          "Failed to load modules";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const tierLabel = useMemo(() => (tier === "exec" ? "Legacy user" : "University"), [tier]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Modules</h1>
            <div className="mt-1 text-sm text-slate-500">
              Logged in as <b>{user?.email || user?.name || "User"}</b> · Tier: <b>{tierLabel}</b>
            </div>
          </div>
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>

        {/* Optional debug panel - delete once stable */}
        <Card className="border border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Debug: Enrollment Resolution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><b>me.id:</b> {String(dbgMeId)}</div>
            <div><b>Enrollment rows returned:</b> {dbgEnrollments?.length || 0}</div>
            <pre className="bg-slate-100 p-3 rounded-md overflow-auto text-xs">
{JSON.stringify(dbgEnrollments, null, 2)}
            </pre>
            <div><b>Picked enrollment:</b></div>
            <pre className="bg-slate-100 p-3 rounded-md overflow-auto text-xs">
{JSON.stringify(dbgPicked, null, 2)}
            </pre>
          </CardContent>
        </Card>

        {err && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {modules.map((m) => {
            const track = normTrack(m.track);
            const isExecModule = track === "exec";
            const canAccess = tier === "exec" || !isExecModule;

            return (
              <Card key={m.id || m.module_id} className="border-slate-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${isExecModule ? "bg-amber-100" : "bg-indigo-100"}`}>
                        <Building className={`h-5 w-5 ${isExecModule ? "text-amber-600" : "text-indigo-600"}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{m.title}</CardTitle>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span>Engine: {m.engine_model_id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        className={isExecModule ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}
                        variant="secondary"
                      >
                        {isExecModule ? "Legacy" : "University"}
                      </Badge>
                      {!canAccess && (
                        <Badge variant="outline" className="text-slate-600">
                          <Lock className="h-3 w-3 mr-1" /> Locked
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm text-slate-600 line-clamp-2">
                      {m.description || "Open the module to run scenarios and review intermediate tables."}
                    </div>

                    <Link to={createPageUrl(`ModulePage?id=${encodeURIComponent(m.module_id)}`)}>
                      <Button disabled={!canAccess}>Open</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}