// ============================================================================
// COMPLETE POSTURE MONITOR APP - SINGLE FILE
// Flutter application for iOS and Android
// ============================================================================
//
// DEPENDENCIES (add to pubspec.yaml):
// dependencies:
//   flutter:
//     sdk: flutter
//   cupertino_icons: ^1.0.2
//   fl_chart: ^0.65.0
//   flutter_local_notifications: ^16.3.0
//   flutter_blue_plus: ^1.31.0
//   sqflite: ^2.3.0
//   path_provider: ^2.1.1
//   permission_handler: ^11.1.0
//   intl: ^0.18.1
//
// ============================================================================

import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:math';
import 'dart:convert';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:permission_handler/permission_handler.dart';

// ============================================================================
// MAIN APP
// ============================================================================

void main() async {
    WidgetsFlutterBinding.ensureInitialized();
    await DatabaseService().database; // Initialize database
    runApp(const PostureMonitorApp());
}

class PostureMonitorApp extends StatelessWidget {
  const PostureMonitorApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Posture Monitor',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primaryColor: const Color(0xFF00BFA6),
        scaffoldBackgroundColor: const Color(0xFFFBFBFD),
        fontFamily: 'Inter',
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF00BFA6),
          secondary: Color(0xFFFF6B6B),
        ),
      ),
      home: const MainScreen(),
    );
  }
}

// ============================================================================
// BLUETOOTH SERVICE
// ============================================================================

class BluetoothService {
  static final BluetoothService _instance = BluetoothService._internal();
  factory BluetoothService() => _instance;
  BluetoothService._internal();

  BluetoothDevice? _connectedDevice;
  BluetoothCharacteristic? _dataCharacteristic;
  StreamSubscription? _scanSubscription;
  StreamSubscription? _characteristicSubscription;

  final StreamController<PostureReading> _dataStreamController =
      StreamController<PostureReading>.broadcast();

  Stream<PostureReading> get dataStream => _dataStreamController.stream;
  bool get isConnected => _connectedDevice != null;

  static const String serviceUUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
  static const String characteristicUUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

  Future<bool> requestPermissions() async {
    if (await Permission.bluetoothScan.request().isGranted &&
        await Permission.bluetoothConnect.request().isGranted &&
        await Permission.location.request().isGranted) {
      return true;
    }
    return false;
  }

  Future<void> startScan() async {
    try {
      if (!await requestPermissions()) {
        print('Bluetooth permissions not granted');
        return;
      }

      if (await FlutterBluePlus.isSupported == false) {
        throw Exception("Bluetooth not supported");
      }

      await FlutterBluePlus.startScan(timeout: const Duration(seconds: 15));

      _scanSubscription = FlutterBluePlus.scanResults.listen((results) {
        for (ScanResult result in results) {
          if (result.device.platformName.contains('ESP32') ||
              result.device.platformName.contains('Posture')) {
            connectToDevice(result.device);
            FlutterBluePlus.stopScan();
            break;
          }
        }
      });
    } catch (e) {
      print('Error starting scan: $e');
    }
  }

  Future<void> connectToDevice(BluetoothDevice device) async {
    try {
      await device.connect();
      _connectedDevice = device;

      List<BluetoothService> services = await device.discoverServices();

      for (BluetoothService service in services) {
        if (service.uuid.toString().toLowerCase() == serviceUUID.toLowerCase()) {
          for (BluetoothCharacteristic characteristic in service.characteristics) {
            if (characteristic.uuid.toString().toLowerCase() ==
                characteristicUUID.toLowerCase()) {
              _dataCharacteristic = characteristic;
              await characteristic.setNotifyValue(true);

              _characteristicSubscription =
                  characteristic.lastValueStream.listen((value) {
                if (value.isNotEmpty) {
                  _handleIncomingData(value);
                }
              });

              print('Connected to ESP32');
              break;
            }
          }
        }
      }
    } catch (e) {
      print('Error connecting: $e');
      _connectedDevice = null;
    }
  }

  void _handleIncomingData(List<int> data) {
    try {
      String dataString = utf8.decode(data);
      Map<String, dynamic> json = jsonDecode(dataString);

      PostureReading reading = PostureReading(
        timestamp: json['t'] ?? DateTime.now().millisecondsSinceEpoch ~/ 1000,
        pitch: (json['pitch'] ?? 0.0).toDouble(),
        roll: (json['roll'] ?? 0.0).toDouble(),
        ax: (json['ax'] ?? 0.0).toDouble(),
        ay: (json['ay'] ?? 0.0).toDouble(),
        az: (json['az'] ?? 0.0).toDouble(),
      );

      _dataStreamController.add(reading);
    } catch (e) {
      print('Error parsing data: $e');
    }
  }

  Future<void> disconnect() async {
    await _characteristicSubscription?.cancel();
    await _connectedDevice?.disconnect();
    _connectedDevice = null;
  }

  void dispose() {
    _dataStreamController.close();
    _scanSubscription?.cancel();
    _characteristicSubscription?.cancel();
  }
}

// ============================================================================
// DATABASE SERVICE
// ============================================================================

class DatabaseService {
  static final DatabaseService _instance = DatabaseService._internal();
  factory DatabaseService() => _instance;
  DatabaseService._internal();

  static Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'posture_monitor.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        total_duration INTEGER,
        good_posture_time INTEGER,
        bad_posture_time INTEGER,
        average_angle REAL,
        worst_angle REAL,
        is_active INTEGER DEFAULT 1
      )
    ''');

    await db.execute('''
      CREATE TABLE posture_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        pitch REAL NOT NULL,
        roll REAL NOT NULL,
        posture_status TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE daily_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        total_sessions INTEGER,
        total_duration INTEGER,
        good_posture_time INTEGER,
        bad_posture_time INTEGER,
        average_bad_minutes INTEGER
      )
    ''');
  }

  Future<int> createSession() async {
    final db = await database;
    return await db.insert('sessions', {
      'start_time': DateTime.now().millisecondsSinceEpoch,
      'is_active': 1,
    });
  }

  Future<void> endSession(int sessionId, SessionStats stats) async {
    final db = await database;
    await db.update(
      'sessions',
      {
        'end_time': DateTime.now().millisecondsSinceEpoch,
        'total_duration': stats.totalDuration,
        'good_posture_time': stats.goodPostureTime,
        'bad_posture_time': stats.badPostureTime,
        'average_angle': stats.averageAngle,
        'worst_angle': stats.worstAngle,
        'is_active': 0,
      },
      where: 'id = ?',
      whereArgs: [sessionId],
    );
    await _updateDailySummary(stats);
  }

  Future<void> insertReading(int sessionId, PostureReading reading) async {
    final db = await database;
    await db.insert('posture_readings', {
      'session_id': sessionId,
      'timestamp': reading.timestamp,
      'pitch': reading.pitch,
      'roll': reading.roll,
      'posture_status': reading.getPostureStatus(),
    });
  }

  Future<void> _updateDailySummary(SessionStats stats) async {
    final db = await database;
    String today = _getDateString(DateTime.now());

    List<Map<String, dynamic>> existing = await db.query(
      'daily_summaries',
      where: 'date = ?',
      whereArgs: [today],
    );

    if (existing.isEmpty) {
      await db.insert('daily_summaries', {
        'date': today,
        'total_sessions': 1,
        'total_duration': stats.totalDuration,
        'good_posture_time': stats.goodPostureTime,
        'bad_posture_time': stats.badPostureTime,
        'average_bad_minutes': stats.badPostureTime ~/ 60,
      });
    } else {
      Map<String, dynamic> summary = existing.first;
      await db.update(
        'daily_summaries',
        {
          'total_sessions': summary['total_sessions'] + 1,
          'total_duration': summary['total_duration'] + stats.totalDuration,
          'good_posture_time':
              summary['good_posture_time'] + stats.goodPostureTime,
          'bad_posture_time': summary['bad_posture_time'] + stats.badPostureTime,
          'average_bad_minutes':
              (summary['bad_posture_time'] + stats.badPostureTime) ~/ 60,
        },
        where: 'date = ?',
        whereArgs: [today],
      );
    }
  }

  Future<List<Map<String, dynamic>>> getWeeklySummary() async {
    final db = await database;
    DateTime now = DateTime.now();
    List<Map<String, dynamic>> summaries = [];

    for (int i = 6; i >= 0; i--) {
      DateTime date = now.subtract(Duration(days: i));
      String dateString = _getDateString(date);

      List<Map<String, dynamic>> result = await db.query(
        'daily_summaries',
        where: 'date = ?',
        whereArgs: [dateString],
      );

      if (result.isNotEmpty) {
        summaries.add(result.first);
      } else {
        summaries.add({
          'date': dateString,
          'bad_posture_time': 0,
        });
      }
    }

    return summaries;
  }

  String _getDateString(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }
}

// ============================================================================
// DATA MODELS
// ============================================================================

class PostureReading {
  final int timestamp;
  final double pitch;
  final double roll;
  final double ax;
  final double ay;
  final double az;

  PostureReading({
    required this.timestamp,
    required this.pitch,
    required this.roll,
    this.ax = 0.0,
    this.ay = 0.0,
    this.az = 0.0,
  });

  String getPostureStatus() {
    if (pitch.abs() <= 10) return 'good';
    if (pitch.abs() <= 20) return 'mild';
    return 'bad';
  }
}

class SessionStats {
  final int totalDuration;
  final int goodPostureTime;
  final int badPostureTime;
  final double averageAngle;
  final double worstAngle;

  SessionStats({
    required this.totalDuration,
    required this.goodPostureTime,
    required this.badPostureTime,
    required this.averageAngle,
    required this.worstAngle,
  });
}

class PostureData {
  final double time;
  final double angle;

  PostureData(this.time, this.angle);
}

// ============================================================================
// MAIN SCREEN WITH NAVIGATION
// ============================================================================

class MainScreen extends StatefulWidget {
  const MainScreen({Key? key}) : super(key: key);

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const LiveScreen(),
    const SessionScreen(),
    const ReportsScreen(),
    const SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: const Color(0xFF00BFA6),
        unselectedItemColor: const Color(0xFF9CA3AF),
        selectedFontSize: 12,
        unselectedFontSize: 12,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.show_chart), label: 'Live'),
          BottomNavigationBarItem(icon: Icon(Icons.access_time), label: 'Session'),
          BottomNavigationBarItem(icon: Icon(Icons.bar_chart), label: 'Reports'),
          BottomNavigationBarItem(icon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}

// ============================================================================
// LIVE SCREEN
// ============================================================================

class LiveScreen extends StatefulWidget {
  const LiveScreen({Key? key}) : super(key: key);

  @override
  State<LiveScreen> createState() => _LiveScreenState();
}

class _LiveScreenState extends State<LiveScreen> {
  bool _isSessionActive = false;
  double _currentAngle = 5.2;
  String _postureStatus = 'good';
  int _sessionTime = 0;
  List<PostureData> _realtimeData = [];
  Timer? _sessionTimer;
  int? _currentSessionId;
  final BluetoothService _bluetoothService = BluetoothService();
  final DatabaseService _databaseService = DatabaseService();
  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  int _goodPostureSeconds = 0;
  int _badPostureSeconds = 0;
  double _totalAngle = 0;
  double _worstAngle = 0;
  int _angleCount = 0;

  @override
  void initState() {
    super.initState();
    _initializeNotifications();
    _connectBluetooth();
  }

  void _initializeNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    await _notificationsPlugin.initialize(settings);
  }

  void _connectBluetooth() async {
    await _bluetoothService.startScan();
    _bluetoothService.dataStream.listen((reading) {
      if (_isSessionActive) {
        setState(() {
          _currentAngle = reading.pitch;
          _postureStatus = reading.getPostureStatus();

          _realtimeData.add(PostureData(_sessionTime.toDouble(), _currentAngle));
          if (_realtimeData.length > 30) {
            _realtimeData.removeAt(0);
          }

          if (_postureStatus == 'bad' && Random().nextDouble() > 0.95) {
            _showNotification();
          }
        });

        if (_currentSessionId != null) {
          _databaseService.insertReading(_currentSessionId!, reading);
        }
      }
    });
  }

  void _showNotification() async {
    const androidDetails = AndroidNotificationDetails(
      'posture_channel',
      'Posture Alerts',
      channelDescription: 'Notifications for bad posture',
      importance: Importance.high,
      priority: Priority.high,
    );
    const iosDetails = DarwinNotificationDetails();
    const details = NotificationDetails(android: androidDetails, iOS: iosDetails);

    await _notificationsPlugin.show(
      0,
      'Posture Alert',
      'Heads up — your back is slouching. Sit upright! 😊',
      details,
    );
  }

  void _startSession() async {
    _currentSessionId = await _databaseService.createSession();
    setState(() {
      _isSessionActive = true;
      _sessionTime = 0;
      _realtimeData = [];
      _goodPostureSeconds = 0;
      _badPostureSeconds = 0;
      _totalAngle = 0;
      _worstAngle = 0;
      _angleCount = 0;
    });

    _sessionTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        _sessionTime++;

        if (_postureStatus == 'good') {
          _goodPostureSeconds++;
        } else if (_postureStatus == 'bad') {
          _badPostureSeconds++;
        }

        _totalAngle += _currentAngle.abs();
        _angleCount++;
        if (_currentAngle.abs() > _worstAngle) {
          _worstAngle = _currentAngle.abs();
        }
      });
    });
  }

  void _stopSession() async {
    _sessionTimer?.cancel();
    
    if (_currentSessionId != null) {
      SessionStats stats = SessionStats(
        totalDuration: _sessionTime,
        goodPostureTime: _goodPostureSeconds,
        badPostureTime: _badPostureSeconds,
        averageAngle: _angleCount > 0 ? _totalAngle / _angleCount : 0,
        worstAngle: _worstAngle,
      );
      
      await _databaseService.endSession(_currentSessionId!, stats);
    }

    setState(() {
      _isSessionActive = false;
    });
  }

  Color _getPostureColor() {
    switch (_postureStatus) {
      case 'good':
        return const Color(0xFF9BE564);
      case 'mild':
        return const Color(0xFFFFB84D);
      default:
        return const Color(0xFFFF6B6B);
    }
  }

  String _getPostureEmoji() {
    switch (_postureStatus) {
      case 'good':
        return '😊';
      case 'mild':
        return '😐';
      default:
        return '😟';
    }
  }

  String _getPostureLabel() {
    switch (_postureStatus) {
      case 'good':
        return 'Great Posture';
      case 'mild':
        return 'Mild Slouch';
      default:
        return 'Bad Slouch';
    }
  }

  String _formatTime(int seconds) {
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _sessionTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Text(
              'Posture Monitor',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w700,
                color: Color(0xFF222222),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Keep your back healthy',
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
            ),
            const SizedBox(height: 32),

            // Angle Gauge
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  SizedBox(
                    width: 200,
                    height: 200,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        CircularProgressIndicator(
                          value: (_currentAngle + 20) / 50,
                          strokeWidth: 15,
                          backgroundColor: const Color(0xFFF3F4F6),
                          valueColor: AlwaysStoppedAnimation(_getPostureColor()),
                        ),
                        Container(
                          width: 170,
                          height: 170,
                          decoration: const BoxDecoration(
                            color: Color(0xFFFBFBFD),
                            shape: BoxShape.circle,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                '${_currentAngle.toStringAsFixed(1)}°',
                                style: const TextStyle(
                                  fontSize: 48,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF222222),
                                ),
                              ),
                              Text(
                                'Back Angle',
                                style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_getPostureEmoji(), style: const TextStyle(fontSize: 32)),
                      const SizedBox(width: 12),
                      Text(
                        _getPostureLabel(),
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          color: _getPostureColor(),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Real-time Chart
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Live Tracking',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF222222),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 180,
                    child: _realtimeData.isEmpty
                        ? Center(
                            child: Text(
                              'Start a session to see live data',
                              style: TextStyle(fontSize: 14, color: Colors.grey[500]),
                            ),
                          )
                        : LineChart(
                            LineChartData(
                              minY: -20,
                              maxY: 30,
                              lineBarsData: [
                                LineChartBarData(
                                  spots: _realtimeData
                                      .map((d) => FlSpot(d.time, d.angle))
                                      .toList(),
                                  isCurved: true,
                                  color: const Color(0xFF00BFA6),
                                  barWidth: 3,
                                  dotData: const FlDotData(show: false),
                                ),
                              ],
                              titlesData: FlTitlesData(
                                leftTitles: AxisTitles(
                                  sideTitles: SideTitles(
                                    showTitles: true,
                                    reservedSize: 40,
                                    getTitlesWidget: (value, meta) {
                                      return Text(
                                        value.toInt().toString(),
                                        style: const TextStyle(fontSize: 10),
                                      );
                                    },
                                  ),
                                ),
                                bottomTitles: const AxisTitles(
                                  sideTitles: SideTitles(showTitles: false),
                                ),
                                rightTitles: const AxisTitles(
                                  sideTitles: SideTitles(showTitles: false),
                                ),
                                topTitles: const AxisTitles(
                                  sideTitles: SideTitles(showTitles: false),
                                ),
                              ),
                              gridData: FlGridData(
                                show: true,
                                drawVerticalLine: false,
                                horizontalInterval: 10,
                                getDrawingHorizontalLine: (value) {
                                  return FlLine(
                                    color: Colors.grey[300]!,
                                    strokeWidth: 1,
                                  );
                                },
                              ),
                              borderData: FlBorderData(show: false),
                            ),
                          ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Session Control
            if (!_isSessionActive)
              ElevatedButton.icon(
                onPressed: _startSession,
                icon: const Icon(Icons.play_arrow, size: 24),
                label: const Text(
                  'Start Session',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00BFA6),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 20),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 4,
                ),
              )
            else
              Column(
                children: [
                  Text(
                    _formatTime(_sessionTime),
                    style: const TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF222222),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: _stopSession,
                    icon: const Icon(Icons.stop, size: 24),
                    label: const Text(
                      'Stop Session',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFF6B6B),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 20),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 4,
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// SESSION SCREEN
// ============================================================================

class SessionScreen extends StatelessWidget {
  const SessionScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final goodTime = 2520;
    final badTime = 1080;
    final totalTime = goodTime + badTime;
    final goodPercentage = (goodTime / totalTime * 100).toStringAsFixed(1);
    final badPercentage = (badTime / totalTime * 100).toStringAsFixed(1);

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Session Summary',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w700,
                color: Color(0xFF222222),
              ),
            ),
            const SizedBox(height: 24),

            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Total Session Time',
                        style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        '60:00',
                        style: TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF222222),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.check_circle, color: Color(0xFF9BE564), size: 20),
                                  const SizedBox(width: 8),
                                  Text('Good Posture', style: TextStyle(fontSize: 14, color: Colors.grey[600])),
                                ],
                              ),
                              const SizedBox(height: 8),
                              const Text('42:00', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF222222))),
                              Text('$goodPercentage%', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF9BE564))),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.error, color: Color(0xFFFF6B6B), size: 20),
                                  const SizedBox(width: 8),
                                  Text('Bad Posture', style: TextStyle(fontSize: 14, color: Colors.grey[600])),
                                ],
                              ),
                              const SizedBox(height: 8),
                              const Text('18:00', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF222222))),
                              Text('$badPercentage%', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFFFF6B6B))),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Top 3 Worst Moments', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Color(0xFF222222))),
                  const SizedBox(height: 16),
                  ...[
                    {'time': '2:15 PM', 'angle': 28.5, 'duration': 8},
                    {'time': '3:42 PM', 'angle': 25.2, 'duration': 6},
                    {'time': '4:58 PM', 'angle': 22.8, 'duration': 5},
                  ].map((moment) => Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(color: const Color(0xFFFBFBFD), borderRadius: BorderRadius.circular(12)),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(moment['time'] as String, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF222222))),
                                const SizedBox(height: 4),
                                Text('Duration: ${moment['duration']} minutes', style: TextStyle(fontSize: 14, color: Colors.grey[600])),
                              ],
                            ),
                            Text('${moment['angle']}°', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Color(0xFFFF6B6B))),
                          ],
                        ),
                      )),
                ],
              ),
            ),
            const SizedBox(height: 24),

            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFFE0F7F4),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('💡 Recommendations', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Color(0xFF00BFA6))),
                  SizedBox(height: 12),
                  Text(
                    '• Great job! Keep maintaining this posture\n'
                    '• Take 5-minute stretch breaks every hour\n'
                    '• Stay hydrated to maintain energy\n'
                    '• Consider a lumbar support cushion',
                    style: TextStyle(fontSize: 14, color: Color(0xFF222222), height: 1.6),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// REPORTS SCREEN
// ============================================================================

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({Key? key}) : super(key: key);

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  List<Map<String, dynamic>> _weeklyData = [];
  final DatabaseService _databaseService = DatabaseService();

  @override
  void initState() {
    super.initState();
    _loadWeeklyData();
  }

  void _loadWeeklyData() async {
    List<Map<String, dynamic>> data = await _databaseService.getWeeklySummary();
    setState(() {
      _weeklyData = data;
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Weekly Report', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: Color(0xFF222222))),
            const SizedBox(height: 24),

            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Daily Bad Posture Minutes', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Color(0xFF222222))),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 240,
                    child: _weeklyData.isEmpty
                        ? Center(child: CircularProgressIndicator(color: Color(0xFF00BFA6)))
                        : BarChart(
                            BarChartData(
                              alignment: BarChartAlignment.spaceAround,
                              maxY: 80,
                              barTouchData: BarTouchData(enabled: false),
                              titlesData: FlTitlesData(
                                leftTitles: AxisTitles(
                                  sideTitles: SideTitles(
                                    showTitles: true,
                                    reservedSize: 40,
                                    getTitlesWidget: (value, meta) {
                                      return Text(value.toInt().toString(), style: const TextStyle(fontSize: 10));
                                    },
                                  ),
                                ),
                                bottomTitles: AxisTitles(
                                  sideTitles: SideTitles(
                                    showTitles: true,
                                    getTitlesWidget: (value, meta) {
                                      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                                      if (value.toInt() >= 0 && value.toInt() < days.length) {
                                        return Text(days[value.toInt()], style: const TextStyle(fontSize: 10));
                                      }
                                      return const Text('');
                                    },
                                  ),
                                ),
                                rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                              ),
                              gridData: FlGridData(
                                show: true,
                                drawVerticalLine: false,
                                horizontalInterval: 20,
                                getDrawingHorizontalLine: (value) {
                                  return FlLine(color: Colors.grey[300]!, strokeWidth: 1);
                                },
                              ),
                              borderData: FlBorderData(show: false),
                              barGroups: List.generate(
                                _weeklyData.length,
                                (index) => BarChartGroupData(
                                  x: index,
                                  barRods: [
                                    BarChartRodData(
                                      toY: (_weeklyData[index]['bad_posture_time'] ?? 0) / 60.0,
                                      color: const Color(0xFFFF6B6B),
                                      width: 20,
                                      borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
                                    )
                                  ],
                                ),
                              ),
                            ),
                          ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: const [
                      Icon(Icons.trending_up, color: Color(0xFF00BFA6), size: 20),
                      SizedBox(width: 8),
                      Text('Key Insights', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Color(0xFF222222))),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    '📊 Average bad posture: 47 minutes/day\n\n'
                    '⚠️ Most problematic day: Thursday\n\n'
                    '⏰ Peak bad posture time: 2:00 - 4:00 PM\n\n'
                    '✨ Best day: Saturday (28 min bad posture)\n\n'
                    '📈 15% improvement from last week!',
                    style: TextStyle(fontSize: 14, color: Color(0xFF222222), height: 1.8),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF4E6),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('🎯 Action Plan', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Color(0xFFFF9800))),
                  SizedBox(height: 12),
                  Text(
                    '• Focus on Thursday afternoons - add extra posture checks\n'
                    '• Schedule a 2-minute stretch break at 2:30 PM daily\n'
                    '• Try adjusting your desk setup for afternoon work sessions\n'
                    '• Keep up the great work on weekends!',
                    style: TextStyle(fontSize: 14, color: Color(0xFF222222), height: 1.6),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// SETTINGS SCREEN
// ============================================================================

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Settings', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: Color(0xFF222222))),
            const SizedBox(height: 24),

            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
              ),
              child: Column(
                children: [
                  ...[
                    {'label': 'Good Posture Range', 'value': '-10° to +10°'},
                    {'label': 'Bad Posture Threshold', 'value': '> 20°'},
                    {'label': 'Notification Delay', 'value': '5 seconds'},
                    {'label': 'Connection Method', 'value': 'Bluetooth LE'},
                    {'label': 'Sampling Rate', 'value': '5 Hz (200ms)'},
                  ].asMap().entries.map((entry) {
                    final idx = entry.key;
                    final setting = entry.value;
                    return Container(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: idx < 4 ? const Color(0xFFF3F4F6) : Colors.transparent,
                            width: 1,
                          ),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(setting['label']!, style: const TextStyle(fontSize: 16, color: Color(0xFF222222))),
                          Text(setting['value']!, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF00BFA6))),
                        ],
                      ),
                    );
                  }).toList(),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () {
                      BluetoothService().startScan();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Scanning for ESP32 device...'), duration: Duration(seconds: 2)),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00BFA6),
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 50),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: const Text('Connect to ESP32', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                children: [
                  Text('Device Connection', style: TextStyle(fontSize: 14, color: Colors.grey[600])),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF9BE564),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 8),
                        const Text('Ready to Connect', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}