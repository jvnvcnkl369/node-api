export interface File {
  fileName: string;
}

export interface Directory {
  [directoryName: string]: Directory | File[];
}

export interface TransformedData {
  [ipAddress: string]: (string | Directory)[];
}
