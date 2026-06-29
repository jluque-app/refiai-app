import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Eye, Copy, Play, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function RecentScenarios({ scenarios, onDuplicate, onRerun }) {
  if (!scenarios || scenarios.length === 0) {
    return (
      <Card className="bg-white border border-slate-200/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-900">Recent Scenarios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            <Clock className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No scenarios saved yet</p>
            <p className="text-xs text-slate-400 mt-1">Run a module to save your first scenario</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-slate-200/60">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-slate-900">Recent Scenarios</CardTitle>
        <Link to={createPageUrl('MyScenarios')}>
          <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700">
            View all <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {scenarios.slice(0, 5).map((scenario) => (
          <div 
            key={scenario.id} 
            className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 hover:bg-slate-100/50 transition-colors group"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-900 truncate">{scenario.scenario_name}</p>
              <p className="text-xs text-slate-500">
                {scenario.module_id} • {format(new Date(scenario.created_date), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Link to={createPageUrl(`MyScenarios?view=${scenario.id}`)}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Eye className="h-4 w-4 text-slate-500" />
                </Button>
              </Link>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onDuplicate?.(scenario)}
              >
                <Copy className="h-4 w-4 text-slate-500" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onRerun?.(scenario)}
              >
                <Play className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}