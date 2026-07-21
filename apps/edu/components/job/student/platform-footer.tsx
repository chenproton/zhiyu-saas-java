"use client"

export function PlatformFooter() {
  return (
    <footer className="bg-[#141a2e] mt-auto w-full">
      <div className="h-[3px] bg-gradient-to-r from-[#8b5cf6] via-[#818cf8] to-[#22d3ee]" />
      <div className="max-w-[1600px] mx-auto px-8 py-12 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="text-[15px] font-semibold text-white mb-3">场景化数智教学服务平台</h3>
            <p className="text-[13px] text-[#a8b3cf] leading-relaxed">专注职业教育数字化</p>
            <div className="text-xs text-[#6b7a99] mt-2">版本：V3.2.1</div>
            <a href="#" className="text-[#22d3ee] text-[13px] inline-flex items-center gap-1 mt-2 hover:text-[#67e8f9]">
              访问官网 →
            </a>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-white mb-3">教学资源</h3>
            <p className="text-[13px] text-[#a8b3cf] leading-relaxed">岗位标准、实践场景、企业导师</p>
            <a href="#" className="text-[#22d3ee] text-[13px] inline-flex items-center gap-1 mt-2 hover:text-[#67e8f9]">
              进入资源商城 →
            </a>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-white mb-3">技术支持</h3>
            <ul className="text-[13px] text-[#a8b3cf] leading-relaxed space-y-1">
              <li>服务热线：400-888-8888</li>
              <li>邮箱：support@example.com</li>
              <li><a href="#" className="text-[#22d3ee] hover:text-[#67e8f9]">使用手册</a></li>
              <li><a href="#" className="text-[#22d3ee] hover:text-[#67e8f9]">常见问题</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-white mb-3">校内支持</h3>
            <ul className="text-[13px] text-[#a8b3cf] leading-relaxed space-y-1">
              <li>授权院校：XX职业技术学院</li>
              <li>校内管理员：张老师</li>
              <li>管理员电话：0000-12345678</li>
            </ul>
          </div>
        </div>
        <hr className="border-[#29324a] my-10" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[#6b7a99]">
          <div>
            <a href="#" className="hover:text-[#a8b3cf]">隐私政策</a>
            <span className="text-[#29324a] mx-2">|</span>
            <a href="#" className="hover:text-[#a8b3cf]">用户协议</a>
          </div>
          <div className="text-center md:text-right">
            版权所有 © 2020-2026 杭州知与未来科技有限公司 ｜ 软件著作权登记号：2020SR0123456 ｜ 京ICP备2025105397号-1
          </div>
        </div>
      </div>
    </footer>
  )
}
