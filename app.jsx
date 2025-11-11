import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Play, Pause, AlertCircle, TrendingUp, CheckCircle, Smile, Frown, Meh, BarChart2, FileText, Settings } from 'lucide-react';

// --- Color Palette (from your spec) ---
const COLORS = {
  primary: '#00BFA6', // Vibrant teal
  accent: '#FF6B6B',  // Coral/Peach
  success: '#9BE564', // Lemon green
  background: '#FBFBFD',
  text: '#222222',
};

// --- Posture Status Constants ---
const STATUS = {
  GOOD: {
    label: 'Good',
    color: COLORS.success,
    icon: (props) => <Smile {...props} />,
    threshold: 10,
  },
  MILD: {
    label: 'Mild Slouch',
    color: '#FFD700', // A warning yellow
    icon: (props) => <Meh {...props} />,
    threshold: 20,
  },
  BAD: {
    label: 'Bad Slouch',
    color: COLORS.accent,
    icon: (props) => <Frown {...props} />,
    threshold: Infinity,
  },
};

// --- Thresholds (from your spec) ---
const BAD_THRESHOLD = STATUS.MILD.threshold;
const NOTIFY_DURATION_MS = 3000; // Notify if bad posture persists for 3s

// --- Main App Component ---
export default function App() {
  const [page, setPage] = useState('live'); // 'live', 'summary', 'report', 'settings'
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [postureStatus, setPostureStatus] = useState(STATUS.GOOD);
  const [liveData, setLiveData] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]); // All data from the session
  const [notification, setNotification] = useState(null); // Simulated notification
  
  // --- Posture Detection Logic ---
  const [badPostureStartTime, setBadPostureStartTime] = useState(null);

  const getStatusFromAngle = (angle) => {
    const absAngle = Math.abs(angle);
    if (absAngle < STATUS.GOOD.threshold) return STATUS.GOOD;
    if (absAngle < STATUS.MILD.threshold) return STATUS.MILD;
    return STATUS.BAD;
  };

  // --- Mock Data Generation & Logic ---
  useEffect(() => {
    if (!isSessionActive) {
      // Clear notification and bad posture timer when session stops
      setNotification(null);
      setBadPostureStartTime(null);
      return;
    }

    const interval = setInterval(() => {
      // Simulate angle data
      // Stays good most of the time, with occasional slouches
      let newAngle;
      const r = Math.random();
      if (r < 0.7) { // Good posture
        newAngle = Math.random() * 10 - 5;
      } else if (r < 0.9) { // Mild slouch
        newAngle = (Math.random() * 10 + 10) * (Math.random() < 0.5 ? 1 : -1);
      } else { // Bad slouch
        newAngle = (Math.random() * 10 + 20) * (Math.random() < 0.5 ? 1 : -1);
      }
      newAngle = parseFloat(newAngle.toFixed(1));
      
      setCurrentAngle(newAngle);
      const newStatus = getStatusFromAngle(newAngle);
      setPostureStatus(newStatus);

      const timestamp = new Date().getTime();
      const newDataPoint = { t: timestamp, angle: newAngle, status: newStatus.label };

      // Update data arrays
      setLiveData(prev => [...prev.slice(-50), newDataPoint]); // Keep last 50 points for live chart
      setSessionHistory(prev => [...prev, newDataPoint]);

      // --- Notification Logic (from your spec) ---
      if (newStatus.label === STATUS.BAD.label) {
        if (badPostureStartTime === null) {
          // Just entered bad posture, set start time
          setBadPostureStartTime(timestamp);
        } else {
          // Check if bad posture has persisted
          if (timestamp - badPostureStartTime > NOTIFY_DURATION_MS && !notification) {
            setNotification({
              type: 'alert',
              message: "Heads up — you've been slouching. Try sitting upright 😊",
            });
          }
        }
      } else {
        // Posture is not bad, reset timer
        if (badPostureStartTime !== null) {
          // Check for positive reinforcement
          if (timestamp - badPostureStartTime > 30000 && !notification) { // Example: 30s good
             setNotification({
              type: 'success',
              message: "Nice! 30 minutes with good posture — keep it up 👍",
            });
          }
        }
        setBadPostureStartTime(null);
        // Optionally clear notification, or let it fade
      }

    }, 1000); // Update every 1 second

    return () => clearInterval(interval);
  }, [isSessionActive, badPostureStartTime, notification]);

  const handleToggleSession = () => {
    setIsSessionActive(prev => {
      const newActiveState = !prev;
      if (newActiveState) {
        // Starting a new session
        setLiveData([]);
        setSessionHistory([]);
        setCurrentAngle(0);
        setPostureStatus(STATUS.GOOD);
        setNotification(null);
      } else {
        // Ending a session
        setPage('summary'); // Automatically go to summary
      }
      return newActiveState;
    });
  };

  const renderPage = () => {
    switch (page) {
      case 'live':
        return (
          <LiveScreen
            currentAngle={currentAngle}
            postureStatus={postureStatus}
            liveData={liveData}
            isSessionActive={isSessionActive}
            onToggleSession={handleToggleSession}
            notification={notification}
            onCloseNotification={() => setNotification(null)}
          />
        );
      case 'summary':
        return (
          <SummaryScreen
            sessionHistory={sessionHistory}
            onClose={() => setPage('live')}
          />
        );
      case 'report':
        return (
          <ReportScreen onClose={() => setPage('live')} />
        );
      case 'settings':
        return (
          <SettingsScreen onClose={() => setPage('live')} />
        );
      default:
        return <LiveScreen />;
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-200 font-['Inter']">
      <div className="w-[375px] h-[812px] bg-[${COLORS.background}] shadow-2xl rounded-[40px] overflow-hidden flex flex-col">
        <Header setPage={setPage} />
        <div className="flex-grow overflow-y-auto p-6">
          {renderPage()}
        </div>
        <NavBar currentPage={page} setPage={setPage} />
      </div>
    </div>
  );
}

// --- Reusable Header ---
function Header({ setPage }) {
  return (
    <div className="flex-shrink-0 flex justify-between items-center p-6 pb-4 bg-white/80 backdrop-blur-sm">
      <h1 className="text-2xl font-bold" style={{ color: COLORS.text }}>
        Posture<span style={{ color: COLORS.primary }}>Pal</span>
      </h1>
      <Settings
        className="text-gray-400 cursor-pointer transition-colors hover:text-gray-600"
        size={24}
        onClick={() => setPage('settings')}
      />
    </div>
  );
}

// --- Reusable Navigation Bar ---
function NavBar({ currentPage, setPage }) {
  const navItems = [
    { name: 'live', icon: TrendingUp },
    { name: 'summary', icon: BarChart2 },
    { name: 'report', icon: FileText },
    { name: 'settings', icon: Settings },
  ];

  return (
    <div className="flex-shrink-0 flex justify-around items-center p-4 bg-white border-t border-gray-100">
      {navItems.map(item => {
        const isActive = currentPage === item.name;
        return (
          <button
            key={item.name}
            onClick={() => setPage(item.name)}
            className={`p-3 rounded-xl transition-all ${isActive ? 'text-white' : 'text-gray-400'}`}
            style={{ backgroundColor: isActive ? COLORS.primary : 'transparent' }}
          >
            <item.icon size={24} />
          </button>
        );
      })}
    </div>
  );
}

// --- Live Screen Component ---
function LiveScreen({
  currentAngle,
  postureStatus,
  liveData,
  isSessionActive,
  onToggleSession,
  notification,
  onCloseNotification
}) {
  const StatusIcon = postureStatus.icon;

  return (
    <div className="flex flex-col items-center h-full space-y-6">
      {/* --- Simulated Notification --- */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={onCloseNotification}
        />
      )}
      
      {/* --- Posture Gauge --- */}
      <div className="relative w-64 h-64 flex items-center justify-center">
        <AngleGauge angle={currentAngle} statusColor={postureStatus.color} />
        <div className="absolute flex flex-col items-center text-center">
          <span
            className="text-6xl font-bold"
            style={{ color: postureStatus.color }}
          >
            {currentAngle.toFixed(0)}°
          </span>
          <div
            className="flex items-center gap-2 px-4 py-1 rounded-full"
            style={{ backgroundColor: `${postureStatus.color}20` }}
          >
            <StatusIcon size={20} style={{ color: postureStatus.color }} />
            <span
              className="text-lg font-medium"
              style={{ color: postureStatus.color }}
            >
              {postureStatus.label}
            </span>
          </div>
        </div>
      </div>
      
      {/* --- Live Chart --- */}
      <div className="w-full h-32">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Live Data (Last 50s)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={liveData}>
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(5px)',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              labelFormatter={(value) => `Time: ${new Date(value).toLocaleTimeString()}`}
            />
            <Line
              type="monotone"
              dataKey="angle"
              stroke={COLORS.primary}
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
            <YAxis domain={[-45, 45]} hide />
            <XAxis dataKey="t" hide />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex-grow" /> {/* Spacer */}

      {/* --- Start/Stop Button --- */}
      <button
        onClick={onToggleSession}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-white text-lg font-bold shadow-lg transition-all"
        style={{
          backgroundColor: isSessionActive ? COLORS.accent : COLORS.primary,
          boxShadow: `0 8px 32px ${isSessionActive ? COLORS.accent : COLORS.primary}50`
        }}
      >
        {isSessionActive ? (
          <>
            <Pause size={24} /> Stop Session
          </>
        ) : (
          <>
            <Play size={24} /> Start Session
          </>
        )}
      </button>
    </div>
  );
}

// --- Custom Angle Gauge Component ---
function AngleGauge({ angle, statusColor }) {
  const clampedAngle = Math.max(-90, Math.min(90, angle));
  const rotation = clampedAngle; // 0 degrees is upright
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  // Make a "progress" arc that moves with the angle, e.g., from 0 to angle
  // This is complex, so let's just rotate an indicator line for simplicity
  
  return (
    <svg width="256" height="256" viewBox="-128 -128 256 256">
      {/* Background Track */}
      <circle
        cx="0"
        cy="0"
        r={radius}
        fill="none"
        stroke="#E0E0E0"
        strokeWidth="16"
      />
      {/* Status Arc - Good */}
      <circle
        cx="0"
        cy="0"
        r={radius}
        fill="none"
        stroke={STATUS.GOOD.color}
        strokeWidth="16"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.75} // Show 1/4 circle
        transform="rotate(45 0 0)" // Position it
      />
      {/* Status Arc - Mild */}
      <circle
        cx="0"
        cy="0"
        r={radius}
        fill="none"
        stroke={STATUS.MILD.color}
        strokeWidth="16"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.78}
        transform="rotate(125 0 0)"
      />
      {/* Status Arc - Bad */}
      <circle
        cx="0"
        cy="0"
        r={radius}
        fill="none"
        stroke={STATUS.BAD.color}
        strokeWidth="16"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.78}
        transform="rotate(145 0 0)"
      />
      
      {/* Needle */}
      <line
        x1="0"
        y1="0"
        x2="0"
        y2={-radius + 10}
        stroke={statusColor}
        strokeWidth="8"
        strokeLinecap="round"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 0.3s ease',
        }}
      />
      <circle cx="0" cy="0" r="10" fill={statusColor} />
    </svg>
  );
}

// --- Simulated Notification Component ---
function Notification({ message, type, onClose }) {
  const isAlert = type === 'alert';
  
  useEffect(() => {
    const timer = setTimeout(onClose, 5000); // Auto-close after 5s
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="w-full p-4 rounded-xl flex items-center gap-3 shadow-md"
      style={{
        backgroundColor: isAlert ? COLORS.accent : COLORS.success,
        color: 'white',
      }}
    >
      {isAlert ? <AlertCircle /> : <CheckCircle />}
      <span className="flex-grow text-sm font-medium">{message}</span>
      <button onClick={onClose} className="font-bold">X</button>
    </div>
  );
}

// --- Session Summary Screen ---
function SummaryScreen({ sessionHistory, onClose }) {
  // Calculate analytics (as per your spec)
  const stats = useMemo(() => {
    if (sessionHistory.length === 0) {
      return {
        totalTime: 0,
        goodTime: 0,
        mildTime: 0,
        badTime: 0,
        goodPercent: 0,
        badPercent: 0,
        topBadMoments: [],
      };
    }
    
    let badTime = 0;
    let mildTime = 0;
    let goodTime = 0;
    
    // Assuming 1s per data point for this simulation
    sessionHistory.forEach(point => {
      if (point.status === STATUS.BAD.label) badTime++;
      else if (point.status === STATUS.MILD.label) mildTime++;
      else goodTime++;
    });

    const totalTime = sessionHistory.length; // Total seconds
    const badPercent = totalTime > 0 ? (badTime / totalTime) * 100 : 0;
    const goodPercent = totalTime > 0 ? (goodTime / totalTime) * 100 : 0;

    // Find top 3 bad moments (simplified)
    const topBadMoments = sessionHistory
      .filter(p => p.status === STATUS.BAD.label)
      .sort((a, b) => Math.abs(b.angle) - Math.abs(a.angle)) // Sort by most severe angle
      .slice(0, 3)
      .map(p => ({
        time: new Date(p.t).toLocaleTimeString(),
        angle: p.angle,
      }));

    return {
      totalTime,
      goodTime,
      mildTime,
      badTime,
      goodPercent,
      badPercent,
      topBadMoments,
    };
  }, [sessionHistory]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="flex flex-col space-y-4 animate-fadeIn">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold" style={{ color: COLORS.text }}>Session Summary</h2>
        <button onClick={onClose} className="text-sm font-medium" style={{ color: COLORS.primary }}>Done</button>
      </div>

      <div className="p-4 bg-white rounded-lg shadow-sm">
        <div className="text-sm text-gray-500">Total Time</div>
        <div className="text-3xl font-bold" style={{ color: COLORS.primary }}>
          {formatTime(stats.totalTime)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-lg shadow-sm">
          <div className="text-sm text-gray-500">Good Posture</div>
          <div className="text-2xl font-bold" style={{ color: COLORS.success }}>
            {formatTime(stats.goodTime)}
          </div>
          <div className="text-sm font-medium" style={{ color: COLORS.success }}>
            {stats.goodPercent.toFixed(0)}%
          </div>
        </div>
        <div className="p-4 bg-white rounded-lg shadow-sm">
          <div className="text-sm text-gray-500">Bad Posture</div>
          <div className="text-2xl font-bold" style={{ color: COLORS.accent }}>
            {formatTime(stats.badTime)}
          </div>
          <div className="text-sm font-medium" style={{ color: COLORS.accent }}>
            {stats.badPercent.toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="p-4 bg-white rounded-lg shadow-sm">
        <h3 className="text-lg font-bold mb-2">Top 3 Worst Moments</h3>
        {stats.topBadMoments.length > 0 ? (
          <ul className="space-y-2">
            {stats.topBadMoments.map((moment, i) => (
              <li key={i} className="flex justify-between items-center text-sm">
                <span className="text-gray-600">{moment.time}</span>
                <span className="font-bold" style={{ color: COLORS.accent }}>
                  {moment.angle.toFixed(1)}°
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No bad posture moments recorded. Great job!</p>
        )}
      </div>
      
      <div className="p-4 bg-white rounded-lg shadow-sm">
        <h3 className="text-lg font-bold mb-2">Recommendation</h3>
        <p className="text-sm text-gray-600">
          {stats.badPercent > 30
            ? "You spent over 30% of your time slouching. Try adjusting your chair height and take a 5-minute stretch break every hour."
            : "You're doing great! Keep up the good work and remember to take regular breaks."}
        </p>
      </div>
    </div>
  );
}

// --- Report Screen (Mock) ---
function ReportScreen({ onClose }) {
  // Mock data for the report chart
  const reportData = [
    { day: 'Mon', badMinutes: 30 },
    { day: 'Tue', badMinutes: 45 },
    { day: 'Wed', badMinutes: 20 },
    { day: 'Thu', badMinutes: 35 },
    { day: 'Fri', badMinutes: 50 },
    { day: 'Sat', badMinutes: 15 },
    { day: 'Sun', badMinutes: 10 },
  ];

  return (
    <div className="flex flex-col space-y-4 animate-fadeIn">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold" style={{ color: COLORS.text }}>Weekly Report</h2>
        <button onClick={onClose} className="text-sm font-medium" style={{ color: COLORS.primary }}>Back</button>
      </div>
      
      <div className="p-4 bg-white rounded-lg shadow-sm">
        <h3 className="text-lg font-bold mb-2">Daily Bad Posture</h3>
        <div className="w-full h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={reportData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <XAxis dataKey="day" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="badMinutes"
                stroke={COLORS.accent}
                strokeWidth={3}
                dot={{ r: 4, fill: COLORS.accent }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="p-4 bg-white rounded-lg shadow-sm">
        <h3 className="text-lg font-bold mb-2">Analysis & Advice</h3>
        <p className="text-sm text-gray-600 mb-2">
          Your worst posture day was <span className="font-bold" style={{color: COLORS.accent}}>Friday</span>, with 50 minutes of slouching.
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-bold" style={{color: COLORS.primary}}>Advice:</span> Most of your slouching happens between 2:00–3:00 PM. Try setting a reminder to stand up and stretch during this time.
        </p>
      </div>
    </div>
  );
}

// +++ NEW Settings Screen (Mock) +++
function SettingsScreen({ onClose }) {
  return (
    <div className="flex flex-col space-y-4 animate-fadeIn">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold" style={{ color: COLORS.text }}>Settings</h2>
        <button onClick={onClose} className="text-sm font-medium" style={{ color: COLORS.primary }}>Back</button>
      </div>

      <div className="p-4 bg-white rounded-lg shadow-sm">
        <h3 className="text-lg font-bold mb-3">Preferences</h3>
        
        <div className="flex justify-between items-center mb-4">
          <label className="text-gray-600">Enable Notifications</label>
          <div className="w-12 h-6 bg-gray-200 rounded-full p-1 flex items-center cursor-pointer">
            <div className="w-4 h-4 bg-white rounded-full shadow-md transform transition-transform" style={{transform: 'translateX(16px)', backgroundColor: COLORS.primary}} />
          </div>
        </div>

        <div className="mb-2">
          <label className="text-gray-600 block mb-1">Good Posture Threshold</label>
          <input
            type="range"
            min="5"
            max="20"
            defaultValue="10"
            className="w-full"
            style={{ accentColor: COLORS.primary }}
          />
          <div className="text-center text-sm text-gray-500">10°</div>
        </div>
        
        <div className="mb-2">
          <label className="text-gray-600 block mb-1">Bad Posture Threshold</label>
          <input
            type="range"
            min="15"
            max="30"
            defaultValue="20"
            className="w-full"
            style={{ accentColor: COLORS.primary }}
          />
          <div className="text-center text-sm text-gray-500">20°</div>
        </div>
      </div>
      
      <div className="p-4 bg-white rounded-lg shadow-sm">
        <h3 className="text-lg font-bold mb-2">Account</h3>
        <button className="w-full text-left text-gray-600 py-2">Edit Profile</button>
        <button className="w-full text-left text-gray-600 py-2">Manage Data</button>
        <button className="w-full text-left py-2 font-medium" style={{ color: COLORS.accent }}>
          Log Out
        </button>
      </div>
    </div>
  );
}