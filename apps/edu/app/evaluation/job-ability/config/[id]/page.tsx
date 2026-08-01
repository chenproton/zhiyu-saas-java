import { PositionWeightConfig } from './_components/position-weight-config'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function JobAbilityConfigPage({ params }: PageProps) {
  const { id } = await params
  return <PositionWeightConfig positionId={id} />
}
