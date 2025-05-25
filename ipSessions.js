const activeSessions = {};

module.exports = {
  isLoggedIn: (ip) => !!activeSessions[ip],
  login: (ip, userId) => { activeSessions[ip] = userId; },
  logout: (ip) => { delete activeSessions[ip]; },
  getUserIdByIP: (ip) => activeSessions[ip]
};
