import dotenv from 'dotenv';
import minimist from 'minimist';
import { reconciliationService } from '../services/reconcile.js';
import pino from 'pino';

dotenv.config();

const logger = pino();

async function main() {
  const argv = minimist(process.argv.slice(2));
  const repair = !!argv.repair;

  logger.info(`Starting reconciliation (dry run: ${!repair})`);

  try {
    const report = await reconciliationService.reconcileAll(repair);

    logger.info(
      {
        startTime: report.startTime,
        endTime: report.endTime,
        groupsScanned: report.groupsScanned,
        driftCounts: report.driftCounts,
      },
      'Reconciliation complete'
    );

    // If there were drifts, and we didn't repair, maybe exit with 1?
    // The issue says "dry-run repair CLI". Doesn't specify exit code for drifts found.
    const hasDrifts = Object.values(report.driftCounts).reduce((a, b) => a + b, 0) > 0;

    if (hasDrifts && !repair) {
      logger.warn('Drifts found. Run with --repair to fix them.');
    } else if (hasDrifts && repair) {
      logger.info('Drifts were found and repaired.');
    } else {
      logger.info('No drifts found. System is fully reconciled.');
    }

    process.exit(0);
  } catch (error) {
    logger.error(error, 'Reconciliation failed with an error');
    // "A transport error mid-scan aborts with a distinct exit code and leaves the DB untouched."
    process.exit(2); // distinct exit code
  }
}

main();
