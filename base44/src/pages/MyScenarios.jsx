import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Copy, Play, Trash2, Clock, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import DataTable from '../components/ui/DataTable';
import KPICard from '../components/ui/KPICard';

export default function MyScenarios() {
  const urlParams = new URLSearchParams(window.location.search);
  const viewId = urlParams.get('view');
  
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [selectedTable, setSelectedTable] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: scenarios = [], isLoading } = useQuery({
    queryKey: ['scenarios', user?.id],
    queryFn: () => base44.entities.ScenarioRun.filter({ user_id: user?.id }, '-created_date'),
    enabled: !!user,
  });

  // Auto-select scenario from URL
  useEffect(() => {
    if (viewId && scenarios.length > 0) {
      const scenario = scenarios.find(s => s.id === viewId);
      if (scenario) setSelectedScenario(scenario);
    }
  }, [viewId, scenarios]);

  const deleteScenario = useMutation({
    mutationFn: (id) => base44.entities.ScenarioRun.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['scenarios']);
      setSelectedScenario(null);
    },
  });

  const handleDuplicate = async (scenario) => {
    await base44.entities.ScenarioRun.create({
      user_id: user.id,
      module_id: scenario.module_id,
      scenario_name: `${scenario.scenario_name} (Copy)`,
      inputs_json: scenario.inputs_json,
      outputs_json: scenario.outputs_json,
      input_fingerprint: scenario.input_fingerprint,
    });
    queryClient.invalidateQueries(['scenarios']);
  };

  const getOutputs = (scenario) => {
    try {
      return JSON.parse(scenario.outputs_json);
    } catch {
      return null;
    }
  };

  const outputs = selectedScenario ? getOutputs(selectedScenario) : null;
  const tableNames = outputs?.tables ? Object.keys(outputs.tables) : [];

  useEffect(() => {
    if (tableNames.length > 0 && !selectedTable) {
      setSelectedTable(tableNames[0]);
    }
  }, [tableNames, selectedTable]);

  const formatScalarLabel = (key) => {
    return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link to={createPageUrl('Dashboard')}>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            My Scenarios
          </h1>
          <p className="text-slate-500 mt-1">
            View, duplicate, and manage your saved scenario runs
          </p>
        </div>

        {/* Scenarios Table */}
        <Card className="bg-white border border-slate-200/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-slate-900">
              Saved Scenarios ({scenarios.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : scenarios.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">No scenarios saved yet</p>
                <Link to={createPageUrl('Modules')}>
                  <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700">
                    Explore Modules
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Module</TableHead>
                      <TableHead className="font-semibold">Created</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scenarios.map((scenario) => (
                      <TableRow key={scenario.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium">{scenario.scenario_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-100">
                            {scenario.module_id}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {format(new Date(scenario.created_date), 'MMM d, yyyy h:mm a')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedScenario(scenario);
                                setSelectedTable('');
                              }}
                            >
                              <Eye className="h-4 w-4 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDuplicate(scenario)}
                            >
                              <Copy className="h-4 w-4 text-slate-500" />
                            </Button>
                            <Link to={createPageUrl(`ModulePage?id=${scenario.module_id}`)}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Play className="h-4 w-4 text-slate-500" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={() => deleteScenario.mutate(scenario.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog open={!!selectedScenario} onOpenChange={() => setSelectedScenario(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {selectedScenario?.scenario_name}
              </DialogTitle>
            </DialogHeader>
            
            {outputs && (
              <div className="space-y-6 mt-4">
                {/* KPIs */}
                {outputs.scalars && Object.keys(outputs.scalars).length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                      Key Metrics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(outputs.scalars).slice(0, 8).map(([key, value]) => (
                        <KPICard key={key} label={formatScalarLabel(key)} value={value} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Tables */}
                {tableNames.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                        Data Tables
                      </h3>
                      <Select value={selectedTable} onValueChange={setSelectedTable}>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select a table" />
                        </SelectTrigger>
                        <SelectContent>
                          {tableNames.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedTable && outputs.tables[selectedTable] && (
                      <DataTable data={outputs.tables[selectedTable]} />
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}