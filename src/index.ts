import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import axios from "axios";
import { Transform } from "stream";

dotenv.config();
const app: Express = express();
const port = process.env.PORT || 3000;
const externalUrl = "https://rest-test-eight.vercel.app/api/test";

const delimiter = ",";
let tail = "";
const dataStructure: any = {};

const transformData = (url: string): any => {

  const urlObj = new URL(decodeURI(url));
  const ipAddress = urlObj.hostname;
  const pathSegments = urlObj.pathname.split("/").filter((segment) => segment);

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
};

const stringsChunkToObjectTransform = new Transform({
  defaultEncoding: "utf8",
  transform(chunk, encoding, cb) {
    try {
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
          objectToUrlTransform.write(parsedObject.fileUrl);
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
      objectToUrlTransform.write(parsedObject.fileUrl);
    }
    cb();
  },
});

const objectToUrlTransform = new Transform({
  objectMode: true,
  transform(chunk: any, encoding: any, callback: any) {
    try {
      transformData(chunk);
      callback();
    } catch (err) {
      callback(err);
    }
  },
});

app.get("/api/files", async (req: Request, res: Response) => {
  try {
    res.setHeader("Content-Type", "text/html; charset=UTF-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.status(202).write("Request accepted, processing data...");
    const response = await axios.get(externalUrl, { responseType: "stream" });

    for await (const chunk of  response.data) {
      stringsChunkToObjectTransform.write(chunk.toString());
    }

    response.data.on('end', () => {
      stringsChunkToObjectTransform.write(null);
    })
    
    for await (const chunk of createChunksOfTransformedData()) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

const tryParseJson = (string: string) => {
  try {
    return JSON.parse(string);
  } catch (error) {
    return null;
  }
};

function* createChunksOfTransformedData() {
  const stringifyData = JSON.stringify(dataStructure);
  const chunkSize = 1000;
  for (let i = 0; i < stringifyData.length; i += chunkSize) {
    yield stringifyData.slice(0, chunkSize);
  }
  yield stringifyData;
}
