interface EurtisanBunWritableStream {
  write(chunk: Uint8Array): number
}

interface EurtisanBunFile extends Blob {
  exists(): Promise<boolean>
  json(): Promise<unknown>
}

interface EurtisanBunSubprocess {
  readonly stdout: ReadableStream<Uint8Array>
  readonly stderr: ReadableStream<Uint8Array>
  readonly exited: Promise<number>
}

declare const Bun: {
  readonly stdout: EurtisanBunWritableStream
  readonly stderr: EurtisanBunWritableStream
  file(path: string): EurtisanBunFile
  serve(options: {
    port: number
    hostname: string
    fetch(request: Request): Response | Promise<Response>
  }): unknown
  spawn(
    command: string[],
    options: {
      cwd: string
      env: NodeJS.ProcessEnv
      stdin: 'inherit'
      stdout: 'pipe'
      stderr: 'pipe'
    },
  ): EurtisanBunSubprocess
}
