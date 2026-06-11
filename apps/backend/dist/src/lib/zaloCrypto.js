"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zaloVerifiers = void 0;
exports.generateCodeVerifier = generateCodeVerifier;
exports.generateCodeChallenge = generateCodeChallenge;
const crypto_1 = __importDefault(require("crypto"));
function generateCodeVerifier() {
    // 32 bytes generates a base64url string of length 43
    return crypto_1.default.randomBytes(32).toString('base64url').substring(0, 43);
}
function generateCodeChallenge(verifier) {
    return crypto_1.default.createHash('sha256').update(verifier).digest('base64url');
}
// In-memory map to store verification codes for the unified connect flow
// Key: state, Value: code_verifier
exports.zaloVerifiers = new Map();
