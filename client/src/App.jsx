import { useState, useEffect } from 'react';

function App() {
  const [apiStatus, setApiStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkApi = async () => {
      try {
        const response = await fetch('/api');
        const data = await response.json();
        setApiStatus(data);
      } catch (error) {
        setApiStatus({ error: 'API not connected' });
      } finally {
        setLoading(false);
      }
    };

    checkApi();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] font-sans">
      <div className="text-center p-12 bg-white/[0.03] rounded-3xl border border-white/10 backdrop-blur-lg shadow-2xl">
        <div className="text-7xl mb-4 animate-float">🦴</div>
        <h1 className="text-4xl font-bold text-white tracking-tight">FosssilProcure</h1>
        <p className="text-slate-400 text-lg mt-2 mb-8">MERN Stack Monorepo</p>
        
        <div className="bg-black/20 rounded-2xl py-6 px-8 my-6">
          <h2 className="text-sm uppercase tracking-widest text-slate-500 mb-4">API Status</h2>
          {loading ? (
            <div className="text-slate-400 italic">Connecting...</div>
          ) : apiStatus?.error ? (
            <div className="flex items-center justify-center gap-3 text-red-400 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_10px_#f87171] animate-pulse-glow"></span>
              {apiStatus.error}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 text-green-400 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_10px_#4ade80] animate-pulse-glow"></span>
              Connected - {apiStatus?.message}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-center flex-wrap mt-8">
          <span className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white py-2 px-4 rounded-full text-sm font-semibold tracking-wide">MongoDB</span>
          <span className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white py-2 px-4 rounded-full text-sm font-semibold tracking-wide">Express</span>
          <span className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white py-2 px-4 rounded-full text-sm font-semibold tracking-wide">React</span>
          <span className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white py-2 px-4 rounded-full text-sm font-semibold tracking-wide">Node.js</span>
        </div>
      </div>
    </div>
  );
}

export default App;
