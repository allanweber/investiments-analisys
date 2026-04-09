import { createFileRoute } from '@tanstack/react-router'

import { messages as m } from '#/messages'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">{m.about.kicker}</p>
        <h1 className="font-headline mb-3 text-4xl font-extrabold tracking-tight text-on-surface sm:text-5xl">
          {m.about.title}
        </h1>
        <p className="m-0 max-w-3xl font-body text-base leading-8 text-on-surface-variant">
          {m.about.body}
        </p>
      </section>
    </main>
  )
}
