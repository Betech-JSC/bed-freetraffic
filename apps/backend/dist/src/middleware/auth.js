"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRoles = requireRoles;
exports.requireWrite = requireWrite;
exports.requireAdmin = requireAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-free-traffic-key';
function readToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    const cookie = req.headers.cookie;
    if (cookie) {
        const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
        if (match)
            return decodeURIComponent(match[1]);
    }
    return null;
}
function authenticate(req, res, next) {
    const token = readToken(req);
    if (!token) {
        res.status(401).json({ error: 'Chưa đăng nhập hoặc token hết hạn' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch {
        res.status(401).json({ error: 'Token không hợp lệ' });
    }
}
function requireRoles(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Chưa đăng nhập' });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
            return;
        }
        next();
    };
}
function requireWrite(req, res, next) {
    return requireRoles(client_1.Role.ADMIN, client_1.Role.EDITOR)(req, res, next);
}
function requireAdmin(req, res, next) {
    return requireRoles(client_1.Role.ADMIN)(req, res, next);
}
