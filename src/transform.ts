import { Transform } from "stream";
import { tryParseJson } from "./helpers";
import path from "path";
import { TransformedData } from "./types/interfaces";

export const createStringChunkToFileUrlTransform = () => {
  const delimiter = ",";
  let buffer = "";

  return new Transform({
    defaultEncoding: "utf8",
    transform(chunk, encoding, cb) {
      try {
        buffer += chunk.toString();
        const items = buffer
          .replace('{"items":[', "")
          .replace("}]", "")
          .split(delimiter);
        buffer = items.pop() || "";

        for (const item of items) {
          const parsedObject = tryParseJson(item);
          if (parsedObject?.fileUrl) {
            this.push(parsedObject.fileUrl);
          }
        }
        cb();
      } catch (error) {
        console.log("error", error);
      }
    },
    flush(cb) {
      const parsedObject = tryParseJson(buffer);
      if (parsedObject?.fileUrl) {
        this.push(parsedObject.fileUrl);
      }
      cb();
    },
  });
};

export const createUrlToObjectTransform = () => {
  let transformedObject: TransformedData = {} as TransformedData;

  let currentIp = "";
  let currentDirectory = "";
  let isFirstChunk = true;

  const formatChunk = (chunk: string): string => {
    if (isFirstChunk) {
      isFirstChunk = false;
      return `{"${currentIp}":[${chunk}`;
    }
    return `,${chunk}`;
  };

  const processUrl = (url: string, push: (chunk: any) => void): void => {
    const urlObj = new URL(decodeURI(url));
    const ipAddress = urlObj.hostname;
    const pathSegments = urlObj.pathname.split("/").filter(Boolean);
    currentIp = ipAddress;

    if (currentDirectory && currentDirectory !== pathSegments[0]) {
      flushCurrentDirectoryData(push);
    }

    currentDirectory = pathSegments[0];

    transformedObject[ipAddress] = transformedObject[ipAddress] || [];
    let currentLevel = transformedObject[ipAddress];

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      if (i === pathSegments.length - 1 && path.extname(segment)) {
        currentLevel.push(segment);
      } else {
        let nextLevel = currentLevel.find(
          (item): item is { [key: string]: any } =>
            typeof item === "object" && segment in item
        );
        if (!nextLevel) {
          nextLevel = { [segment]: [] };
          currentLevel.push(nextLevel);
        }
        currentLevel = nextLevel[segment];
      }
    }
  };

  const flushCurrentDirectoryData = (push: (chunk: any) => void): void => {
    if (currentIp && transformedObject[currentIp]) {
      const dataToSend = transformedObject[currentIp].shift();
      if (dataToSend) {
        push(formatChunk(JSON.stringify(dataToSend)));
      }
    }
  };

  return new Transform({
    objectMode: true,
    transform(chunk: any, encoding: any, callback: any) {
      try {
        processUrl(chunk, this.push.bind(this));
        callback();
      } catch (err) {
        callback(err);
      }
    },
    flush(cb) {
      const lastObject = transformedObject[currentIp] || [];
      let lastChunk = "";
      for (const item of lastObject) {
        lastChunk += formatChunk(JSON.stringify(item));
      }
      lastChunk += "]}";
      this.push(lastChunk);
      cb();
    },
  });
};
