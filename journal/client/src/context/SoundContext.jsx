import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

const SoundContext = createContext(null);

export const SoundProvider = ({ children }) => {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('smartcross_sound_enabled') === 'true';
  });
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('smartcross_sound_muted') === 'true';
  });
  const [volume, setVolume] = useState(0.8);
  const [hasInteracted, setHasInteracted] = useState(false);

  const audioRef = useRef(null);
  const audioContextRef = useRef(null);

  // Initialize and preload audio
  useEffect(() => {
    const audio = new Audio('/sounds/train-horn.mp3');
    audio.preload = 'auto';
    audioRef.current = audio;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Web Audio API authentic locomotive dual-tone horn synthesizer fallback
  const playSynthesizedHorn = (vol = 0.8) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const duration = 1.2; // 1.2 second blast

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(vol * 0.4, now + 0.08); // attack
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration); // decay & release
      masterGain.connect(ctx.destination);

      // Locomotive chime chords (D#4 ~311.13 Hz and F#4 ~369.99 Hz, classic Nathan K3LA / Indian WAP7 chime)
      const frequencies = [311.13, 369.99, 466.16];

      frequencies.forEach(freq => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();

        osc.type = 'sawtooth'; // rich brassy harmonics
        osc.frequency.setValueAtTime(freq, now);

        // Lowpass filter for deep locomotive horn warmth
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now);

        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + duration);
      });

    } catch (e) {
      console.warn('[Audio] Synthesizer error:', e.message);
    }
  };

  const playTrainHorn = () => {
    if (!soundEnabled || isMuted) return;

    try {
      if (audioRef.current && audioRef.current.src) {
        audioRef.current.volume = volume;
        audioRef.current.currentTime = 0;
        const promise = audioRef.current.play();

        if (promise !== undefined) {
          promise.catch((err) => {
            // If MP3 fails or is blocked, seamlessly use Web Audio synthesizer
            console.log('[Audio] Audio file playback fallback to Web Audio synthesizer');
            playSynthesizedHorn(volume);
          });
        }
      } else {
        playSynthesizedHorn(volume);
      }
    } catch (e) {
      playSynthesizedHorn(volume);
    }
  };

  const enableSound = () => {
    setSoundEnabled(true);
    setHasInteracted(true);
    localStorage.setItem('smartcross_sound_enabled', 'true');

    // Unlock Web Audio context
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      }
      // Brief confirmation chime
      playSynthesizedHorn(0.2);
    } catch (e) {}
  };

  const toggleMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    localStorage.setItem('smartcross_sound_muted', nextState ? 'true' : 'false');
  };

  const updateVolume = (val) => {
    const v = Math.max(0, Math.min(1, val));
    setVolume(v);
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
  };

  return (
    <SoundContext.Provider
      value={{
        soundEnabled,
        isMuted,
        volume,
        hasInteracted,
        enableSound,
        toggleMute,
        setVolume: updateVolume,
        playTrainHorn
      }}
    >
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = () => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
};
