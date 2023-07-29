import { ipcMain } from "electron";
import { inject, injectable, multiInject } from "inversify";
import { Controller } from "../interfaces";
import { TYPES } from "../types";
import LoggerService from "./LoggerService";
import { error, success } from "../helper/utils";

@injectable()
export default class IpcHandlerService {
  constructor(
    @multiInject(TYPES.Controller)
    private readonly controllers: Controller[],
    @inject(TYPES.LoggerService)
    private readonly logger: LoggerService
  ) {}

  private registerIpc(
    controller: Controller,
    propertyKey: string | symbol
  ): void {
    const property = controller[propertyKey];
    if (typeof property !== "function") return;

    const channel: string = Reflect.getMetadata(
      "ipc-channel",
      controller,
      propertyKey
    );
    if (!channel) return;

    const ipcMethod: "on" | "handle" = Reflect.getMetadata(
      "ipc-method",
      controller,
      propertyKey
    );
    if (!ipcMethod) return;

    ipcMain[ipcMethod](channel, async (...args: unknown[]) => {
      try {
        let res = property.call(controller, ...args);
        if (res.then) {
          res = await res;
        }
        return success(res);
      } catch (e: unknown) {
        this.logger.error("处理 ipc 事件时异常： ", e);
        if (e instanceof Error) {
          return error(e.message);
        } else {
          return error(String(e));
        }
      }
    });
  }

  init(): void {
    for (const controller of this.controllers) {
      const Class = Object.getPrototypeOf(controller);
      Object.getOwnPropertyNames(Class).forEach((propertyKey) =>
        this.registerIpc(controller, propertyKey)
      );
    }
  }
}
