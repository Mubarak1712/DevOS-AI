import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Github,
  Rocket,
  Brain,
  FolderKanban,
  BarChart3,
  Bell,
  Shield,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui';

const coreFeatures = [
  {
    icon: Github,
    title: 'GitHub Integration',
    description: 'Connect your GitHub account to sync repositories, track commits, and monitor project health.',
    color: 'violet',
    details: [
      'OAuth-secured connection',
      'Automatic repository sync',
      'Commit and PR tracking',
      'Repository health scores',
    ],
  },
  {
    icon: Rocket,
    title: 'Deployment Monitoring',
    description: 'Track deployments across Vercel, Netlify, Render, and Railway from one dashboard.',
    color: 'coral',
    details: [
      'Multi-platform support',
      'Real-time status updates',
      'Deployment history',
      'Automatic sync',
    ],
  },
  {
    icon: Brain,
    title: 'AI Assistant',
    description: 'Get AI-powered insights and assistance for debugging, documentation, and code reviews.',
    color: 'cyan',
    details: [
      'Context-aware responses',
      'Code analysis',
      'Documentation generation',
      'Debugging assistance',
    ],
  },
  {
    icon: FolderKanban,
    title: 'Project Dashboard',
    description: 'Organize all your projects with status tracking, descriptions, and linked resources.',
    color: 'purple',
    details: [
      'Project organization',
      'Status tracking',
      'Linked repositories',
      'Activity timeline',
    ],
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description: 'View real metrics from your connected accounts. No fake data, only real insights.',
    color: 'teal',
    details: [
      'Real data from APIs',
      'Commit analytics',
      'Deployment metrics',
      'Activity trends',
    ],
  },
  {
    icon: Bell,
    title: 'Notifications',
    description: 'Stay informed about important events, deployment status, and project updates.',
    color: 'violet',
    details: [
      'Real-time alerts',
      'Configurable rules',
      'Activity feed',
      'Status updates',
    ],
  },
];

const colorMap: Record<string, { bg: string; text: string; gradient: string }> = {
  violet: { bg: 'bg-violet-100', text: 'text-violet-600', gradient: 'from-violet-500 to-purple-500' },
  coral: { bg: 'bg-coral-100', text: 'text-coral-600', gradient: 'from-coral-500 to-peach-500' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', gradient: 'from-cyan-500 to-teal-500' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', gradient: 'from-purple-500 to-violet-500' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-600', gradient: 'from-teal-500 to-cyan-500' },
};

export function FeaturesPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Hero */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 mesh-bg" />
        <div className="relative section-container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-sm font-medium text-violet-600 uppercase tracking-wide mb-4">
              Features
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-6">
              Built for developers
            </h1>
            <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-8">
              Connect your tools, sync your data, and manage everything from one place.
              No mock data, no fake metrics—just your real projects.
            </p>
            <Link to="/register">
              <Button>
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-20 bg-white border-y border-surface-200">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-neutral-900 mb-4">
              Core Capabilities
            </h2>
            <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
              Everything you need to manage your development workflow.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="feature-card"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${colorMap[feature.color].gradient} flex items-center justify-center mb-4`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-neutral-600 mb-4">
                  {feature.description}
                </p>
                <ul className="space-y-2">
                  {feature.details.map((detail) => (
                    <li key={detail} className="flex items-center gap-2 text-sm text-neutral-500">
                      <Shield className="w-3 h-3 text-success-500" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-card p-8 sm:p-12 max-w-4xl mx-auto"
          >
            <div className="flex items-start gap-6">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-neutral-900 mb-3">
                  Secure by Design
                </h3>
                <p className="text-neutral-600 mb-4">
                  All API tokens and credentials are stored securely using Supabase Edge Functions.
                  Your tokens never reach the client. OAuth connections use state parameter validation
                  to prevent CSRF attacks.
                </p>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {[
                    'Server-side token storage',
                    'OAuth 2.0 flow',
                    'State parameter validation',
                    'Encrypted connections',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-neutral-600">
                      <Zap className="w-4 h-4 text-violet-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-b from-surface-50 to-violet-50/30">
        <div className="section-container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-neutral-900 mb-4">
              Start using DevOS AI
            </h2>
            <p className="text-lg text-neutral-600 max-w-xl mx-auto mb-8">
              Connect your GitHub account and start tracking your projects today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register">
                <Button>
                  Create Account
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="secondary">
                  View Demo
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
