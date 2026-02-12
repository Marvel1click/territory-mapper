import Link from "next/link";
import { MapPin, Shield, WifiOff, Accessibility } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center mb-8">
              <div className="p-4 bg-primary/10 rounded-2xl">
                <MapPin className="w-16 h-16 text-primary" />
              </div>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Territory Mapper
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Modern territory management for door-to-door ministry. 
              Works offline, protects privacy, and puts accessibility first.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Get Started
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-xl border-2 border-border hover:bg-accent transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-muted/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-16">
              Built for the Field
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard
                icon={<WifiOff className="w-8 h-8" />}
                title="Works Offline"
                description="Full functionality without internet. Your data stays on your device until you're back online."
              />
              <FeatureCard
                icon={<Shield className="w-8 h-8" />}
                title="Privacy First"
                description="Do Not Call addresses are encrypted. Congregation data is completely isolated."
              />
              <FeatureCard
                icon={<Accessibility className="w-8 h-8" />}
                title="Accessible Design"
                description="Big Mode for low vision, high contrast themes, and haptic feedback support."
              />
              <FeatureCard
                icon={<MapPin className="w-8 h-8" />}
                title="Smart Maps"
                description="Draw territory boundaries, track house visits, and get DNC proximity warnings."
              />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-16">
              How It Works
            </h2>
            
            <div className="space-y-12">
              <Step
                number={1}
                title="Overseer Creates Territories"
                description="Draw territory boundaries on the map, add house data, and manage assignments."
              />
              <Step
                number={2}
                title="Generate QR Codes"
                description="Create unique QR codes for each territory that publishers can scan to check out."
              />
              <Step
                number={3}
                title="Publishers Work Offline"
                description="Scan a QR code to download territory data. Track visits, take voice notes, all offline."
              />
              <Step
                number={4}
                title="Automatic Sync"
                description="When back on Wi-Fi, all changes sync automatically to the congregation database."
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="max-w-6xl mx-auto px-4 text-center text-muted-foreground">
          <p>© 2026 Territory Mapper. Built for the ministry.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 bg-card rounded-xl border border-border hover:shadow-lg transition-shadow">
      <div className="text-primary mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-6">
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
        {number}
      </div>
      <div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
