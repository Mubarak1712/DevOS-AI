import { motion } from 'framer-motion';
import { Mail, Github, MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui';

const contactMethods = [
  {
    icon: Mail,
    title: 'Email Support',
    description: 'For bug reports, feature requests, and general inquiries.',
    action: 'support@devos.ai',
    href: 'mailto:support@devos.ai',
  },
  {
    icon: Github,
    title: 'GitHub Issues',
    description: 'Report bugs or request features on GitHub.',
    action: 'Open an Issue',
    href: 'https://github.com',
  },
  {
    icon: MessageCircle,
    title: 'Feedback',
    description: 'Share your thoughts and suggestions.',
    action: 'Send Feedback',
    href: 'mailto:feedback@devos.ai',
  },
];

export function ContactPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Hero */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 mesh-bg" />
        <div className="relative section-container text-center max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-sm font-medium text-violet-600 uppercase tracking-wide mb-4">
              Contact
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-6">
              Get in touch
            </h1>
            <p className="text-lg text-neutral-600">
              Have a question or found a bug? Reach out and I'll get back to you as soon as possible.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="py-20 bg-white border-y border-surface-200">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <div className="space-y-6">
              {contactMethods.map((method, index) => (
                <motion.a
                  key={method.title}
                  href={method.href}
                  target={method.href.startsWith('http') ? '_blank' : undefined}
                  rel={method.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Card className="p-6 hover:shadow-card-hover hover:-translate-y-0.5 transition-all cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <method.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-neutral-900">
                          {method.title}
                        </h3>
                        <p className="text-neutral-600">
                          {method.description}
                        </p>
                      </div>
                      <span className="text-violet-600 font-medium">
                        {method.action}
                      </span>
                    </div>
                  </Card>
                </motion.a>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Response Time */}
      <section className="py-16">
        <div className="section-container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-card p-8 max-w-xl mx-auto"
          >
            <p className="text-neutral-600">
              Response times may vary. For general questions, check the
              <a href="/features" className="text-violet-600 hover:underline ml-1">
                features page
              </a>
              {' '}or the
              <a href="/about" className="text-violet-600 hover:underline ml-1">
                about page
              </a>
              {' '}for more information.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
