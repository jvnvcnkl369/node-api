import { Transform } from "stream";
import { tryParseJson } from "./helpers";
const delimiter = ",";
let tail = "";

export const createStringChunkToObjectTransform = () =>
  new Transform({
    defaultEncoding: "utf8",
    transform(chunk, encoding, cb) {
      try {
        if (!chunk) {
          cb();
        }
        const pieces = (tail + chunk)
          .replace('{"items":[', "")
          .replace("}]", "")
          .split(delimiter);
        const lastPiece = pieces[pieces.length - 1];
        const tailLen = delimiter.length - 1;
        tail = lastPiece.slice(-tailLen);
        pieces[pieces.length - 1] = lastPiece.slice(0, -tailLen);

        for (const piece of pieces) {
          const parsedObject = tryParseJson(piece);
          if (parsedObject && parsedObject.fileUrl) {
            this.push(parsedObject.fileUrl);
          }
        }
        cb();
      } catch (error) {
        console.log("error", error);
      }
    },
    flush(cb) {
      const parsedObject = tryParseJson(tail);
      if (parsedObject && parsedObject.fileUrl) {
        this.push(parsedObject.fileUrl);
      }
      cb();
    },
  });

export const createUrlToObjectTransform = () =>
  new Transform({
    objectMode: true,
    transform(chunk: any, encoding: any, callback: any) {
      try {
        console.log("Chunks in transformer", chunk);

        //   transformUrl(chunk);
        this.push(chunk);

        callback();
      } catch (err) {
        callback(err);
      }
    },
  });

export const dataStructure: any = {};

const transformUrl = (url: string): void => {
  try {
    const urlObj = new URL(decodeURI(url));
    const ipAddress = urlObj.hostname;
    const pathSegments = urlObj.pathname
      .split("/")
      .filter((segment) => segment);

    if (!dataStructure[ipAddress]) {
      dataStructure[ipAddress] = [];
    }
    let currentLevel = dataStructure[ipAddress];
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      if (i === pathSegments.length - 1) {
        currentLevel.push(segment);
      } else {
        let nextLevel = currentLevel.find(
          (item: any) => typeof item === "object" && item[segment]
        );
        if (!nextLevel) {
          nextLevel = { [segment]: [] };
          currentLevel.push(nextLevel);
        }
        currentLevel = nextLevel[segment];
      }
    }
  } catch (error) {}
};
