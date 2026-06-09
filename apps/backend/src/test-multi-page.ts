import prisma from './lib/prisma';
import { executeAutomationTask } from './workers/botEngine';

async function runTest() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ ĐA FANPAGE & LANDING PAGE AUTOMATION...\n');

  // 1. Tạo Workspace mock
  const workspace = await prisma.workspace.create({
    data: { name: 'Workspace Test Multi-Page' }
  });
  console.log(`✅ Đã tạo Workspace mock: ID = ${workspace.id}`);

  // 2. Tạo 2 SocialConnection mock
  const conn1 = await prisma.socialConnection.create({
    data: {
      platform: 'facebook',
      workspaceId: workspace.id,
      accessToken: 'mock_access_token_page_a',
      pageName: 'Page A (Cửa Hàng Xanh)',
      pageId: '100000000000001',
      status: 'CONNECTED'
    }
  });

  const conn2 = await prisma.socialConnection.create({
    data: {
      platform: 'facebook',
      workspaceId: workspace.id,
      accessToken: 'mock_access_token_page_b',
      pageName: 'Page B (Thời Trang Đẹp)',
      pageId: '100000000000002',
      status: 'CONNECTED'
    }
  });
  console.log(`✅ Đã tạo 2 Fanpage kết nối mock:`);
  console.log(`   - Page A: ID = ${conn1.id}, Facebook Page ID = ${conn1.pageId}`);
  console.log(`   - Page B: ID = ${conn2.id}, Facebook Page ID = ${conn2.pageId}`);

  // 3. Tạo một AutomationTask với targetConnectionsJson chọn cả 2 Fanpage
  const targets = [
    { connectionId: conn1.id, platform: 'facebook', pageName: conn1.pageName },
    { connectionId: conn2.id, platform: 'facebook', pageName: conn2.pageName }
  ];

  const task = await prisma.automationTask.create({
    data: {
      name: 'Chiến dịch cào tin tức tự động test',
      platforms: JSON.stringify(['facebook']),
      targetConnectionsJson: JSON.stringify(targets),
      urlTarget: 'https://demo-landing-page.com',
      interval: 60,
      status: 'RUNNING',
      workspaceId: workspace.id,
      useAi: true,
      aiPrompt: 'Viết lời giới thiệu hài hước cho website của tôi.'
    }
  });
  console.log(`✅ Đã tạo AutomationTask: ID = ${task.id}`);

  // Tạo một PostTemplate giả cho task để botEngine có nội dung
  await prisma.postTemplate.create({
    data: {
      title: 'Khuyến mãi đặc biệt hôm nay!',
      content: 'Chào các bạn, hôm nay chúng tôi có chương trình siêu khuyến mãi giảm giá 50% cho tất cả các sản phẩm. Nhấn link: {url} để xem ngay!',
      taskId: task.id,
      isActive: true
    }
  });
  console.log('✅ Đã tạo PostTemplate mẫu cho Task');

  // 4. Chạy executeAutomationTask
  console.log('\n🚀 Đang chạy executeAutomationTask cho Task...');
  await executeAutomationTask(task);

  // 5. Kiểm tra Logs được tạo ra
  const logs = await prisma.botLog.findMany({
    where: { taskId: task.id }
  });

  console.log(`\n📋 Kết quả thực thi (Tìm thấy ${logs.length} Bot Logs):`);
  logs.forEach((log, index) => {
    console.log(`   Log #${index + 1}:`);
    console.log(`   - Action: ${log.action}`);
    console.log(`   - Message: ${log.message}`);
    console.log(`   - Status: ${log.status}`);
  });

  // Xác thực kết quả
  if (logs.length === 2) {
    console.log('\n🎉 ĐẠT: Đã thực thi đăng bài và ghi nhận log độc lập cho từng Fanpage thành công!');
  } else {
    console.error('\n❌ THẤT BẠI: Số lượng logs không khớp (mong muốn 2 logs).');
    process.exitCode = 1;
  }

  // 6. Dọn dẹp dữ liệu
  console.log('\n🧹 Đang dọn dẹp dữ liệu kiểm thử...');
  await prisma.workspace.delete({ where: { id: workspace.id } });
  console.log('✅ Đã dọn dẹp xong Workspace test.');
}

runTest()
  .catch(err => {
    console.error('❌ Lỗi chạy test:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit();
  });
