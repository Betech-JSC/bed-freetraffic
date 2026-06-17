"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapInEmailTemplate = wrapInEmailTemplate;
function wrapInEmailTemplate(templateName, data) {
    const name = data.customerName || 'Quý khách';
    const company = data.companyName || 'Doanh nghiệp';
    const email = data.email || 'Chưa cung cấp';
    const phone = data.phone || '0775600351';
    const content = data.bodyContentHTML || '';
    const title = data.title || 'Thông tin chăm sóc khách hàng';
    const coupon = data.couponCode || 'BETECH25';
    const cleanTemplate = (templateName || 'default').toLowerCase().trim();
    // Common styles
    const baseStyle = `
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: #334155;
    background-color: #f8fafc;
    margin: 0;
    padding: 20px 0;
    font-size: 14px;
    line-height: 1.6;
  `;
    const containerStyle = `
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
    border: 1px solid #e2e8f0;
  `;
    const headerStyle = `
    padding: 24px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #f1f5f9;
  `;
    const footerStyle = `
    background-color: #1e293b;
    color: #94a3b8;
    padding: 32px;
    text-align: center;
    font-size: 12px;
  `;
    const buttonStyle = `
    background-color: #e85d26;
    color: #ffffff;
    text-decoration: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: bold;
    display: inline-block;
    font-size: 13px;
    margin-top: 10px;
  `;
    if (cleanTemplate === 'default') {
        return `
      <div style="${baseStyle}">
        <div style="${containerStyle}">
          <div style="padding: 32px;">
            ${content}
          </div>
        </div>
      </div>
    `;
    }
    // Helper template for Header & Footer
    const renderHeader = (rightButtonText = 'Bắt đầu ngay', rightButtonUrl = 'https://betech-digital.com') => `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 20px 32px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
      <tr>
        <td>
          <span style="font-size: 22px; font-weight: 800; color: #e85d26; letter-spacing: -0.5px;">Betech</span>
        </td>
        <td align="right">
          <a href="${rightButtonUrl}" style="background-color: #e85d26; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 12px; display: inline-block;">${rightButtonText}</a>
        </td>
      </tr>
    </table>
  `;
    const renderFooter = (address = 'Bảo lưu mọi quyền © 2026 Betech Digital Solutions.') => `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1e293b; color: #94a3b8; padding: 32px; text-align: center; font-size: 12px;">
      <tr>
        <td align="center" style="padding-bottom: 16px;">
          <span style="font-size: 18px; font-weight: 800; color: #ffffff;">Betech</span>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom: 16px;">
          <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 10px;">Dịch vụ</a> | 
          <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 10px;">Chính sách Bảo mật</a> | 
          <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 10px;">Liên hệ</a> | 
          <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 10px;">Hủy đăng ký</a>
        </td>
      </tr>
      <tr>
        <td align="center" style="font-size: 11px; color: #64748b;">
          ${address}
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 16px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding: 0 8px;"><a href="#" style="color: #ffffff; text-decoration: none; font-size: 16px;">🌐</a></td>
              <td style="padding: 0 8px;"><a href="#" style="color: #ffffff; text-decoration: none; font-size: 16px;">🎥</a></td>
              <td style="padding: 0 8px;"><a href="#" style="color: #ffffff; text-decoration: none; font-size: 16px;">💼</a></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
    switch (cleanTemplate) {
        case 'welcome':
            return `
        <div style="${baseStyle}">
          <div style="${containerStyle}">
            ${renderHeader()}
            
            <!-- Banner Hero -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1e293b; color: #ffffff; padding: 40px 32px; text-align: center;">
              <tr>
                <td>
                  <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff; line-height: 1.3;">Chào mừng bạn đến với Betech</h1>
                  <p style="font-size: 13px; color: #cbd5e1; margin: 0; line-height: 1.5;">Chúng tôi rất vui mừng được đồng hành cùng bạn trên hành trình chuyển đổi số và phát triển giải pháp công nghệ bền vững.</p>
                </td>
              </tr>
            </table>

            <!-- Content Area -->
            <div style="padding: 32px 32px 16px 32px; background-color: #ffffff;">
              <div style="font-size: 14px; color: #334155; margin-bottom: 24px;">
                ${content}
              </div>
              
              <h3 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 32px 0 16px 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Khám phá sức mạnh công nghệ</h3>
              <p style="font-size: 13px; color: #64748b; margin-bottom: 24px;">Tại Betech, chúng tôi không chỉ xây dựng phần mềm; chúng tôi kiến tạo các giải pháp kỹ thuật số giúp doanh nghiệp của bạn bứt phá và dẫn đầu thị trường.</p>
            </div>

            <!-- Steps list -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 0 32px 32px 32px; background-color: #ffffff;">
              <tr>
                <td style="padding-bottom: 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #e85d26; padding: 16px;">
                    <tr>
                      <td>
                        <strong style="color: #0f172a; font-size: 14px;">1. Tư vấn chiến lược</strong>
                        <p style="margin: 6px 0 0 0; font-size: 12px; color: #475569;">Lắng nghe nhu cầu và phân tích chuyên sâu để tìm ra giải pháp tối ưu nhất cho doanh nghiệp.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom: 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #e85d26; padding: 16px;">
                    <tr>
                      <td>
                        <strong style="color: #0f172a; font-size: 14px;">2. Thiết kế giải pháp</strong>
                        <p style="margin: 6px 0 0 0; font-size: 12px; color: #475569;">Xây dựng kiến trúc hệ thống và giao diện người dùng hiện đại, tinh tế và dễ sử dụng.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #e85d26; padding: 16px;">
                    <tr>
                      <td>
                        <strong style="color: #0f172a; font-size: 14px;">3. Khởi chạy chuyên nghiệp</strong>
                        <p style="margin: 6px 0 0 0; font-size: 12px; color: #475569;">Triển khai dự án, tối ưu hóa hiệu suất và hỗ trợ vận hành chuyên nghiệp 24/7.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA Box -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 0 32px 32px 32px; background-color: #ffffff;">
              <tr>
                <td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #eff6ff; border-radius: 12px; padding: 24px; text-align: center;">
                    <tr>
                      <td>
                        <h4 style="margin: 0 0 8px 0; color: #1e3a8a; font-size: 15px; font-weight: 700;">Sẵn sàng để bắt đầu chưa?</h4>
                        <p style="margin: 0 0 16px 0; color: #3b82f6; font-size: 12px;">Hãy để các chuyên gia của Betech giúp bạn thực hiện hóa ý tưởng ngay hôm nay.</p>
                        <a href="https://betech-digital.com" style="${buttonStyle}; background-color: #2563eb; margin: 0;">Khám phá ngay</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            ${renderFooter()}
          </div>
        </div>
      `;
        case 'appreciation':
            return `
        <div style="${baseStyle}">
          <div style="${containerStyle}">
            ${renderHeader()}

            <!-- Banner Hero -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1e293b; color: #ffffff; padding: 40px 32px; text-align: center;">
              <tr>
                <td>
                  <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff; line-height: 1.3;">Cảm ơn Sự tin tưởng của Bạn</h1>
                  <p style="font-size: 13px; color: #cbd5e1; margin: 0; line-height: 1.5;">Chúng tôi rất vinh dự được đồng hành cùng bạn trong hành trình chuyển đổi số. Sự hợp tác của bạn là động lực để chúng tôi đổi mới mỗi ngày.</p>
                </td>
              </tr>
            </table>

            <!-- Content Area -->
            <div style="padding: 32px; background-color: #ffffff;">
              <div style="height: 3px; width: 40px; background-color: #e85d26; margin-bottom: 24px;"></div>
              
              <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">Kính gửi Đối tác thân thiết,</h4>
              
              <div style="font-size: 13px; color: #334155; margin-bottom: 24px;">
                ${content}
              </div>
              
              <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 32px;">
                <tr>
                  <td style="padding-right: 12px;">
                    <div style="width: 44px; height: 44px; background-color: #e2e8f0; border-radius: 50%; font-weight: bold; color: #475569; text-align: center; line-height: 44px; font-size: 16px;">AS</div>
                  </td>
                  <td>
                    <strong style="color: #0f172a; font-size: 13px; display: block;">Arthur Sterling</strong>
                    <span style="color: #64748b; font-size: 11px;">CEO, Betech Digital Solutions</span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Highlight Box Món Quà Tri Ân -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 0 32px 32px 32px; background-color: #ffffff;">
              <tr>
                <td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fffaf8; border: 1px solid #ffd8c7; border-radius: 12px; padding: 24px; text-align: center;">
                    <tr>
                      <td align="center">
                        <span style="font-size: 28px; display: block; margin-bottom: 12px;">🎁</span>
                        <h4 style="margin: 0 0 8px 0; color: #c2410c; font-size: 16px; font-weight: 700;">Món quà Tri ân</h4>
                        <p style="margin: 0 0 16px 0; color: #7c2d12; font-size: 12px; line-height: 1.5;">Để cảm ơn sự hợp tác bền chặt của bạn, chúng tôi xin gửi tặng ưu đãi độc quyền:<br><strong style="color: #e85d26;">Tín dụng Doanh nghiệp 25%</strong> cho lần nâng cấp dịch vụ tiếp theo.</p>
                        <a href="https://betech-digital.com" style="${buttonStyle}; margin: 0;">Nhận Ưu đãi ngay</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Stats section -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <tr>
                <td width="33%">
                  <strong style="font-size: 18px; color: #e85d26; display: block;">500+</strong>
                  <span style="font-size: 11px; color: #64748b;">Đối tác tin cậy</span>
                </td>
                <td width="33%">
                  <strong style="font-size: 18px; color: #e85d26; display: block;">99.9%</strong>
                  <span style="font-size: 11px; color: #64748b;">Thời gian hoạt động</span>
                </td>
                <td width="33%">
                  <strong style="font-size: 18px; color: #e85d26; display: block;">24/7</strong>
                  <span style="font-size: 11px; color: #64748b;">Hỗ trợ chuyên môn</span>
                </td>
              </tr>
            </table>

            ${renderFooter()}
          </div>
        </div>
      `;
        case 'webinar':
            return `
        <div style="${baseStyle}">
          <div style="${containerStyle}">
            ${renderHeader('Đăng ký ngay')}

            <div style="padding: 32px; background-color: #ffffff;">
              <span style="font-size: 10px; font-weight: 800; color: #e85d26; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">HỘI THẢO CÔNG NGHỆ 2026</span>
              <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 24px 0; line-height: 1.3;">Tham gia Hội thảo Trực tuyến Độc quyền của Chúng tôi</h1>
              
              <!-- Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
                <tr>
                  <td style="padding-bottom: 12px;">
                    <span style="font-size: 12px; color: #64748b;">📅 <strong>Ngày:</strong> 24 tháng 10 năm 2026</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 12px;">
                    <span style="font-size: 12px; color: #64748b;">⏰ <strong>Giờ:</strong> 10:00 SA — 11:30 SA (Giờ GMT+7)</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px;">
                    <span style="font-size: 12px; color: #64748b;">📍 <strong>Địa điểm:</strong> Trung tâm Đổi mới Kỹ thuật số (Trực tuyến)</span>
                  </td>
                </tr>
                <td style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding-right: 10px;">
                        <div style="width: 38px; height: 38px; background-color: #cbd5e1; border-radius: 50%; text-align: center; line-height: 38px; font-weight: bold; color: #475569; font-size: 14px;">JV</div>
                      </td>
                      <td>
                        <strong style="font-size: 12px; color: #0f172a; display: block;">TS. Julian Vance</strong>
                        <span style="font-size: 10px; color: #64748b;">Giám đốc Chiến lược số</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </table>

              <div style="font-size: 14px; color: #334155; margin-bottom: 24px;">
                ${content}
              </div>

              <div style="text-align: center; margin-bottom: 32px;">
                <a href="https://betech-digital.com" style="${buttonStyle}">Đăng ký tham gia ngay</a>
              </div>

              <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 32px 0 16px 0; border-top: 1px solid #f1f5f9; padding-top: 24px;">Nội dung bạn sẽ nhận được</h3>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top" style="font-size: 16px; width: 24px; padding-top: 2px;">✅</td>
                  <td style="padding-bottom: 16px; padding-left: 8px;">
                    <strong style="color: #0f172a; font-size: 13px; display: block;">Chiến lược Chuyển đổi Doanh nghiệp</strong>
                    <span style="font-size: 12px; color: #475569;">Khám phá cách tối ưu hóa hạ tầng kỹ thuật số để tăng trưởng 300% hiệu suất làm việc.</span>
                  </td>
                </tr>
                <tr>
                  <td valign="top" style="font-size: 16px; width: 24px; padding-top: 2px;">✅</td>
                  <td style="padding-bottom: 16px; padding-left: 8px;">
                    <strong style="color: #0f172a; font-size: 13px; display: block;">Hiệu quả tối ưu từ Trí tuệ nhân tạo (AI)</strong>
                    <span style="font-size: 12px; color: #475569;">Giải pháp quy trình làm việc tự động giúp tiết kiệm tới 45% chi phí vận hành cho doanh nghiệp.</span>
                  </td>
                </tr>
                <tr>
                  <td valign="top" style="font-size: 16px; width: 24px; padding-top: 2px;">✅</td>
                  <td style="padding-left: 8px;">
                    <strong style="color: #0f172a; font-size: 13px; display: block;">Bảo mật thông tin & Quản trị Kỹ thuật số</strong>
                    <span style="font-size: 12px; color: #475569;">Tìm hiểu các tiêu chuẩn an toàn dữ liệu Cloud thế hệ tiếp theo để bảo vệ thông tin khách hàng.</span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Quote Banner -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0f172a; color: #ffffff; padding: 32px; text-align: center;">
              <tr>
                <td>
                  <p style="font-size: 15px; font-style: italic; margin: 0 0 8px 0; color: #e2e8f0; font-family: Georgia, serif; line-height: 1.5;">"Sự chính xác trong thực thi là dấu ấn của đổi mới hiện đại."</p>
                  <span style="font-size: 10px; color: #e85d26; font-weight: bold; text-transform: uppercase;">— Tuyên ngôn Kỹ thuật số Betech</span>
                </td>
              </tr>
            </table>

            ${renderFooter()}
          </div>
        </div>
      `;
        case 'newsletter':
            return `
        <div style="${baseStyle}">
          <div style="${containerStyle}">
            
            <!-- Custom Header for Newsletter -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 20px 32px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
              <tr>
                <td>
                  <span style="font-size: 22px; font-weight: 800; color: #e85d26; letter-spacing: -0.5px;">Betech</span>
                </td>
                <td align="right" style="font-size: 11px; color: #64748b;">
                  <a href="#" style="color: #475569; text-decoration: none; margin-right: 12px;">Tin chuyên sâu</a>
                  <a href="#" style="color: #475569; text-decoration: none; margin-right: 16px;">Mạng lưới</a>
                  <a href="https://betech-digital.com" style="background-color: #e85d26; color: #ffffff; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-weight: bold;">Khám phá</a>
                </td>
              </tr>
            </table>

            <div style="padding: 32px; background-color: #ffffff;">
              <span style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 1px; display: block; margin-bottom: 6px;">SỐ #42 • THÁNG 01/2026</span>
              <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 24px 0;">Điểm tin Hàng tháng</h1>
              
              <!-- Featured Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 32px;">
                <tr>
                  <td style="background-color: #0f172a; padding: 32px; text-align: center; color: #ffffff;">
                    <!-- Visual representation of globe -->
                    <span style="font-size: 40px; display: block; margin-bottom: 8px;">🌐</span>
                    <span style="font-size: 9px; font-weight: bold; background-color: #e85d26; padding: 3px 8px; border-radius: 10px; text-transform: uppercase;">Bài viết nổi bật</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px; background-color: #ffffff;">
                    <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.4;">Xu hướng Chuyển đổi Số 2026: Định hướng Biên giới Mới</h3>
                    <p style="margin: 0 0 16px 0; font-size: 12px; color: #475569; line-height: 1.6;">Khi bước sang năm mới, bối cảnh công nghệ doanh nghiệp đang chuyển dịch mạnh mẽ sang tích hợp AI nhận thức và tối ưu hóa quy trình tự động. Khám phá cách các tổ chức hàng đầu đang bứt phá vượt qua đối thủ.</p>
                    <a href="https://betech-digital.com" style="color: #e85d26; font-weight: bold; text-decoration: none; font-size: 12px;">Đọc Toàn bộ Bài viết &rarr;</a>
                  </td>
                </tr>
              </table>

              <div style="font-size: 14px; color: #334155; margin-bottom: 32px; line-height: 1.7; border-top: 1px solid #f1f5f9; padding-top: 24px;">
                ${content}
              </div>

              <!-- Columns list -->
              <h4 style="font-size: 12px; font-weight: 850; color: #64748b; text-transform: uppercase; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">Các bài viết liên quan</h4>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="padding-bottom: 16px;">
                    <strong style="color: #0f172a; font-size: 13px; display: block;">🧠 Quản trị AI Tạo sinh</strong>
                    <span style="font-size: 12px; color: #475569; display: block; margin-top: 4px;">Thiết lập các khung quy trình chuẩn để triển khai AI đạo đức và tối ưu trong nội bộ.</span>
                    <a href="#" style="color: #e85d26; font-size: 11px; text-decoration: none; font-weight: bold; display: block; margin-top: 6px;">TÌM HIỂU THÊM</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px; border-top: 1px solid #f8fafc; padding-top: 16px;">
                    <strong style="color: #0f172a; font-size: 13px; display: block;">☁️ Phục hồi Đa Đám mây</strong>
                    <span style="font-size: 12px; color: #475569; display: block; margin-top: 4px;">Giải pháp thiết lập hạ tầng dự phòng phân tán, bảo vệ hệ thống khỏi sự cố mất điện.</span>
                    <a href="#" style="color: #e85d26; font-size: 11px; text-decoration: none; font-weight: bold; display: block; margin-top: 6px;">TÌM HIỂU THÊM</a>
                  </td>
                </tr>
                <tr>
                  <td style="border-top: 1px solid #f8fafc; padding-top: 16px;">
                    <strong style="color: #0f172a; font-size: 13px; display: block;">🛡️ Bảo mật Zero-Trust</strong>
                    <span style="font-size: 12px; color: #475569; display: block; margin-top: 4px;">Vượt qua hàng rào bảo mật cũ để hướng tới mô hình bảo vệ an toàn lấy danh tính làm trung tâm.</span>
                    <a href="#" style="color: #e85d26; font-size: 11px; text-decoration: none; font-weight: bold; display: block; margin-top: 6px;">TÌM HIỂU THÊM</a>
                  </td>
                </tr>
              </table>

              <!-- CTA Banner -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fffaf8; border: 1px solid #ffd8c7; border-radius: 12px; padding: 24px; text-align: center;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 8px 0; color: #c2410c; font-size: 15px; font-weight: 700;">Sẵn sàng để bứt phá?</h3>
                    <p style="margin: 0 0 16px 0; color: #7c2d12; font-size: 12px;">Đặt lịch tư vấn với các chuyên gia chiến lược số của chúng tôi để đánh giá hạ tầng.</p>
                    <a href="https://betech-digital.com" style="${buttonStyle}; margin: 0;">Đặt lịch tư vấn ngay</a>
                  </td>
                </tr>
              </table>
            </div>

            ${renderFooter()}
          </div>
        </div>
      `;
        case 'feedback':
            return `
        <div style="${baseStyle}">
          <div style="${containerStyle}">
            ${renderHeader()}

            <div style="padding: 32px; background-color: #ffffff;">
              <!-- Mini banner representing dashboard -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
                <tr>
                  <td>
                    <span style="font-size: 36px; display: block; margin-bottom: 6px;">📊</span>
                    <strong style="font-size: 15px; color: #0f172a; display: block;">Ý kiến của bạn rất quan trọng</strong>
                  </td>
                </tr>
              </table>

              <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; text-align: center;">Bạn thấy dịch vụ của chúng tôi thế nào?</h2>
              
              <div style="font-size: 14px; color: #475569; margin-bottom: 28px; line-height: 1.6;">
                ${content}
              </div>

              <!-- Rating Widget -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
                <tr>
                  <td>
                    <span style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 1px; display: block; margin-bottom: 12px;">MỨC ĐỘ HÀI LÒNG CỦA BẠN</span>
                    <div style="font-size: 28px; letter-spacing: 8px; margin-bottom: 12px; color: #eab308;">⭐⭐⭐⭐⭐</div>
                    <span style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 16px;">Nhấp vào các ngôi sao để xếp hạng trải nghiệm</span>
                    <a href="https://betech-digital.com" style="${buttonStyle}; margin: 0;">Gửi phản hồi của bạn</a>
                  </td>
                </tr>
              </table>

              <!-- Two column features -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #f1f5f9; padding-top: 24px;">
                <tr>
                  <td width="50%" valign="top" style="padding-right: 12px;">
                    <strong style="font-size: 13px; color: #0f172a; display: block; margin-bottom: 6px;">🎯 Độ chính xác</strong>
                    <span style="font-size: 11px; color: #64748b; display: block; line-height: 1.5;">Cam kết mang lại những phân tích dữ liệu và giải pháp kỹ thuật chính xác nhất.</span>
                  </td>
                  <td width="50%" valign="top" style="padding-left: 12px;">
                    <strong style="font-size: 13px; color: #0f172a; display: block; margin-bottom: 6px;">⚡ Tốc độ tối ưu</strong>
                    <span style="font-size: 11px; color: #64748b; display: block; line-height: 1.5;">Hỗ trợ khách hàng nhanh chóng và tiến độ triển khai linh hoạt hàng đầu.</span>
                  </td>
                </tr>
              </table>
            </div>

            ${renderFooter('Chúng tôi luôn nỗ lực cải thiện vì bạn. Cảm ơn bạn!')}
          </div>
        </div>
      `;
        case 'ai_features':
            return `
        <div style="${baseStyle}">
          <div style="${containerStyle}">
            
            <!-- Header for AI Features -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 20px 32px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
              <tr>
                <td>
                  <span style="font-size: 22px; font-weight: 800; color: #e85d26; letter-spacing: -0.5px;">Betech</span>
                </td>
                <td align="right" style="font-size: 11px;">
                  <span style="color: #e85d26; font-weight: bold; text-decoration: underline; margin-right: 12px;">Tin tức AI</span>
                  <a href="#" style="color: #475569; text-decoration: none;">Dịch vụ</a>
                </td>
              </tr>
            </table>
            
            <!-- Banner Hero -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1e293b; color: #ffffff; padding: 40px 32px; text-align: center;">
              <tr>
                <td>
                  <span style="font-size: 10px; font-weight: bold; color: #e85d26; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">TƯƠNG LAI CỦA WEB</span>
                  <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff; line-height: 1.3;">Nâng tầm Website với Trí tuệ nhân tạo (AI)</h1>
                  <p style="font-size: 13px; color: #cbd5e1; margin: 0 0 20px 0; line-height: 1.5;">Tích hợp các giải pháp AI đột phá để tối ưu hóa trải nghiệm người dùng và tự động hóa quy trình kinh doanh của bạn.</p>
                  <a href="https://betech-digital.com" style="${buttonStyle}; margin: 0;">Tìm hiểu thêm về AI</a>
                </td>
              </tr>
            </table>

            <!-- Content Area -->
            <div style="padding: 32px; background-color: #ffffff;">
              
              <!-- Mock Dashboard Image Banner -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #4338ca; border-radius: 12px; overflow: hidden; margin-bottom: 28px; text-align: center; color: #ffffff; padding: 24px;">
                <tr>
                  <td>
                    <span style="font-size: 44px; display: block; margin-bottom: 6px;">🤖</span>
                    <span style="font-size: 12px; font-weight: bold; opacity: 0.9;">Betech AI growth Engine</span>
                  </td>
                </tr>
              </table>

              <div style="font-size: 14px; color: #334155; margin-bottom: 32px;">
                ${content}
              </div>

              <!-- AI Features checklist -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top" style="padding-bottom: 20px; width: 44px;">
                    <div style="width: 32px; height: 32px; background-color: #fff7ed; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">🔍</div>
                  </td>
                  <td style="padding-bottom: 20px;">
                    <strong style="color: #0f172a; font-size: 14px; display: block;">Gợi ý SEO Thông minh</strong>
                    <span style="font-size: 12px; color: #475569; display: block; margin-top: 4px;">Hệ thống AI tự động phân tích từ khóa, cấu trúc nội dung và đề xuất tối ưu hóa để website đạt thứ hạng cao nhất trên Google.</span>
                  </td>
                </tr>
                <tr>
                  <td valign="top" style="padding-bottom: 20px; width: 44px;">
                    <div style="width: 32px; height: 32px; background-color: #fff7ed; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">🤖</div>
                  </td>
                  <td style="padding-bottom: 20px;">
                    <strong style="color: #0f172a; font-size: 14px; display: block;">AI Chatbots Thế Hệ Mới</strong>
                    <span style="font-size: 12px; color: #475569; display: block; margin-top: 4px;">Hỗ trợ khách hàng 24/7 với khả năng hiểu ngôn ngữ tự nhiên, tư vấn sản phẩm và chốt đơn tự động theo kịch bản thông minh.</span>
                  </td>
                </tr>
                <tr>
                  <td valign="top" style="width: 44px;">
                    <div style="width: 32px; height: 32px; background-color: #fff7ed; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">⚙️</div>
                  </td>
                  <td>
                    <strong style="color: #0f172a; font-size: 14px; display: block;">Tự Động Hóa Quy Trình</strong>
                    <span style="font-size: 12px; color: #475569; display: block; margin-top: 4px;">Giảm thiểu sai sót và tiết kiệm thời gian bằng cách tự động hóa các tác vụ lặp đi lặp lại thông qua các quy trình AI tùy chỉnh.</span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- CTA Box Hẹn Lịch / Bảng giá -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 0 32px 32px 32px; background-color: #ffffff;">
              <tr>
                <td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; text-align: center;">
                    <tr>
                      <td>
                        <h4 style="margin: 0 0 8px 0; color: #166534; font-size: 15px; font-weight: 700;">Sẵn sàng để dẫn đầu xu hướng?</h4>
                        <p style="margin: 0 0 16px 0; color: #15803d; font-size: 12px;">Hãy để chuyên gia của chúng tôi tư vấn giải pháp AI phù hợp nhất cho doanh nghiệp của bạn.</p>
                        <table align="center" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="padding-right: 8px;">
                              <a href="https://betech-digital.com" style="background-color: #e85d26; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 12px; display: inline-block;">Đặt lịch tư vấn</a>
                            </td>
                            <td>
                              <a href="https://betech-digital.com" style="background-color: #ffffff; color: #e85d26; border: 1px solid #e85d26; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 12px; display: inline-block;">Xem bảng giá</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            ${renderFooter()}
          </div>
        </div>
      `;
        case 'services':
            return `
        <div style="${baseStyle}">
          <div style="${containerStyle}">
            ${renderHeader()}

            <!-- Banner Hero -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1e293b; color: #ffffff; padding: 40px 32px; text-align: center;">
              <tr>
                <td>
                  <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff; line-height: 1.3;">Biến ý tưởng trở thành sản phẩm công nghệ hoàn chỉnh</h1>
                  <p style="font-size: 13px; color: #cbd5e1; margin: 0 0 20px 0; line-height: 1.5;">Chúng tôi xây dựng hạ tầng tăng trưởng dựa trên kiến trúc hiệu suất cao và tích hợp AI cho doanh nghiệp của bạn.</p>
                  <a href="https://betech-digital.com" style="${buttonStyle}; background-color: #e85d26; margin: 0;">Khám phá giải pháp ngay &rarr;</a>
                </td>
              </tr>
            </table>

            <!-- Content Area -->
            <div style="padding: 32px; background-color: #ffffff;">
              <span style="font-size: 10px; font-weight: 800; color: #e85d26; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;">DỊCH VỤ CỦA CHÚNG TÔI</span>
              <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 20px 0;">Giải pháp doanh nghiệp toàn diện</h2>

              <!-- Services list -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td valign="top" style="padding-bottom: 16px; width: 44px;">
                    <div style="width: 32px; height: 32px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; line-height: 32px; font-size: 14px;">💻</div>
                  </td>
                  <td style="padding-bottom: 16px;">
                    <strong style="color: #0f172a; font-size: 13px; display: block;">Phát triển Website</strong>
                    <span style="font-size: 12px; color: #475569; display: block; margin-top: 4px;">Sự kết hợp tinh tế giữa giao diện độc đáo, chất lượng vượt trội và trải nghiệm khách hàng tối ưu.</span>
                  </td>
                </tr>
                <tr>
                  <td valign="top" style="padding-bottom: 16px; width: 44px;">
                    <div style="width: 32px; height: 32px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; line-height: 32px; font-size: 14px;">✏️</div>
                  </td>
                  <td style="padding-bottom: 16px;">
                    <strong style="color: #0f172a; font-size: 13px; display: block;">Nhận Diện Thương Hiệu</strong>
                    <span style="font-size: 12px; color: #475569; display: block; margin-top: 4px;">Nâng tầm vị thế thương hiệu doanh nghiệp trên môi trường số với bộ nhận diện chuyên nghiệp, đẳng cấp.</span>
                  </td>
                </tr>
                <tr>
                  <td valign="top" style="width: 44px;">
                    <div style="width: 32px; height: 32px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; line-height: 32px; font-size: 14px;">📢</div>
                  </td>
                  <td>
                    <strong style="color: #0f172a; font-size: 13px; display: block;">Tiếp Thị Đa Kênh</strong>
                    <span style="font-size: 12px; color: #475569; display: block; margin-top: 4px;">Tối ưu hóa chi phí quảng cáo để thu hút và giữ chân khách hàng tiềm năng đạt tỉ lệ chuyển đổi cao.</span>
                  </td>
                </tr>
              </table>

              <div style="font-size: 14px; color: #334155; margin-bottom: 28px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                ${content}
              </div>

              <!-- Testimonial card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #eff6ff; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
                <tr>
                  <td>
                    <div style="color: #eab308; font-size: 16px; margin-bottom: 8px;">⭐⭐⭐⭐⭐</div>
                    <p style="margin: 0 0 12px 0; font-size: 12px; color: #1e40af; font-style: italic; line-height: 1.6;">"Betech tự hào là đơn vị cung cấp dịch vụ website cao cấp được các doanh nghiệp tin tưởng lựa chọn để xây dựng hình ảnh thương hiệu và hạ tầng bán hàng."</p>
                    <strong style="font-size: 11px; color: #1e3a8a;">— Hội đồng quản trị, Betech Digital Solutions</strong>
                  </td>
                </tr>
              </table>

              <!-- Tablet representation -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #312e81; border-radius: 12px; overflow: hidden; text-align: center; color: #ffffff; padding: 24px; margin-bottom: 28px;">
                <tr>
                  <td>
                    <span style="font-size: 40px; display: block; margin-bottom: 4px;">💻</span>
                    <span style="font-size: 11px; font-weight: bold; opacity: 0.85;">Hạ tầng tăng trưởng hoàn chỉnh</span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- CTA Hẹn tư vấn -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 0 32px 32px 32px; background-color: #ffffff; border-top: 1px solid #f1f5f9; padding-top: 24px;">
              <tr>
                <td>
                  <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 15px; font-weight: 700; text-align: center;">Sẵn sàng để bứt phá?</h4>
                  <p style="margin: 0 0 16px 0; color: #64748b; font-size: 12px; text-align: center;">Liên hệ với chúng tôi ngay hôm nay để nhận tư vấn miễn phí.</p>
                  <table align="center" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding-right: 12px;">
                        <a href="tel:0775600351" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: bold; font-size: 12px; display: inline-block;">📞 0775600351</a>
                      </td>
                      <td>
                        <a href="mailto:admin@betech-digital.com" style="background-color: #ffffff; color: #475569; border: 1px solid #cbd5e1; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: bold; font-size: 12px; display: inline-block;">✉️ Gửi Email</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            ${renderFooter('Địa chỉ: 92A-84 Bạch Đằng, P. 2, Q. Tân Bình, TP. HCM | Email: admin@betech-digital.com')}
          </div>
        </div>
      `;
    }
    return `
    <div style="${baseStyle}">
      <div style="${containerStyle}">
        <div style="padding: 32px;">
          ${content}
        </div>
      </div>
    </div>
  `;
}
