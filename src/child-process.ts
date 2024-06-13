import { spawn } from "child_process";
import { Transform } from "stream";

const spawnProcess = (
  command: string,
  args: string[],
  transformStream: Transform
) => {
  const process = spawn(command, args);
  let fullData = "";
  let dataChunks = 0;

  process.stderr.on("data", (data: any) => {
    console.log(`stderr: ${data}`);
  });

  process.stdout.on("data", (data: any) => {
    fullData += data;
    dataChunks += 1;
    transformStream.write(data.toString());
  });

  process.stdout.on("end", () => {
    transformStream.end();

    console.log(`end child process `);
    console.log(`chunks: ${dataChunks}`);
  });

  process.on("close", (code: any) => {
    console.log(`child process exited with code ${code}`);
  });
};

export default spawnProcess;
