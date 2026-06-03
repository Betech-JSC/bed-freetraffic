"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderContent = renderContent;
exports.resolveUploadPath = resolveUploadPath;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function renderContent(content, vars) {
    return content
        .replace(/\{url\}/g, vars.urlTarget || '')
        .replace(/\{name\}/g, vars.name || '')
        .replace(/\{date\}/g, new Date().toLocaleDateString('vi-VN'));
}
function resolveUploadPath(imageUrl) {
    if (!imageUrl)
        return null;
    const rel = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
    const imagePath = path_1.default.join(__dirname, '../../../', rel);
    return fs_1.default.existsSync(imagePath) ? imagePath : null;
}
