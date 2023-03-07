import { ClientFilterAccessoryHandler } from './client_filter_accessory_handler';
import { ClientRule } from './client_rule';

export class ClientRuleAccessoryHandler extends ClientFilterAccessoryHandler {
  static override SUBJECT_CLASS_NAME = ClientRule.name;
  static override SUBJECT_CONTEXT_KEY = 'clientRule';

  get rule() {
    return this.subject as ClientRule;
  }

  protected override subjectFromContext(context) {
    return this.platform.clientRules.find(clientRule => clientRule.label === context.label) || null;
  }

  override get subjectContext() {
    return {
      label: this.rule.label,
    };
  }
}
