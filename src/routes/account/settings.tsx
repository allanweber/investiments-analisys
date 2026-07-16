import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { AiSettingsCard } from '@/components/account/AiSettingsCard'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { listAiApiKeysFn } from '@/lib/account-server'
import type { AiApiKeyStatus } from '@/lib/account-server'
import { messages as m } from '@/messages'

export const Route = createFileRoute('/account/settings')({
  loader: () => listAiApiKeysFn(),
  component: SettingsPage,
})

function SettingsPage() {
  const initial = Route.useLoaderData()
  const [keys, setKeys] = useState<AiApiKeyStatus[]>(initial)

  async function refresh() {
    const rows = await listAiApiKeysFn()
    setKeys(rows)
  }

  return (
    <div className="flex flex-col gap-6">
      <AiSettingsCard initialKeys={keys} onRefresh={refresh} />
      <Card>
        <CardHeader>
          <CardTitle>{m.account.moreSettingsTitle}</CardTitle>
          <CardDescription>{m.account.moreSettingsDesc}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
