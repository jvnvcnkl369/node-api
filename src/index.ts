import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import spawnProcess from "./child-process";
import {
  createStringChunkToFileUrlTransform,
  createUrlToObjectTransform,
} from "./transform";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;
const externalUrl =  process.env.EXTERNAL_API || "https://rest-test-eight.vercel.app/api/test";
const curlArgs = ["-X", "GET", "-o", "-", externalUrl];

app.get("/api/files", async (req: Request, res: Response) => {
  try {
    res.setHeader("Content-Type", "text/html; charset=UTF-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.status(202).write("Request accepted, processing data...");

    const stringChunkToFileUrlTransform = createStringChunkToFileUrlTransform();
    const urlToObjectTransform = createUrlToObjectTransform();

    spawnProcess("curl", curlArgs, stringChunkToFileUrlTransform);

    stringChunkToFileUrlTransform.on("data", (chunk) => {
      urlToObjectTransform.write(chunk.toString());
    }).on("finish", () => {
      console.log("ending stringChunkToFileUrlTransform");
      urlToObjectTransform.end();
    }).on("error", (error) => {
      console.log("Error in stringChunkToFileUrlTransform", error);
    });

    urlToObjectTransform.on("data", (chunk) => {
      res.write(chunk);
    }).on("error", (error) => {
      console.log("Error in urlToObjectTransform", error);
    }).on("end", () => {
      console.log("ending urlToObjectTransform");
      res.end();
    });
  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
