import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input } from '@/components/ui';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await resetPassword(email);

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFF]">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm bg-[#EEF2FF] border border-slate-200 p-8 rounded-3xl shadow-sm"
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-slate-700" />
            </div>
            <span className="text-lg font-bold text-slate-900">
              DevOS<span className="text-cyan-600">AI</span>
            </span>
          </Link>

          {!success ? (
            <>
              {/* Header */}
              <h1 className="text-3xl font-bold mb-2 text-slate-900">Reset password</h1>
              <p className="text-sm text-slate-600 mb-8">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-medium"
                  >
                    {error}
                  </motion.div>
                )}

                <div className="space-y-4">
                  <Input
                    type="email"
                    label="Email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" isLoading={loading} variant="primary" className="w-full h-11 font-semibold">
                  Send reset link
                  {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Check your email
              </h2>
              <p className="text-sm text-slate-600 mb-6">
                We've sent password reset instructions to <strong>{email}</strong>.
              </p>
            </div>
          )}

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-slate-500">
            Remember your password?{' '}
            <Link to="/login" className="font-semibold text-cyan-600 hover:text-cyan-700 transition-colors flex items-center justify-center gap-1 mt-2">
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </Link>
          </p>
        </motion.div>
      </div>

      <div className="hidden lg:flex flex-1 bg-slate-100 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-slate-200/60 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-cyan-100/60 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative max-w-lg text-slate-900"
        >
          <div className="bg-white p-10 rounded-[2rem] shadow-sm border border-slate-200">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
              <LayoutDashboard className="w-8 h-8 text-slate-700" />
            </div>
            <h2 className="text-3xl font-semibold mb-4 leading-tight">
              Your developer operating system
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              Connect GitHub, sync deployments, and manage your projects from one clean workspace.
            </p>
            <div className="space-y-3">
              {[
                'Connect GitHub repositories',
                'Monitor live deployments',
                'Build workflows with AI-led insights',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-slate-600">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
