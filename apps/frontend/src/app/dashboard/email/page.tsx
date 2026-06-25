'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend
} from 'recharts';

type Campaign = {
  id: number;
  name: string;
  subject: string;
  htmlContent: string;
  recipients: string;
  status: string;
  scheduledAt: string | null;
  sentCount: number;
  openCount: number;
  clickCount: number;
};

const emptyForm = {
  name: '',
  subject: '',
  htmlContent: 'Xin chào bạn,\n\nChúng tôi liên hệ để chia sẻ thông tin hữu ích và các bản cập nhật mới nhất từ hệ thống của chúng tôi.\n\nChúc bạn một ngày tốt lành!',
  recipients: '',
  scheduledAt: '',
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatContentToHtml(text: string): string {
  if (!text) return '';
  const paragraphs = text
    .split(/\n\n+/)
    .map(p => `<p style="margin: 0 0 12px 0; line-height: 1.6;">${p.replace(/\n/g, '<br />')}</p>`)
    .join('');

  return `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333333; max-width: 600px; margin: 0 auto; line-height: 1.6; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">${paragraphs}</div>`;
}

function formatHtmlToContent(html: string): string {
  if (!html) return '';
  
  // If it doesn't look like HTML (no tags), return it as is
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return html;
  }
  
  // Clean up track_open tag
  let clean = html.replace(/\{track_open\}|{{track_open}}/g, '');
  
  if (typeof window !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(clean, 'text/html');
      const container = doc.querySelector('div[style*="font-family"]');
      const root = container || doc.body;
      
      let text = '';
      const traverse = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.nodeValue;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tagName = el.tagName.toLowerCase();
          
          if (tagName === 'br') {
            text += '\n';
            return;
          }
          
          for (let i = 0; i < el.childNodes.length; i++) {
            traverse(el.childNodes[i]);
          }
          
          if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            text += '\n\n';
          }
        }
      };
      
      traverse(root);
      return text.replace(/\n{3,}/g, '\n\n').trim();
    } catch (e) {
      console.error('Error parsing HTML to text', e);
    }
  }
  
  // Fallback regex if window is undefined
  let text = clean;
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n\n');
  text = text.replace(/<[^>]+>/g, '');
  
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
    
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

type TemplateMetadata = {
  style: 'simple' | 'newsletter' | 'promotion' | 'announcement' | 'welcome' | 'thankyou' | 'event' | 'monthly_news' | 'ai_showcase' | 'enterprise_services';
  primaryColor: string;
  headerTitle: string;
  ctaText?: string;
  ctaUrl?: string;
  footerText?: string;
};

function adjustColorBrightness(hex: string, percent: number): string {
  let num = parseInt(hex.replace("#",""), 16),
  amt = Math.round(2.55 * percent),
  R = (num >> 16) + amt,
  G = (num >> 8 & 0x00FF) + amt,
  B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
}

function renderTextToHtmlParagraphs(text: string): string {
  if (!text) return '';
  return text
    .split(/\n\n+/)
    .map(p => `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">${p.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function compileEmailHtml(bodyText: string, metadata: TemplateMetadata, trackOpenUrlPlaceholder = '{track_open}'): string {
  const { style, primaryColor, headerTitle, ctaText, ctaUrl, footerText } = metadata;
  const paragraphsHtml = renderTextToHtmlParagraphs(bodyText);
  
  let html = '';
  switch (style) {
    case 'simple':
      html = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; font-family: Arial, sans-serif; padding: 40px 10px; margin: 0;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-top: 6px solid ${primaryColor}; border-radius: 12px; overflow: hidden;">
        ${headerTitle ? `
        <tr>
          <td style="padding: 28px 32px 10px 32px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px;">${headerTitle}</h2>
          </td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 24px 32px; font-size: 15px; color: #334155; line-height: 1.6;">
            ${paragraphsHtml}
            
            ${ctaText && ctaUrl ? `
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 28px; margin-bottom: 12px;">
              <tr>
                <td align="center">
                  <a href="${ctaUrl}" target="_blank" style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block;">
                    ${ctaText}
                  </a>
                </td>
              </tr>
            </table>
            ` : ''}
          </td>
        </tr>
        <tr>
          <td style="background-color: #f1f5f9; padding: 20px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; line-height: 1.5;">${footerText || 'Cảm ơn bạn đã đồng hành cùng chúng tôi.'}</p>
            <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">Bạn nhận được email này vì đã đăng ký nhận thông tin từ hệ thống của chúng tôi.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
      break;

    case 'newsletter':
      const gradColor = adjustColorBrightness(primaryColor, -20);
      html = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px 10px; margin: 0;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <tr>
          <td style="background: linear-gradient(135deg, ${primaryColor} 0%, ${gradColor} 100%); padding: 32px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.15);">${headerTitle || 'BẢN TIN'}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px; font-size: 15px; color: #334155; line-height: 1.6;">
            ${paragraphsHtml}
            
            ${ctaText && ctaUrl ? `
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px; margin-bottom: 8px;">
              <tr>
                <td align="center">
                  <a href="${ctaUrl}" target="_blank" style="background-color: ${primaryColor}; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 9999px; display: inline-block;">
                    ${ctaText}
                  </a>
                </td>
              </tr>
            </table>
            ` : ''}
          </td>
        </tr>
        <tr>
          <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9;">
            <p style="margin: 0; line-height: 1.5; font-weight: 600; color: #475569;">${footerText || 'Thông tin từ bản tin Free Traffic System'}</p>
            <p style="margin: 8px 0 0 0; line-height: 1.6; font-size: 11px; color: #94a3b8;">Để từ chối nhận các email tương tự, vui lòng liên hệ bộ phận hỗ trợ khách hàng của chúng tôi.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
      break;

    case 'promotion':
      const gradColor2 = adjustColorBrightness(primaryColor, -10);
      html = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 10px; margin: 0;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #eaeaea; box-shadow: 0 10px 15px rgba(0,0,0,0.03);">
        <tr>
          <td height="10" style="background: linear-gradient(90deg, ${primaryColor} 0%, #a855f7 50%, #ec4899 100%);"></td>
        </tr>
        <tr>
          <td style="padding: 40px 32px; text-align: center;">
            ${headerTitle ? `
            <div style="font-size: 14px; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px;">
              ${headerTitle}
            </div>
            ` : ''}
            
            <div style="text-align: left; font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 30px;">
              ${paragraphsHtml}
            </div>

            ${ctaText && ctaUrl ? `
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
              <tr>
                <td align="center">
                  <a href="${ctaUrl}" target="_blank" style="background: linear-gradient(135deg, ${primaryColor} 0%, ${gradColor2} 100%); color: #ffffff; padding: 14px 40px; font-size: 15px; font-weight: 800; text-decoration: none; border-radius: 10px; display: inline-block; letter-spacing: 0.5px;">
                    ${ctaText}
                  </a>
                </td>
              </tr>
            </table>
            ` : ''}
          </td>
        </tr>
        <tr>
          <td style="background-color: #fafafa; padding: 24px 32px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f3f3f3;">
            <p style="margin: 0; line-height: 1.5;">${footerText || 'Cập nhật từ chương trình ưu đãi của chúng tôi.'}</p>
            <p style="margin: 6px 0 0 0;">Nếu không muốn nhận những thông báo ưu đãi đặc biệt này, vui lòng bỏ đăng ký.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
      break;

    case 'announcement':
      html = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; font-family: Arial, sans-serif; padding: 30px 10px; margin: 0;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
        <tr>
          <td style="padding: 32px 32px 16px 32px; border-bottom: 1px solid #f3f4f6;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="border-left: 4px solid ${primaryColor}; padding-left: 14px;">
                  <span style="font-size: 11px; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 4px;">Thông báo</span>
                  <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #111827;">${headerTitle || 'THÔNG BÁO QUAN TRỌNG'}</h2>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px; font-size: 15px; color: #374151; line-height: 1.6;">
            ${paragraphsHtml}

            ${ctaText && ctaUrl ? `
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 28px;">
              <tr>
                <td align="left">
                  <a href="${ctaUrl}" target="_blank" style="background-color: #111827; color: #ffffff; padding: 12px 24px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 6px; display: inline-block;">
                    ${ctaText}
                  </a>
                </td>
              </tr>
            </table>
            ` : ''}
          </td>
        </tr>
        <tr>
          <td style="background-color: #f9fafb; padding: 24px 32px; text-align: left; font-size: 11px; color: #6b7280; border-top: 1px solid #f3f4f6;">
            <p style="margin: 0; line-height: 1.5;">${footerText || 'Đây là thông báo chính thức từ hệ thống.'}</p>
            <p style="margin: 8px 0 0 0; font-size: 10px; color: #9ca3af;">Vui lòng không trả lời trực tiếp email này. Đây là hộp thư tự động.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
      break;

    case 'welcome':
      html = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px 10px; margin: 0;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
        <!-- Header -->
        <tr>
          <td style="padding: 24px 32px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="left">
                  <span style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Betech</span>
                </td>
                <td align="right">
                  ${ctaUrl ? `<a href="${ctaUrl}" style="font-size: 13px; font-weight: 700; color: ${primaryColor}; text-decoration: none;">Bắt đầu ngay</a>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Hero Section -->
        <tr>
          <td style="background: linear-gradient(135deg, ${primaryColor} 0%, #1e293b 100%); padding: 48px 32px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0 0 12px 0; font-size: 26px; font-weight: 800; line-height: 1.3; color: #ffffff;">Chào mừng bạn đến với Betech</h1>
            <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e2e8f0; font-weight: 500;">Chúng tôi rất vui mừng được đồng hành cùng bạn trên hành trình chuyển đổi số và phát triển giải pháp công nghệ bền vững.</p>
          </td>
        </tr>
        <!-- Hero Image -->
        <tr>
          <td style="padding: 0;">
            <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80" alt="Office" width="100%" style="display: block; width: 100%; max-width: 100%; border: 0; height: auto;" />
          </td>
        </tr>
        <!-- Body Content -->
        <tr>
          <td style="padding: 36px 32px; background-color: #ffffff;">
            <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0f172a;">${headerTitle || 'Khám phá sức mạnh công nghệ'}</h3>
            <div style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 32px;">
              ${paragraphsHtml}
            </div>
            
            <!-- Stepper -->
            <div style="margin-bottom: 36px; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9;">
              <h4 style="margin: 0 0 20px 0; font-size: 15px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Bắt đầu như thế nào?</h4>
              
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <td width="36" valign="top">
                    <div style="width: 24px; height: 24px; line-height: 24px; border-radius: 50%; background-color: ${primaryColor}; color: #ffffff; text-align: center; font-size: 12px; font-weight: 750;">1</div>
                  </td>
                  <td style="padding-left: 12px;">
                    <h5 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #0f172a;">Tư vấn</h5>
                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">Lắng nghe nhu cầu và phân tích chuyên sâu để tìm ra giải pháp tối ưu nhất cho doanh nghiệp.</p>
                  </td>
                </tr>
              </table>

              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <td width="36" valign="top">
                    <div style="width: 24px; height: 24px; line-height: 24px; border-radius: 50%; background-color: ${primaryColor}; color: #ffffff; text-align: center; font-size: 12px; font-weight: 750;">2</div>
                  </td>
                  <td style="padding-left: 12px;">
                    <h5 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #0f172a;">Thiết kế</h5>
                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">Xây dựng kiến trúc hệ thống và giao diện người dùng hiện đại, tinh tế và dễ sử dụng.</p>
                  </td>
                </tr>
              </table>

              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="36" valign="top">
                    <div style="width: 24px; height: 24px; line-height: 24px; border-radius: 50%; background-color: ${primaryColor}; color: #ffffff; text-align: center; font-size: 12px; font-weight: 750;">3</div>
                  </td>
                  <td style="padding-left: 12px;">
                    <h5 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #0f172a;">Khởi chạy</h5>
                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">Triển khai dự án, tối ưu hóa hiệu suất và hỗ trợ vận hành chuyên nghiệp 24/7.</p>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Bottom Promo & CTA -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #eff6ff; border-radius: 12px; border: 1px solid #dbeafe; padding: 24px; text-align: center;">
              <tr>
                <td>
                  <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 800; color: #1e3a8a;">Sẵn sàng để bắt đầu chưa?</h4>
                  <p style="margin: 0 0 16px 0; font-size: 13px; color: #1e40af; line-height: 1.5;">Hãy để các chuyên gia của Betech giúp bạn thực hiện hóa ý tưởng ngay hôm nay.</p>
                  ${ctaText && ctaUrl ? `
                    <a href="${ctaUrl}" target="_blank" style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      ${ctaText}
                    </a>
                  ` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #0f172a; padding: 32px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #334155;">
            <p style="margin: 0 0 8px 0; line-height: 1.5; font-weight: 750; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">Betech</p>
            <p style="margin: 0 0 16px 0; line-height: 1.5;">${footerText || '© 2024 Betech Digital Solutions. Bảo lưu mọi quyền.'}</p>
            <p style="margin: 0; font-size: 11px; color: #64748b;">Bạn nhận được email này vì bạn là thành viên của hệ thống Betech.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
      break;

    case 'thankyou':
      html = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px 10px; margin: 0;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
        <!-- Logo Header -->
        <tr>
          <td style="padding: 24px 32px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="left">
                  <span style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Betech</span>
                </td>
                <td align="right">
                  ${ctaUrl ? `<a href="${ctaUrl}" style="font-size: 13px; font-weight: 700; color: ${primaryColor}; text-decoration: none;">Bắt đầu ngay</a>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Hero Section -->
        <tr>
          <td style="background: linear-gradient(135deg, ${primaryColor} 0%, #0f172a 100%); padding: 56px 32px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0 0 12px 0; font-size: 28px; font-weight: 800; line-height: 1.3; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">${headerTitle || 'Cảm ơn Sự tin tưởng của Bạn'}</h1>
            <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">Chúng tôi rất vinh dự được đồng hành cùng bạn trong hành trình chuyển đổi số. Sự hợp tác của bạn là động lực để chúng tôi đổi mới mỗi ngày.</p>
          </td>
        </tr>
        <!-- Body Content -->
        <tr>
          <td style="padding: 36px 32px; background-color: #ffffff;">
            <div style="width: 48px; height: 4px; background-color: ${primaryColor}; margin-bottom: 24px; border-radius: 2px;"></div>
            <h4 style="margin: 0 0 16px 0; font-size: 15px; font-weight: 750; color: #0f172a;">Kính gửi Đối tác thân thiết,</h4>
            <div style="font-size: 15px; color: #334155; line-height: 1.7; margin-bottom: 32px;">
              ${paragraphsHtml}
            </div>

            <!-- Signature block -->
            <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 36px;">
              <tr>
                <td width="48" valign="top">
                  <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=120&h=120&q=80" alt="Arthur Sterling" width="48" height="48" style="border-radius: 50%; display: block;" />
                </td>
                <td style="padding-left: 12px;">
                  <h5 style="margin: 0 0 2px 0; font-size: 14px; font-weight: 800; color: #0f172a;">Arthur Sterling</h5>
                  <p style="margin: 0; font-size: 12px; color: #64748b;">CEO, Betech Digital Solutions</p>
                </td>
              </tr>
            </table>

            <!-- Promo Gift Card -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 12px; border: 2px dashed ${primaryColor}; padding: 28px; text-align: center; margin-bottom: 36px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
              <tr>
                <td>
                  <div style="font-size: 32px; margin-bottom: 8px;">🎁</div>
                  <h4 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 800; color: #0f172a;">Món quà Tri ân</h4>
                  <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.5;">Để cảm ơn sự hợp tác bền chặt của bạn, chúng tôi xin gửi tặng ưu đãi độc quyền: <strong style="color: ${primaryColor};">Tín dụng Doanh nghiệp 25%</strong> cho lần nâng cấp dịch vụ tiếp theo.</p>
                  ${ctaText && ctaUrl ? `
                    <a href="${ctaUrl}" target="_blank" style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 32px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block;">
                      ${ctaText}
                    </a>
                  ` : ''}
                </td>
              </tr>
            </table>

            <!-- Stats -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #e2e8f0; padding-top: 28px;">
              <tr>
                <td width="33%" align="center">
                  <div style="font-size: 20px; font-weight: 800; color: ${primaryColor};">500+</div>
                  <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-top: 4px; text-transform: uppercase;">Đối tác</div>
                </td>
                <td width="33%" align="center" style="border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                  <div style="font-size: 20px; font-weight: 800; color: ${primaryColor};">99.9%</div>
                  <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-top: 4px; text-transform: uppercase;">Hoạt động</div>
                </td>
                <td width="33%" align="center">
                  <div style="font-size: 20px; font-weight: 800; color: ${primaryColor};">24/7</div>
                  <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-top: 4px; text-transform: uppercase;">Hỗ trợ</div>
                </td>
              </tr>
            </table>

          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #0f172a; padding: 32px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0 0 8px 0; line-height: 1.5; font-weight: 750; color: #ffffff;">Betech</p>
            <p style="margin: 0 0 16px 0; line-height: 1.5;">${footerText || '© 2024 Betech Digital Solutions. Bảo lưu mọi quyền.'}</p>
            <p style="margin: 0; font-size: 11px; color: #64748b;">Bạn nhận được email này từ đối tác Betech Digital.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
      break;

    case 'event':
      html = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px 10px; margin: 0;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
        <!-- Header -->
        <tr>
          <td style="padding: 24px 32px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="left">
                  <span style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Betech</span>
                </td>
                <td align="right">
                  ${ctaUrl ? `<a href="${ctaUrl}" style="font-size: 13px; font-weight: 700; color: ${primaryColor}; text-decoration: none;">Bắt đầu ngay</a>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Main Event Block -->
        <tr>
          <td style="padding: 40px 32px; background-color: #ffffff;">
            <span style="font-size: 11px; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">Hội thảo công nghệ 2024</span>
            <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.3;">${headerTitle || 'Tham gia Hội thảo Trực tuyến Độc quyền của Chúng tôi'}</h1>

            <!-- Info Card -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
              <tr>
                <td valign="top" style="padding-right: 12px;">
                  <table border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size: 13px; color: #475569; padding-bottom: 8px;">
                        📅 <strong>Ngày:</strong> 24 tháng 10 năm 2024
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size: 13px; color: #475569; padding-bottom: 8px;">
                        ⏰ <strong>Giờ:</strong> 10:00 SA — 11:30 SA (Giờ EST)
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size: 13px; color: #475569;">
                        📍 <strong>Địa điểm:</strong> Trực tuyến (Zoom Meeting)
                      </td>
                    </tr>
                  </table>
                </td>
                <td width="150" align="center" style="border-left: 1px solid #e2e8f0; padding-left: 12px;">
                  <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&h=120&q=80" alt="Speaker" width="48" height="48" style="border-radius: 50%; display: block; margin-bottom: 6px;" />
                  <div style="font-size: 12px; font-weight: 800; color: #0f172a; line-height: 1.2;">TS. Julian Vance</div>
                  <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Giám đốc Chiến lược</div>
                </td>
              </tr>
            </table>

            <!-- Register Button -->
            ${ctaText && ctaUrl ? `
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 36px;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" target="_blank" style="background-color: ${primaryColor}; color: #ffffff; padding: 14px 40px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.05); width: 80%; text-align: center;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
            ` : ''}

            <!-- Event Agenda -->
            <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Nội dung bạn sẽ nhận được</h3>
            
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
              <tr>
                <td width="28" valign="top">
                  <div style="color: ${primaryColor}; font-weight: bold; font-size: 16px;">✓</div>
                </td>
                <td>
                  <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 750; color: #0f172a;">Chiến lược Chuyển đổi Doanh nghiệp</h4>
                  <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">Khám phá các khung quy trình cụ thể mà Betech sử dụng để mở rộng cơ sở hạ tầng kỹ thuật số lên 300% trong vòng một năm tài chính.</p>
                </td>
              </tr>
            </table>

            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
              <tr>
                <td width="28" valign="top">
                  <div style="color: ${primaryColor}; font-weight: bold; font-size: 16px;">✓</div>
                </td>
                <td>
                  <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 750; color: #0f172a;">Nâng cao Hiệu quả bằng Trí tuệ Nhân tạo (AI)</h4>
                  <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">Các nghiên cứu thực tế chứng minh cách quy trình làm việc tự động giúp giảm chi phí vận hành trong các startup đang tăng trưởng nhanh.</p>
                </td>
              </tr>
            </table>

            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td width="28" valign="top">
                  <div style="color: ${primaryColor}; font-weight: bold; font-size: 16px;">✓</div>
                </td>
                <td>
                  <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 750; color: #0f172a;">Tương lai của Quản trị Kỹ thuật số</h4>
                  <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">Hiểu rõ các yêu cầu tuân thủ bảo mật mới nổi cho thế hệ ứng dụng điện toán đám mây tiếp theo.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Quote Banner -->
        <tr>
          <td style="background-image: url('https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80'); background-size: cover; background-position: center; padding: 48px 32px; text-align: center;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center">
                  <div style="background-color: rgba(15, 23, 42, 0.85); padding: 24px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); max-width: 500px;">
                    <p style="margin: 0 0 8px 0; font-size: 16px; font-style: italic; color: #ffffff; line-height: 1.5; font-weight: 500;">"Sự chính xác trong thực thi là dấu ấn của đổi mới hiện đại."</p>
                    <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Tuyên ngôn Kỹ thuật số Betech</p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #0f172a; padding: 32px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0 0 8px 0; line-height: 1.5; font-weight: 750; color: #ffffff;">Betech</p>
            <p style="margin: 0 0 16px 0; line-height: 1.5;">${footerText || '© 2024 Betech Digital Solutions. Bảo lưu mọi quyền.'}</p>
            <p style="margin: 0; font-size: 11px; color: #64748b;">Vui lòng không trả lời trực tiếp email này. Đây là hòm thư tự động gửi lời mời.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
      break;

    case 'monthly_news':
      html = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px 10px; margin: 0;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
        <!-- Header -->
        <tr>
          <td style="padding: 24px 32px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="left">
                  <span style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Betech</span>
                </td>
                <td align="right" style="font-size: 12px; font-weight: 700; color: #64748b;">
                  Tin chuyên sâu • Mạng lưới
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Banner Title -->
        <tr>
          <td style="padding: 32px 32px 10px 32px; background-color: #ffffff;">
            <span style="font-size: 11px; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">Số #42 • Tháng 01/2025</span>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #0f172a;">${headerTitle || 'Điểm tin Hàng tháng'}</h1>
          </td>
        </tr>
        <!-- Featured Image -->
        <tr>
          <td style="padding: 16px 32px 0 32px; background-color: #ffffff;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="position: relative; border-radius: 12px; overflow: hidden;">
                  <img src="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80" alt="Featured News" width="100%" style="display: block; width: 100%; border: 0; height: auto;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Featured Article Detail -->
        <tr>
          <td style="padding: 24px 32px 32px 32px; background-color: #ffffff; border-bottom: 8px solid #f8fafc;">
            <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.4;">Xu hướng Chuyển đổi Số 2025: Định hướng Biên giới Mới</h2>
            <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">Khi bước sang năm 2025, bối cảnh công nghệ doanh nghiệp đang chuyển dịch từ tự động hóa đơn thuần sang tích hợp nhận thức sâu rộng. Khám phá cách các tổ chức hàng đầu đang tận dụng kiến trúc từ biên đến đám mây để định nghĩa lại sự xuất sắc trong vận hành.</p>
            ${ctaUrl ? `<a href="${ctaUrl}" style="color: ${primaryColor}; font-size: 13px; font-weight: 750; text-decoration: none;">Đọc toàn bộ bài viết →</a>` : ''}
          </td>
        </tr>
        <!-- Secondary News Blocks -->
        <tr>
          <td style="padding: 32px; background-color: #ffffff;">
            <div style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 28px;">
              ${paragraphsHtml}
            </div>

            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <!-- Card 1 -->
                <td width="48%" valign="top" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                  <div style="font-size: 16px; margin-bottom: 8px;">💡</div>
                  <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 800; color: #0f172a;">Quản trị AI Tạo sinh</h4>
                  <p style="margin: 0 0 12px 0; font-size: 11px; color: #64748b; line-height: 1.4;">Thiết lập các khung quy chuẩn chặt chẽ để triển khai AI đạo đức trong quy trình nội bộ.</p>
                  <a href="#" style="color: ${primaryColor}; font-size: 11px; font-weight: bold; text-decoration: none;">TÌM HIỂU THÊM →</a>
                </td>
                <td width="4%"></td>
                <!-- Card 2 -->
                <td width="48%" valign="top" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                  <div style="font-size: 16px; margin-bottom: 8px;">☁️</div>
                  <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 800; color: #0f172a;">Phục hồi Đa đám mây</h4>
                  <p style="margin: 0 0 12px 0; font-size: 11px; color: #64748b; line-height: 1.4;">Cách hạ tầng phân tán đang bảo vệ doanh nghiệp khỏi các sự cố ngừng hoạt động khu vực.</p>
                  <a href="#" style="color: ${primaryColor}; font-size: 11px; font-weight: bold; text-decoration: none;">TÌM HIỂU THÊM →</a>
                </td>
              </tr>
            </table>

            <!-- Bottom Call to Action Box -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin-top: 28px;">
              <tr>
                <td>
                  <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 800; color: #0f172a;">Sẵn sàng để bứt phá?</h3>
                  <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b; line-height: 1.5;">Đặt lịch tư vấn với các chuyên gia chiến lược của chúng tôi để đánh giá hiện trạng công nghệ của bạn.</p>
                  ${ctaText && ctaUrl ? `
                    <a href="${ctaUrl}" target="_blank" style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 28px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block;">
                      ${ctaText}
                    </a>
                  ` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #0f172a; padding: 32px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0 0 8px 0; line-height: 1.5; font-weight: 750; color: #ffffff;">Betech</p>
            <p style="margin: 0 0 16px 0; line-height: 1.5;">${footerText || '© 2024 Betech Digital Solutions. Bảo lưu mọi quyền.'}</p>
            <p style="margin: 0; font-size: 11px; color: #64748b;">Bạn nhận được email này vì đã đăng ký nhận bản tin từ hệ thống.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
      break;

    case 'ai_showcase':
      html = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px 10px; margin: 0;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
        <!-- Header -->
        <tr>
          <td style="padding: 24px 32px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="left">
                  <span style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Betech</span>
                </td>
                <td align="right" style="font-size: 12px; font-weight: 700; color: #64748b;">
                  Tin tức AI • Dịch vụ
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Hero Section -->
        <tr>
          <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 48px 32px; text-align: center; color: #ffffff; border-bottom: 4px solid ${primaryColor};">
            <span style="font-size: 11px; font-weight: 850; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">Tương lai của Web</span>
            <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #ffffff; line-height: 1.3;">${headerTitle || 'Nâng tầm Website với Trí tuệ nhân tạo (AI)'}</h1>
            <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8; font-weight: 500;">Tích hợp các giải pháp AI đột phá để tối ưu hóa trải nghiệm người dùng và tự động hóa quy trình kinh doanh của bạn.</p>
            ${ctaText && ctaUrl ? `
              <a href="${ctaUrl}" target="_blank" style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 28px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block;">
                ${ctaText}
              </a>
            ` : ''}
          </td>
        </tr>
        <!-- Main Screenshot Image -->
        <tr>
          <td style="padding: 32px 32px 0 32px; background-color: #ffffff;">
            <img src="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80" alt="AI Agent Interface" width="100%" style="display: block; width: 100%; border: 0; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.08);" />
          </td>
        </tr>
        <!-- Body Content -->
        <tr>
          <td style="padding: 32px; background-color: #ffffff;">
            <div style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 28px;">
              ${paragraphsHtml}
            </div>

            <!-- Features Cards List -->
            <div>
              <!-- Feature 1 -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                <tr>
                  <td width="48" valign="top">
                    <div style="width: 36px; height: 36px; line-height: 36px; border-radius: 8px; background-color: #eff6ff; color: ${primaryColor}; text-align: center; font-size: 18px;">🔍</div>
                  </td>
                  <td>
                    <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 800; color: #0f172a;">Gợi ý SEO Thông minh</h4>
                    <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">Hệ thống AI tự động phân tích từ khóa, cấu trúc nội dung và đề xuất tối ưu hóa để website đạt thứ hạng cao nhất trên Google.</p>
                  </td>
                </tr>
              </table>

              <!-- Feature 2 -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                <tr>
                  <td width="48" valign="top">
                    <div style="width: 36px; height: 36px; line-height: 36px; border-radius: 8px; background-color: #eff6ff; color: ${primaryColor}; text-align: center; font-size: 18px;">🤖</div>
                  </td>
                  <td>
                    <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 800; color: #0f172a;">AI Chatbots Thế Hệ Mới</h4>
                    <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">Hỗ trợ khách hàng 24/7 với khả năng hiểu ngôn ngữ tự nhiên, tư vấn sản phẩm và chốt đơn tự động theo kịch bản thông minh.</p>
                  </td>
                </tr>
              </table>

              <!-- Feature 3 -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
                <tr>
                  <td width="48" valign="top">
                    <div style="width: 36px; height: 36px; line-height: 36px; border-radius: 8px; background-color: #eff6ff; color: ${primaryColor}; text-align: center; font-size: 18px;">🔄</div>
                  </td>
                  <td>
                    <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 800; color: #0f172a;">Tự Động Hóa Quy Trình</h4>
                    <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">Giảm thiểu sai sót và tiết kiệm thời gian bằng cách tự động hóa các tác vụ lặp đi lặp lại thông qua các quy trình AI tùy chỉnh.</p>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Bottom Box -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #eff6ff; border-radius: 12px; border: 1px solid #dbeafe; padding: 24px; text-align: center; margin-top: 28px;">
              <tr>
                <td>
                  <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 800; color: #1e3a8a;">Sẵn sàng để dẫn đầu xu hướng?</h3>
                  <p style="margin: 0 0 16px 0; font-size: 13px; color: #1e40af; line-height: 1.5;">Hãy để chuyên gia của chúng tôi tư vấn giải pháp AI phù hợp nhất cho doanh nghiệp của bạn.</p>
                  ${ctaUrl ? `
                    <table border="0" cellpadding="0" cellspacing="0" align="center">
                      <tr>
                        <td>
                          <a href="${ctaUrl}" target="_blank" style="background-color: ${primaryColor}; color: #ffffff; padding: 10px 20px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 6px; display: inline-block;">
                            Đặt lịch tư vấn
                          </a>
                        </td>
                      </tr>
                    </table>
                  ` : ''}
                </td>
              </tr>
            </table>

          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #0f172a; padding: 32px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0 0 8px 0; line-height: 1.5; font-weight: 750; color: #ffffff;">Betech</p>
            <p style="margin: 0 0 16px 0; line-height: 1.5;">${footerText || '© 2024 Betech Digital Solutions. Bảo lưu mọi quyền.'}</p>
            <p style="margin: 0; font-size: 11px; color: #64748b;">Bạn nhận được email này vì đã quan tâm dịch vụ AI từ Betech.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
      break;

    case 'enterprise_services':
      html = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px 10px; margin: 0;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
        <!-- Header -->
        <tr>
          <td style="padding: 24px 32px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="left">
                  <span style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Betech</span>
                </td>
                <td align="right">
                  ${ctaUrl ? `<a href="${ctaUrl}" style="background-color: ${primaryColor}; color: #ffffff; padding: 8px 16px; font-size: 12px; font-weight: 700; text-decoration: none; border-radius: 6px;">Bắt đầu ngay</a>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Hero Section -->
        <tr>
          <td style="background: #1e293b; padding: 48px 32px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 800; color: #ffffff; line-height: 1.3;">Biến ý tưởng trở thành sản phẩm công nghệ hoàn chỉnh</h1>
            <p style="margin: 0 20px 20px 20px; font-size: 14px; line-height: 1.5; color: #cbd5e1;">Chúng tôi xây dựng hạ tầng tăng trưởng dựa trên kiến trúc hiệu suất cao và tích hợp AI cho doanh nghiệp của bạn.</p>
            ${ctaText && ctaUrl ? `
              <a href="${ctaUrl}" target="_blank" style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 28px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block;">
                ${ctaText}
              </a>
            ` : ''}
          </td>
        </tr>
        <!-- Body Content -->
        <tr>
          <td style="padding: 32px; background-color: #ffffff;">
            <span style="font-size: 11px; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">Dịch vụ của chúng tôi</span>
            <h3 style="margin: 0 0 24px 0; font-size: 18px; font-weight: 800; color: #0f172a;">${headerTitle || 'Giải pháp doanh nghiệp toàn diện'}</h3>

            <div style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 28px;">
              ${paragraphsHtml}
            </div>

            <!-- 3 Grid Boxes -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
              <tr>
                <td width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; display: block;">
                  <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 800; color: #0f172a;">💻 Phát triển Website</h4>
                  <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.4;">Sự kết hợp tinh tế giữa độc đáo, chất lượng và trải nghiệm người dùng xuất sắc.</p>
                </td>
              </tr>
              <tr>
                <td width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; display: block;">
                  <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 800; color: #0f172a;">🖊 Nhận Diện Thương Hiệu</h4>
                  <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.4;">Nâng tầm thương hiệu của bạn với bộ nhận diện chuyên nghiệp.</p>
                </td>
              </tr>
              <tr>
                <td width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: block;">
                  <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 800; color: #0f172a;">📢 Tiếp Thị Đa Kênh</h4>
                  <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.4;">Tối ưu hóa chi phí và thu hút khách hàng tiềm năng hiệu quả.</p>
                </td>
              </tr>
            </table>

            <!-- Testimonial -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #eff6ff; border-radius: 12px; border: 1px solid #dbeafe; padding: 24px; margin-bottom: 28px;">
              <tr>
                <td>
                  <div style="color: #fbbf24; font-size: 14px; margin-bottom: 10px;">★★★★★</div>
                  <p style="margin: 0 0 16px 0; font-size: 13px; color: #1e3a8a; font-style: italic; line-height: 1.6;">"Betech tự hào là đơn vị cung cấp dịch vụ website cao cấp được các doanh nghiệp tin tưởng để xây dựng thương hiệu."</p>
                  <table border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="32">
                        <div style="width: 32px; height: 32px; line-height: 32px; border-radius: 50%; background-color: ${primaryColor}; color: #ffffff; text-align: center; font-size: 14px; font-weight: 800;">B</div>
                      </td>
                      <td style="padding-left: 10px;">
                        <div style="font-size: 12px; font-weight: 800; color: #1e3a8a;">Hội đồng quản trị</div>
                        <div style="font-size: 10px; color: #60a5fa;">Betech Digital Solutions</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Screenshot image -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
              <tr>
                <td>
                  <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80" alt="Website on devices" width="100%" style="display: block; width: 100%; border: 0; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);" />
                </td>
              </tr>
            </table>

            <!-- Bottom Contact -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center;">
              <tr>
                <td>
                  <h4 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 800; color: #0f172a;">Sẵn sàng để bứt phá?</h4>
                  <p style="margin: 0 0 16px 0; font-size: 12px; color: #64748b; line-height: 1.5;">Liên hệ với chúng tôi ngay hôm nay để nhận tư vấn miễn phí.</p>
                  <table border="0" cellpadding="0" cellspacing="0" align="center">
                    <tr>
                      <td style="padding-right: 12px;">
                        <a href="tel:0775600351" style="background-color: #1e293b; color: #ffffff; padding: 10px 20px; font-size: 12px; font-weight: 700; text-decoration: none; border-radius: 6px; display: inline-block;">
                          📞 0775600351
                        </a>
                      </td>
                      <td>
                        <a href="mailto:admin@betech-digital.com" style="background-color: #ffffff; border: 1px solid #e2e8f0; color: #1e293b; padding: 10px 20px; font-size: 12px; font-weight: 700; text-decoration: none; border-radius: 6px; display: inline-block;">
                          ✉ Gửi Email
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #0f172a; padding: 32px; text-align: center; font-size: 11px; color: #94a3b8;">
            <p style="margin: 0 0 8px 0; line-height: 1.5; font-weight: 750; color: #ffffff;">Betech</p>
            <p style="margin: 0 0 8px 0; line-height: 1.4;">📍 92A-94 Bạch Đằng, P.2, Q.Tân Bình, TP.HCM</p>
            <p style="margin: 0 0 16px 0; line-height: 1.4;">✉ admin@betech-digital.com</p>
            <p style="margin: 0 0 8px 0; line-height: 1.5;">${footerText || '© 2024 Betech Digital Solutions. Bảo lưu mọi quyền.'}</p>
            <p style="margin: 0; font-size: 10px; color: #64748b;">Bạn nhận được email này vì bạn là đối tác của Betech Digital.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
      break;

    default:
      html = renderTextToHtmlParagraphs(bodyText);
  }

  // Append metadata block as an HTML comment
  const metadataComment = `\n<!-- TEMPLATE_METADATA: ${JSON.stringify({ ...metadata, bodyText })} -->`;
  
  if (trackOpenUrlPlaceholder && !html.includes(trackOpenUrlPlaceholder)) {
    return html + '\n' + trackOpenUrlPlaceholder + metadataComment;
  }
  return html + metadataComment;
}

function parseTemplateMetadata(html: string): { bodyText: string; metadata: TemplateMetadata } | null {
  if (!html) return null;
  const match = html.match(/<!-- TEMPLATE_METADATA: ([\s\S]*?) -->/);
  if (!match) return null;
  try {
    const metadata = JSON.parse(match[1]) as TemplateMetadata & { bodyText?: string };
    const bodyText = metadata.bodyText || '';
    const cleanMetadata = { ...metadata };
    delete (cleanMetadata as any).bodyText;
    return {
      bodyText,
      metadata: cleanMetadata as TemplateMetadata
    };
  } catch (e) {
    console.error('Failed to parse template metadata', e);
    return null;
  }
}

export default function EmailCampaignsPage() {
  const { t } = useLocale();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  // AI Assistant states
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiUrl, setAiUrl] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiInfoTip, setAiInfoTip] = useState('');

  // Inline CRM selector collapse state
  const [showInlineSelector, setShowInlineSelector] = useState(false);

  // Template customizer states
  const [templateStyle, setTemplateStyle] = useState<TemplateMetadata['style']>('simple');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [headerTitle, setHeaderTitle] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [footerText, setFooterText] = useState('');

  const fetchCustomers = async () => {
    try {
      const res = await apiJson<{ data: any[] }>('/customers?limit=500');
      setCustomers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const openCustomerModal = () => {
    fetchCustomers();
    const existing = form.recipients
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    setSelectedEmails(existing);
    setIsCustomerModalOpen(true);
  };

  const handleToggleEmail = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const handleSelectAll = () => {
    const filteredCustomers = customers.filter(
      (c) =>
        (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
    const filteredEmails = filteredCustomers.map((c) => c.email).filter(Boolean);
    setSelectedEmails((prev) => {
      const union = new Set([...prev, ...filteredEmails]);
      return Array.from(union);
    });
  };

  const handleDeselectAll = () => {
    const filteredCustomers = customers.filter(
      (c) =>
        (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
    const filteredEmails = filteredCustomers.map((c) => c.email).filter(Boolean);
    setSelectedEmails((prev) => prev.filter((e) => !filteredEmails.includes(e)));
  };

  const handleApplyCustomers = () => {
    setForm((prev) => ({
      ...prev,
      recipients: selectedEmails.join(', '),
    }));
    setIsCustomerModalOpen(false);
  };

  const getEmailsFromRecipients = (recipientsStr: string): string[] => {
    if (!recipientsStr) return [];
    return recipientsStr
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  };

  const toggleRecipientEmail = (email: string) => {
    if (!email) return;
    const emailLower = email.toLowerCase().trim();
    const currentEmails = getEmailsFromRecipients(form.recipients);
    let newEmails: string[];
    if (currentEmails.includes(emailLower)) {
      newEmails = currentEmails.filter((e) => e !== emailLower);
    } else {
      newEmails = [...currentEmails, emailLower];
    }
    setForm((prev) => ({
      ...prev,
      recipients: newEmails.join(', '),
    }));
  };

  const handleSelectAllInline = () => {
    const filteredCustomers = customers.filter(
      (c) =>
        (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
    const filteredEmails = filteredCustomers
      .map((c) => c.email?.toLowerCase().trim())
      .filter(Boolean) as string[];
      
    const currentEmails = getEmailsFromRecipients(form.recipients);
    const union = new Set([...currentEmails, ...filteredEmails]);
    
    setForm((prev) => ({
      ...prev,
      recipients: Array.from(union).join(', '),
    }));
  };

  const handleDeselectAllInline = () => {
    const filteredCustomers = customers.filter(
      (c) =>
        (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
    const filteredEmails = filteredCustomers
      .map((c) => c.email?.toLowerCase().trim())
      .filter(Boolean) as string[];
      
    const currentEmails = getEmailsFromRecipients(form.recipients);
    const remaining = currentEmails.filter((e) => !filteredEmails.includes(e));
    
    setForm((prev) => ({
      ...prev,
      recipients: remaining.join(', '),
    }));
  };

  const insertPlaceholder = (ph: string) => {
    setForm((prev) => ({
      ...prev,
      htmlContent: prev.htmlContent + ph,
    }));
  };

  const handleGenerateAi = async () => {
    if (!aiUrl.trim()) {
      setError(t('Vui lòng nhập URL đích để AI phân tích.'));
      return;
    }
    setGenerating(true);
    setError('');
    setAiInfoTip('');
    try {
      const data = await apiJson<{
        title: string;
        content: string;
        imageUrl: string | null;
        isDemo: boolean;
      }>('/templates/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urlTarget: aiUrl.trim(),
          aiPrompt: aiPrompt.trim(),
          generateImage: false,
        }),
      });

      let formattedContent = data.content;
      if (formattedContent.includes('{url}')) {
        formattedContent = formattedContent.replace(/\{url\}/g, aiUrl.trim());
      }

      setForm((prev) => ({
        ...prev,
        name: data.title || prev.name,
        subject: data.title || prev.subject,
        htmlContent: formattedContent || prev.htmlContent,
      }));

      if (data.isDemo) {
        setAiInfoTip(t('Đang chạy ở chế độ Demo (chưa cấu hình OpenAI API Key). Thêm OPENAI_API_KEY ở file .env để chạy thực tế.'));
      } else {
        setAiInfoTip(t('AI đã tự động viết tiêu đề và nội dung email thành công dựa trên phân tích URL đích.'));
      }
      setShowAiPanel(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Lỗi gọi AI'));
    } finally {
      setGenerating(false);
    }
  };

  const load = () =>
    apiJson<Campaign[]>('/email-campaigns')
      .then(setCampaigns)
      .catch((e) => setError(e instanceof Error ? e.message : t('Lỗi tải danh sách')));

  useEffect(() => {
    load();
    fetchCustomers();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowAiPanel(false);
    setAiUrl('');
    setAiPrompt('');
    setAiInfoTip('');
    setTemplateStyle('simple');
    setPrimaryColor('#3b82f6');
    setHeaderTitle('');
    setCtaText('');
    setCtaUrl('');
    setFooterText('');
  };

  const startEdit = (c: Campaign) => {
    if (c.status === 'SENT') return;
    setEditingId(c.id);
    const parsed = parseTemplateMetadata(c.htmlContent);
    if (parsed) {
      setTemplateStyle(parsed.metadata.style);
      setPrimaryColor(parsed.metadata.primaryColor);
      setHeaderTitle(parsed.metadata.headerTitle || '');
      setCtaText(parsed.metadata.ctaText || '');
      setCtaUrl(parsed.metadata.ctaUrl || '');
      setFooterText(parsed.metadata.footerText || '');
      setForm({
        name: c.name,
        subject: c.subject,
        htmlContent: parsed.bodyText,
        recipients: c.recipients,
        scheduledAt: toDatetimeLocal(c.scheduledAt),
      });
    } else {
      setTemplateStyle('simple');
      setPrimaryColor('#3b82f6');
      setHeaderTitle(c.subject || '');
      setCtaText('');
      setCtaUrl('');
      setFooterText('');
      const cleanHtml = c.htmlContent.replace(/\{track_open\}/g, '').trim();
      const cleanContent = formatHtmlToContent(cleanHtml);
      setForm({
        name: c.name,
        subject: c.subject,
        htmlContent: cleanContent,
        recipients: c.recipients,
        scheduledAt: toDatetimeLocal(c.scheduledAt),
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    const metadata: TemplateMetadata = {
      style: templateStyle,
      primaryColor,
      headerTitle: headerTitle || form.subject,
      ctaText: ctaText || undefined,
      ctaUrl: ctaUrl || undefined,
      footerText: footerText || undefined,
    };
    
    const finalHtml = compileEmailHtml(form.htmlContent, metadata, '{track_open}');
    
    const payload = {
      ...form,
      htmlContent: finalHtml,
      scheduledAt: form.scheduledAt || null,
    };
    try {
      if (editingId) {
        await apiJson(`/email-campaigns/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess(t('Đã cập nhật chiến dịch thành công.'));
      } else {
        await apiJson('/email-campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess(
          form.scheduledAt
            ? t('Đã lên lịch gửi email. Hệ thống sẽ tự động quét gửi theo thời gian hẹn.')
            : t('Đã tạo bản nháp thành công. Bạn có thể bấm gửi ngay ở bảng bên dưới.')
        );
      }
      resetForm();
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không lưu được'));
    }
  };

  const send = async (id: number) => {
    setError('');
    setSuccess('');
    setSendingId(id);
    try {
      const r = await apiJson<{ message: string; sent: number; total: number }>(
        `/email-campaigns/${id}/send`,
        { method: 'POST' }
      );
      setSuccess(r.message || t('Đã gửi') + ` ${r.sent} ` + t('email thành công.'));
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Gửi email thất bại'));
      load();
    } finally {
      setSendingId(null);
    }
  };

  const remove = async (id: number) => {
    if (!confirm(t('Xóa chiến dịch này?'))) return;
    try {
      await apiJson(`/email-campaigns/${id}`, { method: 'DELETE' });
      if (editingId === id) resetForm();
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không xóa được'));
    }
  };

  // Compute metrics
  const totalCampaigns = campaigns.length;
  const sentCampaigns = campaigns.filter((c) => c.status === 'SENT').length;
  
  const totalSentCount = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
  const totalOpenCount = campaigns.reduce((sum, c) => sum + c.openCount, 0);
  const totalClickCount = campaigns.reduce((sum, c) => sum + c.clickCount, 0);

  const avgOpenRate = totalSentCount > 0 ? Math.round((totalOpenCount / totalSentCount) * 100) : 0;
  const avgClickRate = totalSentCount > 0 ? Math.round((totalClickCount / totalSentCount) * 100) : 0;

  // Chart Data Preparation (Latest 5 sent campaigns)
  const chartData = campaigns
    .filter((c) => c.status === 'SENT')
    .slice(0, 5)
    .reverse()
    .map((c) => ({
      name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
      [t('Đã gửi')]: c.sentCount,
      [t('Đã mở')]: c.openCount,
      [t('Lượt click')]: c.clickCount,
    }));

  const getStatusBadgeClass = (status: string) => {
    switch (status.toUpperCase()) {
      case 'SENT':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'SCHEDULED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'FAILED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        // DRAFT
        return 'bg-slate-50 text-slate-650 border-slate-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toUpperCase()) {
      case 'SENT':
        return t('Đã gửi');
      case 'SCHEDULED':
        return t('Đã lên lịch');
      case 'FAILED':
        return t('Thất bại');
      default:
        return t('Bản nháp');
    }
  };

  return (
    <div className="space-y-8 page-container">
      <PageHeader
        title={t('Email marketing')}
        description={t('Quản lý, soạn thảo, hẹn giờ gửi chiến dịch và đo lường tỷ lệ tương tác của người nhận.')}
      />

      {error && <div className="alert-error text-sm">{error}</div>}
      {success && <div className="alert-info text-sm">{success}</div>}

      {/* Help Banner */}
      <div className="bg-brand/5 border border-brand/10 rounded-2xl p-5 shadow-sm">
        <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
          {t('Hướng dẫn soạn thảo & Gửi chiến dịch')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-650 leading-relaxed">
          <div>
            <p className="font-bold text-slate-700 mb-1">1. Địa chỉ nhận:</p>
            <p>Chọn từ danh sách khách hàng bên dưới hoặc nhập thủ công ngăn cách bằng dấu phẩy. Ví dụ: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-750 font-semibold">khach1@gmail.com, khach2@gmail.com</code></p>
          </div>
          <div>
            <p className="font-bold text-slate-700 mb-1">2. Cá nhân hóa email:</p>
            <p className="flex items-center flex-wrap gap-1 mb-1.5">
              Click vào nút
              <button
                type="button"
                className="bg-brand text-white text-[10px] px-2.5 py-0.5 rounded font-bold hover:bg-brand-hover transition-colors cursor-pointer shadow-sm"
                title={t('Click để chèn thẻ cá nhân hóa email')}
                onClick={() => insertPlaceholder('{email}')}
              >
                {t('Cá nhân hóa Email')}
              </button>
              để tự động hiển thị email người nhận khi gửi.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics & Performance Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metric Cards */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-2xl border border-brand/15 shadow-sm flex items-center gap-4 hover:border-brand/35 transition-all">
            <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center text-xs font-bold uppercase">Mail</div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('Tổng số thư đã gửi')}</div>
              <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{totalSentCount}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{t('Từ')} {sentCampaigns} {t('chiến dịch đã chạy')}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-brand/15 shadow-sm flex items-center gap-4 hover:border-brand/35 transition-all">
            <div className="w-11 h-11 rounded-xl bg-green-50 text-green-600 flex items-center justify-center text-xs font-bold uppercase">Open</div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('Tỷ lệ Mở thư (Open Rate)')}</div>
              <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{avgOpenRate}%</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{t('Tổng số lượt mở thư ghi nhận:')} {totalOpenCount}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-brand/15 shadow-sm flex items-center gap-4 hover:border-brand/35 transition-all">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold uppercase">CTR</div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('Tỷ lệ Click link (CTR)')}</div>
              <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{avgClickRate}%</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{t('Tổng số nhấp liên kết:')} {totalClickCount}</div>
            </div>
          </div>
        </div>

        {/* Grouped Bar Chart */}
        <div className="lg:col-span-2 card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">{t('Hiệu suất 5 chiến dịch gần đây')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t('So sánh tương quan giữa số lượng gửi, lượt mở và số lần nhấp link.')}</p>
          </div>
          <div className="w-full h-40 mt-4">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">{t('Không có dữ liệu biểu đồ (chưa gửi chiến dịch nào)')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <ChartTooltip />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey={t('Đã gửi')} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey={t('Đã mở')} fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey={t('Lượt click')} fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Editor and Campaigns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Editor Form - 2/5 cols */}
        <form onSubmit={save} className="lg:col-span-2 card p-6 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-black text-slate-800 text-sm border-b pb-3 mb-4">
              {editingId ? `${t('Sửa chiến dịch')} #${editingId}` : t('Tạo chiến dịch mới')}
            </h3>

            {aiInfoTip && <div className="alert-info text-[11px] font-bold py-2">{aiInfoTip}</div>}

            {/* AI Assistant Panel */}
            {!editingId && (
              <div className="bg-orange-50/40 rounded-xl p-3 border border-brand/15 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-brand flex items-center gap-1.5">
                    ✨ {t('Trợ lý AI tự viết Email')}
                  </span>
                  <button
                    type="button"
                    className="text-[10px] font-extrabold bg-white text-brand border border-brand/35 px-2 py-0.5 rounded shadow-sm cursor-pointer hover:bg-orange-50 transition-colors"
                    onClick={() => setShowAiPanel(!showAiPanel)}
                  >
                    {showAiPanel ? t('Đóng AI Panel') : t('Mở AI Panel')}
                  </button>
                </div>

                {showAiPanel && (
                  <div className="mt-3 pt-3 border-t border-brand/10 space-y-3">
                    <div>
                      <label className="block font-bold text-slate-500 uppercase mb-1 text-[10px]">{t('URL trang đích để AI phân tích *')}</label>
                      <input
                        className="input text-xs w-full py-1.5 bg-white"
                        type="url"
                        placeholder="https://your-site.com/landing-page"
                        value={aiUrl}
                        onChange={(e) => setAiUrl(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block font-bold text-slate-500 uppercase mb-1 text-[10px]">{t('Chủ đề hoặc Yêu cầu viết Email')}</label>
                      <textarea
                        className="input text-xs w-full py-1.5 bg-white min-h-[55px]"
                        placeholder={t('Ví dụ: Viết thư mời dùng thử gói Pro, nhấn mạnh lợi ích và ưu đãi giảm giá...')}
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      className="w-full py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-colors text-xs shadow-sm cursor-pointer disabled:opacity-50"
                      disabled={generating}
                      onClick={handleGenerateAi}
                    >
                      {generating ? t('AI đang viết thư...') : t('Tạo nội dung thư bằng AI')}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Tên chiến dịch *')}</label>
              <input
                className="input w-full text-xs"
                placeholder={t('Ví dụ: Bản tin tuần 24')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Tiêu đề thư (Subject) *')}</label>
              <input
                className="input w-full text-xs"
                placeholder={t('Ví dụ: Bí quyết thu hút Free Traffic hiệu quả')}
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">{t('Danh sách Email nhận (cách nhau bởi dấu phẩy) *')}</label>
                <button
                  type="button"
                  onClick={openCustomerModal}
                  className="text-xs text-brand hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  {t('Xem danh sách lớn')}
                </button>
              </div>
              <input
                className="input w-full text-xs"
                placeholder="customer1@gmail.com, customer2@yahoo.com"
                value={form.recipients}
                onChange={(e) => setForm({ ...form, recipients: e.target.value })}
                required
              />
              
              {/* Inline Quick CRM Selection */}
              <div className="mt-2 border border-slate-100 rounded-lg p-2.5 bg-slate-50/50">
                <div 
                  className="flex items-center justify-between gap-2 cursor-pointer select-none"
                  onClick={() => setShowInlineSelector(!showInlineSelector)}
                >
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    👥 {t('Chọn nhanh từ Khách hàng')} {showInlineSelector ? '▲' : '▼'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {t('Đang chọn')}: <strong className="text-brand">{getEmailsFromRecipients(form.recipients).length}</strong>
                  </span>
                </div>
                
                {showInlineSelector && (
                  <div className="mt-2.5 space-y-2">
                    <input
                      type="text"
                      placeholder={t('Tìm nhanh khách hàng...')}
                      className="input w-full text-[11px] py-1 px-2 mb-2 bg-white"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    
                    <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1 custom-scrollbar text-xs bg-white border border-slate-100 rounded-md p-1.5">
                      {customers.length === 0 ? (
                        <p className="text-center text-[10px] text-slate-400 py-3">{t('Đang tải danh sách...')}</p>
                      ) : (
                        (() => {
                          const filtered = customers.filter(
                            (c) =>
                              (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                              (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
                          );
                          if (filtered.length === 0) {
                            return <p className="text-center text-[10px] text-slate-400 py-3">{t('Không tìm thấy')}</p>;
                          }
                          
                          const selectedEmailsSet = new Set(getEmailsFromRecipients(form.recipients));
                          
                          return filtered.map((c) => {
                            const hasEmail = c.email && c.email.trim();
                            if (!hasEmail) return null;
                            const emailLower = c.email.toLowerCase().trim();
                            const isChecked = selectedEmailsSet.has(emailLower);
                            
                            return (
                              <label key={c.id} className="flex items-center gap-2 p-1 rounded hover:bg-slate-50 cursor-pointer transition-colors text-[11px]">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-350 text-brand focus:ring-brand h-3.5 w-3.5 cursor-pointer"
                                  checked={isChecked}
                                  onChange={() => toggleRecipientEmail(c.email)}
                                />
                                <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                                  <span className="font-semibold text-slate-700 truncate max-w-[120px]">{c.name || 'Khách hàng'}</span>
                                  <span className="text-slate-400 text-[10px] truncate">{c.email}</span>
                                </div>
                              </label>
                            );
                          });
                        })()
                      )}
                    </div>
                    
                    <div className="flex justify-between gap-2 mt-1.5 text-[10px] font-bold border-t pt-1.5 border-slate-100">
                      <button
                        type="button"
                        className="text-brand hover:underline cursor-pointer"
                        onClick={handleSelectAllInline}
                      >
                        {t('Chọn tất cả kết quả')}
                      </button>
                      <button
                        type="button"
                        className="text-slate-500 hover:underline cursor-pointer"
                        onClick={handleDeselectAllInline}
                      >
                        {t('Bỏ chọn tất cả')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Template Customizer Panel */}
            <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200 text-xs space-y-3">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                🎨 {t('Cấu hình Email Template')}
              </span>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Chọn Giao diện')}</label>
                  <select
                    className="input w-full text-xs py-1 px-2 bg-white cursor-pointer"
                    value={templateStyle}
                    onChange={(e) => setTemplateStyle(e.target.value as any)}
                  >
                    <option value="simple">{t('Tối giản (Simple)')}</option>
                    <option value="newsletter">{t('Bản tin (Newsletter)')}</option>
                    <option value="promotion">{t('Khuyến mãi (Promotion)')}</option>
                    <option value="announcement">{t('Thông báo (Announcement)')}</option>
                    <option value="welcome">{t('Chào mừng (Welcome)')}</option>
                    <option value="thankyou">{t('Tri ân (Appreciation)')}</option>
                    <option value="event">{t('Sự kiện (Event)')}</option>
                    <option value="monthly_news">{t('Bản tin tháng (Monthly Newsletter)')}</option>
                    <option value="ai_showcase">{t('Giải pháp AI (AI Showcase)')}</option>
                    <option value="enterprise_services">{t('Dịch vụ doanh nghiệp (Enterprise)')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Màu chủ đạo')}</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0 bg-transparent"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                    />
                    <select
                      className="input flex-1 text-xs py-1 px-2 bg-white cursor-pointer"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                    >
                      <option value="#3b82f6">{t('Xanh dương')}</option>
                      <option value="#10b981">{t('Lục bảo')}</option>
                      <option value="#8b5cf6">{t('Tím')}</option>
                      <option value="#f59e0b">{t('Cam')}</option>
                      <option value="#ef4444">{t('Đỏ thương hiệu')}</option>
                      <option value="#111827">{t('Đen sang trọng')}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Tiêu đề biểu ngữ (Header Title)')}</label>
                <input
                  type="text"
                  className="input w-full text-xs py-1.5 bg-white"
                  placeholder={t('Ví dụ: BẢN TIN KHỞI NGHIỆP')}
                  value={headerTitle}
                  onChange={(e) => setHeaderTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Nhãn nút bấm (CTA Button)')}</label>
                  <input
                    type="text"
                    className="input w-full text-xs py-1.5 bg-white"
                    placeholder={t('Ví dụ: Xem chi tiết')}
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Liên kết nút bấm (CTA URL)')}</label>
                  <input
                    type="url"
                    className="input w-full text-xs py-1.5 bg-white"
                    placeholder="https://example.com/promotion"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Nội dung chân trang (Footer Text)')}</label>
                <input
                  type="text"
                  className="input w-full text-xs py-1.5 bg-white"
                  placeholder={t('Ví dụ: Bản quyền © 2026 Free Traffic System. Đã đăng ký.')}
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Hẹn giờ gửi (Để trống để lưu nháp)')}</label>
              <input
                className="input w-full text-xs"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">{t('Nội dung Email *')}</label>
                <div className="flex bg-slate-100 rounded-lg p-0.5 text-[10px]">
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      activeTab === 'edit' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    onClick={() => setActiveTab('edit')}
                  >
                    {t('Soạn thảo')}
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      activeTab === 'preview' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    onClick={() => setActiveTab('preview')}
                  >
                    {t('Xem trước')}
                  </button>
                </div>
              </div>
              {activeTab === 'edit' ? (
                <textarea
                  className="input w-full min-h-[180px] text-xs p-3 bg-slate-50 focus:bg-white"
                  placeholder={t('Viết nội dung thư tại đây. Ví dụ: Chào {email},')}
                  value={form.htmlContent}
                  onChange={(e) => setForm({ ...form, htmlContent: e.target.value })}
                  required
                />
              ) : (
                <div 
                  className="w-full min-h-[300px] bg-slate-50 border border-slate-200 rounded-lg overflow-y-auto max-h-[450px] text-xs shadow-inner"
                  dangerouslySetInnerHTML={{
                    __html: compileEmailHtml(form.htmlContent, {
                      style: templateStyle,
                      primaryColor,
                      headerTitle: headerTitle || form.subject || t('Tiêu đề biểu ngữ'),
                      ctaText: ctaText || undefined,
                      ctaUrl: ctaUrl || undefined,
                      footerText: footerText || undefined,
                    }, '').replace(/\{email\}/g, 'customer@example.com')
                  }}
                />
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t mt-4">
            <button type="submit" className="btn-primary flex-1 py-2 text-xs">
              {editingId ? t('Lưu thay đổi') : t('Tạo chiến dịch')}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary py-2 px-3 text-xs" onClick={resetForm}>
                {t('Hủy')}
              </button>
            )}
          </div>
        </form>

        {/* Campaigns List - 3/5 cols */}
        <div className="lg:col-span-3 card p-0 overflow-hidden flex flex-col shadow-sm table-wrap">
          <div className="p-4 border-b">
            <h3 className="text-sm font-bold text-slate-800">{t('Danh sách các chiến dịch')}</h3>
          </div>
          <table className="table-modern">
            <thead>
              <tr>
                <th>{t('Tên chiến dịch')}</th>
                <th>{t('Trạng thái')}</th>
                <th>{t('Lịch gửi')}</th>
                <th>{t('Gửi/Mở/Click')}</th>
                <th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400 text-xs">
                    {t('Chưa có chiến dịch nào được tạo. Hãy tạo mới ở khung bên trái.')}
                  </td>
                </tr>
              )}
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="font-medium text-slate-800 max-w-[150px] truncate" title={c.name}>
                    {c.name}
                    <span className="block text-[10px] text-slate-450 font-normal truncate mt-0.5" title={c.subject}>
                      Suj: {c.subject}
                    </span>
                  </td>
                  <td>
                    <span className={`px-2 py-0.5 border rounded text-[9px] font-extrabold uppercase tracking-wider ${getStatusBadgeClass(c.status)}`}>
                      {getStatusText(c.status)}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500 whitespace-nowrap">
                    {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString('vi-VN') : t('Gửi thủ công')}
                  </td>
                  <td>
                    <div className="text-xs font-bold text-slate-700">
                      {c.sentCount} <span className="text-[10px] text-slate-400 font-normal">{t('gửi')}</span> · {c.openCount} <span className="text-[10px] text-slate-400 font-normal">{t('mở')}</span> · {c.clickCount} <span className="text-[10px] text-slate-400 font-normal">{t('click')}</span>
                    </div>
                  </td>
                  <td className="space-x-3 text-right whitespace-nowrap">
                    {c.status !== 'SENT' ? (
                      <>
                        <button
                          type="button"
                          className="text-xs font-bold text-brand hover:underline"
                          onClick={() => startEdit(c)}
                        >
                          {t('Sửa')}
                        </button>
                        <button
                          type="button"
                          className="text-xs font-bold text-emerald-600 hover:underline"
                          onClick={() => send(c.id)}
                          disabled={sendingId === c.id}
                        >
                          {sendingId === c.id ? t('Đang gửi...') : t('Gửi ngay')}
                        </button>
                        <button
                          type="button"
                          className="text-xs font-bold text-red-500 hover:underline"
                          onClick={() => remove(c.id)}
                        >
                          {t('Xóa')}
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 italic">{t('Đã hoàn tất')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Selection Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <button 
              type="button"
              onClick={() => setIsCustomerModalOpen(false)}
              className="absolute top-4 right-4 text-xs font-semibold hover:text-gray-700 text-gray-400"
            >
              Đóng
            </button>
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              {t('Chọn Email khách hàng')}
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              {t('Tích chọn các khách hàng để gửi chiến dịch email marketing.')}
            </p>

            <input
              type="text"
              className="input w-full text-xs mb-3"
              placeholder={t('Tìm kiếm tên hoặc email...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="flex justify-between gap-2 mb-3 text-xs">
              <button
                type="button"
                className="text-brand hover:underline font-bold"
                onClick={handleSelectAll}
              >
                {t('Chọn tất cả kết quả')}
              </button>
              <button
                type="button"
                className="text-slate-500 hover:underline font-bold"
                onClick={handleDeselectAll}
              >
                {t('Bỏ chọn tất cả')}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[150px] border border-slate-100 rounded-lg p-2 space-y-2 max-h-[300px]">
              {customers.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">{t('Đang tải danh sách khách hàng...')}</p>
              ) : (
                (() => {
                  const filtered = customers.filter(
                    (c) =>
                      (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                      (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
                  );
                  if (filtered.length === 0) {
                    return <p className="text-center text-xs text-slate-400 py-8">{t('Không tìm thấy khách hàng nào.')}</p>;
                  }
                  return filtered.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs transition-colors">
                      <input
                        type="checkbox"
                        className="rounded border-slate-350 text-brand focus:ring-brand"
                        checked={selectedEmails.includes(c.email)}
                        onChange={() => handleToggleEmail(c.email)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{c.name || 'Khách hàng ẩn danh'}</p>
                        <p className="text-slate-400 truncate text-[10px]">{c.email}</p>
                      </div>
                      {c.status && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-slate-100 text-slate-500">
                          {c.status}
                        </span>
                      )}
                    </label>
                  ));
                })()
              )}
            </div>

            <div className="border-t pt-4 mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {t('Đã chọn')}: <strong className="text-brand">{selectedEmails.length}</strong> email
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-650 hover:bg-slate-50 text-xs font-bold rounded-lg transition-colors"
                >
                  {t('Hủy')}
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustomers}
                  className="px-5 py-2 bg-brand text-white hover:bg-brand-hover text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  {t('Áp dụng')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
