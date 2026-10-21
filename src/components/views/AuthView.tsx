import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Eye, EyeOff, Heart, Image as ImageIcon, Loader2, LockKeyhole, LogOut, Mail, Music2, Play, User, X } from '../ui/Icon';
import { z } from 'zod';
import { authApi } from '../../services/authApi';
import { AuthUser } from '../../types';
import { KineticLogo } from '../KineticLogo';
import { AuthShowcase } from './AuthShowcase';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import './auth-view.css';

const signupFieldSchemas: Record<string, z.ZodType> = {
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name must be at most 50 characters'),
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30, 'Username must be at most 30 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores'),
  email: z.string().trim().email('Invalid email address').max(100, 'Email must be at most 100 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password must be at most 100 characters'),
};

const loginFieldSchemas: Record<string, z.ZodType> = {
  identifier: z.string().trim().min(1, 'Email or username is required').max(100, 'Identifier too long'),
  password: z.string().min(1, 'Password is required').max(100, 'Password too long'),
};

interface AuthViewProps {
  currentUser: AuthUser | null;
  onAuthSuccess: (user: AuthUser, isSignup: boolean) => void;
  onLogout: () => void;
  onNavigate: (tab: 'home') => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  currentUser,
  onAuthSuccess,
  onLogout,
  onNavigate,
}) => {
  const [isSignup, setIsSignup] = useState(false);
  const [panelIsSignup, setPanelIsSignup] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isFormContentVisible, setIsFormContentVisible] = useState(true);
  const [isReducedModeFade, setIsReducedModeFade] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [slowRequest, setSlowRequest] = useState(false);
  const [successUser, setSuccessUser] = useState<AuthUser | null>(null);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [shake, setShake] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const identifierInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const continueTimerRef = useRef<number | null>(null);
  const modeSwapTimersRef = useRef<number[]>([]);

  const validateField = (field: string, value: string, signup = isSignup) => {
    const schema = (signup ? signupFieldSchemas : loginFieldSchemas)[field];
    if (!schema) return '';
    const result = schema.safeParse(value);
    return result.success ? '' : result.error.issues[0]?.message || 'Invalid value';
  };

  const fieldValue = (field: string) => ({
    name,
    username,
    email,
    identifier: loginIdentifier,
    password,
  }[field] || '');

  const updateField = (field: string, value: string, update: (next: string) => void) => {
    update(value);
    if (fieldErrors[field]) {
      setFieldErrors((current) => ({ ...current, [field]: validateField(field, value) }));
    }
    if (field === 'email' || field === 'username') setErrorMsg(null);
  };

  const handleModeSwitch = () => {
    if (isLoading || isTransitioning || isSwapping) return;
    const nextSignup = !isSignup;
    if (isSignup) {
      setLoginIdentifier(email || username);
    } else if (loginIdentifier.includes('@')) {
      setEmail(loginIdentifier);
    } else if (loginIdentifier) {
      setUsername(loginIdentifier);
    }
    setIsSignup((current) => !current);
    setFieldErrors({});
    setTouched({});
    setErrorMsg(null);
    setPanelIsSignup(nextSignup);

    const desktopLayout = window.matchMedia('(min-width: 1024px)').matches;
    const desktopSlide = desktopLayout && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (desktopSlide) {
      setIsSwapping(true);
      setIsFormContentVisible(false);
      modeSwapTimersRef.current.push(window.setTimeout(() => {
        setIsSignup(nextSignup);
      }, 180));
      modeSwapTimersRef.current.push(window.setTimeout(() => {
        setIsFormContentVisible(true);
      }, 390));
      modeSwapTimersRef.current.push(window.setTimeout(() => {
        setIsSwapping(false);
        modeSwapTimersRef.current.push(window.setTimeout(() => {
          (nextSignup ? nameInputRef.current : identifierInputRef.current)?.focus();
        }, 270));
      }, 700));
      return;
    }

    setIsSignup(nextSignup);
    setIsFormContentVisible(true);
    if (desktopLayout) {
      setIsReducedModeFade(true);
      modeSwapTimersRef.current.push(window.setTimeout(() => setIsReducedModeFade(false), 200));
    }
    window.setTimeout(() => {
      (nextSignup ? nameInputRef.current : identifierInputRef.current)?.focus();
    }, 260);
  };

  useEffect(() => () => {
    if (continueTimerRef.current !== null) window.clearTimeout(continueTimerRef.current);
    modeSwapTimersRef.current.forEach(window.clearTimeout);
  }, []);

  const continueToHome = () => {
    if (continueTimerRef.current !== null) window.clearTimeout(continueTimerRef.current);
    if (successUser) onAuthSuccess(successUser, isSignup);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fields = isSignup ? ['name', 'username', 'email', 'password'] : ['identifier', 'password'];
    const nextErrors = Object.fromEntries(fields.map((field) => [field, validateField(field, fieldValue(field))]));
    setFieldErrors(nextErrors);
    setTouched(Object.fromEntries(fields.map((field) => [field, true])));
    if (Object.values(nextErrors).some(Boolean)) {
      const firstInvalid = fields.find((field) => nextErrors[field]);
      const refs: Record<string, React.RefObject<HTMLInputElement | null>> = {
        name: nameInputRef,
        identifier: identifierInputRef,
        password: passwordInputRef,
      };
      window.setTimeout(() => refs[firstInvalid || '']?.current?.focus(), 0);
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setSlowRequest(false);
    const slowTimer = window.setTimeout(() => setSlowRequest(true), 4000);

    try {
      let user: AuthUser;
      if (isSignup) {
        const res = await authApi.signup({ name: name.trim(), username: username.trim(), email: email.trim(), password });
        user = res.user;
      } else {
        const res = await authApi.login(loginIdentifier.trim(), password);
        user = res.user;
      }
      setSuccessUser(user);
      setIsTransitioning(true);
      window.setTimeout(() => {
        setIsSuccess(true);
        setIsTransitioning(false);
        continueTimerRef.current = window.setTimeout(() => onAuthSuccess(user, isSignup), 2200);
      }, 600);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      const lowered = message.toLowerCase();
      if (lowered.includes('email already in use')) {
        setFieldErrors((current) => ({ ...current, email: message }));
      } else if (lowered.includes('username taken')) {
        setFieldErrors((current) => ({ ...current, username: message }));
      } else {
        setErrorMsg(!isSignup && lowered.includes('credential') ? 'Email or username and password do not match.' : message);
      }
      setShake(true);
      window.setTimeout(() => setShake(false), 320);
    } finally {
      window.clearTimeout(slowTimer);
      setIsLoading(false);
      setSlowRequest(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (currentUser) {
    return (
      <div className="max-w-xl mx-auto py-10 space-y-6 animate-in fade-in">
        <div className="bg-[var(--raised)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <Avatar src={currentUser.avatarUrl} name={currentUser.name} size={96} className="mx-auto border-4 border-[var(--accent)] shadow-xl" />
          
          <div>
            <h2 className="text-2xl font-black text-[var(--text)] font-display">{currentUser.name}</h2>
            <p className="text-xs text-[var(--accent)] font-bold">@{currentUser.username}</p>
          </div>

          <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">{currentUser.bio}</p>

          <div className="grid grid-cols-2 gap-4 py-4 border-y border-[var(--border)] max-w-xs mx-auto">
            <div>
              <div className="text-lg font-bold text-[var(--text)]">{currentUser.followersCount}</div>
              <div className="text-[10px]  font-bold text-[var(--subtle)]">Followers</div>
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--text)]">{currentUser.followingCount}</div>
              <div className="text-[10px]  font-bold text-[var(--subtle)]">Following</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--like)]/15 hover:bg-[var(--like)]/25 text-[var(--danger)] font-bold text-xs border border-[var(--like)]/30 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </div>
      </div>
    );
  }

  const strength = [password.length >= 6, password.length >= 10, /[A-Z]/.test(password) && /[a-z]/.test(password), /\d|[^a-zA-Z0-9]/.test(password)].filter(Boolean).length;
  const showFieldError = (field: string) => touched[field] && fieldErrors[field];

  return (
    <main className="auth-page">
      <div className="auth-atmosphere" aria-hidden="true" />
      <button className="auth-back" type="button" onClick={() => onNavigate('home')}><ArrowRight size={15} /> Back to Kinetic</button>
      <span className="auth-sr-mode" aria-live="polite" aria-atomic="true">{panelIsSignup ? 'Sign up form' : 'Sign in form'}</span>
      <div className={`auth-stage ${shake ? 'auth-shake' : ''}`}>
        <AnimatePresence mode="wait">
          {isSuccess && successUser ? (
            <motion.section className="auth-success" key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="success-art" aria-hidden="true">
                <span className="success-orbit success-orbit-one"><Music2 size={18} /></span>
                <span className="success-orbit success-orbit-two"><Music2 size={18} /></span>
                <span className="success-orbit success-orbit-three"><Play size={16} fill="currentColor" /></span>
                <span className="success-orbit success-orbit-four"><Heart size={17} fill="currentColor" /></span>
                <span className="success-orbit success-orbit-five"><ImageIcon size={16} /></span>
                <span className="success-check"><svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="31" /><path d="m20 37 10 10 22-23" /></svg></span>
              </div>
              <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
                {isSignup ? `Welcome to Kinetic, ${successUser.name}!` : `Welcome back, ${successUser.name}!`}
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
                {isSignup ? 'Your account is ready. Continue to setup.' : 'Signing you in...'}
              </motion.p>
              <button className="auth-primary success-continue" onClick={continueToHome}>{isSignup ? 'Continue to setup' : 'Continue'} <ArrowRight size={16} /></button>
            </motion.section>
          ) : (
            <motion.div
              className={`auth-card ${isReducedModeFade ? 'auth-reduced-mode-fade' : ''}`}
              key="form-card"
              layout
              animate={{ opacity: isReducedModeFade ? 0.6 : 1 }}
              transition={{ layout: { duration: 0.28, ease: 'easeInOut' }, opacity: { duration: 0.15 } }}
            >
              <AuthShowcase
                isExiting={isTransitioning}
                isSignup={panelIsSignup}
                isSwapping={isSwapping}
                onModeSwitch={handleModeSwitch}
              >
                <motion.div
                  className="auth-panel-content"
                  animate={{ opacity: isFormContentVisible ? 1 : 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  inert={isSwapping}
                  aria-hidden={isSwapping}
                >
                  <header className="auth-form-head">
                    <span className="auth-chip"><span /> KINETIC</span>
                    <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
                    <p className="auth-switch-copy">
                      {isSignup ? 'Already have an account? ' : 'New here? '}
                      <button type="button" onClick={handleModeSwitch} disabled={isLoading || isSwapping}> {isSignup ? 'Sign in' : 'Create an account'}</button>
                    </p>
                  </header>

                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                  {errorMsg && <div role="alert" className="auth-alert"><X size={15} /> <span>{errorMsg}</span></div>}
                  <div className="auth-fields">
                    <AnimatePresence mode="wait" initial={false}>
                      {isSignup ? (
                        <motion.div className="auth-field-stack" key="signup" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                          <div className="auth-field">
                            <label htmlFor="auth-name">Full name</label>
                            <div className={`auth-input-wrap ${showFieldError('name') ? 'has-error' : ''}`}><input id="auth-name" ref={nameInputRef} name="name" autoComplete="name" value={name} disabled={isLoading} onChange={(e) => updateField('name', e.target.value, setName)} onBlur={() => { setTouched((current) => ({ ...current, name: true })); setFieldErrors((current) => ({ ...current, name: validateField('name', name) })); }} placeholder="Your name" aria-invalid={!!showFieldError('name')} aria-describedby={showFieldError('name') ? 'auth-name-error' : undefined} /><User size={17} /></div>
                            <FieldError id="auth-name-error" message={showFieldError('name') ? fieldErrors.name : ''} />
                          </div>
                          <div className="auth-field">
                            <label htmlFor="auth-username">Username</label>
                            <div className={`auth-input-wrap ${showFieldError('username') ? 'has-error' : ''}`}><input id="auth-username" name="username" autoComplete="username" value={username} disabled={isLoading} onChange={(e) => updateField('username', e.target.value, setUsername)} onBlur={() => { setTouched((current) => ({ ...current, username: true })); setFieldErrors((current) => ({ ...current, username: validateField('username', username) })); }} placeholder="Your username" aria-invalid={!!showFieldError('username')} aria-describedby={showFieldError('username') ? 'auth-username-error' : undefined} /><User size={17} /></div>
                            <FieldError id="auth-username-error" message={showFieldError('username') ? fieldErrors.username : ''} />
                          </div>
                          <div className="auth-field">
                            <label htmlFor="auth-email">Email address</label>
                            <div className={`auth-input-wrap ${showFieldError('email') ? 'has-error' : ''}`}><input id="auth-email" type="email" name="email" autoComplete="email" value={email} disabled={isLoading} onChange={(e) => updateField('email', e.target.value, setEmail)} onBlur={() => { setTouched((current) => ({ ...current, email: true })); setFieldErrors((current) => ({ ...current, email: validateField('email', email) })); }} placeholder="you@example.com" aria-invalid={!!showFieldError('email')} aria-describedby={showFieldError('email') ? 'auth-email-error' : undefined} /><Mail size={17} /></div>
                            <FieldError id="auth-email-error" message={showFieldError('email') ? fieldErrors.email : ''} />
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div className="auth-field-stack" key="login" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                          <div className="auth-field">
                            <label htmlFor="auth-identifier">Email or username</label>
                            <div className={`auth-input-wrap ${showFieldError('identifier') ? 'has-error' : ''}`}><input id="auth-identifier" ref={identifierInputRef} name="username" autoComplete="username" value={loginIdentifier} disabled={isLoading} onChange={(e) => updateField('identifier', e.target.value, setLoginIdentifier)} onBlur={() => { setTouched((current) => ({ ...current, identifier: true })); setFieldErrors((current) => ({ ...current, identifier: validateField('identifier', loginIdentifier) })); }} placeholder="Email or username" aria-invalid={!!showFieldError('identifier')} aria-describedby={showFieldError('identifier') ? 'auth-identifier-error' : undefined} /><User size={17} /></div>
                            <FieldError id="auth-identifier-error" message={showFieldError('identifier') ? fieldErrors.identifier : ''} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="auth-field">
                      <label htmlFor="auth-password">Password</label>
                      <div className={`auth-input-wrap ${showFieldError('password') ? 'has-error' : ''}`}><input id="auth-password" ref={passwordInputRef} type={showPassword ? 'text' : 'password'} name="password" autoComplete={isSignup ? 'new-password' : 'current-password'} value={password} disabled={isLoading} onChange={(e) => updateField('password', e.target.value, setPassword)} onBlur={() => { setTouched((current) => ({ ...current, password: true })); setFieldErrors((current) => ({ ...current, password: validateField('password', password) })); }} onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))} onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))} placeholder="Enter your password" aria-invalid={!!showFieldError('password')} aria-describedby={showFieldError('password') ? 'auth-password-error' : undefined} /><LockKeyhole size={17} /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} tabIndex={isLoading ? -1 : 0}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                      <FieldError id="auth-password-error" message={showFieldError('password') ? fieldErrors.password : ''} />
                      {capsLockOn && <p className="auth-caps">Caps Lock is on</p>}
                      {isSignup && <div className="password-strength" aria-label={`Password strength: ${strength} of 4`}><div className="strength-bars">{[0, 1, 2, 3].map((segment) => <span key={segment} className={segment < strength ? 'filled' : ''} />)}</div><span>{password ? ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][strength] : 'Use 6 or more characters'}</span></div>}
                    </div>
                  </div>
                  <Button className="auth-primary" type="submit" disabled={isLoading || isTransitioning}>
                    <span className={`auth-submit-label ${isLoading ? 'is-hidden' : ''}`}>{isSignup ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></span>
                    {isLoading && <Loader2 className="auth-spinner" size={19} aria-label="Signing in" />}
                  </Button>
                  {slowRequest && <p className="auth-slow" role="status">Getting things ready. The first load can take up to a minute.</p>}
                  {isSignup && <p className="auth-terms">By continuing you agree to the <span>Terms</span> and <span>Privacy Policy</span></p>}
                </form>
                </motion.div>
              </AuthShowcase>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
};

const FieldError: React.FC<{ id: string; message: string }> = ({ id, message }) => (
  <p id={id} className="auth-field-error" aria-live="polite">{message}</p>
);

