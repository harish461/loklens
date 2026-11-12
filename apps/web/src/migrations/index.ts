import * as migration_20261109_112620_initial from './20261109_112620_initial';
import * as migration_20261112_105238_reporter_workflow from './20261112_105238_reporter_workflow';

export const migrations = [
  {
    up: migration_20261109_112620_initial.up,
    down: migration_20261109_112620_initial.down,
    name: '20261109_112620_initial',
  },
  {
    up: migration_20261112_105238_reporter_workflow.up,
    down: migration_20261112_105238_reporter_workflow.down,
    name: '20261112_105238_reporter_workflow'
  },
];
