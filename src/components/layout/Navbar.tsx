import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  Menu,
  X,
  ChevronDown,
  LogOut,
  Settings,
  User,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';

const publicNav = [
  { label: 'Features', href: '/features' },
  { label: 'About', href: '/about' },
];

export function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const isDashboard = location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/projects') ||
    location.pathname.startsWith('/ideas') ||
    location.pathname.startsWith('/github') ||
    location.pathname.startsWith('/deployments') ||
    location.pathname.startsWith('/ai-studio') ||
    location.pathname.startsWith('/analytics') ||
    location.pathname.startsWith('/settings') ||
    location.pathname.startsWith('/profile') ||
    location.pathname.startsWith('/notifications') ||
    location.pathname.startsWith('/organization') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/integrations') ||
    location.pathname.startsWith('/config');


  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    if (!profileOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  const handleSignOut = async () => {
    setProfileOpen(false);
    await signOut();
    // Clear all React Query cache
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isDashboard
          ? 'bg-[#F8F4FF]/95 backdrop-blur-xl border-b border-[#E9D5FF] shadow-sm'
          : scrolled
          ? 'bg-[#F8F4FF]/90 backdrop-blur-xl shadow-sm'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-violet-500 flex items-center justify-center shadow-glow-violet group-hover:scale-105 transition-transform">
              <span className="font-display font-bold text-white text-sm">D</span>
            </div>
            <span className="font-display text-lg font-bold text-neutral-900">
              DevOS<span className="gradient-text-violet">AI</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          {!isDashboard && (
            <div className="hidden md:flex items-center gap-6">
              {publicNav.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'text-sm font-medium transition-colors',
                    location.pathname === item.href
                      ? 'text-violet-600'
                      : 'text-neutral-500 hover:text-neutral-900'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {!isDashboard && (
                  <Link to="/dashboard" className="btn-secondary text-sm py-2">
                    Dashboard
                  </Link>
                )}
                <div className="relative" ref={profileDropdownRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
                  >
                    <Avatar
                      src={user.user_metadata?.avatar_url}
                      alt={user.user_metadata?.name || user.email || 'User'}
                      size="sm"
                    />
                    <ChevronDown className={cn(
                      'w-4 h-4 text-neutral-400 transition-transform',
                      profileOpen && 'rotate-180'
                    )} />
                  </button>
                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-premium border border-surface-200 overflow-hidden"
                      >
                        <div className="p-3 border-b border-surface-200">
                          <p className="text-sm font-medium text-neutral-900">
                            {user.user_metadata?.name || 'User'}
                          </p>
                          <p className="text-xs text-neutral-500">{user.email}</p>
                        </div>
                        <div className="py-1">
                          <Link
                            to="/profile"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 hover:bg-surface-50"
                            onClick={() => setProfileOpen(false)}
                          >
                            <User className="w-4 h-4" />
                            Profile
                          </Link>
                          <Link
                            to="/settings"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 hover:bg-surface-50"
                            onClick={() => setProfileOpen(false)}
                          >
                            <Settings className="w-4 h-4" />
                            Settings
                          </Link>
                        </div>
                        <div className="border-t border-surface-200 py-1">
                          <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 px-3 py-2 w-full text-sm text-error-600 hover:bg-error-50"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary text-sm py-2">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg text-neutral-500 hover:bg-surface-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-surface-200"
          >
            <div className="px-4 py-4 space-y-2">
              {publicNav.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="block px-3 py-2 rounded-lg text-neutral-600 hover:bg-surface-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-surface-200">
                {user ? (
                  <>
                    <Link
                      to="/dashboard"
                      className="block px-3 py-2 rounded-lg text-neutral-600 hover:bg-surface-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2 w-full text-error-600"
                    >
                      <LogOut className="w-5 h-5" />
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="block px-3 py-2 text-neutral-600"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign in
                    </Link>
                    <Link
                      to="/register"
                      className="block btn-primary text-center mt-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
