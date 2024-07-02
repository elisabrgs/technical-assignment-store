import { JSONArray, JSONObject, JSONPrimitive } from "./json-types";

export type Permission = "r" | "w" | "rw" | "none";

export type StoreResult = Store | JSONPrimitive | undefined;

export type StoreValue =
  | JSONObject
  | JSONArray
  | StoreResult
  | (() => StoreResult);

export interface IStore {
  defaultPolicy: Permission;
  allowedToRead(key: string): boolean;
  allowedToWrite(key: string): boolean;
  read(path: string): StoreResult;
  write(path: string, value: StoreValue): StoreValue;
  writeEntries(entries: JSONObject): void;
  entries(): JSONObject;
}

export const Restrict = (permission?: Permission) =>  {
    return (target: any, key: string): void => {
      if (!permission) {
        permission = target.defaultPolicy;
      }
      if (!target.permissions) {
        Object.defineProperty(target, "permissions", {
          value: { [key]: permission}
        })
      } else {
        target.permissions[key] = permission;
      }
    };
  }

export class Store implements IStore {
  defaultPolicy: Permission = "rw";

  allowedToRead(key: string): boolean {
    return ((this as any).permissions?.[key] || this.defaultPolicy).includes("r");
  }

  allowedToWrite(key: string): boolean {
    return ((this as any).permissions?.[key] || this.defaultPolicy).includes("w");
  }

  read(path: string): StoreResult {
    const pathKeys = path.split(':');
    let storeValue = (this as any);
    for (let i = 0; i < pathKeys.length; i++) {
      const pathKey = pathKeys[i];
      if (!storeValue.allowedToRead(pathKey)) {
        throw new Error(`Reading "${path}" is not allowed.`);
      }
      storeValue = storeValue?.[pathKey];
      if (typeof storeValue === "function") {
        storeValue = storeValue();
      }
    }
    return storeValue;
  }

  write(path: string, value: StoreValue, store?: Store): StoreValue {
    const pathKeys = path.split(":");
    const pathKeysLength = pathKeys.length;
    let storeToUpdate = store || this;
    for (let i = 0; i < pathKeysLength; i++)  {
      const pathKey = pathKeys[i];
      if (!storeToUpdate.allowedToWrite(pathKey)) {
        throw new Error(`Writing "${path}" is not allowed.`);
      }
      if (typeof (storeToUpdate as any)[pathKey] === "object" && typeof value === 'string') {
        storeToUpdate = (storeToUpdate as any)[pathKey];
        storeToUpdate.write(pathKeys.slice(1).join(""), value)
      } else if (typeof value === "object" || (!(storeToUpdate as any)[pathKey] && i != pathKeysLength - 1)) {
        (storeToUpdate as any)[pathKey] = new Store();
        storeToUpdate = (storeToUpdate as any)[pathKey];
        if (typeof value === "object" ) {
          storeToUpdate.writeEntries(value as JSONObject, storeToUpdate);
        }
      } else {
        (storeToUpdate as any)[pathKey] = value;
      }
    }
    return value;
  }

  writeEntries(entries: JSONObject, store?: Store): void {
    for (const [key, value] of Object.entries(entries)) {
      this.write(key, value, store)
    }
  }

  entries(): JSONObject {
    const entries: JSONObject = {};
    for (const [key, value] of Object.entries((this as any).permissions)) {
      if (value !== "none") {
        entries[key] = (this as any)[key];
      }
    }
    return entries;
  }
}
