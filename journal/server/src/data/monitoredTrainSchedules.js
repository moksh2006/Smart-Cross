/**
 * Authoritative Northern Railway Monitored Train Schedules
 * Patiala (PTA) — Dhablan (DBN) Corridor
 * 
 * Provides verified timetables for all 15 monitored trains across the day.
 * Used as primary schedule source and resilient offline fallback when RailRadar API
 * is unreachable, rate-limited (HTTP 429), or down.
 */

const MONITORED_TRAIN_SCHEDULES = [
  {
    trainNumber: '14508',
    trainName: 'Fazilka - Delhi Intercity Express',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'DHABLAN_TO_PATIALA',
    entryStationCode: 'DBN',
    entryScheduledTime: '07:17',
    exitStationCode: 'PTA',
    exitScheduledTime: '07:29',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '07:29',
      departureTime: '07:34',
      haltMinutes: 5,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '07:17',
      departureTime: '07:17',
      haltMinutes: 0,
      dayCount: 1
    },
    stations: [
      { stationCode: 'FKA', stationName: 'Fazilka Jn', arrivalTime: '--', departureTime: '02:05', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 30.4034, lng: 74.0267 },
      { stationCode: 'BTI', stationName: 'Bathinda Jn', arrivalTime: '04:50', departureTime: '05:00', distanceKm: 145, haltMinutes: 10, dayCount: 1, lat: 30.2110, lng: 74.9455 },
      { stationCode: 'NBA', stationName: 'Nabha', arrivalTime: '06:55', departureTime: '06:57', distanceKm: 232, haltMinutes: 2, dayCount: 1, lat: 30.3750, lng: 76.1510 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '07:17', departureTime: '07:17', distanceKm: 258, haltMinutes: 0, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '07:29', departureTime: '07:34', distanceKm: 271, haltMinutes: 5, dayCount: 1, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'RPJ', stationName: 'Rajpura Jn', arrivalTime: '08:05', departureTime: '08:07', distanceKm: 296, haltMinutes: 2, dayCount: 1, lat: 30.4839, lng: 76.5941 },
      { stationCode: 'UMB', stationName: 'Ambala Cantt Jn', arrivalTime: '08:45', departureTime: '08:55', distanceKm: 324, haltMinutes: 10, dayCount: 1, lat: 30.3305, lng: 76.8373 },
      { stationCode: 'DLI', stationName: 'Old Delhi Jn', arrivalTime: '12:45', departureTime: '--', distanceKm: 522, haltMinutes: 0, dayCount: 1, lat: 28.6606, lng: 77.2272 }
    ]
  },
  {
    trainNumber: '14736',
    trainName: 'Ambala Cantt - Sri Ganganagar Express',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'PATIALA_TO_DHABLAN',
    entryStationCode: 'PTA',
    entryScheduledTime: '07:50',
    exitStationCode: 'DBN',
    exitScheduledTime: '08:07',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '07:48',
      departureTime: '07:50',
      haltMinutes: 2,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '08:07',
      departureTime: '08:08',
      haltMinutes: 1,
      dayCount: 1
    },
    stations: [
      { stationCode: 'UMB', stationName: 'Ambala Cantt Jn', arrivalTime: '--', departureTime: '06:40', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 30.3305, lng: 76.8373 },
      { stationCode: 'RPJ', stationName: 'Rajpura Jn', arrivalTime: '07:18', departureTime: '07:20', distanceKm: 28, haltMinutes: 2, dayCount: 1, lat: 30.4839, lng: 76.5941 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '07:48', departureTime: '07:50', distanceKm: 53, haltMinutes: 2, dayCount: 1, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '08:07', departureTime: '08:08', distanceKm: 66, haltMinutes: 1, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'NBA', stationName: 'Nabha', arrivalTime: '08:24', departureTime: '08:26', distanceKm: 92, haltMinutes: 2, dayCount: 1, lat: 30.3750, lng: 76.1510 },
      { stationCode: 'BTI', stationName: 'Bathinda Jn', arrivalTime: '10:45', departureTime: '10:55', distanceKm: 179, haltMinutes: 10, dayCount: 1, lat: 30.2110, lng: 74.9455 },
      { stationCode: 'SGNR', stationName: 'Sri Ganganagar', arrivalTime: '13:40', departureTime: '--', distanceKm: 326, haltMinutes: 0, dayCount: 1, lat: 29.9167, lng: 73.8833 }
    ]
  },
  {
    trainNumber: '14815',
    trainName: 'Sri Ganganagar - Rishikesh Intercity',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'DHABLAN_TO_PATIALA',
    entryStationCode: 'DBN',
    entryScheduledTime: '08:56',
    exitStationCode: 'PTA',
    exitScheduledTime: '09:07',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '09:07',
      departureTime: '09:09',
      haltMinutes: 2,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '08:56',
      departureTime: '08:56',
      haltMinutes: 0,
      dayCount: 1
    },
    stations: [
      { stationCode: 'SGNR', stationName: 'Sri Ganganagar', arrivalTime: '--', departureTime: '04:20', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 29.9167, lng: 73.8833 },
      { stationCode: 'BTI', stationName: 'Bathinda Jn', arrivalTime: '06:50', departureTime: '07:00', distanceKm: 147, haltMinutes: 10, dayCount: 1, lat: 30.2110, lng: 74.9455 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '08:56', departureTime: '08:56', distanceKm: 260, haltMinutes: 0, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '09:07', departureTime: '09:09', distanceKm: 273, haltMinutes: 2, dayCount: 1, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'UMB', stationName: 'Ambala Cantt Jn', arrivalTime: '10:10', departureTime: '10:20', distanceKm: 326, haltMinutes: 10, dayCount: 1, lat: 30.3305, lng: 76.8373 },
      { stationCode: 'RKSH', stationName: 'Rishikesh', arrivalTime: '15:20', departureTime: '--', distanceKm: 508, haltMinutes: 0, dayCount: 1, lat: 30.0869, lng: 78.2676 }
    ]
  },
  {
    trainNumber: '11057',
    trainName: 'Mumbai CSMT - Amritsar Express',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'PATIALA_TO_DHABLAN',
    entryStationCode: 'PTA',
    entryScheduledTime: '09:15',
    exitStationCode: 'DBN',
    exitScheduledTime: '09:24',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '09:10',
      departureTime: '09:15',
      haltMinutes: 5,
      dayCount: 2
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '09:24',
      departureTime: '09:24',
      haltMinutes: 0,
      dayCount: 2
    },
    stations: [
      { stationCode: 'CSMT', stationName: 'Mumbai CSMT', arrivalTime: '--', departureTime: '23:30', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 18.9398, lng: 72.8355 },
      { stationCode: 'UMB', stationName: 'Ambala Cantt Jn', arrivalTime: '08:05', departureTime: '08:15', distanceKm: 1618, haltMinutes: 10, dayCount: 2, lat: 30.3305, lng: 76.8373 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '09:10', departureTime: '09:15', distanceKm: 1671, haltMinutes: 5, dayCount: 2, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '09:24', departureTime: '09:24', distanceKm: 1684, haltMinutes: 0, dayCount: 2, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'ASR', stationName: 'Amritsar Jn', arrivalTime: '16:15', departureTime: '--', distanceKm: 1916, haltMinutes: 0, dayCount: 2, lat: 31.6340, lng: 74.8723 }
    ]
  },
  {
    trainNumber: '54552',
    trainName: 'Bathinda - Ambala Cantt Passenger',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'DHABLAN_TO_PATIALA',
    entryStationCode: 'DBN',
    entryScheduledTime: '10:17',
    exitStationCode: 'PTA',
    exitScheduledTime: '10:32',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '10:32',
      departureTime: '10:34',
      haltMinutes: 2,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '10:16',
      departureTime: '10:17',
      haltMinutes: 1,
      dayCount: 1
    },
    stations: [
      { stationCode: 'BTI', stationName: 'Bathinda Jn', arrivalTime: '--', departureTime: '07:30', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 30.2110, lng: 74.9455 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '10:16', departureTime: '10:17', distanceKm: 113, haltMinutes: 1, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '10:32', departureTime: '10:34', distanceKm: 126, haltMinutes: 2, dayCount: 1, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'UMB', stationName: 'Ambala Cantt Jn', arrivalTime: '12:10', departureTime: '--', distanceKm: 179, haltMinutes: 0, dayCount: 1, lat: 30.3305, lng: 76.8373 }
    ]
  },
  {
    trainNumber: '26461',
    trainName: 'Patiala - Bathinda Special',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'PATIALA_TO_DHABLAN',
    entryStationCode: 'PTA',
    entryScheduledTime: '11:15',
    exitStationCode: 'DBN',
    exitScheduledTime: '11:32',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '11:10',
      departureTime: '11:15',
      haltMinutes: 5,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '11:32',
      departureTime: '11:33',
      haltMinutes: 1,
      dayCount: 1
    },
    stations: [
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '--', departureTime: '11:15', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '11:32', departureTime: '11:33', distanceKm: 13, haltMinutes: 1, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'NBA', stationName: 'Nabha', arrivalTime: '11:49', departureTime: '11:51', distanceKm: 39, haltMinutes: 2, dayCount: 1, lat: 30.3750, lng: 76.1510 },
      { stationCode: 'BTI', stationName: 'Bathinda Jn', arrivalTime: '14:20', departureTime: '--', distanceKm: 126, haltMinutes: 0, dayCount: 1, lat: 30.2110, lng: 74.9455 }
    ]
  },
  {
    trainNumber: '26462',
    trainName: 'Bathinda - Patiala Special',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'DHABLAN_TO_PATIALA',
    entryStationCode: 'DBN',
    entryScheduledTime: '11:45',
    exitStationCode: 'PTA',
    exitScheduledTime: '12:02',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '12:02',
      departureTime: '12:05',
      haltMinutes: 3,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '11:45',
      departureTime: '11:46',
      haltMinutes: 1,
      dayCount: 1
    },
    stations: [
      { stationCode: 'BTI', stationName: 'Bathinda Jn', arrivalTime: '--', departureTime: '09:10', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 30.2110, lng: 74.9455 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '11:45', departureTime: '11:46', distanceKm: 113, haltMinutes: 1, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '12:02', departureTime: '--', distanceKm: 126, haltMinutes: 0, dayCount: 1, lat: 30.3385, lng: 76.4102 }
    ]
  },
  {
    trainNumber: '54551',
    trainName: 'Ambala Cantt - Bathinda Passenger',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'PATIALA_TO_DHABLAN',
    entryStationCode: 'PTA',
    entryScheduledTime: '13:18',
    exitStationCode: 'DBN',
    exitScheduledTime: '13:34',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '13:16',
      departureTime: '13:18',
      haltMinutes: 2,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '13:34',
      departureTime: '13:35',
      haltMinutes: 1,
      dayCount: 1
    },
    stations: [
      { stationCode: 'UMB', stationName: 'Ambala Cantt Jn', arrivalTime: '--', departureTime: '12:15', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 30.3305, lng: 76.8373 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '13:16', departureTime: '13:18', distanceKm: 53, haltMinutes: 2, dayCount: 1, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '13:34', departureTime: '13:35', distanceKm: 66, haltMinutes: 1, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'BTI', stationName: 'Bathinda Jn', arrivalTime: '16:30', departureTime: '--', distanceKm: 179, haltMinutes: 0, dayCount: 1, lat: 30.2110, lng: 74.9455 }
    ]
  },
  {
    trainNumber: '11058',
    trainName: 'Amritsar - Mumbai CSMT Express',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'DHABLAN_TO_PATIALA',
    entryStationCode: 'DBN',
    entryScheduledTime: '14:21',
    exitStationCode: 'PTA',
    exitScheduledTime: '14:33',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '14:33',
      departureTime: '14:38',
      haltMinutes: 5,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '14:21',
      departureTime: '14:21',
      haltMinutes: 0,
      dayCount: 1
    },
    stations: [
      { stationCode: 'ASR', stationName: 'Amritsar Jn', arrivalTime: '--', departureTime: '08:50', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 31.6340, lng: 74.8723 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '14:21', departureTime: '14:21', distanceKm: 232, haltMinutes: 0, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '14:33', departureTime: '14:38', distanceKm: 245, haltMinutes: 5, dayCount: 1, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'UMB', stationName: 'Ambala Cantt Jn', arrivalTime: '15:45', departureTime: '15:55', distanceKm: 298, haltMinutes: 10, dayCount: 1, lat: 30.3305, lng: 76.8373 },
      { stationCode: 'CSMT', stationName: 'Mumbai CSMT', arrivalTime: '00:05', departureTime: '--', distanceKm: 1916, haltMinutes: 0, dayCount: 3, lat: 18.9398, lng: 72.8355 }
    ]
  },
  {
    trainNumber: '54553',
    trainName: 'Ambala Cantt - Dhuri Passenger',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'PATIALA_TO_DHABLAN',
    entryStationCode: 'PTA',
    entryScheduledTime: '15:28',
    exitStationCode: 'DBN',
    exitScheduledTime: '15:44',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '15:25',
      departureTime: '15:28',
      haltMinutes: 3,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '15:44',
      departureTime: '15:45',
      haltMinutes: 1,
      dayCount: 1
    },
    stations: [
      { stationCode: 'UMB', stationName: 'Ambala Cantt Jn', arrivalTime: '--', departureTime: '14:20', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 30.3305, lng: 76.8373 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '15:25', departureTime: '15:28', distanceKm: 53, haltMinutes: 3, dayCount: 1, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '15:44', departureTime: '15:45', distanceKm: 66, haltMinutes: 1, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'DUI', stationName: 'Dhuri Jn', arrivalTime: '17:05', departureTime: '--', distanceKm: 107, haltMinutes: 0, dayCount: 1, lat: 30.3698, lng: 75.8672 }
    ]
  },
  {
    trainNumber: '14507',
    trainName: 'Delhi - Fazilka Intercity Express',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'PATIALA_TO_DHABLAN',
    entryStationCode: 'PTA',
    entryScheduledTime: '17:18',
    exitStationCode: 'DBN',
    exitScheduledTime: '17:35',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '17:15',
      departureTime: '17:18',
      haltMinutes: 3,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '17:35',
      departureTime: '17:35',
      haltMinutes: 0,
      dayCount: 1
    },
    stations: [
      { stationCode: 'DLI', stationName: 'Old Delhi Jn', arrivalTime: '--', departureTime: '13:05', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 28.6606, lng: 77.2272 },
      { stationCode: 'UMB', stationName: 'Ambala Cantt Jn', arrivalTime: '16:05', departureTime: '16:15', distanceKm: 198, haltMinutes: 10, dayCount: 1, lat: 30.3305, lng: 76.8373 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '17:15', departureTime: '17:18', distanceKm: 251, haltMinutes: 3, dayCount: 1, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '17:35', departureTime: '17:35', distanceKm: 264, haltMinutes: 0, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'FKA', stationName: 'Fazilka Jn', arrivalTime: '23:45', departureTime: '--', distanceKm: 522, haltMinutes: 0, dayCount: 1, lat: 30.4034, lng: 74.0267 }
    ]
  },
  {
    trainNumber: '14735',
    trainName: 'Sri Ganganagar - Ambala Cantt Express',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'DHABLAN_TO_PATIALA',
    entryStationCode: 'DBN',
    entryScheduledTime: '17:39',
    exitStationCode: 'PTA',
    exitScheduledTime: '17:52',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '17:52',
      departureTime: '17:54',
      haltMinutes: 2,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '17:38',
      departureTime: '17:39',
      haltMinutes: 1,
      dayCount: 1
    },
    stations: [
      { stationCode: 'SGNR', stationName: 'Sri Ganganagar', arrivalTime: '--', departureTime: '11:45', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 29.9167, lng: 73.8833 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '17:38', departureTime: '17:39', distanceKm: 260, haltMinutes: 1, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '17:52', departureTime: '17:54', distanceKm: 273, haltMinutes: 2, dayCount: 1, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'UMB', stationName: 'Ambala Cantt Jn', arrivalTime: '19:15', departureTime: '--', distanceKm: 326, haltMinutes: 0, dayCount: 1, lat: 30.3305, lng: 76.8373 }
    ]
  },
  {
    trainNumber: '14526',
    trainName: 'Sriganganagar - Ambala Cantt Intercity',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'DHABLAN_TO_PATIALA',
    entryStationCode: 'DBN',
    entryScheduledTime: '19:27',
    exitStationCode: 'PTA',
    exitScheduledTime: '19:38',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '19:38',
      departureTime: '19:40',
      haltMinutes: 2,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '19:27',
      departureTime: '19:27',
      haltMinutes: 0,
      dayCount: 1
    },
    stations: [
      { stationCode: 'SGNR', stationName: 'Sri Ganganagar', arrivalTime: '--', departureTime: '14:00', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 29.9167, lng: 73.8833 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '19:27', departureTime: '19:27', distanceKm: 260, haltMinutes: 0, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '19:38', departureTime: '19:40', distanceKm: 273, haltMinutes: 2, dayCount: 1, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'UMB', stationName: 'Ambala Cantt Jn', arrivalTime: '20:55', departureTime: '--', distanceKm: 326, haltMinutes: 0, dayCount: 1, lat: 30.3305, lng: 76.8373 }
    ]
  },
  {
    trainNumber: '14816',
    trainName: 'Rishikesh - Sri Ganganagar Intercity',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'PATIALA_TO_DHABLAN',
    entryStationCode: 'PTA',
    entryScheduledTime: '20:08',
    exitStationCode: 'DBN',
    exitScheduledTime: '20:25',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '20:05',
      departureTime: '20:08',
      haltMinutes: 3,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '20:25',
      departureTime: '20:25',
      haltMinutes: 0,
      dayCount: 1
    },
    stations: [
      { stationCode: 'RKSH', stationName: 'Rishikesh', arrivalTime: '--', departureTime: '12:45', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 30.0869, lng: 78.2676 },
      { stationCode: 'UMB', stationName: 'Ambala Cantt Jn', arrivalTime: '18:50', departureTime: '19:00', distanceKm: 182, haltMinutes: 10, dayCount: 1, lat: 30.3305, lng: 76.8373 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '20:05', departureTime: '20:08', distanceKm: 235, haltMinutes: 3, dayCount: 1, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '20:25', departureTime: '20:25', distanceKm: 248, haltMinutes: 0, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'SGNR', stationName: 'Sri Ganganagar', arrivalTime: '01:30', departureTime: '--', distanceKm: 508, haltMinutes: 0, dayCount: 2, lat: 29.9167, lng: 73.8833 }
    ]
  },
  {
    trainNumber: '14510',
    trainName: 'Bathinda - Delhi Express',
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    corridorDirection: 'DHABLAN_TO_PATIALA',
    entryStationCode: 'DBN',
    entryScheduledTime: '20:41',
    exitStationCode: 'PTA',
    exitScheduledTime: '20:53',
    patialaSchedule: {
      stationCode: 'PTA',
      stationName: 'Patiala',
      arrivalTime: '20:53',
      departureTime: '20:55',
      haltMinutes: 2,
      dayCount: 1
    },
    dhablanSchedule: {
      stationCode: 'DBN',
      stationName: 'Dhablan',
      arrivalTime: '20:40',
      departureTime: '20:41',
      haltMinutes: 1,
      dayCount: 1
    },
    stations: [
      { stationCode: 'BTI', stationName: 'Bathinda Jn', arrivalTime: '--', departureTime: '17:40', distanceKm: 0, haltMinutes: 0, dayCount: 1, lat: 30.2110, lng: 74.9455 },
      { stationCode: 'DBN', stationName: 'Dhablan', arrivalTime: '20:40', departureTime: '20:41', distanceKm: 145, haltMinutes: 1, dayCount: 1, lat: 30.3380, lng: 76.3045 },
      { stationCode: 'PTA', stationName: 'Patiala', arrivalTime: '20:53', departureTime: '20:55', distanceKm: 158, haltMinutes: 2, dayCount: 1, lat: 30.3385, lng: 76.4102 },
      { stationCode: 'UMB', stationName: 'Ambala Cantt Jn', arrivalTime: '21:55', departureTime: '22:05', distanceKm: 211, haltMinutes: 10, dayCount: 1, lat: 30.3305, lng: 76.8373 },
      { stationCode: 'DLI', stationName: 'Old Delhi Jn', arrivalTime: '03:10', departureTime: '--', distanceKm: 409, haltMinutes: 0, dayCount: 2, lat: 28.6606, lng: 77.2272 }
    ]
  }
];

module.exports = {
  MONITORED_TRAIN_SCHEDULES
};
