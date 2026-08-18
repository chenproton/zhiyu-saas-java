'use client'

import { MALL_URL } from '@/lib/external-links'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/locale-provider'

export function Footer({ className }: { className?: string }) {
  const t = useT()
  return (
    <footer className={cn('relative mt-20 bg-[#141a2e]', className)}>
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-primary" />

      <div className="max-w-6xl mx-auto px-4 sm:px-10 pt-12 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <h3 className="text-[15px] font-semibold text-white">{t('场景化数智教学服务平台')}</h3>
            <p className="text-[13px] text-[#a8b3cf] leading-relaxed">{t('专注职业教育数字化')}</p>
            <div className="text-[12px] text-[#6b7a99]">{t('版本：V3.2.1')}</div>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-[13px] text-[#9db4e0] hover:text-white transition-colors"
            >
              {t('访问官网 →')}
            </a>
          </div>

          <div className="space-y-3">
            <h3 className="text-[15px] font-semibold text-white">{t('教学资源')}</h3>
            <p className="text-[13px] text-[#a8b3cf] leading-relaxed">
              {t('岗位标准、实践场景、企业导师')}
            </p>
            <a
              href={`${MALL_URL}/login`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[13px] text-[#9db4e0] hover:text-white transition-colors"
            >
              {t('进入资源商城 →')}
            </a>
          </div>

          <div className="space-y-3">
            <h3 className="text-[15px] font-semibold text-white">{t('技术支持')}</h3>
            <ul className="space-y-2 text-[13px] text-[#a8b3cf]">
              <li>{t('服务热线：400-888-8888')}</li>
              <li>{t('邮箱：support@example.com')}</li>
              <li>
                <a href="#" className="text-[#9db4e0] hover:text-white transition-colors">
                  {t('使用手册')}
                </a>
              </li>
              <li>
                <a href="#" className="text-[#9db4e0] hover:text-white transition-colors">
                  {t('常见问题')}
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-[15px] font-semibold text-white">{t('校内支持')}</h3>
            <ul className="space-y-2 text-[13px] text-[#a8b3cf]">
              <li>{t('授权院校：XX职业技术学院')}</li>
              <li>{t('校内管理员：张老师')}</li>
              <li>{t('管理员电话：0000-12345678')}</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#29324a]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-[12px] text-[#6b7a99]">
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-[#a8b3cf] transition-colors">
                {t('隐私政策')}
              </a>
              <span className="text-[#29324a]">|</span>
              <a href="#" className="hover:text-[#a8b3cf] transition-colors">
                {t('用户协议')}
              </a>
            </div>
            <div className="text-center md:text-right leading-relaxed">
              {t(
                '版权所有 © 2020-2026 杭州知与未来科技有限公司 ｜ 软件著作权登记号：2020SR0123456 ｜ 京ICP备2025105397号-1',
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
