function requireRole(...allowedRoles) {
  return function roleGuard(req, res, next) {
    const role = req.auth && req.auth.role;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    return next();
  };
}

module.exports = requireRole;
