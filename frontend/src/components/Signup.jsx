import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import googleIcon from '../assets/Social icon 2.svg';
import appleIcon from '../assets/Social icon.svg';
import hideIcon from '../assets/Hide.svg';

const SignUp = () => {
  const navigate = useNavigate();
  const { register, loginWithGoogle, setAuthState } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordCriteria, setPasswordCriteria] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  // Recovery key modal state
  const [showRecoveryKeyModal, setShowRecoveryKeyModal] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [hasConfirmedSaved, setHasConfirmedSaved] = useState(false);
  const [pendingResponse, setPendingResponse] = useState(null);

  useEffect(() => {
    const validations = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    setPasswordCriteria(validations);
  }, [password]);

  const handleSignUp = async (e) => {
    e.preventDefault();

    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!passwordCriteria.minLength || !passwordCriteria.hasUppercase || !passwordCriteria.hasLowercase || !passwordCriteria.hasNumber || !passwordCriteria.hasSpecialChar) {
      setError('Please meet all password requirements');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await register({ name, email, password });

      // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Check if recovery key was generated
      if (response.recoveryKey) {
        console.log('🔐 [Recovery] Recovery key received, showing modal');
        setRecoveryKey(response.recoveryKey);
        setPendingResponse(response);
        setShowRecoveryKeyModal(true);
        return;
      }

      // Check which flow the backend is using
      if (response.requiresVerification) {
        // Verification flow: navigate to authentication choice page
        navigate('/authentication', { state: { email: response.email } });
      } else if (response.user && response.accessToken) {
        // Direct creation flow: user is already created and logged in
        // Store tokens in localStorage
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('refreshToken', response.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.user));

        // Set auth state
        setAuthState(response.user);

        console.log('✅ User registered and logged in successfully');
        navigate('/home');
      } else {
        // Unknown response format
        console.error('Unexpected response format:', response);
        setError('Registration successful but unable to proceed. Please try logging in.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    loginWithGoogle();
  };

  const handleCopyRecoveryKey = () => {
    navigator.clipboard.writeText(recoveryKey);
  };

  const handleDownloadRecoveryKey = () => {
    const blob = new Blob([`KODA RECOVERY KEY\n\nThis is your account recovery key. Keep it safe and secure.\n\nRecovery Key:\n${recoveryKey}\n\nIMPORTANT:\n- This key allows you to recover your account if you forget your password\n- Store it in a secure location (password manager, encrypted vault, etc.)\n- Never share this key with anyone\n- KODA cannot recover your account without this key\n\nEmail: ${email}\nDate: ${new Date().toLocaleString()}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `koda-recovery-key-${email}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRecoveryKeyConfirmed = () => {
    if (!hasConfirmedSaved) {
      return;
    }

    setShowRecoveryKeyModal(false);

    // Continue with the registration flow
    if (pendingResponse.requiresVerification) {
      navigate('/authentication', { state: { email: pendingResponse.email } });
    } else if (pendingResponse.user && pendingResponse.accessToken) {
      localStorage.setItem('accessToken', pendingResponse.accessToken);
      localStorage.setItem('refreshToken', pendingResponse.refreshToken);
      localStorage.setItem('user', JSON.stringify(pendingResponse.user));
      setAuthState(pendingResponse.user);
      navigate('/home');
    } else {
      navigate('/authentication', { state: { email: pendingResponse.email } });
    }
  };

  const ValidationItem = ({ text, isValid }) => (
    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <div style={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        border: isValid ? 'none' : '1.5px solid #E6E6EC',
        background: isValid ? '#10B981' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {isValid && <span style={{color: 'white', fontSize: 10}}>✓</span>}
      </div>
      <div style={{color: isValid ? '#10B981' : '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500'}}>{text}</div>
    </div>
  );

  return (
    <div style={{width: '100%', minHeight: '100vh', padding: '40px 20px', background: 'white', overflowY: 'auto', overflowX: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
      <div style={{width: '100%', maxWidth: 'var(--container-max-width)', padding: 'var(--container-padding)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32}}>
        <img style={{width: 66, height: 66}} src={logo} alt="Logo" />
        
        <div style={{alignSelf: 'stretch', textAlign: 'center', flexDirection: 'column', gap: 12}}>
          <div style={{color: '#32302C', fontSize: 30, fontFamily: 'Plus Jakarta Sans', fontWeight: '600'}}>Create Your Account</div>
          <div style={{color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500'}}>Fill in the form to create your Koda account.</div>
        </div>

        <form onSubmit={handleSignUp} style={{alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 20}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            <label style={{fontWeight: '600', fontSize: 14}}>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" style={{height: 52, padding: '0 18px', background: '#F5F5F5', borderRadius: 14, border: '1px solid #E6E6EC', fontSize: 16}}/>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            <label style={{fontWeight: '600', fontSize: 14}}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" style={{height: 52, padding: '0 18px', background: '#F5F5F5', borderRadius: 14, border: '1px solid #E6E6EC', fontSize: 16}}/>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            <label style={{fontWeight: '600', fontSize: 14}}>Password</label>
            <div style={{display: 'flex', alignItems: 'center', height: 52, padding: '0 18px', background: '#F5F5F5', borderRadius: 14, border: '1px solid #E6E6EC'}}>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 16}}/>
              <img src={hideIcon} alt="Show/Hide" onClick={() => setShowPassword(!showPassword)} style={{cursor: 'pointer'}}/>
            </div>
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4}}>
            <ValidationItem text="At least 8 characters" isValid={passwordCriteria.minLength} />
            <ValidationItem text="One uppercase letter" isValid={passwordCriteria.hasUppercase} />
            <ValidationItem text="One lowercase letter" isValid={passwordCriteria.hasLowercase} />
            <ValidationItem text="One number" isValid={passwordCriteria.hasNumber} />
            <ValidationItem text="One special character (!@#$%^&*...)" isValid={passwordCriteria.hasSpecialChar} />
          </div>

          {error && <div style={{color: '#DC2626', background: '#FEE2E2', padding: '12px 16px', borderRadius: 8, marginTop: 8}}>{error}</div>}

          <button type="submit" disabled={isLoading} style={{height: 52, background: '#181818', color: 'white', borderRadius: 14, border: 'none', fontSize: 16, fontWeight: '600', cursor: 'pointer', marginTop: 12, opacity: isLoading ? 0.6 : 1}}>
            {isLoading ? 'Creating account...' : 'Continue'}
          </button>
        </form>

        <div style={{textAlign: 'center', fontSize: 14}}>
          <span style={{color: '#6C6B6E'}}>Already Have An Account? </span>
          <Link to="/login" style={{fontWeight: '700', color: '#181818', textDecoration: 'none'}}>Log In</Link>
        </div>

        <div style={{alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: 8}}>
          <div style={{flex: 1, height: 1, background: '#E6E6EC'}} />
          <span style={{color: '#6C6B6E'}}>OR</span>
          <div style={{flex: 1, height: 1, background: '#E6E6EC'}} />
        </div>

        <div style={{alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 16}}>
          <button onClick={handleGoogleSignUp} style={{height: 52, background: '#F5F5F5', borderRadius: 14, border: '1px solid #E6E6EC', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 16, fontWeight: '500'}}>
            <img src={googleIcon} alt="Google icon" />
            Sign Up with Google
          </button>
          <button style={{height: 52, background: '#F5F5F5', borderRadius: 14, border: '1px solid #E6E6EC', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 16, fontWeight: '500'}}>
            <img src={appleIcon} alt="Apple icon" />
            Sign Up with Apple
          </button>
        </div>

        <div style={{textAlign: 'center', fontSize: 14}}>
          <span style={{color: '#6C6B6E'}}>By creating an account, you agree to our </span>
          <Link to="/terms" style={{fontWeight: '600', color: '#181818', textDecoration: 'none'}}>Terms of Service</Link>
          <span style={{color: '#6C6B6E'}}> and </span>
          <Link to="/privacy" style={{fontWeight: '600', color: '#181818', textDecoration: 'none'}}>Privacy Policy</Link>.
        </div>
      </div>

      {/* Recovery Key Modal */}
      {showRecoveryKeyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: 20,
            padding: 32,
            maxWidth: 600,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            {/* Warning Icon */}
            <div style={{
              width: 64,
              height: 64,
              background: '#FEF3C7',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <span style={{ fontSize: 32 }}>⚠️</span>
            </div>

            {/* Title */}
            <h2 style={{
              fontSize: 24,
              fontWeight: '700',
              color: '#32302C',
              textAlign: 'center',
              marginBottom: 12
            }}>
              Save Your Recovery Key
            </h2>

            {/* Subtitle */}
            <p style={{
              fontSize: 16,
              color: '#6C6B6E',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 1.5
            }}>
              This is the ONLY way to recover your account if you forget your password. Store it securely.
            </p>

            {/* Recovery Key Display */}
            <div style={{
              background: '#F5F5F5',
              border: '2px solid #E6E6EC',
              borderRadius: 14,
              padding: 20,
              marginBottom: 20,
              fontFamily: 'monospace',
              fontSize: 14,
              wordBreak: 'break-all',
              color: '#32302C',
              position: 'relative'
            }}>
              {recoveryKey}
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: 12,
              marginBottom: 24
            }}>
              <button
                onClick={handleCopyRecoveryKey}
                style={{
                  flex: 1,
                  height: 48,
                  background: '#F5F5F5',
                  border: '1px solid #E6E6EC',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                📋 Copy
              </button>
              <button
                onClick={handleDownloadRecoveryKey}
                style={{
                  flex: 1,
                  height: 48,
                  background: '#F5F5F5',
                  border: '1px solid #E6E6EC',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                💾 Download
              </button>
            </div>

            {/* Warning Messages */}
            <div style={{
              background: '#FEF3C7',
              border: '1px solid #FDE68A',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20
            }}>
              <div style={{ fontSize: 14, color: '#92400E', lineHeight: 1.6 }}>
                <strong>Important:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                  <li>KODA uses zero-knowledge encryption - we cannot access your data</li>
                  <li>If you lose this key AND forget your password, your data is lost forever</li>
                  <li>Store this key in a password manager or secure location</li>
                  <li>Never share this key with anyone</li>
                </ul>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              cursor: 'pointer',
              marginBottom: 20
            }}>
              <input
                type="checkbox"
                checked={hasConfirmedSaved}
                onChange={(e) => setHasConfirmedSaved(e.target.checked)}
                style={{
                  width: 20,
                  height: 20,
                  marginTop: 2,
                  cursor: 'pointer'
                }}
              />
              <span style={{
                fontSize: 14,
                color: '#32302C',
                lineHeight: 1.5
              }}>
                I have saved my recovery key in a secure location and understand that I cannot recover my account without it.
              </span>
            </label>

            {/* Continue Button */}
            <button
              onClick={handleRecoveryKeyConfirmed}
              disabled={!hasConfirmedSaved}
              style={{
                width: '100%',
                height: 52,
                background: hasConfirmedSaved ? '#181818' : '#E6E6EC',
                color: hasConfirmedSaved ? 'white' : '#9CA3AF',
                borderRadius: 14,
                border: 'none',
                fontSize: 16,
                fontWeight: '600',
                cursor: hasConfirmedSaved ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              Continue to Verification
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignUp;
