import { useCallback, useEffect, useState } from 'react'

const DEFAULT_SECONDS = 60

export function useResendCooldown(initialSeconds = DEFAULT_SECONDS) {
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const startCooldown = useCallback(
    (seconds = initialSeconds) => {
      setCooldown(seconds)
    },
    [initialSeconds],
  )

  return {
    cooldown,
    canResend: cooldown === 0,
    startCooldown,
  }
}
