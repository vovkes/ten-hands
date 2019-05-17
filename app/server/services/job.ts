import { v4 as uuid } from "uuid";
import execa from "execa";
import pKill from "tree-kill";
import io from "socket.io";
import path from "path";

let jobSocket = null;
class Job {
  // static socket: any;
  private room: any;
  constructor(room) {
    this.room = room;
  }

  public start(command, projectPath) {
    try {
      const job = command.cmd;
      // const execDir = command.execDir;
      const execPath = path.normalize(projectPath);

      const room = this.room;
      const n = execa(job, {
        cwd: execPath || process.cwd()
      });
      jobSocket.emit(`job_started`, { room, data: n });
      n.stdout.on("data", chunk => {
        jobSocket.emit(`output`, { room, data: chunk.toString() });
      });

      n.stderr.on("data", chunk => {
        try {
          jobSocket.emit(`error`, { room, data: chunk.toString() });
        } catch (error) {
          console.log(`Catching: ${chunk.toString()}`);
        } finally {
          jobSocket.emit(`error`, { room, data: chunk.toString() });
          console.log(`id in crash: ${jobSocket.id}`);
        }
      });

      n.on("close", (code, signal) => {
        jobSocket.emit(`close`, {
          room,
          data: `Exited with code ${code} by signal ${signal}`
        });
      });

      n.on("exit", (code, signal) => {
        jobSocket.emit(`exit`, {
          room,
          data: `Exited with code ${code} by signal ${signal}`
        });
      });

      setTimeout(() => {
        console.log("Attempt Kill");

        pKill(n.pid);
      }, 10000);
    } catch (error) {
      console.log(`Big Catch: ${error.message}`);
    }
  }
}

export class JobManager {
  public static _instance: JobManager;
  io: any;
  socket: any;
  private constructor() {}

  private killJob(room, pid) {
    console.log(`Killing Job`);
    pKill(pid);
    this.io.to(room).emit(`job_killed-${room}`, {
      room,
      data: pid
    });
  }

  private bindEvents() {
    this.socket.on(
      "subscribe",
      ({
        command,
        room,
        projectPath
      }: {
        command: IProjectCommand;
        room: string;
        projectPath: string;
      }) => {
        const job = command.cmd;

        // this.socket.join(room, () => {
        //   this.io.to(room).emit(`joined_room-${room}`, {
        //     room,
        //     data: `${job} joined room ${room}`
        //   });
        // });
        const process = new Job(room);
        process.start(command, projectPath);
      }
    );

    this.socket.on("unsubscribe", ({ room, pid }) => {
      this.killJob(room, pid);
      // this.socket.leave(room);
    });
  }

  public bindIO(io: any) {
    if (!this.io) {
      this.io = io;
    }
    this.io.on("connection", socket => {
      console.log(`Client connected to socket: `, socket.id);
      jobSocket = socket;
      this.socket = socket;
      this.socket.on("disconnect", function() {
        console.log("Disconnecting: ", socket.id);
      });
      this.bindEvents();
    });
  }
  public static getInstance() {
    return this._instance || new this();
  }
}

export default Job;