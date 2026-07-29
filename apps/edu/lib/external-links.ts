/**
 * 外部平台链接配置。
 *
 * 各子平台地址默认指向演示环境，可通过 NEXT_PUBLIC_* 环境变量覆盖
 * （例如部署到 https 环境时覆盖 SCENE_PLATFORM_URL，grading iframe 即可走 https）。
 */

function fromEnv(name: string, fallback: string): string {
  return process.env[name] || fallback
}

/** 职业岗位平台（岗位/批次/审批流管理） */
export const CAREER_PLATFORM_URL = fromEnv(
  "NEXT_PUBLIC_CAREER_PLATFORM_URL",
  "http://111.170.170.202:3002"
)

/** 实践场景平台（场景资源、学生/教师学习页、评分页） */
export const SCENE_PLATFORM_URL = fromEnv(
  "NEXT_PUBLIC_SCENE_PLATFORM_URL",
  "http://111.170.170.202:3003"
)

/** 产业联盟与品牌运营平台 */
export const ALLIANCE_PLATFORM_URL = fromEnv(
  "NEXT_PUBLIC_ALLIANCE_PLATFORM_URL",
  "http://111.170.170.202:3004"
)

/** 能力评价与测评资源管理平台 */
export const ABILITY_PLATFORM_URL = fromEnv(
  "NEXT_PUBLIC_ABILITY_PLATFORM_URL",
  "http://111.170.170.202:3005"
)

/** 课程学习平台（混合课程学习页） */
export const COURSE_LEARN_URL = fromEnv(
  "NEXT_PUBLIC_COURSE_LEARN_URL",
  "http://111.170.170.202:3006"
)

/** 教学资源商城 */
export const MALL_URL = fromEnv(
  "NEXT_PUBLIC_MALL_URL",
  "http://111.170.170.202:3010"
)

/** AI 辅助创建服务（岗位/场景智能体） */
export const AI_ASSISTANT_URL = fromEnv(
  "NEXT_PUBLIC_AI_ASSISTANT_URL",
  "http://demo2.zhiyu.com.cn:5000"
)
