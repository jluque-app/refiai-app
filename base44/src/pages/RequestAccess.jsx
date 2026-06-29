import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertCircle, Building } from 'lucide-react';

export default function RequestAccess() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    requested_tier: 'university',
    reason: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Create access request
      await base44.entities.AccessRequest.create(formData);

      // Try to send notification email (will fail silently if setting not enabled)
      try {
        const settings = await base44.entities.AdminSettings.filter({ setting_key: 'email_notifications_enabled' });
        const notificationsEnabled = settings?.[0]?.setting_value === 'true';

        if (notificationsEnabled) {
          const emailSettings = await base44.entities.AdminSettings.filter({ setting_key: 'notification_email' });
          const notificationEmail = emailSettings?.[0]?.setting_value || 'jaime@allretech.org';

          const tierLabels = {
            university: 'University (Modules 1-4)',
            exec: 'Executive (All modules)',
            legacy: 'Legacy (Legacy Fund only)'
          };

          await base44.integrations.Core.SendEmail({
            to: notificationEmail,
            subject: `New Access Request - ${formData.full_name}`,
            body: `
A new access request has been submitted:

Name: ${formData.full_name}
Email: ${formData.email}
Access Type: ${tierLabels[formData.requested_tier]}
Reason: ${formData.reason}

Please review this request in the Admin Dashboard.
            `
          });
        }
      } catch (emailError) {
        console.log('Email notification failed:', emailError);
        // Continue anyway - request was still created
      }

      setSuccess(true);
      setFormData({ full_name: '', email: '', requested_tier: 'university', reason: '' });
    } catch (err) {
      setError(err?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border border-green-200 bg-white">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Request Submitted</h2>
              <p className="text-slate-600 mt-2">
                Thank you for your interest. An administrator will review your request and get back to you soon.
              </p>
            </div>
            <Button onClick={() => setSuccess(false)} variant="outline" className="mt-4">
              Submit Another Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full bg-white border border-slate-200">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-100">
              <Building className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">Request Access to ReFiAI</CardTitle>
              <CardDescription className="mt-1">
                Fill out the form below to request access to our real estate finance laboratory
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john.doe@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="requested_tier">Access Type *</Label>
              <Select
                value={formData.requested_tier}
                onValueChange={(value) => setFormData({ ...formData, requested_tier: value })}
              >
                <SelectTrigger id="requested_tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="university">
                    <div className="space-y-1">
                      <div className="font-medium">University Access</div>
                      <div className="text-xs text-slate-500">Access to Modules 1-4</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="exec">
                    <div className="space-y-1">
                      <div className="font-medium">Executive Access</div>
                      <div className="text-xs text-slate-500">Access to all modules</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="legacy">
                    <div className="space-y-1">
                      <div className="font-medium">Legacy User Access</div>
                      <div className="text-xs text-slate-500">Access to Legacy Fund module only</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Access</Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Tell us why you need access to ReFiAI..."
                rows={4}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={submitting} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}