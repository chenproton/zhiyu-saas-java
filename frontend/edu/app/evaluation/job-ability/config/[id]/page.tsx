import { useParams } from 'react-router'
import { PositionWeightConfig } from './_components/position-weight-config'

export default function JobAbilityConfigPage() {
  const { id } = useParams() as { id: string }
  return <PositionWeightConfig positionId={id!} />
}
