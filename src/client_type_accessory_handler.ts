import { ClientFilterAccessoryHandler } from './client_filter_accessory_handler';
import { ClientType } from './client_type';

export class ClientTypeAccessoryHandler extends ClientFilterAccessoryHandler {
  static override SUBJECT_CLASS_NAME = ClientType.name;
  static override SUBJECT_CONTEXT_KEY = 'clientType';

  get type() {
    return this.subject as ClientType;
  }

  protected override subjectFromContext(context) {
    return this.platform.clientTypes.find(clientType => clientType.name === context.name) || null;
  }

  override get subjectContext() {
    return {
      name: this.type.name,
    };
  }
}
