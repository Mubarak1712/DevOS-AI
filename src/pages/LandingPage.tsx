import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Github,
  Rocket,
  Brain,
  ArrowRight,
  GitBranch,
  Activity,
  Layers,
  Terminal,
  Zap,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui';

function DevOsHeroVisual() {
  return (
    <div className="relative w-full max-w-lg mx-auto aspect-square">
      <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-violet-500/20 via-transparent to-cyan-500/15 blur-2xl" />
      <div className="relative dev-os-panel p-6 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-coral-400" />
          <div className="w-3 h-3 rounded-full bg-peach-400" />
          <div className="w-3 h-3 rounded-full bg-teal-400" />
          <span className="ml-auto text-[10px] font-mono text-surface-400">devos ~ workspace</span>
        </div>
        <div className="flex-1 space-y-3 font-mono text-xs">
          <div className="flex gap-2"><span className="text-violet-500">→</span><span className="text-surface-600">github sync</span><span className="text-teal-600 ml-auto">connected</span></div>
          <div className="flex gap-2"><span className="text-violet-500">→</span><span className="text-surface-600">deployments</span><span className="text-coral-500 ml-auto">monitoring</span></div>
          <div className="flex gap-2"><span className="text-violet-500">→</span><span className="text-surface-600">ai studio</span><span className="text-purple-500 ml-auto">ready</span></div>
          <div className="mt-4 p-3 rounded-xl bg-neutral-900 text-neutral-300 leading-relaxed">
            <span className="text-violet-400">const</span> workflow = [<br />
            &nbsp;&nbsp;<span className="text-cyan-400">'code'</span>, <span className="text-cyan-400">'ship'</span>, <span className="text-cyan-400">'observe'</span><br />
            ];
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { icon: Github, label: 'Repos', color: 'text-neutral-700' },
            { icon: Rocket, label: 'Deploy', color: 'text-coral-600' },
            { icon: Brain, label: 'AI', color: 'text-violet-600' },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-surface-50">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-[10px] text-surface-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkflowPipeline() {
  const steps = [
    { icon: Terminal, label: 'Write', desc: 'Your codebase' },
    { icon: GitBranch, label: 'Connect', desc: 'GitHub OAuth' },
    { icon: Rocket, label: 'Ship', desc: 'Track deployments' },
    { icon: Activity, label: 'Observe', desc: 'Health & analytics' },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {steps.map((step, i) => (
        <motion.div
          key={step.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08 }}
          className="relative dev-os-panel-hover p-5 text-center"
        >
          {i < steps.length - 1 && (
            <div className="hidden lg:block absolute top-1/2 -right-2 w-4 h-px bg-gradient-to-r from-violet-300 to-transparent" />
          )}
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white mb-3">
            <step.icon className="w-5 h-5" />
          </div>
          <h3 className="font-display font-bold text-neutral-900">{step.label}</h3>
          <p className="text-sm text-surface-500 mt-1">{step.desc}</p>
        </motion.div>
      ))}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Hero */}
      <section className="relative overflow-hidden dev-os-hero-grid">
        <div className="absolute inset-0 dev-os-shell opacity-80" />
        <div className="relative section-container pt-24 pb-20 sm:pt-32 sm:pb-28">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="dev-os-eyebrow mb-4">
                <Layers className="w-3.5 h-3.5" />
                Developer Operating System
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight text-neutral-900 leading-[1.1] text-balance">
                One workspace for{' '}
                <span className="gradient-text-violet">code, deploy, and ship</span>
              </h1>
              <p className="mt-6 text-lg text-surface-600 leading-relaxed max-w-xl">
                DevOS AI connects your GitHub repos, deployment platforms, and AI tools into a single command center — built for developers who juggle too many tabs.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/register">
                  <Button size="lg" className="w-full sm:w-auto">
                    Start building
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                    Sign in
                  </Button>
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-6 text-sm text-surface-500">
                {[
                  { icon: Shield, text: 'Secure OAuth' },
                  { icon: RefreshCw, text: 'Live sync' },
                  { icon: Zap, text: 'Real data only' },
                ].map(({ icon: Icon, text }) => (
                  <span key={text} className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-violet-500" />
                    {text}
                  </span>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="hidden lg:block"
            >
              <DevOsHeroVisual />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 border-y border-surface-200/80 bg-white/50">
        <div className="section-container max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="dev-os-eyebrow justify-center mb-4">The problem</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-neutral-900 mb-5">
              Your workflow is fragmented
            </h2>
            <p className="text-surface-600 leading-relaxed">
              Repositories on GitHub. Deployments on Vercel. Status checks in another tab. Context switching kills momentum — and nothing talks to each other unless you wire it up yourself.
            </p>
            <p className="mt-4 text-violet-700 font-semibold">
              DevOS AI is the layer that connects it all.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Capabilities — each visually distinct */}
      <section className="py-24">
        <div className="section-container space-y-16">
          {[
            {
              eyebrow: 'GitHub Intelligence',
              title: 'See every repo in context',
              body: 'OAuth connect, sync repositories, track activity and health. Filter by language, visibility, and last commit — all from your database, not mock data.',
              icon: Github,
              gradient: 'from-neutral-900 to-neutral-700',
              align: 'left' as const,
            },
            {
              eyebrow: 'Deployment Monitoring',
              title: 'Know what\'s live and what\'s not',
              body: 'Pull deployments from Vercel, Netlify, Render, and Railway. Health checks, SSL status, and environment tracking in one place.',
              icon: Rocket,
              gradient: 'from-coral-500 to-peach-500',
              align: 'right' as const,
            },
            {
              eyebrow: 'AI Productivity',
              title: 'An assistant that sounds like your team lead',
              body: 'Generate READMEs, docs, release notes, and project plans with context from your actual workspace — Groq or Gemini, whichever you configure.',
              icon: Brain,
              gradient: 'from-violet-500 to-purple-600',
              align: 'left' as const,
            },
          ].map((block, i) => (
            <motion.div
              key={block.eyebrow}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={`grid lg:grid-cols-2 gap-10 items-center ${block.align === 'right' ? 'lg:direction-rtl' : ''}`}
            >
              <div className={block.align === 'right' ? 'lg:direction-ltr lg:col-start-2' : ''}>
                <p className="dev-os-eyebrow mb-3">{block.eyebrow}</p>
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900 mb-4">{block.title}</h3>
                <p className="text-surface-600 leading-relaxed">{block.body}</p>
              </div>
              <div className={`dev-os-panel p-8 ${block.align === 'right' ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${block.gradient} flex items-center justify-center text-white shadow-premium`}>
                  <block.icon className="w-8 h-8" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="py-24 bg-gradient-to-b from-violet-50/40 to-surface-50">
        <div className="section-container">
          <div className="text-center mb-12">
            <p className="dev-os-eyebrow justify-center mb-3">Workflow</p>
            <h2 className="font-display text-3xl font-bold text-neutral-900">From idea to production</h2>
          </div>
          <WorkflowPipeline />
        </div>
      </section>

      {/* Platforms */}
      <section className="py-14 border-y border-surface-200/80">
        <div className="section-container text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-6">Integrates with</p>
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
            {['GitHub', 'Vercel', 'Netlify', 'Render', 'Railway', 'Groq', 'Gemini'].map((name) => (
              <span key={name} className="font-display font-semibold text-surface-400 hover:text-violet-600 transition-colors">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="dev-os-panel p-10 sm:p-14 text-center max-w-3xl mx-auto bg-gradient-to-br from-white via-violet-50/30 to-cyan-50/20"
          >
            <h2 className="font-display text-3xl font-bold text-neutral-900 mb-4">
              Build your developer OS
            </h2>
            <p className="text-surface-600 mb-8 max-w-lg mx-auto">
              Connect GitHub, sync deployments, and let AI help you ship. No fake metrics — just your real workspace.
            </p>
            <Link to="/register">
              <Button size="lg">
                Get started free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
