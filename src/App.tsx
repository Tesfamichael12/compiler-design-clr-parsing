import { useState, useEffect, createContext, useContext } from 'react';
import { BookOpen, Play, Code2, Sun, Moon } from 'lucide-react';
import Theory from './pages/Theory';
import ParserLab from './pages/ParserLab';

type Tab = 'theory' | 'parser';

// Theme Context
const ThemeContext = createContext<{
  isDark: boolean;
  toggle: () => void;
}>({ isDark: true, toggle: () => {} });

export const useTheme = () => useContext(ThemeContext);

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('parser');
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggle = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{ 
          borderBottom: '1px solid var(--border)', 
          background: 'var(--bg-secondary)',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}>
          <div className="container" style={{ 
            height: '64px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                <Code2 size={20} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.2 }}>
                  CLR(1) Parser
                </h1>
                <p style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 500 }}>
                  Compiler Design
                </p>
              </div>
            </div>

            {/* Tabs + Theme Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* Tabs */}
              <div style={{ 
                display: 'flex', 
                gap: '4px',
                background: 'var(--bg-tertiary)',
                padding: '4px',
                borderRadius: '10px'
              }}>
                <TabButton 
                  active={activeTab === 'theory'} 
                  onClick={() => setActiveTab('theory')}
                  icon={<BookOpen size={16} />}
                  label="Theory"
                />
                <TabButton 
                  active={activeTab === 'parser'} 
                  onClick={() => setActiveTab('parser')}
                  icon={<Play size={16} />}
                  label="Parser"
                />
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggle}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container-wide" style={{ flex: 1, padding: '2rem 1.5rem' }}>
          {activeTab === 'theory' ? <Theory /> : <ParserLab />}
        </main>

        {/* Footer */}
        <footer style={{ 
          borderTop: '1px solid var(--border)', 
          background: 'var(--bg-secondary)',
          padding: '1.5rem 0'
        }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Compiler Design Project • AASTU
            </p>
          </div>
        </footer>
      </div>
    </ThemeContext.Provider>
  );
}

// Simple Tab Button Component
function TabButton({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: 500,
        transition: 'all 0.15s ease',
        background: active ? 'var(--bg-secondary)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export default App;
