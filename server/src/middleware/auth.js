const { verifyAccessToken } = require("../utils/jwt");

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "Missing access token" });
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role
    };
    return next();
  } catch (_err) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}

module.exports = authRequired;
