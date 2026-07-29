import { CertificationRuleConfig } from "./_components/certification-rule-config"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function JobAbilityConfigPage({ params }: PageProps) {
  const { id } = await params
  return <CertificationRuleConfig positionId={id} />
}
