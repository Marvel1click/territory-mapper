'use client';

import Link from 'next/link';
import { useAuth } from '@/app/hooks/useAuth';
import { 
  Map, 
  Users, 
  QrCode, 
  Settings,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  const isOverseer = user?.role === 'overseer' || user?.role === 'admin';

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">
          Welcome, {user?.full_name?.split(' ')[0] || 'Publisher'}
        </h1>
        <p className="text-muted-foreground">
          {isOverseer 
            ? 'Manage territories, assignments, and track progress.'
            : 'View your assigned territories and track your ministry.'
          }
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Map className="w-5 h-5" />}
          label={isOverseer ? "Total Territories" : "My Territories"}
          value={isOverseer ? "12" : "2"}
          trend="+2 this month"
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Active Publishers"
          value="8"
          trend="All active"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Pending Return Visits"
          value="5"
          trend="2 due this week"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Houses Visited"
          value="156"
          trend="+24 this week"
        />
      </div>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isOverseer ? (
            <>
              <ActionCard
                href="/overseer"
                icon={<Map className="w-6 h-6" />}
                title="Manage Territories"
                description="Create, edit, and view all congregation territories"
              />
              <ActionCard
                href="/overseer/assignments"
                icon={<Users className="w-6 h-6" />}
                title="Assignments"
                description="Assign territories to publishers and track checkouts"
              />
              <ActionCard
                href="/settings"
                icon={<Settings className="w-6 h-6" />}
                title="Settings"
                description="Configure congregation settings and preferences"
              />
            </>
          ) : (
            <>
              <ActionCard
                href="/publisher"
                icon={<Map className="w-6 h-6" />}
                title="My Territory"
                description="View and work on your assigned territory"
              />
              <ActionCard
                href="/publisher/return-visits"
                icon={<Clock className="w-6 h-6" />}
                title="Return Visits"
                description="Manage your scheduled return visits"
              />
              <ActionCard
                href="/settings"
                icon={<Settings className="w-6 h-6" />}
                title="Settings"
                description="Customize accessibility and app preferences"
              />
            </>
          )}
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            <ActivityItem
              icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
              title="Territory completed"
              description="Oak Street territory was marked as completed by John D."
              time="2 hours ago"
            />
            <ActivityItem
              icon={<QrCode className="w-5 h-5 text-blue-500" />}
              title="Territory checked out"
              description="Main Street North was checked out via QR code"
              time="5 hours ago"
            />
            <ActivityItem
              icon={<AlertCircle className="w-5 h-5 text-yellow-500" />}
              title="Return visit due"
              description="Sarah M. has a return visit due tomorrow at 3 PM"
              time="1 day ago"
            />
            <ActivityItem
              icon={<Map className="w-5 h-5 text-purple-500" />}
              title="New territory created"
              description="Pine Hills East was added to the congregation"
              time="2 days ago"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  trend 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  trend: string;
}) {
  return (
    <div className="p-4 bg-card rounded-xl border border-border">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{trend}</div>
    </div>
  );
}

function ActionCard({ 
  href, 
  icon, 
  title, 
  description 
}: { 
  href: string; 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 p-6 bg-card rounded-xl border border-border hover:border-primary/50 hover:shadow-md transition-all group"
    >
      <div className="p-3 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

function ActivityItem({ 
  icon, 
  title, 
  description, 
  time 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  time: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 hover:bg-accent/50 transition-colors">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
    </div>
  );
}
