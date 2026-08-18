'use client'

import { useParams } from 'react-router'
import type { ResourceKind } from '@/lib/types/library'
import { ResourcesPage } from '../_components/resources-page'

export default function ResourceTypePage() {
  const params = useParams()
  const resourceKind = params.type as ResourceKind
  return <ResourcesPage resourceType={resourceKind} />
}
