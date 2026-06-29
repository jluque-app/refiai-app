import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Users, 
  BookOpen, 
  Activity, 
  AlertCircle,
  Shield,
  Settings,
  Database,
  UserPlus
} from 'lucide-react';

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [users, setUsers] = useState([]);
  const [modules, setModules] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [enrollments, setEnrollments] = useState([]);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteTier, setInviteTier] = useState('exec');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Access requests
  const [accessRequests, setAccessRequests] = useState([]);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [notificationEmail, setNotificationEmail] = useState('jaime@allretech.org');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (!mounted) return;
        
        setUser(currentUser);
        
        // Check if user is admin
        if (currentUser.role !== 'admin') {
          setIsAdmin(false);
          setLoading(false);
          return;
        }
        
        setIsAdmin(true);

        // Load admin data
        const [allUsers, allModules, allScenarios, allEnrollments, allRequests] = await Promise.all([
          base44.entities.User.list(),
          base44.entities.Module.list(),
          base44.entities.ScenarioRun.list('-created_date', 50),
          base44.entities.Enrollment.list(),
          base44.entities.AccessRequest.filter({ status: 'pending' }, '-created_date'),
        ]);

        // Load settings
        const settings = await base44.entities.AdminSettings.list();
        const emailSetting = settings.find(s => s.setting_key === 'email_notifications_enabled');
        const emailAddressSetting = settings.find(s => s.setting_key === 'notification_email');

        if (mounted) {
          setUsers(allUsers);
          setModules(allModules);
          setScenarios(allScenarios);
          setEnrollments(allEnrollments);
          setAccessRequests(allRequests || []);
          setEmailNotificationsEnabled(emailSetting?.setting_value !== 'false');
          setNotificationEmail(emailAddressSetting?.setting_value || 'jaime@allretech.org');
        }
      } catch (error) {
        console.error('Failed to load admin data:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => { mounted = false; };
  }, []);

  const handleInviteUser = async (e) => {
    e.preventDefault();
    setInviting(true);
    setInviteSuccess('');
    setInviteError('');

    try {
      // 1. Invite user (sends invitation email - user record created only when they accept)
      await base44.users.inviteUser(inviteEmail, 'user');

      // 2. Wait a bit and try to find the user (in case they already accepted)
      await new Promise(resolve => setTimeout(resolve, 2000));
      const allUsers = await base44.entities.User.list();
      const newUser = allUsers.find(u => u.email === inviteEmail);

      if (newUser) {
        // User already exists/accepted - create enrollment
        await base44.entities.Enrollment.create({
          user_id: newUser.id,
          role: 'student',
          tier: inviteTier,
          status: 'active'
        });
        setInviteSuccess(`Invitation sent to ${inviteEmail}. Enrollment created with ${inviteTier === 'exec' ? 'Legacy user' : 'University'} access.`);
      } else {
        // User hasn't accepted yet - just show success for invitation
        setInviteSuccess(`Invitation sent to ${inviteEmail}. Once they accept, create their enrollment manually with tier: ${inviteTier === 'exec' ? 'Legacy user' : 'University'}`);
      }
      
      setInviteEmail('');
      
      // Refresh data
      const [updatedUsers, updatedEnrollments] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.Enrollment.list(),
      ]);
      setUsers(updatedUsers);
      setEnrollments(updatedEnrollments);
    } catch (error) {
      setInviteError(error?.message || 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  };

  const handleToggleNotifications = async () => {
    setSavingSettings(true);
    try {
      const settings = await base44.entities.AdminSettings.filter({ setting_key: 'email_notifications_enabled' });
      const newValue = !emailNotificationsEnabled;
      
      if (settings?.length > 0) {
        await base44.entities.AdminSettings.update(settings[0].id, { setting_value: String(newValue) });
      } else {
        await base44.entities.AdminSettings.create({ 
          setting_key: 'email_notifications_enabled', 
          setting_value: String(newValue) 
        });
      }
      
      setEmailNotificationsEnabled(newValue);
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateNotificationEmail = async () => {
    setSavingSettings(true);
    try {
      const settings = await base44.entities.AdminSettings.filter({ setting_key: 'notification_email' });
      
      if (settings?.length > 0) {
        await base44.entities.AdminSettings.update(settings[0].id, { setting_value: notificationEmail });
      } else {
        await base44.entities.AdminSettings.create({ 
          setting_key: 'notification_email', 
          setting_value: notificationEmail 
        });
      }
    } catch (error) {
      console.error('Failed to update email:', error);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleApproveRequest = async (request) => {
    try {
      // Invite user
      await base44.users.inviteUser(request.email, 'user');
      
      // Mark request as approved
      await base44.entities.AccessRequest.update(request.id, {
        status: 'approved',
        processed_by: user.email,
        processed_date: new Date().toISOString()
      });
      
      // Refresh requests
      const updatedRequests = await base44.entities.AccessRequest.filter({ status: 'pending' }, '-created_date');
      setAccessRequests(updatedRequests || []);
      
      alert(`Invitation sent to ${request.email}. Create their enrollment with tier: ${request.requested_tier}`);
    } catch (error) {
      alert(`Failed to approve request: ${error?.message}`);
    }
  };

  const handleRejectRequest = async (request) => {
    try {
      await base44.entities.AccessRequest.update(request.id, {
        status: 'rejected',
        processed_by: user.email,
        processed_date: new Date().toISOString()
      });
      
      const updatedRequests = await base44.entities.AccessRequest.filter({ status: 'pending' }, '-created_date');
      setAccessRequests(updatedRequests || []);
    } catch (error) {
      alert(`Failed to reject request: ${error?.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
        <div className="max-w-3xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Access Denied. You must be an admin to view this page.
            </AlertDescription>
          </Alert>
          <div className="mt-6">
            <Link to={createPageUrl('Dashboard')}>
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Total Users', value: users.length, icon: Users, color: 'bg-blue-500' },
    { label: 'Active Modules', value: modules.filter(m => m.active).length, icon: BookOpen, color: 'bg-green-500' },
    { label: 'Pending Requests', value: accessRequests.length, icon: AlertCircle, color: 'bg-orange-500' },
    { label: 'Enrollments', value: enrollments.length, icon: Database, color: 'bg-amber-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-100">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-slate-500 mt-1">System overview and management</p>
          </div>
        </div>

        {/* Email Notification Settings */}
        <Card className="bg-white border border-slate-200/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Settings className="h-5 w-5 text-slate-600" />
              Email Notification Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Access Request Notifications</Label>
                <p className="text-xs text-slate-500 mt-1">
                  Receive email when someone requests access
                </p>
              </div>
              <Button
                variant={emailNotificationsEnabled ? "default" : "outline"}
                size="sm"
                onClick={handleToggleNotifications}
                disabled={savingSettings}
              >
                {emailNotificationsEnabled ? 'Enabled' : 'Disabled'}
              </Button>
            </div>

            {emailNotificationsEnabled && (
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="notification_email" className="text-sm">Notification Email</Label>
                <div className="flex gap-2">
                  <Input
                    id="notification_email"
                    type="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    placeholder="admin@example.com"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUpdateNotificationEmail}
                    disabled={savingSettings}
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Access Requests */}
        {accessRequests.length > 0 && (
          <Card className="bg-white border border-orange-200/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Pending Access Requests ({accessRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Email</TableHead>
                      <TableHead className="font-semibold">Access Type</TableHead>
                      <TableHead className="font-semibold">Reason</TableHead>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessRequests.map((req) => (
                      <TableRow key={req.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium">{req.full_name}</TableCell>
                        <TableCell className="text-slate-600">{req.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={
                            req.requested_tier === 'legacy' ? 'bg-amber-100 text-amber-700' :
                            req.requested_tier === 'exec' ? 'bg-purple-100 text-purple-700' :
                            'bg-indigo-100 text-indigo-700'
                          }>
                            {req.requested_tier === 'legacy' ? 'Legacy' :
                             req.requested_tier === 'exec' ? 'Executive' : 'University'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm max-w-xs truncate">
                          {req.reason || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApproveRequest(req)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectRequest(req)}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invite User Form */}
        <Card className="bg-white border border-slate-200/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-600" />
              Invite User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInviteUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tier">Access Tier</Label>
                  <Select value={inviteTier} onValueChange={setInviteTier}>
                    <SelectTrigger id="tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exec">Legacy user (Legacy Fund only)</SelectItem>
                      <SelectItem value="university">University (All modules)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {inviteSuccess && (
                <Alert className="bg-green-50 border-green-200">
                  <AlertDescription className="text-green-800">{inviteSuccess}</AlertDescription>
                </Alert>
              )}

              {inviteError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{inviteError}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={inviting} className="w-full md:w-auto">
                {inviting ? 'Sending invitation...' : 'Send Invitation'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="bg-white border border-slate-200/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-bold text-slate-900 mt-2">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.color} bg-opacity-10`}>
                    <stat.icon className={`h-5 w-5 ${stat.color.replace('bg-', 'text-')}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Users Table */}
        <Card className="bg-white border border-slate-200/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900">
              Users ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Role</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.slice(0, 10).map((u) => (
                    <TableRow key={u.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell className="text-slate-600">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {new Date(u.created_date).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Modules Table */}
        <Card className="bg-white border border-slate-200/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900">
              Modules ({modules.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="font-semibold">Title</TableHead>
                    <TableHead className="font-semibold">Module ID</TableHead>
                    <TableHead className="font-semibold">Track</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((m) => (
                    <TableRow key={m.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium">{m.title}</TableCell>
                      <TableCell className="text-slate-600">{m.module_id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={m.track === 'exec' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}>
                          {m.track === 'exec' ? 'Legacy' : 'University'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.active ? 'default' : 'outline'}>
                          {m.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Scenarios */}
        <Card className="bg-white border border-slate-200/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900">
              Recent Scenarios ({scenarios.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">User ID</TableHead>
                    <TableHead className="font-semibold">Module</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scenarios.slice(0, 10).map((s) => (
                    <TableRow key={s.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium">{s.scenario_name}</TableCell>
                      <TableCell className="text-slate-600 text-xs">{s.user_id.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{s.module_id}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {new Date(s.created_date).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}