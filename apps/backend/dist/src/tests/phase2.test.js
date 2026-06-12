"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const seoAuditService_1 = require("../services/seoAuditService");
describe('Phase 2 Integration Tests - SEO & Keyword Intelligence', () => {
    let mockFetch;
    beforeEach(() => {
        mockFetch = jest.fn();
        global.fetch = mockFetch;
    });
    describe('SEO On-Page Audit with targetKeyword', () => {
        it('should score 100 on content if all keyword rules are met', async () => {
            const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Growth OS - Optimal Traffic System</title>
            <meta name="description" content="Growth OS is a premium traffic system designed to automate marketing.">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body>
            <h1>Growth OS Review</h1>
            <h2>Introduction</h2>
            <p>
              Growth OS is the best software. This paragraph contains Growth OS repeatedly to ensure keyword density is ideal.
              Growth OS helps you schedule posts. Many users love Growth OS because it supports WordPress.
              Let's write enough words so that the total word count exceeds three hundred.
              Growth OS offers CRM features. Growth OS exports CSV files. Growth OS automates backups.
              Growth OS integrates social channels. Growth OS tracks UTM campaigns.
              Let's continue repeating Growth OS to achieve a balanced count.
              Growth OS, Growth OS, Growth OS. We need more words to exceed 300 words.
              Here is some neutral text. Page speed is important. User experience is critical.
              We want to make sure the crawler sees enough content. Backlinks are good.
              Internal links are helpful. We need more sentences. Almost there.
              This is a test document for SEO tool. It has headings and links.
              <a href="/about">About Us</a>
              <a href="/pricing">Pricing</a>
              <a href="/contact">Contact</a>
            </p>
          </body>
        </html>
      `;
            mockFetch.mockResolvedValue({
                ok: true,
                text: jest.fn().mockResolvedValue(mockHtml),
            });
            const result = await (0, seoAuditService_1.runSeoAudit)('https://example.com/growth-os-review', 'Growth OS');
            expect(result.score).toBeGreaterThan(80);
            // Verify no targetKeyword issues are raised
            const keywordIssues = result.issues.filter(i => i.message.includes('Từ khóa mục tiêu'));
            expect(keywordIssues).toHaveLength(0);
        });
        it('should deduct points and raise issues if keyword is missing', async () => {
            const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Best Marketing Guide</title>
            <meta name="description" content="A generic description with zero optimization.">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body>
            <h1>Ultimate SEO Guide</h1>
            <p>Short content.</p>
          </body>
        </html>
      `;
            mockFetch.mockResolvedValue({
                ok: true,
                text: jest.fn().mockResolvedValue(mockHtml),
            });
            const result = await (0, seoAuditService_1.runSeoAudit)('https://example.com/seo-guide', 'Growth OS');
            // Verify keyword issues are raised
            const titleIssue = result.issues.find(i => i.message.includes('không xuất hiện trong Title'));
            const h1Issue = result.issues.find(i => i.message.includes('không xuất hiện trong thẻ H1'));
            const descIssue = result.issues.find(i => i.message.includes('không xuất hiện trong Meta Description'));
            const introIssue = result.issues.find(i => i.message.includes('không xuất hiện ở 150 từ đầu tiên'));
            const densityIssue = result.issues.find(i => i.message.includes('Mật độ từ khóa mục tiêu quá thấp'));
            expect(titleIssue).toBeDefined();
            expect(h1Issue).toBeDefined();
            expect(descIssue).toBeDefined();
            expect(introIssue).toBeDefined();
            expect(densityIssue).toBeDefined();
            expect(result.contentScore).toBeLessThan(60);
        });
    });
});
