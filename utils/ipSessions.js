// utils/ipSessions.js
const sessions = new Map();

module.exports = {
  login: (ip, userId) => sessions.set(ip, userId),
  logout: (ip) => sessions.delete(ip),
  isLoggedIn: (ip) => sessions.has(ip),
  getUserId: (ip) => sessions.get(ip)
};