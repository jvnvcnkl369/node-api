export interface File {
    fileName: string;
}

export interface SubDirectory {
    [subDirectoryName: string]: File[];
}

export interface Directory {
    [directoryName: string]: SubDirectory | File[];
}

export interface DataInterface {
    [ipAddress: string]: Directory[];
}