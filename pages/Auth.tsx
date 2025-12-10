
import React, { useState } from 'react';
import { login, register, sendPasswordReset } from '../services/auth';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Label } from '../components/ui';
import { Package, ArrowRight, Lock, Mail, Eye, EyeOff, KeyRound } from 'lucide-react';

export default function AuthPage() {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (view !== 'forgot' && (!email || !password)) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
        if (view === 'register') {
            if (password !== confirmPassword) {
                setError("Passwords do not match");
                setLoading(false);
                return;
            }
            await register(email, password);
        } else if (view === 'login') {
            await login(email, password);
        } else if (view === 'forgot') {
            if (!email) { setError("Please enter your email"); setLoading(false); return; }
            await sendPasswordReset(email);
            setSuccess("Password reset link sent to your email!");
            setLoading(false);
            return;
        }
    } catch (err: any) {
        let msg = "Authentication failed";
        if (err.code === 'auth/email-already-in-use') msg = "Email already registered";
        if (err.code === 'auth/invalid-credential') msg = "Invalid email or password";
        if (err.code === 'auth/weak-password') msg = "Password should be at least 6 characters";
        if (err.code === 'auth/user-not-found') msg = "No account found with this email";
        setError(msg);
    } finally {
        if (view !== 'forgot') setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {view === 'register' ? 'Create Account' : view === 'forgot' ? 'Reset Password' : 'Welcome Back'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {view === 'register' ? 'Setup your store admin profile' : view === 'forgot' ? 'Enter email to receive reset link' : 'Login to manage your inventory'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md text-center font-medium animate-in slide-in-from-top-2">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-100 text-green-700 text-sm p-3 rounded-md text-center font-medium animate-in slide-in-from-top-2">
                {success}
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="email"
                  className="pl-9" 
                  placeholder="name@example.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                />
              </div>
            </div>

            {view !== 'forgot' && (
                <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                    type={showPassword ? "text" : "password"} 
                    className="pl-9 pr-10" 
                    placeholder="Enter password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    />
                    <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-primary focus:outline-none"
                    >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
                </div>
            )}

            {view === 'register' && (
               <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label>Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type={showConfirmPassword ? "text" : "password"} 
                      className="pl-9 pr-10" 
                      placeholder="Re-enter password" 
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-primary focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
               </div>
            )}

            {view === 'login' && (
                <div className="flex justify-end">
                    <button type="button" onClick={() => setView('forgot')} className="text-xs text-primary hover:underline">
                        Forgot Password?
                    </button>
                </div>
            )}

            <Button type="submit" className="w-full h-11 text-base shadow-sm" disabled={loading}>
              {loading ? 'Processing...' : (view === 'register' ? 'Register Store' : view === 'forgot' ? 'Send Link' : 'Login')} 
              {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>

            <div className="text-center pt-2">
              <button 
                type="button" 
                className="text-sm text-primary hover:underline font-medium"
                onClick={() => { 
                    setView(view === 'login' ? 'register' : 'login'); 
                    setError(''); setSuccess(''); setPassword(''); setConfirmPassword(''); 
                }}
              >
                {view === 'login' ? "Don't have an account? Register" : "Back to Login"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
