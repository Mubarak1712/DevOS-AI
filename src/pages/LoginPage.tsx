import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input } from '@/components/ui';

export function LoginPage() {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(location.state?.error || '');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn(email, password);
      
      if (result.error) {
        setError(result.error.message);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      const e = err as Error;
      setError(e.message || 'An unexpected error occurred during sign in');
    } finally {
      setLoading(false);
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

          {/* Header */}
          <h1 className="text-3xl font-bold mb-2 text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-600 mb-8">
            Sign in to your DevOS AI workspace
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

              <div>
                <Input
                  type="password"
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <div className="flex justify-end mt-1">
                  <Link to="/forgot-password" className="text-sm font-medium text-cyan-600 hover:text-cyan-700 transition-colors">
                    Forgot password?
                  </Link>
                </div>
              </div>
            </div>

            <Button type="submit" isLoading={loading} variant="primary" className="w-full h-11 font-semibold">
              Sign in
              {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
            </Button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-cyan-600 hover:text-cyan-700 transition-colors">
              Create one for free
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
