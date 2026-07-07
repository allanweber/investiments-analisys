import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type AiApiKeyStatus,
  removeAiApiKeyFn,
  saveAiApiKeyFn,
} from '@/lib/account-server'
import { messages as m } from '@/messages'

type Props = {
  initialKeys: AiApiKeyStatus[]
  onRefresh: () => Promise<void>
}

function ClaudeProviderRow({
  claudeKey,
  onRefresh,
}: {
  claudeKey?: AiApiKeyStatus
  onRefresh: () => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await saveAiApiKeyFn({ data: { provider: 'claude', apiKey: draft } })
      setDraft('')
      setIsEditing(false)
      await onRefresh()
    } catch {
      setError(m.account.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    setError(null)
    try {
      await removeAiApiKeyFn({ data: { provider: 'claude' } })
      await onRefresh()
    } catch {
      setError(m.account.removeError)
    } finally {
      setRemoving(false)
    }
  }

  const showInput = isEditing || !claudeKey

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/20 p-4">
      <Label htmlFor="claude-api-key">{m.account.claudeLabel}</Label>

      {showInput ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="claude-api-key"
            type="password"
            placeholder={m.account.claudeInputPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="sm:flex-1"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={!draft || saving}
              onClick={() => void handleSave()}
            >
              {saving ? m.account.saving : m.account.save}
            </Button>
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  setDraft('')
                }}
              >
                {m.account.cancel}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-sm text-on-surface-variant">
            {m.account.claudeSavedHint(claudeKey.lastFour)}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              {m.account.replace}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={removing}
              onClick={() => void handleRemove()}
            >
              {removing ? m.account.removing : m.account.remove}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">
        <p className="font-medium text-on-surface">
          {m.account.claudeHowToTitle}
        </p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-4">
          <li>{m.account.claudeHowToStep1}</li>
          <li>{m.account.claudeHowToStep2}</li>
          <li>{m.account.claudeHowToStep3}</li>
        </ol>
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-block text-primary underline"
        >
          {m.account.claudeHowToLink}
        </a>
      </div>
    </div>
  )
}

function DisabledProviderRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-outline-variant/20 p-4 opacity-60">
      <Label>{label}</Label>
      <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-on-surface-variant">
        {m.account.comingSoon}
      </span>
    </div>
  )
}

export function AiSettingsCard({ initialKeys, onRefresh }: Props) {
  const claudeKey = initialKeys.find((k) => k.provider === 'claude')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.account.aiSettingsTitle}</CardTitle>
        <CardDescription>{m.account.aiSettingsDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <ClaudeProviderRow claudeKey={claudeKey} onRefresh={onRefresh} />
        <DisabledProviderRow label={m.account.openaiLabel} />
        <DisabledProviderRow label={m.account.geminiLabel} />
      </CardContent>
    </Card>
  )
}
