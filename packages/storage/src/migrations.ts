export type SqlMigration = {
  version: string;
  name: string;
  fileName: string;
};

export const storageMigrations: SqlMigration[] = [
  {
    version: '001',
    name: 'initial_schema',
    fileName: '001_initial_schema.sql',
  },
];