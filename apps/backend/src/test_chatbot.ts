import prisma from './lib/prisma';
import { handleVisitorMessage } from './services/cskhService';

async function testChatbot() {
  console.log('🚀 Bắt đầu kiểm thử tính năng CSKH AI Chatbot & Lead capture...');

  try {
    // 1. Lấy một workspace trong hệ thống để test
    const workspace = await prisma.workspace.findFirst();
    if (!workspace) {
      console.error('❌ Không tìm thấy workspace nào trong database để test. Hãy đăng nhập/tạo workspace trước.');
      return;
    }
    console.log(`📌 Sử dụng workspace: "${workspace.name}" (ID: ${workspace.id})`);

    // 2. Cấu hình CSKH Config cho workspace này
    const config = await prisma.cskhConfig.upsert({
      where: { workspaceId: workspace.id },
      update: {
        liveChatEnabled: true,
        aiChatbotEnabled: true,
        knowledgeBaseText: 'Chúng tôi là Be Traffic chuyên cung cấp giải pháp Marketing kéo Traffic tự động tăng trưởng. Giờ mở cửa từ 8:00 sáng đến 6:00 chiều từ Thứ Hai đến Thứ Bảy.',
        followUpDelayHours: 1, // 1 giờ trì hoãn gửi mail
        followUpEmailSubject: 'Chào {{name}}, cảm ơn bạn đã quan tâm đến giải pháp kéo Traffic!',
        followUpEmailBody: 'Hỏi thăm tình hình của họ, giới thiệu gói dịch vụ kéo Traffic miễn phí dùng thử.',
      },
      create: {
        workspaceId: workspace.id,
        liveChatEnabled: true,
        aiChatbotEnabled: true,
        knowledgeBaseText: 'Chúng tôi là Be Traffic chuyên cung cấp giải pháp Marketing kéo Traffic tự động tăng trưởng. Giờ mở cửa từ 8:00 sáng đến 6:00 chiều từ Thứ Hai đến Thứ Bảy.',
        followUpDelayHours: 1,
        followUpEmailSubject: 'Chào {{name}}, cảm ơn bạn đã quan tâm đến giải pháp kéo Traffic!',
        followUpEmailBody: 'Hỏi thăm tình hình của họ, giới thiệu gói dịch vụ kéo Traffic miễn phí dùng thử.',
      }
    });

    console.log('✅ Đã thiết lập cấu hình CSKH Config thành công:', {
      liveChatEnabled: config.liveChatEnabled,
      aiChatbotEnabled: config.aiChatbotEnabled,
      followUpDelayHours: config.followUpDelayHours
    });

    // 3. Giả lập tin nhắn hội thoại đầu tiên của Visitor (chứa thông tin SĐT/Email để bắt lead)
    const testMessage = 'Chào bạn, mình đang muốn tìm hiểu giải pháp kéo traffic. Có thể tư vấn cho mình qua email: tester_cskh_ai@example.com hoặc số điện thoại: 0987654321 được không?';
    console.log(`💬 Gửi tin nhắn giả lập: "${testMessage}"`);

    const result = await handleVisitorMessage(
      workspace.id,
      undefined, // Phiên mới
      testMessage,
      '127.0.0.1',
      'Test UserAgent'
    );

    console.log('🤖 AI Response:', result.reply);
    console.log('📦 Session ID tạo mới:', result.sessionId);
    console.log('👤 Customer ID liên kết:', result.customerId);

    if (result.customerId) {
      // 4. Kiểm tra xem Customer có được lưu vào CRM chính xác không
      const customer = await prisma.customer.findUnique({
        where: { id: result.customerId }
      });
      console.log('👤 Khách hàng được tạo trong CRM:', customer);

      // 5. Kiểm tra lịch hẹn gửi Email chăm sóc tự động (Follow-up)
      const session = await prisma.chatSession.findUnique({
        where: { id: result.sessionId }
      });
      console.log('📅 Lịch gửi follow-up được lên kế hoạch lúc:', session?.followUpScheduledAt);
      console.log('🎯 Đã lên lịch gửi mail:', session?.followUpScheduledAt ? 'HỢP LỆ' : 'SAI SÓT');
    } else {
      console.error('❌ Thất bại: Không trích xuất được customer từ tin nhắn!');
    }

  } catch (error) {
    console.error('❌ Lỗi kiểm thử chatbot:', error);
  } finally {
    await prisma.$disconnect();
    console.log('🏁 Hoàn tất kiểm thử.');
  }
}

testChatbot();
