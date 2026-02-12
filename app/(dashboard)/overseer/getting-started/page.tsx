"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  MapPin,
  Users,
  QrCode,
  ArrowRight,
  ArrowLeft,
  FileText,
  Video,
  HelpCircle,
  Sparkles,
} from "lucide-react";

const steps = [
  {
    id: 1,
    title: "Create Your First Territory",
    description:
      "Start by creating a territory with a name and drawing its boundary on the map.",
    icon: MapPin,
    action: {
      label: "Create Territory",
      href: "/overseer/territories/new",
    },
    tips: [
      'Give your territory a descriptive name (e.g., "Main Street North")',
      "Draw the boundary carefully around the area you want to cover",
      "You can always edit the boundary later",
    ],
  },
  {
    id: 2,
    title: "Add Houses to Your Territory",
    description:
      "Import house addresses or add them manually to build your territory database.",
    icon: Users,
    action: {
      label: "Manage Territories",
      href: "/overseer/territories",
    },
    tips: [
      "Use the bulk import feature to add multiple addresses at once",
      "Each house will appear as a pin on the map",
      "You can update house details as you work the territory",
    ],
  },
  {
    id: 3,
    title: "Assign Territories to Publishers",
    description:
      "Use the assignments page to check out territories to publishers.",
    icon: Users,
    action: {
      label: "Go to Assignments",
      href: "/overseer/assignments",
    },
    tips: [
      "Select an available territory from the list",
      "Enter the publisher's name and set a due date",
      "Publishers will see their assigned territory in their dashboard",
    ],
  },
  {
    id: 4,
    title: "Generate QR Codes",
    description:
      "Create QR codes that publishers can scan to check out territories themselves.",
    icon: QrCode,
    action: {
      label: "Learn About QR Codes",
      href: "#qr-codes",
    },
    tips: [
      'Open any territory and click "Share QR"',
      "Download or share the QR code with publishers",
      "When scanned, publishers can instantly check out the territory",
    ],
  },
  {
    id: 5,
    title: "Track Progress",
    description:
      "Monitor territory progress and manage return visits from your dashboard.",
    icon: CheckCircle2,
    action: {
      label: "View Dashboard",
      href: "/overseer",
    },
    tips: [
      "See which territories are in stock, checked out, or pending",
      "Track publisher progress in real-time",
      "Get notifications for overdue territories",
    ],
  },
];

const faqs = [
  {
    question: "How do I edit a territory boundary?",
    answer:
      'Go to the territory list, click on the territory you want to edit, then click the "Edit" button. You can redraw the boundary on the map.',
  },
  {
    question: "What happens when a publisher checks out a territory?",
    answer:
      'The territory status changes to "out" and the publisher can see it in their "My Territory" page. They can mark houses as visited, not at home, interest, or do not call.',
  },
  {
    question: 'How do "Do Not Call" addresses work?',
    answer:
      "When a publisher marks a house as DNC, the address is encrypted for privacy. The house will show as red on the map and trigger a warning when the publisher is nearby.",
  },
  {
    question: "Can publishers use this offline?",
    answer:
      "Yes! Once a territory is checked out, all data is stored locally on the device. Publishers can work without internet and sync when they're back online.",
  },
  {
    question: "How do I track return visits?",
    answer:
      'When a publisher marks a house as "Return Visit" and sets a date, it appears in the Return Visits page. Both overseers and publishers can see upcoming return visits.',
  },
];

export default function GettingStartedPage() {
  const router = useRouter();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const toggleStep = (stepId: number) => {
    setCompletedSteps((prev) =>
      prev.includes(stepId)
        ? prev.filter((id) => id !== stepId)
        : [...prev, stepId],
    );
  };

  const progress = Math.round((completedSteps.length / steps.length) * 100);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push("/overseer")}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold">Getting Started</h1>
          </div>
          <p className="text-muted-foreground">
            Welcome to Territory Mapper! Follow these steps to set up your
            congregation.
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="font-medium">Setup Progress</span>
          <span className="text-sm text-muted-foreground">
            {completedSteps.length} of {steps.length} completed
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {progress === 100
            ? "🎉 Congratulations! You're all set up."
            : "Complete these steps to get the most out of Territory Mapper."}
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Setup Steps</h2>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = completedSteps.includes(step.id);

          return (
            <div
              key={step.id}
              className={`bg-card rounded-xl border transition-all ${
                isCompleted
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-border"
              }`}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  {/* Step Number / Checkbox */}
                  <button
                    onClick={() => toggleStep(step.id)}
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-bold">{index + 1}</span>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                      <h3
                        className={`font-semibold ${isCompleted ? "line-through text-muted-foreground" : ""}`}
                      >
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-muted-foreground mb-4">
                      {step.description}
                    </p>

                    {/* Tips */}
                    <div className="bg-muted/50 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium mb-2">Tips:</p>
                      <ul className="space-y-1">
                        {step.tips.map((tip, i) => (
                          <li
                            key={i}
                            className="text-sm text-muted-foreground flex items-start gap-2"
                          >
                            <span className="text-primary mt-1">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Action Button */}
                    <Link
                      href={step.action.href}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                    >
                      {step.action.label}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* QR Code Section */}
      <section
        id="qr-codes"
        className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20 p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <QrCode className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold">How QR Code Checkout Works</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-2">For Overseers:</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">1.</span>
                Open any territory and click &quot;Share QR&quot;
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">2.</span>
                Download the QR code image or share the link
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">3.</span>
                Print or display the QR code for publishers to scan
              </li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium mb-2">For Publishers:</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">1.</span>
                Scan the QR code with their phone camera
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">2.</span>
                Sign in (if not already)
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">3.</span>
                Confirm checkout and start working the territory!
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-card rounded-xl border border-border overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedFaq(expandedFaq === index ? null : index)
                }
                className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors"
              >
                <span className="font-medium">{faq.question}</span>
                <ArrowRight
                  className={`w-4 h-4 transition-transform ${expandedFaq === index ? "rotate-90" : ""}`}
                />
              </button>
              {expandedFaq === index && (
                <div className="px-4 pb-4">
                  <p className="text-muted-foreground">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Resources */}
      <section className="bg-muted/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Additional Resources</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <a
            href="#"
            className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
          >
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">Documentation</p>
              <p className="text-sm text-muted-foreground">
                Read the full user guide
              </p>
            </div>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
          >
            <Video className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">Video Tutorials</p>
              <p className="text-sm text-muted-foreground">
                Watch step-by-step guides
              </p>
            </div>
          </a>
        </div>
      </section>

      {/* CTA */}
      <div className="flex justify-center">
        <Link
          href="/overseer"
          className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
        >
          Go to Dashboard
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
