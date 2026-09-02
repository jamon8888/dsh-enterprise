#!/usr/bin/env node
/**
 * dsh-enterprise CLI entry — yargs.
 * @module @deepseek-ai/dsh-enterprise-cli
 */
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { runInit } from './init.js'
import { runDoctor } from './doctor.js'
import { verifyReceipt } from './receipt.js'

export async function main(argv = hideBin(process.argv)): Promise<void> {
  await yargs(argv)
    .scriptName('dsh-enterprise')
    .command(
      'init',
      'scaffold DSH Enterprise into a repo',
      (y) =>
        y
          .option('with', { type: 'string', array: true, description: 'include optional features (iit-guards, watchtower)' })
          .option('without', { type: 'string', array: true, description: 'exclude optional features' })
          .option('force', { type: 'boolean', default: false }),
      async (args) => {
        await runInit({ with: args.with as string[] | undefined, without: args.without as string[] | undefined, force: args.force as boolean })
        console.log('dsh-enterprise init done')
      },
    )
    .command(
      'doctor',
      'validate repo scaffolding',
      (y) => y.option('run-guards', { type: 'boolean', default: false }).option('github', { type: 'boolean', default: false }),
      async (args) => {
        const res = await runDoctor({ runGuards: args['run-guards'] as boolean, github: args.github as boolean })
        if (res.ok) console.log('doctor: ok')
        else {
          for (const i of res.issues) console.error(`doctor: ${i}`)
          process.exitCode = 1
        }
      },
    )
    .command(
      'bootstrap',
      'bootstrap GitHub App installation',
      (y) => y.option('org', { type: 'string', demandOption: true }).option('installation-id', { type: 'string', demandOption: true }),
      async (args) => {
        console.log(`bootstrap org=${args.org} installation-id=${args['installation-id']} — stub (no network)`)
      },
    )
    .command(
      'guard',
      'guard subcommands',
      (y) =>
        y.command(
          'run <id>',
          'run a guard',
          (yy) => yy.positional('id', { type: 'string', demandOption: true }).option('agent', { type: 'string' }),
          async (args) => {
            console.log(`guard run id=${args.id} agent=${args.agent ?? ''} — stub`)
          },
        ).demandCommand(),
    )
    .command(
      'receipt',
      'receipt subcommands',
      (y) =>
        y.command(
          'verify <runId>',
          'verify a receipt',
          (yy) => yy.positional('runId', { type: 'string', demandOption: true }),
          async (args) => {
            const res = await verifyReceipt(args.runId as string)
            console.log(res.message)
            if (!res.ok) process.exitCode = 1
          },
        ).demandCommand(),
    )
    .demandCommand()
    .strict()
    .help()
    .parse()
}

// Only auto-run when invoked as bin, not when imported in tests
if (import.meta.url === `file://${process.argv[1]}`) {
  void main()
}
