export interface PitrConfig {
  rtoHours: number;
  rpoSeconds: number;
  walArchive: string;
  replicaRegion: string;
}
export const defaultPitr: PitrConfig = { rtoHours: 4, rpoSeconds: 0, walArchive: 's3://wal-archive', replicaRegion: 'eu-west-3' };
