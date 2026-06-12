"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ai_1 = require("../lib/ai");
const cskhService_1 = require("../services/cskhService");
describe('CSKH AI Service & Utility Tests', () => {
    describe('parseAiJson', () => {
        it('should parse valid direct JSON', () => {
            const jsonStr = '{"status": "success", "data": 123}';
            expect((0, ai_1.parseAiJson)(jsonStr)).toEqual({ status: 'success', data: 123 });
        });
        it('should extract and parse JSON bounded by curly braces with extra surrounding text', () => {
            const rawText = 'Dưới đây là kết quả của bạn: {"status": "ok", "items": [1, 2]} xin cảm ơn!';
            expect((0, ai_1.parseAiJson)(rawText)).toEqual({ status: 'ok', items: [1, 2] });
        });
        it('should strip markdown code blocks and parse JSON', () => {
            const rawText = '```json\n{"color": "red", "value": "#f00"}\n```';
            expect((0, ai_1.parseAiJson)(rawText)).toEqual({ color: 'red', value: '#f00' });
        });
        it('should rescue and recover a truncated/partial JSON array using brace-counting', () => {
            const rawText = '[\n  {"id": 1, "name": "A"},\n  {"id": 2, "name": "B"},\n  {"id": 3, "name"';
            const result = (0, ai_1.parseAiJson)(rawText);
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 1, name: 'A' });
            expect(result[1]).toEqual({ id: 2, name: 'B' });
        });
    });
    describe('detectTakeoverIntent', () => {
        it('should detect intent when customer asks for a human agent', () => {
            expect((0, cskhService_1.detectTakeoverIntent)('tôi muốn gặp nhân viên để tư vấn')).toBe(true);
            expect((0, cskhService_1.detectTakeoverIntent)('có ai là người thật ở đây không')).toBe(true);
            expect((0, cskhService_1.detectTakeoverIntent)('gặp admin trực tiếp giúp tôi')).toBe(true);
        });
        it('should detect intent when customer expresses frustration', () => {
            expect((0, cskhService_1.detectTakeoverIntent)('sao hệ thống chậm quá vậy')).toBe(true);
            expect((0, cskhService_1.detectTakeoverIntent)('sản phẩm bị lỗi hoài không dùng được')).toBe(true);
            expect((0, cskhService_1.detectTakeoverIntent)('đồ lừa đảo')).toBe(true);
        });
        it('should return false for neutral queries', () => {
            expect((0, cskhService_1.detectTakeoverIntent)('hướng dẫn mình cách đăng bài lên facebook')).toBe(false);
            expect((0, cskhService_1.detectTakeoverIntent)('growth os có những tính năng gì')).toBe(false);
        });
    });
    describe('retrieveRelevantChunks', () => {
        const kbText = `
      Nền tảng Be Traffic giúp đăng bài tự động đa kênh lên Facebook và Zalo.
      
      SEO Tools giúp quét lỗi Onpage Auditor và đo lường backlink chất lượng.
      
      Hệ thống thanh toán tích hợp PayOS VietQR tự động nâng hạng khách hàng.
    `;
        it('should retrieve relevant chunk matching query terms', () => {
            const results = (0, cskhService_1.retrieveRelevantChunks)(kbText, 'quét lỗi SEO Onpage');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0]).toContain('SEO Tools');
        });
        it('should retrieve payos information when queried about payment', () => {
            const results = (0, cskhService_1.retrieveRelevantChunks)(kbText, 'thanh toan PayOS');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0]).toContain('PayOS VietQR');
        });
        it('should handle empty or no matches by returning top chunks', () => {
            const results = (0, cskhService_1.retrieveRelevantChunks)(kbText, 'máy bay trực thăng');
            expect(results.length).toBeGreaterThan(0);
        });
    });
});
