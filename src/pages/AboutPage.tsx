import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Rocket, Code, Heart, ArrowRight, Github } from 'lucide-react';
import { Button } from '@/components/ui';

export function AboutPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Hero */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 mesh-bg" />
        <div className="relative section-container text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-sm font-medium text-violet-600 uppercase tracking-wide mb-4">
              About
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-6">
              Built by a developer,
              <br />
              <span className="gradient-text-violet">for developers</span>
            </h1>
            <p className="text-lg text-neutral-600">
              DevOS AI is a personal project created to solve a real problem:
              managing multiple projects across GitHub, Vercel, Netlify, Render, and Railway
              without losing track of what's deployed where.
            </p>
          </motion.div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 bg-white border-y border-surface-200">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-3xl font-bold text-neutral-900 mb-6">
              The problem
            </h2>
            <p className="text-lg text-neutral-600 mb-8">
              As a developer, you probably have projects scattered across multiple platforms.
              Remembering which project is deployed where, which deployment is live, and which
              repository belongs to which service becomes overwhelming.
            </p>
            <p className="text-lg text-neutral-600 mb-8">
              Each platform has its own dashboard. Its own notifications. Its own way of showing
              what's happening. You end up with 20 browser tabs just to check the status of
              your projects.
            </p>
            <div className="glass-card p-6 border-l-4 border-violet-500">
              <p className="text-neutral-700 font-medium">
                DevOS AI brings everything into one place—a single dashboard to see all your
                repositories, deployments, and project status at a glance.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="py-20">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-3xl font-bold text-neutral-900 mb-6">
              Design philosophy
            </h2>

            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <Code className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    No mock data
                  </h3>
                  <p className="text-neutral-600">
                    This isn't a demo pretending to be a product. Every piece of data you see
                    comes from your real connected accounts. If nothing is connected, you'll
                    see helpful empty states guiding you to set things up.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-coral-500 to-peach-500 flex items-center justify-center flex-shrink-0">
                  <Rocket className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    Practical features
                  </h3>
                  <p className="text-neutral-600">
                    Every feature exists because it solves a real problem. GitHub integration
                    to track repositories. Deployment monitoring to see what's live.
                    AI assistance to help with actual development tasks.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    Developer experience
                  </h3>
                  <p className="text-neutral-600">
                    The interface is designed to be clean, fast, and helpful. No clutter,
                    no confusing navigation, no unnecessary animations. Just the information
                    you need, presented clearly.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Open Source */}
      <section className="py-20 bg-gradient-to-b from-surface-50 to-violet-50/30">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-card p-8 sm:p-12 max-w-3xl mx-auto text-center"
          >
            <Github className="w-12 h-12 text-neutral-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">
              Built in the open
            </h2>
            <p className="text-neutral-600 mb-6">
              DevOS AI is developed iteratively, adding features based on real usage and feedback.
              The codebase uses modern technologies: React, TypeScript, Tailwind CSS, and Supabase.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register">
                <Button>
                  Try It Out
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/features">
                <Button variant="secondary">
                  View Features
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
