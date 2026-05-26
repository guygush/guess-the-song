'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { loadStemManifest, pickStemSong, type StemSong } from '@/lib/stems';

interface Props {
  onStart: (song: StemSong, language: 'hebrew' | 'foreign' | 'both', decades: string[], groupPlayers?: string[]) => void;
  onBackToHub: () => void;
}

const DECADES = ['60s', '70s', '80s', '90s', '2000s', '2010s', '2020s'];
const LANGUAGES: { id: 'hebrew' | 'foreign' | 'both'; label: string }[] = [
  { id: 'both', label: 'גם וגם' },
  { id: 'hebrew', label: 'עברית' },
  { id: 'foreign', label: 'אנגלית' },
];

export default function StemSetupScreen({ onStart, onBackToHub }: Props) {
  const [songs, setSongs] = useState<StemSong[] | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'hebrew' | 'foreign' | 'both'>('both');
  const [selectedDecades, setSelectedDecades] = useState<string[]>([]);
  const [loadingSolo, setLoadingSolo] = useState(false);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [error, setError] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [playerInputs, setPlayerInputs] = useState<string[]>(Array(6).fill(''));

  useEffect(() => {
    loadStemManifest().then(setSongs);
  }, []);

  const pill = (active: boolean) => active
    ? 'px-4 py-2 rounded-2xl text-sm font-bold btn-candy-yellow glossy-btn'
    : 'px-4 py-2 rounded-2xl text-sm font-semibold candy-btn-secondary';

  const pick = () => {
    if (!songs) return null;
    return pickStemSong(songs, selectedLanguage, selectedDecades);
  };

  const handleSolo = () => {
    setLoadingSolo(true);
    setError(false);
    const song = pick();
    setLoadingSolo(false);
    if (!song) { setError(true); return; }
    onStart(song, selectedLanguage, selectedDecades);
  };

  const handleStartGroup = () => {
    const players = playerInputs.map(s => s.trim()).filter(Boolean);
    if (players.length < 2) return;
    setLoadingGroup(true);
    setError(false);
    const song = pick();
    setLoadingGroup(false);
    if (!song) { setError(true); return; }
    onStart(song, selectedLanguage, selectedDecades, players);
  };

  const updatePlayerInput = (i: number, value: string) =>
    setPlayerInputs(prev => prev.map((v, idx) => idx === i ? value : v));

  const filledPlayers = playerInputs.filter(s => s.trim());
  const anyLoading = loadingSolo || loadingGroup;

  return (
    <div className="flex flex-col h-dvh play-page">
      <Header title="איך שיר נולד?" onBack={onBackToHub} />

      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">

        {/* Loading manifest */}
        {songs === null && (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 candy-spinner-yellow" />
          </div>
        )}

        {songs !== null && (
          <>
            {/* Empty manifest message */}
            {songs.length === 0 && (
              <p className="text-center text-brown-light text-sm mt-8">
                אין שירים זמינים עדיין. הרץ את סקריפט העיבוד תחילה.
              </p>
            )}

            {songs.length > 0 && (
              <>
                <div className="mb-5 pt-3">
                  <p className="text-xs text-brown-light mb-2.5 font-bold tracking-widest uppercase">שפה</p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {LANGUAGES.map(({ id, label }) => (
                      <button key={id} onClick={() => { setSelectedLanguage(id); setError(false); }}
                        className={pill(selectedLanguage === id)}
                        style={selectedLanguage === id ? { color: '#5c3511' } : {}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-xs text-brown-light mb-2.5 font-bold tracking-widest uppercase">עשור</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {DECADES.map((d) => (
                      <button key={d} onClick={() => { setSelectedDecades(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); setError(false); }}
                        className={pill(selectedDecades.includes(d))}
                        style={selectedDecades.includes(d) ? { color: '#5c3511' } : {}}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="candy-error mb-4">לא נמצאו שירים, נסה קריטריונים אחרים</p>}

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { setShowGroupModal(true); setError(false); }}
                    disabled={anyLoading}
                    className="w-full py-4 rounded-[2rem] font-bold text-xl glossy-btn btn-candy-yellow disabled:opacity-50 flex items-center justify-center"
                    style={{ color: '#5c3511' }}
                  >
                    משחק קבוצתי
                  </button>
                  <button
                    onClick={handleSolo}
                    disabled={anyLoading}
                    className="w-full py-4 rounded-[2rem] font-bold text-xl candy-btn-secondary disabled:opacity-50 flex items-center justify-center"
                  >
                    {loadingSolo ? <div className="w-6 h-6 candy-spinner" /> : 'משחק אישי'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Group modal */}
      {showGroupModal && (
        <div
          className="fixed inset-0 flex items-end justify-center z-50"
          style={{ background: 'rgba(139,94,52,0.4)' }}
          onClick={() => { if (!loadingGroup) setShowGroupModal(false); }}
        >
          <div
            className="play-page w-full max-w-md pb-safe rounded-t-3xl p-5"
            style={{ border: '2px solid #dcc9ad', borderBottom: 'none' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-brown">שחקנים</h2>
              <button
                onClick={() => { if (!loadingGroup) setShowGroupModal(false); }}
                className="w-9 h-9 rounded-full flex items-center justify-center candy-btn-secondary text-sm"
              >✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {playerInputs.map((name, i) => (
                <input key={i} value={name} onChange={e => updatePlayerInput(i, e.target.value)}
                  placeholder={`שחקן ${i + 1}`} disabled={loadingGroup}
                  className="candy-input" style={{ borderRadius: '0.875rem' }} />
              ))}
            </div>
            {error && <p className="candy-error mb-3">לא נמצאו שירים, נסה קריטריונים אחרים</p>}
            <button
              onClick={handleStartGroup}
              disabled={filledPlayers.length < 2 || loadingGroup}
              className="w-full py-4 rounded-[2rem] font-bold text-xl glossy-btn btn-candy-yellow disabled:opacity-50 flex items-center justify-center"
              style={{ color: '#5c3511' }}
            >
              {loadingGroup ? <div className="w-6 h-6 candy-spinner" /> : 'התחל'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
