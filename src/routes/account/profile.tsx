import { createFileRoute } from '@tanstack/react-router'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { messages as m } from '@/messages'

export const Route = createFileRoute('/account/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.account.profileComingSoonTitle}</CardTitle>
        <CardDescription>{m.account.profileComingSoonDesc}</CardDescription>
      </CardHeader>
    </Card>
  )
}
