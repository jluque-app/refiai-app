import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from 'lucide-react';
import QuickStats from '../components/dashboard/QuickStats';
import ModuleCard from '../components/dashboard/ModuleCard';
import RecentScenarios from '../components/dashboard/RecentScenarios';

async function resolveEnrollmentForUser(currentUser) {
  // 1) Try the original filter (works if user_id is stored as a plain string)
  try {
    const byString = await base44.entities.Enrollment.filter({ user_id: currentUser.id });
    if (byString?.length) return byString[0];
  } catch (e) {
    // ignore
  }

  // 2) Fetch whatever RLS allows (usually only your own rows) and match client-side
  const rows = await base44.entities.Enrollment.filter({});
  const match = rows.find((r) => {
    const ref = r.user_id;
    const refId = (ref && typeof ref === 'object') ? ref.id : ref;
    return refId === currentUser.id;
  });

  return match || null;
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [enrollment, setEnrollment] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const currentUser = await base44.auth.me();
      if (!mounted) return;

      setUser(currentUser);

      // Admin users bypass enrollment - don't redirect
      if (currentUser.role === 'admin') {
        setEnrollment({ tier: 'exec', role: 'admin' }); // Grant full access
        return;
      }

      const enr = await resolveEnrollmentForUser(currentUser);
      if (!mounted) return;

      setEnrollment(enr);
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const userTier = useMemo(() => enrollment?.tier || 'university', [enrollment]);
  const userRole = useMemo(() => enrollment?.role || 'student', [enrollment]);

  // Redirect exec-only users (non-admin) directly to Legacy Fund module
  useEffect(() => {
    if (userTier === 'exec' && enrollment && user?.role !== 'admin') {
      window.location.href = createPageUrl('ModulePage?id=legacy_fund');
    }
  }, [userTier, enrollment, user]);

  const { data: modules = [], isLoading: modulesLoading } = useQuery({
    queryKey: ['modules', userTier],
    queryFn: async () => {
      const allModules = await base44.entities.Module.filter({ active: true });

      return allModules
        .filter(m => userTier === 'exec' || m.track === 'university')
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    },
    enabled: !!user,
  });

  const { data: scenarios = [], isLoading: scenariosLoading } = useQuery({
    queryKey: ['scenarios', user?.id],
    queryFn: () => base44.entities.ScenarioRun.filter({ user_id: user?.id }, '-created_date', 10),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user.full_name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-slate-500 mt-1">Your real estate finance laboratory awaits</p>
        </div>

        {/* Quick Stats */}
        <QuickStats
          tier={userTier}
          role={userRole}
          scenarioCount={scenarios.length}
          moduleCount={modules.length}
        />

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Modules Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Your Modules</h2>
              <Link to={createPageUrl('Modules')}>
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700">
                  View all <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>

            {modulesLoading ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {modules.slice(0, 6).map((module) => (
                  <ModuleCard key={module.id} module={module} />
                ))}
              </div>
            )}
          </div>

          {/* Recent Scenarios */}
          <div className="lg:col-span-1">
            <RecentScenarios
              scenarios={scenarios}
              onDuplicate={(s) => console.log('Duplicate', s)}
              onRerun={(s) => console.log('Rerun', s)}
              isLoading={scenariosLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}