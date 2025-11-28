import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import googleIcon from '../assets/Social icon 2.svg';
import appleIcon from '../assets/Social icon.svg';

const Login = () => {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState({ type: null, message: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!email || !password) {
      setLoginError({ type: 'email', message: 'Please enter a valid email and password.' });
      return;
    }

    setIsLoading(true);
    setLoginError({ type: null, message: '' });

    try {
      const response = await login({ email, password, rememberMe });

      // If 2FA is required, navigate to 2FA verification page
      if (response.requires2FA) {
        navigate('/auth', {
          state: {
            userId: response.userId,
            tempToken: response.tempToken,
            email: email
          }
        });
        return;
      }

      // Navigate to home page after successful login
      navigate('/home');
    } catch (error) {
      console.error('Login error:', error);
      setLoginError({
        type: 'email',
        message: error.message || 'Invalid email or password. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    loginWithGoogle();
  };

  const handleAppleLogin = () => {
    // Apple login not implemented yet in backend
    console.log('Apple login not yet implemented');
  };

  return (
    <div style={{width: '100%', minHeight: '100vh', padding: '40px 20px', background: 'white', overflowY: 'auto', overflowX: 'hidden', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', display: 'flex'}}>
      <div style={{width: '100%', maxWidth: 'var(--container-max-width)', padding: 'var(--container-padding)', borderRadius: 16, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 32, display: 'flex'}}>
        <img style={{width: 66, height: 66, borderRadius: 100}} src={logo} alt="Logo" />
        <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'flex'}}>
          <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#32302C', fontSize: 30, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '40px', wordWrap: 'break-word'}}>Welcome Back!</div>
          <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px', wordWrap: 'break-word'}}>Keep your files safe. Ask questions. Get instant answers—only you have access.</div>
        </div>
        <form onSubmit={handleLogin} style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 20, display: 'flex'}}>
          <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
            <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex'}}>
              <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex'}}>
                <label style={{color: loginError.type === 'email' ? '#D92D20' : '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>Email</label>
                <div style={{
                  alignSelf: 'stretch',
                  height: 52,
                  paddingLeft: 18,
                  paddingRight: 18,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: '#F5F5F5',
                  overflow: 'hidden',
                  borderRadius: 14,
                  outline: loginError.type === 'email' ? '1px rgba(217, 45, 32, 0.40) solid' : '1px #E6E6EC solid',
                  outlineOffset: '-1px',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 8,
                  display: 'inline-flex'
                }}>
                  <div style={{flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'}}>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleLogin(e);
                        }
                      }}
                      placeholder="Enter your email"
                      style={{flex: '1 1 0', color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '24px', background: 'transparent', border: 'none', outline: 'none', width: '100%'}}
                    />
                  </div>
                </div>
                {loginError.type === 'email' && (
                  <div style={{color: '#D92D20', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>{loginError.message}</div>
                )}
              </div>
            </div>
          </div>
          <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
            <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex'}}>
              <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex'}}>
                <label style={{color: loginError.type === 'password' ? '#D92D20' : '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>Password</label>
                <div style={{
                  alignSelf: 'stretch',
                  height: 52,
                  paddingLeft: 18,
                  paddingRight: 18,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: '#F5F5F5',
                  overflow: 'hidden',
                  borderRadius: 14,
                  outline: loginError.type === 'password' ? '1px rgba(217, 45, 32, 0.40) solid' : '1px #E6E6EC solid',
                  outlineOffset: '-1px',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 8,
                  display: 'inline-flex'
                }}>
                  <div style={{flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'}}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleLogin(e);
                        }
                      }}
                      placeholder="••••••••"
                      style={{flex: '1 1 0', color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '24px', background: 'transparent', border: 'none', outline: 'none', width: '100%'}}
                    />
                  </div>
                  <div
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      width: 20,
                      height: 20,
                      position: 'relative',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9CA3AF'
                    }}>
                    {loginError.type === 'password' ? (
                      <div style={{width: 20, height: 20, position: 'relative', background: 'rgba(255, 255, 255, 0)', overflow: 'hidden'}}>
                          <div style={{width: 16.67, height: 16.67, left: 1.67, top: 1.67, position: 'absolute', outline: '1.67px #D92D20 solid', outlineOffset: '-0.83px'}} />
                      </div>
                    ) : showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    )}
                  </div>
                </div>
                {loginError.type === 'password' && (
                  <div style={{color: '#D92D20', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>{loginError.message}</div>
                )}
              </div>
            </div>
          </div>
          <div style={{alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex'}}>
            <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'}}>
              <div
                onClick={() => setRememberMe(!rememberMe)}
                style={{justifyContent: 'center', alignItems: 'center', display: 'flex', cursor: 'pointer'}}>
                <div style={{width: 20, height: 20, position: 'relative', background: rememberMe ? '#181818' : '#F5F5F5', borderRadius: 6, border: '1px #E6E6EC solid', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                  {rememberMe && <span style={{color: 'white', fontSize: 12}}>✓</span>}
                </div>
              </div>
              <div style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', textTransform: 'capitalize', lineHeight: '20px', wordWrap: 'break-word'}}>Remember for 30 days</div>
            </div>
            <Link to="/recover-access" style={{textDecoration: 'none'}}>
              <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
                <div style={{justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', cursor: 'pointer'}}>
                  <div style={{color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>Forgot Password?</div>
                </div>
              </div>
            </Link>
          </div>
        </form>
        <div style={{alignSelf: 'stretch', borderRadius: 12, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 24, display: 'flex'}}>
          <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, display: 'flex'}}>
            <button
              onClick={handleLogin}
              disabled={isLoading}
              style={{
                alignSelf: 'stretch',
                height: 52,
                borderRadius: 14,
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                display: 'inline-flex',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1
              }}>
              <div style={{flex: '1 1 0', height: 52, background: 'rgba(24, 24, 24, 0.90)', overflow: 'hidden', borderRadius: 14, justifyContent: 'center', alignItems: 'center', display: 'flex'}}>
                <div style={{color: 'white', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px', wordWrap: 'break-word'}}>
                  {isLoading ? 'Logging in...' : 'Log In'}
                </div>
              </div>
            </button>
            <div style={{alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center', gap: 6, display: 'inline-flex'}}>
              <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', textTransform: 'capitalize', lineHeight: '20px', wordWrap: 'break-word'}}>Don't have an account?</div>
              <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
                <div style={{justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', cursor: 'pointer'}}>
                  <Link to="/signup" style={{textDecoration: 'none'}}>
                    <div style={{color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>Sign Up</div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'inline-flex'}}>
          <div style={{flex: '1 1 0', height: 1, background: '#E6E6EC'}} />
          <div style={{textAlign: 'center', color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>OR</div>
          <div style={{flex: '1 1 0', height: 1, background: '#E6E6EC'}} />
        </div>
        <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, display: 'flex'}}>
          <button
            onClick={handleGoogleLogin}
            style={{alignSelf: 'stretch', height: 52, borderRadius: 14, justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex', border: 'none', cursor: 'pointer'}}>
            <div style={{flex: '1 1 0', height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: '#F5F5F5', overflow: 'hidden', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', gap: 12, display: 'flex'}}>
              <img src={googleIcon} alt="Google icon" />
              <div style={{color: '#323232', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', textTransform: 'capitalize', lineHeight: '24px', wordWrap: 'break-word'}}>Log in with Google</div>
            </div>
          </button>
          <button
            onClick={handleAppleLogin}
            style={{alignSelf: 'stretch', height: 52, borderRadius: 14, justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex', border: 'none', cursor: 'pointer'}}>
            <div style={{flex: '1 1 0', height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: '#F5F5F5', overflow: 'hidden', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', gap: 12, display: 'flex'}}>
              <img src={appleIcon} alt="Apple icon" />
              <div style={{color: '#323232', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', textTransform: 'capitalize', lineHeight: '24px', wordWrap: 'break-word'}}>Log in with Apple</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
