import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import {
  Play, Pause, Wifi, WifiOff, Activity, TrendingUp, Award, Target,
  Zap, CheckCircle2, AlertCircle, Calendar as CalendarIcon,
  Settings as SettingsIcon, LayoutDashboard, ChevronLeft, ChevronRight,
  Save, RotateCcw, Monitor
} from 'lucide-react';

// --- CONSTANTS & THEME ---
const THEMES = {
  base: {
    label: 'Base',
    moveRed: '#FF453A',
    exerciseGreen: '#34C759',
    standBlue: '#00A6FF',
    warningYellow: '#FFD60A',
    darkBg: '#0A0A0A',
    cardBg: '#1C1C1E',
    lightText: '#FFFFFF',
    mutedText: '#8E8E93',
    divider: '#38383A',
    accentPink: '#FF3B8A',
    accentBlue: '#007AFF',
    buttonBg: '#FFFFFF',
    buttonText: '#000000',
    panelBg: 'rgba(23, 23, 23, 0.6)', // neutral-900/60
    borderColor: 'rgba(255, 255, 255, 0.1)',
    inputBg: 'rgba(0, 0, 0, 0.5)',
  },
  light: {
    label: 'Light',
    moveRed: '#FF3B30',
    exerciseGreen: '#34C759',
    standBlue: '#007AFF',
    warningYellow: '#FFCC00',
    darkBg: '#F2F2F7', // System Gray 6
    cardBg: '#FFFFFF',
    lightText: '#000000',
    mutedText: '#6C6C70', // System Gray
    divider: '#C6C6C8',
    accentPink: '#FF2D55',
    accentBlue: '#007AFF',
    buttonBg: '#000000',
    buttonText: '#FFFFFF',
    panelBg: 'rgba(255, 255, 255, 0.7)',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    inputBg: 'rgba(0, 0, 0, 0.05)',
  },
  gamer: {
    label: 'Gamer',
    moveRed: '#FF0055',
    exerciseGreen: '#39FF14',
    standBlue: '#00FFFF',
    warningYellow: '#FAFF00',
    darkBg: '#050005',
    cardBg: '#150020',
    lightText: '#E0E0E0',
    mutedText: '#A060C0',
    divider: '#401060',
    accentPink: '#FF00FF',
    accentBlue: '#7000FF',
    buttonBg: '#FF00FF',
    buttonText: '#FFFFFF',
    panelBg: 'rgba(21, 0, 32, 0.6)',
    borderColor: 'rgba(64, 16, 96, 0.5)',
    inputBg: 'rgba(0, 0, 0, 0.5)',
  },
  student: {
    label: 'Student',
    moveRed: '#EF4444',
    exerciseGreen: '#A7F3D0',
    standBlue: '#BFDBFE',
    warningYellow: '#FDE68A',
    darkBg: '#1e1e24',
    cardBg: '#25252d',
    lightText: '#E2E8F0',
    mutedText: '#94A3B8',
    divider: '#334155',
    accentPink: '#C4B5FD',
    accentBlue: '#93C5FD',
    buttonBg: '#C4B5FD',
    buttonText: '#1e1e24',
    panelBg: 'rgba(30, 41, 59, 0.6)',
    borderColor: 'rgba(51, 65, 85, 0.5)',
    inputBg: 'rgba(0, 0, 0, 0.3)',
  }
};

const DEFAULT_SETTINGS = {
  smoothingAlpha: 0.15,
  excellentThreshold: 5,
  goodThreshold: 15,
  fairThreshold: 25,
  pollInterval: 200,
  targetDurationMins: 30
};

// --- HELPER FUNCTIONS ---
const smooth = (prev, next, alpha) => prev * (1 - alpha) + next * alpha;

// Generate mock history data for a specific month
// Generate mock history data for a specific month
const generateMockMonthData = (year, month) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  const today = new Date();

  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    // Stop if the date is in the future
    if (date > today) break;

    // Random realistic score between 40 and 100
    // Bias towards better scores
    const baseScore = Math.floor(Math.random() * 40) + 60;
    const score = Math.min(100, baseScore);
    const duration = Math.floor(Math.random() * 60) + 10;

    days.push({
      date: date.toISOString().split('T')[0],
      dayNum: i,
      score: score,
      duration: duration,
      status: score > 90 ? 'Excellent' : score > 75 ? 'Good' : score > 50 ? 'Fair' : 'Poor'
    });
  }
  return days;
};

export default function App() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, history, settings
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('appTheme') || 'base');
  const colors = useMemo(() => THEMES[currentTheme], [currentTheme]);

  // Connection
  // Connection
  const [espIP, setEspIP] = useState(() => localStorage.getItem('espIP') || '192.168.0.159');
  const [espPort, setEspPort] = useState('80');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  // Session
  const [isActive, setIsActive] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [liveData, setLiveData] = useState([]);
  const [sessionData, setSessionData] = useState([]);
  const [notification, setNotification] = useState(null);
  const [streak, setStreak] = useState(0);

  // Configuration
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('postureSettings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [historyData, setHistoryData] = useState([]);

  useEffect(() => {
    setHistoryData(generateMockMonthData(currentDate.getFullYear(), currentDate.getMonth()));
  }, [currentDate]);

  // Refs
  const lastSmoothedRef = useRef(0);
  const pollingRef = useRef(null);
  const sessionStartTimeRef = useRef(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Save settings on change
  useEffect(() => {
    localStorage.setItem('postureSettings', JSON.stringify(settings));
    localStorage.setItem('espIP', espIP);
    localStorage.setItem('appTheme', currentTheme);
  }, [settings, espIP, currentTheme]);

  // --- LOGIC ---

  const getStatus = (angle) => {
    const absAngle = Math.abs(angle);
    if (absAngle <= settings.excellentThreshold) return { label: 'Excellent', color: colors.exerciseGreen, score: 100 };
    if (absAngle <= settings.goodThreshold) return { label: 'Good', color: colors.standBlue, score: 80 };
    if (absAngle <= settings.fairThreshold) return { label: 'Fair', color: colors.warningYellow, score: 50 };
    return { label: 'Poor', color: colors.moveRed, score: 20 };
  };

  const getScoreColor = (score) => {
    if (score >= 90) return colors.exerciseGreen;
    if (score >= 75) return colors.standBlue;
    if (score >= 50) return colors.warningYellow;
    return colors.moveRed;
  };

  const connectToESP = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`http://${espIP}:${espPort}/angle`, {
        method: 'GET',
        signal: controller.signal
      }).catch(err => { throw new Error('Timeout or Network Error'); });

      clearTimeout(timeoutId);

      if (response.ok) {
        setIsConnected(true);
        setConnectionError('');
        showNotification('success', 'Connected to device');
      } else {
        throw new Error('Device found but refused connection');
      }
    } catch (error) {
      setConnectionError('Cannot reach device');
      setIsConnected(false);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Timer
  useEffect(() => {
    let interval;
    if (isActive) {
      if (!sessionStartTimeRef.current) sessionStartTimeRef.current = Date.now();
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - sessionStartTimeRef.current) / 1000));
      }, 1000);
    } else {
      sessionStartTimeRef.current = null;
    }
    return () => clearInterval(interval);
  }, [isActive]);

  // Polling Loop
  useEffect(() => {
    if (!isActive && !isConnected) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    const pollESP = async () => {
      if (!isConnected) return;
      try {
        const response = await fetch(`http://${espIP}:${espPort}/angle`);
        if (response.ok) {
          const data = await response.json();
          const rawAngle = parseFloat(data.angle || 0);

          const smoothed = Number(smooth(lastSmoothedRef.current, rawAngle, settings.smoothingAlpha).toFixed(1));
          lastSmoothedRef.current = smoothed;
          setCurrentAngle(smoothed);

          const status = getStatus(smoothed);

          if (isActive) {
            const now = Date.now();
            const point = { t: now, angle: smoothed, status: status.label };
            setLiveData(prev => [...prev.slice(-100), point]);
            setSessionData(prev => [...prev, point]);


          }
        }
      } catch (err) {
        // Silent fail on individual poll
      }
    };

    pollingRef.current = setInterval(pollESP, settings.pollInterval);
    return () => clearInterval(pollingRef.current);
  }, [isActive, isConnected, espIP, espPort, settings]);

  // Streak Timer
  useEffect(() => {
    let interval;
    if (isActive && ['Excellent', 'Good'].includes(getStatus(currentAngle).label)) {
      interval = setInterval(() => {
        setStreak(s => {
          const newStreak = s + 1;
          if (newStreak % 60 === 0) showNotification('achievement', `${newStreak / 60} Min Perfect Streak!`);
          return newStreak;
        });
      }, 1000);
    } else {
      setStreak(0);
    }
    return () => clearInterval(interval);
  }, [isActive, currentAngle, settings.excellentThreshold, settings.goodThreshold]);

  const toggleSession = () => {
    if (!isActive) {
      if (!isConnected) return showNotification('error', 'Connect device first');
      setIsActive(true);
      setSessionData([]);
      setLiveData([]);
      setStreak(0);
      setElapsedTime(0);
    } else {
      setIsActive(false);
      showNotification('achievement', 'Session Saved');
    }
  };

  // Stats
  const sessionStats = useMemo(() => {
    if (!sessionData.length) return { score: 0, perfect: 0 };
    const total = sessionData.length;
    const good = sessionData.filter(d => ['Excellent', 'Good'].includes(d.status)).length;
    return {
      score: Math.round((good / total) * 100),
      perfect: Math.round((sessionData.filter(d => d.status === 'Excellent').length / total) * 100)
    };
  }, [sessionData]);

  // Calendar Helpers
  const getMonthName = (date) => date.toLocaleString('default', { month: 'long', year: 'numeric' });

  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    const blanks = Array(firstDay).fill(null);
    return [...blanks, ...historyData];
  };

  // --- RENDER ---

  return (
    // Use inline style to force the dark background color consistently
    <div className="flex h-[100dvh] font-sans overflow-hidden selection:bg-pink-500 selection:text-white transition-colors duration-500" style={{ backgroundColor: colors.darkBg, color: colors.lightText }}>

      {/* --- SIDEBAR (Desktop) --- */}
      <aside
        className="hidden md:flex w-72 flex-col border-r backdrop-blur-xl p-6 transition-colors duration-300"
        style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}
      >
        <div className="flex items-center gap-3 mb-10 px-2">
          <Activity style={{ color: colors.accentPink }} size={32} />
          <div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Spine<span style={{ color: colors.accentPink }}>Up</span></h1>
              <span className="text-xs font-medium tracking-wider uppercase" style={{ color: colors.mutedText }}>Ultimate</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarLink
            icon={<LayoutDashboard />}
            label="Dashboard"
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            colors={colors}
          />
          <SidebarLink
            icon={<CalendarIcon />}
            label="History"
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            colors={colors}
          />
          <SidebarLink
            icon={<SettingsIcon />}
            label="Settings"
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            colors={colors}
          />
        </nav>

        <div className="mt-auto pt-6 border-t" style={{ borderColor: colors.borderColor }}>
          <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ backgroundColor: colors.inputBg }}>
            <div className="flex items-center gap-3">
              {/* Use the new, brighter green/red colors */}
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(52,199,89,0.7)]' : 'bg-red-500 shadow-[0_0_8px_rgba(255,69,58,0.7)]'}`} />
              <span className="text-sm font-medium" style={{ color: colors.mutedText }}>{isConnected ? 'Online' : 'Offline'}</span>
            </div>
            {isConnected && <Wifi size={16} className="text-green-500" />}
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b backdrop-blur-md z-50 relative" style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}>
          <div className="flex items-center gap-2">
            <Activity style={{ color: colors.accentPink }} size={24} />
            <span className="font-bold text-lg">SpineUp</span>
          </div>
          {/* Use the new, brighter green/red colors */}
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <div className="max-w-6xl mx-auto w-full">
            <AnimatePresence mode="wait">

              {/* --- DASHBOARD --- */}
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8"
                >
                  {/* Left Col: Main Gauge */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="relative border rounded-[2.5rem] p-8 md:p-12 flex flex-col items-center justify-center overflow-hidden transition-colors" style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}>
                      {/* Using the new accent colors for a better gradient effect */}
                      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(to right, ${colors.accentPink}, #5856D6, ${colors.accentBlue})`, opacity: 0.5 }} />

                      <AppleRing angle={currentAngle} status={getStatus(currentAngle)} size="large" />

                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-6">
                        <span className="text-7xl md:text-8xl font-bold tracking-tighter tabular-nums drop-shadow-2xl">
                          {Math.abs(currentAngle).toFixed(0)}°
                        </span>
                        <div
                          className="mt-2 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider backdrop-blur-md"
                          style={{
                            backgroundColor: `${getStatus(currentAngle).color}20`,
                            color: getStatus(currentAngle).color,
                            // Adding shadow for clarity on dark background
                            boxShadow: `0 0 10px ${getStatus(currentAngle).color}30`
                          }}
                        >
                          {getStatus(currentAngle).label}
                        </div>
                      </div>

                      {/* Desktop Controls overlay */}
                      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 px-8 translate-y-8">
                        <button
                          onClick={toggleSession}
                          className={`px-8 py-3 rounded-full font-bold text-lg flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-xl ${isActive
                            ? `bg-red-500/10 text-[${colors.moveRed}] border border-red-500/50 hover:bg-red-500/20`
                            : 'hover:brightness-90' // Removed fixed colors
                            }`}
                          style={!isActive ? { backgroundColor: colors.buttonBg, color: colors.buttonText } : {}}
                        >
                          {isActive ? <><Pause fill="currentColor" size={20} /> End Session</> : <><Play fill="currentColor" size={20} /> Start Tracking</>}
                        </button>
                      </div>
                    </div>

                    {/* Live Graph - Wide */}
                    <div className="p-6 rounded-3xl border h-64 md:h-80 transition-colors" style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold flex items-center gap-2" style={{ color: colors.mutedText }}>
                          <Activity size={18} /> Live Posture
                        </h3>
                        <AnimatePresence>
                          {isActive && <motion.span
                            key="live"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-xs text-green-400 animate-pulse"
                          >● Live</motion.span>}
                        </AnimatePresence>
                      </div>
                      <div className="h-full w-full pb-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={liveData}>
                            <defs>
                              {/* Using COLORS.exerciseGreen for the graph fill */}
                              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={colors.exerciseGreen} stopOpacity={0.4} />
                                <stop offset="100%" stopColor={colors.exerciseGreen} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="angle"
                              stroke={colors.exerciseGreen}
                              fill="url(#grad)"
                              strokeWidth={3}
                              isAnimationActive={false}
                            />
                            <YAxis hide domain={[-45, 45]} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Right Col: Stats */}
                  <div className="space-y-4 lg:space-y-6">
                    <StatBox
                      label="Current Streak"
                      value={`${streak}s`}
                      icon={<Zap size={24} />}
                      color={colors.warningYellow}
                      trend="+12%"
                      colors={colors}
                      large
                    />
                    <StatBox
                      label="Session Score"
                      value={`${sessionStats.score}%`}
                      icon={<Award size={24} />}
                      color={colors.exerciseGreen}
                      colors={colors}
                      large
                    />
                    <StatBox
                      label="Elapsed Time"
                      value={formatTime(elapsedTime)}
                      icon={<Activity size={24} />}
                      color={colors.standBlue}
                      colors={colors}
                      large
                    />

                    <div className="border p-6 rounded-3xl mt-auto transition-colors" style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}>
                      <h4 className="text-sm font-medium mb-2" style={{ color: colors.mutedText }}>Pro Tip</h4>
                      <p className="text-sm leading-relaxed" style={{ color: colors.lightText }}>
                        Maintaining a 0-5° angle for just 10 minutes a day can improve long-term spinal health by 40%.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- HISTORY --- */}
              {activeTab === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-bold">{getMonthName(currentDate)}</h2>
                      <p style={{ color: colors.mutedText }}>Your posture consistency over time</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                        className="p-3 rounded-full bg-neutral-800 hover:bg-neutral-700 transition-colors"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                        className="p-3 rounded-full bg-neutral-800 hover:bg-neutral-700 transition-colors"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Monthly Grid Calendar */}
                  <div className="p-6 md:p-8 rounded-[2rem] border shadow-sm transition-colors" style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}>
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 mb-4">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                        <div key={i} className="text-center text-sm font-semibold uppercase tracking-wider py-2" style={{ color: colors.mutedText }}>
                          {d}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-2 md:gap-4">
                      {getCalendarDays().map((day, i) => {
                        if (!day) return <div key={`empty-${i}`} className="aspect-square" />;

                        return (
                          <motion.div
                            key={i}
                            whileHover={{ scale: 1.05, y: -2 }}
                            className="aspect-square rounded-xl md:rounded-2xl relative group cursor-pointer border transition-colors"
                            style={{
                              backgroundColor: `${getScoreColor(day.score)}15`, // 15% opacity background
                              borderColor: colors.borderColor
                            }}
                          >
                            <div className="absolute top-2 left-3 text-xs md:text-sm font-medium opacity-50">{day.dayNum}</div>

                            {/* Ring or Circle Indicator */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div
                                className="w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center text-xs md:text-sm font-bold shadow-lg"
                                style={{
                                  background: `conic-gradient(${getScoreColor(day.score)} ${day.score}%, transparent ${day.score}%)`,
                                  boxShadow: `0 0 20px ${getScoreColor(day.score)}30`
                                }}
                              >
                                <div className="w-[85%] h-[85%] rounded-full flex items-center justify-center" style={{ backgroundColor: colors.cardBg }}>
                                  <span style={{ color: getScoreColor(day.score) }}>{day.score}</span>
                                </div>
                              </div>
                            </div>

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800/90 backdrop-blur text-white text-xs py-2 px-3 rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none shadow-xl transition-opacity">
                              <p className="font-bold">{day.status}</p>
                              <p className="opacity-80">{day.duration} mins tracked</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-3xl border transition-colors" style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}>
                      <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: colors.mutedText }}>
                        <TrendingUp className="text-green-500" size={18} /> Weekly Trend
                      </h3>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={historyData.slice(0, 7)}>
                            <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                              {historyData.slice(0, 7).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                              ))}
                            </Bar>
                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#333', borderRadius: '8px', border: 'none' }} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 rounded-3xl border flex flex-col justify-center transition-colors" style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}>
                        <span className="text-sm" style={{ color: colors.mutedText }}>Monthly Average</span>
                        <span className="text-3xl font-bold mt-1" style={{ color: colors.lightText }}>84%</span>
                        <span className="text-xs text-green-400 mt-2">+2% from last month</span>
                      </div>
                      <div className="p-6 rounded-3xl border flex flex-col justify-center transition-colors" style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}>
                        <span className="text-sm" style={{ color: colors.mutedText }}>Total Hours</span>
                        <span className="text-3xl font-bold mt-1" style={{ color: colors.lightText }}>42h</span>
                        <span className="text-xs mt-2" style={{ color: colors.mutedText }}>Active Tracking</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- SETTINGS --- */}
              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-w-2xl mx-auto space-y-8"
                >
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold">Settings</h2>
                    <p style={{ color: colors.mutedText }}>Customize your posture preferences</p>
                  </div>

                  {/* Connection Settings */}
                  <div className="p-8 rounded-[2rem] border space-y-6 transition-colors" style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Wifi size={20} className="text-blue-500" /> Device Connection
                    </h3>
                    <div>
                      <label className="text-xs uppercase font-bold tracking-wider ml-1" style={{ color: colors.mutedText }}>ESP32 IP Address</label>
                      <div className="flex gap-3 mt-2">
                        <input
                          type="text"
                          value={espIP}
                          onChange={(e) => setEspIP(e.target.value)}
                          className="flex-1 border rounded-xl px-5 py-4 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono"
                          style={{
                            backgroundColor: colors.inputBg,
                            borderColor: colors.borderColor,
                            color: colors.lightText
                          }}
                          placeholder="192.168.0.159"
                        />
                        <button
                          onClick={connectToESP}
                          className="bg-blue-600 px-8 rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"
                        >
                          Connect
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Theme Selector */}
                  <div className="p-8 rounded-[2rem] border space-y-6 transition-colors" style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}>
                    <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: colors.lightText }}>
                      <Monitor size={20} className="text-purple-500" /> Appearance
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      {Object.entries(THEMES).map(([key, theme]) => (
                        <button
                          key={key}
                          onClick={() => setCurrentTheme(key)}
                          className={`p-4 rounded-xl border transition-all ${currentTheme === key ? 'bg-white/10' : 'border-white/10 hover:bg-white/5'}`}
                          style={currentTheme === key ? { borderColor: colors.accentPink } : {}}
                        >
                          <div className="w-full h-8 rounded-lg mb-3 flex overflow-hidden">
                            <div className="flex-1" style={{ background: theme.darkBg }} />
                            <div className="flex-1" style={{ background: theme.accentPink }} />
                            <div className="flex-1" style={{ background: theme.exerciseGreen }} />
                          </div>
                          <span className="text-sm font-medium block text-center">{theme.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Threshold Sliders */}
                  <div className="p-8 rounded-[2rem] border space-y-8 transition-colors" style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}>
                    <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: colors.lightText }}>
                      <Target size={20} style={{ color: colors.accentPink }} /> Posture Zones
                    </h3>

                    <ThresholdSlider
                      label="Excellent Zone (Strict)"
                      description="Green Zone - Perfect posture range"
                      value={settings.excellentThreshold}
                      color={colors.exerciseGreen}
                      max={15}
                      onChange={(v) => setSettings(s => ({ ...s, excellentThreshold: v }))}
                      colors={colors}
                    />
                    <ThresholdSlider
                      label="Good Zone"
                      description="Blue Zone - Acceptable range"
                      value={settings.goodThreshold}
                      color={colors.standBlue}
                      max={30}
                      onChange={(v) => setSettings(s => ({ ...s, goodThreshold: v }))}
                      colors={colors}
                    />
                    <ThresholdSlider
                      label="Fair Zone (Warning)"
                      description="Yellow Zone - Getting slouchy"
                      value={settings.fairThreshold}
                      color={colors.warningYellow}
                      max={45}
                      onChange={(v) => setSettings(s => ({ ...s, fairThreshold: v }))}
                      colors={colors}
                    />

                    <div className="pt-6 border-t" style={{ borderColor: colors.borderColor }}>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <span className="text-base font-medium block" style={{ color: colors.lightText }}>Sensitivity</span>
                          <span className="text-xs mt-0.5" style={{ color: colors.mutedText }}>Adjust how quickly the angle updates</span>
                        </div>
                        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: colors.inputBg, color: colors.lightText }}>{settings.smoothingAlpha}</span>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="0.5"
                        step="0.01"
                        value={settings.smoothingAlpha}
                        onChange={(e) => setSettings(s => ({ ...s, smoothingAlpha: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                      <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-medium uppercase tracking-wider">
                        <span>Very Smooth</span>
                        <span>Responsive</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSettings(DEFAULT_SETTINGS);
                      showNotification('success', 'Settings Reset');
                    }}
                    className="w-full py-4 rounded-xl border hover:opacity-80 transition-colors flex items-center justify-center gap-2 font-medium"
                    style={{ borderColor: colors.borderColor, color: colors.mutedText, backgroundColor: colors.panelBg }}
                  >
                    <RotateCcw size={18} /> Reset to Defaults
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* --- BOTTOM NAV (Mobile Only) --- */}
        <div className="md:hidden p-4 backdrop-blur-xl border-t z-50 relative" style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}>
          <div className="flex justify-around items-center">
            <NavIcon
              icon={<LayoutDashboard />}
              label="Track"
              active={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
              colors={colors}
            />
            <NavIcon
              icon={<CalendarIcon />}
              label="History"
              active={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
              colors={colors}
            />
            <NavIcon
              icon={<SettingsIcon />}
              label="Settings"
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              colors={colors}
            />
          </div>
        </div>

      </main>

      {/* Notifications Overlay */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl backdrop-blur-xl flex items-center gap-3 z-50 border border-white/10 ${notification.type === 'error'
              ? 'bg-red-500/20 text-red-100'
              : 'bg-green-500/20 text-green-100' // Consistent notification colors
              }`}
          >
            {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span className="font-semibold text-sm">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUB COMPONENTS ---

const SidebarLink = ({ icon, label, active, onClick, colors }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${active
      ? 'shadow-lg'
      : 'hover:opacity-80'
      }`}
    style={{
      backgroundColor: active ? colors.inputBg : 'transparent',
      color: active ? colors.lightText : colors.mutedText
    }}
  >
    {React.cloneElement(icon, {
      size: 20,
      style: { color: active ? colors.accentPink : colors.mutedText },
      className: ''
    })}
    <span className="font-medium text-sm">{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.accentPink }} />}
  </button>
);

const NavIcon = ({ icon, label, active, onClick, colors }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-all duration-300 ${active ? 'scale-110' : ''}`}
    style={{ color: active ? colors.accentPink : colors.mutedText }}
  >
    {React.cloneElement(icon, { size: active ? 24 : 22, strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

const StatBox = ({ label, value, icon, color, trend, large, colors }) => (
  <div
    className={`rounded-3xl p-6 flex items-center justify-between border transition-transform hover:scale-[1.02] ${large ? 'py-8' : ''}`}
    style={{ backgroundColor: colors.panelBg, borderColor: colors.borderColor }}
  >
    <div className="flex flex-col justify-center">
      <span className="text-xs uppercase tracking-wider font-bold mb-1" style={{ color: colors.mutedText }}>{label}</span>
      <span className="text-3xl font-bold" style={{ color: colors.lightText }}>{value}</span>
      {trend && <span className="text-xs text-green-400 mt-1 font-medium">{trend} this session</span>}
    </div>
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center opacity-80"
      style={{
        backgroundColor: `${color}20`,
        color: color,
        boxShadow: `0 0 10px ${color}30` // Added shadow for vibrancy
      }}
    >
      {icon}
    </div>
  </div>
);

const ThresholdSlider = ({ label, description, value, color, max, onChange, colors }) => {
  const min = 1;
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex justify-between items-end mb-4">
        <div>
          <span className="text-sm font-bold block" style={{ color: colors.lightText }}>{label}</span>
          <span className="text-xs mt-0.5" style={{ color: colors.mutedText }}>{description}</span>
        </div>
        <span className="px-3 py-1 rounded-lg text-sm font-bold border min-w-[3rem] text-center" style={{ backgroundColor: colors.inputBg, borderColor: colors.borderColor, color: colors.lightText }}>
          {value}°
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
        style={{
          // Ensure consistent gradient background for the range input
          background: `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, #333 ${percentage}%, #333 100%)`
        }}
      />
    </div>
  );
};

function AppleRing({ angle, status, size }) {
  const isLarge = size === 'large';
  const radius = isLarge ? 140 : 120;
  const stroke = isLarge ? 28 : 24;
  const width = radius * 2 + stroke * 2;

  // Adjusted progress calculation to represent 'clearing' the ring more clearly
  // 0 degrees (perfect) = 100% progress
  // fairThreshold (25 degrees default) = 0% progress (or worse)
  // Max angle for 100% fill is excellentThreshold (5 degrees default)
  const maxAngle = 45; // Max angle to consider for progress calculation
  const progress = Math.min(100, Math.max(0, 100 - (Math.abs(angle) / maxAngle) * 100));

  const circumference = 2 * Math.PI * radius;

  return (
    <div className={`relative flex items-center justify-center ${isLarge ? 'w-80 h-80' : 'w-64 h-64'}`}>
      <svg width={width} height={width} className="transform -rotate-90">
        <circle
          cx="50%" cy="50%" r={radius}
          fill="none" stroke="#222" strokeWidth={stroke} strokeLinecap="round"
        />
        <motion.circle
          cx="50%" cy="50%" r={radius}
          fill="none" stroke={status.color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (progress / 100) * circumference }}
          transition={{ type: "spring", stiffness: 60, damping: 20 }}
          style={{
            filter: `drop-shadow(0 0 15px ${status.color}60)`,
            // Applying a subtle shadow to the stroke
            stroke: status.color
          }}
        />
      </svg>
    </div>
  );
}

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};


