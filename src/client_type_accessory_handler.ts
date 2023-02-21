import { AccessoryHandler } from './accessory_handler';
import { ClientType } from './client_type';

export class ClientTypeAccessoryHandler extends AccessoryHandler {
  static ACCESSORY_CONTEXT_KEY = ClientType.ACCESSORY_CONTEXT_KEY;

  get subject() {
    if (this._subject) {
      return this._subject;
    }

    const clientTypeContext = this.accessory.context[ClientType.ACCESSORY_CONTEXT_KEY];
    if (!clientTypeContext) {
      return null;
    }

    const name = clientTypeContext.name;
    this._subject = this.platform.clientTypes.find(clientType => clientType.name === name) || null;
    return this._subject;
  }

  get clientType(): ClientType {
    return this.subject as ClientType;
  }
}
