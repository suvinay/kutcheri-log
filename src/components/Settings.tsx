import { useState } from 'react';
import { isAdmin, verifyAdminPassword, logoutAdmin } from '../services/admin';

interface Props {
  onClose: () => void;
  onAdminChange: () => void;
}

export function Settings({ onClose, onAdminChange }: Props) {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini-api-key') || '');
  const [githubPat, setGithubPat] = useState(localStorage.getItem('github-pat') || '');
  const [saved, setSaved] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState(false);
  const [admin, setAdmin] = useState(isAdmin());
  const [showPass, setShowPass] = useState(false);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini-api-key', apiKey.trim());
    } else {
      localStorage.removeItem('gemini-api-key');
    }
    if (githubPat.trim()) {
      localStorage.setItem('github-pat', githubPat.trim());
    } else {
      localStorage.removeItem('github-pat');
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAdminLogin = async () => {
    const ok = await verifyAdminPassword(adminPass);
    if (ok) {
      setAdmin(true);
      setAdminPass('');
      setAdminError(false);
      onAdminChange();
    } else {
      setAdminError(true);
    }
  };

  const handleAdminLogout = () => {
    logoutAdmin();
    setAdmin(false);
    onAdminChange();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md border border-stone-200 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-stone-100">
          <h2 className="text-stone-800 font-medium text-sm">Settings</h2>
          <button
            onClick={onClose}
            className="text-stone-300 hover:text-stone-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-6">
          <div>
            <label className="text-stone-400 text-xs font-medium">
              Gemini API Key
            </label>
            <p className="text-stone-300 text-xs mt-1 mb-2">
              Required for "Ask Gemini" song identification. Stored locally.
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="AI..."
              className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none font-mono text-sm placeholder-stone-300"
            />
          </div>

          <div>
            <label className="text-stone-400 text-xs font-medium">
              GitHub Token
            </label>
            <p className="text-stone-300 text-xs mt-1 mb-2">
              Required to publish concerts. Create a{' '}
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=kutcheri-log" target="_blank" rel="noopener noreferrer" className="underline">
                personal access token
              </a>{' '}
              with repo scope.
            </p>
            <input
              type="password"
              value={githubPat}
              onChange={e => setGithubPat(e.target.value)}
              placeholder="ghp_..."
              className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none font-mono text-sm placeholder-stone-300"
            />
          </div>

          <div>
            <button
              onClick={handleSave}
              className={`w-full py-3 rounded-lg min-h-[44px] text-sm font-medium transition-colors ${
                saved
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-stone-800 hover:bg-stone-700 text-white'
              }`}
            >
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>

          <div className="border-t border-stone-100 pt-4">
            <label className="text-stone-400 text-xs font-medium">Admin</label>
            {admin ? (
              <div className="flex items-center justify-between mt-2">
                <span className="text-emerald-600 text-sm">Admin mode active</span>
                <button
                  onClick={handleAdminLogout}
                  className="text-stone-400 hover:text-stone-600 text-sm min-h-[44px] px-3"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="mt-2">
                <div className="flex gap-2">
                  <div className={`flex-1 flex items-center rounded-lg border min-h-[44px] ${
                    adminError ? 'border-[var(--color-brand)]' : 'border-stone-200 focus-within:border-stone-400'
                  }`}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={adminPass}
                      onChange={e => { setAdminPass(e.target.value); setAdminError(false); }}
                      onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                      placeholder="Admin password"
                      className="flex-1 bg-transparent text-stone-800 px-3 py-2 focus:outline-none text-sm placeholder-stone-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="px-2 text-stone-300 hover:text-stone-500 min-w-[36px] min-h-[36px] flex items-center justify-center"
                      tabIndex={-1}
                    >
                      {showPass ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={handleAdminLogin}
                    className="border border-stone-200 hover:border-stone-300 text-stone-600 px-4 rounded-lg min-h-[44px] text-sm"
                  >
                    Log in
                  </button>
                </div>
                {adminError && (
                  <p className="text-[var(--color-brand)] text-xs mt-1">Wrong password</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
