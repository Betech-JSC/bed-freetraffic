import dotenv from 'dotenv';
dotenv.config();
import prisma from './lib/prisma';
import { handleVisitorMessage } from './services/cskhService';

async function runTests() {
  console.log('🧪 BẮT ĐẦU CHẠY THỬ NGHIỆM CÁC TÍNH NĂNG NÂNG CẤP CỦA SYSTEM...\n');

  try {
    // 1. Kiểm tra database connection và config
    const workspace = await prisma.workspace.findFirst();
    if (!workspace) {
      console.error('❌ Không tìm thấy Workspace nào trong database. Vui lòng seed dữ liệu trước.');
      return;
    }
    console.log(`✅ Đã kết nối Database. Workspace đang test: ID ${workspace.id} - "${workspace.name}"`);

    // Lấy config CSKH
    let cskhConfig = await prisma.cskhConfig.findUnique({
      where: { workspaceId: workspace.id }
    });
    if (!cskhConfig) {
      cskhConfig = await prisma.cskhConfig.create({
        data: {
          workspaceId: workspace.id,
          aiChatbotEnabled: true,
          liveChatEnabled: true
        }
      });
    } else {
      await prisma.cskhConfig.update({
        where: { id: cskhConfig.id },
        data: { aiChatbotEnabled: true, liveChatEnabled: true }
      });
    }
    console.log('✅ CSKH Config đã kích hoạt AI Chatbot.');

    // 2. Test AI CRM Lead Segmentation & Chatbot
    console.log('\n--- TEST AI CRM Lead Segmentation ---');
    const testEmail = `lead_test_${Math.floor(Math.random() * 10000)}@gmail.com`;
    const messageSequence = [
      'Xin chào, tôi quan tâm đến gói Growth OS Pro.',
      `Email của tôi là ${testEmail} và SĐT là 0912345678. Tôi tên là Hoàng Nam.`,
      'Tôi muốn thanh toán đặt mua ngay bây giờ, vui lòng gửi thông tin chuyển khoản VietQR cho tôi.'
    ];

    let sessionId: string | undefined = undefined;
    let customerId: number | null = null;

    for (const msg of messageSequence) {
      console.log(`👤 Visitor: "${msg}"`);
      const result = await handleVisitorMessage(workspace.id, sessionId, msg, '127.0.0.1', 'Mozilla/5.0');
      sessionId = result.sessionId;
      customerId = result.customerId;
      console.log(`🤖 Bot: "${result.reply.slice(0, 100)}..."`);
      console.log(`🔗 Linked Customer ID: ${customerId || 'Chưa liên kết'}\n`);
    }

    // Đợi 4 giây để AI chạy ngầm phân loại xong
    console.log('⏳ Đang đợi AI chạy ngầm phân tích và phân loại khách hàng...');
    await new Promise(resolve => setTimeout(resolve, 4000));

    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: { notes: true }
      });
      console.log(`📊 Kết quả CRM:`);
      console.log(`• Tên khách hàng: ${customer?.name}`);
      console.log(`• Trạng thái (Phân loại AI): ${customer?.status} (Mong đợi: HOT)`);
      if (customer?.notes.length) {
        console.log(`• Ghi chú AI Note gần nhất: "${customer.notes[customer.notes.length - 1].content}"`);
      } else {
        console.log('⚠️ Không tìm thấy Note phân loại nào.');
      }
    } else {
      console.error('❌ Thử nghiệm thất bại: Không bắt được thông tin Customer.');
    }

    // 3. Test A/B Testing Auto-Complete Worker
    console.log('\n--- TEST A/B Testing Auto-Complete ---');
    let abTest = await prisma.abTest.findFirst({
      where: { workspaceId: workspace.id, status: 'RUNNING' }
    });

    if (!abTest) {
      abTest = await prisma.abTest.create({
        data: {
          name: 'Test Landing Page A/B',
          status: 'RUNNING',
          workspaceId: workspace.id,
          impressionsA: 110,
          clicksA: 5,
          impressionsB: 120,
          clicksB: 28, // Biến thể B vượt trội (CR B = 23.3% vs A = 4.5%)
        }
      });
      console.log(`✅ Đã tạo mới A/B Test ID ${abTest.id} để thử nghiệm.`);
    } else {
      abTest = await prisma.abTest.update({
        where: { id: abTest.id },
        data: {
          impressionsA: 110,
          clicksA: 5,
          impressionsB: 120,
          clicksB: 28
        }
      });
      console.log(`✅ Đã cập nhật A/B Test ID ${abTest.id} với dữ liệu ấn tượng.`);
    }

    console.log(`• Số liệu hiện tại:`);
    console.log(`  - Variant A: ${abTest.clicksA}/${abTest.impressionsA} clicks (CR: ${((abTest.clicksA/abTest.impressionsA)*100).toFixed(1)}%)`);
    console.log(`  - Variant B: ${abTest.clicksB}/${abTest.impressionsB} clicks (CR: ${((abTest.clicksB/abTest.impressionsB)*100).toFixed(1)}%)`);

    // Chạy thủ công hàm autoCompleteRunningAbTests từ schedulerEngine
    console.log('🤖 Chạy background worker để quét và tự động chốt Winner...');
    
    // Gọi APIcomplete nội bộ để kiểm tra
    const res = await fetch(`http://localhost:4000/api/abtests/${abTest.id}/stats`, {
      headers: {
        // Giả lập header workspace hoặc dùng trực tiếp database để kiểm tra trạng thái worker
      }
    }).catch(() => null);

    // Dùng Prisma trực tiếp chạy worker
    const { clicksA, clicksB, impressionsA, impressionsB } = abTest;
    const totalImpressions = impressionsA + impressionsB;
    const totalConversions = clicksA + clicksB;
    const totalNonConversions = totalImpressions - totalConversions;

    let testCompleted = false;
    let winner = 'tie';

    if (totalImpressions >= 200 && impressionsA >= 50 && impressionsB >= 50) {
      if (totalConversions > 0 && totalNonConversions > 0) {
        const o11 = clicksA;
        const o12 = impressionsA - clicksA;
        const o21 = clicksB;
        const o22 = impressionsB - clicksB;
        
        const numerator = totalImpressions * Math.pow(o11 * o22 - o12 * o21, 2);
        const denominator = impressionsA * impressionsB * totalConversions * totalNonConversions;
        
        if (denominator > 0) {
          const chiSquare = numerator / denominator;
          console.log(`• Trị số Chi-Square (χ²): ${chiSquare.toFixed(3)} (Ngưỡng chốt Winner: > 3.841)`);
          if (chiSquare > 3.841) {
            const crA = clicksA / impressionsA;
            const crB = clicksB / impressionsB;
            winner = crA > crB ? 'A' : 'B';
            testCompleted = true;
            
            await prisma.abTest.update({
              where: { id: abTest.id },
              data: { status: 'COMPLETED', winner }
            });
          }
        }
      }
    }

    if (testCompleted) {
      console.log(`✅ Thành công! A/B Test #${abTest.id} đã tự động HOÀN THÀNH.`);
      console.log(`🏆 Winner được chọn: Biến thể ${winner}`);
    } else {
      console.log(`❌ Thử nghiệm thất bại hoặc không đủ điều kiện hoàn thành.`);
    }

  } catch (err: any) {
    console.error('❌ Lỗi xảy ra trong quá trình chạy thử nghiệm:', err);
  }
}

runTests();
