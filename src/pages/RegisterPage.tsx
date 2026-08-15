import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input } from '@/components/ui';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [pendingVerification, setPendingVerification] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    const { error, needsEmailVerification } = await signUp(email, password, name);
    setLoading(false);

    if (error) {
      setError(error.message);
    } else if (needsEmailVerification) {
      setPendingVerification(true);
      setStep('verify');
    } else {
      setPendingVerification(false);
      setStep('verify');
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <div className="hidden lg:flex flex-1 bg-slate-100 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-slate-200 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-cyan-100 blur-3xl" />

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
            <h2 className="text-4xl font-bold mb-4 leading-tight">
              Start your developer operating system
            </h2>
            <p className="text-sm text-slate-600 mb-8">
              Join teams building faster workflow management with DevOS AI.
            </p>
            <div className="space-y-3">
              {[
                'Connect GitHub repositories',
                'Track deployments in real time',
                'Gain AI-driven insights',
                'Manage everything from one workspace',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3 text-sm text-slate-600">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700">✓</span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm bg-[#FFF4E8] border border-slate-200 p-8 rounded-3xl shadow-sm"
        >
          <Link to="/" className="flex items-center gap-2 mb-10">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-slate-700" />
            </div>
            <span className="text-lg font-bold text-slate-900">
              DevOS<span className="text-cyan-600">AI</span>
            </span>
          </Link>

          {step === 'form' ? (
            <>
              <h1 className="text-3xl font-bold mb-2 text-slate-900">Create account</h1>
              <p className="text-sm text-slate-600 mb-8">
                Get started building your developer workflow.
              </p>

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
                    type="text"
                    label="Name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />

                  <Input
                    type="email"
                    label="Email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                  <Input
                    type="password"
                    label="Password"
                    placeholder="8+ characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />

                  <Input
                    type="password"
                    label="Confirm password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" isLoading={loading} variant="primary" className="w-full h-11 font-semibold">
                  Create account
                  {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
                </Button>
              </form>

              <p className="mt-8 text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-cyan-600 hover:text-cyan-700 transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {pendingVerification ? 'Check your email' : 'Account created!'}
              </h2>
              <p className="text-sm text-slate-600 mb-6">
                {pendingVerification ? (
                  <>
                    We sent a verification link to <strong>{email}</strong>. After you verify, sign in and your profile will be saved automatically.
                  </>
                ) : (
                  'Welcome to DevOS AI. Redirecting to your dashboard...'
                )}
              </p>
              {!pendingVerification && (
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2 }}
                    className="h-full bg-cyan-600 rounded-full"
                  />
                </div>
              )}
              {pendingVerification && (
                <Link to="/login">
                  <Button variant="secondary" className="mt-4 w-full">
                    Go to sign in
                  </Button>
                </Link>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
