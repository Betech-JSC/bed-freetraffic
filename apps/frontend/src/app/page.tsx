import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header / Navbar */}
      <header className="flex items-center justify-between px-8 py-6 bg-white sticky top-0 z-50 shadow-sm">
        <div className="text-2xl font-bold text-gray-900 tracking-tight">Be Traffic</div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <a href="#overview" className="hover:text-brand transition-colors duration-300">Sản phẩm</a>
          <a href="#features" className="hover:text-brand transition-colors duration-300">Tính năng</a>
          <a href="#pricing" className="hover:text-brand transition-colors duration-300">Bảng giá</a>
          <a href="#betech" className="hover:text-brand transition-colors duration-300">Giới thiệu công ty BeTech</a>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Đăng nhập</Link>
          <Link href="/register" className="px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-hover transition-colors shadow-sm">
            Bắt đầu miễn phí
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section id="overview" className="relative px-8 py-20 lg:py-32 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light text-brand text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-brand"></span>
              AI - Tối ưu hóa - Tự động
            </div>
            <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-[1.15]">
              Tối ưu hóa Traffic tự nhiên tự động với <span className="text-brand">AI</span>
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed max-w-xl">
              Đột phá lưu lượng truy cập từ SEO, Social và Content mà không cần nhân sự vận hành phức tạp. Hãy để AI của Be Traffic thay bạn chiếm lĩnh thị trường.
            </p>
            <div className="flex items-center gap-4 pt-4">
              <Link href="/register" className="px-8 py-4 bg-brand text-white text-base font-semibold rounded-lg hover:bg-brand-hover transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                Bắt đầu miễn phí
              </Link>
              <Link href="#demo" className="px-8 py-4 bg-white text-gray-900 border border-gray-200 text-base font-semibold rounded-lg hover:bg-gray-50 transition-all duration-300">
                Xem Demo
              </Link>
            </div>
          </div>
          <div className="relative lg:pl-10">
            {/* Image mock up with premium shadow */}
            <div className="rounded-2xl overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] border border-gray-200/50 bg-black">
              <Image 
                src="/hero-mockup.png" 
                alt="Dashboard Mockup" 
                width={800} 
                height={600} 
                className="w-full h-auto object-cover opacity-95"
                priority
              />
            </div>
            {/* Soft glow behind the image */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-brand/10 blur-[100px] -z-10 rounded-full pointer-events-none"></div>
          </div>
        </section>

        {/* Tại sao chọn Be Traffic */}
        <section id="features" className="bg-surface py-24 px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Tại sao chọn Be Traffic?</h2>
              <p className="text-gray-500">Giải pháp toàn diện cho sự tăng trưởng bền vững</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1 */}
              <div className="premium-card p-8 group">
                <h3 className="text-xl font-bold text-gray-900 mb-3">Tự động hóa hoàn toàn</h3>
                <p className="text-gray-600 leading-relaxed text-sm">Hệ thống tự vận hành 24/7, tối ưu hóa quy trình làm việc và giảm thiểu sai sót do con người.</p>
              </div>

              {/* Card 2 */}
              <div className="premium-card p-8 group">
                <h3 className="text-xl font-bold text-gray-900 mb-3">Đa kênh thông minh</h3>
                <p className="text-gray-600 leading-relaxed text-sm">Kết nối SEO, Social và Email Marketing vào một luồng dữ liệu duy nhất, đồng bộ hóa trải nghiệm khách hàng.</p>
              </div>

              {/* Card 3 */}
              <div className="premium-card p-8 group">
                <h3 className="text-xl font-bold text-gray-900 mb-3">Phân tích AI chuyên sâu</h3>
                <p className="text-gray-600 leading-relaxed text-sm">Dự báo xu hướng và phân tích hành vi người dùng bằng thuật toán AI tiên tiến nhất hiện nay.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Bảng giá */}
        <section id="pricing" className="py-24 px-8 bg-[#f8fafc]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-brand text-xs font-black uppercase tracking-widest bg-brand/10 px-3.5 py-1.5 rounded-full">Pricing Plans</span>
              <h2 className="text-4xl font-extrabold text-gray-900 mt-4 mb-4">Chọn gói dịch vụ phù hợp để bứt phá Traffic</h2>
              <p className="text-gray-500 max-w-2xl mx-auto text-sm leading-relaxed">
                Giải pháp marketing tự động hóa toàn diện, giúp doanh nghiệp tiếp cận hàng triệu khách hàng mục tiêu với chi phí tối ưu nhất.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
              {/* Starter */}
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-300">
                <div>
                  <h3 className="text-gray-900 font-extrabold text-xl">Starter</h3>
                  <p className="text-gray-400 text-xs mt-2 leading-relaxed min-h-[36px]">Lựa chọn hoàn hảo cho cá nhân và dự án khởi nghiệp nhỏ.</p>
                  <div className="text-5xl font-extrabold text-gray-900 mt-6 mb-6">
                    $49<span className="text-sm text-gray-400 font-normal">/tháng</span>
                  </div>
                  <ul className="space-y-4 text-sm text-gray-600 border-t border-gray-50 pt-6">
                    <li className="flex items-center gap-3">
                      <svg className="w-4.5 h-4.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>10.000 Traffic/tháng</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <svg className="w-4.5 h-4.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>50 bài viết AI cơ bản</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <svg className="w-4.5 h-4.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>Quản lý 1 kênh mạng xã hội</span>
                    </li>
                    <li className="flex items-center gap-3 text-gray-300">
                      <svg className="w-4.5 h-4.5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      <span className="line-through">Hỗ trợ ưu tiên 24/7</span>
                    </li>
                  </ul>
                </div>
                <button className="w-full py-3.5 border border-gray-250 rounded-xl text-gray-800 font-bold hover:bg-gray-50 transition-colors mt-8 shadow-sm">
                  Bắt đầu ngay
                </button>
              </div>

              {/* PRO */}
              <div className="bg-white rounded-3xl p-8 border-2 border-[#c04a15] shadow-lg relative flex flex-col justify-between hover:shadow-xl transition-shadow duration-300 scale-105 z-10">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#c04a15] text-white text-[10px] font-black uppercase tracking-widest py-1.5 px-6 rounded-full shadow-sm">
                  Phổ biến nhất
                </div>
                <div>
                  <h3 className="text-gray-900 font-extrabold text-xl mt-2">Pro</h3>
                  <p className="text-gray-400 text-xs mt-2 leading-relaxed min-h-[36px]">Giải pháp tối ưu cho doanh nghiệp đang trên đà tăng trưởng mạnh.</p>
                  <div className="text-5xl font-extrabold text-gray-900 mt-6 mb-6">
                    $149<span className="text-sm text-gray-400 font-normal">/tháng</span>
                  </div>
                  <ul className="space-y-4 text-sm text-gray-600 border-t border-gray-50 pt-6">
                    <li className="flex items-center gap-3 font-semibold text-gray-900">
                      <svg className="w-4.5 h-4.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>50.000 Traffic/tháng</span>
                    </li>
                    <li className="flex items-center gap-3 font-semibold text-gray-900">
                      <svg className="w-4.5 h-4.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>Nội dung AI không giới hạn</span>
                    </li>
                    <li className="flex items-center gap-3 font-semibold text-gray-900">
                      <svg className="w-4.5 h-4.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>Quản lý 5 kênh mạng xã hội</span>
                    </li>
                    <li className="flex items-center gap-3 font-semibold text-gray-900">
                      <svg className="w-4.5 h-4.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>Hỗ trợ ưu tiên qua Chat/Call</span>
                    </li>
                    <li className="flex items-center gap-3 font-semibold text-gray-900">
                      <svg className="w-4.5 h-4.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>Phân tích hành vi nâng cao</span>
                    </li>
                  </ul>
                </div>
                <button className="w-full py-4 bg-[#c04a15] text-white rounded-xl font-bold hover:bg-[#a83d0f] transition-colors mt-8 shadow-md">
                  Đăng ký Pro
                </button>
              </div>

              {/* Enterprise */}
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-300">
                <div>
                  <h3 className="text-gray-900 font-extrabold text-xl">Enterprise</h3>
                  <p className="text-gray-400 text-xs mt-2 leading-relaxed min-h-[36px]">Hạ tầng riêng biệt và giải pháp tùy chỉnh cho tập đoàn lớn.</p>
                  <div className="text-4xl font-extrabold text-gray-900 mt-7 mb-7">Custom</div>
                  <ul className="space-y-4 text-sm text-gray-600 border-t border-gray-50 pt-6">
                    <li className="flex items-center gap-3">
                      <svg className="w-4.5 h-4.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>Traffic không giới hạn</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <svg className="w-4.5 h-4.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>API Access chuyên sâu</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <svg className="w-4.5 h-4.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>Manager tài khoản riêng</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <svg className="w-4.5 h-4.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>Tùy chỉnh hệ thống Content AI</span>
                    </li>
                  </ul>
                </div>
                <button className="w-full py-3.5 border border-gray-250 rounded-xl text-gray-800 font-bold hover:bg-gray-50 transition-colors mt-8 shadow-sm">
                  Liên hệ tư vấn
                </button>
              </div>
            </div>

            {/* Câu hỏi thường gặp FAQ */}
            <div className="max-w-3xl mx-auto mt-28">
              <h3 className="text-2xl font-extrabold text-gray-900 text-center mb-8">Câu hỏi thường gặp</h3>
              <div className="space-y-4">
                <details className="group border-b border-gray-200 py-4 cursor-pointer">
                  <summary className="flex justify-between items-center font-bold text-gray-900 list-none outline-none">
                    <span>Tôi có thể hủy gói dịch vụ bất cứ lúc nào không?</span>
                    <span className="transition group-open:rotate-180">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </span>
                  </summary>
                  <p className="text-gray-500 text-sm mt-3 leading-relaxed">
                    Dạ có, anh/chị có thể nâng cấp, hạ cấp hoặc hủy gói dịch vụ bất cứ lúc nào trực tiếp từ trang cài đặt tài khoản mà không có bất kỳ phí phạt nào.
                  </p>
                </details>
                <details className="group border-b border-gray-200 py-4 cursor-pointer">
                  <summary className="flex justify-between items-center font-bold text-gray-900 list-none outline-none">
                    <span>Be Traffic có cung cấp bản dùng thử miễn phí không?</span>
                    <span className="transition group-open:rotate-180">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </span>
                  </summary>
                  <p className="text-gray-500 text-sm mt-3 leading-relaxed">
                    Dạ có, chúng tôi cung cấp bản dùng thử miễn phí 14 ngày đầy đủ tính năng cho gói Starter và Pro để anh/chị trải nghiệm hiệu quả của AI trước khi quyết định nâng cấp.
                  </p>
                </details>
                <details className="group border-b border-gray-200 py-4 cursor-pointer">
                  <summary className="flex justify-between items-center font-bold text-gray-900 list-none outline-none">
                    <span>Hình thức thanh toán được hỗ trợ là gì?</span>
                    <span className="transition group-open:rotate-180">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </span>
                  </summary>
                  <p className="text-gray-500 text-sm mt-3 leading-relaxed">
                    Chúng tôi hỗ trợ chuyển khoản ngân hàng (quét mã VietQR), thanh toán thẻ quốc tế Visa/Mastercard (qua cổng Stripe) và các ví điện tử thông dụng tại Việt Nam.
                  </p>
                </details>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-br from-[#0b0f19] to-slate-900 py-24 px-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[size:20px_20px]"></div>
          <div className="max-w-3xl mx-auto relative z-10 space-y-6">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">Sẵn sàng đưa Website của bạn lên tầm cao mới?</h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xl mx-auto">
              Tham gia cùng hơn 5,000+ doanh nghiệp đã tin dùng Be Traffic để tăng trưởng doanh thu vượt bậc.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/register" className="px-8 py-3.5 bg-[#c04a15] text-white text-sm font-extrabold rounded-xl hover:bg-[#a83d0f] transition-all shadow-md w-full sm:w-auto text-center">
                Đăng ký ngay bây giờ
              </Link>
              <Link href="/login" className="px-8 py-3.5 bg-transparent text-slate-300 border border-slate-700 text-sm font-extrabold rounded-xl hover:bg-slate-800 hover:text-white transition-colors w-full sm:w-auto text-center">
                Xem Dashboard mẫu
              </Link>
            </div>
          </div>
        </section>

        {/* Giới thiệu BeTech */}
        <section id="betech" className="bg-white py-24 px-8 border-t border-gray-100">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-[#c04a15] text-xs font-black uppercase tracking-widest bg-orange-50 px-3.5 py-1.5 rounded-full">About BeTech</span>
              <h2 className="text-3xl font-extrabold text-gray-900 mt-4 mb-4">Về BeTech</h2>
              <p className="text-gray-500 max-w-2xl mx-auto text-sm leading-relaxed">
                Đơn vị tiên phong trong nghiên cứu và ứng dụng Trí tuệ nhân tạo (AI) vào tối ưu hóa vận hành doanh nghiệp.
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
              <div className="space-y-6">
                <h3 className="text-2xl font-extrabold text-gray-900">BeTech JSC - Kiến tạo tương lai số</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Được thành lập bởi đội ngũ chuyên gia công nghệ hàng đầu, BeTech (Betech JSC) cam kết mang đến những giải pháp tăng trưởng tự động vượt trội. Hệ thống <strong>Be Traffic (Growth OS)</strong> là sản phẩm chủ lực giúp doanh nghiệp tự động hóa 100% quy trình thu hút lưu lượng truy cập tự nhiên, tối ưu hóa SEO và quản trị khách hàng RAG AI.
                </p>
                <div className="flex gap-4">
                  <div className="bg-[#f8fafc] p-4 rounded-xl border border-gray-100 flex-1">
                    <h4 className="text-[#c04a15] font-black text-sm">Sứ mệnh</h4>
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">Bình dân hóa công nghệ AI cao cấp, đồng hành cùng sự bứt phá của các doanh nghiệp vừa và nhỏ.</p>
                  </div>
                  <div className="bg-[#f8fafc] p-4 rounded-xl border border-gray-100 flex-1">
                    <h4 className="text-[#c04a15] font-black text-sm">Tầm nhìn</h4>
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">Trở thành nền tảng Growth OS tự động hóa tiếp thị đa kênh bằng AI hàng đầu khu vực.</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#f8fafc] p-8 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                <h4 className="font-extrabold text-gray-900 text-sm border-b border-gray-200 pb-3">Thông tin liên hệ công ty</h4>
                <div className="space-y-3.5 text-xs text-gray-600">
                  <div className="flex items-center gap-3">
                    <span className="text-base">🏢</span>
                    <strong>Công ty Cổ phần Công nghệ BeTech (Betech JSC)</strong>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base">📍</span>
                    <span>Tòa nhà văn phòng BeTech, Hà Nội, Việt Nam</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base">✉️</span>
                    <span>contact@betech.com.vn</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="bg-[#f8fafc] py-12 px-8 text-gray-500 text-xs border-t border-gray-150">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <div className="text-lg font-black text-gray-900">Be Traffic</div>
            <p className="text-[11px] mt-1.5">© 2026 Be Traffic. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 font-semibold text-[11px]">
            <a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Cookie Policy</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
