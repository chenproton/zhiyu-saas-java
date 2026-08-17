'use client'

// 全局右下角 YI KNOW 浮动机器人（portal 全站挂载，app/portal/layout.tsx）。
// v2.7.2：面板升级为全站统一居中弹窗（YIKnowChatDialog，含遮罩+毛玻璃质感），
// 内含智能对话/历史会话/我的知识库/我的智能体；条目点击跳详情页并自动关闭弹窗。
import { useState } from 'react'
import { X } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'
import {
  YIKnowChatDialog,
} from '@/app/portal/apps/ai/_components/yi-know-chat-dialog'

export function YiKnowAssistant() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <>
      {/* Floating robot button */}
      <div className="fixed bottom-6 right-5 z-[100] yi-robot-wrap flex items-end gap-3 group">
        {/* Close button — appears on hover */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-muted-foreground/50 hover:bg-muted-foreground/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          aria-label={t('关闭 YI KNOW')}
        >
          <X className="w-3 h-3 text-white" />
        </button>
        {/* Speech bubble */}
        {!open && (
          <div
            className="relative bg-white rounded-2xl px-5 py-3.5 shadow-lg max-w-[210px]"
            style={{
              boxShadow: '0 20px 48px -8px rgba(60,80,140,0.2), 0 4px 12px rgba(60,80,140,0.06)',
            }}
          >
            <div className="absolute -top-px left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-full" />
            <span className="text-lg font-extrabold text-[#1a73e8] inline-flex items-center gap-1.5">
              <span
                style={{
                  animation: 'rb-wave 1.6s ease-in-out infinite',
                  transformOrigin: '70% 70%',
                }}
              >
                👋
              </span>
              {t('Hi～')}
            </span>
            <p className="mt-1.5 text-sm text-[#2a3650] leading-relaxed">
              {t('我是')}{' '}
              <span className="text-[#1a73e8] font-extrabold">
                YI
                <span className="inline-block w-1.5 h-1.5 bg-[#ffce3d] rounded-full mx-0.5 align-middle shadow-[0_0_8px_#ffce3d]" />
                Know
              </span>
              <br />
              {t('你的专属智能助理')}
            </p>
            {/* tail */}
            <div
              className="absolute -right-[14px] top-14 w-0 h-0"
              style={{
                borderStyle: 'solid',
                borderWidth: '10px 0 10px 16px',
                borderColor: 'transparent transparent transparent #fff',
                filter: 'drop-shadow(3px 2px 3px rgba(90,120,180,.08))',
              }}
            />
          </div>
        )}

        <button
          onClick={() => setOpen(!open)}
          className="block w-28 h-28 rounded-full p-0 border-0 bg-transparent cursor-pointer transition-transform hover:scale-110 active:scale-95 shrink-0"
          aria-label={t('YI KNOW 教学智能助理')}
          style={{ filter: 'drop-shadow(0 8px 16px rgba(120,140,180,.35))' }}
        >
          <div
            className={`transition-all duration-300 ${open ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}
          >
            <svg
              viewBox="0 0 380 380"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: '100%', height: '100%', display: 'block' }}
            >
              <defs>
                <linearGradient id="rb-helmet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f1f5fb" />
                  <stop offset="0.5" stopColor="#dfe6f0" />
                  <stop offset="1" stopColor="#c4cedd" />
                </linearGradient>
                <radialGradient id="rb-visor" cx="50%" cy="38%" r="75%">
                  <stop offset="0" stopColor="#1c4258" />
                  <stop offset="0.55" stopColor="#123243" />
                  <stop offset="1" stopColor="#0a2230" />
                </radialGradient>
                <linearGradient id="rb-body" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#eef2f9" />
                  <stop offset="0.6" stopColor="#dde4ef" />
                  <stop offset="1" stopColor="#bfc8d8" />
                </linearGradient>
                <linearGradient id="rb-arm" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#e6ecf5" />
                  <stop offset="1" stopColor="#c0cad9" />
                </linearGradient>
                <linearGradient id="rb-ear" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#d4dce8" />
                  <stop offset="1" stopColor="#b3bdcd" />
                </linearGradient>
                <radialGradient id="rb-eyeGlow" cx="50%" cy="40%" r="60%">
                  <stop offset="0" stopColor="#bdf6ff" />
                  <stop offset="0.5" stopColor="#5fe1f0" />
                  <stop offset="1" stopColor="#2bb6cf" />
                </radialGradient>
                <filter id="rb-soft" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" />
                </filter>
                <clipPath id="rb-visorClip">
                  <path d="M90 105 C90 73 128 58 190 58 C252 58 290 73 290 105 C290 137 288 147 274 156 C254 168 222 174 190 174 C158 174 126 168 106 156 C92 147 90 137 90 105 Z" />
                </clipPath>
              </defs>
              <g className="robot-all">
                <g className="arm-left">
                  <path
                    d="M95 200 C58 215 38 270 32 305 C28 332 40 352 60 350 C80 348 90 322 95 296 C100 270 108 235 118 220 Z"
                    fill="url(#rb-arm)"
                  />
                </g>
                <g className="arm-right">
                  <path
                    d="M285 200 C322 215 342 270 348 305 C352 332 340 352 320 350 C300 348 290 322 285 296 C280 270 272 235 262 220 Z"
                    fill="url(#rb-arm)"
                  />
                </g>
                <g className="body-breath">
                  <path
                    d="M105 235 C105 200 140 180 190 180 C240 180 275 200 275 235 C275 305 240 355 190 355 C140 355 105 305 105 235 Z"
                    fill="url(#rb-body)"
                  />
                  <path
                    d="M150 178 C150 165 168 160 190 160 C212 160 230 165 230 178 L230 196 C230 210 212 216 190 216 C168 216 150 210 150 196 Z"
                    fill="#c3ccdb"
                  />
                  <circle cx="190" cy="300" r="8" fill="#5fe1f0" className="eye-shine" />
                  <circle
                    cx="190"
                    cy="300"
                    r="8"
                    fill="none"
                    stroke="#bdf6ff"
                    strokeWidth="1.5"
                    opacity=".5"
                  />
                </g>
                <g className="head">
                  <path
                    d="M160 22 C160 10 175 6 190 6 C205 6 220 10 220 22 L220 34 L160 34 Z"
                    fill="url(#rb-helmet)"
                  />
                  <line x1="190" y1="6" x2="190" y2="-8" stroke="#aab5c6" strokeWidth="3" />
                  <circle cx="190" cy="-10" r="6" fill="#5fe1f0" className="antenna-light" />
                  <rect x="48" y="92" width="34" height="62" rx="16" fill="url(#rb-ear)" />
                  <rect x="56" y="100" width="14" height="46" rx="7" fill="#9aa6b8" opacity=".5" />
                  <circle cx="63" cy="123" r="5" fill="#5fe1f0" className="ear-light" />
                  <rect x="298" y="92" width="34" height="62" rx="16" fill="url(#rb-ear)" />
                  <rect x="310" y="100" width="14" height="46" rx="7" fill="#9aa6b8" opacity=".5" />
                  <circle cx="317" cy="123" r="5" fill="#5fe1f0" className="ear-light r" />
                  <path
                    d="M70 110 C70 58 120 32 190 32 C260 32 310 58 310 110 C310 138 305 160 295 168 C300 145 290 80 190 80 C90 80 80 145 85 168 C75 160 70 138 70 110 Z"
                    fill="url(#rb-helmet)"
                  />
                  <path
                    d="M82 105 C82 68 125 50 190 50 C255 50 298 68 298 105 C298 142 298 152 282 162 C260 176 225 182 190 182 C155 182 120 176 98 162 C82 152 82 142 82 105 Z"
                    fill="#aeb9ca"
                  />
                  <path
                    d="M90 105 C90 73 128 58 190 58 C252 58 290 73 290 105 C290 137 288 147 274 156 C254 168 222 174 190 174 C158 174 126 168 106 156 C92 147 90 137 90 105 Z"
                    fill="url(#rb-visor)"
                  />
                  <g clipPath="url(#rb-visorClip)">
                    <path
                      d="M110 72 C140 62 240 62 270 72 C245 66 135 66 110 72 Z"
                      fill="#3a6378"
                      opacity=".6"
                    />
                    <ellipse cx="135" cy="78" rx="28" ry="9" fill="#ffffff" opacity=".12" />
                    <rect
                      className="scanline"
                      x="90"
                      y="100"
                      width="200"
                      height="3"
                      fill="#5fe1f0"
                      opacity=".4"
                    />
                  </g>
                  <circle cx="143" cy="103" r="26" fill="#1d4a5e" opacity=".55" />
                  <circle cx="237" cy="103" r="26" fill="#1d4a5e" opacity=".55" />
                  <g className="eyes">
                    <g className="pupils">
                      <circle cx="143" cy="103" r="18" fill="url(#rb-eyeGlow)" />
                      <path
                        d="M127 100 Q143 88 159 100 Q143 96 127 100 Z"
                        fill="#eafdff"
                        className="eye-shine"
                      />
                      <circle
                        cx="143"
                        cy="103"
                        r="18"
                        fill="none"
                        stroke="#bdf6ff"
                        strokeWidth="1.5"
                        opacity=".5"
                      />
                      <circle cx="237" cy="103" r="18" fill="url(#rb-eyeGlow)" />
                      <path
                        d="M221 100 Q237 88 253 100 Q237 96 221 100 Z"
                        fill="#eafdff"
                        className="eye-shine"
                      />
                      <circle
                        cx="237"
                        cy="103"
                        r="18"
                        fill="none"
                        stroke="#bdf6ff"
                        strokeWidth="1.5"
                        opacity=".5"
                      />
                    </g>
                  </g>
                  <path
                    className="mouth"
                    d="M178 132 C178 142 184 148 190 148 C196 148 202 142 202 132 Z"
                    fill="url(#rb-eyeGlow)"
                  />
                </g>
              </g>
            </svg>
          </div>
          {open && (
            <div className="absolute inset-0 flex items-center justify-center">
              <X className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
          )}
        </button>
      </div>

      {/* 真实 YIKnow 聊天：全站统一居中弹窗（与 /portal/apps 入口同一组件） */}
      <YIKnowChatDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
