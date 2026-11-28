import { expect, test } from 'claude-code/testing'

const BAND = { plugin: 'wf-progress-band', component: 'AbovePrompt', props: { hasSurvey: false, isCollapsed: false, isWorking: true, maxRows: 10, columns: 80 } } as const

test('band draws on desktop', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await $.session.start({ cwd: '/home/claude/myfit', surface: 'desktop', isInteractive: true })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface } as never)
    const t = await ui.find({ type: 'Text' })
    expect(t?.text).toBeTruthy()
    await ui.unmount()
  }
})
