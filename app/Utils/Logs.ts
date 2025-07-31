export function logTaskBoundary(isStart: boolean, taskName: string) {
  console.log('============================')
  console.log('||')
  console.log(`|| ${isStart ? 'Start' : 'End'} ${taskName} at ${new Date().toISOString()}`)
  console.log('||')
  console.log('============================')
}
