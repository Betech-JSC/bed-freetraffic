"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const workspace_1 = require("../middleware/workspace");
const ai_1 = require("../lib/ai");
const referrals_1 = require("./referrals");
const router = (0, express_1.Router)();
// ==========================================
// PRIVATE ADMIN PORTAL ROUTES
// ==========================================
// GET /api/widgets - List all widgets
router.get('/', auth_1.authenticate, workspace_1.workspaceMiddleware, async (req, res) => {
    try {
        const widgets = await prisma_1.default.marketingWidget.findMany({
            where: { workspaceId: req.workspaceId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(widgets);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Lỗi tải danh sách widgets' });
    }
});
// POST /api/widgets - Create widget
router.post('/', auth_1.authenticate, workspace_1.workspaceMiddleware, async (req, res) => {
    try {
        const { name, type, title, description, configJson, themeColor } = req.body;
        if (!name || !type || !title) {
            res.status(400).json({ error: 'Tên, loại widget và tiêu đề là bắt buộc' });
            return;
        }
        const widget = await prisma_1.default.marketingWidget.create({
            data: {
                workspaceId: req.workspaceId,
                name,
                type,
                title,
                description: description || '',
                configJson: configJson || '{}',
                themeColor: themeColor || '#e85d26',
                isActive: true,
            },
        });
        res.status(201).json(widget);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Lỗi tạo widget mới' });
    }
});
// PUT /api/widgets/:id - Update widget
router.put('/:id', auth_1.authenticate, workspace_1.workspaceMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, title, description, configJson, themeColor, isActive } = req.body;
        const widgetId = parseInt(String(id), 10);
        const existing = await prisma_1.default.marketingWidget.findFirst({
            where: { id: widgetId, workspaceId: req.workspaceId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Không tìm thấy widget tương tác' });
            return;
        }
        const updated = await prisma_1.default.marketingWidget.update({
            where: { id: widgetId },
            data: {
                name: name !== undefined ? name : existing.name,
                title: title !== undefined ? title : existing.title,
                description: description !== undefined ? description : existing.description,
                configJson: configJson !== undefined ? configJson : existing.configJson,
                themeColor: themeColor !== undefined ? themeColor : existing.themeColor,
                isActive: isActive !== undefined ? isActive : existing.isActive,
            },
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Lỗi cập nhật widget' });
    }
});
// DELETE /api/widgets/:id - Delete widget
router.delete('/:id', auth_1.authenticate, workspace_1.workspaceMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const widgetId = parseInt(String(id), 10);
        const existing = await prisma_1.default.marketingWidget.findFirst({
            where: { id: widgetId, workspaceId: req.workspaceId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Không tìm thấy widget' });
            return;
        }
        await prisma_1.default.marketingWidget.delete({ where: { id: widgetId } });
        res.json({ message: 'Xóa widget thành công!' });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Lỗi xóa widget' });
    }
});
// POST /api/widgets/generate-quiz - Calls AI to generate Quiz questions
router.post('/generate-quiz', auth_1.authenticate, workspace_1.workspaceMiddleware, async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic || !topic.trim()) {
            res.status(400).json({ error: 'Chủ đề bài trắc nghiệm (topic) là bắt buộc' });
            return;
        }
        const ai = (0, ai_1.getAiConfig)('/chat/completions');
        if (!ai.apiKey) {
            // Mock questions fallback
            res.json([
                {
                    question: `Kiến thức nền tảng về ${topic} là gì?`,
                    options: ['Khái niệm cốt lõi', 'Phương pháp triển khai', 'Công cụ hỗ trợ', 'Tất cả các đáp án trên'],
                    correctIndex: 3
                },
                {
                    question: `Lợi ích lớn nhất khi áp dụng ${topic} vào thực chiến?`,
                    options: ['Tiết kiệm chi phí vận hành', 'Tăng lưu lượng truy cập nhanh', 'Tối ưu hóa phễu bán hàng', 'Xây dựng thương hiệu bền vững'],
                    correctIndex: 2
                },
                {
                    question: `Bước đầu tiên cần làm khi bắt đầu với ${topic}?`,
                    options: ['Mua các công cụ đắt tiền', 'Nghiên cứu nhu cầu khách hàng mục tiêu', 'Thiết lập chiến dịch ngay lập tức', 'Thuê nhân sự chuyên nghiệp'],
                    correctIndex: 1
                }
            ]);
            return;
        }
        const systemPrompt = `Bạn là chuyên gia thiết kế câu hỏi trắc nghiệm tuyển dụng và đào tạo chuyên sâu.
Hãy tạo 5 câu hỏi trắc nghiệm (multiple-choice questions) bằng tiếng Việt về chủ đề: "${topic}".
Mỗi câu hỏi phải có đúng 4 đáp án lựa chọn và chỉ rõ đáp án đúng (chỉ số correctIndex từ 0 đến 3).

Yêu cầu trả về kết quả dưới dạng mảng JSON hợp lệ chứa các đối tượng có cấu trúc sau:
[
  {
    "question": "Câu hỏi trắc nghiệm...",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "correctIndex": 0
  }
]
KHÔNG viết phần giải thích hay suy nghĩ/suy luận dài dòng, hãy đi thẳng vào phản hồi JSON hợp lệ để tiết kiệm thời gian phản hồi.
KHÔNG bao bọc chuỗi JSON bằng thẻ code markdown như \`\`\`json. Hãy trả về text JSON thô để có thể chạy JSON.parse() trực tiếp.`;
        const response = await (0, ai_1.fetchWithRetry)(ai.url, {
            method: 'POST',
            headers: ai.headers,
            body: JSON.stringify({
                model: ai.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Hãy tạo 5 câu hỏi trắc nghiệm chi tiết cho chủ đề: ${topic}` },
                ],
                temperature: 0.7,
            }),
            signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) {
            throw new Error(`OpenAI compatibility API error: status ${response.status}`);
        }
        const data = await response.json();
        const contentText = data.choices?.[0]?.message?.content?.trim() || '[]';
        try {
            const parsed = (0, ai_1.parseAiJson)(contentText);
            res.json(parsed);
        }
        catch (parseErr) {
            console.error('Failed to parse AI quiz output, returning fallback:', parseErr);
            res.status(500).json({ error: 'Không thể phân tích dữ liệu JSON trả về từ AI' });
        }
    }
    catch (err) {
        console.error('Quiz generate error:', err);
        res.status(500).json({ error: err.message || 'Lỗi tạo bộ câu hỏi tự động' });
    }
});
// ==========================================
// PUBLIC ENDPOINTS (Embedded widget endpoints)
// ==========================================
// GET /api/widgets/public/script/:id - Delivers dynamic widget script
router.get('/public/script/:id', async (req, res) => {
    try {
        const id = parseInt(String(req.params.id), 10);
        if (isNaN(id)) {
            res.status(400).send('console.error("[Growth OS Widget] ID không hợp lệ");');
            return;
        }
        const widget = await prisma_1.default.marketingWidget.findUnique({ where: { id } });
        if (!widget || !widget.isActive) {
            res.status(404).send('console.warn("[Growth OS Widget] Widget không hoạt động hoặc không tồn tại");');
            return;
        }
        const apiHost = process.env.BACKEND_URL || 'http://localhost:4000';
        const config = JSON.parse(widget.configJson || '{}');
        // Deliver Javascript code that builds dynamic form/quiz card in container
        res.setHeader('Content-Type', 'application/javascript');
        const scriptJs = `
(function() {
  const scriptTag = document.currentScript;
  const container = document.createElement('div');
  container.className = 'growth-os-widget-card';
  container.style.cssText = "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 24px; max-width: 480px; margin: 20px auto; color: #1e293b; box-sizing: border-box;";
  scriptTag.parentNode.insertBefore(container, scriptTag);

  const themeColor = "${widget.themeColor}";
  const type = "${widget.type}";
  const title = "${widget.title.replace(/"/g, '\\"')}";
  const description = "${widget.description.replace(/"/g, '\\"').replace(/\n/g, '<br>')}";
  const config = ${JSON.stringify(config)};
  
  let currentStep = 0;
  let score = 0;
  let answers = [];
  
  function render() {
    container.innerHTML = '';
    
    // Title & desc header
    const header = document.createElement('div');
    header.style.marginBottom = '20px';
    header.innerHTML = '<h3 style="margin:0 0 6px 0; font-size:18px; font-weight:700; color:#0f172a;">' + title + '</h3><p style="margin:0; font-size:13px; color:#64748b; line-height:1.5;">' + description + '</p>';
    container.appendChild(header);

    if (type === 'QUIZ') {
      const questions = config.questions || [];
      if (questions.length === 0) {
        container.innerHTML += '<p style="font-size:13px; color:#94a3b8;">Chưa cấu hình câu hỏi trắc nghiệm.</p>';
        return;
      }
      
      if (currentStep < questions.length) {
        // Render question step
        const q = questions[currentStep];
        const stepInfo = document.createElement('div');
        stepInfo.style.cssText = "font-size:11px; font-weight:600; color:" + themeColor + "; text-transform:uppercase; margin-bottom:8px;";
        stepInfo.innerText = "Câu hỏi " + (currentStep + 1) + " / " + questions.length;
        container.appendChild(stepInfo);

        const qText = document.createElement('p');
        qText.style.cssText = "font-size:14px; font-weight:600; margin:0 0 16px 0; line-height:1.5; color:#1e293b;";
        qText.innerText = q.question;
        container.appendChild(qText);

        const optDiv = document.createElement('div');
        optDiv.style.cssText = "display:flex; flex-direction:column; gap:10px;";
        
        q.options.forEach((opt, idx) => {
          const btn = document.createElement('button');
          btn.style.cssText = "padding:12px 16px; border:1px solid #cbd5e1; background:#fff; text-align:left; border-radius:10px; font-size:13px; font-weight:500; color:#334155; cursor:pointer; transition:all 0.15s ease;";
          btn.innerText = opt;
          btn.onmouseover = () => { btn.style.background = '#f8fafc'; btn.style.borderColor = themeColor; };
          btn.onmouseout = () => { btn.style.background = '#fff'; btn.style.borderColor = '#cbd5e1'; };
          btn.onclick = () => {
            answers.push({ question: q.question, selected: opt, correct: idx === q.correctIndex });
            if (idx === q.correctIndex) score++;
            currentStep++;
            render();
          };
          optDiv.appendChild(btn);
        });
        container.appendChild(optDiv);
      } else if (currentStep === questions.length) {
        // Show Lead Form
        renderLeadForm();
      } else {
        // Show Results
        renderResults();
      }
    } else if (type === 'CALCULATOR') {
      // Render ROI Calculator input fields
      const inputs = config.inputs || [
        { label: 'Lưu lượng truy cập mỗi tháng', name: 'traffic', value: 10000 },
        { label: 'Tỉ lệ chuyển đổi (%)', name: 'convRate', value: 2 },
        { label: 'Giá trị đơn hàng (VNĐ)', name: 'orderValue', value: 250000 }
      ];

      const formDiv = document.createElement('div');
      formDiv.style.cssText = "display:flex; flex-direction:column; gap:12px; margin-bottom:20px;";
      
      inputs.forEach(inp => {
        const wrap = document.createElement('div');
        wrap.innerHTML = '<label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:5px;">' + inp.label + '</label>';
        const inputEl = document.createElement('input');
        inputEl.type = 'number';
        inputEl.name = inp.name;
        inputEl.value = inp.value;
        inputEl.style.cssText = "w-full; width: 93%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;";
        inputEl.oninput = () => calculateRoi();
        wrap.appendChild(inputEl);
        formDiv.appendChild(wrap);
      });
      container.appendChild(formDiv);

      const resDiv = document.createElement('div');
      resDiv.id = 'growth-roi-results';
      resDiv.style.cssText = "background:#f8fafc; border:1px solid #e2e8f0; padding:16px; border-radius:10px; margin-bottom:20px;";
      container.appendChild(resDiv);

      // Kêu gọi nhận báo cáo chi tiết
      const ctaBtn = document.createElement('button');
      ctaBtn.style.cssText = "width:100%; padding:12px; background:" + themeColor + "; color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer;";
      ctaBtn.innerText = "Nhận báo cáo phân tích chi tiết";
      ctaBtn.onclick = () => {
        currentStep = 1; // trigger lead form step
        render();
      };
      container.appendChild(ctaBtn);

      calculateRoi();

      function calculateRoi() {
        const trafficVal = parseFloat(container.querySelector('input[name="traffic"]').value) || 0;
        const convRateVal = parseFloat(container.querySelector('input[name="convRate"]').value) || 0;
        const orderVal = parseFloat(container.querySelector('input[name="orderValue"]').value) || 0;
        
        // formula: traffic * (convRate/100) * orderVal
        const conversions = trafficVal * (convRateVal / 100);
        const revenue = conversions * orderVal;
        
        const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
        resDiv.innerHTML = '<div style="font-size:12px; color:#64748b;">Doanh thu ước tính hàng tháng</div><div style="font-size:22px; font-weight:800; color:\' + themeColor + \'; margin-top:4px;">\' + formatter.format(revenue) + \'</div><div style="font-size:11px; color:#94a3b8; margin-top:6px;">Chuyển đổi thành công: \' + Math.round(conversions) + \' đơn hàng</div>\';
      }
    } else if (type === 'AI_REPORT') {
      // Render AI Growth/SEO Report Form
      const formDiv = document.createElement('div');
      formDiv.style.cssText = "display:flex; flex-direction:column; gap:12px; margin-bottom:20px;";
      
      formDiv.innerHTML = ' \\
        <div> \\
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:5px;">Họ và tên của bạn</label> \\
          <input type="text" name="name" placeholder="Nguyễn Văn A" required style="width:93%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;"> \\
        </div> \\
        <div> \\
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:5px;">Địa chỉ Email nhận báo cáo</label> \\
          <input type="email" name="email" placeholder="name@company.com" required style="width:93%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;"> \\
        </div> \\
        <div> \\
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:5px;">URL Website cần phân tích</label> \\
          <input type="url" name="targetUrl" placeholder="https://mycompany.com" required style="width:93%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;"> \\
        </div> \\
      \';
      container.appendChild(formDiv);

      const subBtn = document.createElement('button');
      subBtn.style.cssText = "width:100%; padding:12px; background:\' + themeColor + \'; color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer;";
      subBtn.innerText = "Nhận Báo Cáo AI Miễn Phí";
      
      const statusDiv = document.createElement('div');
      statusDiv.style.cssText = "display:none; font-size:12px; margin-top:10px; text-align:center; line-height:1.5;";
      container.appendChild(statusDiv);

      subBtn.onclick = async () => {
        const nameInput = formDiv.querySelector(\'input[name="name"]\');
        const emailInput = formDiv.querySelector(\'input[name="email"]\');
        const targetUrlInput = formDiv.querySelector(\'input[name="targetUrl"]\');
        
        if (!nameInput.value || !emailInput.value || !targetUrlInput.value) {
          alert(\'Vui lòng điền đầy đủ tất cả thông tin.\');
          return;
        }

        subBtn.disabled = true;
        subBtn.innerText = "Đang phân tích website bằng AI...";
        
        try {
          const res = await fetch("\' + apiHost + \'/api/public/lead-magnet/generate", {
            method: \'POST\',
            headers: { \'Content-Type\': \'application/json\' },
            body: JSON.stringify({
              targetUrl: targetUrlInput.value,
              email: emailInput.value,
              name: nameInput.value,
              workspaceId: \' + widget.workspaceId + \'
            })
          });
          const resData = await res.json();
          if (res.ok) {
            container.innerHTML = \'<div style="text-align:center; padding:10px 0;"><div style="font-size:36px; font-weight:800; color:\' + themeColor + \';">✓ Gửi Thành Công</div><div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:12px;">Đang lập báo cáo tăng trưởng!</div><p style="font-size:13px; color:#64748b; line-height:1.5; margin:10px 0 0 0;">\' + (resData.message || \'Báo cáo đang được khởi tạo bằng AI và sẽ gửi qua email của bạn trong vài phút!\') + \'</p></div>\';
          } else {
            throw new Error(resData.error || \'Lỗi không xác định\');
          }
        } catch(err) {
          console.error("Failed to trigger lead magnet:", err);
          subBtn.disabled = false;
          subBtn.innerText = "Nhận Báo Cáo AI Miễn Phí";
          statusDiv.style.display = \'block\';
          statusDiv.style.color = \'#e11d48\';
          statusDiv.innerText = "Có lỗi xảy ra: " + err.message;
        }
      };
      container.appendChild(subBtn);
    }
  }

  function renderLeadForm() {
    container.innerHTML = '';
    const header = document.createElement('div');
    header.style.marginBottom = '20px';
    header.innerHTML = '<h3 style="margin:0 0-6px 0; font-size:18px; font-weight:700; color:#0f172a;">Hoàn thành nhận kết quả</h3><p style="margin:0; font-size:13px; color:#64748b; line-height:1.5;">Vui lòng cung cấp thông tin liên hệ để gửi kết quả phân tích đầy đủ và mở khóa báo cáo.</p>';
    container.appendChild(header);

    const f = document.createElement('form');
    f.style.cssText = "display:flex; flex-direction:column; gap:12px;";
    
    f.innerHTML = ' \
      <div> \
        <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:5px;">Họ và tên của bạn</label> \
        <input type="text" name="name" required style="width:93%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;"> \
      </div> \
      <div> \
        <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:5px;">Địa chỉ Email</label> \
        <input type="email" name="email" required style="width:93%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;"> \
      </div> \
    ';

    const subBtn = document.createElement('button');
    subBtn.type = 'submit';
    subBtn.style.cssText = "padding:12px; background:" + themeColor + "; color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; margin-top:8px;";
    subBtn.innerText = "Xem kết quả ngay";
    f.appendChild(subBtn);

    f.onsubmit = async (e) => {
      e.preventDefault();
      subBtn.disabled = true;
      subBtn.innerText = "Đang gửi đăng ký...";

      const emailVal = f.querySelector('input[name="email"]').value;
      const nameVal = f.querySelector('input[name="name"]').value;

      try {
        await fetch("${apiHost}/api/widgets/public/lead", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            widgetId: ${widget.id},
            workspaceId: ${widget.workspaceId},
            name: nameVal,
            email: emailVal,
            answers: JSON.stringify(answers),
            score: score
          })
        });
      } catch(err) {
        console.error("Failed to submit lead to Growth OS CRM:", err);
      }
      
      currentStep = type === 'QUIZ' ? config.questions.length + 1 : 2;
      render();
    };

    container.appendChild(f);
  }

  function renderResults() {
    container.innerHTML = '';
    if (type === 'QUIZ') {
      const questions = config.questions || [];
      const pct = Math.round((score / questions.length) * 100);
      container.innerHTML = '<div style="text-align:center; padding:10px 0;"><div style="font-size:36px; font-weight:800; color:' + themeColor + ';">' + score + ' / ' + questions.length + '</div><div style="font-size:15px; font-weight:700; color:#1e293b; margin-top:12px;">Trả lời chính xác ' + pct + '%</div><p style="font-size:13px; color:#64748b; line-height:1.5; margin:10px 0 0 0;">Cảm ơn bạn đã tham gia trả lời khảo sát trắc nghiệm. Báo cáo phân tích chi tiết đã được gửi về email của bạn.</p></div>';
    } else {
      container.innerHTML = '<div style="text-align:center; padding:10px 0;"><div style="font-size:36px; font-weight:800; color:' + themeColor + ';">✓ Thành Công</div><div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:12px;">Đăng ký nhận báo cáo thành công!</div><p style="font-size:13px; color:#64748b; line-height:1.5; margin:10px 0 0 0;">Chúng tôi đã chuẩn bị tài liệu phân tích cơ hội tối ưu hóa doanh số cho doanh nghiệp của bạn và gửi vào hòm thư điện tử.</p></div>';
    }
  }

  render();
})();
    `;
        res.send(scriptJs);
    }
    catch (err) {
        res.status(500).send('console.error("[Growth OS Widget] Lỗi máy chủ khi sinh mã nhúng");');
    }
});
// POST /api/widgets/public/lead - Collect lead form submission from interactive widget
router.post('/public/lead', async (req, res) => {
    try {
        const { name, email, phone, widgetId, workspaceId, answers, score } = req.body;
        if (!email || !widgetId || !workspaceId) {
            res.status(400).json({ error: 'Email, widgetId và workspaceId là bắt buộc' });
            return;
        }
        const wsId = parseInt(String(workspaceId), 10);
        const widgetIdInt = parseInt(String(widgetId), 10);
        // 1. Find or create Customer
        let customer = await prisma_1.default.customer.findFirst({
            where: { email: email.toLowerCase(), workspaceId: wsId }
        });
        if (customer) {
            customer = await prisma_1.default.customer.update({
                where: { id: customer.id },
                data: {
                    name: name || customer.name,
                    phone: phone || customer.phone,
                    status: 'NEW',
                    trafficSource: `Widget tương tác #${widgetIdInt}`
                }
            });
        }
        else {
            customer = await prisma_1.default.customer.create({
                data: {
                    name: name || email.split('@')[0],
                    email: email.toLowerCase(),
                    phone: phone || null,
                    status: 'NEW',
                    workspaceId: wsId,
                    trafficSource: `Widget tương tác #${widgetIdInt}`
                }
            });
        }
        // Award referral points if referer cookie is active
        await (0, referrals_1.checkAndApplyReferral)(customer.id, req);
        // 2. Save submission log in customer notes or general submissions
        const notesContent = `Khách hàng hoàn thành Widget tương tác #${widgetIdInt}.\nKết quả trắc nghiệm/tính toán: ${answers || ''}\nĐiểm số trắc nghiệm: ${score !== undefined ? score : 'N/A'}`;
        await prisma_1.default.customerNote.create({
            data: {
                customerId: customer.id,
                content: notesContent
            }
        });
        res.json({ success: true, customerId: customer.id });
    }
    catch (err) {
        console.error('Failed to submit widget lead:', err);
        res.status(500).json({ error: err.message || 'Lỗi gửi thông tin đăng ký' });
    }
});
exports.default = router;
