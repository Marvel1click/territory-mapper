'use client';

import { AccessibilitySettings } from '@/app/components/accessibility/AccessibilitySettings';
import { useAuth } from '@/app/hooks/useAuth';
import { 
  User, 
  Bell, 
  Shield, 
  Smartphone,
  Moon,
  Globe
} from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account, preferences, and accessibility options.
        </p>
      </div>

      {/* Profile Section */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">Profile</h2>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            <input
              type="text"
              defaultValue={user?.full_name || ''}
              className="w-full px-4 py-3 rounded-lg border border-input bg-background"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              defaultValue={user?.email || ''}
              disabled
              className="w-full px-4 py-3 rounded-lg border border-input bg-muted text-muted-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Phone</label>
            <input
              type="tel"
              className="w-full px-4 py-3 rounded-lg border border-input bg-background"
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Role</label>
            <input
              type="text"
              defaultValue={user?.role || 'publisher'}
              disabled
              className="w-full px-4 py-3 rounded-lg border border-input bg-muted text-muted-foreground capitalize"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
            Save Changes
          </button>
          <button className="px-6 py-2 border border-border rounded-lg font-medium hover:bg-accent transition-colors">
            Cancel
          </button>
        </div>
      </section>

      {/* Accessibility Section */}
      <AccessibilitySettings />

      {/* Notifications Section */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">Notifications</h2>
        </div>
        
        <div className="space-y-4">
          <label className="flex items-center justify-between p-4 bg-muted rounded-lg cursor-pointer">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Return Visit Reminders</p>
                <p className="text-sm text-muted-foreground">Get notified when return visits are due</p>
              </div>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-input text-primary" />
          </label>

          <label className="flex items-center justify-between p-4 bg-muted rounded-lg cursor-pointer">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Territory Due Alerts</p>
                <p className="text-sm text-muted-foreground">Reminders when territories are due back</p>
              </div>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-input text-primary" />
          </label>

          <label className="flex items-center justify-between p-4 bg-muted rounded-lg cursor-pointer">
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Quiet Hours</p>
                <p className="text-sm text-muted-foreground">Pause notifications during ministry hours</p>
              </div>
            </div>
            <input type="checkbox" className="w-5 h-5 rounded border-input text-primary" />
          </label>
        </div>
      </section>

      {/* Privacy Section */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">Privacy & Security</h2>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Do Not Call Encryption</p>
                <p className="text-sm text-muted-foreground">DNC addresses are encrypted (AES-256)</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm font-medium">
              Active
            </span>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Offline Mode</p>
                <p className="text-sm text-muted-foreground">Data stored locally on your device</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm font-medium">
              Enabled
            </span>
          </div>

          <button className="w-full p-4 text-left bg-muted rounded-lg hover:bg-accent transition-colors">
            <p className="font-medium">Change Password</p>
            <p className="text-sm text-muted-foreground">Update your account password</p>
          </button>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-destructive/5 rounded-xl border border-destructive/20 p-6">
        <h2 className="text-xl font-bold text-destructive mb-4">Danger Zone</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-background rounded-lg">
            <div>
              <p className="font-medium">Clear Local Data</p>
              <p className="text-sm text-muted-foreground">Remove all offline data from this device</p>
            </div>
            <button className="px-4 py-2 border border-destructive text-destructive rounded-lg hover:bg-destructive hover:text-destructive-foreground transition-colors">
              Clear Data
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
