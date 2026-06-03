import React, { useState, useRef, createContext, useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import './index.css';

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  
  const login = (newToken) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
  };
  
  const logout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };
  
  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });
      if (!res.ok) throw new Error('Invalid credentials');
      const data = await res.json();
      login(data.access_token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container glass-panel fade-in">
      <h2>Welcome Back</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Username</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
        </div>
        <div className="input-group">
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="btn-primary" style={{width: '100%'}}>Login</button>
      </form>
      <p style={{marginTop: '1rem', textAlign: 'center'}}>
        Don't have an account? <Link to="/register" style={{color: 'var(--primary)'}}>Register here</Link>
      </p>
    </div>
  );
}

function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        let errorMsg = 'Registration failed';
        if (res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          errorMsg = data.detail || errorMsg;
        } else {
          errorMsg = `Registration failed: ${res.statusText}`;
        }
        throw new Error(errorMsg);
      }
      navigate('/login');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container glass-panel fade-in">
      <h2>Create Account</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Username</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
        </div>
        <div className="input-group">
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="btn-primary" style={{width: '100%'}}>Register</button>
      </form>
      <p style={{marginTop: '1rem', textAlign: 'center'}}>
        Already have an account? <Link to="/login" style={{color: 'var(--primary)'}}>Login here</Link>
      </p>
    </div>
  );
}

function Generator() {
  const [word, setWord] = useState('');
  const [styleImage, setStyleImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState(null);
  const [error, setError] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const templates = [
    { id: 'vintage', name: '빈티지 편지', src: '/templates/vintage.png' },
    { id: 'wedding', name: '청첩장', src: '/templates/wedding.png' },
    { id: 'cute', name: '캐주얼 엽서', src: '/templates/cute.png' },
  ];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setStyleImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResultImage(null);
    }
  };

  const handleUploadClick = () => fileInputRef.current.click();

  const handleGenerate = async () => {
    if (!word || !styleImage) return;
    setIsGenerating(true);
    setError(null);
    setResultImage(null);

    const formData = new FormData();
    formData.append('word', word);
    formData.append('style_image', styleImage);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
            logout();
            navigate('/login');
            return;
        }
        throw new Error(`Generation failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResultImage(`data:image/png;base64,${data.image_base64}`);
    } catch (err) {
      console.error(err);
      setError('An error occurred during generation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadEcard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const templateObj = templates.find(t => t.id === selectedTemplate);
    
    const textImg = new window.Image();
    textImg.crossOrigin = 'anonymous';
    textImg.src = resultImage;
    
    textImg.onload = () => {
      if (templateObj) {
        const bgImg = new window.Image();
        bgImg.crossOrigin = 'anonymous';
        bgImg.src = templateObj.src;
        bgImg.onload = () => {
          canvas.width = bgImg.width;
          canvas.height = bgImg.height;
          ctx.drawImage(bgImg, 0, 0);
          
          const scale = Math.min(
            (canvas.width * 0.75) / textImg.width, 
            (canvas.height * 0.7) / textImg.height,
            1
          );
          const tw = textImg.width * scale;
          const th = textImg.height * scale;
          const tx = (canvas.width - tw) / 2;
          const ty = (canvas.height - th) / 2;
          ctx.drawImage(textImg, tx, ty, tw, th);
          
          const link = document.createElement('a');
          link.download = 'ecard.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
        };
      } else {
        canvas.width = textImg.width;
        canvas.height = textImg.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(textImg, 0, 0);
        const link = document.createElement('a');
        link.download = 'handwriting.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    };
  };

  return (
    <div className="fade-in">
      <div className="glass-panel">
        <div className="input-group">
          <label>단어 입력 (Word to generate)</label>
          <textarea 
            placeholder={"생성할 한글 단어를 입력하세요 (줄바꿈 가능)\n예: 동해물과 백두산이\n마르고 닳도록"} 
            value={word} 
            onChange={(e) => setWord(e.target.value)}
            rows={4}
            style={{ resize: 'vertical' }}
          />
        </div>
        <div className="input-group">
          <label>스타일 참조 이미지 (Style Reference)</label>
          <div className="upload-box" onClick={handleUploadClick}>
            <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileChange} />
            {!previewUrl ? (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--primary)', margin: '0 auto'}}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <p>클릭하여 이미지를 업로드하세요</p>
              </>
            ) : (
              <img src={previewUrl} alt="Style Preview" className="preview-image" style={{margin: '0 auto'}}/>
            )}
          </div>
        </div>

        <div className="template-selector">
          <label>💌 종이 배경 선택</label>
          <div className="template-grid">
            <div 
              className={`template-option-none ${selectedTemplate === null ? 'selected' : ''}`}
              onClick={() => setSelectedTemplate(null)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{color: 'var(--text-muted)'}}>
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="3" x2="21" y2="21"/>
              </svg>
              <span>배경 없음</span>
            </div>
            {templates.map(t => (
              <div 
                key={t.id} 
                className={`template-option ${selectedTemplate === t.id ? 'selected' : ''}`}
                onClick={() => setSelectedTemplate(t.id)}
              >
                <img src={t.src} alt={t.name} />
                <div className="template-label">{t.name}</div>
              </div>
            ))}
          </div>
        </div>

        <button className="btn-primary" onClick={handleGenerate} disabled={!word || !styleImage || isGenerating}>
          {isGenerating ? '생성 중...' : (selectedTemplate ? '💌 결과물 만들기' : '손글씨 생성하기')}
        </button>
        {error && <p className="error" style={{textAlign: 'center', marginTop: '1rem'}}>{error}</p>}
      </div>

      <canvas ref={canvasRef} style={{display: 'none'}} />

      {(isGenerating || resultImage) && (
        <div className="image-modal-overlay fade-in">
          <div className="image-modal-content" style={{textAlign: 'center', padding: '2rem'}}>
            {!isGenerating && (
              <span className="image-modal-close" onClick={() => { setResultImage(null); setIsGenerating(false); }} style={{top: '-40px', right: '0'}}>&times;</span>
            )}
            
            <h2 style={{marginBottom: '1.5rem'}}>{isGenerating ? '생성 중...' : (selectedTemplate ? '💌 엽서 완성!' : '생성 완료!')}</h2>
            
            {isGenerating ? (
              <div className="spinner" style={{margin: '2rem auto'}}></div>
            ) : (
              <div style={{background: 'transparent', padding: 0}}>
                {selectedTemplate ? (
                  <div className="ecard-preview">
                    <img src={templates.find(t => t.id === selectedTemplate)?.src} alt="Template" className="ecard-bg" />
                    <img src={resultImage} alt="Handwriting" className="ecard-text-overlay" />
                  </div>
                ) : (
                  <div className="result-image-container" style={{
                    backgroundColor: '#ffffff',
                    padding: '1rem',
                    borderRadius: '12px'
                  }}>
                    <img src={resultImage} alt="Generated text" className="result-image" style={{maxHeight: '60vh', boxShadow: 'none'}} />
                  </div>
                )}
                <div className="ecard-actions">
                  <button className="btn-primary" onClick={handleDownloadEcard} style={{width: 'auto', padding: '0.75rem 1.5rem'}}>
                    {selectedTemplate ? '📥 엽서 다운로드' : '📥 이미지 다운로드'}
                  </button>
                  <button className="btn-secondary" onClick={() => setResultImage(null)}>
                    확인
                  </button>
                </div>
                <p style={{marginTop: '1rem', color: '#a1a1aa', fontSize: '0.85rem'}}>이미지가 갤러리에 자동 저장되었습니다.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Gallery() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const res = await fetch('/api/gallery', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            if(res.status === 401) {
                logout();
                navigate('/login');
                return;
            }
            throw new Error('Failed to fetch gallery');
        }
        const data = await res.json();
        setImages(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchGallery();
  }, [token, navigate, logout]);

  if (loading) return <div className="spinner" style={{margin: '4rem auto'}}></div>;

  return (
    <div className="gallery-container fade-in">
      <h2 style={{textAlign: 'center', marginBottom: '2rem'}}>My Generation History</h2>
      {images.length === 0 ? (
        <div className="glass-panel" style={{textAlign: 'center', padding: '3rem'}}>
          <p style={{color: '#a1a1aa'}}>You haven't generated any images yet.</p>
          <Link to="/" className="btn-primary" style={{display: 'inline-block', marginTop: '1rem', textDecoration: 'none'}}>Generate Now</Link>
        </div>
      ) : (
        <div className="gallery-grid">
          {images.map(img => (
            <div key={img.id} className="gallery-item glass-panel" onClick={() => setSelectedImage(`data:image/png;base64,${img.image_base64}`)} style={{cursor: 'pointer'}}>
              <img src={`data:image/png;base64,${img.image_base64}`} alt={img.word} />
              <div className="gallery-info">
                <h3>{img.word}</h3>
                <span className="date">{new Date(img.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedImage && (
        <div className="image-modal-overlay fade-in" onClick={() => setSelectedImage(null)}>
          <div className="image-modal-content" onClick={e => e.stopPropagation()}>
            <span className="image-modal-close" onClick={() => setSelectedImage(null)}>&times;</span>
            <img src={selectedImage} alt="Full size result" />
          </div>
        </div>
      )}
    </div>
  );
}

function Layout() {
  const { token, logout } = useContext(AuthContext);
  
  return (
    <div className="app-container">
      <header className="main-header">
        <div className="logo" style={{textAlign: 'left', marginBottom: 0}}>
            <h1 style={{fontSize: '2rem', marginBottom: 0}}>OneDM Studio</h1>
            <p style={{fontSize: '0.9rem'}}>AI-powered Korean Handwriting</p>
        </div>
        {token && (
          <nav className="main-nav">
            <Link to="/" className="nav-link">Generate</Link>
            <Link to="/gallery" className="nav-link">Gallery</Link>
            <button onClick={logout} className="btn-outline">Logout</button>
          </nav>
        )}
      </header>
      <main className="main-content">
        <Routes>
          <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!token ? <Register /> : <Navigate to="/" />} />
          <Route path="/" element={token ? <Generator /> : <Navigate to="/login" />} />
          <Route path="/gallery" element={token ? <Gallery /> : <Navigate to="/login" />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout />
      </Router>
    </AuthProvider>
  );
}

export default App;
