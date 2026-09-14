import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Train, MapPin, Activity, Bell, BarChart3, Settings, Volume2, VolumeX, Play, Shield, Menu, X, Radio } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useSound } from '../context/SoundContext';

export const Navbar = ({ onOpenSimulation }) => {
  const location = useLocation();
  const { isConnected } = useSocket();
  const { soundEnabled, isMuted, enableSound, toggleMute, playTrainHorn } = useSound();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Dashboard', path: '/' },
    { name: 'Live Map', path: '/map' },
    { name: 'Phataks', path: '/phataks' },
    { name: 'Trains', path: '/trains' },
    { name: 'Alerts', path: '/alerts' },
    { name: 'Analytics', path: '/analytics' },
    { name: 'Admin', path: '/admin' }
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform duration-300">
              <Train className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-sky-400 transition-colors">
                  SMARTCROSS
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
                  Patiala
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal hidden sm:block">
                Patiala Railway Phatak Real-Time Monitor
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2.5">
            {/* Live WebSocket Status */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
              title={isConnected ? 'Connected to live telemetry stream' : 'Reconnecting to stream...'}
            >
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
              <span className="hidden sm:inline">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
            </div>

            {/* Sound Control Button */}
            {!soundEnabled ? (
              <button
                onClick={enableSound}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-sm animate-pulse"
                title="Browser requires interaction to enable alert sound"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Enable Sound</span>
              </button>
            ) : (
              <button
                onClick={toggleMute}
                className={`p-2 rounded-lg border text-xs transition-colors ${
                  isMuted
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25'
                    : 'bg-slate-800 border-slate-700 text-sky-400 hover:bg-slate-700'
                }`}
                title={isMuted ? 'Unmute Horn Alerts' : 'Mute Horn Alerts'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}

            {/* Test Horn Button */}
            {soundEnabled && !isMuted && (
              <button
                onClick={playTrainHorn}
                className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-all"
                title="Test locomotive dual-horn sound"
              >
                <Radio className="w-3.5 h-3.5 text-sky-400" />
                <span>Horn</span>
              </button>
            )}

            {/* Simulation Trigger Button */}
            <button
              onClick={onOpenSimulation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-sky-500/25 hover:shadow-sky-500/40 transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Demo Simulation</span>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950 px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              {link.name}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
};

export default Navbar;
