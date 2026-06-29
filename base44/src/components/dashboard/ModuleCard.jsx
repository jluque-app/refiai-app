import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Building, TrendingUp, Wallet, Layers, MapPin, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const moduleIcons = {
  module1: Building,
  module2: TrendingUp,
  module3: Wallet,
  module4: Layers,
  barcelona: MapPin,
  legacy: Landmark,
};

function normTrack(t) {
  const v = String(t || '').toLowerCase().trim();
  if (v === 'exec' || v === 'executive' || v === 'exec_only') return 'exec';
  return 'university';
}

export default function ModuleCard({ module }) {
  const Icon = moduleIcons[module?.module_id] || Building;
  const track = normTrack(module?.track);
  const isExec = track === 'exec';

  const moduleId = encodeURIComponent(module?.module_id || '');

  return (
    <Link to={createPageUrl(`ModulePage?id=${moduleId}`)}>
      <Card className="group bg-white border border-slate-200/60 hover:border-indigo-300 hover:shadow-lg transition-all duration-200 cursor-pointer h-full">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${isExec ? 'bg-amber-50' : 'bg-indigo-50'} group-hover:scale-105 transition-transform`}>
                <Icon className={`h-6 w-6 ${isExec ? 'text-amber-600' : 'text-indigo-600'}`} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    {module?.title || 'Untitled Module'}
                  </h3>
                </div>

                <Badge
                  variant="secondary"
                  className={`text-xs ${isExec ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}
                >
                  {isExec ? 'Executive' : 'University'}
                </Badge>
              </div>
            </div>

            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
