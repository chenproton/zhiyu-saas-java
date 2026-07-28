export { useIsMobile } from "./hooks/use-mobile"
export { useToast, toast, reducer } from "./hooks/use-toast"
export { usePlatformLinks, savePlatformLinks, useAppModules, saveAppModules } from "./hooks/use-platform-links"
export type { PlatformLink, PlatformLinksData, AppModule, AppModulePlatform, AppModulesData } from "./hooks/use-platform-links"
export { cn } from "./lib/utils"

export {
  parseDate,
  parseOptDate,
  parseQuestionBank,
  parseQuestion,
  parseExam,
  parseSceneResult,
  parseTopic,
  parseArchive,
  parseEvaluation,
  parseStudentArchive,
  parsePortrait,
  parseCertRecord,
  APPROVAL_TYPE_MAP,
  mapApprovalRecord,
  createDataContext,
  createUseData,
} from "./providers/data-provider"
export type { DataContextValue } from "./providers/data-provider"
