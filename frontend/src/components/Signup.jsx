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

      // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Save recovery key silently (no modal)
      if (response.recoveryKey) {
        console.log('🔐 [Recovery] Recovery key received:', response.recoveryKey);
        // TODO: Consider adding recovery key to user profile or sending via email
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
    </div>
  );
};

export default SignUp;
