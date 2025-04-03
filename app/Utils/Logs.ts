export function logTaskBoundary(isStart: boolean, taskName: string) {
  console.log('============================')
  console.log('||')
  console.log(`|| ${isStart ? 'Start' : 'End'} ${taskName}`)
  console.log('||')
  console.log('============================')
}
