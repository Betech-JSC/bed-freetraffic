import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header / Navbar */}
      <header className="flex items-center justify-between px-8 py-6 bg-white sticky top-0 z-50 shadow-sm">
        <div className="text-2xl font-bold text-gray-900 tracking-tight">Be Traffic</div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <a href="#" className="hover:text-brand transition-colors duration-300">Sản phẩm</a>
          <a href="#" className="hover:text-brand transition-colors duration-300">Tính năng</a>
          <a href="#" className="hover:text-brand transition-colors duration-300">Bảng giá</a>
          <a href="#" className="hover:text-brand transition-colors duration-300">Tài nguyên</a>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Đăng nhập</Link>
          <Link href="/dashboard" className="px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-hover transition-colors shadow-sm">
            Bắt đầu miễn phí
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative px-8 py-20 lg:py-32 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
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
              <Link href="/dashboard" className="px-8 py-4 bg-brand text-white text-base font-semibold rounded-lg hover:bg-brand-hover transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
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
        <section className="bg-surface py-24 px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Tại sao chọn Be Traffic?</h2>
              <p className="text-gray-500">Giải pháp toàn diện cho sự tăng trưởng bền vững</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1 */}
              <div className="premium-card p-8 group">
                <div className="w-12 h-12 bg-brand-light rounded-xl flex items-center justify-center text-brand mb-6 transition-transform group-hover:scale-110">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Tự động hóa hoàn toàn</h3>
                <p className="text-gray-600 leading-relaxed text-sm">Hệ thống tự vận hành 24/7, tối ưu hóa quy trình làm việc và giảm thiểu sai sót do con người.</p>
              </div>

              {/* Card 2 */}
              <div className="premium-card p-8 group">
                <div className="w-12 h-12 bg-brand-light rounded-xl flex items-center justify-center text-brand mb-6 transition-transform group-hover:scale-110">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Đa kênh thông minh</h3>
                <p className="text-gray-600 leading-relaxed text-sm">Kết nối SEO, Social và Email Marketing vào một luồng dữ liệu duy nhất, đồng bộ hóa trải nghiệm khách hàng.</p>
              </div>

              {/* Card 3 */}
              <div className="premium-card p-8 group">
                <div className="w-12 h-12 bg-brand-light rounded-xl flex items-center justify-center text-brand mb-6 transition-transform group-hover:scale-110">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Phân tích AI chuyên sâu</h3>
                <p className="text-gray-600 leading-relaxed text-sm">Dự báo xu hướng và phân tích hành vi người dùng bằng thuật toán AI tiên tiến nhất hiện nay.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Bảng giá */}
        <section className="py-24 px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Bảng giá linh hoạt</h2>
              <p className="text-gray-500">Phù hợp với mọi quy mô doanh nghiệp</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center max-w-5xl mx-auto">
              {/* Starter */}
              <div className="premium-card p-8 text-center border-gray-200">
                <h4 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2">STARTER</h4>
                <div className="text-5xl font-extrabold text-gray-900 mb-6">$49<span className="text-lg text-gray-400 font-normal">/mo</span></div>
                <ul className="text-left space-y-4 mb-8 text-sm text-gray-600">
                  <li className="flex items-center gap-2"><span>✓</span> 5,000 Traffic/tháng</li>
                  <li className="flex items-center gap-2"><span>✓</span> Basic SEO Automation</li>
                  <li className="flex items-center gap-2"><span>✓</span> Email Support</li>
                </ul>
                <button className="w-full py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors">Chọn Starter</button>
              </div>

              {/* PRO */}
              <div className="premium-card p-10 text-center border-brand shadow-[0_10px_40px_-10px_rgba(192,74,21,0.25)] relative scale-105 z-10">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-bold uppercase tracking-wider py-1.5 px-5 rounded-full shadow-md">
                  Phổ biến nhất
                </div>
                <h4 className="text-brand text-sm font-bold uppercase tracking-wider mb-2 mt-2">PRO</h4>
                <div className="text-5xl font-extrabold text-gray-900 mb-6">$149<span className="text-lg text-gray-400 font-normal">/mo</span></div>
                <ul className="text-left space-y-4 mb-8 text-sm text-gray-600">
                  <li className="flex items-center gap-2 font-medium text-gray-900"><span className="text-brand">✓</span> 50,000 Traffic/tháng</li>
                  <li className="flex items-center gap-2 font-medium text-gray-900"><span className="text-brand">✓</span> Advanced AI Content</li>
                  <li className="flex items-center gap-2 font-medium text-gray-900"><span className="text-brand">✓</span> Multi-channel Sync</li>
                  <li className="flex items-center gap-2 font-medium text-gray-900"><span className="text-brand">✓</span> Priority Support</li>
                </ul>
                <button className="w-full py-4 bg-brand text-white rounded-lg font-bold hover:bg-brand-hover transition-colors shadow-md">Chọn Pro</button>
              </div>

              {/* Enterprise */}
              <div className="premium-card p-8 text-center border-gray-200">
                <h4 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2">ENTERPRISE</h4>
                <div className="text-4xl font-extrabold text-gray-900 mb-6 mt-1">Custom</div>
                <ul className="text-left space-y-4 mb-8 text-sm text-gray-600">
                  <li className="flex items-center gap-2"><span>✓</span> Không giới hạn Traffic</li>
                  <li className="flex items-center gap-2"><span>✓</span> Dedicated Account Manager</li>
                  <li className="flex items-center gap-2"><span>✓</span> Custom API Integration</li>
                </ul>
                <button className="w-full py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors">Liên hệ Sales</button>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-brand py-24 px-8 text-center relative overflow-hidden">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[size:20px_20px]"></div>
          
          <div className="max-w-3xl mx-auto relative z-10">
            <h2 className="text-4xl font-extrabold text-white mb-6">Sẵn sàng bùng nổ Traffic?</h2>
            <p className="text-brand-light text-lg mb-10 max-w-xl mx-auto">Gia nhập cùng hàng ngàn doanh nghiệp đang sử dụng Be Traffic để tăng trưởng không giới hạn.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="px-8 py-4 bg-white text-brand text-base font-bold rounded-lg hover:bg-gray-100 transition-all shadow-lg hover:-translate-y-0.5 w-full sm:w-auto">
                Đăng ký ngay
              </button>
              <button className="px-8 py-4 bg-transparent text-white border border-white/40 text-base font-bold rounded-lg hover:bg-white/10 transition-colors w-full sm:w-auto">
                Tư vấn giải pháp
              </button>
            </div>
            <p className="text-white/70 text-sm mt-8">* Không cần thẻ tín dụng. Thử nghiệm miễn phí 14 ngày.</p>
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="bg-surface py-12 px-8 text-gray-500 text-sm border-t border-gray-200">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
           <div className="md:col-span-2">
              <div className="text-xl font-bold text-gray-900 mb-4">Be Traffic</div>
              <p className="max-w-xs leading-relaxed">Giải pháp tăng trưởng traffic tự động hàng đầu khu vực. Mang lại sự tăng trưởng bền vững cho mọi doanh nghiệp.</p>
           </div>
           <div>
              <h4 className="font-bold text-gray-900 mb-4 uppercase tracking-wider text-xs">Sản phẩm</h4>
              <ul className="space-y-3">
                <li><a href="#" className="hover:text-brand transition-colors">Tính năng</a></li>
                <li><a href="#" className="hover:text-brand transition-colors">Bảng giá</a></li>
                <li><a href="#" className="hover:text-brand transition-colors">Tích hợp</a></li>
              </ul>
           </div>
           <div>
              <h4 className="font-bold text-gray-900 mb-4 uppercase tracking-wider text-xs">Hỗ trợ</h4>
              <ul className="space-y-3">
                <li><a href="#" className="hover:text-brand transition-colors">Liên hệ</a></li>
                <li><a href="#" className="hover:text-brand transition-colors">Tài liệu</a></li>
                <li><a href="#" className="hover:text-brand transition-colors">API</a></li>
              </ul>
           </div>
        </div>
        <div className="max-w-7xl mx-auto text-center pt-8 border-t border-gray-200">
          © 2026 Be Traffic. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
