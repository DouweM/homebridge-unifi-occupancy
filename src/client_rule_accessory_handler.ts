import { AccessoryHandler } from './accessory_handler';
import { ClientRule } from './client_rule';

export class ClientRuleAccessoryHandler extends AccessoryHandler {
  static ACCESSORY_CONTEXT_KEY = ClientRule.ACCESSORY_CONTEXT_KEY;

  get subject() {
    if (this._subject) {
      return this._subject;
    }

    const clientRuleContext = this.accessory.context[ClientRule.ACCESSORY_CONTEXT_KEY];
    if (!clientRuleContext) {
      return null;
    }

    const label = clientRuleContext.label;
    this._subject = this.platform.clientRules.find(clientRule => clientRule.label === label) || null;
    return this._subject;
  }

  get clientRule(): ClientRule {
    return this.subject as ClientRule;
  }
}
