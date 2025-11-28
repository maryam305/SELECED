import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Play, Pause, Wifi, WifiOff, Activity, Award, Target, Zap, CheckCircle2, AlertCircle } from 'lucide-react';



// Apple Fitness inspired color palette
const COLORS = {
  moveRed: '#FA114F',
  exerciseGreen: '#92E82A',
  standBlue: '#00C7BE',
  gradientStart: '#FF2D55',
  gradientEnd: '#FF6B35',
  darkBg: '#1C1C1E',
  cardBg: '#2C2C2E',
  lightText: '#F5F5F7',
  mutedText: '#98989D',
};

// Status definitions
const STATUS = {
  EXCELLENT: { label: 'Excellent', color: COLORS.exerciseGreen, threshold: 5 },
  GOOD: { label: 'Good', color: COLORS.standBlue, threshold: 15 },
  FAIR: { label: 'Fair', color: '#FFD60A', threshold: 25 },
  POOR: { label: 'Poor', color: COLORS.moveRed, threshold: Infinity },
};

function getStatus(angle) {
  const absAngle = Math.abs(angle);
  if (absAngle < STATUS.EXCELLENT.threshold) return STATUS.EXCELLENT;
  if (absAngle < STATUS.GOOD.threshold) return STATUS.GOOD;
  if (absAngle < STATUS.FAIR.threshold) return STATUS.FAIR;
  return STATUS.POOR;
}

const smooth = (prev, next, alpha) => prev * (1 - alpha) + next * alpha;

export default function App() {
  // ESP32 connection
  const [espIP, setEspIP] = useState('192.168.1.100');
  const [espPort, setEspPort] = useState('80');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  
  // Session state
  const [isActive, setIsActive] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [liveData, setLiveData] = useState([]);
  const [sessionData, setSessionData] = useState([]);
  const [notification, setNotification] = useState(null);
  const [streak, setStreak] = useState(0);
  const [achievements, setAchievements] = useState([]);
  
  // Settings
  const [settings, setSettings] = useState({
    smoothingAlpha: 0.25,
    excellentThreshold: 5,
    goodThreshold: 15,
    fairThreshold: 25,
    pollInterval: 400,
  });
  
  // UI state
  const [showSetup, setShowSetup] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const lastSmoothedRef = useRef(0);
  const pollingRef = useRef(null);
  const bestStreakRef = useRef(0);

  // Connect to ESP32
  const connectToESP = async () => {
    try {
      const url = `http://${espIP}:${espPort}/angle`;
      const response = await fetch(url, { 
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        setIsConnected(true);
        setConnectionError('');
        setNotification({ type: 'success', message: 'Connected to your device' });
        setTimeout(() => setNotification(null), 3000);
        return true;
      } else {
        setConnectionError(`Connection failed: ${response.status}`);
        return false;
      }
    } catch (error) {
      setConnectionError(`Cannot reach ESP32. Check IP address.`);
      setIsConnected(false);
      return false;
    }
  };

  // Timer for elapsed time
  useEffect(() => {
    if (!isActive || !sessionStartTime) return;
    
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isActive, sessionStartTime]);

  // Poll ESP32 for angle data
  useEffect(() => {
    if (!isActive || !isConnected) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const pollESP = async () => {
      try {
        const url = `http://${espIP}:${espPort}/angle`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          const rawAngle = parseFloat(data.angle || 0);
          
          // Apply smoothing
          const alpha = settings.smoothingAlpha;
          const smoothed = Number(smooth(lastSmoothedRef.current, rawAngle, alpha).toFixed(1));
          lastSmoothedRef.current = smoothed;
          
          setCurrentAngle(smoothed);
          
          const status = getStatus(smoothed);
          const timestamp = Date.now();
          const point = { t: timestamp, angle: smoothed, status: status.label };
          
          setLiveData(prev => [...prev.slice(-240), point]);
          setSessionData(prev => [...prev, point]);
          
          // Streak tracking
          if (status.label === 'Excellent' || status.label === 'Good') {
            setStreak(prev => {
              const newStreak = prev + 1;
              if (newStreak > bestStreakRef.current) {
                bestStreakRef.current = newStreak;
                if (newStreak === 60) {
                  addAchievement('1 Min Perfect', '🔥');
                } else if (newStreak === 300) {
                  addAchievement('5 Min Perfect', '⭐');
                }
              }
              return newStreak;
            });
          } else if (status.label === 'Poor') {
            setStreak(0);
            if (!notification) {
              setNotification({ 
                type: 'warning', 
                message: 'Straighten your back' 
              });
              setTimeout(() => setNotification(null), 4000);
            }
          }
        } else {
          setIsConnected(false);
          setConnectionError('Lost connection');
        }
      } catch (error) {
        setIsConnected(false);
        setConnectionError(`Connection error`);
      }
    };

    pollingRef.current = setInterval(pollESP, settings.pollInterval);
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [isActive, isConnected, espIP, espPort, settings, notification]);

  const addAchievement = (title, emoji) => {
    setAchievements(prev => [...prev, { title, emoji, time: Date.now() }]);
    setNotification({ type: 'achievement', message: `${emoji} ${title}!` });
    setTimeout(() => setNotification(null), 5000);
  };

  // Start/stop session
  const toggleSession = () => {
    if (!isActive) {
      if (!isConnected) {
        setNotification({ type: 'error', message: 'Connect to ESP32 first' });
        setTimeout(() => setNotification(null), 3000);
        return;
      }
      setIsActive(true);
      setLiveData([]);
      setSessionData([]);
      setStreak(0);
      bestStreakRef.current = 0;
      setAchievements([]);
      setSessionStartTime(Date.now());
      setElapsedTime(0);
      lastSmoothedRef.current = 0;
    } else {
      setIsActive(false);
      setSessionStartTime(null);
      if (sessionData.length > 30) {
        addAchievement('Session Complete', '✅');
      }
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = sessionData.length;
    const excellent = sessionData.filter(p => p.status === 'Excellent').length;
    const good = sessionData.filter(p => p.status === 'Good').length;
    const fair = sessionData.filter(p => p.status === 'Fair').length;
    const poor = sessionData.filter(p => p.status === 'Poor').length;
    
    const perfectPercent = total ? Math.round(((excellent + good) / total) * 100) : 0;
    
    return {
      total,
      excellent,
      good,
      fair,
      poor,
      perfectPercent,
      excellentPercent: total ? Math.round((excellent / total) * 100) : 0,
    };
  }, [sessionData]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Ring progress data
  const ringData = [
    {
      name: 'Perfect',
      value: stats.perfectPercent,
      fill: COLORS.exerciseGreen,
    }
  ];

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6"
      style={{ 
        background: `linear-gradient(135deg, ${COLORS.darkBg} 0%, #000000 100%)`,
      }}
    >
      <div className="w-full max-w-7xl">
        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Main Display */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Hero Card - Live Posture */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl p-8"
              style={{ 
                background: `linear-gradient(135deg, ${COLORS.cardBg} 0%, ${COLORS.darkBg} 100%)`,
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              }}
            >
              {/* Animated Background Gradient */}
              <div 
                className="absolute inset-0 opacity-20"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${getStatus(currentAngle).color} 0%, transparent 70%)`,
                }}
              />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h1 
                      className="text-5xl font-bold mb-2"
                      style={{ color: COLORS.lightText }}
                    >
                      Posture
                    </h1>
                    <p style={{ color: COLORS.mutedText }} className="text-lg">
                      {isActive ? 'Keep it up!' : 'Ready to start'}
                    </p>
                  </div>
                  
                  {isConnected && (
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="flex items-center gap-2 px-4 py-2 rounded-full"
                      style={{ backgroundColor: `${COLORS.exerciseGreen}20` }}
                    >
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: COLORS.exerciseGreen }}
                      />
                      <span 
                        className="text-sm font-semibold"
                        style={{ color: COLORS.exerciseGreen }}
                      >
                        Live
                      </span>
                    </motion.div>
                  )}
                </div>

                {/* Main Angle Display */}
                <div className="flex items-center justify-center gap-12 mb-8">
                  <AppleRing angle={currentAngle} />
                  
                  <div className="text-center">
                    <motion.div
                      key={currentAngle}
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className="text-9xl font-bold mb-4"
                      style={{ 
                        color: getStatus(currentAngle).color,
                        textShadow: `0 0 40px ${getStatus(currentAngle).color}40`
                      }}
                    >
                      {Math.abs(currentAngle).toFixed(0)}°
                    </motion.div>
                    
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="inline-block px-6 py-3 rounded-full text-xl font-bold"
                      style={{
                        backgroundColor: `${getStatus(currentAngle).color}20`,
                        color: getStatus(currentAngle).color,
                      }}
                    >
                      {getStatus(currentAngle).label}
                    </motion.div>
                  </div>
                </div>

                {/* Session Stats Row */}
                {isActive && (
                  <div className="grid grid-cols-3 gap-4">
                    <StatCard 
                      icon={<Activity size={24} />}
                      label="Time"
                      value={formatTime(elapsedTime)}
                      color={COLORS.standBlue}
                    />
                    <StatCard 
                      icon={<Zap size={24} />}
                      label="Streak"
                      value={`${streak}s`}
                      color={COLORS.exerciseGreen}
                    />
                    <StatCard 
                      icon={<Target size={24} />}
                      label="Perfect"
                      value={`${stats.perfectPercent}%`}
                      color={COLORS.moveRed}
                    />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Live Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-3xl p-6"
              style={{ 
                backgroundColor: COLORS.cardBg,
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              }}
            >
              <h3 
                className="text-xl font-bold mb-4"
                style={{ color: COLORS.lightText }}
              >
                Live Tracking
              </h3>
              
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={liveData}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.exerciseGreen} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={COLORS.exerciseGreen} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="angle"
                      stroke={COLORS.exerciseGreen}
                      strokeWidth={3}
                      fill="url(#areaGradient)"
                      isAnimationActive={false}
                    />
                    <XAxis dataKey="t" hide />
                    <YAxis domain={[-45, 45]} stroke={COLORS.mutedText} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: COLORS.cardBg,
                        border: 'none',
                        borderRadius: '12px',
                        color: COLORS.lightText,
                      }}
                      labelFormatter={(v) => new Date(v).toLocaleTimeString()}
                      formatter={(value) => [`${value}°`, 'Angle']}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Session Summary */}
            {sessionData.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-3xl p-6"
                style={{ 
                  backgroundColor: COLORS.cardBg,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                }}
              >
                <h3 
                  className="text-xl font-bold mb-6"
                  style={{ color: COLORS.lightText }}
                >
                  Session Breakdown
                </h3>
                
                <div className="grid grid-cols-4 gap-4">
                  <QualityCard 
                    label="Excellent"
                    count={stats.excellent}
                    percent={stats.excellentPercent}
                    color={COLORS.exerciseGreen}
                  />
                  <QualityCard 
                    label="Good"
                    count={stats.good}
                    percent={stats.total ? Math.round((stats.good / stats.total) * 100) : 0}
                    color={COLORS.standBlue}
                  />
                  <QualityCard 
                    label="Fair"
                    count={stats.fair}
                    percent={stats.total ? Math.round((stats.fair / stats.total) * 100) : 0}
                    color="#FFD60A"
                  />
                  <QualityCard 
                    label="Poor"
                    count={stats.poor}
                    percent={stats.total ? Math.round((stats.poor / stats.total) * 100) : 0}
                    color={COLORS.moveRed}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column - Controls & Info */}
          <div className="space-y-6">
            
            {/* Connection Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-3xl p-6"
              style={{ 
                backgroundColor: COLORS.cardBg,
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 
                  className="text-lg font-bold"
                  style={{ color: COLORS.lightText }}
                >
                  Device
                </h3>
                {isConnected ? (
                  <div className="flex items-center gap-2">
                    <Wifi size={18} style={{ color: COLORS.exerciseGreen }} />
                    <span 
                      className="text-sm font-semibold"
                      style={{ color: COLORS.exerciseGreen }}
                    >
                      Connected
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <WifiOff size={18} style={{ color: COLORS.moveRed }} />
                    <span 
                      className="text-sm font-semibold"
                      style={{ color: COLORS.moveRed }}
                    >
                      Offline
                    </span>
                  </div>
                )}
              </div>

              {!isConnected && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={espIP}
                    onChange={(e) => setEspIP(e.target.value)}
                    placeholder="ESP32 IP Address"
                    className="w-full px-4 py-3 rounded-xl text-white font-medium"
                    style={{ 
                      backgroundColor: COLORS.darkBg,
                      border: `2px solid ${COLORS.mutedText}40`,
                    }}
                  />
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={connectToESP}
                    className="w-full py-3 rounded-xl font-bold text-white"
                    style={{ 
                      background: `linear-gradient(135deg, ${COLORS.standBlue} 0%, ${COLORS.exerciseGreen} 100%)`,
                    }}
                  >
                    Connect Device
                  </motion.button>
                  
                  {connectionError && (
                    <p className="text-sm" style={{ color: COLORS.moveRed }}>
                      {connectionError}
                    </p>
                  )}
                </div>
              )}

              {isConnected && (
                <p className="text-sm" style={{ color: COLORS.mutedText }}>
                  {espIP}:{espPort}
                </p>
              )}
            </motion.div>

            {/* Main Control Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={toggleSession}
              disabled={!isConnected && !isActive}
              className="w-full py-8 rounded-3xl font-bold text-2xl text-white relative overflow-hidden"
              style={{ 
                background: isActive 
                  ? `linear-gradient(135deg, ${COLORS.moveRed} 0%, #FF2D55 100%)`
                  : `linear-gradient(135deg, ${COLORS.exerciseGreen} 0%, ${COLORS.standBlue} 100%)`,
                boxShadow: isActive
                  ? `0 20px 40px ${COLORS.moveRed}40`
                  : `0 20px 40px ${COLORS.exerciseGreen}40`,
                opacity: (!isConnected && !isActive) ? 0.5 : 1,
              }}
            >
              <motion.div
                animate={{ 
                  scale: isActive ? [1, 1.2, 1] : 1,
                }}
                transition={{ 
                  repeat: isActive ? Infinity : 0,
                  duration: 2,
                }}
                className="flex items-center justify-center gap-3"
              >
                {isActive ? (
                  <>
                    <Pause size={28} />
                    End Session
                  </>
                ) : (
                  <>
                    <Play size={28} />
                    Start Session
                  </>
                )}
              </motion.div>
            </motion.button>

            {/* Achievements */}
            {achievements.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-3xl p-6"
                style={{ 
                  backgroundColor: COLORS.cardBg,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                }}
              >
                <h3 
                  className="text-lg font-bold mb-4 flex items-center gap-2"
                  style={{ color: COLORS.lightText }}
                >
                  <Award size={20} style={{ color: COLORS.exerciseGreen }} />
                  Achievements
                </h3>
                
                <div className="space-y-2">
                  {achievements.slice(-3).reverse().map((ach, i) => (
                    <motion.div
                      key={ach.time}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ backgroundColor: COLORS.darkBg }}
                    >
                      <span className="text-2xl">{ach.emoji}</span>
                      <span 
                        className="font-semibold"
                        style={{ color: COLORS.lightText }}
                      >
                        {ach.title}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Tips Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-3xl p-6"
              style={{ 
                backgroundColor: COLORS.cardBg,
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              }}
            >
              <h3 
                className="text-lg font-bold mb-3"
                style={{ color: COLORS.lightText }}
              >
                💡 Pro Tip
              </h3>
              <p 
                className="text-sm leading-relaxed"
                style={{ color: COLORS.mutedText }}
              >
                Keep your screen at eye level and maintain a 90° angle at your elbows. 
                Take micro-breaks every 25 minutes for best results.
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -100, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -100, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div
              className="px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-xl"
              style={{
                background: notification.type === 'achievement'
                  ? `linear-gradient(135deg, ${COLORS.exerciseGreen}dd 0%, ${COLORS.standBlue}dd 100%)`
                  : notification.type === 'warning'
                  ? `${COLORS.moveRed}dd`
                  : notification.type === 'error'
                  ? `${COLORS.moveRed}dd`
                  : `${COLORS.exerciseGreen}dd`,
                color: 'white',
              }}
            >
              {notification.type === 'achievement' && <Award size={24} />}
              {notification.type === 'warning' && <AlertCircle size={24} />}
              {notification.type === 'success' && <CheckCircle2 size={24} />}
              <span className="font-bold text-lg">{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Apple-style Ring Component
function AppleRing({ angle }) {
  const progress = Math.max(0, 100 - Math.abs(angle) * 2);
  const status = getStatus(angle);
  
  return (
    <div className="relative" style={{ width: 180, height: 180 }}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        {/* Background ring */}
        <circle
          cx="90"
          cy="90"
          r="70"
          fill="none"
          stroke={COLORS.mutedText}
          strokeWidth="12"
          opacity="0.2"
        />
        
        {/* Progress ring */}
        <motion.circle
          cx="90"
          cy="90"
          r="70"
          fill="none"
          stroke={status.color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 70}`}
          strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress / 100)}`}
          transform="rotate(-90 90 90)"
          initial={{ strokeDashoffset: 2 * Math.PI * 70 }}
          animate={{ 
            strokeDashoffset: 2 * Math.PI * 70 * (1 - progress / 100),
          }}
          transition={{ type: 'spring', stiffness: 80, damping: 15 }}
          style={{
            filter: `drop-shadow(0 0 10px ${status.color}80)`,
          }}
        />
      </svg>
      
      {/* Center icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ rotate: angle }}
          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
        >
          <Activity size={40} style={{ color: status.color }} />
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div 
      className="rounded-2xl p-4 text-center"
      style={{ backgroundColor: `${color}15` }}
    >
      <div className="flex justify-center mb-2" style={{ color }}>
        {icon}
      </div>
      <div className="text-2xl font-bold mb-1" style={{ color }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: COLORS.mutedText }}>
        {label}
      </div>
    </div>
  );
}

function QualityCard({ label, count, percent, color }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold mb-2" style={{ color }}>
        {count}
      </div>
      <div 
        className="text-sm font-semibold mb-1"
        style={{ color: COLORS.lightText }}
      >
        {label}
      </div>
      <div 
        className="text-xs px-3 py-1 rounded-full inline-block"
        style={{ 
          backgroundColor: `${color}20`,
          color: color,
        }}
      >
        {percent}%
      </div>
    </div>
  );
}