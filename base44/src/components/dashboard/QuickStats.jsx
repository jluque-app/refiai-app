import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Briefcase } from 'lucide-react';

export default function QuickStats({ tier, role, scenarioCount, moduleCount }) {
  const TierIcon = tier === 'exec' ? Briefcase : GraduationCap;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 border-0">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <TierIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-indigo-100 font-medium">Access Tier</p>
              <p className="text-lg font-semibold text-white capitalize">{tier || 'University'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0">
        <CardContent className="p-5">
          <div>
            <p className="text-xs text-emerald-100 font-medium">Your Role</p>
            <p className="text-lg font-semibold text-white capitalize">{role || 'Student'}</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-white border border-slate-200">
        <CardContent className="p-5">
          <div>
            <p className="text-xs text-slate-500 font-medium">Saved Scenarios</p>
            <p className="text-2xl font-semibold text-slate-900">{scenarioCount}</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-white border border-slate-200">
        <CardContent className="p-5">
          <div>
            <p className="text-xs text-slate-500 font-medium">Available Modules</p>
            <p className="text-2xl font-semibold text-slate-900">{moduleCount}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}