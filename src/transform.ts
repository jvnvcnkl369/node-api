import { Transform } from "stream";
import { tryParseJson } from "./helpers";
import { DataInterface } from "./types/interfaces";
import path from "path";

export const createStringChunkToObjectTransform = () => {
  const delimiter = ",";
  let tail = "";

  return new Transform({
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
};

export const createUrlToObjectTransform = () => {
  let transformedObject: any = {};

  let currentIp = "";
  let currentDirectory = "";
  let startOfStream = true;
  let count = 0;

  const addExtraData = (chunk: string): string => {
    let chunkReadyToSend = "";
    if (startOfStream) {
      chunkReadyToSend += `{"${currentIp}":[${chunk}`;
    } else {
      chunkReadyToSend += `,${chunk}`;
    }
    startOfStream = false;
    return chunkReadyToSend;
  };

  return new Transform({
    objectMode: true,
    transform(chunk: any, encoding: any, callback: any) {
      try {
       
        const urlObj = new URL(decodeURI(chunk));
        const ipAddress = urlObj.hostname;
        const pathSegments = urlObj.pathname
          .split("/")
          .filter((segment) => segment);

        currentIp = ipAddress;

        if (currentDirectory && currentDirectory !== pathSegments[0]) {

          const chunkToSend = addExtraData(
            JSON.stringify(transformedObject[currentIp].shift())
          );
          currentDirectory = pathSegments[0];
          if (chunkToSend) {
            this.push(chunkToSend);
          }
        }
        currentDirectory = pathSegments[0];
        if (!transformedObject[ipAddress]) {
          transformedObject[ipAddress] = [];
        }
        let currentLevel = transformedObject[ipAddress];
        for (let i = 0; i < pathSegments.length; i++) {
          const segment = pathSegments[i];
          const segmentLevel =  pathSegments.length - 1;
          if (i === segmentLevel && path.extname(segment)) {
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
        callback();
      } catch (err) {
        callback(err);
      }
    },
    flush (cb) {
      let lastChunk = addExtraData(JSON.stringify(transformedObject[currentIp]));
      lastChunk += ']}';
      this.push(lastChunk);
      cb();
       }
  });
};

// const transformUrl = (url: string): void => {
//   try {
//     const urlObj = new URL(decodeURI(url));
//     const ipAddress = urlObj.hostname;
//     const pathSegments = urlObj.pathname
//       .split("/")
//       .filter((segment) => segment);

//     if (!dataStructure[ipAddress]) {
//       dataStructure[ipAddress] = [];
//     }
//     let currentLevel = dataStructure[ipAddress];
//     for (let i = 0; i < pathSegments.length; i++) {
//       const segment = pathSegments[i];
//       if (i === pathSegments.length - 1) {
//         currentLevel.push(segment);
//       } else {
//         let nextLevel = currentLevel.find(
//           (item: any) => typeof item === "object" && item[segment]
//         );
//         if (!nextLevel) {
//           nextLevel = { [segment]: [] };
//           currentLevel.push(nextLevel);
//         }
//         currentLevel = nextLevel[segment];
//       }
//     }
//   } catch (error) {}
// };
